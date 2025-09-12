// Inventory Management Functions
let inwardDevices = [];
let outwardDevices = [];
let currentInventoryFilter = '';
let currentInventoryTab = 'stock';

// Initialize inventory management when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Add inventory form event listeners
    if (document.getElementById('addInwardForm')) {
        document.getElementById('addInwardForm').addEventListener('submit', handleAddInward);
    }
    
    if (document.getElementById('addOutwardForm')) {
        document.getElementById('addOutwardForm').addEventListener('submit', handleAddOutward);
    }

    // Add inventory search listener
    if (document.getElementById('inventorySearchInput')) {
        document.getElementById('inventorySearchInput').addEventListener('input', handleInventorySearch);
    }
    
    // Load inventory data
    loadInventoryData();
});

// Load all inventory data
async function loadInventoryData() {
    try {
        // Load stock data (handled by stock.js)
        if (window.stockFunctions) {
            await window.stockFunctions.loadStockData();
        }
        
        // Load inward devices
        const { data: inwardData, error: inwardError } = await supabase
            .from('inventory_inward')
            .select('*')
            .eq('status', 'active')
            .order('created_at', { ascending: false });

        if (inwardError) {
            console.error('Error loading inward data:', inwardError);
        } else {
            inwardDevices = inwardData || [];
        }

        // Load outward devices
        const { data: outwardData, error: outwardError } = await supabase
            .from('inventory_outward')
            .select('*')
            .eq('status', 'active')
            .order('created_at', { ascending: false });

        if (outwardError) {
            console.error('Error loading outward data:', outwardError);
        } else {
            outwardDevices = outwardData || [];
        }

        // Update displays
        updateInventoryCounts();
        updateInventoryDisplay();
        
        console.log(`📦 Loaded inventory: ${inwardDevices.length} inward, ${outwardDevices.length} outward`);
    } catch (error) {
        console.error('Error loading inventory data:', error);
    }
}

// Update inventory counts in header and tabs
function updateInventoryCounts() {
    // Update header counts
    const totalStockEl = document.getElementById('totalStockCount');
    const totalInwardEl = document.getElementById('totalInwardCount');
    const totalOutwardEl = document.getElementById('totalOutwardCount');
    
    if (totalStockEl) totalStockEl.textContent = stockDevices?.length || 0;
    if (totalInwardEl) totalInwardEl.textContent = inwardDevices.length;
    if (totalOutwardEl) totalOutwardEl.textContent = outwardDevices.length;

    // Update tab counts
    const stockTabCountEl = document.getElementById('stockTabCount');
    const inwardTabCountEl = document.getElementById('inwardTabCount');
    const outwardTabCountEl = document.getElementById('outwardTabCount');
    
    if (stockTabCountEl) stockTabCountEl.textContent = stockDevices?.length || 0;
    if (inwardTabCountEl) inwardTabCountEl.textContent = inwardDevices.length;
    if (outwardTabCountEl) outwardTabCountEl.textContent = outwardDevices.length;
}

// Update inventory display based on current tab
function updateInventoryDisplay() {
    updateInventoryCounts();
    
    if (currentInventoryTab === 'stock') {
        if (window.stockFunctions) {
            window.stockFunctions.updateStockDisplay();
        }
    } else if (currentInventoryTab === 'inward') {
        updateInwardDisplay();
    } else if (currentInventoryTab === 'outward') {
        updateOutwardDisplay();
    }
}

// Show inventory tabs
function showStockTab() {
    hideAllInventoryTabs();
    document.getElementById('stockTabContent').classList.remove('hidden');
    updateInventoryTabHighlight('stockTab');
    currentInventoryTab = 'stock';
    if (window.stockFunctions) {
        window.stockFunctions.updateStockDisplay();
    }
}

function showInwardTab() {
    hideAllInventoryTabs();
    document.getElementById('inwardTabContent').classList.remove('hidden');
    updateInventoryTabHighlight('inwardTab');
    currentInventoryTab = 'inward';
    updateInwardDisplay();
}

function showOutwardTab() {
    hideAllInventoryTabs();
    document.getElementById('outwardTabContent').classList.remove('hidden');
    updateInventoryTabHighlight('outwardTab');
    currentInventoryTab = 'outward';
    updateOutwardDisplay();
}

function hideAllInventoryTabs() {
    document.getElementById('stockTabContent').classList.add('hidden');
    document.getElementById('inwardTabContent').classList.add('hidden');
    document.getElementById('outwardTabContent').classList.add('hidden');
}

function updateInventoryTabHighlight(activeTabId) {
    document.querySelectorAll('.inventory-tab-button').forEach(tab => {
        tab.classList.remove('active');
    });
    
    const activeTab = document.getElementById(activeTabId);
    if (activeTab) {
        activeTab.classList.add('active');
    }
}

// Update inward display
function updateInwardDisplay() {
    const inwardList = document.getElementById('inwardList');
    const inwardEmpty = document.getElementById('inwardEmptyState');
    
    if (!inwardList || !inwardEmpty) return;

    // Apply search filter
    const filteredInward = currentInventoryFilter ? 
        inwardDevices.filter(device => 
            device.device_id.toLowerCase().includes(currentInventoryFilter) ||
            device.device_model.toLowerCase().includes(currentInventoryFilter) ||
            device.device_condition.toLowerCase().includes(currentInventoryFilter) ||
            (device.notes && device.notes.toLowerCase().includes(currentInventoryFilter))
        ) : inwardDevices;

    if (filteredInward.length === 0) {
        inwardList.innerHTML = '';
        inwardEmpty.style.display = 'block';
    } else {
        inwardEmpty.style.display = 'none';
        inwardList.innerHTML = filteredInward.map(device => createInwardDeviceCard(device)).join('');
    }
}

// Update outward display
function updateOutwardDisplay() {
    const outwardList = document.getElementById('outwardList');
    const outwardEmpty = document.getElementById('outwardEmptyState');
    
    if (!outwardList || !outwardEmpty) return;

    // Apply search filter
    const filteredOutward = currentInventoryFilter ? 
        outwardDevices.filter(device => 
            device.device_id.toLowerCase().includes(currentInventoryFilter) ||
            device.device_model.toLowerCase().includes(currentInventoryFilter) ||
            device.destination.toLowerCase().includes(currentInventoryFilter) ||
            (device.notes && device.notes.toLowerCase().includes(currentInventoryFilter))
        ) : outwardDevices;

    if (filteredOutward.length === 0) {
        outwardList.innerHTML = '';
        outwardEmpty.style.display = 'block';
    } else {
        outwardEmpty.style.display = 'none';
        outwardList.innerHTML = filteredOutward.map(device => createOutwardDeviceCard(device)).join('');
    }
}

// Create inward device card HTML
function createInwardDeviceCard(device) {
    const formatDate = (dateString) => {
        if (!dateString) return 'Not set';
        return new Date(dateString).toLocaleDateString();
    };

    const getConditionBadge = (condition) => {
        const conditionClasses = {
            'Good': 'dark:bg-dark-success-600',
            'Lense issue': 'dark:bg-dark-warning-600',
            'SIM module fail': 'dark:bg-dark-semantic-danger-300',
            'Auto restart': 'dark:bg-dark-warning-600',
            'Device tampered': 'dark:bg-dark-semantic-danger-300'
        };
        
        return `<span class="px-2 py-1 text-xs rounded-full ${conditionClasses[condition] || 'dark:bg-dark-stroke-base-400'} dark:text-utility-white">${condition}</span>`;
    };

    const isNewDevice = device.notes && device.notes.includes('New Device');

    return `
        <div class="inward-card p-4 rounded-lg dark:bg-dark-fill-base-300 dark:border dark:border-dark-stroke-contrast-400 ${isNewDevice ? 'border-green-500' : ''}">
            <div class="flex justify-between items-start mb-3">
                <div>
                    <div class="flex items-center gap-2">
                        <h4 class="text-body-l-semibold dark:text-dark-base-600">${device.device_id}</h4>
                        ${isNewDevice ? '<span class="px-2 py-1 text-xs rounded-full dark:bg-dark-success-600 dark:text-utility-white">🆕 New Device</span>' : ''}
                    </div>
                    <p class="text-body-m-regular dark:text-dark-base-500">${device.device_model}</p>
                </div>
                <div class="flex flex-col gap-2 items-end">
                    ${getConditionBadge(device.device_condition)}
                </div>
            </div>
            <div class="grid grid-cols-2 gap-4 text-body-s-regular dark:text-dark-base-500">
                <div>
                    <span class="font-semibold">SIM:</span> ${device.sim_number || 'N/A'}
                </div>
                <div>
                    <span class="font-semibold">IMEI:</span> ${device.imei_number || 'N/A'}
                </div>
                <div>
                    <span class="font-semibold">Received:</span> ${formatDate(device.created_at)}
                </div>
                <div>
                    <span class="font-semibold">Notes:</span> ${device.notes || 'N/A'}
                </div>
            </div>
            <div class="mt-3 flex gap-2">
                <button onclick="moveToOutward('${device.device_id}')" class="px-3 py-1 text-xs rounded-lg dark:bg-brand-blue-600 dark:text-utility-white hover:dark:bg-brand-blue-500">
                    Move to Outward
                </button>
                <button onclick="removeFromInward('${device.device_id}')" class="px-3 py-1 text-xs rounded-lg dark:bg-dark-semantic-danger-300 dark:text-utility-white hover:dark:bg-dark-semantic-danger-300/90">
                    Remove
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

    return `
        <div class="outward-card p-4 rounded-lg dark:bg-dark-fill-base-300 dark:border dark:border-dark-stroke-contrast-400">
            <div class="flex justify-between items-start mb-3">
                <div>
                    <h4 class="text-body-l-semibold dark:text-dark-base-600">${device.device_id}</h4>
                    <p class="text-body-m-regular dark:text-dark-base-500">${device.device_model}</p>
                </div>
                <div class="flex flex-col gap-2 items-end">
                    <span class="px-2 py-1 text-xs rounded-full dark:bg-dark-info-600 dark:text-utility-white">Outward</span>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-4 text-body-s-regular dark:text-dark-base-500">
                <div>
                    <span class="font-semibold">Destination:</span> ${device.destination}
                </div>
                <div>
                    <span class="font-semibold">SIM:</span> ${device.sim_number || 'N/A'}
                </div>
                <div>
                    <span class="font-semibold">Sent:</span> ${formatDate(device.created_at)}
                </div>
                <div>
                    <span class="font-semibold">Notes:</span> ${device.notes || 'N/A'}
                </div>
            </div>
            <div class="mt-3 flex gap-2">
                <button onclick="returnToInward('${device.device_id}')" class="px-3 py-1 text-xs rounded-lg dark:bg-dark-success-600 dark:text-utility-white hover:dark:bg-dark-success-600/90">
                    Return to Inward
                </button>
                <button onclick="removeFromOutward('${device.device_id}')" class="px-3 py-1 text-xs rounded-lg dark:bg-dark-semantic-danger-300 dark:text-utility-white hover:dark:bg-dark-semantic-danger-300/90">
                    Remove
                </button>
            </div>
        </div>
    `;
}

// Show add inward form modal
function showAddInwardForm() {
    document.getElementById('addInwardModal').classList.remove('hidden');
}

// Close add inward form modal
function closeAddInwardForm() {
    document.getElementById('addInwardModal').classList.add('hidden');
    document.getElementById('addInwardForm').reset();
}

// Handle add inward form submission
async function handleAddInward(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const deviceId = formData.get('deviceId');
    const deviceCondition = formData.get('deviceCondition');
    const notes = formData.get('notes');

    try {
        // Check if device exists in stock
        const { data: stockDevice, error: stockError } = await supabase
            .from('inventory_stock')
            .select('*')
            .eq('device_id', deviceId)
            .single();

        if (!stockDevice) {
            alert('Device not found in stock database! Please add to stock first.');
            return;
        }

        // Check if device already in inward
        const { data: existingInward, error: checkError } = await supabase
            .from('inventory_inward')
            .select('*')
            .eq('device_id', deviceId)
            .eq('status', 'active')
            .single();

        if (existingInward) {
            alert('Device already in inward!');
            return;
        }

        // Remove from outward if it exists there
        await supabase
            .from('inventory_outward')
            .update({ status: 'inactive' })
            .eq('device_id', deviceId);

        // Add to inward
        const inwardData = {
            device_id: stockDevice.device_id,
            device_model: stockDevice.device_model,
            sim_number: stockDevice.sim_number,
            imei_number: stockDevice.imei_number,
            device_condition: deviceCondition,
            notes: notes || null,
            status: 'active',
            created_at: new Date().toISOString(),
            created_by: userSession?.email || 'admin'
        };

        const { error } = await supabase
            .from('inventory_inward')
            .insert([inwardData]);

        if (error) {
            console.error('Error adding to inward:', error);
            alert('Error adding device to inward: ' + error.message);
            return;
        }

        alert(`Device ${deviceId} added to inward successfully!`);
        closeAddInwardForm();
        loadInventoryData();
        showEmailToast(`Device ${deviceId} added to inward`);
        
    } catch (error) {
        console.error('Error adding inward device:', error);
        alert('Error adding device to inward');
    }
}

// Show add outward form modal
function showAddOutwardForm() {
    document.getElementById('addOutwardModal').classList.remove('hidden');
}

// Close add outward form modal
function closeAddOutwardForm() {
    document.getElementById('addOutwardModal').classList.add('hidden');
    document.getElementById('addOutwardForm').reset();
}

// Handle add outward form submission
async function handleAddOutward(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const deviceId = formData.get('deviceId');
    const destination = formData.get('destination');
    const notes = formData.get('notes');

    try {
        // Check if device exists in inward
        const { data: inwardDevice, error: inwardError } = await supabase
            .from('inventory_inward')
            .select('*')
            .eq('device_id', deviceId)
            .eq('status', 'active')
            .single();

        if (!inwardDevice) {
            alert('Device not found in inward! Please add to inward first.');
            return;
        }

        // Remove from inward
        await supabase
            .from('inventory_inward')
            .update({ status: 'inactive' })
            .eq('device_id', deviceId);

        // Add to outward
        const outwardData = {
            device_id: inwardDevice.device_id,
            device_model: inwardDevice.device_model,
            sim_number: inwardDevice.sim_number,
            imei_number: inwardDevice.imei_number,
            destination: destination,
            notes: notes || null,
            status: 'active',
            created_at: new Date().toISOString(),
            created_by: userSession?.email || 'admin'
        };

        const { error } = await supabase
            .from('inventory_outward')
            .insert([outwardData]);

        if (error) {
            console.error('Error adding to outward:', error);
            alert('Error moving device to outward: ' + error.message);
            return;
        }

        alert(`Device ${deviceId} moved to outward successfully!`);
        closeAddOutwardForm();
        loadInventoryData();
        showEmailToast(`Device ${deviceId} moved to outward`);
        
    } catch (error) {
        console.error('Error moving device to outward:', error);
        alert('Error moving device to outward');
    }
}

// Move device to outward from inward card
async function moveToOutward(deviceId) {
    const destination = prompt('Enter destination/customer name:');
    if (!destination) return;

    try {
        // Get device from inward
        const device = inwardDevices.find(d => d.device_id === deviceId);
        if (!device) {
            alert('Device not found in inward!');
            return;
        }

        // Remove from inward
        await supabase
            .from('inventory_inward')
            .update({ status: 'inactive' })
            .eq('device_id', deviceId);

        // Add to outward
        const outwardData = {
            device_id: device.device_id,
            device_model: device.device_model,
            sim_number: device.sim_number,
            imei_number: device.imei_number,
            destination: destination,
            notes: `Moved from inward`,
            status: 'active',
            created_at: new Date().toISOString(),
            created_by: userSession?.email || 'admin'
        };

        const { error } = await supabase
            .from('inventory_outward')
            .insert([outwardData]);

        if (error) {
            console.error('Error moving to outward:', error);
            alert('Error moving device to outward: ' + error.message);
            return;
        }

        alert(`Device ${deviceId} moved to outward successfully!`);
        loadInventoryData();
        showEmailToast(`Device ${deviceId} moved to outward`);
        
    } catch (error) {
        console.error('Error moving to outward:', error);
        alert('Error moving device to outward');
    }
}

// Return device to inward from outward card
async function returnToInward(deviceId) {
    const condition = prompt('Enter device condition:\n1. Good\n2. Lense issue\n3. SIM module fail\n4. Auto restart\n5. Device tampered', 'Good');
    if (!condition) return;

    const validConditions = ['Good', 'Lense issue', 'SIM module fail', 'Auto restart', 'Device tampered'];
    if (!validConditions.includes(condition)) {
        alert('Invalid condition! Please enter one of: Good, Lense issue, SIM module fail, Auto restart, Device tampered');
        return;
    }

    try {
        // Get device from outward
        const device = outwardDevices.find(d => d.device_id === deviceId);
        if (!device) {
            alert('Device not found in outward!');
            return;
        }

        // Remove from outward
        await supabase
            .from('inventory_outward')
            .update({ status: 'inactive' })
            .eq('device_id', deviceId);

        // Add back to inward
        const inwardData = {
            device_id: device.device_id,
            device_model: device.device_model,
            sim_number: device.sim_number,
            imei_number: device.imei_number,
            device_condition: condition,
            notes: `Returned from outward (${device.destination})`,
            status: 'active',
            created_at: new Date().toISOString(),
            created_by: userSession?.email || 'admin'
        };

        const { error } = await supabase
            .from('inventory_inward')
            .insert([inwardData]);

        if (error) {
            console.error('Error returning to inward:', error);
            alert('Error returning device to inward: ' + error.message);
            return;
        }

        alert(`Device ${deviceId} returned to inward successfully!`);
        loadInventoryData();
        showEmailToast(`Device ${deviceId} returned to inward`);
        
    } catch (error) {
        console.error('Error returning to inward:', error);
        alert('Error returning device to inward');
    }
}

// Remove device from inward
async function removeFromInward(deviceId) {
    if (!confirm(`Are you sure you want to remove device "${deviceId}" from inward?`)) {
        return;
    }

    try {
        const { error } = await supabase
            .from('inventory_inward')
            .update({ status: 'inactive' })
            .eq('device_id', deviceId);

        if (error) {
            console.error('Error removing from inward:', error);
            alert('Error removing device from inward: ' + error.message);
            return;
        }

        alert(`Device ${deviceId} removed from inward successfully!`);
        loadInventoryData();
        showEmailToast(`Device ${deviceId} removed from inward`);
        
    } catch (error) {
        console.error('Error removing from inward:', error);
        alert('Error removing device from inward');
    }
}

// Remove device from outward
async function removeFromOutward(deviceId) {
    if (!confirm(`Are you sure you want to remove device "${deviceId}" from outward?`)) {
        return;
    }

    try {
        const { error } = await supabase
            .from('inventory_outward')
            .update({ status: 'inactive' })
            .eq('device_id', deviceId);

        if (error) {
            console.error('Error removing from outward:', error);
            alert('Error removing device from outward: ' + error.message);
            return;
        }

        alert(`Device ${deviceId} removed from outward successfully!`);
        loadInventoryData();
        showEmailToast(`Device ${deviceId} removed from outward`);
        
    } catch (error) {
        console.error('Error removing from outward:', error);
        alert('Error removing device from outward');
    }
}

// Handle inventory search
function handleInventorySearch(e) {
    currentInventoryFilter = e.target.value.toLowerCase().trim();
    updateInventoryDisplay();
}

// Clear inventory search
function clearInventorySearch() {
    document.getElementById('inventorySearchInput').value = '';
    currentInventoryFilter = '';
    updateInventoryDisplay();
    showEmailToast('Search cleared - showing all devices');
}

// Bulk upload functions for inward
function showBulkInwardUpload() {
    document.getElementById('bulkInwardUploadModal').classList.remove('hidden');
}

function closeBulkInwardUpload() {
    document.getElementById('bulkInwardUploadModal').classList.add('hidden');
    document.getElementById('inwardCsvFile').value = '';
    document.getElementById('inwardUploadResults').classList.add('hidden');
}

async function processBulkInwardUpload() {
    const fileInput = document.getElementById('inwardCsvFile');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('Please select a CSV file');
        return;
    }

    const reader = new FileReader();
    reader.onload = async function(e) {
        const csv = e.target.result;
        await processBulkInwardCsv(csv);
    };
    reader.readAsText(file);
}

async function processBulkInwardCsv(csvData) {
    const lines = csvData.trim().split('\n');
    const devices = [];
    const errors = [];
    let successCount = 0;
    let skipCount = 0;

    // Skip header if present
    const dataLines = lines[0].toLowerCase().includes('device_id') ? lines.slice(1) : lines;

    for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i].trim();
        if (!line) continue;

        const [deviceId, deviceCondition, notes] = line.split(',').map(item => item.trim());
        
        if (!deviceId || !deviceCondition) {
            errors.push(`Line ${i + 1}: Missing required fields (device_id, device_condition)`);
            continue;
        }

        const validConditions = ['Good', 'Lense issue', 'SIM module fail', 'Auto restart', 'Device tampered'];
        if (!validConditions.includes(deviceCondition)) {
            errors.push(`Line ${i + 1}: Invalid condition "${deviceCondition}"`);
            continue;
        }

        try {
            // Check if device exists in stock
            const { data: stockDevice } = await supabase
                .from('inventory_stock')
                .select('*')
                .eq('device_id', deviceId)
                .single();

            if (!stockDevice) {
                errors.push(`Line ${i + 1}: Device ${deviceId} not found in stock`);
                skipCount++;
                continue;
            }

            // Check if already in inward
            const { data: existingInward } = await supabase
                .from('inventory_inward')
                .select('*')
                .eq('device_id', deviceId)
                .eq('status', 'active')
                .single();

            if (existingInward) {
                errors.push(`Line ${i + 1}: Device ${deviceId} already in inward`);
                skipCount++;
                continue;
            }

            const deviceData = {
                device_id: stockDevice.device_id,
                device_model: stockDevice.device_model,
                sim_number: stockDevice.sim_number,
                imei_number: stockDevice.imei_number,
                device_condition: deviceCondition,
                notes: notes || 'Bulk Upload',
                status: 'active',
                created_at: new Date().toISOString(),
                created_by: userSession?.email || 'admin'
            };

            devices.push(deviceData);
            
            // Remove from outward if exists
            await supabase
                .from('inventory_outward')
                .update({ status: 'inactive' })
                .eq('device_id', deviceId);

        } catch (error) {
            errors.push(`Line ${i + 1}: Error processing device ${deviceId}`);
        }
    }

    if (devices.length === 0) {
        showBulkInwardUploadResults(0, 0, errors);
        return;
    }

    try {
        // Insert all valid devices
        const { error } = await supabase
            .from('inventory_inward')
            .insert(devices);

        if (error) {
            console.error('Error bulk inserting inward:', error);
            errors.push('Database error during bulk insert');
        } else {
            successCount = devices.length;
        }
    } catch (error) {
        console.error('Error processing bulk inward upload:', error);
        errors.push('Unexpected error during upload');
    }

    // Show results
    showBulkInwardUploadResults(successCount, skipCount, errors);
    
    // Reload data
    loadInventoryData();
}

function showBulkInwardUploadResults(successCount, skipCount, errors) {
    const resultsDiv = document.getElementById('inwardUploadResults');
    const summaryDiv = document.getElementById('inwardUploadSummary');
    const errorsDiv = document.getElementById('inwardUploadErrors');
    
    if (!resultsDiv || !summaryDiv || !errorsDiv) return;

    summaryDiv.innerHTML = `
        <p class="text-body-m-regular dark:text-dark-success-600">✅ Successfully processed: ${successCount} devices</p>
        ${skipCount > 0 ? `<p class="text-body-m-regular dark:text-dark-warning-600">⚠️ Skipped: ${skipCount} devices</p>` : ''}
        ${errors.length > 0 ? `<p class="text-body-m-regular dark:text-dark-semantic-danger-300">❌ Errors: ${errors.length}</p>` : ''}
    `;

    if (errors.length > 0) {
        errorsDiv.innerHTML = `
            <div class="mt-2 p-3 rounded-lg dark:bg-dark-semantic-danger-300/20">
                <h5 class="text-body-m-semibold dark:text-dark-semantic-danger-300 mb-2">Errors:</h5>
                <ul class="text-body-s-regular dark:text-dark-semantic-danger-300 space-y-1">
                    ${errors.map(error => `<li>• ${error}</li>`).join('')}
                </ul>
            </div>
        `;
    } else {
        errorsDiv.innerHTML = '';
    }

    resultsDiv.classList.remove('hidden');
    
    if (successCount > 0) {
        showEmailToast(`Bulk upload completed: ${successCount} devices added to inward`);
    }
}

// Bulk upload functions for outward
function showBulkOutwardUpload() {
    document.getElementById('bulkOutwardUploadModal').classList.remove('hidden');
}

function closeBulkOutwardUpload() {
    document.getElementById('bulkOutwardUploadModal').classList.add('hidden');
    document.getElementById('outwardCsvFile').value = '';
    document.getElementById('outwardUploadResults').classList.add('hidden');
}

async function processBulkOutwardUpload() {
    const fileInput = document.getElementById('outwardCsvFile');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('Please select a CSV file');
        return;
    }

    const reader = new FileReader();
    reader.onload = async function(e) {
        const csv = e.target.result;
        await processBulkOutwardCsv(csv);
    };
    reader.readAsText(file);
}

async function processBulkOutwardCsv(csvData) {
    const lines = csvData.trim().split('\n');
    const devices = [];
    const errors = [];
    let successCount = 0;
    let skipCount = 0;

    // Skip header if present
    const dataLines = lines[0].toLowerCase().includes('device_id') ? lines.slice(1) : lines;

    for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i].trim();
        if (!line) continue;

        const [deviceId, destination, notes] = line.split(',').map(item => item.trim());
        
        if (!deviceId || !destination) {
            errors.push(`Line ${i + 1}: Missing required fields (device_id, destination)`);
            continue;
        }

        try {
            // Check if device exists in inward
            const { data: inwardDevice } = await supabase
                .from('inventory_inward')
                .select('*')
                .eq('device_id', deviceId)
                .eq('status', 'active')
                .single();

            if (!inwardDevice) {
                errors.push(`Line ${i + 1}: Device ${deviceId} not found in inward`);
                skipCount++;
                continue;
            }

            const deviceData = {
                device_id: inwardDevice.device_id,
                device_model: inwardDevice.device_model,
                sim_number: inwardDevice.sim_number,
                imei_number: inwardDevice.imei_number,
                destination: destination,
                notes: notes || 'Bulk Upload',
                status: 'active',
                created_at: new Date().toISOString(),
                created_by: userSession?.email || 'admin'
            };

            devices.push(deviceData);
            
            // Mark inward device as inactive
            await supabase
                .from('inventory_inward')
                .update({ status: 'inactive' })
                .eq('device_id', deviceId);

        } catch (error) {
            errors.push(`Line ${i + 1}: Error processing device ${deviceId}`);
        }
    }

    if (devices.length === 0) {
        showBulkOutwardUploadResults(0, 0, errors);
        return;
    }

    try {
        // Insert all valid devices
        const { error } = await supabase
            .from('inventory_outward')
            .insert(devices);

        if (error) {
            console.error('Error bulk inserting outward:', error);
            errors.push('Database error during bulk insert');
        } else {
            successCount = devices.length;
        }
    } catch (error) {
        console.error('Error processing bulk outward upload:', error);
        errors.push('Unexpected error during upload');
    }

    // Show results
    showBulkOutwardUploadResults(successCount, skipCount, errors);
    
    // Reload data
    loadInventoryData();
}

function showBulkOutwardUploadResults(successCount, skipCount, errors) {
    const resultsDiv = document.getElementById('outwardUploadResults');
    const summaryDiv = document.getElementById('outwardUploadSummary');
    const errorsDiv = document.getElementById('outwardUploadErrors');
    
    if (!resultsDiv || !summaryDiv || !errorsDiv) return;

    summaryDiv.innerHTML = `
        <p class="text-body-m-regular dark:text-dark-success-600">✅ Successfully processed: ${successCount} devices</p>
        ${skipCount > 0 ? `<p class="text-body-m-regular dark:text-dark-warning-600">⚠️ Skipped: ${skipCount} devices</p>` : ''}
        ${errors.length > 0 ? `<p class="text-body-m-regular dark:text-dark-semantic-danger-300">❌ Errors: ${errors.length}</p>` : ''}
    `;

    if (errors.length > 0) {
        errorsDiv.innerHTML = `
            <div class="mt-2 p-3 rounded-lg dark:bg-dark-semantic-danger-300/20">
                <h5 class="text-body-m-semibold dark:text-dark-semantic-danger-300 mb-2">Errors:</h5>
                <ul class="text-body-s-regular dark:text-dark-semantic-danger-300 space-y-1">
                    ${errors.map(error => `<li>• ${error}</li>`).join('')}
                </ul>
            </div>
        `;
    } else {
        errorsDiv.innerHTML = '';
    }

    resultsDiv.classList.remove('hidden');
    
    if (successCount > 0) {
        showEmailToast(`Bulk upload completed: ${successCount} devices moved to outward`);
    }
}

// Export functions for global access
window.loadInventoryData = loadInventoryData;
window.showStockTab = showStockTab;
window.showInwardTab = showInwardTab;
window.showOutwardTab = showOutwardTab;
window.showAddInwardForm = showAddInwardForm;
window.closeAddInwardForm = closeAddInwardForm;
window.showAddOutwardForm = showAddOutwardForm;
window.closeAddOutwardForm = closeAddOutwardForm;
window.clearInventorySearch = clearInventorySearch;
window.showBulkInwardUpload = showBulkInwardUpload;
window.closeBulkInwardUpload = closeBulkInwardUpload;
window.processBulkInwardUpload = processBulkInwardUpload;
window.showBulkOutwardUpload = showBulkOutwardUpload;
window.closeBulkOutwardUpload = closeBulkOutwardUpload;
window.processBulkOutwardUpload = processBulkOutwardUpload;
window.moveToOutward = moveToOutward;
window.returnToInward = returnToInward;
window.removeFromInward = removeFromInward;
window.removeFromOutward = removeFromOutward;
