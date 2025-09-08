// Supabase Configuration
const supabaseUrl = 'https://jcmjazindwonrplvjwxl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjbWphemluZHdvbnJwbHZqd3hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczMDEyNjMsImV4cCI6MjA3Mjg3NzI2M30.1B6sKnzrzdNFhvQUXVnRzzQnItFMaIFL0Y9WK_Gie9g';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Global variables
let sidebarExpanded = false;
let customers = [];
let leads = [];
let filteredCustomers = [];
let currentFilter = '';

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    updateTabHighlight('addTab');
    loadData();
    checkExpiredPOCs();
    setupEventListeners();
    setupRealtimeListeners();
});

// Setup Event Listeners
function setupEventListeners() {
    // Login form
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // Sidebar toggle
    document.getElementById('hamburgerBtn').addEventListener('click', toggleSidebar);
    
    // Sidebar hover
    const sidebar = document.getElementById('sidebar');
    sidebar.addEventListener('mouseenter', handleSidebarMouseEnter);
    sidebar.addEventListener('mouseleave', handleSidebarMouseLeave);
    
    // Search functionality
    document.getElementById('searchInput').addEventListener('input', handleSearch);
    
    // Form submissions
    document.getElementById('addLeadForm').addEventListener('submit', handleAddLead);
    document.getElementById('addCustomerForm').addEventListener('submit', handleAddCustomer);
}

// Supabase Real-time listeners
function setupRealtimeListeners() {
    // Listen for customer changes
    supabase
        .channel('customers')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, 
            (payload) => {
                console.log('Customer change received!', payload);
                loadData();
            }
        )
        .subscribe();

    // Listen for lead changes
    supabase
        .channel('leads')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, 
            (payload) => {
                console.log('Lead change received!', payload);
                loadData();
            }
        )
        .subscribe();
}

// Load data from Supabase
async function loadData() {
    try {
        // Load customers
        const { data: customerData, error: customerError } = await supabase
            .from('customers')
            .select('*')
            .order('created_at', { ascending: false });

        if (customerError) {
            console.error('Error loading customers:', customerError);
        } else {
            customers = customerData || [];
            filteredCustomers = [...customers];
        }

        // Load leads
        const { data: leadData, error: leadError } = await supabase
            .from('leads')
            .select('*')
            .order('created_at', { ascending: false });

        if (leadError) {
            console.error('Error loading leads:', leadError);
        } else {
            leads = leadData || [];
        }

        // Update UI
        updateCustomerCounts();
        updateTabsContent();
        applyCurrentFilter();
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// Update customer counts
function updateCustomerCounts() {
    const totalCustomers = customers.length;
    document.getElementById('totalCustomersDisplay').textContent = totalCustomers;
    document.getElementById('totalCustomersHeaderCount').textContent = totalCustomers;
}

// Update tabs content
function updateTabsContent() {
    updatePOCTab();
    updateOnboardedTab();
    updateClosedLeadsTab();
}

// Update POC tab
function updatePOCTab() {
    const pocCustomers = filteredCustomers.filter(customer => 
        (customer.poc_type === 'free_poc' || customer.poc_type === 'paid_poc') && 
        customer.status !== 'closed'
    );

    const pocList = document.getElementById('pocCustomersList');
    const pocEmpty = document.getElementById('pocEmptyState');

    if (pocCustomers.length === 0) {
        pocList.innerHTML = '';
        pocEmpty.style.display = 'block';
    } else {
        pocEmpty.style.display = 'none';
        pocList.innerHTML = pocCustomers.map(customer => createCustomerCard(customer)).join('');
    }
}

// Update onboarded tab
function updateOnboardedTab() {
    const onboardedCustomers = filteredCustomers.filter(customer => 
        customer.poc_type === 'direct_onboarding' || customer.status === 'onboarded'
    );

    const onboardedList = document.getElementById('onboardedCustomersList');
    const onboardedEmpty = document.getElementById('onboardedEmptyState');

    if (onboardedCustomers.length === 0) {
        onboardedList.innerHTML = '';
        onboardedEmpty.style.display = 'block';
    } else {
        onboardedEmpty.style.display = 'none';
        onboardedList.innerHTML = onboardedCustomers.map(customer => createCustomerCard(customer)).join('');
    }
}

// Update closed leads tab
function updateClosedLeadsTab() {
    const closedCustomers = filteredCustomers.filter(customer => customer.status === 'closed');

    const closedList = document.getElementById('closedLeadsList');
    const closedEmpty = document.getElementById('closedLeadsEmptyState');

    if (closedCustomers.length === 0) {
        closedList.innerHTML = '';
        closedEmpty.style.display = 'block';
    } else {
        closedEmpty.style.display = 'none';
        closedList.innerHTML = closedCustomers.map(customer => createCustomerCard(customer)).join('');
    }
}

// Create customer card HTML
function createCustomerCard(customer) {
    const formatDate = (dateString) => {
        if (!dateString) return 'Not set';
        return new Date(dateString).toLocaleDateString();
    };

    const getStatusBadge = (status, pocType) => {
        if (status === 'closed') return '<span class="px-2 py-1 text-xs rounded-full dark:bg-dark-semantic-danger-300 dark:text-utility-white">Closed</span>';
        if (pocType === 'direct_onboarding') return '<span class="px-2 py-1 text-xs rounded-full dark:bg-dark-success-600 dark:text-utility-white">Onboarded</span>';
        if (pocType === 'free_poc') return '<span class="px-2 py-1 text-xs rounded-full dark:bg-dark-info-600 dark:text-utility-white">Free POC</span>';
        if (pocType === 'paid_poc') return '<span class="px-2 py-1 text-xs rounded-full dark:bg-dark-warning-600 dark:text-utility-white">Paid POC</span>';
        return '<span class="px-2 py-1 text-xs rounded-full dark:bg-dark-stroke-base-400 dark:text-dark-base-600">Unknown</span>';
    };

    return `
        <div class="p-4 rounded-lg dark:bg-dark-fill-base-300 dark:border dark:border-dark-stroke-contrast-400">
            <div class="flex justify-between items-start mb-3">
                <div>
                    <h4 class="text-body-l-semibold dark:text-dark-base-600">${customer.customer_name}</h4>
                    <p class="text-body-m-regular dark:text-dark-base-500">${customer.customer_email}</p>
                </div>
                ${getStatusBadge(customer.status, customer.poc_type)}
            </div>
            <div class="grid grid-cols-2 gap-4 text-body-s-regular dark:text-dark-base-500">
                <div>
                    <span class="font-semibold">Mobile:</span> ${customer.customer_mobile}
                </div>
                <div>
                    <span class="font-semibold">Account Manager:</span> ${customer.account_manager_name}
                </div>
                <div>
                    <span class="font-semibold">POC Start:</span> ${formatDate(customer.poc_start_date)}
                </div>
                <div>
                    <span class="font-semibold">POC End:</span> ${formatDate(customer.poc_end_date)}
                </div>
            </div>
        </div>
    `;
}

// Check and move expired POCs to closed leads
async function checkExpiredPOCs() {
    const today = new Date().toISOString().split('T')[0];
    
    try {
        const { data: expiredPOCs, error } = await supabase
            .from('customers')
            .select('*')
            .lt('poc_end_date', today)
            .neq('status', 'closed')
            .in('poc_type', ['free_poc', 'paid_poc']);

        if (error) {
            console.error('Error checking expired POCs:', error);
            return;
        }

        // Update expired POCs to closed status
        for (const customer of expiredPOCs) {
            await supabase
                .from('customers')
                .update({ status: 'closed' })
                .eq('id', customer.id);
        }

        if (expiredPOCs.length > 0) {
            console.log(`Moved ${expiredPOCs.length} expired POCs to closed leads`);
            loadData(); // Refresh data
        }
    } catch (error) {
        console.error('Error processing expired POCs:', error);
    }
}

// Login functionality
function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    if (email === 'admin@gm.com' && password === 'admin123') {
        document.getElementById('loginPage').classList.add('hidden');
        document.getElementById('dashboardPage').classList.remove('hidden');
        showCustomersOverview();
        loadData();
    } else {
        alert('Invalid credentials. Please use admin@gm.com and admin123');
    }
}

// Toggle password visibility
function togglePasswordVisibility() {
    const passwordField = document.getElementById('password');
    const type = passwordField.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordField.setAttribute('type', type);
}

// Sidebar toggle functionality
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    
    if (sidebarExpanded) {
        sidebar.classList.remove('expanded');
        sidebar.classList.add('collapsed');
        mainContent.classList.remove('sidebar-expanded');
        mainContent.classList.add('sidebar-collapsed');
    } else {
        sidebar.classList.remove('collapsed');
        sidebar.classList.add('expanded');
        mainContent.classList.remove('sidebar-collapsed');
        mainContent.classList.add('sidebar-expanded');
    }
    
    sidebarExpanded = !sidebarExpanded;
}

// Sidebar hover functionality
function handleSidebarMouseEnter() {
    if (!sidebarExpanded) {
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('mainContent');
        
        sidebar.classList.remove('collapsed');
        sidebar.classList.add('expanded');
        mainContent.classList.remove('sidebar-collapsed');
        mainContent.classList.add('sidebar-expanded');
    }
}

function handleSidebarMouseLeave() {
    if (!sidebarExpanded) {
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('mainContent');
        
        sidebar.classList.remove('expanded');
        sidebar.classList.add('collapsed');
        mainContent.classList.remove('sidebar-expanded');
        mainContent.classList.add('sidebar-collapsed');
    }
}

// Search functionality
function handleSearch(e) {
    const searchTerm = e.target.value.toLowerCase().trim();
    currentFilter = searchTerm;
    applyCurrentFilter();
}

function applyCurrentFilter() {
    if (!currentFilter) {
        filteredCustomers = [...customers];
    } else {
        filteredCustomers = customers.filter(customer => {
            return (
                customer.customer_name.toLowerCase().includes(currentFilter) ||
                customer.customer_email.toLowerCase().includes(currentFilter) ||
                customer.customer_mobile.includes(currentFilter) ||
                customer.account_manager_name.toLowerCase().includes(currentFilter) ||
                (customer.lead_sources && customer.lead_sources.some(source => 
                    source.toLowerCase().includes(currentFilter)
                )) ||
                (customer.requirements && customer.requirements.some(req => 
                    req.toLowerCase().includes(currentFilter)
                ))
            );
        });
    }
    updateTabsContent();
}

function clearSearch() {
    document.getElementById('searchInput').value = '';
    currentFilter = '';
    applyCurrentFilter();
}

// Menu navigation functions
function showCustomersOverview() {
    hideAllContent();
    document.getElementById('customersOverviewContent').classList.remove('hidden');
    updateMenuHighlight('customers');
}

function showFinance() {
    hideAllContent();
    document.getElementById('financeContent').classList.remove('hidden');
    updateMenuHighlight('finance');
}

function showGroundOperations() {
    hideAllContent();
    document.getElementById('groundOperationsContent').classList.remove('hidden');
    updateMenuHighlight('ground');
}

function showInventoryManagement() {
    hideAllContent();
    document.getElementById('inventoryManagementContent').classList.remove('hidden');
    updateMenuHighlight('inventory');
}

function hideAllContent() {
    document.getElementById('customersOverviewContent').classList.add('hidden');
    document.getElementById('financeContent').classList.add('hidden');
    document.getElementById('groundOperationsContent').classList.add('hidden');
    document.getElementById('inventoryManagementContent').classList.add('hidden');
}

function updateMenuHighlight(activeMenu) {
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('dark:bg-brand-blue-600', 'dark:text-utility-white');
        item.classList.add('hover:dark:bg-dark-fill-base-600');
    });
    
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        const onclick = item.getAttribute('onclick');
        if ((activeMenu === 'customers' && onclick.includes('showCustomersOverview')) ||
            (activeMenu === 'finance' && onclick.includes('showFinance')) ||
            (activeMenu === 'ground' && onclick.includes('showGroundOperations')) ||
            (activeMenu === 'inventory' && onclick.includes('showInventoryManagement'))) {
            item.classList.add('dark:bg-brand-blue-600', 'dark:text-utility-white');
            item.classList.remove('hover:dark:bg-dark-fill-base-600');
        }
    });
}

// Dashboard tab functions
function showAddTab() {
    hideAllTabContent();
    document.getElementById('addTabContent').classList.remove('hidden');
    updateTabHighlight('addTab');
}

function showPOCTab() {
    hideAllTabContent();
    document.getElementById('pocTabContent').classList.remove('hidden');
    updateTabHighlight('pocTab');
}

function showOnboardedTab() {
    hideAllTabContent();
    document.getElementById('onboardedTabContent').classList.remove('hidden');
    updateTabHighlight('onboardedTab');
}

function showClosedLeadsTab() {
    hideAllTabContent();
    document.getElementById('closedLeadsTabContent').classList.remove('hidden');
    updateTabHighlight('closedLeadsTab');
}

function hideAllTabContent() {
    document.getElementById('addTabContent').classList.add('hidden');
    document.getElementById('pocTabContent').classList.add('hidden');
    document.getElementById('onboardedTabContent').classList.add('hidden');
    document.getElementById('closedLeadsTabContent').classList.add('hidden');
}

function updateTabHighlight(activeTabId) {
    document.querySelectorAll('.dashboard-tab').forEach(tab => {
        tab.classList.remove('border-brand-blue-600', 'dark:text-brand-blue-600');
        tab.classList.add('border-transparent');
    });
    
    const activeTab = document.getElementById(activeTabId);
    if (activeTab) {
        activeTab.classList.add('border-brand-blue-600', 'dark:text-brand-blue-600');
        activeTab.classList.remove('border-transparent');
    }
}

// Form modal functions
function showAddLeadForm() {
    document.getElementById('addLeadModal').classList.remove('hidden');
}

function closeAddLeadForm() {
    document.getElementById('addLeadModal').classList.add('hidden');
    document.getElementById('addLeadForm').reset();
}

function showAddCustomerForm() {
    document.getElementById('addCustomerModal').classList.remove('hidden');
}

function closeAddCustomerForm() {
    document.getElementById('addCustomerModal').classList.add('hidden');
    document.getElementById('addCustomerForm').reset();
}

// Form submission handlers
async function handleAddLead(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const leadData = {
        type: formData.get('type'),
        customer_name: formData.get('customerName'),
        contact: formData.get('contact'),
        fleet_size: parseInt(formData.get('fleetSize')),
        status: formData.get('status'),
        created_at: new Date().toISOString()
    };

    try {
        const { data, error } = await supabase
            .from('leads')
            .insert([leadData]);

        if (error) {
            console.error('Error saving lead:', error);
            alert('Error saving lead: ' + error.message);
        } else {
            alert('Lead saved successfully!');
            closeAddLeadForm();
            loadData();
        }
    } catch (error) {
        console.error('Error saving lead:', error);
        alert('Error saving lead');
    }
}

async function handleAddCustomer(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    
    // Get selected lead sources
    const leadSources = [];
    const leadSourceCheckboxes = document.querySelectorAll('input[name="leadSource"]:checked');
    leadSourceCheckboxes.forEach(checkbox => {
        leadSources.push(checkbox.value);
    });

    // Get selected requirements
    const requirements = [];
    const requirementCheckboxes = document.querySelectorAll('input[name="requirements"]:checked');
    requirementCheckboxes.forEach(checkbox => {
        requirements.push(checkbox.value);
    });

    const customerData = {
        account_manager_name: formData.get('accountManagerName'),
        account_manager_id: formData.get('accountManagerId'),
        customer_name: formData.get('customerName'),
        customer_mobile: formData.get('customerMobile'),
        customer_email: formData.get('customerEmail'),
        lead_sources: leadSources,
        requirements: requirements,
        poc_type: formData.get('pocType'),
        poc_start_date: formData.get('pocStartDate') || null,
        poc_end_date: formData.get('pocEndDate') || null,
        status: formData.get('pocType') === 'direct_onboarding' ? 'onboarded' : 'active',
        created_at: new Date().toISOString()
    };

    try {
        const { data, error } = await supabase
            .from('customers')
            .insert([customerData]);

        if (error) {
            console.error('Error saving customer:', error);
            alert('Error saving customer: ' + error.message);
        } else {
            alert('Customer saved successfully!');
            closeAddCustomerForm();
            loadData();
        }
    } catch (error) {
        console.error('Error saving customer:', error);
        alert('Error saving customer');
    }
}

// Logout function
function logout() {
    document.getElementById('dashboardPage').classList.add('hidden');
    document.getElementById('loginPage').classList.remove('hidden');
    
    document.getElementById('email').value = '';
    document.getElementById('password').value = '';
}

// Run expired POC check every hour
setInterval(checkExpiredPOCs, 60 * 60 * 1000);
