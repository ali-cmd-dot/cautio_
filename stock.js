// Stock Management JavaScript
// This file handles CSV import and stock management functionality

// Supabase Configuration - Direct connection (no config.js needed)
function getSupabaseClient() {
    const SUPABASE_URL = 'https://jcmjazindwonrplvjwxl.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjbWphemluZHdvbnJwbHZqd3hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczMDEyNjMsImV4cCI6MjA3Mjg3NzI2M30.1B6sKnzrzdNFhvQUXVnRzzQnItFMaIFL0Y9WK_Gie9g';
    return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Use global supabase variable from main script

// Global variables for stock management
// Local stock variables (use global variables from main script when needed)
let localStockData = [];
let filteredStockData = [];
let importHistory = [];
let currentStockFilter = "";
// userSession is available globally from main script

// Required CSV columns
const REQUIRED_COLUMNS = [
    "Sl. No.",
    "PO No",
    "Batch No.",
    "Inward Date",
    "Device Model No.",
    "Device Registration Number",
    "Device IMEI",
];

// Initialize stock management
document.addEventListener("DOMContentLoaded", function () {
    // Initialize supabase client if not already done
    if (!window.supabaseClient || typeof window.supabaseClient.from !== 'function') {
        window.supabaseClient = getSupabaseClient();
    }
    if (!window.supabaseClient) {
        console.error("Failed to initialize Supabase client");
        return;
    }
    
    // Set global supabase variable
    if (typeof supabase === 'undefined') {
        supabase = window.supabaseClient;
    }

    // Get user session from localStorage
    checkStockUserSession();

    // Load initial data
    loadStockData();

    // Setup event listeners
    setupStockEventListeners();

    // Setup realtime listeners only if supabase.channel is available
    if (typeof supabase.channel === "function") {
        setupStockRealtimeListeners();
    } else {
        console.warn(
            "Realtime listeners not available - supabase.channel not found",
        );
    }
});

// Check user session for stock management
function checkStockUserSession() {
    const savedSession = localStorage.getItem("cautio_user_session");
    if (savedSession) {
        try {
            const sessionData = JSON.parse(savedSession);
            if (sessionData.expires > Date.now()) {
                userSession = sessionData.user;
            }
        } catch (error) {
            console.error("Error parsing session:", error);
        }
    }

    if (!userSession) {
        // Redirect to main dashboard login
        window.location.href = "./";
    }
}

// Navigation functions
function goBackToDashboard() {
    // Navigate back to main dashboard
    window.location.href = "./";
}

function goToInventoryManagement() {
    window.location.href = "./inventory.html";
}

// Setup event listeners for stock management
function setupStockEventListeners() {
    // CSV file input
    const csvFileInput = document.getElementById("csvFileInput");
    csvFileInput.addEventListener("change", handleCSVFileSelect);

    // Drag and drop for CSV import
    const csvImportArea = document.getElementById("csvImportArea");
    csvImportArea.addEventListener("dragover", handleDragOver);
    csvImportArea.addEventListener("dragleave", handleDragLeave);
    csvImportArea.addEventListener("drop", handleFileDrop);

    // Search functionality
    document
        .getElementById("stockSearchInput")
        .addEventListener("input", handleStockSearch);
    document
        .getElementById("statusFilter")
        .addEventListener("change", handleStockSearch);
}

// Setup realtime listeners for stock
function setupStockRealtimeListeners() {
    // Listen for stock changes
    supabase
        .channel("stock_changes")
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "stock" },
            (payload) => {
                console.log("Stock change received!", payload);
                loadStockData();
            },
        )
        .subscribe();

    // Listen for import log changes
    supabase
        .channel("import_log_changes")
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "csv_import_logs" },
            (payload) => {
                console.log("Import log change received!", payload);
                loadImportHistory();
            },
        )
        .subscribe();

    // NEW: Listen for inventory changes to update stock status
    supabase
        .channel("inventory_changes")
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "inward_devices" },
            (payload) => {
                console.log("Inward device change received!", payload);
                // Refresh stock data to show updated status
                setTimeout(loadStockData, 1000); // Small delay to ensure consistency
            },
        )
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "outward_devices" },
            (payload) => {
                console.log("Outward device change received!", payload);
                // Refresh stock data to show updated status
                setTimeout(loadStockData, 1000); // Small delay to ensure consistency
            },
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
        updateStockPageSummary();
        updateStockTable();
        updateImportHistoryList();

        hideStockLoadingOverlay();
    } catch (error) {
        console.error("Error loading stock data:", error);
        showStockToast("Error loading stock data", "error");
        hideStockLoadingOverlay();
    }
}

// Load stock items from database
async function loadStockItems() {
    try {
        const { data, error } = await supabase
            .from("stock")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Error loading stock items:", error);
            throw error;
        }

        localStockData = data || [];
        filteredStockData = [...localStockData];
        console.log(`Loaded ${localStockData.length} stock items`);
    } catch (error) {
        console.error("Error loading stock items:", error);
        throw error;
    }
}

// Load import history
async function loadImportHistory() {
    try {
        const { data, error } = await supabase
            .from("csv_import_logs")
            .select("*")
            .order("import_date", { ascending: false })
            .limit(10);

        if (error) {
            console.error("Error loading import history:", error);
            throw error;
        }

        importHistory = data || [];
        console.log(`Loaded ${importHistory.length} import history records`);
    } catch (error) {
        console.error("Error loading import history:", error);
        throw error;
    }
}

// Update stock summary display for stock page
function updateStockPageSummary() {
    const totalItems = localStockData.length;
    const availableItems = localStockData.filter(
        (item) => item.current_status === "available",
    ).length;
    const allocatedItems = localStockData.filter(
        (item) => item.current_status === "allocated",
    ).length;
    const uniqueModels = new Set(
        localStockData.map((item) => item.device_model_no),
    ).size;

    document.getElementById("totalStockItems").textContent = totalItems;
    document.getElementById("availableItems").textContent = availableItems;
    document.getElementById("allocatedItems").textContent = allocatedItems;
    document.getElementById("totalModels").textContent = uniqueModels;
}

// Update stock table
function updateStockTable() {
    const tableBody = document.getElementById("stockTableBody");
    const emptyState = document.getElementById("stockEmptyState");

    if (filteredStockData.length === 0) {
        tableBody.innerHTML = "";
        emptyState.classList.remove("hidden");
    } else {
        emptyState.classList.add("hidden");
        tableBody.innerHTML = filteredStockData
            .map((item) => createStockTableRow(item))
            .join("");
    }
}

// UPDATED: Create stock table row HTML with better inventory integration indicators
function createStockTableRow(item) {
    const formatDate = (dateString) => {
        if (!dateString) return "N/A";
        return new Date(dateString).toLocaleDateString();
    };

    const getStatusBadge = (status) => {
        let badgeClass, statusText, icon;

        switch (status) {
            case "available":
                badgeClass = "compact-badge status-available";
                statusText = "Available";
                icon = "â—";
                break;
            case "allocated":
                badgeClass = "compact-badge status-allocated";
                statusText = "Allocated";
                icon = "â—";
                break;
            default:
                badgeClass = "compact-badge status-allocated";
                statusText = status;
                icon = "â—";
        }

        return `<span class="${badgeClass}">${icon} ${statusText}</span>`;
    };

    const getConditionBadge = (condition) => {
        let badgeClass, conditionText;

        switch (condition) {
            case "new":
                badgeClass = "compact-badge condition-new";
                conditionText = "New Device";
                break;
            case "good":
                badgeClass = "compact-badge condition-good";
                conditionText = "Good";
                break;
            case "lense_issue":
                badgeClass = "compact-badge condition-lense_issue";
                conditionText = "Lense Issue";
                break;
            case "sim_module_fail":
                badgeClass = "compact-badge condition-sim_module_fail";
                conditionText = "SIM Module Fail";
                break;
            case "auto_restart":
                badgeClass = "compact-badge condition-auto_restart";
                conditionText = "Auto Restart";
                break;
            case "device_tampered":
                badgeClass = "compact-badge condition-device_tampered";
                conditionText = "Device Tampered";
                break;
            case "used":
                badgeClass = "compact-badge condition-used";
                conditionText = "Used";
                break;
            case "refurbished":
                badgeClass = "compact-badge condition-lense_issue";
                conditionText = "Refurbished";
                break;
            case "damaged":
                badgeClass = "compact-badge condition-device_tampered";
                conditionText = "Damaged";
                break;
            default:
                badgeClass = "compact-badge condition-good";
                conditionText = condition;
        }

        return `<span class="${badgeClass}">${conditionText}</span>`;
    };

    // NEW: Add inventory status indicator
    const getInventoryStatusBadge = (item) => {
        // This would be determined by checking if device exists in inward/outward
        // For now, we'll show a simple indicator based on status
        if (item.current_status === "available") {
            return `<span class="compact-badge status-available">ðŸ“¥ Ready</span>`;
        } else if (item.current_status === "allocated") {
            return `<span class="compact-badge status-allocated">ðŸ“¤ Out</span>`;
        } else {
            return `<span class="compact-badge condition-used">âšª Unknown</span>`;
        }
    };

    return `
        <tr>
            <td class="compact-text-secondary">${item.sl_no || "N/A"}</td>
            <td class="compact-text-primary font-mono">${item.device_registration_number}</td>
            <td class="compact-text-secondary font-mono">${item.device_imei}</td>
            <td class="compact-text-primary">${item.device_model_no}</td>
            <td>${getStatusBadge(item.current_status)}</td>
            <td>${getConditionBadge(item.device_condition)}</td>
            <td>${getInventoryStatusBadge(item)}</td>
            <td class="compact-text-secondary">${item.batch_no || "N/A"}</td>
            <td class="compact-text-secondary">${formatDate(item.inward_date)}</td>
            <td>
                <div class="flex gap-1">
                    <button onclick="viewStockDeviceDetails('${item.device_registration_number}')" class="compact-btn compact-btn-primary">
                        VIEW
                    </button>
                    <button onclick="editStockDevice('${item.id}')" class="compact-btn compact-btn-primary">
                        EDIT
                    </button>
                    <button onclick="manageInventory('${item.device_registration_number}')" class="compact-btn compact-btn-primary">
                        ðŸ“¦
                    </button>
                </div>
            </td>
        </tr>
    `;
}

// NEW: Manage inventory function - Quick link to inventory management
function manageInventory(deviceRegistrationNumber) {
    // Store device info in localStorage for inventory management
    localStorage.setItem("inventory_focus_device", deviceRegistrationNumber);
    // Redirect to inventory management
    window.location.href = "inventory.html";
}

// Handle drag over event
function handleDragOver(e) {
    e.preventDefault();
    document.getElementById("csvImportArea").classList.add("drag-over");
}

// Handle drag leave event
function handleDragLeave(e) {
    e.preventDefault();
    document.getElementById("csvImportArea").classList.remove("drag-over");
}

// Handle file drop event
function handleFileDrop(e) {
    e.preventDefault();
    document.getElementById("csvImportArea").classList.remove("drag-over");

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        if (file.type === "text/csv" || file.name.endsWith(".csv")) {
            processCSVFile(file);
        } else {
            showStockToast("Please select a valid CSV file", "error");
        }
    }
}

// Handle CSV file selection
function handleCSVFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        if (file.type === "text/csv" || file.name.endsWith(".csv")) {
            processCSVFile(file);
        } else {
            showStockToast("Please select a valid CSV file", "error");
        }
    }
}

// Process CSV file
function processCSVFile(file) {
    const reader = new FileReader();

    reader.onload = function (e) {
        const csv = e.target.result;

        // Parse CSV using PapaParse
        Papa.parse(csv, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true,
            transformHeader: function (header) {
                return header.trim(); // Remove whitespace from headers
            },
            complete: function (results) {
                validateAndImportCSV(results, file.name);
            },
            error: function (error) {
                console.error("CSV parsing error:", error);
                showStockToast("Error parsing CSV file", "error");
            },
        });
    };

    reader.onerror = function () {
        showStockToast("Error reading file", "error");
    };

    reader.readAsText(file);
}

// UPDATED: Validate and import CSV data with improved inventory integration
async function validateAndImportCSV(results, filename) {
    try {
        const data = results.data;
        const headers = Object.keys(data[0] || {});

        // Validate headers
        const missingColumns = REQUIRED_COLUMNS.filter(
            (col) => !headers.includes(col),
        );
        if (missingColumns.length > 0) {
            showStockToast(
                `Missing required columns: ${missingColumns.join(", ")}`,
                "error",
            );
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
            const deviceRegNumber = row["Device Registration Number"];
            const deviceImei = row["Device IMEI"];
            const deviceModel = row["Device Model No."];

            if (!deviceRegNumber || !deviceImei || !deviceModel) {
                errors.push(`Row ${i + 2}: Missing required data`);
                continue;
            }

            // Check for duplicates in current batch
            const duplicate = validData.find(
                (item) =>
                    item.device_registration_number === deviceRegNumber ||
                    item.device_imei === deviceImei,
            );

            if (duplicate) {
                errors.push(
                    `Row ${i + 2}: Duplicate device registration number or IMEI in CSV`,
                );
                continue;
            }

            // Parse inward date
            let inwardDate = null;
            if (row["Inward Date"]) {
                const dateStr = row["Inward Date"];
                if (typeof dateStr === "string") {
                    // Try to parse different date formats
                    const parsedDate = new Date(dateStr);
                    if (!isNaN(parsedDate.getTime())) {
                        inwardDate = parsedDate.toISOString().split("T")[0];
                    }
                } else if (dateStr instanceof Date) {
                    inwardDate = dateStr.toISOString().split("T")[0];
                }
            }

            // Create stock item - NEW: Set default condition as "new" for inventory integration
            const stockItem = {
                sl_no: row["Sl. No."] || null,
                po_no: row["PO No"] || null,
                batch_no: row["Batch No."] || null,
                inward_date: inwardDate,
                device_model_no: deviceModel,
                device_registration_number: deviceRegNumber,
                device_imei: deviceImei,
                current_status: "available",
                device_condition: "new", // NEW: Default condition for automatic inventory integration
                imported_by: userSession?.email || "unknown",
            };

            validData.push(stockItem);
        }

        // Check for existing devices in database
        const existingDevices = [];
        for (let i = 0; i < validData.length; i++) {
            updateImportProgress(50 + (i / validData.length) * 30); // 50-80% for database check

            const item = validData[i];
            const { data: existing, error } = await supabase
                .from("stock")
                .select("device_registration_number, device_imei")
                .or(
                    `device_registration_number.eq.${item.device_registration_number},device_imei.eq.${item.device_imei}`,
                );

            if (error) {
                console.error("Error checking existing devices:", error);
                continue;
            }

            if (existing && existing.length > 0) {
                existingDevices.push(item.device_registration_number);
                errors.push(
                    `Device ${item.device_registration_number} already exists in database`,
                );
            }
        }

        // Filter out existing devices
        const newDevices = validData.filter(
            (item) =>
                !existingDevices.includes(item.device_registration_number),
        );

        // Import valid data
        let successfulImports = 0;
        if (newDevices.length > 0) {
            for (let i = 0; i < newDevices.length; i++) {
                updateImportProgress(80 + (i / newDevices.length) * 20); // 80-100% for import

                const { error } = await supabase
                    .from("stock")
                    .insert([newDevices[i]]);

                if (error) {
                    console.error("Error inserting stock item:", error);
                    errors.push(
                        `Failed to import device ${newDevices[i].device_registration_number}: ${error.message}`,
                    );
                } else {
                    successfulImports++;
                    console.log(
                        `âœ… Stock imported: ${newDevices[i].device_registration_number} (will auto-add to inward)`,
                    );
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
            imported_by: userSession?.email || "unknown",
        };

        await supabase.from("csv_import_logs").insert([importLog]);

        // Hide progress and show results
        hideImportProgress();
        showImportResults(
            successfulImports,
            data.length - successfulImports,
            errors,
            newDevices.length,
        );

        // Reload data
        await loadStockData();

        // Clear file input
        document.getElementById("csvFileInput").value = "";

        // NEW: Show inventory integration info
        if (successfulImports > 0) {
            setTimeout(() => {
                showStockToast(
                    `âœ… ${successfulImports} devices imported and will be auto-added to inventory inward`,
                    "success",
                );
            }, 2000);
        }
    } catch (error) {
        console.error("Error importing CSV:", error);
        hideImportProgress();
        showStockToast("Error importing CSV data", "error");
    }
}

// Show import progress
function showImportProgress() {
    document.getElementById("importProgressSection").classList.remove("hidden");
    updateImportProgress(0);
}

// Update import progress
function updateImportProgress(percentage) {
    const progressBar = document.getElementById("importProgressBar");
    const progressText = document.getElementById("importProgressText");

    progressBar.style.width = `${percentage}%`;
    progressText.textContent = `${Math.round(percentage)}%`;
}

// Hide import progress
function hideImportProgress() {
    document.getElementById("importProgressSection").classList.add("hidden");
}

// UPDATED: Show import results with inventory integration info
function showImportResults(successful, failed, errors, newDevicesCount) {
    const resultsDiv = document.getElementById("importResults");
    const isSuccess = failed === 0;

    resultsDiv.className = `import-results ${isSuccess ? "" : "error"}`;

    let resultHTML = `
        <div class="flex items-center gap-3 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${isSuccess ? "text-green-600" : "text-red-600"}">
                ${
                    isSuccess
                        ? '<path d="M5 13l4 4L19 7"/>'
                        : '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="m12 17 .01 0"/>'
                }
            </svg>
            <div>
                <h4 class="text-body-l-semibold ${isSuccess ? "text-green-600" : "text-red-600"}">
                    Stock Import ${isSuccess ? "Completed" : "Completed with Errors"}
                </h4>
                <p class="text-body-m-regular dark:text-dark-base-500">
                    ${successful} successful, ${failed} failed
                </p>
                ${
                    newDevicesCount > 0
                        ? `
                    <p class="text-body-s-regular text-blue-600 mt-1">
                        ðŸ“¦ ${newDevicesCount} new devices will be auto-added to inventory inward
                    </p>
                `
                        : ""
                }
            </div>
        </div>
    `;

    if (errors.length > 0) {
        resultHTML += `
            <div class="mt-4">
                <h5 class="text-body-m-semibold dark:text-dark-base-600 mb-2">Errors:</h5>
                <div class="max-h-32 overflow-y-auto">
                    <ul class="text-body-s-regular dark:text-dark-base-500 space-y-1">
                        ${errors
                            .slice(0, 10)
                            .map((error) => `<li>â€¢ ${error}</li>`)
                            .join("")}
                        ${errors.length > 10 ? `<li>â€¢ ... and ${errors.length - 10} more errors</li>` : ""}
                    </ul>
                </div>
            </div>
        `;
    }

    // NEW: Add inventory integration info
    if (newDevicesCount > 0) {
        resultHTML += `
            <div class="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700">
                <div class="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-600">
                        <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"/>
                        <path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9"/>
                        <path d="M12 3v6"/>
                    </svg>
                    <span class="text-body-s-semibold text-blue-600">Inventory Integration</span>
                </div>
                <p class="text-body-s-regular text-blue-600 mt-1">
                    New devices are automatically added to inventory inward with "New Device" condition.
                    <a href="inventory.html" class="underline hover:no-underline">Manage inventory â†’</a>
                </p>
            </div>
        `;
    }

    resultsDiv.innerHTML = resultHTML;
    resultsDiv.classList.remove("hidden");

    // Auto-hide after 15 seconds (longer to read inventory info)
    setTimeout(() => {
        resultsDiv.classList.add("hidden");
    }, 15000);

    // Show toast
    if (isSuccess) {
        showStockToast(
            `âœ… Successfully imported ${successful} devices`,
            "success",
        );
    } else {
        showStockToast(
            `Import completed: ${successful} successful, ${failed} failed`,
            "warning",
        );
    }
}

// Update import history list
function updateImportHistoryList() {
    const historyList = document.getElementById("importHistoryList");
    const emptyState = document.getElementById("importHistoryEmptyState");

    if (importHistory.length === 0) {
        historyList.innerHTML = "";
        emptyState.style.display = "block";
    } else {
        emptyState.style.display = "none";
        historyList.innerHTML = importHistory
            .map((record) => createImportHistoryCard(record))
            .join("");
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
                                âœ… ${record.successful_imports} successful
                            </span>
                            <span class="text-body-s-regular text-red-600">
                                âŒ ${record.failed_imports} failed
                            </span>
                            <span class="text-body-s-regular dark:text-dark-base-500">
                                ðŸ“Š ${record.total_rows} total
                            </span>
                        </div>
                        ${
                            record.successful_imports > 0
                                ? `
                            <div class="flex items-center gap-1 mt-1">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-600">
                                    <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"/>
                                    <path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9"/>
                                    <path d="M12 3v6"/>
                                </svg>
                                <span class="text-body-xs-regular text-blue-600">Auto-added to inventory</span>
                            </div>
                        `
                                : ""
                        }
                    </div>
                </div>
                <div class="flex gap-2">
                    ${
                        record.error_details
                            ? `
                        <button onclick="showImportErrors(${record.id})" class="px-3 py-1 text-xs rounded-lg dark:bg-dark-semantic-danger-300 dark:text-utility-white hover:dark:bg-dark-semantic-danger-300/90">
                            View Errors
                        </button>
                    `
                            : ""
                    }
                    <button onclick="viewImportDetails(${record.id})" class="px-3 py-1 text-xs rounded-lg dark:bg-dark-info-600 dark:text-utility-white hover:dark:bg-dark-info-600/90">
                        Details
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Search functionality
function handleStockSearch() {
    const searchTerm = document
        .getElementById("stockSearchInput")
        .value.toLowerCase()
        .trim();
    const statusFilter = document.getElementById("statusFilter").value;

    filteredStockData = localStockData.filter((item) => {
        const matchesSearch =
            !searchTerm ||
            item.device_registration_number
                .toLowerCase()
                .includes(searchTerm) ||
            item.device_imei.toLowerCase().includes(searchTerm) ||
            item.device_model_no.toLowerCase().includes(searchTerm) ||
            (item.batch_no &&
                item.batch_no.toLowerCase().includes(searchTerm)) ||
            (item.po_no && item.po_no.toLowerCase().includes(searchTerm)) ||
            (item.device_condition &&
                item.device_condition.toLowerCase().includes(searchTerm));

        const matchesStatus =
            !statusFilter || item.current_status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    updateStockTable();

    if (searchTerm || statusFilter) {
        showStockToast(`Found ${filteredStockData.length} devices`, "success");
    }
}

function clearStockSearch() {
    document.getElementById("stockSearchInput").value = "";
    document.getElementById("statusFilter").value = "";
    filteredStockData = [...localStockData];
    updateStockTable();
    showStockToast("Search cleared", "success");
}

// UPDATED: View stock device details with inventory status
function viewStockDeviceDetails(deviceRegistrationNumber) {
    const device = localStockData.find(
        (item) => item.device_registration_number === deviceRegistrationNumber,
    );

    if (!device) {
        showStockToast("Device not found", "error");
        return;
    }

    const formatDate = (dateString) => {
        if (!dateString) return "N/A";
        return new Date(dateString).toLocaleString();
    };

    const getConditionDisplayName = (condition) => {
        const conditionMap = {
            new: "New Device",
            good: "Good",
            lense_issue: "Lense Issue",
            sim_module_fail: "SIM Module Fail",
            auto_restart: "Auto Restart",
            device_tampered: "Device Tampered",
            used: "Used",
            refurbished: "Refurbished",
            damaged: "Damaged",
        };
        return conditionMap[condition] || condition;
    };

    const content = `
        <div class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="device-info-label">Registration Number</label>
                    <div class="device-info-value font-mono">${device.device_registration_number}</div>
                </div>
                <div>
                    <label class="device-info-label">Device IMEI</label>
                    <div class="device-info-value font-mono">${device.device_imei}</div>
                </div>
                <div>
                    <label class="device-info-label">Model</label>
                    <div class="device-info-value">${device.device_model_no}</div>
                </div>
                <div>
                    <label class="device-info-label">Serial Number</label>
                    <div class="device-info-value">${device.sl_no || "N/A"}</div>
                </div>
                <div>
                    <label class="device-info-label">Current Status</label>
                    <div class="device-info-value">
                        ${
                            device.current_status === "available"
                                ? "âœ… Available"
                                : device.current_status === "allocated"
                                  ? "ðŸ“¤ Allocated"
                                  : device.current_status
                        }
                    </div>
                </div>
                <div>
                    <label class="device-info-label">Condition</label>
                    <div class="device-info-value">${getConditionDisplayName(device.device_condition)}</div>
                </div>
                <div>
                    <label class="device-info-label">PO Number</label>
                    <div class="device-info-value">${device.po_no || "N/A"}</div>
                </div>
                <div>
                    <label class="device-info-label">Batch Number</label>
                    <div class="device-info-value">${device.batch_no || "N/A"}</div>
                </div>
                <div>
                    <label class="device-info-label">Stock Inward Date</label>
                    <div class="device-info-value">${formatDate(device.inward_date)}</div>
                </div>
                <div>
                    <label class="device-info-label">Location</label>
                    <div class="device-info-value">${device.location || "N/A"}</div>
                </div>
                <div>
                    <label class="device-info-label">SIM Number</label>
                    <div class="device-info-value">${device.sim_no || "N/A"}</div>
                </div>
                <div>
                    <label class="device-info-label">Imported By</label>
                    <div class="device-info-value">${device.imported_by || "N/A"}</div>
                </div>
            </div>
            
            <div class="border-t pt-4 dark:border-dark-stroke-contrast-400">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="device-info-label">Created At</label>
                        <div class="device-info-value">${formatDate(device.created_at)}</div>
                    </div>
                    <div>
                        <label class="device-info-label">Last Updated</label>
                        <div class="device-info-value">${formatDate(device.updated_at)}</div>
                    </div>
                    ${
                        device.allocated_date
                            ? `
                        <div>
                            <label class="device-info-label">Allocated Date</label>
                            <div class="device-info-value">${formatDate(device.allocated_date)}</div>
                        </div>
                    `
                            : ""
                    }
                    ${
                        device.allocated_to_customer_id
                            ? `
                        <div>
                            <label class="device-info-label">Allocated To Customer ID</label>
                            <div class="device-info-value">${device.allocated_to_customer_id}</div>
                        </div>
                    `
                            : ""
                    }
                </div>
            </div>
            
            <div class="border-t pt-4 dark:border-dark-stroke-contrast-400">
                <div class="flex gap-2">
                    <button onclick="manageInventory('${device.device_registration_number}')" class="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors text-sm">
                        ðŸ“¦ Manage in Inventory
                    </button>
                    <button onclick="closeDeviceDetailsModal()" class="px-4 py-2 rounded-lg dark:bg-dark-stroke-base-400 dark:text-dark-base-600 hover:dark:bg-dark-stroke-base-600 text-sm">
                        Close
                    </button>
                </div>
            </div>
        </div>
    `;

    document.getElementById("deviceDetailsContent").innerHTML = content;
    document.getElementById("deviceDetailsModal").classList.remove("hidden");
}

// Close device details modal
function closeDeviceDetailsModal() {
    document.getElementById("deviceDetailsModal").classList.add("hidden");
}

// Edit stock device (placeholder for future implementation)
function editStockDevice(deviceId) {
    showStockToast("Edit functionality coming soon", "warning");
}

// Show import errors
function showImportErrors(importId) {
    const importRecord = importHistory.find((record) => record.id === importId);
    if (importRecord && importRecord.error_details) {
        const errors = importRecord.error_details.errors || [];
        alert(
            `Import Errors:\n\n${errors.slice(0, 10).join("\n")}\n${errors.length > 10 ? `\n... and ${errors.length - 10} more errors` : ""}`,
        );
    }
}

// NEW: View import details
function viewImportDetails(importId) {
    const importRecord = importHistory.find((record) => record.id === importId);
    if (importRecord) {
        const details = `
            Import Details:
            
            Filename: ${importRecord.filename}
            Date: ${new Date(importRecord.import_date).toLocaleString()}
            Imported By: ${importRecord.imported_by}
            
            Results:
            - Total Rows: ${importRecord.total_rows}
            - Successful: ${importRecord.successful_imports}
            - Failed: ${importRecord.failed_imports}
            
            ${importRecord.successful_imports > 0 ? `âœ… ${importRecord.successful_imports} devices were auto-added to inventory inward\n` : ""}
            ${importRecord.error_details ? `âŒ ${importRecord.error_details.errors.length} errors occurred` : "âœ… No errors"}
        `;
        alert(details);
    }
}

// Loading overlay functions
function showStockLoadingOverlay() {
    document.getElementById("stockLoadingOverlay").classList.remove("hidden");
}

function hideStockLoadingOverlay() {
    document.getElementById("stockLoadingOverlay").classList.add("hidden");
}

// Toast notification function
function showStockToast(message, type = "success") {
    const toast = document.getElementById("stockToast");
    const messageEl = document.getElementById("stockToastMessage");
    const iconEl = document.getElementById("stockToastIcon");

    // Set message
    messageEl.textContent = message;

    // Set icon based on type
    let iconSVG = "";
    switch (type) {
        case "success":
            iconSVG = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>`;
            toast.className =
                "fixed top-4 right-4 z-50 max-w-sm p-4 rounded-lg shadow-lg success";
            break;
        case "error":
            iconSVG = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>`;
            toast.className =
                "fixed top-4 right-4 z-50 max-w-sm p-4 rounded-lg shadow-lg error";
            break;
        case "warning":
            iconSVG = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>`;
            toast.className =
                "fixed top-4 right-4 z-50 max-w-sm p-4 rounded-lg shadow-lg warning";
            break;
    }

    iconEl.innerHTML = iconSVG;

    // Show toast
    toast.classList.remove("hidden");
    toast.classList.add("show");

    // Hide after 3 seconds
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => {
            toast.classList.add("hidden");
        }, 300);
    }, 3000);
}

// Make functions globally available for HTML onclick handlers
window.goBackToDashboard = goBackToDashboard;
window.goToInventoryManagement = goToInventoryManagement;
window.clearStockSearch = clearStockSearch;
window.viewStockDeviceDetails = viewStockDeviceDetails;
window.editStockDevice = editStockDevice;
window.showImportErrors = showImportErrors;
window.viewImportDetails = viewImportDetails;
window.closeDeviceDetailsModal = closeDeviceDetailsModal;
window.manageInventory = manageInventory;
window.loadStockData = loadStockData;

// Export functions for global access
window.stockFunctions = {
    goBackToDashboard,
    goToInventoryManagement,
    clearStockSearch,
    viewStockDeviceDetails,
    editStockDevice,
    showImportErrors,
    viewImportDetails,
    closeDeviceDetailsModal,
    manageInventory,
};
