// Inventory Management JavaScript
// Global variables for inventory system
let stockDevices = [];
let inwardDevices = [];
let outwardDevices = [];
let filteredStockDevices = [];
let approvedCustomersForDropdown = [];
let csvData = null;
let importInProgress = false;

// Initialize inventory system when page loads
document.addEventListener('DOMContentLoaded', function() {
    if (typeof supabase !== 'undefined') {
        setupInventoryEventListeners();
        loadInventoryData();
        setupInventoryRealtimeListeners();
    }
});

// Setup event listeners for inventory functionality
function setupInventoryEventListeners() {
    // Stock search and filters
    const stockSearchInput = document.getElementById('stockSearchInput');
    const stockStatusFilter = document.getElementById('stockStatusFilter');
    const stockConditionFilter = document.getElementById('stockConditionFilter');

    if (stockSearchInput) {
        stockSearchInput.addEventListener('input', handleStockSearch);
    }
    if (stockStatusFilter) {
        stockStatusFilter.addEventListener('change', handleStockFilter);
    }
    if (stockConditionFilter) {
        stockConditionFilter.addEventListener('change', handleStockFilter);
    }

    // CSV Import form
    const csvImportForm = document.getElementById('csvImportForm');
    if (csvImportForm) {
        csvImportForm.addEventListener('submit', handleCSVImport);
    }

    // Inward device form
    const inwardDeviceForm = document.getElementById('inwardDeviceForm');
    if (inwardDeviceForm) {
        inwardDeviceForm.addEventListener('submit', handleInwardDevice);
    }

    // Outward device form
    const outwardDeviceForm = document.getElementById('outwardDeviceForm');
    if (outwardDeviceForm) {
        outwardDeviceForm.addEventListener('submit', handleOutwardDevice);
    }

    // Drag and drop for CSV upload
    const csvUploadArea = document.querySelector('.csv-upload-area');
    if (csvUploadArea) {
        csvUploadArea.addEventListener('dragover', handleDragOver);
        csvUploadArea.addEventListener('dragleave', handleDragLeave);
        csvUploadArea.addEventListener('drop', handleFileDrop);
    }
}

// Setup real-time listeners for inventory tables
function setupInventoryRealtimeListeners() {
    if (typeof supabase === 'undefined') return;

    // Listen for stock changes
    supabase
        .channel('stock_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'stock' }, 
            (payload) => {
                console.log('Stock change received!', payload);
                loadStockData();
            }
        )
        .subscribe();

    // Listen for inward device changes
    supabase
        .channel('inward_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'inward_devices' }, 
            (payload) => {
                console.log('Inward change received!', payload);
                loadInwardData();
            }
        )
        .subscribe();

    // Listen for outward device changes
    supabase
        .channel('outward_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'outward_devices' }, 
            (payload) => {
                console.log('Outward change received!', payload);
                loadOutwardData();
            }
        )
        .subscribe();
}

// Load all inventory data
async function loadInventoryData() {
    await Promise.all([
        loadStockData(),
        loadInwardData(),
        loadOutwardData(),
        loadApprovedCustomers()
    ]);
    updateInventoryCounts();
}

// Load stock data from database
async function loadStockData() {
    try {
        const { data, error } = await supabase
            .from('stock')
            .select(`
                *,
                customers:allocated_to_customer_id(customer_name)
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error loading stock data:', error);
            showInventoryToast('Error loading stock data', 'error');
            return;
        }

        stockDevices = data || [];
        filteredStockDevices = [...stockDevices];
        updateStockTable();
        updateStockStats();
    } catch (error) {
        console.error('Error loading stock data:', error);
        showInventoryToast('Error loading stock data', 'error');
    }
}

// Load inward devices data
async function loadInwardData() {
    try {
        const { data, error } = await supabase
            .from('inward_devices')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error loading inward data:', error);
            return;
        }

        inwardDevices = data || [];
        updateInwardDevicesList();
    } catch (error) {
        console.error('Error loading inward data:', error);
    }
}

// Load outward devices data
async function loadOutwardData() {
    try {
        const { data, error } = await supabase
            .from('outward_devices')
            .select(`
                *,
                customers(customer_name)
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error loading outward data:', error);
            return;
        }

        outwardDevices = data || [];
        updateOutwardDevicesList();
    } catch (error) {
        console.error('Error loading outward data:', error);
    }
}

// Load approved customers for dropdown
async function loadApprovedCustomers() {
    try {
        const { data, error } = await supabase
            .from('customers')
            .select('id, customer_name')
            .eq('approval_status', 'approved')
            .order('customer_name', { ascending: true });

        if (error) {
            console.error('Error loading customers:', error);
            return;
        }

        approvedCustomersForDropdown = data || [];
        updateCustomerDropdown();
    } catch (error) {
        console.error('Error loading customers:', error);
    }
}

// Update customer dropdown in outward form
function updateCustomerDropdown() {
    const dropdown = document.getElementById('customerDropdown');
    if (!dropdown) return;

    dropdown.innerHTML = '<option value="">Select customer</option>';
    
    approvedCustomersForDropdown.forEach(customer => {
        const option = document.createElement('option');
        option.value = customer.id;
        option.textContent = customer.customer_name;
        dropdown.appendChild(option);
    });
}

// Update inventory counts
function updateInventoryCounts() {
    const totalDevices = stockDevices.length;
    const availableDevices = stockDevices.filter(device => device.current_status === 'available').length;
    const allocatedDevices = stockDevices.filter(device => device.current_status === 'allocated').length;
    const inwardCount = inwardDevices.length;
    const outwardCount = outwardDevices.length;

    // Update stock stats
    updateElementText('totalDevicesCount', totalDevices);
    updateElementText('availableDevicesCount', availableDevices);
    updateElementText('allocatedDevicesCount', allocatedDevices);

    // Update inventory tab counts
    updateElementText('inwardCount', inwardCount);
    updateElementText('outwardCount', outwardCount);
}

// Helper function to update element text with animation
function updateElementText(elementId, newValue) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const currentValue = parseInt(element.textContent) || 0;
    if (currentValue !== newValue) {
        element.style.transform = 'scale(1.1)';
        element.style.transition = 'transform 0.2s ease';
        
        setTimeout(() => {
            element.textContent = newValue;
            element.style.transform = 'scale(1)';
        }, 100);
    }
}

// Update stock statistics
function updateStockStats() {
    updateInventoryCounts();
}

// Handle stock search
function handleStockSearch(e) {
    const searchTerm = e.target.value.toLowerCase().trim();
    filterStockDevices(searchTerm);
}

// Handle stock filters
function handleStockFilter() {
    const statusFilter = document.getElementById('stockStatusFilter').value;
    const conditionFilter = document.getElementById('stockConditionFilter').value;
    const searchTerm = document.getElementById('stockSearchInput').value.toLowerCase().trim();
    
    filterStockDevices(searchTerm, statusFilter, conditionFilter);
}

// Filter stock devices based on search and filters
function filterStockDevices(searchTerm = '', statusFilter = '', conditionFilter = '') {
    filteredStockDevices = stockDevices.filter(device => {
        const matchesSearch = !searchTerm || 
            device.device_registration_number.toLowerCase().includes(searchTerm) ||
            device.device_imei.toLowerCase().includes(searchTerm) ||
            device.device_model_no.toLowerCase().includes(searchTerm) ||
            (device.po_no && device.po_no.toLowerCase().includes(searchTerm)) ||
            (device.batch_no && device.batch_no.toLowerCase().includes(searchTerm));

        const matchesStatus = !statusFilter || device.current_status === statusFilter;
        const matchesCondition = !conditionFilter || device.device_condition === conditionFilter;

        return matchesSearch && matchesStatus && matchesCondition;
    });

    updateStockTable();
}

// Update stock table display
function updateStockTable() {
    const tableBody = document.getElementById('stockTableBody');
    const emptyState = document.getElementById('stockEmptyState');
    
    if (!tableBody || !emptyState) return;

    if (filteredStockDevices.length === 0) {
        tableBody.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    
    tableBody.innerHTML = filteredStockDevices.map(device => createStockTableRow(device)).join('');
}

// Create stock table row
function createStockTableRow(device) {
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString();
    };

    const getStatusBadge = (status) => {
        const badges = {
            'available': 'device-status-available',
            'allocated': 'device-status-allocated',
            'returned': 'device-status-returned'
        };
        return `<span class="device-status-badge ${badges[status] || ''}">${status}</span>`;
    };

    const getConditionBadge = (condition) => {
        const badges = {
            'new': 'device-condition-new',
            'used': 'device-condition-used',
            'refurbished': 'device-condition-refurbished',
            'damaged': 'device-condition-damaged'
        };
        return `<span class="device-condition-badge ${badges[condition] || ''}">${condition}</span>`;
    };

    const customerName = device.customers ? device.customers.customer_name : 'N/A';

    return `
        <tr class="hover:dark:bg-dark-fill-base-600/20">
            <td class="text-body-m-regular dark:text-dark-base-600">${device.sl_no || 'N/A'}</td>
            <td class="text-body-m-regular dark:text-dark-base-600">${device.po_no || 'N/A'}</td>
            <td class="text-body-m-regular dark:text-dark-base-600">${device.device_model_no}</td>
            <td class="text-body-m-semibold dark:text-brand-blue-600">${device.device_registration_number}</td>
            <td class="text-body-m-regular dark:text-dark-base-600">${device.device_imei}</td>
            <td>${getStatusBadge(device.current_status)}</td>
            <td>${getConditionBadge(device.device_condition)}</td>
            <td class="text-body-m-regular dark:text-dark-base-600">${customerName}</td>
            <td>
                <div class="device-actions">
                    <button class="inventory-action-btn view" onclick="viewDeviceDetails(${device.id})">
                        👁️ View
                    </button>
                    <div class="device-actions-menu">
                        <button onclick="editDevice(${device.id})">✏️ Edit</button>
                        ${device.current_status === 'allocated' ? 
                            `<button onclick="returnDevice(${device.id})">🔄 Return</button>` : ''
                        }
                    </div>
                </div>
            </td>
        </tr>
    `;
}

// Show/hide different content sections
function showStockContent() {
    document.getElementById('stockContent').classList.remove('hidden');
    document.getElementById('inventoryManagementContent').classList.add('hidden');
    loadStockData();
}

function showInventoryManagementContent() {
    document.getElementById('stockContent').classList.add('hidden');
    document.getElementById('inventoryManagementContent').classList.remove('hidden');
    loadInventoryData();
}

// Inventory tab functions
function showInwardTab() {
    document.getElementById('inwardTabContent').classList.remove('hidden');
    document.getElementById('outwardTabContent').classList.add('hidden');
    
    // Update tab styling
    document.getElementById('inwardTab').classList.add('active');
    document.getElementById('outwardTab').classList.remove('active');
    
    loadInwardData();
}

function showOutwardTab() {
    document.getElementById('inwardTabContent').classList.add('hidden');
    document.getElementById('outwardTabContent').classList.remove('hidden');
    
    // Update tab styling
    document.getElementById('inwardTab').classList.remove('active');
    document.getElementById('outwardTab').classList.add('active');
    
    loadOutwardData();
}

// CSV Import Modal functions
function showImportCSVModal() {
    document.getElementById('csvImportModal').classList.remove('hidden');
    resetCSVImportForm();
}

function closeCSVImportModal() {
    document.getElementById('csvImportModal').classList.add('hidden');
    resetCSVImportForm();
}

function resetCSVImportForm() {
    document.getElementById('csvImportForm').reset();
    document.getElementById('csvFileInput').value = '';
    document.getElementById('csvUploadPlaceholder').classList.remove('hidden');
    document.getElementById('csvFileSelected').classList.add('hidden');
    document.getElementById('csvImportProgress').classList.add('hidden');
    document.getElementById('csvImportButton').disabled = false;
    csvData = null;
    importInProgress = false;
}

// Handle CSV file selection
function handleCSVFileSelect(event) {
    const file = event.target.files[0];
    if (file && file.type === 'text/csv') {
        displaySelectedFile(file);
        parseCSVFile(file);
    } else {
        showInventoryToast('Please select a valid CSV file', 'error');
    }
}

// Display selected file info
function displaySelectedFile(file) {
    document.getElementById('csvUploadPlaceholder').classList.add('hidden');
    document.getElementById('csvFileSelected').classList.remove('hidden');
    document.getElementById('csvFileName').textContent = file.name;
    document.getElementById('csvFileSize').textContent = `Size: ${(file.size / 1024).toFixed(2)} KB`;
}

// Parse CSV file
function parseCSVFile(file) {
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            if (results.errors.length > 0) {
                console.error('CSV parsing errors:', results.errors);
                showInventoryToast('Error parsing CSV file', 'error');
                return;
            }

            // Validate CSV structure
            const requiredColumns = [
                'Sl. No.',
                'PO No',
                'Batch No.',
                'Inward Date',
                'Device Model No.',
                'Device Registration Number',
                'Device IMEI'
            ];

            const csvColumns = Object.keys(results.data[0] || {});
            const missingColumns = requiredColumns.filter(col => !csvColumns.includes(col));

            if (missingColumns.length > 0) {
                showInventoryToast(`Missing required columns: ${missingColumns.join(', ')}`, 'error');
                return;
            }

            csvData = results.data;
            document.getElementById('csvImportButton').disabled = false;
            showInventoryToast(`CSV file validated. ${csvData.length} rows ready to import`, 'success');
        },
        error: function(error) {
            console.error('CSV parsing error:', error);
            showInventoryToast('Error parsing CSV file', 'error');
        }
    });
}

// Handle drag and drop events
function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('dragover');
}

function handleDragLeave(e) {
    e.currentTarget.classList.remove('dragover');
}

function handleFileDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        if (file.type === 'text/csv') {
            document.getElementById('csvFileInput').files = files;
            displaySelectedFile(file);
            parseCSVFile(file);
        } else {
            showInventoryToast('Please drop a valid CSV file', 'error');
        }
    }
}

// Handle CSV import
async function handleCSVImport(e) {
    e.preventDefault();
    
    if (!csvData || csvData.length === 0) {
        showInventoryToast('No CSV data to import', 'error');
        return;
    }

    if (importInProgress) {
        return;
    }

    importInProgress = true;
    document.getElementById('csvImportButton').disabled = true;
    document.getElementById('csvImportProgress').classList.remove('hidden');

    try {
        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        for (let i = 0; i < csvData.length; i++) {
            const row = csvData[i];
            
            // Update progress
            const progress = ((i + 1) / csvData.length) * 100;
            updateImportProgress(progress, `Processing row ${i + 1} of ${csvData.length}`);

            try {
                // Prepare device data
                const deviceData = {
                    sl_no: parseInt(row['Sl. No.']) || null,
                    po_no: row['PO No'] || null,
                    batch_no: row['Batch No.'] || null,
                    inward_date: row['Inward Date'] ? new Date(row['Inward Date']).toISOString().split('T')[0] : null,
                    device_model_no: row['Device Model No.'],
                    device_registration_number: row['Device Registration Number'],
                    device_imei: row['Device IMEI'],
                    current_status: 'available',
                    device_condition: 'new',
                    imported_by: userSession?.email || 'admin',
                    imported_at: new Date().toISOString()
                };

                // Insert into database
                const { error } = await supabase
                    .from('stock')
                    .insert([deviceData]);

                if (error) {
                    errorCount++;
                    errors.push({
                        row: i + 1,
                        device_registration_number: deviceData.device_registration_number,
                        error: error.message
                    });
                } else {
                    successCount++;
                }
            } catch (error) {
                errorCount++;
                errors.push({
                    row: i + 1,
                    device_registration_number: row['Device Registration Number'],
                    error: error.message
                });
            }

            // Small delay to prevent overwhelming the database
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Log import results
        await supabase
            .from('csv_import_logs')
            .insert([{
                filename: document.getElementById('csvFileName').textContent,
                total_rows: csvData.length,
                successful_imports: successCount,
                failed_imports: errorCount,
                error_details: errors,
                imported_by: userSession?.email || 'admin'
            }]);

        updateImportProgress(100, 'Import completed');
        
        setTimeout(() => {
            if (errorCount > 0) {
                showInventoryToast(`Import completed: ${successCount} success, ${errorCount} errors`, 'warning');
                console.log('Import errors:', errors);
            } else {
                showInventoryToast(`Successfully imported ${successCount} devices`, 'success');
            }
            closeCSVImportModal();
            loadStockData();
        }, 1000);

    } catch (error) {
        console.error('Import error:', error);
        showInventoryToast('Error during import process', 'error');
    } finally {
        importInProgress = false;
    }
}

// Update import progress
function updateImportProgress(percentage, status) {
    document.getElementById('csvImportPercentage').textContent = `${Math.round(percentage)}%`;
    document.getElementById('csvImportProgressBar').style.width = `${percentage}%`;
    document.getElementById('csvImportStatus').textContent = status;
}

// Inward device functions
function showInwardForm() {
    document.getElementById('inwardDeviceModal').classList.remove('hidden');
}

function closeInwardDeviceModal() {
    document.getElementById('inwardDeviceModal').classList.add('hidden');
    document.getElementById('inwardDeviceForm').reset();
}

// Handle inward device submission
async function handleInwardDevice(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const deviceRegistrationNumber = formData.get('deviceRegistrationNumber');
    const deviceIMEI = formData.get('deviceIMEI');
    const deviceCondition = formData.get('deviceCondition');
    const notes = formData.get('notes');

    try {
        // Check if device exists in stock
        const { data: stockDevice, error: stockError } = await supabase
            .from('stock')
            .select('*')
            .eq('device_registration_number', deviceRegistrationNumber)
            .single();

        if (stockError || !stockDevice) {
            showInventoryToast('Device registration number not found in stock', 'error');
            return;
        }

        // Verify IMEI matches
        if (stockDevice.device_imei !== deviceIMEI) {
            showInventoryToast('IMEI does not match stock record', 'error');
            return;
        }

        // Create inward record
        const inwardData = {
            device_registration_number: deviceRegistrationNumber,
            device_imei: deviceIMEI,
            device_condition: deviceCondition,
            notes: notes,
            processed_by: userSession?.email || 'admin',
            stock_id: stockDevice.id
        };

        const { error: inwardError } = await supabase
            .from('inward_devices')
            .insert([inwardData]);

        if (inwardError) {
            console.error('Error adding inward device:', inwardError);
            showInventoryToast('Error adding inward device', 'error');
            return;
        }

        // Update stock device condition
        await supabase
            .from('stock')
            .update({ 
                device_condition: deviceCondition,
                current_status: 'available'
            })
            .eq('id', stockDevice.id);

        showInventoryToast('Device added to inward successfully', 'success');
        closeInwardDeviceModal();
        loadInwardData();
        loadStockData();

    } catch (error) {
        console.error('Error adding inward device:', error);
        showInventoryToast('Error adding inward device', 'error');
    }
}

// Outward device functions
function showOutwardForm() {
    document.getElementById('outwardDeviceModal').classList.remove('hidden');
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    document.querySelector('input[name="outwardDate"]').value = today;
}

function closeOutwardDeviceModal() {
    document.getElementById('outwardDeviceModal').classList.add('hidden');
    document.getElementById('outwardDeviceForm').reset();
}

// Handle outward device submission
async function handleOutwardDevice(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const deviceRegistrationNumber = formData.get('deviceRegistrationNumber');
    const deviceIMEI = formData.get('deviceIMEI');
    const customerId = formData.get('customerId');
    const location = formData.get('location');
    const outwardDate = formData.get('outwardDate');
    const simNo = formData.get('simNo');
    const notes = formData.get('notes');

    try {
        // Check if device exists in stock and is available
        const { data: stockDevice, error: stockError } = await supabase
            .from('stock')
            .select('*')
            .eq('device_registration_number', deviceRegistrationNumber)
            .eq('current_status', 'available')
            .single();

        if (stockError || !stockDevice) {
            showInventoryToast('Device not found or not available in stock', 'error');
            return;
        }

        // Verify IMEI matches
        if (stockDevice.device_imei !== deviceIMEI) {
            showInventoryToast('IMEI does not match stock record', 'error');
            return;
        }

        // Get customer name
        const { data: customer, error: customerError } = await supabase
            .from('customers')
            .select('customer_name')
            .eq('id', customerId)
            .single();

        if (customerError || !customer) {
            showInventoryToast('Customer not found', 'error');
            return;
        }

        // Create outward record
        const outwardData = {
            device_registration_number: deviceRegistrationNumber,
            device_imei: deviceIMEI,
            customer_id: customerId,
            customer_name: customer.customer_name,
            location: location,
            outward_date: outwardDate,
            sim_no: simNo,
            notes: notes,
            processed_by: userSession?.email || 'admin',
            stock_id: stockDevice.id
        };

        const { error: outwardError } = await supabase
            .from('outward_devices')
            .insert([outwardData]);

        if (outwardError) {
            console.error('Error adding outward device:', outwardError);
            showInventoryToast('Error allocating device', 'error');
            return;
        }

        // Update stock device status
        await supabase
            .from('stock')
            .update({ 
                current_status: 'allocated',
                allocated_to_customer_id: customerId,
                allocated_date: new Date().toISOString(),
                location: location,
                sim_no: simNo
            })
            .eq('id', stockDevice.id);

        showInventoryToast('Device allocated successfully', 'success');
        closeOutwardDeviceModal();
        loadOutwardData();
        loadStockData();

    } catch (error) {
        console.error('Error allocating device:', error);
        showInventoryToast('Error allocating device', 'error');
    }
}

// Update inward devices list
function updateInwardDevicesList() {
    const inwardList = document.getElementById('inwardDevicesList');
    const emptyState = document.getElementById('inwardEmptyState');
    
    if (!inwardList || !emptyState) return;

    if (inwardDevices.length === 0) {
        inwardList.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    
    inwardList.innerHTML = inwardDevices.map(device => createInwardDeviceCard(device)).join('');
}

// Create inward device card
function createInwardDeviceCard(device) {
    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString();
    };

    const getConditionBadge = (condition) => {
        const badges = {
            'new': 'device-condition-new',
            'used': 'device-condition-used',
            'refurbished': 'device-condition-refurbished',
            'damaged': 'device-condition-damaged'
        };
        return `<span class="device-condition-badge ${badges[condition] || ''}">${condition}</span>`;
    };

    return `
        <div class="inventory-card">
            <div class="flex justify-between items-start mb-3">
                <div>
                    <h4 class="text-body-l-semibold dark:text-dark-base-600">${device.device_registration_number}</h4>
                    <p class="text-body-m-regular dark:text-dark-base-500">IMEI: ${device.device_imei}</p>
                </div>
                <div class="flex flex-col gap-2 items-end">
                    ${getConditionBadge(device.device_condition)}
                    <span class="text-body-s-regular dark:text-dark-base-500">${formatDate(device.inward_date)}</span>
                </div>
            </div>
            ${device.notes ? `
                <div class="mb-3">
                    <span class="text-body-s-semibold dark:text-dark-base-600">Notes:</span>
                    <p class="text-body-s-regular dark:text-dark-base-500">${device.notes}</p>
                </div>
            ` : ''}
            <div class="text-body-s-regular dark:text-dark-base-500">
                <span class="font-semibold">Processed by:</span> ${device.processed_by || 'N/A'}
            </div>
        </div>
    `;
}

// Update outward devices list
function updateOutwardDevicesList() {
    const outwardList = document.getElementById('outwardDevicesList');
    const emptyState = document.getElementById('outwardEmptyState');
    
    if (!outwardList || !emptyState) return;

    if (outwardDevices.length === 0) {
        outwardList.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    
    outwardList.innerHTML = outwardDevices.map(device => createOutwardDeviceCard(device)).join('');
}

// Create outward device card
function createOutwardDeviceCard(device) {
    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString();
    };

    return `
        <div class="inventory-card outward-card">
            <div class="flex justify-between items-start mb-3">
                <div>
                    <h4 class="text-body-l-semibold dark:text-dark-base-600">${device.device_registration_number}</h4>
                    <p class="text-body-m-regular dark:text-dark-base-500">IMEI: ${device.device_imei}</p>
                </div>
                <div class="flex flex-col gap-2 items-end">
                    <span class="px-2 py-1 text-xs rounded-full dark:bg-dark-warning-600 dark:text-utility-white">Allocated</span>
                    <span class="text-body-s-regular dark:text-dark-base-500">${formatDate(device.outward_date)}</span>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-4 text-body-s-regular dark:text-dark-base-500 mb-3">
                <div>
                    <span class="font-semibold">Customer:</span> ${device.customer_name}
                </div>
                <div>
                    <span class="font-semibold">Location:</span> ${device.location}
                </div>
                ${device.sim_no ? `
                    <div>
                        <span class="font-semibold">SIM No:</span> ${device.sim_no}
                    </div>
                ` : ''}
            </div>
            ${device.notes ? `
                <div class="mb-3">
                    <span class="text-body-s-semibold dark:text-dark-base-600">Notes:</span>
                    <p class="text-body-s-regular dark:text-dark-base-500">${device.notes}</p>
                </div>
            ` : ''}
            <div class="flex justify-between items-center">
                <span class="text-body-s-regular dark:text-dark-base-500">
                    Processed by: ${device.processed_by || 'N/A'}
                </span>
                <button onclick="returnDevice(${device.stock_id})" class="inventory-action-btn return">
                    🔄 Return
                </button>
            </div>
        </div>
    `;
}

// Device actions
function viewDeviceDetails(deviceId) {
    const device = stockDevices.find(d => d.id === deviceId);
    if (device) {
        alert(`Device Details:\n\nRegistration: ${device.device_registration_number}\nIMEI: ${device.device_imei}\nModel: ${device.device_model_no}\nStatus: ${device.current_status}\nCondition: ${device.device_condition}`);
    }
}

function editDevice(deviceId) {
    // Implement edit functionality
    showInventoryToast('Edit functionality coming soon', 'info');
}

async function returnDevice(stockId) {
    if (!confirm('Are you sure you want to return this device to stock?')) {
        return;
    }

    try {
        // Update stock status
        const { error: stockError } = await supabase
            .from('stock')
            .update({
                current_status: 'available',
                allocated_to_customer_id: null,
                allocated_date: null,
                location: null,
                sim_no: null
            })
            .eq('id', stockId);

        if (stockError) {
            console.error('Error returning device:', stockError);
            showInventoryToast('Error returning device', 'error');
            return;
        }

        showInventoryToast('Device returned to stock successfully', 'success');
        loadStockData();
        loadOutwardData();

    } catch (error) {
        console.error('Error returning device:', error);
        showInventoryToast('Error returning device', 'error');
    }
}

// Show inventory toast notification
function showInventoryToast(message, type = 'success') {
    const toast = document.getElementById('inventoryToast');
    const messageEl = document.getElementById('inventoryToastMessage');
    const iconEl = document.getElementById('inventoryToastIcon');
    
    if (!toast || !messageEl || !iconEl) return;

    // Reset classes
    toast.className = 'fixed top-4 right-4 z-50 max-w-sm p-4 rounded-lg shadow-lg transition-all duration-300 transform translate-x-full';
    
    // Set type-specific styling
    switch (type) {
        case 'success':
            toast.classList.add('success');
            iconEl.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4"/>';
            break;
        case 'error':
            toast.classList.add('error');
            iconEl.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>';
            break;
        case 'warning':
            toast.classList.add('warning');
            iconEl.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>';
            break;
        case 'info':
            toast.classList.add('info');
            iconEl.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>';
            break;
    }

    messageEl.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

// Export functions for global access
window.showStockContent = showStockContent;
window.showInventoryManagementContent = showInventoryManagementContent;
window.showInwardTab = showInwardTab;
window.showOutwardTab = showOutwardTab;
window.showImportCSVModal = showImportCSVModal;
window.closeCSVImportModal = closeCSVImportModal;
window.handleCSVFileSelect = handleCSVFileSelect;
window.showInwardForm = showInwardForm;
window.closeInwardDeviceModal = closeInwardDeviceModal;
window.showOutwardForm = showOutwardForm;
window.closeOutwardDeviceModal = closeOutwardDeviceModal;
window.viewDeviceDetails = viewDeviceDetails;
window.editDevice = editDevice;
window.returnDevice = returnDevice;
