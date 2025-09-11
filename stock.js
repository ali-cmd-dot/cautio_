// Stock Management JavaScript
// This file handles CSV import and stock management functionality

// Supabase Configuration (same as main app)
const supabaseUrl = 'https://jcmjazindwonrplvjwxl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjbWphemluZHdvbnJwbHZqd3hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczMDEyNjMsImV4cCI6MjA3Mjg3NzI2M30.1B6sKnzrzdNFhvQUXVnRzzQnItFMaIFL0Y9WK_Gie9g';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Global variables for stock management
let stockData = [];
let filteredStockData = [];
let importHistory = [];
let currentStockFilter = '';
let userSession = null;

// Required CSV columns
const REQUIRED_COLUMNS = [
    'Sl. No.',
    'PO No',
    'Batch No.',
    'Inward Date',
    'Device Model No.',
    'Device Registration Number',
    'Device IMEI'
];

// Initialize stock management
document.addEventListener('DOMContentLoaded', function() {
    // Get user session from localStorage
    checkStockUserSession();
    
    // Load initial data
    loadStockData();
    
    // Setup event listeners
    setupStockEventListeners();
    
    // Setup realtime listeners
    setupStockRealtimeListeners();
});

// Check user session for stock management
function checkStockUserSession() {
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

// Navigation functions
function goBackToDashboard() {
    window.location.href = 'index.html';
}

function goToInventoryManagement() {
    window.location.href = 'inventory.html';
}

// Setup event listeners for stock management
function setupStockEventListeners() {
    // CSV file input
    const csvFileInput = document.getElementById('csvFileInput');
    csvFileInput.addEventListener('change', handleCSVFileSelect);
    
    // Drag and drop for CSV import
    const csvImportArea = document.getElementById('csvImportArea');
    csvImportArea.addEventListener('dragover', handleDragOver);
    csvImportArea.addEventListener('dragleave', handleDragLeave);
    csvImportArea.addEventListener('drop', handleFileDrop);
    
    // Search functionality
    document.getElementById('stockSearchInput').addEventListener('input', handleStockSearch);
    document.getElementById('statusFilter').addEventListener('change', handleStockSearch);
}

// Setup realtime listeners for stock
function setupStockRealtimeListeners() {
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

    // Listen for import log changes
    supabase
        .channel('import_log_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'csv_import_logs' }, 
            (payload) => {
                console.log('Import log change received!', payload);
                loadImportHistory();
            }
        )
        .subscribe();
}

// Load all stock data
async function loadStockData() {
    try {
        showStockLoadingOverlay();
        
        // Load stock data
        await loadStockItems();
        
        // Load import history
        await loadImportHistory();
        
        // Update UI
        updateStockSummary();
        updateStockTable();
        updateImportHistoryList();
        
        hideStockLoadingOverlay();
    } catch (error) {
        console.error('Error loading stock data:', error);
        showStockToast('Error loading stock data', 'error');
        hideStockLoadingOverlay();
    }
}

// Load stock items from database
async function loadStockItems() {
    try {
        const { data, error } = await supabase
            .from('stock')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error loading stock items:', error);
            throw error;
        }

        stockData = data || [];
        filteredStockData = [...stockData];
        console.log(`Loaded ${stockData.length} stock items`);
    } catch (error) {
        console.error('Error loading stock items:', error);
        throw error;
    }
}

// Load import history
async function loadImportHistory() {
    try {
        const { data, error } = await supabase
            .from('csv_import_logs')
            .select('*')
            .order('import_date', { ascending: false })
            .limit(10);

        if (error) {
            console.error('Error loading import history:', error);
            throw error;
        }

        importHistory = data || [];
        console.log(`Loaded ${importHistory.length} import history records`);
    } catch (error) {
        console.error('Error loading import history:', error);
        throw error;
    }
}

// Update stock summary display
function updateStockSummary() {
    const totalItems = stockData.length;
    const availableItems = stockData.filter(item => item.current_status === 'available').length;
    const allocatedItems = stockData.filter(item => item.current_status === 'allocated').length;
    const uniqueModels = new Set(stockData.map(item => item.device_model_no)).size;
    
    document.getElementById('totalStockItems').textContent = totalItems;
    document.getElementById('availableItems').textContent = availableItems;
    document.getElementById('allocatedItems').textContent = allocatedItems;
    document.getElementById('totalModels').textContent = uniqueModels;
}

// Update stock table
function updateStockTable() {
    const tableBody = document.getElementById('stockTableBody');
    const emptyState = document.getElementById('stockEmptyState');
    
    if (filteredStockData.length === 0) {
        tableBody.innerHTML = '';
        emptyState.classList.remove('hidden');
    } else {
        emptyState.classList.add('hidden');
        tableBody.innerHTML = filteredStockData.map(item => createStockTableRow(item)).join('');
    }
}

// Create stock table row HTML
function createStockTableRow(item) {
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString();
    };

    const getStatusBadge = (status) => {
        const badgeClass = `device-status-badge ${status}`;
        return `<span class="${badgeClass}">${status}</span>`;
    };

    const getConditionBadge = (condition) => {
        const badgeClass = `condition-badge ${condition}`;
        return `<span class="${badgeClass}">${condition}</span>`;
    };

    return `
        <tr class="dark:border-b dark:border-dark-stroke-contrast-400 hover:dark:bg-dark-fill-base-400">
            <td class="p-4 text-body-m-regular dark:text-dark-base-600">${item.sl_no || 'N/A'}</td>
            <td class="p-4 text-body-m-regular dark:text-dark-base-600">${item.device_registration_number}</td>
            <td class="p-4 text-body-m-regular dark:text-dark-base-600">${item.device_imei}</td>
            <td class="p-4 text-body-m-regular dark:text-dark-base-600">${item.device_model_no}</td>
            <td class="p-4">${getStatusBadge(item.current_status)}</td>
            <td class="p-4">${getConditionBadge(item.device_condition)}</td>
            <td class="p-4 text-body-m-regular dark:text-dark-base-600">${item.batch_no || 'N/A'}</td>
            <td class="p-4 text-body-m-regular dark:text-dark-base-600">${formatDate(item.inward_date)}</td>
            <td class="p-4">
                <div class="flex gap-2">
                    <button onclick="viewStockDeviceDetails('${item.device_registration_number}')" class="device-action-btn view text-xs">
                        View
                    </button>
                    <button onclick="editStockDevice('${item.id}')" class="device-action-btn edit text-xs">
                        Edit
                    </button>
                </div>
            </td>
        </tr>
    `;
}

// Handle drag over event
function handleDragOver(e) {
    e.preventDefault();
    document.getElementById('csvImportArea').classList.add('drag-over');
}

// Handle drag leave event
function handleDragLeave(e) {
    e.preventDefault();
    document.getElementById('csvImportArea').classList.remove('drag-over');
}

// Handle file drop event
function handleFileDrop(e) {
    e.preventDefault();
    document.getElementById('csvImportArea').classList.remove('drag-over');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
            processCSVFile(file);
        } else {
            showStockToast('Please select a valid CSV file', 'error');
        }
    }
}

// Handle CSV file selection
function handleCSVFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
            processCSVFile(file);
        } else {
            showStockToast('Please select a valid CSV file', 'error');
        }
    }
}

// Process CSV file
function processCSVFile(file) {
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const csv = e.target.result;
        
        // Parse CSV using PapaParse
        Papa.parse(csv, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true,
            transformHeader: function(header) {
                return header.trim(); // Remove whitespace from headers
            },
            complete: function(results) {
                validateAndImportCSV(results, file.name);
            },
            error: function(error) {
                console.error('CSV parsing error:', error);
                showStockToast('Error parsing CSV file', 'error');
            }
        });
    };
    
    reader.onerror = function() {
        showStockToast('Error reading file', 'error');
    };
    
    reader.readAsText(file);
}

// Validate and import CSV data
async function validateAndImportCSV(results, filename) {
    try {
        const data = results.data;
        const headers = Object.keys(data[0] || {});
        
        // Validate headers
        const missingColumns = REQUIRED_COLUMNS.filter(col => !headers.includes(col));
        if (missingColumns.length > 0) {
            showStockToast(`Missing required columns: ${missingColumns.join(', ')}`, 'error');
            return;
        }
        
        // Show progress
        showImportProgress();
        
        // Validate and process data
        const validData = [];
        const errors = [];
        let processed = 0;
        
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            processed++;
            
            // Update progress
            updateImportProgress((processed / data.length) * 50); // First 50% for validation
            
            // Validate required fields
            const deviceRegNumber = row['Device Registration Number'];
            const deviceImei = row['Device IMEI'];
            const deviceModel = row['Device Model No.'];
            
            if (!deviceRegNumber || !deviceImei || !deviceModel) {
                errors.push(`Row ${i + 2}: Missing required data`);
                continue;
            }
            
            // Check for duplicates in current batch
            const duplicate = validData.find(item => 
                item.device_registration_number === deviceRegNumber || 
                item.device_imei === deviceImei
            );
            
            if (duplicate) {
                errors.push(`Row ${i + 2}: Duplicate device registration number or IMEI in CSV`);
                continue;
            }
            
            // Parse inward date
            let inwardDate = null;
            if (row['Inward Date']) {
                const dateStr = row['Inward Date'];
                if (typeof dateStr === 'string') {
                    // Try to parse different date formats
                    const parsedDate = new Date(dateStr);
                    if (!isNaN(parsedDate.getTime())) {
                        inwardDate = parsedDate.toISOString().split('T')[0];
                    }
                } else if (dateStr instanceof Date) {
                    inwardDate = dateStr.toISOString().split('T')[0];
                }
            }
            
            // Create stock item
            const stockItem = {
                sl_no: row['Sl. No.'] || null,
                po_no: row['PO No'] || null,
                batch_no: row['Batch No.'] || null,
                inward_date: inwardDate,
                device_model_no: deviceModel,
                device_registration_number: deviceRegNumber,
                device_imei: deviceImei,
                current_status: 'available',
                device_condition: 'new',
                imported_by: userSession?.email || 'unknown'
            };
            
            validData.push(stockItem);
        }
        
        // Check for existing devices in database
        const existingDevices = [];
        for (let i = 0; i < validData.length; i++) {
            updateImportProgress(50 + (i / validData.length) * 30); // 50-80% for database check
            
            const item = validData[i];
            const { data: existing, error } = await supabase
                .from('stock')
                .select('device_registration_number, device_imei')
                .or(`device_registration_number.eq.${item.device_registration_number},device_imei.eq.${item.device_imei}`);
            
            if (error) {
                console.error('Error checking existing devices:', error);
                continue;
            }
            
            if (existing && existing.length > 0) {
                existingDevices.push(item.device_registration_number);
                errors.push(`Device ${item.device_registration_number} already exists in database`);
            }
        }
        
        // Filter out existing devices
        const newDevices = validData.filter(item => 
            !existingDevices.includes(item.device_registration_number)
        );
        
        // Import valid data
        let successfulImports = 0;
        if (newDevices.length > 0) {
            for (let i = 0; i < newDevices.length; i++) {
                updateImportProgress(80 + (i / newDevices.length) * 20); // 80-100% for import
                
                const { error } = await supabase
                    .from('stock')
                    .insert([newDevices[i]]);
                
                if (error) {
                    console.error('Error inserting stock item:', error);
                    errors.push(`Failed to import device ${newDevices[i].device_registration_number}: ${error.message}`);
                } else {
                    successfulImports++;
                }
            }
        }
        
        // Log import results
        const importLog = {
            filename: filename,
            total_rows: data.length,
            successful_imports: successfulImports,
            failed_imports: data.length - successfulImports,
            error_details: errors.length > 0 ? { errors: errors } : null,
            imported_by: userSession?.email || 'unknown'
        };
        
        await supabase
            .from('csv_import_logs')
            .insert([importLog]);
        
        // Hide progress and show results
        hideImportProgress();
        showImportResults(successfulImports, data.length - successfulImports, errors);
        
        // Reload data
        await loadStockData();
        
        // Clear file input
        document.getElementById('csvFileInput').value = '';
        
    } catch (error) {
        console.error('Error importing CSV:', error);
        hideImportProgress();
        showStockToast('Error importing CSV data', 'error');
    }
}

// Show import progress
function showImportProgress() {
    document.getElementById('importProgressSection').classList.remove('hidden');
    updateImportProgress(0);
}

// Update import progress
function updateImportProgress(percentage) {
    const progressBar = document.getElementById('importProgressBar');
    const progressText = document.getElementById('importProgressText');
    
    progressBar.style.width = `${percentage}%`;
    progressText.textContent = `${Math.round(percentage)}%`;
}

// Hide import progress
function hideImportProgress() {
    document.getElementById('importProgressSection').classList.add('hidden');
}

// Show import results
function showImportResults(successful, failed, errors) {
    const resultsDiv = document.getElementById('importResults');
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
                    Import ${isSuccess ? 'Completed' : 'Completed with Errors'}
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
    
    // Auto-hide after 10 seconds
    setTimeout(() => {
        resultsDiv.classList.add('hidden');
    }, 10000);
    
    // Show toast
    if (isSuccess) {
        showStockToast(`Successfully imported ${successful} devices`, 'success');
    } else {
        showStockToast(`Import completed: ${successful} successful, ${failed} failed`, 'warning');
    }
}

// Update import history list
function updateImportHistoryList() {
    const historyList = document.getElementById('importHistoryList');
    const emptyState = document.getElementById('importHistoryEmptyState');
    
    if (importHistory.length === 0) {
        historyList.innerHTML = '';
        emptyState.style.display = 'block';
    } else {
        emptyState.style.display = 'none';
        historyList.innerHTML = importHistory.map(record => createImportHistoryCard(record)).join('');
    }
}

// Create import history card HTML
function createImportHistoryCard(record) {
    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleString();
    };

    const getStatusIcon = (successfulImports, failedImports) => {
        if (failedImports === 0) {
            return `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>`;
        } else if (successfulImports > 0) {
            return `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>`;
        } else {
            return `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>`;
        }
    };

    return `
        <div class="p-4 rounded-lg dark:bg-dark-fill-base-300 dark:border dark:border-dark-stroke-contrast-400">
            <div class="flex items-start justify-between">
                <div class="flex items-start gap-3">
                    ${getStatusIcon(record.successful_imports, record.failed_imports)}
                    <div>
                        <h4 class="text-body-l-semibold dark:text-dark-base-600">${record.filename}</h4>
                        <p class="text-body-s-regular dark:text-dark-base-500">
                            ${formatDate(record.import_date)} by ${record.imported_by}
                        </p>
                        <div class="flex gap-4 mt-2">
                            <span class="text-body-s-regular text-green-600">
                                ${record.successful_imports} successful
                            </span>
                            <span class="text-body-s-regular text-red-600">
                                ${record.failed_imports} failed
                            </span>
                            <span class="text-body-s-regular dark:text-dark-base-500">
                                ${record.total_rows} total
                            </span>
                        </div>
                    </div>
                </div>
                ${record.error_details ? `
                    <button onclick="showImportErrors(${record.id})" class="px-3 py-1 text-xs rounded-lg dark:bg-dark-semantic-danger-300 dark:text-utility-white hover:dark:bg-dark-semantic-danger-300/90">
                        View Errors
                    </button>
                ` : ''}
            </div>
        </div>
    `;
}

// Search functionality
function handleStockSearch() {
    const searchTerm = document.getElementById('stockSearchInput').value.toLowerCase().trim();
    const statusFilter = document.getElementById('statusFilter').value;
    
    filteredStockData = stockData.filter(item => {
        const matchesSearch = !searchTerm || (
            item.device_registration_number.toLowerCase().includes(searchTerm) ||
            item.device_imei.toLowerCase().includes(searchTerm) ||
            item.device_model_no.toLowerCase().includes(searchTerm) ||
            (item.batch_no && item.batch_no.toLowerCase().includes(searchTerm)) ||
            (item.po_no && item.po_no.toLowerCase().includes(searchTerm))
        );
        
        const matchesStatus = !statusFilter || item.current_status === statusFilter;
        
        return matchesSearch && matchesStatus;
    });
    
    updateStockTable();
    
    if (searchTerm || statusFilter) {
        showStockToast(`Found ${filteredStockData.length} devices`, 'success');
    }
}

function clearStockSearch() {
    document.getElementById('stockSearchInput').value = '';
    document.getElementById('statusFilter').value = '';
    filteredStockData = [...stockData];
    updateStockTable();
    showStockToast('Search cleared', 'success');
}

// View stock device details
function viewStockDeviceDetails(deviceRegistrationNumber) {
    const device = stockData.find(item => item.device_registration_number === deviceRegistrationNumber);
    
    if (!device) {
        showStockToast('Device not found', 'error');
        return;
    }
    
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleString();
    };
    
    const content = `
        <div class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="device-info-label">Registration Number</label>
                    <div class="device-info-value">${device.device_registration_number}</div>
                </div>
                <div>
                    <label class="device-info-label">Device IMEI</label>
                    <div class="device-info-value">${device.device_imei}</div>
                </div>
                <div>
                    <label class="device-info-label">Model</label>
                    <div class="device-info-value">${device.device_model_no}</div>
                </div>
                <div>
                    <label class="device-info-label">Serial Number</label>
                    <div class="device-info-value">${device.sl_no || 'N/A'}</div>
                </div>
                <div>
                    <label class="device-info-label">Status</label>
                    <div class="device-info-value">
                        <span class="device-status-badge ${device.current_status}">${device.current_status}</span>
                    </div>
                </div>
                <div>
                    <label class="device-info-label">Condition</label>
                    <div class="device-info-value">
                        <span class="condition-badge ${device.device_condition}">${device.device_condition}</span>
                    </div>
                </div>
                <div>
                    <label class="device-info-label">PO Number</label>
                    <div class="device-info-value">${device.po_no || 'N/A'}</div>
                </div>
                <div>
                    <label class="device-info-label">Batch Number</label>
                    <div class="device-info-value">${device.batch_no || 'N/A'}</div>
                </div>
                <div>
                    <label class="device-info-label">Inward Date</label>
                    <div class="device-info-value">${formatDate(device.inward_date)}</div>
                </div>
                <div>
                    <label class="device-info-label">Location</label>
                    <div class="device-info-value">${device.location || 'N/A'}</div>
                </div>
                <div>
                    <label class="device-info-label">SIM Number</label>
                    <div class="device-info-value">${device.sim_no || 'N/A'}</div>
                </div>
                <div>
                    <label class="device-info-label">Imported By</label>
                    <div class="device-info-value">${device.imported_by || 'N/A'}</div>
                </div>
            </div>
            <div>
                <label class="device-info-label">Created At</label>
                <div class="device-info-value">${formatDate(device.created_at)}</div>
            </div>
            <div>
                <label class="device-info-label">Last Updated</label>
                <div class="device-info-value">${formatDate(device.updated_at)}</div>
            </div>
        </div>
    `;
    
    document.getElementById('deviceDetailsContent').innerHTML = content;
    document.getElementById('deviceDetailsModal').classList.remove('hidden');
}

// Close device details modal
function closeDeviceDetailsModal() {
    document.getElementById('deviceDetailsModal').classList.add('hidden');
}

// Edit stock device (placeholder for future implementation)
function editStockDevice(deviceId) {
    showStockToast('Edit functionality coming soon', 'warning');
}

// Show import errors (placeholder for future implementation)
function showImportErrors(importId) {
    const importRecord = importHistory.find(record => record.id === importId);
    if (importRecord && importRecord.error_details) {
        const errors = importRecord.error_details.errors || [];
        alert(`Import Errors:\n\n${errors.slice(0, 10).join('\n')}\n${errors.length > 10 ? `\n... and ${errors.length - 10} more errors` : ''}`);
    }
}

// Loading overlay functions
function showStockLoadingOverlay() {
    document.getElementById('stockLoadingOverlay').classList.remove('hidden');
}

function hideStockLoadingOverlay() {
    document.getElementById('stockLoadingOverlay').classList.add('hidden');
}

// Toast notification function
function showStockToast(message, type = 'success') {
    const toast = document.getElementById('stockToast');
    const messageEl = document.getElementById('stockToastMessage');
    const iconEl = document.getElementById('stockToastIcon');
    
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

// Export functions for global access
window.stockFunctions = {
    goBackToDashboard,
    goToInventoryManagement,
    clearStockSearch,
    viewStockDeviceDetails,
    editStockDevice,
    showImportErrors,
    closeDeviceDetailsModal
};
