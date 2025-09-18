// Supabase configuration
const SUPABASE_URL = 'https://fhqxjpjswcpvabvnzayf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZocXhqcGpzd2NwdmFidm56YXlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY2MzU4MzcsImV4cCI6MjA0MjIxMTgzN30.HX66s5iKQPUZAd0JLVz0YrAJGBUmx8BQKGB4Cjj_lrM';

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Global variables for inventory management
let inventoryItems = [];
let stockItems = [];
let filteredInventoryItems = [];
let customers = [];
let currentTab = 'inward';

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('Inventory page loaded');
    setupInventoryEventHandlers();
    loadInventoryData();
});

function setupInventoryEventHandlers() {
    // CSV file inputs
    const inwardCSVInput = document.getElementById('inwardCSVFileInput');
    const outwardCSVInput = document.getElementById('outwardCSVFileInput');
    
    if (inwardCSVInput) {
        inwardCSVInput.addEventListener('change', (e) => handleInventoryCSVUpload(e, 'inward'));
    }
    
    if (outwardCSVInput) {
        outwardCSVInput.addEventListener('change', (e) => handleInventoryCSVUpload(e, 'outward'));
    }
    
    // Drag and drop for CSV import
    const inwardImportArea = document.getElementById('inwardCSVImportArea');
    const outwardImportArea = document.getElementById('outwardCSVImportArea');
    
    if (inwardImportArea) {
        inwardImportArea.addEventListener('dragover', handleDragOver);
        inwardImportArea.addEventListener('drop', (e) => handleInventoryDrop(e, 'inward'));
        inwardImportArea.addEventListener('click', () => {
            document.getElementById('inwardCSVFileInput').click();
        });
    }
    
    if (outwardImportArea) {
        outwardImportArea.addEventListener('dragover', handleDragOver);
        outwardImportArea.addEventListener('drop', (e) => handleInventoryDrop(e, 'outward'));
        outwardImportArea.addEventListener('click', () => {
            document.getElementById('outwardCSVFileInput').click();
        });
    }
    
    // Search functionality
    const searchInput = document.getElementById('inventorySearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', handleInventorySearch);
    }
    
    // Form submissions
    const addInwardForm = document.getElementById('addInwardForm');
    const addOutwardForm = document.getElementById('addOutwardForm');
    
    if (addInwardForm) {
        addInwardForm.addEventListener('submit', handleAddInward);
    }
    
    if (addOutwardForm) {
        addOutwardForm.addEventListener('submit', handleAddOutward);
    }
}

// Navigation functions
function goBackToDashboard() {
    window.location.href = 'index.html';
}

// Inventory page function to be called from main dashboard
function showInventoryPage() {
    window.location.href = 'inventory.html';
}

// Data loading functions
async function loadInventoryData() {
    console.log('Loading inventory data...');
    showInventoryLoadingOverlay();
    
    try {
        await Promise.all([
            loadInventoryItems(),
            loadStockItems(),
            loadCustomers()
        ]);
        
        updateInventorySummaryCards();
        updateInventoryDisplay();
        updateTabCounts();
        
        console.log('Inventory data loaded successfully');
    } catch (error) {
        console.error('Error loading inventory data:', error);
        showInventoryToast('Error loading inventory data', 'error');
    } finally {
        hideInventoryLoadingOverlay();
    }
}

async function loadInventoryItems() {
    try {
        const { data, error } = await supabase
            .from('inventory')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        inventoryItems = data || [];
        filteredInventoryItems = [...inventoryItems];
        
        console.log(`Loaded ${inventoryItems.length} inventory items`);
        return inventoryItems;
    } catch (error) {
        console.error('Error loading inventory items:', error);
        return [];
    }
}

async function loadStockItems() {
    try {
        const { data, error } = await supabase
            .from('stock')
            .select('*');

        if (error) throw error;

        stockItems = data || [];
        console.log(`Loaded ${stockItems.length} stock items`);
        return stockItems;
    } catch (error) {
        console.error('Error loading stock items:', error);
        return [];
    }
}

async function loadCustomers() {
    try {
        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .order('customer_name');

        if (error) throw error;

        customers = data || [];
        console.log(`Loaded ${customers.length} customers`);
        updateCustomerDropdowns();
        return customers;
    } catch (error) {
        console.error('Error loading customers:', error);
        return [];
    }
}

function updateCustomerDropdowns() {
    const customerSelects = document.querySelectorAll('select[name="customerName"]');
    
    customerSelects.forEach(select => {
        let html = '<option value="">Select Customer</option>';
        customers.forEach(customer => {
            html += `<option value="${customer.customer_name}">${customer.customer_name}</option>`;
        });
        select.innerHTML = html;
    });
}

// UI Update functions
function updateInventorySummaryCards() {
    const totalStock = stockItems.length;
    const availableStock = stockItems.filter(item => 
        item.status === 'available' && item.device_condition === 'good'
    ).length;
    const allocatedStock = stockItems.filter(item => item.status === 'allocated').length;
    
    // Update HTML page elements
    const totalElement = document.getElementById('inventoryHTMLTotalStockCount');
    const availableElement = document.getElementById('inventoryHTMLAvailableStockCount');
    const allocatedElement = document.getElementById('inventoryHTMLAllocatedStockCount');
    
    if (totalElement) totalElement.textContent = totalStock;
    if (availableElement) availableElement.textContent = availableStock;
    if (allocatedElement) allocatedElement.textContent = allocatedStock;
}

function updateTabCounts() {
    const inwardCount = inventoryItems.filter(item => item.type === 'inward').length;
    const outwardCount = inventoryItems.filter(item => item.type === 'outward').length;
    
    document.getElementById('inwardCount').textContent = inwardCount;
    document.getElementById('outwardCount').textContent = outwardCount;
}

// Tab functions
function showInwardTab() {
    currentTab = 'inward';
    
    // Update tab buttons
    document.getElementById('inwardTab').classList.add('active');
    document.getElementById('outwardTab').classList.remove('active');
    
    // Update content
    document.getElementById('inwardTabContent').classList.remove('hidden');
    document.getElementById('outwardTabContent').classList.add('hidden');
    
    updateInventoryDisplay();
}

function showOutwardTab() {
    currentTab = 'outward';
    
    // Update tab buttons
    document.getElementById('outwardTab').classList.add('active');
    document.getElementById('inwardTab').classList.remove('active');
    
    // Update content
    document.getElementById('outwardTabContent').classList.remove('hidden');
    document.getElementById('inwardTabContent').classList.add('hidden');
    
    updateInventoryDisplay();
}

function updateInventoryDisplay() {
    if (currentTab === 'inward') {
        updateInwardDevicesList();
    } else {
        updateOutwardDevicesList();
    }
}

function updateInwardDevicesList() {
    const container = document.getElementById('inwardDevicesList');
    const emptyState = document.getElementById('inwardEmptyState');
    
    const inwardItems = filteredInventoryItems.filter(item => item.type === 'inward');
    
    if (inwardItems.length === 0) {
        container.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    
    let html = '';
    inwardItems.forEach(item => {
        const conditionClass = getInventoryConditionClass(item.device_condition);
        
        html += `
            <div class="inventory-card p-6 rounded-lg dark:bg-dark-fill-base-300 dark:border dark:border-dark-stroke-contrast-400">
                <div class="flex items-start justify-between mb-4">
                    <div class="flex-1">
                        <h3 class="text-heading-6 dark:text-dark-base-600 mb-2">${item.device_registration_number}</h3>
                        <p class="text-body-m-regular dark:text-dark-base-500 mb-1">IMEI: ${item.device_imei}</p>
                        <p class="text-body-s-regular dark:text-dark-base-400">Received: ${formatDate(item.inward_date)}</p>
                    </div>
                    <div class="flex flex-col items-end gap-2">
                        <div class="device-status inward">
                            <span class="status-dot"></span>
                            <span class="status-text">Inward</span>
                        </div>
                        <div class="condition-badge ${conditionClass}">
                            ${item.device_condition || 'good'}
                        </div>
                    </div>
                </div>
                
                <div class="device-details mb-4">
                    <div class="grid grid-cols-2 gap-4 text-body-s-regular">
                        <div>
                            <span class="dark:text-dark-base-500">Condition:</span>
                            <span class="dark:text-dark-base-600 ml-2">${item.device_condition || 'good'}</span>
                        </div>
                        <div>
                            <span class="dark:text-dark-base-500">Date:</span>
                            <span class="dark:text-dark-base-600 ml-2">${formatDate(item.inward_date)}</span>
                        </div>
                    </div>
                    ${item.notes ? `
                        <div class="mt-2">
                            <span class="dark:text-dark-base-500">Notes:</span>
                            <span class="dark:text-dark-base-600 ml-2">${item.notes}</span>
                        </div>
                    ` : ''}
                </div>
                
                <div class="device-actions flex gap-2">
                    <button onclick="viewDeviceDetails('${item.id}')" class="action-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/>
                            <circle cx="12" cy="12" r="3"/>
                        </svg>
                        View Details
                    </button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function updateOutwardDevicesList() {
    const container = document.getElementById('outwardDevicesList');
    const emptyState = document.getElementById('outwardEmptyState');
    
    const outwardItems = filteredInventoryItems.filter(item => item.type === 'outward');
    
    if (outwardItems.length === 0) {
        container.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    
    let html = '';
    outwardItems.forEach(item => {
        html += `
            <div class="inventory-card outward p-6 rounded-lg dark:bg-dark-fill-base-300 dark:border dark:border-dark-stroke-contrast-400">
                <div class="flex items-start justify-between mb-4">
                    <div class="flex-1">
                        <h3 class="text-heading-6 dark:text-dark-base-600 mb-2">${item.device_registration_number}</h3>
                        <p class="text-body-m-regular dark:text-dark-base-500 mb-1">IMEI: ${item.device_imei}</p>
                        <p class="text-body-s-regular dark:text-dark-base-400">Customer: ${item.customer_name}</p>
                    </div>
                    <div class="flex flex-col items-end gap-2">
                        <div class="device-status outward">
                            <span class="status-dot"></span>
                            <span class="status-text">Outward</span>
                        </div>
                        <div class="text-body-s-regular dark:text-dark-base-500">
                            ${formatDate(item.outward_date)}
                        </div>
                    </div>
                </div>
                
                <div class="device-details mb-4">
                    <div class="grid grid-cols-2 gap-4 text-body-s-regular">
                        <div>
                            <span class="dark:text-dark-base-500">Customer:</span>
                            <span class="dark:text-dark-base-600 ml-2">${item.customer_name}</span>
                        </div>
                        <div>
                            <span class="dark:text-dark-base-500">Location:</span>
                            <span class="dark:text-dark-base-600 ml-2">${item.location || 'N/A'}</span>
                        </div>
                        <div>
                            <span class="dark:text-dark-base-500">SIM No:</span>
                            <span class="dark:text-dark-base-600 ml-2">${item.sim_no || 'N/A'}</span>
                        </div>
                        <div>
                            <span class="dark:text-dark-base-500">Outward Date:</span>
                            <span class="dark:text-dark-base-600 ml-2">${formatDate(item.outward_date)}</span>
                        </div>
                    </div>
                    ${item.notes ? `
                        <div class="mt-2">
                            <span class="dark:text-dark-base-500">Notes:</span>
                            <span class="dark:text-dark-base-600 ml-2">${item.notes}</span>
                        </div>
                    ` : ''}
                </div>
                
                <div class="device-actions flex gap-2">
                    <button onclick="viewDeviceDetails('${item.id}')" class="action-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/>
                            <circle cx="12" cy="12" r="3"/>
                        </svg>
                        View Details
                    </button>
                    <button onclick="returnDevice('${item.id}')" class="action-btn return">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                            <polyline points="9,22 9,12 15,12 15,22"/>
                        </svg>
                        Return Device
                    </button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// CSV Import functions for inventory
function handleInventoryDrop(e, type) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
            processInventoryCSVFile(file, type);
        } else {
            showInventoryToast('Please upload a CSV file', 'error');
        }
    }
}

function handleInventoryCSVUpload(e, type) {
    const file = e.target.files[0];
    if (file) {
        processInventoryCSVFile(file, type);
    }
}

async function processInventoryCSVFile(file, type) {
    console.log('Processing inventory CSV file:', file.name, 'Type:', type);
    
    // Show progress section
    const progressSection = document.getElementById(`${type}ImportProgressSection`);
    const resultsSection = document.getElementById(`${type}ImportResults`);
    
    progressSection.classList.remove('hidden');
    resultsSection.classList.add('hidden');
    
    // Update progress
    updateInventoryImportProgress(0, 'Reading file...', type);
    
    try {
        // Parse CSV file
        const csvText = await readFileAsText(file);
        updateInventoryImportProgress(20, 'Parsing CSV data...', type);
        
        const results = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true
        });
        
        if (results.errors.length > 0) {
            throw new Error('CSV parsing errors: ' + results.errors.map(e => e.message).join(', '));
        }
        
        const rows = results.data;
        updateInventoryImportProgress(40, 'Validating data...', type);
        
        // Validate and process data
        const { validItems, invalidItems } = await validateInventoryData(rows, type);
        
        updateInventoryImportProgress(60, 'Importing to database...', type);
        
        // Import valid items to database
        const importResult = await importInventoryItems(validItems, file.name, type);
        
        updateInventoryImportProgress(100, 'Import completed!', type);
        
        // Hide progress and show results
        setTimeout(() => {
            progressSection.classList.add('hidden');
            showInventoryImportResults(importResult, invalidItems, type);
            
            // Reload data
            loadInventoryData();
        }, 1000);
        
    } catch (error) {
        console.error('Error processing inventory CSV:', error);
        progressSection.classList.add('hidden');
        showInventoryToast('Error importing CSV: ' + error.message, 'error');
    }
}

async function validateInventoryData(rows, type) {
    const validItems = [];
    const invalidItems = [];
    
    let requiredColumns = [];
    
    if (type === 'inward') {
        requiredColumns = ['Device Registration Number', 'Device IMEI'];
    } else {
        requiredColumns = ['Device Registration Number', 'Device IMEI', 'Customer Name'];
    }
    
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const errors = [];
        
        // Check required columns
        requiredColumns.forEach(col => {
            if (!row[col] || row[col].trim() === '') {
                errors.push(`Missing ${col}`);
            }
        });
        
        // Validate IMEI (should be 15 digits)
        if (row['Device IMEI'] && !/^\d{15}$/.test(row['Device IMEI'].replace(/\s+/g, ''))) {
            errors.push('Invalid IMEI format (should be 15 digits)');
        }
        
        if (errors.length === 0) {
            const baseItem = {
                device_registration_number: row['Device Registration Number'].trim(),
                device_imei: row['Device IMEI'].replace(/\s+/g, ''),
                type: type,
                notes: row['Notes'] || '',
                created_at: new Date().toISOString()
            };
            
            if (type === 'inward') {
                validItems.push({
                    ...baseItem,
                    device_condition: row['Device Condition'] || 'good',
                    inward_date: row['Inward Date'] || new Date().toISOString().split('T')[0]
                });
            } else {
                validItems.push({
                    ...baseItem,
                    customer_name: row['Customer Name'].trim(),
                    location: row['Location'] || '',
                    outward_date: row['Outward Date'] || new Date().toISOString().split('T')[0],
                    sim_no: row['SIM No'] || ''
                });
            }
        } else {
            invalidItems.push({
                row: i + 1,
                data: row,
                errors: errors
            });
        }
    }
    
    return { validItems, invalidItems };
}

async function importInventoryItems(items, fileName, type) {
    try {
        let importedCount = 0;
        let failedCount = 0;
        const errors = [];
        
        // Process each item individually for better error handling
        for (const item of items) {
            try {
                // Insert inventory record
                const { error: inventoryError } = await supabase
                    .from('inventory')
                    .insert([item]);
                
                if (inventoryError) throw inventoryError;
                
                // Update stock status if outward
                if (type === 'outward') {
                    const { error: stockError } = await supabase
                        .from('stock')
                        .update({ status: 'allocated' })
                        .eq('device_registration_number', item.device_registration_number);
                    
                    if (stockError) {
                        console.warn('Could not update stock status:', stockError);
                    }
                }
                
                importedCount++;
            } catch (error) {
                console.error('Error importing item:', error);
                failedCount++;
                errors.push(error.message);
            }
        }
        
        return {
            total: items.length,
            imported: importedCount,
            failed: failedCount,
            errors: errors
        };
        
    } catch (error) {
        console.error('Error importing inventory items:', error);
        throw error;
    }
}

function updateInventoryImportProgress(percentage, message, type) {
    const progressBar = document.getElementById(`${type}ImportProgressBar`);
    const progressText = document.getElementById(`${type}ImportProgressText`);
    
    if (progressBar) {
        progressBar.style.width = percentage + '%';
    }
    
    if (progressText) {
        progressText.textContent = message || `${percentage}%`;
    }
}

function showInventoryImportResults(result, invalidItems, type) {
    const resultsSection = document.getElementById(`${type}ImportResults`);
    
    let html = `
        <div class="import-summary p-4 rounded-lg dark:bg-dark-success-600/20 dark:border dark:border-dark-success-600">
            <h4 class="text-heading-7 dark:text-dark-success-600 mb-2">Import Summary</h4>
            <div class="grid grid-cols-3 gap-4 text-body-s-regular">
                <div>
                    <span class="dark:text-dark-base-500">Total:</span>
                    <span class="dark:text-dark-base-600 ml-2">${result.total}</span>
                </div>
                <div>
                    <span class="dark:text-dark-base-500">Imported:</span>
                    <span class="dark:text-dark-success-600 ml-2">${result.imported}</span>
                </div>
                <div>
                    <span class="dark:text-dark-base-500">Failed:</span>
                    <span class="dark:text-dark-semantic-danger-300 ml-2">${result.failed}</span>
                </div>
            </div>
        </div>
    `;
    
    if (invalidItems.length > 0) {
        html += `
            <div class="invalid-items mt-4 p-4 rounded-lg dark:bg-dark-semantic-danger-300/20 dark:border dark:border-dark-semantic-danger-300">
                <h4 class="text-heading-7 dark:text-dark-semantic-danger-300 mb-2">Invalid Items (${invalidItems.length})</h4>
                <div class="max-h-48 overflow-y-auto">
        `;
        
        invalidItems.slice(0, 10).forEach(item => {
            html += `
                <div class="text-body-s-regular dark:text-dark-base-600 mb-1">
                    Row ${item.row}: ${item.errors.join(', ')}
                </div>
            `;
        });
        
        if (invalidItems.length > 10) {
            html += `<div class="text-body-s-regular dark:text-dark-base-500">... and ${invalidItems.length - 10} more</div>`;
        }
        
        html += `
                </div>
            </div>
        `;
    }
    
    resultsSection.innerHTML = html;
    resultsSection.classList.remove('hidden');
    
    showInventoryToast(`${type} import completed: ${result.imported} items imported successfully`, 'success');
}

// Form functions
function showAddInwardForm() {
    document.getElementById('addInwardModal').classList.remove('hidden');
}

function closeAddInwardForm() {
    document.getElementById('addInwardModal').classList.add('hidden');
    document.getElementById('addInwardForm').reset();
}

function showAddOutwardForm() {
    // Populate available devices
    updateAvailableDevicesDropdown();
    document.getElementById('addOutwardModal').classList.remove('hidden');
}

function closeAddOutwardForm() {
    document.getElementById('addOutwardModal').classList.add('hidden');
    document.getElementById('addOutwardForm').reset();
}

function updateAvailableDevicesDropdown() {
    const select = document.getElementById('availableDeviceSelect');
    if (!select) return;
    
    const availableDevices = stockItems.filter(item => 
        item.status === 'available' && item.device_condition === 'good'
    );
    
    let html = '<option value="">Select Device</option>';
    availableDevices.forEach(device => {
        html += `<option value="${device.device_registration_number}" data-imei="${device.device_imei}">
            ${device.device_registration_number} (${device.device_model_no})
        </option>`;
    });
    
    select.innerHTML = html;
    
    // Auto-fill IMEI when device is selected
    select.addEventListener('change', function() {
        const selectedOption = this.options[this.selectedIndex];
        const imeiField = document.getElementById('outwardDeviceIMEI');
        if (imeiField && selectedOption) {
            imeiField.value = selectedOption.getAttribute('data-imei') || '';
        }
    });
}

async function handleAddInward(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const inwardData = {
        device_registration_number: formData.get('deviceRegistrationNumber'),
        device_imei: formData.get('deviceIMEI'),
        device_condition: formData.get('deviceCondition'),
        type: 'inward',
        inward_date: formData.get('inwardDate') || new Date().toISOString().split('T')[0],
        notes: formData.get('notes') || '',
        created_at: new Date().toISOString()
    };
    
    try {
        const { error } = await supabase
            .from('inventory')
            .insert([inwardData]);
        
        if (error) throw error;
        
        showInventoryToast('Inward device added successfully!', 'success');
        closeAddInwardForm();
        loadInventoryData();
        
    } catch (error) {
        console.error('Error adding inward device:', error);
        showInventoryToast('Error adding inward device: ' + error.message, 'error');
    }
}

async function handleAddOutward(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const outwardData = {
        device_registration_number: formData.get('deviceRegistrationNumber'),
        device_imei: formData.get('deviceIMEI'),
        customer_name: formData.get('customerName'),
        location: formData.get('location'),
        type: 'outward',
        outward_date: formData.get('outwardDate') || new Date().toISOString().split('T')[0],
        sim_no: formData.get('simNo') || '',
        notes: formData.get('notes') || '',
        created_at: new Date().toISOString()
    };
    
    try {
        // Insert inventory record
        const { error: inventoryError } = await supabase
            .from('inventory')
            .insert([outwardData]);
        
        if (inventoryError) throw inventoryError;
        
        // Update stock status
        const { error: stockError } = await supabase
            .from('stock')
            .update({ status: 'allocated' })
            .eq('device_registration_number', outwardData.device_registration_number);
        
        if (stockError) {
            console.warn('Could not update stock status:', stockError);
        }
        
        showInventoryToast('Outward device added successfully!', 'success');
        closeAddOutwardForm();
        loadInventoryData();
        
    } catch (error) {
        console.error('Error adding outward device:', error);
        showInventoryToast('Error adding outward device: ' + error.message, 'error');
    }
}

// Device details and actions
async function viewDeviceDetails(itemId) {
    try {
        const item = inventoryItems.find(i => i.id === itemId);
        if (!item) return;
        
        // Create a simple alert with device details
        let details = `Device Details:\n\n`;
        details += `Registration Number: ${item.device_registration_number}\n`;
        details += `IMEI: ${item.device_imei}\n`;
        details += `Type: ${item.type}\n`;
        
        if (item.type === 'inward') {
            details += `Condition: ${item.device_condition || 'good'}\n`;
            details += `Inward Date: ${formatDate(item.inward_date)}\n`;
        } else {
            details += `Customer: ${item.customer_name}\n`;
            details += `Location: ${item.location || 'N/A'}\n`;
            details += `Outward Date: ${formatDate(item.outward_date)}\n`;
            details += `SIM No: ${item.sim_no || 'N/A'}\n`;
        }
        
        if (item.notes) {
            details += `Notes: ${item.notes}\n`;
        }
        
        alert(details);
        
    } catch (error) {
        console.error('Error loading device details:', error);
        showInventoryToast('Error loading device details', 'error');
    }
}

async function returnDevice(itemId) {
    if (!confirm('Are you sure you want to return this device?')) return;
    
    try {
        const item = inventoryItems.find(i => i.id === itemId);
        if (!item) return;
        
        // Add return record
        const returnData = {
            device_registration_number: item.device_registration_number,
            device_imei: item.device_imei,
            type: 'return',
            return_date: new Date().toISOString().split('T')[0],
            returned_from: item.customer_name,
            device_condition: 'good', // Could be made selectable
            notes: `Returned from ${item.customer_name}`,
            created_at: new Date().toISOString()
        };
        
        const { error: returnError } = await supabase
            .from('inventory')
            .insert([returnData]);
        
        if (returnError) throw returnError;
        
        // Update stock status back to available
        const { error: stockError } = await supabase
            .from('stock')
            .update({ status: 'available' })
            .eq('device_registration_number', item.device_registration_number);
        
        if (stockError) {
            console.warn('Could not update stock status:', stockError);
        }
        
        showInventoryToast('Device returned successfully!', 'success');
        loadInventoryData();
        
    } catch (error) {
        console.error('Error returning device:', error);
        showInventoryToast('Error returning device: ' + error.message, 'error');
    }
}

// Search and filter functions
function handleInventorySearch() {
    const searchQuery = document.getElementById('inventorySearchInput').value.toLowerCase();
    
    filteredInventoryItems = inventoryItems.filter(item => {
        return !searchQuery || 
            item.device_registration_number.toLowerCase().includes(searchQuery) ||
            item.device_imei.toLowerCase().includes(searchQuery) ||
            (item.customer_name && item.customer_name.toLowerCase().includes(searchQuery));
    });
    
    updateInventoryDisplay();
}

function clearInventorySearch() {
    document.getElementById('inventorySearchInput').value = '';
    filteredInventoryItems = [...inventoryItems];
    updateInventoryDisplay();
}

// Helper functions
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add('drag-over');
}

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

function getInventoryConditionClass(condition) {
    switch (condition) {
        case 'good':
            return 'condition-good';
        case 'fair':
            return 'condition-fair';
        case 'poor':
            return 'condition-poor';
        default:
            return 'condition-good';
    }
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Loading overlay functions
function showInventoryLoadingOverlay() {
    document.getElementById('inventoryLoadingOverlay').classList.remove('hidden');
}

function hideInventoryLoadingOverlay() {
    document.getElementById('inventoryLoadingOverlay').classList.add('hidden');
}

// Toast notification functions
function showInventoryToast(message, type = 'success') {
    const toast = document.getElementById('inventoryToast');
    const icon = document.getElementById('inventoryToastIcon');
    const messageEl = document.getElementById('inventoryToastMessage');
    
    messageEl.textContent = message;
    
    // Set icon and color based on type
    let iconSVG = '';
    switch (type) {
        case 'success':
            iconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-dark-success-600">
                <polyline points="20,6 9,17 4,12"/>
            </svg>`;
            toast.className = 'fixed top-4 right-4 z-50 max-w-sm p-4 rounded-lg shadow-lg success';
            break;
        case 'error':
            iconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-dark-semantic-danger-300">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>`;
            toast.className = 'fixed top-4 right-4 z-50 max-w-sm p-4 rounded-lg shadow-lg error';
            break;
        case 'warning':
            iconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-dark-warning-600">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
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
