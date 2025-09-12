// Inventory Management JavaScript
// This file handles all inventory-related functionality

// Supabase Configuration (same as main app)
const supabaseUrl = 'https://jcmjazindwonrplvjwxl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjbWphemluZHdvbnJwbHZqd3hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczMDEyNjMsImV4cCI6MjA3Mjg3NzI2M30.1B6sKnzrzdNFhvQUXVnRzzQnItFMaIFL0Y9WK_Gie9g';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Global variables for inventory
let stockData = [];
let inwardDevices = [];
let outwardDevices = [];
let approvedCustomers = [];
let filteredInwardDevices = [];
let filteredOutwardDevices = [];
let currentInventoryFilter = '';
let userSession = null;

// Initialize inventory management
document.addEventListener('DOMContentLoaded', function() {
    // Get user session from localStorage
    checkInventoryUserSession();
    
    // Load initial data
    loadInventoryData();
    
    // Setup event listeners
    setupInventoryEventListeners();
    
    // Setup realtime listeners
    setupInventoryRealtimeListeners();
    
    // Show inward tab by default
    showInwardTab();
});

// Check user session for inventory
function checkInventoryUserSession() {
    const savedSession = localStorage.getItem('cautio_user_session');
    if (savedSession) {
        try {
            const sessionData = JSON.parse(savedSession);
            if (sessionData.expires > Date.now()) {
                userSession = sessionData.user;
            }
        } catch (error) {
            console.error('Error parsing session:', error);
        }
    }
    
    if (!userSession) {
        // Redirect to main dashboard login
        window.location.href = 'index.html';
    }
}

// Go back to main dashboard
function goBackToDashboard() {
    window.location.href = 'index.html';
}

// Setup event listeners for inventory
function setupInventoryEventListeners() {
    // Search functionality
    document.getElementById('inventorySearchInput').addEventListener('input', handleInventorySearch);
    
    // Form submissions
    document.getElementById('addInwardForm').addEventListener('submit', handleAddInward);
    document.getElementById('addOutwardForm').addEventListener('submit', handleAddOutward);
    
    // Set default date for outward form
    const today = new Date().toISOString().split('T')[0];
    document.querySelector('input[name="outwardDate"]').value = today;
}

// Setup realtime listeners for inventory
function setupInventoryRealtimeListeners() {
    // Listen for stock changes
    supabase
        .channel('stock_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'stock' }, 
            (payload) => {
                console.log('Stock change received!', payload);
                loadInventoryData();
            }
        )
        .subscribe();

    // Listen for inward device changes
    supabase
        .channel('inward_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'inward_devices' }, 
            (payload) => {
                console.log('Inward device change received!', payload);
                loadInventoryData();
            }
        )
        .subscribe();

    // Listen for outward device changes
    supabase
        .channel('outward_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'outward_devices' }, 
            (payload) => {
                console.log('Outward device change received!', payload);
                loadInventoryData();
            }
        )
        .subscribe();
}

// Load all inventory data
async function loadInventoryData() {
    try {
        showInventoryLoadingOverlay();
        
        // Load stock data
        await loadStockData();
        
        // Load inward devices
        await loadInwardDevicesData();
        
        // Load outward devices
        await loadOutwardDevicesData();
        
        // Load approved customers for dropdown
        await loadApprovedCustomers();
        
        // Update UI
        updateStockSummary();
        updateInventoryTabs();
        populateCustomerDropdown();
        
        hideInventoryLoadingOverlay();
    } catch (error) {
        console.error('Error loading inventory data:', error);
        showInventoryToast('Error loading inventory data', 'error');
        hideInventoryLoadingOverlay();
    }
}

// Load stock data from database
async function loadStockData() {
    try {
        const { data, error } = await supabase
            .from('stock')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error loading stock data:', error);
            throw error;
        }

        stockData = data || [];
        console.log(`Loaded ${stockData.length} stock items`);
    } catch (error) {
        console.error('Error loading stock data:', error);
        throw error;
    }
}

// Load inward devices data
async function loadInwardDevicesData() {
    try {
        const { data, error } = await supabase
            .from('inward_devices')
            .select(`
                *,
                stock (
                    device_model_no,
                    current_status,
                    device_condition,
                    sl_no,
                    po_no,
                    batch_no
                )
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error loading inward devices:', error);
            throw error;
        }

        inwardDevices = data || [];
        filteredInwardDevices = [...inwardDevices];
        console.log(`Loaded ${inwardDevices.length} inward devices`);
    } catch (error) {
        console.error('Error loading inward devices:', error);
        throw error;
    }
}

// Load outward devices data
async function loadOutwardDevicesData() {
    try {
        const { data, error } = await supabase
            .from('outward_devices')
            .select(`
                *,
                stock (
                    device_model_no,
                    current_status,
                    device_condition,
                    sl_no,
                    po_no,
                    batch_no
                )
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error loading outward devices:', error);
            throw error;
        }

        outwardDevices = data || [];
        filteredOutwardDevices = [...outwardDevices];
        console.log(`Loaded ${outwardDevices.length} outward devices`);
    } catch (error) {
        console.error('Error loading outward devices:', error);
        throw error;
    }
}

// Load approved customers for dropdown
async function loadApprovedCustomers() {
    try {
        const { data, error } = await supabase
            .from('customers')
            .select('id, customer_name, customer_email')
            .eq('approval_status', 'approved')
            .order('customer_name', { ascending: true });

        if (error) {
            console.error('Error loading approved customers:', error);
            throw error;
        }

        approvedCustomers = data || [];
        console.log(`Loaded ${approvedCustomers.length} approved customers`);
    } catch (error) {
        console.error('Error loading approved customers:', error);
        throw error;
    }
}

// Update stock summary display
function updateStockSummary() {
    const totalStock = stockData.length;
    const availableStock = stockData.filter(item => item.current_status === 'available').length;
    const allocatedStock = stockData.filter(item => item.current_status === 'allocated').length;
    
    document.getElementById('totalStockCount').textContent = totalStock;
    document.getElementById('availableStockCount').textContent = availableStock;
    document.getElementById('allocatedStockCount').textContent = allocatedStock;
}

// Update inventory tab content
function updateInventoryTabs() {
    updateInwardTab();
    updateOutwardTab();
    updateTabCounts();
}

// Update tab counts
function updateTabCounts() {
    document.getElementById('inwardCount').textContent = filteredInwardDevices.length;
    document.getElementById('outwardCount').textContent = filteredOutwardDevices.length;
}

// Update inward tab content
function updateInwardTab() {
    const inwardList = document.getElementById('inwardDevicesList');
    const inwardEmpty = document.getElementById('inwardEmptyState');

    if (filteredInwardDevices.length === 0) {
        inwardList.innerHTML = '';
        inwardEmpty.style.display = 'block';
    } else {
        inwardEmpty.style.display = 'none';
        inwardList.innerHTML = filteredInwardDevices.map(device => createInwardDeviceCard(device)).join('');
    }
}

// Update outward tab content
function updateOutwardTab() {
    const outwardList = document.getElementById('outwardDevicesList');
    const outwardEmpty = document.getElementById('outwardEmptyState');

    if (filteredOutwardDevices.length === 0) {
        outwardList.innerHTML = '';
        outwardEmpty.style.display = 'block';
    } else {
        outwardEmpty.style.display = 'none';
        outwardList.innerHTML = filteredOutwardDevices.map(device => createOutwardDeviceCard(device)).join('');
    }
}

// Create inward device card HTML
function createInwardDeviceCard(device) {
    const formatDate = (dateString) => {
        if (!dateString) return 'Not set';
        return new Date(dateString).toLocaleDateString();
    };

    const getConditionBadge = (condition) => {
        const badgeClass = `condition-badge ${condition.toLowerCase()}`;
        return `<span class="${badgeClass}">${condition}</span>`;
    };

    const stockInfo = device.stock || {};

    return `
        <div class="device-card p-4 rounded-lg">
            <div class="flex justify-between items-start mb-3">
                <div>
                    <h4 class="text-body-l-semibold dark:text-dark-base-600">${device.device_registration_number}</h4>
                    <p class="text-body-m-regular dark:text-dark-base-500">IMEI: ${device.device_imei}</p>
                </div>
                <div class="flex flex-col gap-2 items-end">
                    ${getConditionBadge(device.device_condition)}
                    <span class="px-2 py-1 text-xs rounded-full dark:bg-dark-success-600 dark:text-utility-white">
                        Inward
                    </span>
                </div>
            </div>
            <div class="device-info-grid">
                <div class="device-info-item">
                    <span class="device-info-label">Model</span>
                    <span class="device-info-value">${stockInfo.device_model_no || 'N/A'}</span>
                </div>
                <div class="device-info-item">
                    <span class="device-info-label">Batch No</span>
                    <span class="device-info-value">${stockInfo.batch_no || 'N/A'}</span>
                </div>
                <div class="device-info-item">
                    <span class="device-info-label">Inward Date</span>
                    <span class="device-info-value">${formatDate(device.inward_date)}</span>
                </div>
                <div class="device-info-item">
                    <span class="device-info-label">Status</span>
                    <span class="device-info-value">${stockInfo.current_status || 'Available'}</span>
                </div>
            </div>
            ${device.notes ? `
                <div class="mt-3 p-3 rounded-lg dark:bg-dark-fill-base-400">
                    <span class="device-info-label">Notes</span>
                    <p class="device-info-value mt-1">${device.notes}</p>
                </div>
            ` : ''}
            <div class="mt-3 flex gap-2">
                <button onclick="viewDeviceDetails('${device.device_registration_number}')" class="device-action-btn view">
                    View Details
                </button>
            </div>
        </div>
    `;
}

// Create outward device card HTML
function createOutwardDeviceCard(device) {
    const formatDate = (dateString) => {
        if (!dateString) return 'Not set';
        return new Date(dateString).toLocaleDateString();
    };

    const stockInfo = device.stock || {};

    return `
        <div class="device-card outward-card p-4 rounded-lg">
            <div class="flex justify-between items-start mb-3">
                <div>
                    <h4 class="text-body-l-semibold dark:text-dark-base-600">${device.device_registration_number}</h4>
                    <p class="text-body-m-regular dark:text-dark-base-500">IMEI: ${device.device_imei}</p>
                </div>
                <div class="flex flex-col gap-2 items-end">
                    <span class="px-2 py-1 text-xs rounded-full dark:bg-dark-semantic-danger-300 dark:text-utility-white">
                        Outward
                    </span>
                </div>
            </div>
            <div class="device-info-grid">
                <div class="device-info-item">
                    <span class="device-info-label">Customer</span>
                    <span class="device-info-value">${device.customer_name}</span>
                </div>
                <div class="device-info-item">
                    <span class="device-info-label">Location</span>
                    <span class="device-info-value">${device.location}</span>
                </div>
                <div class="device-info-item">
                    <span class="device-info-label">Outward Date</span>
                    <span class="device-info-value">${formatDate(device.outward_date)}</span>
                </div>
                <div class="device-info-item">
                    <span class="device-info-label">SIM No</span>
                    <span class="device-info-value">${device.sim_no || 'N/A'}</span>
                </div>
                <div class="device-info-item">
                    <span class="device-info-label">Model</span>
                    <span class="device-info-value">${stockInfo.device_model_no || 'N/A'}</span>
                </div>
                <div class="device-info-item">
                    <span class="device-info-label">Processed By</span>
                    <span class="device-info-value">${device.processed_by || 'N/A'}</span>
                </div>
            </div>
            ${device.notes ? `
                <div class="mt-3 p-3 rounded-lg dark:bg-dark-fill-base-400">
                    <span class="device-info-label">Notes</span>
                    <p class="device-info-value mt-1">${device.notes}</p>
                </div>
            ` : ''}
            <div class="mt-3 flex gap-2">
                <button onclick="viewDeviceDetails('${device.device_registration_number}')" class="device-action-btn view">
                    View Details
                </button>
                <button onclick="returnDevice('${device.id}')" class="device-action-btn return">
                    Return Device
                </button>
            </div>
        </div>
    `;
}

// Tab switching functions
function showInwardTab() {
    hideAllInventoryTabContent();
    document.getElementById('inwardTabContent').classList.remove('hidden');
    updateInventoryTabHighlight('inwardTab');
}

function showOutwardTab() {
    hideAllInventoryTabContent();
    document.getElementById('outwardTabContent').classList.remove('hidden');
    updateInventoryTabHighlight('outwardTab');
}

function hideAllInventoryTabContent() {
    document.getElementById('inwardTabContent').classList.add('hidden');
    document.getElementById('outwardTabContent').classList.add('hidden');
}

function updateInventoryTabHighlight(activeTabId) {
    document.querySelectorAll('.inventory-tab-button').forEach(tab => {
        tab.classList.remove('active');
    });
    
    if (activeTabId) {
        const activeTab = document.getElementById(activeTabId);
        if (activeTab) {
            activeTab.classList.add('active');
        }
    }
}

// Search functionality
function handleInventorySearch(e) {
    const searchTerm = e.target.value.toLowerCase().trim();
    currentInventoryFilter = searchTerm;
    
    if (!searchTerm) {
        // If search is empty, show all data
        filteredInwardDevices = [...inwardDevices];
        filteredOutwardDevices = [...outwardDevices];
    } else {
        // Filter inward devices
        filteredInwardDevices = inwardDevices.filter(device => {
            return (
                device.device_registration_number.toLowerCase().includes(searchTerm) ||
                device.device_imei.toLowerCase().includes(searchTerm) ||
                device.device_condition.toLowerCase().includes(searchTerm) ||
                (device.stock && device.stock.device_model_no && device.stock.device_model_no.toLowerCase().includes(searchTerm)) ||
                (device.notes && device.notes.toLowerCase().includes(searchTerm))
            );
        });

        // Filter outward devices
        filteredOutwardDevices = outwardDevices.filter(device => {
            return (
                device.device_registration_number.toLowerCase().includes(searchTerm) ||
                device.device_imei.toLowerCase().includes(searchTerm) ||
                device.customer_name.toLowerCase().includes(searchTerm) ||
                device.location.toLowerCase().includes(searchTerm) ||
                (device.sim_no && device.sim_no.toLowerCase().includes(searchTerm)) ||
                (device.stock && device.stock.device_model_no && device.stock.device_model_no.toLowerCase().includes(searchTerm)) ||
                (device.notes && device.notes.toLowerCase().includes(searchTerm))
            );
        });
    }
    
    // Update tabs content
    updateInventoryTabs();
    
    // Show search results message
    if (searchTerm && (filteredInwardDevices.length === 0 && filteredOutwardDevices.length === 0)) {
        showInventoryToast(`No results found for "${searchTerm}"`, 'warning');
    } else if (searchTerm) {
        const totalResults = filteredInwardDevices.length + filteredOutwardDevices.length;
        showInventoryToast(`Found ${totalResults} result(s) for "${searchTerm}"`, 'success');
    }
}

function clearInventorySearch() {
    document.getElementById('inventorySearchInput').value = '';
    currentInventoryFilter = '';
    filteredInwardDevices = [...inwardDevices];
    filteredOutwardDevices = [...outwardDevices];
    updateInventoryTabs();
    showInventoryToast('Search cleared - showing all devices', 'success');
}

// Modal functions
function showAddInwardForm() {
    document.getElementById('addInwardModal').classList.remove('hidden');
}

function closeAddInwardForm() {
    document.getElementById('addInwardModal').classList.add('hidden');
    document.getElementById('addInwardForm').reset();
}

function showAddOutwardForm() {
    document.getElementById('addOutwardModal').classList.remove('hidden');
    populateCustomerDropdown();
}

function closeAddOutwardForm() {
    document.getElementById('addOutwardModal').classList.add('hidden');
    document.getElementById('addOutwardForm').reset();
}

// Populate customer dropdown
function populateCustomerDropdown() {
    const customerSelect = document.getElementById('customerSelect');
    customerSelect.innerHTML = '<option value="">Select customer</option>';
    
    approvedCustomers.forEach(customer => {
        const option = document.createElement('option');
        option.value = customer.id;
        option.textContent = `${customer.customer_name} (${customer.customer_email})`;
        customerSelect.appendChild(option);
    });
}

// Handle add inward device
async function handleAddInward(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const deviceRegistrationNumber = formData.get('deviceRegistrationNumber');
    const deviceImei = formData.get('deviceImei');
    const deviceCondition = formData.get('deviceCondition');
    const notes = formData.get('notes');
    
    try {
        showInventoryLoadingOverlay();
        
        // Check if device exists in stock
        const { data: stockDevice, error: stockError } = await supabase
            .from('stock')
            .select('*')
            .eq('device_registration_number', deviceRegistrationNumber)
            .eq('device_imei', deviceImei)
            .single();
        
        if (stockError || !stockDevice) {
            throw new Error('Device not found in stock or IMEI mismatch. Please check the registration number and IMEI.');
        }
        
        // Check if device already exists in inward
        const { data: existingInward, error: existingError } = await supabase
            .from('inward_devices')
            .select('*')
            .eq('device_registration_number', deviceRegistrationNumber);
        
        if (existingError) {
            throw new Error('Error checking existing inward devices');
        }
        
        if (existingInward && existingInward.length > 0) {
            throw new Error('Device already exists in inward inventory');
        }
        
        // Add to inward devices
        const inwardData = {
            device_registration_number: deviceRegistrationNumber,
            device_imei: deviceImei,
            device_condition: deviceCondition,
            notes: notes || null,
            processed_by: userSession?.email || 'unknown',
            stock_id: stockDevice.id
        };
        
        const { error: inwardError } = await supabase
            .from('inward_devices')
            .insert([inwardData]);
        
        if (inwardError) {
            throw new Error('Error adding device to inward: ' + inwardError.message);
        }
        
        // Update stock status if needed
        await supabase
            .from('stock')
            .update({ 
                device_condition: deviceCondition,
                current_status: 'available' 
            })
            .eq('id', stockDevice.id);
        
        hideInventoryLoadingOverlay();
        closeAddInwardForm();
        showInventoryToast('Device added to inward successfully!', 'success');
        
        // Reload data
        await loadInventoryData();
        
    } catch (error) {
        hideInventoryLoadingOverlay();
        console.error('Error adding inward device:', error);
        showInventoryToast(error.message || 'Error adding device to inward', 'error');
    }
}

// Handle add outward device
async function handleAddOutward(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const deviceRegistrationNumber = formData.get('deviceRegistrationNumber');
    const deviceImei = formData.get('deviceImei');
    const customerId = formData.get('customerId');
    const location = formData.get('location');
    const outwardDate = formData.get('outwardDate');
    const simNo = formData.get('simNo');
    const notes = formData.get('notes');
    
    try {
        showInventoryLoadingOverlay();
        
        // Check if device exists in stock and is available
        const { data: stockDevice, error: stockError } = await supabase
            .from('stock')
            .select('*')
            .eq('device_registration_number', deviceRegistrationNumber)
            .eq('device_imei', deviceImei)
            .eq('current_status', 'available')
            .single();
        
        if (stockError || !stockDevice) {
            throw new Error('Device not found in stock, IMEI mismatch, or device is not available.');
        }
        
        // Get customer details
        const customer = approvedCustomers.find(c => c.id == customerId);
        if (!customer) {
            throw new Error('Customer not found');
        }
        
        // Add to outward devices
        const outwardData = {
            device_registration_number: deviceRegistrationNumber,
            device_imei: deviceImei,
            customer_id: parseInt(customerId),
            customer_name: customer.customer_name,
            location: location,
            outward_date: outwardDate,
            sim_no: simNo || null,
            notes: notes || null,
            processed_by: userSession?.email || 'unknown',
            stock_id: stockDevice.id
        };
        
        const { error: outwardError } = await supabase
            .from('outward_devices')
            .insert([outwardData]);
        
        if (outwardError) {
            throw new Error('Error adding device to outward: ' + outwardError.message);
        }
        
        // Update stock status to allocated
        await supabase
            .from('stock')
            .update({ 
                current_status: 'allocated',
                allocated_to_customer_id: parseInt(customerId),
                allocated_date: new Date().toISOString(),
                location: location,
                sim_no: simNo || null
            })
            .eq('id', stockDevice.id);
        
        hideInventoryLoadingOverlay();
        closeAddOutwardForm();
        showInventoryToast('Device allocated successfully!', 'success');
        
        // Reload data
        await loadInventoryData();
        
    } catch (error) {
        hideInventoryLoadingOverlay();
        console.error('Error adding outward device:', error);
        showInventoryToast(error.message || 'Error allocating device', 'error');
    }
}

// View device details
function viewDeviceDetails(deviceRegistrationNumber) {
    // Find device in stock
    const stockDevice = stockData.find(device => device.device_registration_number === deviceRegistrationNumber);
    
    if (!stockDevice) {
        showInventoryToast('Device details not found', 'error');
        return;
    }
    
    // Create a detailed view (you can enhance this with a modal)
    const details = `
        Device Registration Number: ${stockDevice.device_registration_number}
        Device IMEI: ${stockDevice.device_imei}
        Model: ${stockDevice.device_model_no}
        Status: ${stockDevice.current_status}
        Condition: ${stockDevice.device_condition}
        Batch No: ${stockDevice.batch_no || 'N/A'}
        PO No: ${stockDevice.po_no || 'N/A'}
        Inward Date: ${stockDevice.inward_date ? new Date(stockDevice.inward_date).toLocaleDateString() : 'N/A'}
        Location: ${stockDevice.location || 'N/A'}
        SIM No: ${stockDevice.sim_no || 'N/A'}
    `;
    
    alert(details); // You can replace this with a proper modal
}

// Return device (move from outward back to available)
async function returnDevice(outwardDeviceId) {
    if (!confirm('Are you sure you want to return this device to available stock?')) {
        return;
    }
    
    try {
        showInventoryLoadingOverlay();
        
        // Get outward device details
        const { data: outwardDevice, error: outwardError } = await supabase
            .from('outward_devices')
            .select('*')
            .eq('id', outwardDeviceId)
            .single();
        
        if (outwardError || !outwardDevice) {
            throw new Error('Outward device not found');
        }
        
        // Update stock status back to available
        await supabase
            .from('stock')
            .update({ 
                current_status: 'available',
                allocated_to_customer_id: null,
                allocated_date: null
            })
            .eq('device_registration_number', outwardDevice.device_registration_number);
        
        // Remove from outward devices
        await supabase
            .from('outward_devices')
            .delete()
            .eq('id', outwardDeviceId);
        
        hideInventoryLoadingOverlay();
        showInventoryToast('Device returned to available stock successfully!', 'success');
        
        // Reload data
        await loadInventoryData();
        
    } catch (error) {
        hideInventoryLoadingOverlay();
        console.error('Error returning device:', error);
        showInventoryToast(error.message || 'Error returning device', 'error');
    }
}

// Loading overlay functions
function showInventoryLoadingOverlay() {
    document.getElementById('inventoryLoadingOverlay').classList.remove('hidden');
}

function hideInventoryLoadingOverlay() {
    document.getElementById('inventoryLoadingOverlay').classList.add('hidden');
}

// Toast notification function
function showInventoryToast(message, type = 'success') {
    const toast = document.getElementById('inventoryToast');
    const messageEl = document.getElementById('inventoryToastMessage');
    const iconEl = document.getElementById('inventoryToastIcon');
    
    // Set message
    messageEl.textContent = message;
    
    // Set icon based on type
    let iconSVG = '';
    switch (type) {
        case 'success':
            iconSVG = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>`;
            toast.className = 'fixed top-4 right-4 z-50 max-w-sm p-4 rounded-lg shadow-lg success';
            break;
        case 'error':
            iconSVG = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>`;
            toast.className = 'fixed top-4 right-4 z-50 max-w-sm p-4 rounded-lg shadow-lg error';
            break;
        case 'warning':
            iconSVG = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>`;
            toast.className = 'fixed top-4 right-4 z-50 max-w-sm p-4 rounded-lg shadow-lg warning';
            break;
    }
    
    iconEl.innerHTML = iconSVG;
    
    // Show toast
    toast.classList.remove('hidden');
    toast.classList.add('show');
    
    // Hide after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 300);
    }, 3000);
}

// Export functions for global access (if needed)
window.inventoryFunctions = {
    showInwardTab,
    showOutwardTab,
    showAddInwardForm,
    closeAddInwardForm,
    showAddOutwardForm,
    closeAddOutwardForm,
    clearInventorySearch,
    viewDeviceDetails,
    returnDevice,
    goBackToDashboard
};
