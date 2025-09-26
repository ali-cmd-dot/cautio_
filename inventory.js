// Inventory Management JavaScript
// This file handles all inventory management functionality including inward/outward devices and SIM management

// Supabase Configuration - Direct connection (no config.js needed)
function getSupabaseClient() {
    const SUPABASE_URL = 'https://jcmjazindwonrplvjwxl.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjbWphemluZHdvbnJwbHZqd3hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczMDEyNjMsImV4cCI6MjA3Mjg3NzI2M30.1B6sKnzrzdNFhvQUXVnRzzQnItFMaIFL0Y9WK_Gie9g';
    return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Global variables for inventory management
let inventoryData = {
    inwardDevices: [],
    outwardDevices: [],
    stockData: [],
    customers: [],
    simManagement: [],
    simHistory: []
};
let filteredInventoryData = {
    inwardDevices: [],
    outwardDevices: [],
    simManagement: []
};
let currentInventoryTab = "device-management";
let currentDeviceTab = "inward";
let userSession = null;

// Initialize inventory management
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
    checkInventoryUserSession();

    // Load initial data
    loadInventoryData();

    // Setup event listeners
    setupInventoryEventListeners();

    // Setup realtime listeners only if supabase.channel is available
    if (typeof supabase.channel === "function") {
        setupInventoryRealtimeListeners();
    } else {
        console.warn("Realtime listeners not available - supabase.channel not found");
    }
});

// Check user session for inventory management
function checkInventoryUserSession() {
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

// Setup event listeners for inventory management
function setupInventoryEventListeners() {
    // CSV file inputs
    const inwardCSVFileInput = document.getElementById("inwardCSVFileInput");
    const outwardCSVFileInput = document.getElementById("outwardCSVFileInput");
    
    if (inwardCSVFileInput) {
        inwardCSVFileInput.addEventListener("change", (e) => handleCSVFileSelect(e, 'inward'));
    }
    if (outwardCSVFileInput) {
        outwardCSVFileInput.addEventListener("change", (e) => handleCSVFileSelect(e, 'outward'));
    }

    // Drag and drop for CSV import
    const inwardCSVImportArea = document.getElementById("inwardCSVImportArea");
    const outwardCSVImportArea = document.getElementById("outwardCSVImportArea");
    
    if (inwardCSVImportArea) {
        inwardCSVImportArea.addEventListener("dragover", handleDragOver);
        inwardCSVImportArea.addEventListener("dragleave", handleDragLeave);
        inwardCSVImportArea.addEventListener("drop", (e) => handleFileDrop(e, 'inward'));
    }
    
    if (outwardCSVImportArea) {
        outwardCSVImportArea.addEventListener("dragover", handleDragOver);
        outwardCSVImportArea.addEventListener("dragleave", handleDragLeave);
        outwardCSVImportArea.addEventListener("drop", (e) => handleFileDrop(e, 'outward'));
    }

    // Search functionality
    const searchInput = document.getElementById("inventorySearchInput");
    if (searchInput) {
        searchInput.addEventListener("input", handleInventorySearch);
    }

    // Form submissions
    const addInwardForm = document.getElementById("addInwardForm");
    const addOutwardForm = document.getElementById("addOutwardForm");
    const simReplacementForm = document.getElementById("simReplacementForm");
    
    if (addInwardForm) {
        addInwardForm.addEventListener("submit", handleAddInwardDevice);
    }
    if (addOutwardForm) {
        addOutwardForm.addEventListener("submit", handleAddOutwardDevice);
    }
    if (simReplacementForm) {
        simReplacementForm.addEventListener("submit", handleSimReplacement);
    }

    // Auto-fill device IMEI when registration number is entered for SIM replacement
    const simDeviceRegNumber = document.getElementById("simDeviceRegNumber");
    if (simDeviceRegNumber) {
        simDeviceRegNumber.addEventListener("blur", autoFillDeviceIMEI);
    }
}

// Setup realtime listeners for inventory
function setupInventoryRealtimeListeners() {
    // Listen for inward device changes
    supabase
        .channel("inward_devices_changes")
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "inward_devices" },
            (payload) => {
                console.log("Inward device change received!", payload);
                loadInventoryData();
            }
        )
        .subscribe();

    // Listen for outward device changes
    supabase
        .channel("outward_devices_changes")
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "outward_devices" },
            (payload) => {
                console.log("Outward device change received!", payload);
                loadInventoryData();
            }
        )
        .subscribe();

    // Listen for stock changes
    supabase
        .channel("stock_changes")
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "stock" },
            (payload) => {
                console.log("Stock change received!", payload);
                loadInventoryData();
            }
        )
        .subscribe();

    // Listen for SIM management changes
    supabase
        .channel("sim_management_changes")
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "device_sim_management" },
            (payload) => {
                console.log("SIM management change received!", payload);
                loadInventoryData();
            }
        )
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "sim_replacement_history" },
            (payload) => {
                console.log("SIM replacement history change received!", payload);
                loadInventoryData();
            }
        )
        .subscribe();
}

// Load all inventory data
async function loadInventoryData() {
    try {
        showInventoryLoadingOverlay();

        // Load all data in parallel
        await Promise.all([
            loadInwardDevices(),
            loadOutwardDevices(),
            loadStockData(),
            loadCustomers(),
            loadSimManagement(),
            loadSimHistory()
        ]);

        // Update UI
        updateInventoryPageSummary();
        updateInventoryDisplay();

        hideInventoryLoadingOverlay();
    } catch (error) {
        console.error("Error loading inventory data:", error);
        showInventoryToast("Error loading inventory data", "error");
        hideInventoryLoadingOverlay();
    }
}

// Load inward devices from database
async function loadInwardDevices() {
    try {
        const { data, error } = await supabase
            .from("inward_devices")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Error loading inward devices:", error);
            throw error;
        }

        inventoryData.inwardDevices = data || [];
        filteredInventoryData.inwardDevices = [...inventoryData.inwardDevices];
        console.log(`Loaded ${inventoryData.inwardDevices.length} inward devices`);
    } catch (error) {
        console.error("Error loading inward devices:", error);
        throw error;
    }
}

// Load outward devices from database
async function loadOutwardDevices() {
    try {
        const { data, error } = await supabase
            .from("outward_devices")
            .select(`
                *,
                customers (
                    customer_name,
                    customer_email,
                    customer_mobile
                )
            `)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Error loading outward devices:", error);
            throw error;
        }

        inventoryData.outwardDevices = data || [];
        filteredInventoryData.outwardDevices = [...inventoryData.outwardDevices];
        console.log(`Loaded ${inventoryData.outwardDevices.length} outward devices`);
    } catch (error) {
        console.error("Error loading outward devices:", error);
        throw error;
    }
}

// Load stock data from database
async function loadStockData() {
    try {
        const { data, error } = await supabase
            .from("stock")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Error loading stock data:", error);
            throw error;
        }

        inventoryData.stockData = data || [];
        console.log(`Loaded ${inventoryData.stockData.length} stock items`);
    } catch (error) {
        console.error("Error loading stock data:", error);
        throw error;
    }
}

// Load customers from database
async function loadCustomers() {
    try {
        const { data, error } = await supabase
            .from("customers")
            .select("id, customer_name, customer_email, status")
            .eq("status", "active")
            .order("customer_name", { ascending: true });

        if (error) {
            console.error("Error loading customers:", error);
            throw error;
        }

        inventoryData.customers = data || [];
        console.log(`Loaded ${inventoryData.customers.length} customers`);
        
        // Populate customer dropdown
        populateCustomerDropdown();
    } catch (error) {
        console.error("Error loading customers:", error);
        throw error;
    }
}

// Load SIM management data
async function loadSimManagement() {
    try {
        const { data, error } = await supabase
            .from("device_sim_management")
            .select("*")
            .eq("status", "active")
            .order("assigned_date", { ascending: false });

        if (error) {
            console.error("Error loading SIM management data:", error);
            throw error;
        }

        inventoryData.simManagement = data || [];
        filteredInventoryData.simManagement = [...inventoryData.simManagement];
        console.log(`Loaded ${inventoryData.simManagement.length} SIM assignments`);
    } catch (error) {
        console.error("Error loading SIM management data:", error);
        throw error;
    }
}

// Load SIM replacement history
async function loadSimHistory() {
    try {
        const { data, error } = await supabase
            .from("sim_replacement_history")
            .select("*")
            .order("replacement_date", { ascending: false });

        if (error) {
            console.error("Error loading SIM history:", error);
            throw error;
        }

        inventoryData.simHistory = data || [];
        console.log(`Loaded ${inventoryData.simHistory.length} SIM history records`);
    } catch (error) {
        console.error("Error loading SIM history:", error);
        throw error;
    }
}

// Update inventory summary display
function updateInventoryPageSummary() {
    const totalStock = inventoryData.stockData.length;
    const availableStock = inventoryData.stockData.filter(
        (item) => item.current_status === "available" && item.device_condition === "good"
    ).length;
    const allocatedStock = inventoryData.stockData.filter(
        (item) => item.current_status === "allocated"
    ).length;

    const totalStockEl = document.getElementById("inventoryHTMLTotalStockCount");
    const availableStockEl = document.getElementById("inventoryHTMLAvailableStockCount");
    const allocatedStockEl = document.getElementById("inventoryHTMLAllocatedStockCount");

    if (totalStockEl) totalStockEl.textContent = totalStock;
    if (availableStockEl) availableStockEl.textContent = availableStock;
    if (allocatedStockEl) allocatedStockEl.textContent = allocatedStock;

    // Update tab counts
    const deviceManagementCount = inventoryData.inwardDevices.length + inventoryData.outwardDevices.length;
    const inwardCount = inventoryData.inwardDevices.length;
    const outwardCount = inventoryData.outwardDevices.length;
    const simManagementCount = inventoryData.simManagement.length;

    const deviceManagementCountEl = document.getElementById("deviceManagementCount");
    const inwardCountEl = document.getElementById("inwardCount");
    const outwardCountEl = document.getElementById("outwardCount");
    const simManagementCountEl = document.getElementById("simManagementCount");

    if (deviceManagementCountEl) deviceManagementCountEl.textContent = deviceManagementCount;
    if (inwardCountEl) inwardCountEl.textContent = inwardCount;
    if (outwardCountEl) outwardCountEl.textContent = outwardCount;
    if (simManagementCountEl) simManagementCountEl.textContent = simManagementCount;
}

// Update inventory display based on current tab
function updateInventoryDisplay() {
    if (currentInventoryTab === "device-management") {
        if (currentDeviceTab === "inward") {
            updateInwardDevicesList();
        } else if (currentDeviceTab === "outward") {
            updateOutwardDevicesList();
        }
    } else if (currentInventoryTab === "sim-management") {
        updateSimManagementTable();
    }
}

// Update inward devices list
function updateInwardDevicesList() {
    const listContainer = document.getElementById("inwardDevicesList");
    const emptyState = document.getElementById("inwardEmptyState");

    if (!listContainer || !emptyState) return;

    if (filteredInventoryData.inwardDevices.length === 0) {
        listContainer.innerHTML = "";
        emptyState.classList.remove("hidden");
    } else {
        emptyState.classList.add("hidden");
        listContainer.innerHTML = filteredInventoryData.inwardDevices
            .map((device) => createInwardDeviceCard(device))
            .join("");
    }
}

// Update outward devices list
function updateOutwardDevicesList() {
    const listContainer = document.getElementById("outwardDevicesList");
    const emptyState = document.getElementById("outwardEmptyState");

    if (!listContainer || !emptyState) return;

    if (filteredInventoryData.outwardDevices.length === 0) {
        listContainer.innerHTML = "";
        emptyState.classList.remove("hidden");
    } else {
        emptyState.classList.add("hidden");
        listContainer.innerHTML = filteredInventoryData.outwardDevices
            .map((device) => createOutwardDeviceCard(device))
            .join("");
    }
}

// Update SIM management table
function updateSimManagementTable() {
    const tableBody = document.getElementById("simManagementTableBody");
    const emptyState = document.getElementById("simManagementEmptyState");

    if (!tableBody || !emptyState) return;

    if (filteredInventoryData.simManagement.length === 0) {
        tableBody.innerHTML = "";
        emptyState.classList.remove("hidden");
    } else {
        emptyState.classList.add("hidden");
        tableBody.innerHTML = filteredInventoryData.simManagement
            .map((sim) => createSimManagementRow(sim))
            .join("");
    }
}

// Create inward device card HTML
function createInwardDeviceCard(device) {
    const formatDate = (dateString) => {
        if (!dateString) return "N/A";
        return new Date(dateString).toLocaleDateString();
    };

    const getConditionBadge = (condition) => {
        let badgeClass, conditionText;

        switch (condition) {
            case "good":
                badgeClass = "condition-badge good";
                conditionText = "Good";
                break;
            case "lense_issue":
                badgeClass = "condition-badge lense_issue";
                conditionText = "Lense Issue";
                break;
            case "sim_module_fail":
                badgeClass = "condition-badge sim_module_fail";
                conditionText = "SIM Module Fail";
                break;
            case "auto_restart":
                badgeClass = "condition-badge auto_restart";
                conditionText = "Auto Restart";
                break;
            case "device_tampered":
                badgeClass = "condition-badge device_tampered";
                conditionText = "Device Tampered";
                break;
            case "used":
                badgeClass = "condition-badge used";
                conditionText = "Used";
                break;
            case "refurbished":
                badgeClass = "condition-badge refurbished";
                conditionText = "Refurbished";
                break;
            case "damaged":
                badgeClass = "condition-badge damaged";
                conditionText = "Damaged";
                break;
            default:
                badgeClass = "condition-badge good";
                conditionText = condition;
        }

        return `<span class="${badgeClass}">${conditionText}</span>`;
    };

    return `
        <div class="device-card p-4 rounded-lg">
            <div class="flex items-start justify-between">
                <div class="flex-1">
                    <div class="device-info-grid">
                        <div class="device-info-item">
                            <div class="device-info-label">Registration Number</div>
                            <div class="device-info-value font-mono">${device.device_registration_number}</div>
                        </div>
                        <div class="device-info-item">
                            <div class="device-info-label">Device IMEI</div>
                            <div class="device-info-value font-mono">${device.device_imei}</div>
                        </div>
                        <div class="device-info-item">
                            <div class="device-info-label">Condition</div>
                            <div class="device-info-value">${getConditionBadge(device.device_condition)}</div>
                        </div>
                        <div class="device-info-item">
                            <div class="device-info-label">Inward Date</div>
                            <div class="device-info-value">${formatDate(device.inward_date)}</div>
                        </div>
                        ${device.notes ? `
                        <div class="device-info-item">
                            <div class="device-info-label">Notes</div>
                            <div class="device-info-value">${device.notes}</div>
                        </div>
                        ` : ''}
                    </div>
                </div>
                <div class="flex gap-2 ml-4">
                    <button onclick="viewDeviceHistory('${device.device_registration_number}')" class="device-action-btn view">
                        VIEW
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Create outward device card HTML
function createOutwardDeviceCard(device) {
    const formatDate = (dateString) => {
        if (!dateString) return "N/A";
        return new Date(dateString).toLocaleDateString();
    };

    const customerName = device.customers ? device.customers.customer_name : device.customer_name;

    return `
        <div class="device-card outward-card p-4 rounded-lg">
            <div class="flex items-start justify-between">
                <div class="flex-1">
                    <div class="device-info-grid">
                        <div class="device-info-item">
                            <div class="device-info-label">Registration Number</div>
                            <div class="device-info-value font-mono">${device.device_registration_number}</div>
                        </div>
                        <div class="device-info-item">
                            <div class="device-info-label">Device IMEI</div>
                            <div class="device-info-value font-mono">${device.device_imei}</div>
                        </div>
                        <div class="device-info-item">
                            <div class="device-info-label">Customer</div>
                            <div class="device-info-value">${customerName}</div>
                        </div>
                        <div class="device-info-item">
                            <div class="device-info-label">Location</div>
                            <div class="device-info-value">${device.location}</div>
                        </div>
                        <div class="device-info-item">
                            <div class="device-info-label">Outward Date</div>
                            <div class="device-info-value">${formatDate(device.outward_date)}</div>
                        </div>
                        ${device.sim_no ? `
                        <div class="device-info-item">
                            <div class="device-info-label">SIM No</div>
                            <div class="device-info-value">${device.sim_no}</div>
                        </div>
                        ` : ''}
                        ${device.notes ? `
                        <div class="device-info-item">
                            <div class="device-info-label">Notes</div>
                            <div class="device-info-value">${device.notes}</div>
                        </div>
                        ` : ''}
                    </div>
                </div>
                <div class="flex gap-2 ml-4">
                    <button onclick="viewDeviceHistory('${device.device_registration_number}')" class="device-action-btn view">
                        VIEW
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Create SIM management table row HTML
function createSimManagementRow(sim) {
    const formatDate = (dateString) => {
        if (!dateString) return "N/A";
        return new Date(dateString).toLocaleDateString();
    };

    const getStatusBadge = (status) => {
        let badgeClass, statusText;

        switch (status) {
            case "active":
                badgeClass = "device-status-badge available";
                statusText = "Active";
                break;
            case "inactive":
                badgeClass = "device-status-badge returned";
                statusText = "Inactive";
                break;
            case "replaced":
                badgeClass = "device-status-badge allocated";
                statusText = "Replaced";
                break;
            default:
                badgeClass = "device-status-badge returned";
                statusText = status;
        }

        return `<span class="${badgeClass}">${statusText}</span>`;
    };

    return `
        <tr>
            <td class="compact-text-primary font-mono">${sim.device_registration_number}</td>
            <td class="compact-text-secondary font-mono">${sim.device_imei}</td>
            <td class="compact-text-primary">${sim.current_sim_no || 'N/A'}</td>
            <td class="compact-text-secondary">${formatDate(sim.assigned_date)}</td>
            <td>${getStatusBadge(sim.status)}</td>
            <td>
                <div class="flex gap-1">
                    <button onclick="viewSimHistory('${sim.device_registration_number}')" class="compact-btn compact-btn-primary">
                        VIEW
                    </button>
                </div>
            </td>
        </tr>
    `;
}

// Tab navigation functions
function showDeviceManagementTab() {
    currentInventoryTab = "device-management";
    
    // Update tab buttons
    document.getElementById("deviceManagementTab").classList.add("active");
    document.getElementById("simManagementTab").classList.remove("active");
    
    // Update content
    document.getElementById("deviceManagementTabContent").classList.remove("hidden");
    document.getElementById("simManagementTabContent").classList.add("hidden");
    
    updateInventoryDisplay();
}

function showSimManagementTab() {
    currentInventoryTab = "sim-management";
    
    // Update tab buttons
    document.getElementById("deviceManagementTab").classList.remove("active");
    document.getElementById("simManagementTab").classList.add("active");
    
    // Update content
    document.getElementById("deviceManagementTabContent").classList.add("hidden");
    document.getElementById("simManagementTabContent").classList.remove("hidden");
    
    updateInventoryDisplay();
}

function showInwardTab() {
    currentDeviceTab = "inward";
    
    // Update tab buttons
    document.getElementById("inwardTab").classList.add("active");
    document.getElementById("outwardTab").classList.remove("active");
    
    // Update content
    document.getElementById("inwardTabContent").classList.remove("hidden");
    document.getElementById("outwardTabContent").classList.add("hidden");
    
    updateInventoryDisplay();
}

function showOutwardTab() {
    currentDeviceTab = "outward";
    
    // Update tab buttons
    document.getElementById("inwardTab").classList.remove("active");
    document.getElementById("outwardTab").classList.add("active");
    
    // Update content
    document.getElementById("inwardTabContent").classList.add("hidden");
    document.getElementById("outwardTabContent").classList.remove("hidden");
    
    updateInventoryDisplay();
}

// Floating add menu functions
function toggleInventoryAddMenu() {
    const menu = document.getElementById("inventoryAddMenu");
    if (menu) {
        menu.classList.toggle("hidden");
    }
}

// Modal functions
function showAddInwardForm() {
    const modal = document.getElementById("addInwardModal");
    if (modal) {
        modal.classList.remove("hidden");
    }
    toggleInventoryAddMenu(); // Close the add menu
}

function closeAddInwardForm() {
    const modal = document.getElementById("addInwardModal");
    if (modal) {
        modal.classList.add("hidden");
    }
    // Reset form
    const form = document.getElementById("addInwardForm");
    if (form) {
        form.reset();
    }
}

function showAddOutwardForm() {
    const modal = document.getElementById("addOutwardModal");
    if (modal) {
        modal.classList.remove("hidden");
    }
    toggleInventoryAddMenu(); // Close the add menu
}

function closeAddOutwardForm() {
    const modal = document.getElementById("addOutwardModal");
    if (modal) {
        modal.classList.add("hidden");
    }
    // Reset form
    const form = document.getElementById("addOutwardForm");
    if (form) {
        form.reset();
    }
}

// Populate customer dropdown
function populateCustomerDropdown() {
    const customerSelect = document.getElementById("customerSelect");
    if (!customerSelect) return;

    customerSelect.innerHTML = '<option value="">Select customer</option>';
    
    inventoryData.customers.forEach(customer => {
        const option = document.createElement("option");
        option.value = customer.id;
        option.textContent = customer.customer_name;
        customerSelect.appendChild(option);
    });
}

// Handle add inward device form submission
async function handleAddInwardDevice(e) {
    e.preventDefault();
    
    try {
        const formData = new FormData(e.target);
        const deviceData = {
            device_registration_number: formData.get("deviceRegistrationNumber"),
            device_imei: formData.get("deviceImei"),
            device_condition: formData.get("deviceCondition"),
            notes: formData.get("notes") || null,
            processed_by: userSession?.email || "unknown"
        };

        // Validate device exists in stock
        const { data: stockDevice, error: stockError } = await supabase
            .from("stock")
            .select("id")
            .eq("device_registration_number", deviceData.device_registration_number)
            .eq("device_imei", deviceData.device_imei)
            .single();

        if (stockError || !stockDevice) {
            showInventoryToast("Device not found in stock. Please add to stock first.", "error");
            return;
        }

        // Check if device already exists in inward
        const { data: existingInward, error: existingError } = await supabase
            .from("inward_devices")
            .select("id")
            .eq("device_registration_number", deviceData.device_registration_number)
            .single();

        if (existingInward) {
            showInventoryToast("Device already exists in inward inventory", "error");
            return;
        }

        // Add stock_id to device data
        deviceData.stock_id = stockDevice.id;

        // Insert inward device
        const { error } = await supabase
            .from("inward_devices")
            .insert([deviceData]);

        if (error) {
            console.error("Error adding inward device:", error);
            showInventoryToast("Error adding inward device", "error");
            return;
        }

        showInventoryToast("Inward device added successfully", "success");
        closeAddInwardForm();
        loadInventoryData();

    } catch (error) {
        console.error("Error adding inward device:", error);
        showInventoryToast("Error adding inward device", "error");
    }
}

// Handle add outward device form submission
async function handleAddOutwardDevice(e) {
    e.preventDefault();
    
    try {
        const formData = new FormData(e.target);
        const customerId = formData.get("customerId");
        const customer = inventoryData.customers.find(c => c.id == customerId);
        
        if (!customer) {
            showInventoryToast("Please select a valid customer", "error");
            return;
        }

        const deviceData = {
            device_registration_number: formData.get("deviceRegistrationNumber"),
            device_imei: formData.get("deviceImei"),
            customer_id: parseInt(customerId),
            customer_name: customer.customer_name,
            location: formData.get("location"),
            outward_date: formData.get("outwardDate"),
            sim_no: formData.get("simNo") || null,
            notes: formData.get("notes") || null,
            processed_by: userSession?.email || "unknown"
        };

        // Validate device exists in stock and is available
        const { data: stockDevice, error: stockError } = await supabase
            .from("stock")
            .select("id, current_status")
            .eq("device_registration_number", deviceData.device_registration_number)
            .eq("device_imei", deviceData.device_imei)
            .single();

        if (stockError || !stockDevice) {
            showInventoryToast("Device not found in stock", "error");
            return;
        }

        if (stockDevice.current_status !== "available") {
            showInventoryToast("Device is not available for allocation", "error");
            return;
        }

        // Check if device already exists in outward
        const { data: existingOutward, error: existingError } = await supabase
            .from("outward_devices")
            .select("id")
            .eq("device_registration_number", deviceData.device_registration_number)
            .single();

        if (existingOutward) {
            showInventoryToast("Device already exists in outward inventory", "error");
            return;
        }

        // Add stock_id to device data
        deviceData.stock_id = stockDevice.id;

        // Insert outward device
        const { error } = await supabase
            .from("outward_devices")
            .insert([deviceData]);

        if (error) {
            console.error("Error adding outward device:", error);
            showInventoryToast("Error adding outward device", "error");
            return;
        }

        showInventoryToast("Outward device added successfully", "success");
        closeAddOutwardForm();
        loadInventoryData();

    } catch (error) {
        console.error("Error adding outward device:", error);
        showInventoryToast("Error adding outward device", "error");
    }
}

// Handle SIM replacement form submission
async function handleSimReplacement(e) {
    e.preventDefault();
    
    try {
        const formData = new FormData(e.target);
        const replacementData = {
            device_registration_number: formData.get("deviceRegistrationNumber"),
            device_imei: formData.get("deviceImei"),
            old_sim_no: formData.get("oldSimNo"),
            new_sim_no: formData.get("newSimNo"),
            replacement_reason: formData.get("replacementReason") || null,
            replaced_by: userSession?.email || "unknown"
        };

        // Validate device exists in stock
        const { data: stockDevice, error: stockError } = await supabase
            .from("stock")
            .select("id")
            .eq("device_registration_number", replacementData.device_registration_number)
            .eq("device_imei", replacementData.device_imei)
            .single();

        if (stockError || !stockDevice) {
            showInventoryToast("Device not found in stock", "error");
            return;
        }

        // Validate old SIM number matches current SIM
        const { data: currentSim, error: simError } = await supabase
            .from("device_sim_management")
            .select("current_sim_no")
            .eq("device_registration_number", replacementData.device_registration_number)
            .eq("status", "active")
            .single();

        if (currentSim && currentSim.current_sim_no !== replacementData.old_sim_no) {
            showInventoryToast("Old SIM number does not match current SIM", "error");
            return;
        }

        // Insert SIM replacement record (this will trigger the database function to update current SIM)
        const { error } = await supabase
            .from("sim_replacement_history")
            .insert([replacementData]);

        if (error) {
            console.error("Error replacing SIM:", error);
            showInventoryToast("Error replacing SIM", "error");
            return;
        }

        showInventoryToast("SIM replaced successfully", "success");
        
        // Reset form
        const form = document.getElementById("simReplacementForm");
        if (form) {
            form.reset();
        }
        
        loadInventoryData();

    } catch (error) {
        console.error("Error replacing SIM:", error);
        showInventoryToast("Error replacing SIM", "error");
    }
}

// Auto-fill device IMEI when registration number is entered
async function autoFillDeviceIMEI(e) {
    const regNumber = e.target.value.trim();
    if (!regNumber) return;

    try {
        const { data: stockDevice, error } = await supabase
            .from("stock")
            .select("device_imei, sim_no")
            .eq("device_registration_number", regNumber)
            .single();

        if (stockDevice) {
            const imeiInput = document.getElementById("simDeviceImei");
            const oldSimInput = document.getElementById("oldSimNo");
            
            if (imeiInput) {
                imeiInput.value = stockDevice.device_imei;
            }
            if (oldSimInput && stockDevice.sim_no) {
                oldSimInput.value = stockDevice.sim_no;
            }
        }
    } catch (error) {
        console.error("Error auto-filling device IMEI:", error);
    }
}

// View device history
async function viewDeviceHistory(deviceRegistrationNumber) {
    try {
        showInventoryLoadingOverlay();

        // Get device movement history from audit log
        const { data: auditLog, error: auditError } = await supabase
            .from("inventory_audit_log")
            .select("*")
            .eq("device_registration_number", deviceRegistrationNumber)
            .order("created_at", { ascending: false });

        // Get inward history
        const { data: inwardHistory, error: inwardError } = await supabase
            .from("inward_devices")
            .select("*")
            .eq("device_registration_number", deviceRegistrationNumber);

        // Get outward history
        const { data: outwardHistory, error: outwardError } = await supabase
            .from("outward_devices")
            .select(`
                *,
                customers (
                    customer_name,
                    customer_email
                )
            `)
            .eq("device_registration_number", deviceRegistrationNumber);

        hideInventoryLoadingOverlay();

        if (auditError || inwardError || outwardError) {
            console.error("Error loading device history:", { auditError, inwardError, outwardError });
            showInventoryToast("Error loading device history", "error");
            return;
        }

        // Display history in modal
        displayDeviceHistory(deviceRegistrationNumber, {
            auditLog: auditLog || [],
            inwardHistory: inwardHistory || [],
            outwardHistory: outwardHistory || []
        });

    } catch (error) {
        console.error("Error viewing device history:", error);
        showInventoryToast("Error viewing device history", "error");
        hideInventoryLoadingOverlay();
    }
}

// Display device history in modal
function displayDeviceHistory(deviceRegistrationNumber, history) {
    const modal = document.getElementById("deviceHistoryModal");
    const content = document.getElementById("deviceHistoryContent");
    
    if (!modal || !content) return;

    const formatDate = (dateString) => {
        if (!dateString) return "N/A";
        return new Date(dateString).toLocaleString();
    };

    let historyHTML = `
        <div class="mb-6">
            <h3 class="text-heading-7 dark:text-dark-base-600 mb-4">Device: ${deviceRegistrationNumber}</h3>
        </div>
    `;

    // Create timeline of all events
    const allEvents = [];

    // Add inward events
    history.inwardHistory.forEach(inward => {
        allEvents.push({
            type: 'inward',
            date: inward.inward_time || inward.created_at,
            title: 'Device Added to Inward',
            details: `Condition: ${inward.device_condition}${inward.notes ? `, Notes: ${inward.notes}` : ''}`,
            icon: '📥'
        });
    });

    // Add outward events
    history.outwardHistory.forEach(outward => {
        const customerName = outward.customers ? outward.customers.customer_name : outward.customer_name;
        allEvents.push({
            type: 'outward',
            date: outward.outward_time || outward.created_at,
            title: 'Device Allocated to Customer',
            details: `Customer: ${customerName}, Location: ${outward.location}${outward.sim_no ? `, SIM: ${outward.sim_no}` : ''}${outward.notes ? `, Notes: ${outward.notes}` : ''}`,
            icon: '📤'
        });
    });

    // Add audit log events
    history.auditLog.forEach(log => {
        let title = '';
        let details = '';
        let icon = '📋';

        switch (log.action_type) {
            case 'stock_added':
                title = 'Added to Stock';
                icon = '📦';
                break;
            case 'inward_added':
                title = 'Added to Inward Inventory';
                icon = '📥';
                break;
            case 'outward_added':
                title = 'Added to Outward Inventory';
                icon = '📤';
                break;
            case 'inward_removed':
                title = 'Removed from Inward Inventory';
                icon = '📥';
                break;
            case 'outward_removed':
                title = 'Removed from Outward Inventory';
                icon = '📤';
                break;
            case 'status_changed':
                title = 'Status Changed';
                details = `From: ${log.old_status || 'N/A'} → To: ${log.new_status || 'N/A'}`;
                icon = '🔄';
                break;
            case 'condition_changed':
                title = 'Condition Changed';
                details = `From: ${log.old_condition || 'N/A'} → To: ${log.new_condition || 'N/A'}`;
                icon = '🔧';
                break;
            default:
                title = log.action_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        }

        if (log.notes) {
            details += (details ? ', ' : '') + `Notes: ${log.notes}`;
        }

        allEvents.push({
            type: 'audit',
            date: log.created_at,
            title: title,
            details: details,
            performer: log.performed_by,
            icon: icon
        });
    });

    // Sort events by date (newest first)
    allEvents.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (allEvents.length === 0) {
        historyHTML += `
            <div class="text-center py-8">
                <p class="text-body-l-regular dark:text-dark-base-500">No movement history found for this device</p>
            </div>
        `;
    } else {
        historyHTML += `
            <div class="device-timeline">
                ${allEvents.map(event => `
                    <div class="timeline-item">
                        <div class="flex items-start gap-3">
                            <div class="text-2xl">${event.icon}</div>
                            <div class="flex-1">
                                <h4 class="text-body-l-semibold dark:text-dark-base-600">${event.title}</h4>
                                <p class="text-body-s-regular dark:text-dark-base-500 mt-1">${formatDate(event.date)}</p>
                                ${event.details ? `<p class="text-body-m-regular dark:text-dark-base-600 mt-2">${event.details}</p>` : ''}
                                ${event.performer ? `<p class="text-body-s-regular dark:text-dark-base-500 mt-1">By: ${event.performer}</p>` : ''}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    content.innerHTML = historyHTML;
    modal.classList.remove("hidden");
}

// Close device history modal
function closeDeviceHistoryModal() {
    const modal = document.getElementById("deviceHistoryModal");
    if (modal) {
        modal.classList.add("hidden");
    }
}

// View SIM history
async function viewSimHistory(deviceRegistrationNumber) {
    try {
        showInventoryLoadingOverlay();

        // Get SIM replacement history
        const { data: simHistory, error } = await supabase
            .from("sim_replacement_history")
            .select("*")
            .eq("device_registration_number", deviceRegistrationNumber)
            .order("replacement_date", { ascending: false });

        // Get current SIM assignment
        const { data: currentSim, error: currentSimError } = await supabase
            .from("device_sim_management")
            .select("*")
            .eq("device_registration_number", deviceRegistrationNumber)
            .single();

        hideInventoryLoadingOverlay();

        if (error || currentSimError) {
            console.error("Error loading SIM history:", { error, currentSimError });
            showInventoryToast("Error loading SIM history", "error");
            return;
        }

        // Display SIM history in modal
        displaySimHistory(deviceRegistrationNumber, {
            history: simHistory || [],
            current: currentSim
        });

    } catch (error) {
        console.error("Error viewing SIM history:", error);
        showInventoryToast("Error viewing SIM history", "error");
        hideInventoryLoadingOverlay();
    }
}

// Display SIM history in modal
function displaySimHistory(deviceRegistrationNumber, data) {
    const modal = document.getElementById("simHistoryModal");
    const content = document.getElementById("simHistoryContent");
    
    if (!modal || !content) return;

    const formatDate = (dateString) => {
        if (!dateString) return "N/A";
        return new Date(dateString).toLocaleString();
    };

    let historyHTML = `
        <div class="mb-6">
            <h3 class="text-heading-7 dark:text-dark-base-600 mb-4">SIM History for Device: ${deviceRegistrationNumber}</h3>
        </div>
    `;

    // Show current SIM
    if (data.current) {
        historyHTML += `
            <div class="mb-6 p-4 rounded-lg dark:bg-dark-success-600/20 dark:border dark:border-dark-success-600/30">
                <h4 class="text-body-l-semibold dark:text-dark-success-600 mb-2">Current SIM Assignment</h4>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <div class="device-info-label">SIM Number</div>
                        <div class="device-info-value">${data.current.current_sim_no || 'N/A'}</div>
                    </div>
                    <div>
                        <div class="device-info-label">Assigned Date</div>
                        <div class="device-info-value">${formatDate(data.current.assigned_date)}</div>
                    </div>
                    <div>
                        <div class="device-info-label">Status</div>
                        <div class="device-info-value">${data.current.status}</div>
                    </div>
                    <div>
                        <div class="device-info-label">Assigned By</div>
                        <div class="device-info-value">${data.current.assigned_by || 'N/A'}</div>
                    </div>
                </div>
                ${data.current.notes ? `
                <div class="mt-2">
                    <div class="device-info-label">Notes</div>
                    <div class="device-info-value">${data.current.notes}</div>
                </div>
                ` : ''}
            </div>
        `;
    }

    // Show replacement history
    if (data.history.length === 0) {
        historyHTML += `
            <div class="text-center py-8">
                <p class="text-body-l-regular dark:text-dark-base-500">No SIM replacement history found for this device</p>
            </div>
        `;
    } else {
        historyHTML += `
            <div class="mb-4">
                <h4 class="text-body-l-semibold dark:text-dark-base-600">Replacement History</h4>
            </div>
            <div class="space-y-4">
                ${data.history.map(replacement => `
                    <div class="p-4 rounded-lg dark:bg-dark-fill-base-400 dark:border dark:border-dark-stroke-contrast-400">
                        <div class="flex items-start justify-between mb-3">
                            <h5 class="text-body-m-semibold dark:text-dark-base-600">SIM Replacement</h5>
                            <span class="text-body-s-regular dark:text-dark-base-500">${formatDate(replacement.replacement_date)}</span>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <div class="device-info-label">Old SIM</div>
                                <div class="device-info-value">${replacement.old_sim_no || 'N/A'}</div>
                            </div>
                            <div>
                                <div class="device-info-label">New SIM</div>
                                <div class="device-info-value">${replacement.new_sim_no}</div>
                            </div>
                            <div>
                                <div class="device-info-label">Replaced By</div>
                                <div class="device-info-value">${replacement.replaced_by}</div>
                            </div>
                            <div>
                                <div class="device-info-label">Validated</div>
                                <div class="device-info-value">${replacement.validated ? 'Yes' : 'No'}</div>
                            </div>
                        </div>
                        ${replacement.replacement_reason ? `
                        <div class="mt-2">
                            <div class="device-info-label">Reason</div>
                            <div class="device-info-value">${replacement.replacement_reason}</div>
                        </div>
                        ` : ''}
                        ${replacement.validation_notes ? `
                        <div class="mt-2">
                            <div class="device-info-label">Validation Notes</div>
                            <div class="device-info-value">${replacement.validation_notes}</div>
                        </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    }

    content.innerHTML = historyHTML;
    modal.classList.remove("hidden");
}

// Close SIM history modal
function closeSimHistoryModal() {
    const modal = document.getElementById("simHistoryModal");
    if (modal) {
        modal.classList.add("hidden");
    }
}

// CSV Import Functions
function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add("drag-over");
}

function handleDragLeave(e) {
    e.preventDefault();
    e.currentTarget.classList.remove("drag-over");
}

function handleFileDrop(e, type) {
    e.preventDefault();
    e.currentTarget.classList.remove("drag-over");

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        if (file.type === "text/csv" || file.name.endsWith(".csv")) {
            processCSVFile(file, type);
        } else {
            showInventoryToast("Please select a valid CSV file", "error");
        }
    }
}

function handleCSVFileSelect(e, type) {
    const file = e.target.files[0];
    if (file) {
        if (file.type === "text/csv" || file.name.endsWith(".csv")) {
            processCSVFile(file, type);
        } else {
            showInventoryToast("Please select a valid CSV file", "error");
        }
    }
}

function processCSVFile(file, type) {
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
                validateAndImportCSV(results, file.name, type);
            },
            error: function (error) {
                console.error("CSV parsing error:", error);
                showInventoryToast("Error parsing CSV file", "error");
            },
        });
    };

    reader.onerror = function () {
        showInventoryToast("Error reading file", "error");
    };

    reader.readAsText(file);
}

async function validateAndImportCSV(results, filename, type) {
    try {
        const data = results.data;
        const headers = Object.keys(data[0] || {});

        let requiredColumns = [];
        if (type === 'inward') {
            requiredColumns = ["Device Registration Number", "Device IMEI", "Device Condition"];
        } else if (type === 'outward') {
            requiredColumns = ["Device Registration Number", "Device IMEI", "Customer Name", "Location", "Outward Date"];
        }

        // Validate headers
        const missingColumns = requiredColumns.filter(col => !headers.includes(col));
        if (missingColumns.length > 0) {
            showInventoryToast(`Missing required columns: ${missingColumns.join(", ")}`, "error");
            return;
        }

        // Show progress
        showImportProgress(type);

        // Validate and process data
        const validData = [];
        const errors = [];
        let processed = 0;

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            processed++;

            // Update progress
            updateImportProgress(type, (processed / data.length) * 50); // First 50% for validation

            const deviceRegNumber = row["Device Registration Number"];
            const deviceImei = row["Device IMEI"];

            if (!deviceRegNumber || !deviceImei) {
                errors.push(`Row ${i + 2}: Missing required data`);
                continue;
            }

            if (type === 'inward') {
                const deviceCondition = row["Device Condition"];
                if (!deviceCondition) {
                    errors.push(`Row ${i + 2}: Missing device condition`);
                    continue;
                }

                const inwardItem = {
                    device_registration_number: deviceRegNumber,
                    device_imei: deviceImei,
                    device_condition: deviceCondition,
                    notes: row["Notes"] || null,
                    processed_by: userSession?.email || "unknown"
                };

                validData.push(inwardItem);
            } else if (type === 'outward') {
                const customerName = row["Customer Name"];
                const location = row["Location"];
                const outwardDate = row["Outward Date"];

                if (!customerName || !location || !outwardDate) {
                    errors.push(`Row ${i + 2}: Missing required outward data`);
                    continue;
                }

                // Find customer by name
                const customer = inventoryData.customers.find(c => 
                    c.customer_name.toLowerCase() === customerName.toLowerCase()
                );

                if (!customer) {
                    errors.push(`Row ${i + 2}: Customer "${customerName}" not found`);
                    continue;
                }

                const outwardItem = {
                    device_registration_number: deviceRegNumber,
                    device_imei: deviceImei,
                    customer_id: customer.id,
                    customer_name: customer.customer_name,
                    location: location,
                    outward_date: outwardDate,
                    sim_no: row["SIM No"] || null,
                    notes: row["Notes"] || null,
                    processed_by: userSession?.email || "unknown"
                };

                validData.push(outwardItem);
            }
        }

        // Import valid data
        let successfulImports = 0;
        if (validData.length > 0) {
            for (let i = 0; i < validData.length; i++) {
                updateImportProgress(type, 50 + (i / validData.length) * 50); // 50-100% for import

                const tableName = type === 'inward' ? 'inward_devices' : 'outward_devices';
                const { error } = await supabase
                    .from(tableName)
                    .insert([validData[i]]);

                if (error) {
                    console.error(`Error inserting ${type} device:`, error);
                    errors.push(`Failed to import device ${validData[i].device_registration_number}: ${error.message}`);
                } else {
                    successfulImports++;
                }
            }
        }

        // Log import results
        const importLog = {
            filename: filename,
            import_type: type,
            total_rows: data.length,
            successful_imports: successfulImports,
            failed_imports: data.length - successfulImports,
            error_details: errors.length > 0 ? { errors: errors } : null,
            imported_by: userSession?.email || "unknown",
        };

        await supabase.from("csv_import_logs").insert([importLog]);

        // Hide progress and show results
        hideImportProgress(type);
        showImportResults(type, successfulImports, data.length - successfulImports, errors);

        // Reload data
        await loadInventoryData();

        // Clear file input
        const fileInput = document.getElementById(`${type}CSVFileInput`);
        if (fileInput) {
            fileInput.value = "";
        }

    } catch (error) {
        console.error("Error importing CSV:", error);
        hideImportProgress(type);
        showInventoryToast("Error importing CSV data", "error");
    }
}

function showImportProgress(type) {
    const progressSection = document.getElementById(`${type}ImportProgressSection`);
    if (progressSection) {
        progressSection.classList.remove("hidden");
        updateImportProgress(type, 0);
    }
}

function updateImportProgress(type, percentage) {
    const progressBar = document.getElementById(`${type}ImportProgressBar`);
    const progressText = document.getElementById(`${type}ImportProgressText`);

    if (progressBar) {
        progressBar.style.width = `${percentage}%`;
    }
    if (progressText) {
        progressText.textContent = `${Math.round(percentage)}%`;
    }
}

function hideImportProgress(type) {
    const progressSection = document.getElementById(`${type}ImportProgressSection`);
    if (progressSection) {
        progressSection.classList.add("hidden");
    }
}

function showImportResults(type, successful, failed, errors) {
    const resultsDiv = document.getElementById(`${type}ImportResults`);
    if (!resultsDiv) return;

    const isSuccess = failed === 0;
    resultsDiv.className = `import-results ${isSuccess ? "" : "error"}`;

    let resultHTML = `
        <div class="flex items-center gap-3 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${isSuccess ? "text-green-600" : "text-red-600"}">
                ${isSuccess
                    ? '<path d="M5 13l4 4L19 7"/>'
                    : '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="m12 17 .01 0"/>'
                }
            </svg>
            <div>
                <h4 class="text-body-l-semibold ${isSuccess ? "text-green-600" : "text-red-600"}">
                    ${type.charAt(0).toUpperCase() + type.slice(1)} Import ${isSuccess ? "Completed" : "Completed with Errors"}
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
                        ${errors
                            .slice(0, 10)
                            .map((error) => `<li>• ${error}</li>`)
                            .join("")}
                        ${errors.length > 10 ? `<li>• ... and ${errors.length - 10} more errors</li>` : ""}
                    </ul>
                </div>
            </div>
        `;
    }

    resultsDiv.innerHTML = resultHTML;
    resultsDiv.classList.remove("hidden");

    // Auto-hide after 10 seconds
    setTimeout(() => {
        resultsDiv.classList.add("hidden");
    }, 10000);

    // Show toast
    if (isSuccess) {
        showInventoryToast(`✅ Successfully imported ${successful} ${type} devices`, "success");
    } else {
        showInventoryToast(`Import completed: ${successful} successful, ${failed} failed`, "warning");
    }
}

// Search functionality
function handleInventorySearch() {
    const searchTerm = document.getElementById("inventorySearchInput").value.toLowerCase().trim();

    if (currentInventoryTab === "device-management") {
        if (currentDeviceTab === "inward") {
            filteredInventoryData.inwardDevices = inventoryData.inwardDevices.filter((device) => {
                return !searchTerm ||
                    device.device_registration_number.toLowerCase().includes(searchTerm) ||
                    device.device_imei.toLowerCase().includes(searchTerm) ||
                    device.device_condition.toLowerCase().includes(searchTerm) ||
                    (device.notes && device.notes.toLowerCase().includes(searchTerm));
            });
            updateInwardDevicesList();
        } else if (currentDeviceTab === "outward") {
            filteredInventoryData.outwardDevices = inventoryData.outwardDevices.filter((device) => {
                const customerName = device.customers ? device.customers.customer_name : device.customer_name;
                return !searchTerm ||
                    device.device_registration_number.toLowerCase().includes(searchTerm) ||
                    device.device_imei.toLowerCase().includes(searchTerm) ||
                    customerName.toLowerCase().includes(searchTerm) ||
                    device.location.toLowerCase().includes(searchTerm) ||
                    (device.sim_no && device.sim_no.toLowerCase().includes(searchTerm)) ||
                    (device.notes && device.notes.toLowerCase().includes(searchTerm));
            });
            updateOutwardDevicesList();
        }
    } else if (currentInventoryTab === "sim-management") {
        filteredInventoryData.simManagement = inventoryData.simManagement.filter((sim) => {
            return !searchTerm ||
                sim.device_registration_number.toLowerCase().includes(searchTerm) ||
                sim.device_imei.toLowerCase().includes(searchTerm) ||
                (sim.current_sim_no && sim.current_sim_no.toLowerCase().includes(searchTerm));
        });
        updateSimManagementTable();
    }

    if (searchTerm) {
        const totalFiltered = currentInventoryTab === "device-management" 
            ? (currentDeviceTab === "inward" ? filteredInventoryData.inwardDevices.length : filteredInventoryData.outwardDevices.length)
            : filteredInventoryData.simManagement.length;
        showInventoryToast(`Found ${totalFiltered} items`, "success");
    }
}

function clearInventorySearch() {
    const searchInput = document.getElementById("inventorySearchInput");
    if (searchInput) {
        searchInput.value = "";
    }
    
    // Reset filtered data
    filteredInventoryData.inwardDevices = [...inventoryData.inwardDevices];
    filteredInventoryData.outwardDevices = [...inventoryData.outwardDevices];
    filteredInventoryData.simManagement = [...inventoryData.simManagement];
    
    updateInventoryDisplay();
    showInventoryToast("Search cleared", "success");
}

// Loading overlay functions
function showInventoryLoadingOverlay() {
    const overlay = document.getElementById("inventoryLoadingOverlay");
    if (overlay) {
        overlay.classList.remove("hidden");
    }
}

function hideInventoryLoadingOverlay() {
    const overlay = document.getElementById("inventoryLoadingOverlay");
    if (overlay) {
        overlay.classList.add("hidden");
    }
}

// Toast notification function
function showInventoryToast(message, type = "success") {
    const toast = document.getElementById("inventoryToast");
    const messageEl = document.getElementById("inventoryToastMessage");
    const iconEl = document.getElementById("inventoryToastIcon");

    if (!toast || !messageEl || !iconEl) return;

    // Set message
    messageEl.textContent = message;

    // Set icon based on type
    let iconSVG = "";
    switch (type) {
        case "success":
            iconSVG = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>`;
            toast.className = "fixed top-4 right-4 z-50 max-w-sm p-4 rounded-lg shadow-lg success";
            break;
        case "error":
            iconSVG = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>`;
            toast.className = "fixed top-4 right-4 z-50 max-w-sm p-4 rounded-lg shadow-lg error";
            break;
        case "warning":
            iconSVG = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>`;
            toast.className = "fixed top-4 right-4 z-50 max-w-sm p-4 rounded-lg shadow-lg warning";
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
window.showDeviceManagementTab = showDeviceManagementTab;
window.showSimManagementTab = showSimManagementTab;
window.showInwardTab = showInwardTab;
window.showOutwardTab = showOutwardTab;
window.toggleInventoryAddMenu = toggleInventoryAddMenu;
window.showAddInwardForm = showAddInwardForm;
window.closeAddInwardForm = closeAddInwardForm;
window.showAddOutwardForm = showAddOutwardForm;
window.closeAddOutwardForm = closeAddOutwardForm;
window.clearInventorySearch = clearInventorySearch;
window.viewDeviceHistory = viewDeviceHistory;
window.closeDeviceHistoryModal = closeDeviceHistoryModal;
window.viewSimHistory = viewSimHistory;
window.closeSimHistoryModal = closeSimHistoryModal;

// Export functions for global access
window.inventoryFunctions = {
    goBackToDashboard,
    showDeviceManagementTab,
    showSimManagementTab,
    showInwardTab,
    showOutwardTab,
    toggleInventoryAddMenu,
    showAddInwardForm,
    closeAddInwardForm,
    showAddOutwardForm,
    closeAddOutwardForm,
    clearInventorySearch,
    viewDeviceHistory,
    closeDeviceHistoryModal,
    viewSimHistory,
    closeSimHistoryModal,
    loadInventoryData
};