// Inventory Management JavaScript
// This file handles all inventory-related functionality

// Supabase Configuration - Using configuration from config.js
function getSupabaseClient() {
    if (!window.CAUTIO_CONFIG) {
        console.error('Configuration not loaded. Make sure config.js is included before this script.');
        return null;
    }
    return window.supabase.createClient(window.CAUTIO_CONFIG.supabase.url, window.CAUTIO_CONFIG.supabase.key);
}

// Use global supabase variable from main script

// Global variables for inventory
// Local inventory variables (use global variables from main script when needed)
let stockData = [];
let inwardDevices = [];
let outwardDevices = [];
let filteredInwardDevices = [];
let filteredOutwardDevices = [];
let currentInventoryFilter = '';
// approvedCustomers and userSession are available globally from main script

// NEW: Device condition mapping
const DEVICE_CONDITIONS = {
    'good': 'Good',
    'lense_issue': 'Lense issue',
    'sim_module_fail': 'SIM module fail',
    'auto_restart': 'Auto restart',
    'device_tampered': 'Device tampered',
    'new': 'New Device' // For stock integration
};

// Required CSV columns for inward
const INWARD_REQUIRED_COLUMNS = [
    'Device Registration Number',
    'Device IMEI',
    'Device Condition',
    'Notes'
];

// Required CSV columns for outward
const OUTWARD_REQUIRED_COLUMNS = [
    'Device Registration Number',
    'Device IMEI',
    'Customer Name',
    'Location',
    'Outward Date',
    'SIM No',
    'Notes'
];

// Initialize inventory management
document.addEventListener('DOMContentLoaded', function() {
    // Wait for main script to initialize supabase
    if (!window.supabase || !supabase) {
        console.error('Supabase client not initialized');
        return;
    }
    
    // Get user session from localStorage
    checkInventoryUserSession();
    
    // Load initial data
    loadInventoryData();
    
    // Setup event listeners
    setupInventoryEventListeners();
    
    // Setup realtime listeners only if supabase.channel is available
    if (typeof supabase.channel === 'function') {
        setupInventoryRealtimeListeners();
    } else {
        console.warn('Realtime listeners not available - supabase.channel not found');
    }
    
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
        window.location.href = '/';
    }
}

// Go back to main dashboard
function goBackToDashboard() {
    // Navigate back to main dashboard
    window.location.href = '/';
}

// Setup event listeners for inventory
function setupInventoryEventListeners() {
    // Search functionality
    document.getElementById('inventorySearchInput').addEventListener('input', handleInventorySearch);
    
    // Form submissions
    document.getElementById('addInwardForm').addEventListener('submit', handleAddInward);
    document.getElementById('addOutwardForm').addEventListener('submit', handleAddOutward);
    
    // CSV file inputs for inward
    const inwardCSVInput = document.getElementById('inwardCSVFileInput');
    inwardCSVInput.addEventListener('change', handleInwardCSVFileSelect);
    
    // CSV file inputs for outward
    const outwardCSVInput = document.getElementById('outwardCSVFileInput');
    outwardCSVInput.addEventListener('change', handleOutwardCSVFileSelect);
    
    // Drag and drop for inward CSV
    const inwardCSVArea = document.getElementById('inwardCSVImportArea');
    inwardCSVArea.addEventListener('dragover', (e) => handleDragOver(e, 'inward'));
    inwardCSVArea.addEventListener('dragleave', (e) => handleDragLeave(e, 'inward'));
    inwardCSVArea.addEventListener('drop', (e) => handleFileDrop(e, 'inward'));
    
    // Drag and drop for outward CSV
    const outwardCSVArea = document.getElementById('outwardCSVImportArea');
    outwardCSVArea.addEventListener('dragover', (e) => handleDragOver(e, 'outward'));
    outwardCSVArea.addEventListener('dragleave', (e) => handleDragLeave(e, 'outward'));
    outwardCSVArea.addEventListener('drop', (e) => handleFileDrop(e, 'outward'));
    
    // Set default date for outward form
    const today = new Date().toISOString().split('T')[0];
    document.querySelector('input[name="outwardDate"]').value = today;
}

// Setup realtime listeners for inventory
function setupInventoryRealtimeListeners() {
    // Listen for stock changes - AUTO ADD TO INWARD
    supabase
        .channel('stock_changes')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stock' }, 
            async (payload) => {
                console.log('New stock item inserted!', payload);
                // Auto add to inward with "new" condition
                await autoAddStockToInward(payload.new);
                loadInventoryData();
            }
        )
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'stock' }, 
            (payload) => {
                console.log('Stock item updated!', payload);
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

// NEW: Auto add stock to inward when new stock is inserted
async function autoAddStockToInward(stockItem) {
    try {
        // Check if device already exists in inward
        const { data: existingInward, error: existingError } = await supabase
            .from('inward_devices')
            .select('*')
            .eq('device_registration_number', stockItem.device_registration_number);
        
        if (existingError) {
            console.error('Error checking existing inward devices:', existingError);
            return;
        }
        
        if (existingInward && existingInward.length > 0) {
            console.log('Device already exists in inward, skipping auto-add');
            return;
        }
        
        // Add to inward devices with "new" condition
        const inwardData = {
            device_registration_number: stockItem.device_registration_number,
            device_imei: stockItem.device_imei,
            device_condition: 'good', // Auto-set as "good" condition as per user requirement
            notes: 'Auto-added from stock import',
            processed_by: 'system',
            stock_id: stockItem.id,
            inward_date: new Date().toISOString().split('T')[0]
        };
        
        const { error: inwardError } = await supabase
            .from('inward_devices')
            .insert([inwardData]);
        
        if (inwardError) {
            console.error('Error auto-adding to inward:', inwardError);
        } else {
            console.log(`Auto-added device ${stockItem.device_registration_number} to inward`);
            showInventoryToast(`New device ${stockItem.device_registration_number} auto-added to inward`, 'success');
        }
        
    } catch (error) {
        console.error('Error in autoAddStockToInward:', error);
    }
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
    
    // Ensure stockData is available before proceeding
    if (!stockData || stockData.length === 0) {
        // Use localStockData from stock.js as fallback if available
        if (typeof localStockData !== 'undefined' && localStockData.length > 0) {
            stockData = localStockData;
        } else {
            return;
        }
    }
    
    const totalStock = stockData.length;
    const availableStock = stockData.filter(item => item.current_status === 'available').length;
    const allocatedStock = stockData.filter(item => item.current_status === 'allocated').length;
    
    // For inventory tab: Available stock should only include items with condition = 'good'
    const availableGoodStock = stockData.filter(item => 
        item.current_status === 'available' && item.device_condition === 'good'
    ).length;
    
    
    // Update main dashboard cards (normal logic - all available items)
    const totalStockEl = document.getElementById('totalStockCount');
    const availableStockEl = document.getElementById('availableStockCount');
    const allocatedStockEl = document.getElementById('allocatedStockCount');
    
    
    if (totalStockEl) totalStockEl.textContent = totalStock;
    if (availableStockEl) availableStockEl.textContent = availableStock;
    if (allocatedStockEl) allocatedStockEl.textContent = allocatedStock;
    
    // Update inventory page cards (special logic - only good condition available items)
    const inventoryPageTotalStockEl = document.getElementById('inventoryPageTotalStockCount');
    const inventoryPageAvailableStockEl = document.getElementById('inventoryPageAvailableStockCount');
    const inventoryPageAllocatedStockEl = document.getElementById('inventoryPageAllocatedStockCount');
    
    // Also update inventory.html cards if they exist (should use same filtered logic)
    const inventoryHTMLTotalStockEl = document.getElementById('inventoryHTMLTotalStockCount');
    const inventoryHTMLAvailableStockEl = document.getElementById('inventoryHTMLAvailableStockCount');
    const inventoryHTMLAllocatedStockEl = document.getElementById('inventoryHTMLAllocatedStockCount');
    
    if (inventoryPageTotalStockEl) inventoryPageTotalStockEl.textContent = totalStock;
    if (inventoryPageAvailableStockEl) inventoryPageAvailableStockEl.textContent = availableGoodStock; // Only good condition
    if (inventoryPageAllocatedStockEl) inventoryPageAllocatedStockEl.textContent = allocatedStock;
    
    if (inventoryHTMLTotalStockEl) inventoryHTMLTotalStockEl.textContent = totalStock;
    if (inventoryHTMLAvailableStockEl) inventoryHTMLAvailableStockEl.textContent = availableGoodStock; // Only good condition
    if (inventoryHTMLAllocatedStockEl) inventoryHTMLAllocatedStockEl.textContent = allocatedStock;
}

// Update inventory tab content
function updateInventoryTabs() {
    updateInwardTab();
    updateOutwardTab();
    updateTabCounts();
}

// Update tab counts
function updateTabCounts() {
    // Update inward and outward device counts
    const inwardCountEls = document.querySelectorAll('#inwardCount');
    const outwardCountEls = document.querySelectorAll('#outwardCount');
    
    inwardCountEls.forEach(el => el.textContent = filteredInwardDevices.length);
    outwardCountEls.forEach(el => el.textContent = filteredOutwardDevices.length);
    
    // Update inward devices counter in main stats
    const inwardDevicesCountEl = document.getElementById('inwardDevicesCount');
    const outwardDevicesCountEl = document.getElementById('outwardDevicesCount');
    
    if (inwardDevicesCountEl) inwardDevicesCountEl.textContent = filteredInwardDevices.length;
    if (outwardDevicesCountEl) outwardDevicesCountEl.textContent = filteredOutwardDevices.length;
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

// Create inward device table row HTML - UPDATED with new conditions
function createInwardDeviceCard(device) {
    const formatDate = (dateString) => {
        if (!dateString) return 'Not set';
        return new Date(dateString).toLocaleDateString();
    };

    const getConditionBadge = (condition) => {
        const conditionText = DEVICE_CONDITIONS[condition] || condition;
        // Map damaged to device_tampered for consistent styling
        const mappedCondition = condition === 'damaged' ? 'device_tampered' : condition;
        const badgeClass = `compact-badge condition-${mappedCondition}`;
        return `<span class="${badgeClass}">${conditionText}</span>`;
    };

    const getStatusBadge = (status) => {
        const statusText = status || 'Available';
        const badgeClass = status === 'available' ? 
            'compact-badge status-available' :
            'compact-badge status-allocated';
        return `<span class="${badgeClass}">● ${statusText}</span>`;
    };

    const stockInfo = device.stock || {};

    return `
        <tr>
            <td>
                <div class="compact-text-primary">${device.device_registration_number}</div>
            </td>
            <td class="compact-text-secondary">
                ${device.device_imei}
            </td>
            <td class="compact-text-primary">
                ${stockInfo.device_model_no || 'N/A'}
            </td>
            <td class="compact-text-secondary">
                ${stockInfo.batch_no || 'N/A'}
            </td>
            <td class="compact-text-secondary">
                ${formatDate(device.inward_date)}
            </td>
            <td>
                ${getStatusBadge(stockInfo.current_status)}
            </td>
            <td>
                ${getConditionBadge(device.device_condition)}
            </td>
            <td>
                <button onclick="viewDeviceDetails('${device.device_registration_number}')" class="compact-btn compact-btn-primary">
                    VIEW
                </button>
            </td>
        </tr>
    `;
}

// Create outward device table row HTML
function createOutwardDeviceCard(device) {
    const formatDate = (dateString) => {
        if (!dateString) return 'Not set';
        return new Date(dateString).toLocaleDateString();
    };

    const stockInfo = device.stock || {};

    return `
        <tr>
            <td>
                <div class="compact-text-primary">${device.device_registration_number}</div>
            </td>
            <td class="compact-text-secondary">
                ${device.device_imei}
            </td>
            <td class="compact-text-primary">
                ${device.customer_name}
            </td>
            <td class="compact-text-secondary">
                ${device.location}
            </td>
            <td class="compact-text-secondary">
                ${formatDate(device.outward_date)}
            </td>
            <td class="compact-text-secondary">
                ${device.sim_no || 'N/A'}
            </td>
            <td class="compact-text-secondary">
                ${stockInfo.device_model_no || 'N/A'}
            </td>
            <td>
                <div class="flex gap-1">
                    <button onclick="viewDeviceDetails('${device.device_registration_number}')" class="compact-btn compact-btn-primary">
                        VIEW
                    </button>
                    <button onclick="returnDevice('${device.id}')" class="compact-btn compact-btn-danger">
                        RET
                    </button>
                </div>
            </td>
        </tr>
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

// UPDATED: Handle add inward device - Now removes from outward if exists
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
        
        // NEW: Remove from outward if exists (device coming back)
        const { data: existingOutward, error: outwardCheckError } = await supabase
            .from('outward_devices')
            .select('*')
            .eq('device_registration_number', deviceRegistrationNumber);
        
        if (outwardCheckError) {
            console.error('Error checking outward devices:', outwardCheckError);
        }
        
        if (existingOutward && existingOutward.length > 0) {
            // Remove from outward
            const { error: deleteOutwardError } = await supabase
                .from('outward_devices')
                .delete()
                .eq('device_registration_number', deviceRegistrationNumber);
            
            if (deleteOutwardError) {
                console.error('Error removing from outward:', deleteOutwardError);
            } else {
                console.log(`Device ${deviceRegistrationNumber} removed from outward (returning)`);
            }
        }
        
        // Add to inward devices
        const inwardData = {
            device_registration_number: deviceRegistrationNumber,
            device_imei: deviceImei,
            device_condition: 'good', // Always set as good for inward devices per user requirement
            notes: notes || null,
            processed_by: userSession?.email || 'unknown',
            stock_id: stockDevice.id,
            inward_date: new Date().toISOString().split('T')[0]
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
                device_condition: 'good', // Always set as good for inward devices per user requirement
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

// UPDATED: Handle add outward device - Now removes from inward if exists
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
        
        // NEW: Remove from inward if exists (device going outward)
        const { data: existingInward, error: inwardCheckError } = await supabase
            .from('inward_devices')
            .select('*')
            .eq('device_registration_number', deviceRegistrationNumber);
        
        if (inwardCheckError) {
            console.error('Error checking inward devices:', inwardCheckError);
        }
        
        if (existingInward && existingInward.length > 0) {
            // Remove from inward
            const { error: deleteInwardError } = await supabase
                .from('inward_devices')
                .delete()
                .eq('device_registration_number', deviceRegistrationNumber);
            
            if (deleteInwardError) {
                console.error('Error removing from inward:', deleteInwardError);
            } else {
                console.log(`Device ${deviceRegistrationNumber} removed from inward (going outward)`);
            }
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

// NEW: CSV Upload Functions

// Handle drag over event
function handleDragOver(e, type) {
    e.preventDefault();
    const area = document.getElementById(`${type}CSVImportArea`);
    area.classList.add('drag-over');
}

// Handle drag leave event
function handleDragLeave(e, type) {
    e.preventDefault();
    const area = document.getElementById(`${type}CSVImportArea`);
    area.classList.remove('drag-over');
}

// Handle file drop event
function handleFileDrop(e, type) {
    e.preventDefault();
    const area = document.getElementById(`${type}CSVImportArea`);
    area.classList.remove('drag-over');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
            if (type === 'inward') {
                processInwardCSVFile(file);
            } else {
                processOutwardCSVFile(file);
            }
        } else {
            showInventoryToast('Please select a valid CSV file', 'error');
        }
    }
}

// Handle CSV file selection for inward
function handleInwardCSVFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
            processInwardCSVFile(file);
        } else {
            showInventoryToast('Please select a valid CSV file', 'error');
        }
    }
}

// Handle CSV file selection for outward
function handleOutwardCSVFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
            processOutwardCSVFile(file);
        } else {
            showInventoryToast('Please select a valid CSV file', 'error');
        }
    }
}

// Process inward CSV file
function processInwardCSVFile(file) {
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const csv = e.target.result;
        
        Papa.parse(csv, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true,
            transformHeader: function(header) {
                return header.trim();
            },
            complete: function(results) {
                validateAndImportInwardCSV(results, file.name);
            },
            error: function(error) {
                console.error('CSV parsing error:', error);
                showInventoryToast('Error parsing CSV file', 'error');
            }
        });
    };
    
    reader.onerror = function() {
        showInventoryToast('Error reading file', 'error');
    };
    
    reader.readAsText(file);
}

// Process outward CSV file
function processOutwardCSVFile(file) {
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const csv = e.target.result;
        
        Papa.parse(csv, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true,
            transformHeader: function(header) {
                return header.trim();
            },
            complete: function(results) {
                validateAndImportOutwardCSV(results, file.name);
            },
            error: function(error) {
                console.error('CSV parsing error:', error);
                showInventoryToast('Error parsing CSV file', 'error');
            }
        });
    };
    
    reader.onerror = function() {
        showInventoryToast('Error reading file', 'error');
    };
    
    reader.readAsText(file);
}

// Validate and import inward CSV data
async function validateAndImportInwardCSV(results, filename) {
    try {
        const data = results.data;
        const headers = Object.keys(data[0] || {});
        
        // Check required columns (flexible - Notes is optional)
        const requiredColumns = ['Device Registration Number', 'Device IMEI', 'Device Condition'];
        const missingColumns = requiredColumns.filter(col => !headers.includes(col));
        if (missingColumns.length > 0) {
            showInventoryToast(`Missing required columns: ${missingColumns.join(', ')}`, 'error');
            return;
        }
        
        // Show progress
        showInwardImportProgress();
        
        const validData = [];
        const errors = [];
        let processed = 0;
        
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            processed++;
            
            updateInwardImportProgress((processed / data.length) * 50);
            
            const deviceRegNumber = row['Device Registration Number'];
            const deviceImei = row['Device IMEI'];
            const deviceCondition = row['Device Condition'];
            
            // Validate required fields
            if (!deviceRegNumber || !deviceImei || !deviceCondition) {
                errors.push(`Row ${i + 2}: Missing required data`);
                continue;
            }
            
            // Validate condition
            const validConditions = Object.keys(DEVICE_CONDITIONS);
            if (!validConditions.includes(deviceCondition.toLowerCase().replace(' ', '_'))) {
                errors.push(`Row ${i + 2}: Invalid device condition "${deviceCondition}"`);
                continue;
            }
            
            // Check if device exists in stock
            const stockDevice = stockData.find(stock => 
                stock.device_registration_number === deviceRegNumber && 
                stock.device_imei === deviceImei
            );
            
            if (!stockDevice) {
                errors.push(`Row ${i + 2}: Device not found in stock database`);
                continue;
            }
            
            // Check if already in inward
            const existingInward = inwardDevices.find(inward => 
                inward.device_registration_number === deviceRegNumber
            );
            
            if (existingInward) {
                errors.push(`Row ${i + 2}: Device already exists in inward inventory`);
                continue;
            }
            
            validData.push({
                device_registration_number: deviceRegNumber,
                device_imei: deviceImei,
                device_condition: 'good', // Always set as good for inward devices per user requirement
                notes: row['Notes'] || 'Bulk imported',
                processed_by: userSession?.email || 'unknown',
                stock_id: stockDevice.id,
                inward_date: new Date().toISOString().split('T')[0]
            });
        }
        
        // Import valid data
        let successfulImports = 0;
        const existingOutwardToRemove = [];
        
        for (let i = 0; i < validData.length; i++) {
            updateInwardImportProgress(50 + (i / validData.length) * 50);
            
            const item = validData[i];
            
            // Check if device is in outward (returning)
            const outwardDevice = outwardDevices.find(outward => 
                outward.device_registration_number === item.device_registration_number
            );
            
            if (outwardDevice) {
                existingOutwardToRemove.push(outwardDevice.id);
            }
            
            const { error } = await supabase
                .from('inward_devices')
                .insert([item]);
            
            if (error) {
                errors.push(`Failed to import ${item.device_registration_number}: ${error.message}`);
            } else {
                successfulImports++;
            }
        }
        
        // Remove devices from outward that are now inward
        for (const outwardId of existingOutwardToRemove) {
            await supabase
                .from('outward_devices')
                .delete()
                .eq('id', outwardId);
        }
        
        hideInwardImportProgress();
        showInwardImportResults(successfulImports, data.length - successfulImports, errors);
        
        await loadInventoryData();
        
        // Clear file input
        document.getElementById('inwardCSVFileInput').value = '';
        
    } catch (error) {
        console.error('Error importing inward CSV:', error);
        hideInwardImportProgress();
        showInventoryToast('Error importing CSV data', 'error');
    }
}

// Validate and import outward CSV data
async function validateAndImportOutwardCSV(results, filename) {
    try {
        const data = results.data;
        const headers = Object.keys(data[0] || {});
        
        // Check required columns (flexible - SIM No and Notes are optional)
        const requiredColumns = ['Device Registration Number', 'Device IMEI', 'Customer Name', 'Location', 'Outward Date'];
        const missingColumns = requiredColumns.filter(col => !headers.includes(col));
        if (missingColumns.length > 0) {
            showInventoryToast(`Missing required columns: ${missingColumns.join(', ')}`, 'error');
            return;
        }
        
        showOutwardImportProgress();
        
        const validData = [];
        const errors = [];
        let processed = 0;
        
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            processed++;
            
            updateOutwardImportProgress((processed / data.length) * 50);
            
            const deviceRegNumber = row['Device Registration Number'];
            const deviceImei = row['Device IMEI'];
            const customerName = row['Customer Name'];
            const location = row['Location'];
            const outwardDate = row['Outward Date'];
            
            if (!deviceRegNumber || !deviceImei || !customerName || !location || !outwardDate) {
                errors.push(`Row ${i + 2}: Missing required data`);
                continue;
            }
            
            // Check if device exists in stock
            const stockDevice = stockData.find(stock => 
                stock.device_registration_number === deviceRegNumber && 
                stock.device_imei === deviceImei &&
                stock.current_status === 'available'
            );
            
            if (!stockDevice) {
                errors.push(`Row ${i + 2}: Device not found in stock or not available`);
                continue;
            }
            
            // Find customer by name
            const customer = approvedCustomers.find(c => 
                c.customer_name.toLowerCase() === customerName.toLowerCase()
            );
            
            if (!customer) {
                errors.push(`Row ${i + 2}: Customer "${customerName}" not found in approved customers`);
                continue;
            }
            
            // Parse date
            let formattedDate = outwardDate;
            if (typeof outwardDate === 'string') {
                const parsed = new Date(outwardDate);
                if (!isNaN(parsed.getTime())) {
                    formattedDate = parsed.toISOString().split('T')[0];
                }
            }
            
            validData.push({
                device_registration_number: deviceRegNumber,
                device_imei: deviceImei,
                customer_id: customer.id,
                customer_name: customerName,
                location: location,
                outward_date: formattedDate,
                sim_no: row['SIM No'] || null,
                notes: row['Notes'] || 'Bulk imported',
                processed_by: userSession?.email || 'unknown',
                stock_id: stockDevice.id
            });
        }
        
        // Import valid data
        let successfulImports = 0;
        const existingInwardToRemove = [];
        
        for (let i = 0; i < validData.length; i++) {
            updateOutwardImportProgress(50 + (i / validData.length) * 50);
            
            const item = validData[i];
            
            // Check if device is in inward (going outward)
            const inwardDevice = inwardDevices.find(inward => 
                inward.device_registration_number === item.device_registration_number
            );
            
            if (inwardDevice) {
                existingInwardToRemove.push(inwardDevice.id);
            }
            
            const { error } = await supabase
                .from('outward_devices')
                .insert([item]);
            
            if (error) {
                errors.push(`Failed to import ${item.device_registration_number}: ${error.message}`);
            } else {
                // Update stock status
                await supabase
                    .from('stock')
                    .update({ 
                        current_status: 'allocated',
                        allocated_to_customer_id: item.customer_id,
                        allocated_date: new Date().toISOString(),
                        location: item.location,
                        sim_no: item.sim_no
                    })
                    .eq('id', item.stock_id);
                
                successfulImports++;
            }
        }
        
        // Remove devices from inward that are now outward
        for (const inwardId of existingInwardToRemove) {
            await supabase
                .from('inward_devices')
                .delete()
                .eq('id', inwardId);
        }
        
        hideOutwardImportProgress();
        showOutwardImportResults(successfulImports, data.length - successfulImports, errors);
        
        await loadInventoryData();
        
        // Clear file input
        document.getElementById('outwardCSVFileInput').value = '';
        
    } catch (error) {
        console.error('Error importing outward CSV:', error);
        hideOutwardImportProgress();
        showInventoryToast('Error importing CSV data', 'error');
    }
}

// Progress and result functions for inward
function showInwardImportProgress() {
    document.getElementById('inwardImportProgressSection').classList.remove('hidden');
    updateInwardImportProgress(0);
}

function updateInwardImportProgress(percentage) {
    const progressBar = document.getElementById('inwardImportProgressBar');
    const progressText = document.getElementById('inwardImportProgressText');
    
    progressBar.style.width = `${percentage}%`;
    progressText.textContent = `${Math.round(percentage)}%`;
}

function hideInwardImportProgress() {
    document.getElementById('inwardImportProgressSection').classList.add('hidden');
}

function showInwardImportResults(successful, failed, errors) {
    const resultsDiv = document.getElementById('inwardImportResults');
    const isSuccess = failed === 0;
    
    resultsDiv.className = `import-results ${isSuccess ? '' : 'error'}`;
    
    let resultHTML = `
        <div class="flex items-center gap-3 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${isSuccess ? 'text-green-600' : 'text-red-600'}">
                ${isSuccess ? 
                    '<path d="M5 13l4 4L19 7"/>' : 
                    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="m12 17 .01 0"/>'
                }
            </svg>
            <div>
                <h4 class="text-body-l-semibold ${isSuccess ? 'text-green-600' : 'text-red-600'}">
                    Inward Import ${isSuccess ? 'Completed' : 'Completed with Errors'}
                </h4>
                <p class="text-body-m-regular dark:text-dark-base-500">
                    ${successful} successful, ${failed} failed
                </p>
            </div>
        </div>
    `;
    
    if (errors.length > 0) {
        resultHTML += `
            <div class="mt-4">
                <h5 class="text-body-m-semibold dark:text-dark-base-600 mb-2">Errors:</h5>
                <div class="max-h-32 overflow-y-auto">
                    <ul class="text-body-s-regular dark:text-dark-base-500 space-y-1">
                        ${errors.slice(0, 10).map(error => `<li>• ${error}</li>`).join('')}
                        ${errors.length > 10 ? `<li>• ... and ${errors.length - 10} more errors</li>` : ''}
                    </ul>
                </div>
            </div>
        `;
    }
    
    resultsDiv.innerHTML = resultHTML;
    resultsDiv.classList.remove('hidden');
    
    setTimeout(() => {
        resultsDiv.classList.add('hidden');
    }, 15000);
    
    showInventoryToast(`Inward import: ${successful} successful, ${failed} failed`, isSuccess ? 'success' : 'warning');
}

// Progress and result functions for outward
function showOutwardImportProgress() {
    document.getElementById('outwardImportProgressSection').classList.remove('hidden');
    updateOutwardImportProgress(0);
}

function updateOutwardImportProgress(percentage) {
    const progressBar = document.getElementById('outwardImportProgressBar');
    const progressText = document.getElementById('outwardImportProgressText');
    
    progressBar.style.width = `${percentage}%`;
    progressText.textContent = `${Math.round(percentage)}%`;
}

function hideOutwardImportProgress() {
    document.getElementById('outwardImportProgressSection').classList.add('hidden');
}

function showOutwardImportResults(successful, failed, errors) {
    const resultsDiv = document.getElementById('outwardImportResults');
    const isSuccess = failed === 0;
    
    resultsDiv.className = `import-results ${isSuccess ? '' : 'error'}`;
    
    let resultHTML = `
        <div class="flex items-center gap-3 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${isSuccess ? 'text-green-600' : 'text-red-600'}">
                ${isSuccess ? 
                    '<path d="M5 13l4 4L19 7"/>' : 
                    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="m12 17 .01 0"/>'
                }
            </svg>
            <div>
                <h4 class="text-body-l-semibold ${isSuccess ? 'text-green-600' : 'text-red-600'}">
                    Outward Import ${isSuccess ? 'Completed' : 'Completed with Errors'}
                </h4>
                <p class="text-body-m-regular dark:text-dark-base-500">
                    ${successful} successful, ${failed} failed
                </p>
            </div>
        </div>
    `;
    
    if (errors.length > 0) {
        resultHTML += `
            <div class="mt-4">
                <h5 class="text-body-m-semibold dark:text-dark-base-600 mb-2">Errors:</h5>
                <div class="max-h-32 overflow-y-auto">
                    <ul class="text-body-s-regular dark:text-dark-base-500 space-y-1">
                        ${errors.slice(0, 10).map(error => `<li>• ${error}</li>`).join('')}
                        ${errors.length > 10 ? `<li>• ... and ${errors.length - 10} more errors</li>` : ''}
                    </ul>
                </div>
            </div>
        `;
    }
    
    resultsDiv.innerHTML = resultHTML;
    resultsDiv.classList.remove('hidden');
    
    setTimeout(() => {
        resultsDiv.classList.add('hidden');
    }, 15000);
    
    showInventoryToast(`Outward import: ${successful} successful, ${failed} failed`, isSuccess ? 'success' : 'warning');
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

// Make functions globally available for HTML onclick handlers
window.showInwardTab = showInwardTab;
window.showOutwardTab = showOutwardTab;
window.showAddInwardForm = showAddInwardForm;
window.closeAddInwardForm = closeAddInwardForm;
window.showAddOutwardForm = showAddOutwardForm;
window.closeAddOutwardForm = closeAddOutwardForm;
window.clearInventorySearch = clearInventorySearch;
window.viewDeviceDetails = viewDeviceDetails;
window.returnDevice = returnDevice;
window.goBackToDashboard = goBackToDashboard;
window.loadInventoryData = loadInventoryData;

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
