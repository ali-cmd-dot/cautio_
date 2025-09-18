// Supabase configuration
const SUPABASE_URL = 'https://fhqxjpjswcpvabvnzayf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZocXhqcGpzd2NwdmFidm56YXlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY2MzU4MzcsImV4cCI6MjA0MjIxMTgzN30.HX66s5iKQPUZAd0JLVz0YrAJGBUmx8BQKGB4Cjj_lrM';

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Global variables for stock management
let stockItems = [];
let filteredStockItems = [];
let importHistory = [];

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('Stock page loaded');
    setupStockEventHandlers();
    loadStockData();
});

function setupStockEventHandlers() {
    // CSV file input
    const csvFileInput = document.getElementById('csvFileInput');
    if (csvFileInput) {
        csvFileInput.addEventListener('change', handleCSVUpload);
    }
    
    // Drag and drop for CSV import
    const csvImportArea = document.getElementById('csvImportArea');
    if (csvImportArea) {
        csvImportArea.addEventListener('dragover', handleDragOver);
        csvImportArea.addEventListener('drop', handleDrop);
        csvImportArea.addEventListener('click', () => {
            document.getElementById('csvFileInput').click();
        });
    }
    
    // Search functionality
    const searchInput = document.getElementById('stockSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', handleStockSearch);
    }
    
    // Status filter
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', handleStockSearch);
    }
}

// Navigation functions
function goBackToDashboard() {
    window.location.href = 'index.html';
}

function goToInventoryManagement() {
    window.location.href = 'inventory.html';
}

// Stock page function to be called from main dashboard
function showStockPage() {
    window.location.href = 'stock.html';
}

// Data loading functions
async function loadStockData() {
    console.log('Loading stock data...');
    showStockLoadingOverlay();
    
    try {
        await Promise.all([
            loadStockItems(),
            loadImportHistory()
        ]);
        
        updateStockSummaryCards();
        updateStockTable();
        updateImportHistoryDisplay();
        
        console.log('Stock data loaded successfully');
    } catch (error) {
        console.error('Error loading stock data:', error);
        showStockToast('Error loading stock data', 'error');
    } finally {
        hideStockLoadingOverlay();
    }
}

async function loadStockItems() {
    try {
        const { data, error } = await supabase
            .from('stock')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        stockItems = data || [];
        filteredStockItems = [...stockItems];
        
        console.log(`Loaded ${stockItems.length} stock items`);
        return stockItems;
    } catch (error) {
        console.error('Error loading stock items:', error);
        return [];
    }
}

async function loadImportHistory() {
    try {
        const { data, error } = await supabase
            .from('import_history')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        importHistory = data || [];
        console.log(`Loaded ${importHistory.length} import records`);
        return importHistory;
    } catch (error) {
        console.error('Error loading import history:', error);
        return [];
    }
}

// UI Update functions
function updateStockSummaryCards() {
    const totalItems = stockItems.length;
    const availableItems = stockItems.filter(item => 
        item.status === 'available' && item.device_condition === 'good'
    ).length;
    const allocatedItems = stockItems.filter(item => item.status === 'allocated').length;
    const uniqueModels = [...new Set(stockItems.map(item => item.device_model_no))].length;
    
    document.getElementById('totalStockItems').textContent = totalItems;
    document.getElementById('availableItems').textContent = availableItems;
    document.getElementById('allocatedItems').textContent = allocatedItems;
    document.getElementById('totalModels').textContent = uniqueModels;
}

function updateStockTable() {
    const tableBody = document.getElementById('stockTableBody');
    const emptyState = document.getElementById('stockEmptyState');
    
    if (filteredStockItems.length === 0) {
        tableBody.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    
    let html = '';
    filteredStockItems.forEach(item => {
        const statusClass = getStockStatusClass(item.status);
        const conditionClass = getConditionClass(item.device_condition);
        
        html += `
            <tr class="dark:hover:bg-dark-fill-base-400">
                <td class="p-4 text-body-m-regular dark:text-dark-base-600">${item.sl_no || 'N/A'}</td>
                <td class="p-4 text-body-m-regular dark:text-dark-base-600">${item.device_registration_number}</td>
                <td class="p-4 text-body-m-regular dark:text-dark-base-600">${item.device_imei}</td>
                <td class="p-4 text-body-m-regular dark:text-dark-base-600">${item.device_model_no}</td>
                <td class="p-4">
                    <span class="inline-block px-2 py-1 rounded-full text-body-s-semibold ${statusClass}">
                        ${item.status}
                    </span>
                </td>
                <td class="p-4">
                    <span class="inline-block px-2 py-1 rounded-full text-body-s-semibold ${conditionClass}">
                        ${item.device_condition || 'good'}
                    </span>
                </td>
                <td class="p-4 text-body-m-regular dark:text-dark-base-600">${item.batch_no || 'N/A'}</td>
                <td class="p-4 text-body-m-regular dark:text-dark-base-600">${formatDate(item.inward_date)}</td>
                <td class="p-4">
                    <button onclick="viewStockItemDetails('${item.id}')" class="text-brand-blue-600 hover:text-brand-blue-500 text-body-s-semibold">
                        View Details
                    </button>
                </td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = html;
}

function updateImportHistoryDisplay() {
    const container = document.getElementById('importHistoryList');
    const emptyState = document.getElementById('importHistoryEmptyState');
    
    if (importHistory.length === 0) {
        container.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    
    let html = '';
    importHistory.forEach(record => {
        const statusClass = record.status === 'completed' ? 'success' : 
                          record.status === 'failed' ? 'error' : 'warning';
        
        html += `
            <div class="import-record p-4 rounded-lg dark:bg-dark-fill-base-300 dark:border dark:border-dark-stroke-contrast-400">
                <div class="flex items-center justify-between mb-2">
                    <div class="text-body-l-semibold dark:text-dark-base-600">${record.file_name}</div>
                    <div class="import-status ${statusClass}">
                        <span class="status-text">${record.status}</span>
                    </div>
                </div>
                <div class="grid grid-cols-3 gap-4 text-body-s-regular">
                    <div>
                        <span class="dark:text-dark-base-500">Imported:</span>
                        <span class="dark:text-dark-base-600 ml-2">${record.imported_count || 0}</span>
                    </div>
                    <div>
                        <span class="dark:text-dark-base-500">Failed:</span>
                        <span class="dark:text-dark-base-600 ml-2">${record.failed_count || 0}</span>
                    </div>
                    <div>
                        <span class="dark:text-dark-base-500">Date:</span>
                        <span class="dark:text-dark-base-600 ml-2">${formatDate(record.created_at)}</span>
                    </div>
                </div>
                ${record.error_details ? `
                    <div class="mt-2 p-2 rounded dark:bg-dark-semantic-danger-300/20 text-body-s-regular dark:text-dark-semantic-danger-300">
                        ${record.error_details}
                    </div>
                ` : ''}
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// CSV Import functions
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
            processCSVFile(file);
        } else {
            showStockToast('Please upload a CSV file', 'error');
        }
    }
}

function handleCSVUpload(e) {
    const file = e.target.files[0];
    if (file) {
        processCSVFile(file);
    }
}

async function processCSVFile(file) {
    console.log('Processing CSV file:', file.name);
    
    // Show progress section
    const progressSection = document.getElementById('importProgressSection');
    const resultsSection = document.getElementById('importResults');
    
    progressSection.classList.remove('hidden');
    resultsSection.classList.add('hidden');
    
    // Update progress
    updateImportProgress(0, 'Reading file...');
    
    try {
        // Parse CSV file
        const csvText = await readFileAsText(file);
        updateImportProgress(20, 'Parsing CSV data...');
        
        const results = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true
        });
        
        if (results.errors.length > 0) {
            throw new Error('CSV parsing errors: ' + results.errors.map(e => e.message).join(', '));
        }
        
        const rows = results.data;
        updateImportProgress(40, 'Validating data...');
        
        // Validate and process data
        const { validItems, invalidItems } = await validateStockData(rows);
        
        updateImportProgress(60, 'Importing to database...');
        
        // Import valid items to database
        const importResult = await importStockItems(validItems, file.name);
        
        updateImportProgress(100, 'Import completed!');
        
        // Hide progress and show results
        setTimeout(() => {
            progressSection.classList.add('hidden');
            showImportResults(importResult, invalidItems);
            
            // Reload data
            loadStockData();
        }, 1000);
        
    } catch (error) {
        console.error('Error processing CSV:', error);
        progressSection.classList.add('hidden');
        showStockToast('Error importing CSV: ' + error.message, 'error');
    }
}

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

async function validateStockData(rows) {
    const validItems = [];
    const invalidItems = [];
    
    // Expected columns: Sl. No., PO No, Batch No., Inward Date, Device Model No., Device Registration Number, Device IMEI
    const requiredColumns = ['Device Model No.', 'Device Registration Number', 'Device IMEI'];
    
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
            validItems.push({
                sl_no: row['Sl. No.'] || '',
                po_no: row['PO No'] || '',
                batch_no: row['Batch No.'] || '',
                inward_date: row['Inward Date'] || new Date().toISOString().split('T')[0],
                device_model_no: row['Device Model No.'].trim(),
                device_registration_number: row['Device Registration Number'].trim(),
                device_imei: row['Device IMEI'].replace(/\s+/g, ''),
                status: 'available',
                device_condition: 'good',
                created_at: new Date().toISOString()
            });
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

async function importStockItems(items, fileName) {
    try {
        // Import items in batches
        const batchSize = 100;
        let importedCount = 0;
        let failedCount = 0;
        const errors = [];
        
        for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize);
            
            try {
                const { data, error } = await supabase
                    .from('stock')
                    .insert(batch)
                    .select();
                
                if (error) throw error;
                
                importedCount += batch.length;
            } catch (error) {
                console.error('Error importing batch:', error);
                failedCount += batch.length;
                errors.push(error.message);
            }
        }
        
        // Save import history
        const historyRecord = {
            file_name: fileName,
            total_rows: items.length,
            imported_count: importedCount,
            failed_count: failedCount,
            status: failedCount === 0 ? 'completed' : 'partial',
            error_details: errors.length > 0 ? errors.join('; ') : null,
            created_at: new Date().toISOString()
        };
        
        await supabase
            .from('import_history')
            .insert([historyRecord]);
        
        return {
            total: items.length,
            imported: importedCount,
            failed: failedCount,
            errors: errors
        };
        
    } catch (error) {
        console.error('Error importing stock items:', error);
        throw error;
    }
}

function updateImportProgress(percentage, message) {
    const progressBar = document.getElementById('importProgressBar');
    const progressText = document.getElementById('importProgressText');
    
    if (progressBar) {
        progressBar.style.width = percentage + '%';
    }
    
    if (progressText) {
        progressText.textContent = message || `${percentage}%`;
    }
}

function showImportResults(result, invalidItems) {
    const resultsSection = document.getElementById('importResults');
    
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
    
    showStockToast(`Import completed: ${result.imported} items imported successfully`, 'success');
}

// Search and filter functions
function handleStockSearch() {
    const searchQuery = document.getElementById('stockSearchInput').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;
    
    filteredStockItems = stockItems.filter(item => {
        const matchesSearch = !searchQuery || 
            item.device_registration_number.toLowerCase().includes(searchQuery) ||
            item.device_imei.toLowerCase().includes(searchQuery) ||
            item.device_model_no.toLowerCase().includes(searchQuery) ||
            (item.batch_no && item.batch_no.toLowerCase().includes(searchQuery));
        
        const matchesStatus = !statusFilter || item.status === statusFilter;
        
        return matchesSearch && matchesStatus;
    });
    
    updateStockTable();
}

function clearStockSearch() {
    document.getElementById('stockSearchInput').value = '';
    document.getElementById('statusFilter').value = '';
    filteredStockItems = [...stockItems];
    updateStockTable();
}

// Stock item details
async function viewStockItemDetails(itemId) {
    try {
        const item = stockItems.find(s => s.id === itemId);
        if (!item) return;
        
        // Check if item is allocated to any customer
        const { data: allocationData } = await supabase
            .from('inventory')
            .select('*, customers(customer_name)')
            .eq('device_registration_number', item.device_registration_number)
            .eq('type', 'outward')
            .order('created_at', { ascending: false })
            .limit(1);
        
        const allocation = allocationData?.[0];
        
        const modal = document.getElementById('deviceDetailsModal');
        const content = document.getElementById('deviceDetailsContent');
        
        let html = `
            <div class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="text-body-s-semibold dark:text-dark-base-500">Registration Number</label>
                        <div class="text-body-m-regular dark:text-dark-base-600">${item.device_registration_number}</div>
                    </div>
                    <div>
                        <label class="text-body-s-semibold dark:text-dark-base-500">IMEI</label>
                        <div class="text-body-m-regular dark:text-dark-base-600">${item.device_imei}</div>
                    </div>
                    <div>
                        <label class="text-body-s-semibold dark:text-dark-base-500">Model</label>
                        <div class="text-body-m-regular dark:text-dark-base-600">${item.device_model_no}</div>
                    </div>
                    <div>
                        <label class="text-body-s-semibold dark:text-dark-base-500">Status</label>
                        <div class="text-body-m-regular dark:text-dark-base-600">${item.status}</div>
                    </div>
                    <div>
                        <label class="text-body-s-semibold dark:text-dark-base-500">Condition</label>
                        <div class="text-body-m-regular dark:text-dark-base-600">${item.device_condition || 'good'}</div>
                    </div>
                    <div>
                        <label class="text-body-s-semibold dark:text-dark-base-500">Batch No.</label>
                        <div class="text-body-m-regular dark:text-dark-base-600">${item.batch_no || 'N/A'}</div>
                    </div>
                    <div>
                        <label class="text-body-s-semibold dark:text-dark-base-500">Inward Date</label>
                        <div class="text-body-m-regular dark:text-dark-base-600">${formatDate(item.inward_date)}</div>
                    </div>
                    <div>
                        <label class="text-body-s-semibold dark:text-dark-base-500">Serial No.</label>
                        <div class="text-body-m-regular dark:text-dark-base-600">${item.sl_no || 'N/A'}</div>
                    </div>
                </div>
        `;
        
        if (allocation) {
            html += `
                <div class="mt-6 p-4 rounded-lg dark:bg-dark-warning-600/20 dark:border dark:border-dark-warning-600">
                    <h4 class="text-heading-7 dark:text-dark-warning-600 mb-2">Current Allocation</h4>
                    <div class="grid grid-cols-2 gap-4 text-body-s-regular">
                        <div>
                            <span class="dark:text-dark-base-500">Customer:</span>
                            <span class="dark:text-dark-base-600 ml-2">${allocation.customer_name || 'N/A'}</span>
                        </div>
                        <div>
                            <span class="dark:text-dark-base-500">Location:</span>
                            <span class="dark:text-dark-base-600 ml-2">${allocation.location || 'N/A'}</span>
                        </div>
                        <div>
                            <span class="dark:text-dark-base-500">Outward Date:</span>
                            <span class="dark:text-dark-base-600 ml-2">${formatDate(allocation.outward_date)}</span>
                        </div>
                        <div>
                            <span class="dark:text-dark-base-500">SIM No:</span>
                            <span class="dark:text-dark-base-600 ml-2">${allocation.sim_no || 'N/A'}</span>
                        </div>
                    </div>
                </div>
            `;
        }
        
        html += '</div>';
        
        content.innerHTML = html;
        modal.classList.remove('hidden');
        
    } catch (error) {
        console.error('Error loading device details:', error);
        showStockToast('Error loading device details', 'error');
    }
}

function closeDeviceDetailsModal() {
    document.getElementById('deviceDetailsModal').classList.add('hidden');
}

// Helper functions
function getStockStatusClass(status) {
    switch (status) {
        case 'available':
            return 'dark:bg-dark-success-600/20 dark:text-dark-success-600';
        case 'allocated':
            return 'dark:bg-dark-warning-600/20 dark:text-dark-warning-600';
        case 'returned':
            return 'dark:bg-dark-base-500/20 dark:text-dark-base-500';
        default:
            return 'dark:bg-dark-base-500/20 dark:text-dark-base-500';
    }
}

function getConditionClass(condition) {
    switch (condition) {
        case 'good':
            return 'dark:bg-dark-success-600/20 dark:text-dark-success-600';
        case 'fair':
            return 'dark:bg-dark-warning-600/20 dark:text-dark-warning-600';
        case 'poor':
            return 'dark:bg-dark-semantic-danger-300/20 dark:text-dark-semantic-danger-300';
        default:
            return 'dark:bg-dark-success-600/20 dark:text-dark-success-600';
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
function showStockLoadingOverlay() {
    document.getElementById('stockLoadingOverlay').classList.remove('hidden');
}

function hideStockLoadingOverlay() {
    document.getElementById('stockLoadingOverlay').classList.add('hidden');
}

// Toast notification functions
function showStockToast(message, type = 'success') {
    const toast = document.getElementById('stockToast');
    const icon = document.getElementById('stockToastIcon');
    const messageEl = document.getElementById('stockToastMessage');
    
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
    
    icon.innerHTML = iconSVG;
    
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
window.goBackToDashboard = goBackToDashboard;
window.goToInventoryManagement = goToInventoryManagement;
window.clearStockSearch = clearStockSearch;
window.viewStockItemDetails = viewStockItemDetails;
window.closeDeviceDetailsModal = closeDeviceDetailsModal;
