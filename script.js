// Supabase configuration
const SUPABASE_URL = 'https://fhqxjpjswcpvabvnzayf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZocXhqcGpzd2NwdmFidm56YXlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY2MzU4MzcsImV4cCI6MjA0MjIxMTgzN30.HX66s5iKQPUZAd0JLVz0YrAJGBUmx8BQKGB4Cjj_lrM';

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Global variables
let customers = [];
let leads = [];
let credentials = [];
let scheduledEmails = [];
let pendingApprovals = [];
let approvedCustomers = [];
let filteredCustomers = [];
let filteredLeads = [];
let currentFilter = '';
let currentPOCAction = null;
let currentEmailTarget = null;
let selectedCustomerId = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, checking session...');
    
    // Check if user is already logged in
    if (isUserLoggedIn()) {
        showDashboard();
    } else {
        showLoginPage();
    }
    
    // Set up form event handlers
    setupEventHandlers();
});

function setupEventHandlers() {
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Forgot password form
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');
    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', handleForgotPassword);
    }
    
    // Customer forms
    const addCustomerForm = document.getElementById('addCustomerForm');
    if (addCustomerForm) {
        addCustomerForm.addEventListener('submit', handleAddCustomer);
    }
    
    const addLeadForm = document.getElementById('addLeadForm');
    if (addLeadForm) {
        addLeadForm.addEventListener('submit', handleAddLead);
    }
    
    // Search inputs
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }
    
    const leadSearchInput = document.getElementById('leadSearchInput');
    if (leadSearchInput) {
        leadSearchInput.addEventListener('input', handleLeadSearch);
    }
    
    // POC Duration dropdown
    const pocDurationSelect = document.getElementById('pocDuration');
    if (pocDurationSelect) {
        pocDurationSelect.addEventListener('change', function() {
            const customDurationDiv = document.getElementById('customDurationDiv');
            if (this.value === 'custom') {
                customDurationDiv.classList.remove('hidden');
            } else {
                customDurationDiv.classList.add('hidden');
            }
        });
    }
    
    // Hamburger menu
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    if (hamburgerBtn) {
        hamburgerBtn.addEventListener('click', toggleSidebar);
    }
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', function(event) {
        const customerDropdown = document.getElementById('customerDropdown');
        const addMenu = document.getElementById('addMenu');
        
        if (customerDropdown && !event.target.closest('#selectedCustomerText') && !event.target.closest('#customerDropdown')) {
            customerDropdown.classList.add('hidden');
        }
        
        if (addMenu && !event.target.closest('#floatingAddBtn') && !event.target.closest('#addMenu')) {
            addMenu.classList.add('hidden');
        }
    });
}

// Authentication functions
function isUserLoggedIn() {
    return localStorage.getItem('userSession') !== null;
}

function saveUserSession(user) {
    localStorage.setItem('userSession', JSON.stringify(user));
}

function clearUserSession() {
    localStorage.removeItem('userSession');
}

function getCurrentUser() {
    const session = localStorage.getItem('userSession');
    return session ? JSON.parse(session) : null;
}

async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    // For demo purposes, using simple validation
    if (email === 'admin@cautio.com' && password === 'admin123') {
        saveUserSession({ email: email, role: 'admin' });
        showDashboard();
        showEmailToast('Login successful!');
    } else {
        alert('Invalid credentials. Use admin@cautio.com / admin123');
    }
}

async function handleForgotPassword(e) {
    e.preventDefault();
    
    const email = document.getElementById('resetEmail').value;
    
    if (!email) {
        alert('Please enter your email address');
        return;
    }
    
    // Simulate password reset
    alert(`Password reset link sent to ${email}`);
    showEmailToast(`Reset link sent to ${email}`);
    backToLogin();
}

function togglePasswordVisibility() {
    const passwordInput = document.getElementById('loginPassword');
    const eyeIcon = passwordInput.nextElementSibling.querySelector('svg');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        eyeIcon.innerHTML = `
            <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"></path>
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M10.5 8.5l3 3m0-3l-3 3"></path>
        `;
    } else {
        passwordInput.type = 'password';
        eyeIcon.innerHTML = `
            <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"></path>
            <circle cx="12" cy="12" r="3"></circle>
        `;
    }
}

// Page navigation functions
function showLoginPage() {
    document.getElementById('dashboardPage').classList.add('hidden');
    document.getElementById('forgotPasswordPage').classList.add('hidden');
    document.getElementById('loginPage').classList.remove('hidden');
}

function showForgotPasswordPage() {
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('dashboardPage').classList.add('hidden');
    document.getElementById('forgotPasswordPage').classList.remove('hidden');
}

function backToLogin() {
    document.getElementById('forgotPasswordPage').classList.add('hidden');
    document.getElementById('dashboardPage').classList.add('hidden');
    document.getElementById('loginPage').classList.remove('hidden');
}

function showDashboard() {
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('forgotPasswordPage').classList.add('hidden');
    document.getElementById('dashboardPage').classList.remove('hidden');
    
    // Load data and show customers overview by default
    loadData();
    showCustomersOverview();
}

// Data loading functions
async function loadData() {
    console.log('Loading data...');
    showLoadingOverlay();
    
    try {
        await Promise.all([
            loadCustomers(),
            loadLeads(),
            loadCredentials(),
            loadScheduledEmails(),
            loadStockData()
        ]);
        
        updateOverviewCards();
        updateCustomerDropdown();
        console.log('Data loaded successfully');
    } catch (error) {
        console.error('Error loading data:', error);
        showEmailToast('Error loading data', 'error');
    } finally {
        hideLoadingOverlay();
    }
}

async function loadCustomers() {
    try {
        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        customers = data || [];
        filteredCustomers = [...customers];
        
        // Separate into pending and approved
        pendingApprovals = customers.filter(c => c.approval_status === 'pending');
        approvedCustomers = customers.filter(c => c.approval_status === 'approved');
        
        console.log(`Loaded ${customers.length} customers`);
        return customers;
    } catch (error) {
        console.error('Error loading customers:', error);
        return [];
    }
}

async function loadLeads() {
    try {
        const { data, error } = await supabase
            .from('leads')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        leads = data || [];
        filteredLeads = [...leads];
        
        console.log(`Loaded ${leads.length} leads`);
        return leads;
    } catch (error) {
        console.error('Error loading leads:', error);
        return [];
    }
}

async function loadCredentials() {
    try {
        const { data, error } = await supabase
            .from('credentials')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        credentials = data || [];
        console.log(`Loaded ${credentials.length} credentials`);
        return credentials;
    } catch (error) {
        console.error('Error loading credentials:', error);
        return [];
    }
}

async function loadScheduledEmails() {
    try {
        const { data, error } = await supabase
            .from('scheduled_emails')
            .select('*')
            .order('scheduled_time', { ascending: true });

        if (error) throw error;

        scheduledEmails = data || [];
        console.log(`Loaded ${scheduledEmails.length} scheduled emails`);
        return scheduledEmails;
    } catch (error) {
        console.error('Error loading scheduled emails:', error);
        return [];
    }
}

async function loadStockData() {
    try {
        const { data, error } = await supabase
            .from('stock')
            .select('*');

        if (error) throw error;

        const stockItems = data || [];
        console.log(`Loaded ${stockItems.length} stock items`);
        
        // Update stock counts in overview
        const totalStock = stockItems.length;
        const availableStock = stockItems.filter(item => 
            item.status === 'available' && item.device_condition === 'good'
        ).length;
        
        // Update UI elements
        const totalStockElement = document.getElementById('totalStockCount');
        const availableStockElement = document.getElementById('availableStockCount');
        
        if (totalStockElement) totalStockElement.textContent = totalStock;
        if (availableStockElement) availableStockElement.textContent = availableStock;
        
        return stockItems;
    } catch (error) {
        console.error('Error loading stock data:', error);
        return [];
    }
}

// UI Update functions
function updateOverviewCards() {
    // Update customer counts
    document.getElementById('totalCustomersCount').textContent = customers.length;
    document.getElementById('activeCustomersCount').textContent = customers.filter(c => c.status === 'active').length;
    document.getElementById('onboardedCustomersCount').textContent = customers.filter(c => c.status === 'onboarded').length;
    document.getElementById('closedCustomersCount').textContent = customers.filter(c => c.status === 'closed').length;
    
    // Update leads count
    document.getElementById('totalLeadsCount').textContent = leads.length;
    
    // Update pending approvals count
    document.getElementById('pendingApprovalsCount').textContent = pendingApprovals.length;
}

function updateCustomerDropdown() {
    const dropdown = document.getElementById('customerDropdown');
    if (!dropdown) return;
    
    if (customers.length === 0) {
        dropdown.innerHTML = '<div class="p-4 text-center dark:text-dark-base-500">No customers found</div>';
        return;
    }
    
    let html = '<div class="p-2">';
    html += '<div class="p-2 text-body-s-semibold dark:text-dark-base-500 border-b dark:border-dark-stroke-contrast-400">Select Customer for Email</div>';
    
    customers.forEach(customer => {
        html += `
            <div class="p-3 hover:dark:bg-dark-fill-base-600 cursor-pointer rounded-lg" onclick="selectCustomer('${customer.id}', '${customer.customer_name}')">
                <div class="text-body-m-semibold dark:text-dark-base-600">${customer.customer_name}</div>
                <div class="text-body-s-regular dark:text-dark-base-500">${customer.customer_email}</div>
                <div class="text-body-s-regular dark:text-dark-base-500">Status: ${customer.status}</div>
            </div>
        `;
    });
    
    html += '</div>';
    dropdown.innerHTML = html;
}

// Sidebar functions
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    
    sidebar.classList.toggle('collapsed');
    mainContent.classList.toggle('sidebar-collapsed');
}

// Content display functions
function showFinance() {
    hideAllContent();
    document.getElementById('financeContent').classList.remove('hidden');
    updateMenuHighlight('finance');
    updateFinanceTab();
}

function updateFinanceTab() {
    updatePendingApprovals();
}

function updatePendingApprovals() {
    const container = document.getElementById('pendingApprovalsList');
    if (!container) return;
    
    if (pendingApprovals.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12">
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-4 dark:text-dark-base-500">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="16,12 12,8 8,12"/>
                    <line x1="12" y1="16" x2="12" y2="8"/>
                </svg>
                <h3 class="text-heading-6 dark:text-dark-base-600 mb-4">No Pending Approvals</h3>
                <p class="text-body-l-regular dark:text-dark-base-500">All customer submissions have been processed</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    pendingApprovals.forEach(customer => {
        html += `
            <div class="approval-card p-6 rounded-lg dark:bg-dark-fill-base-300 dark:border dark:border-dark-stroke-contrast-400">
                <div class="flex items-start justify-between mb-4">
                    <div>
                        <h3 class="text-heading-6 dark:text-dark-base-600 mb-2">${customer.customer_name}</h3>
                        <p class="text-body-m-regular dark:text-dark-base-500">${customer.customer_email}</p>
                        <p class="text-body-s-regular dark:text-dark-base-400">Account Manager: ${customer.account_manager_name}</p>
                    </div>
                    <div class="approval-status pending">
                        <span class="status-text">Pending</span>
                    </div>
                </div>
                
                <div class="customer-details mb-4">
                    <div class="grid grid-cols-2 gap-4 text-body-s-regular">
                        <div>
                            <span class="dark:text-dark-base-500">POC Type:</span>
                            <span class="dark:text-dark-base-600 ml-2">${customer.poc_type || 'N/A'}</span>
                        </div>
                        <div>
                            <span class="dark:text-dark-base-500">Duration:</span>
                            <span class="dark:text-dark-base-600 ml-2">${customer.poc_duration || 'N/A'} days</span>
                        </div>
                        <div>
                            <span class="dark:text-dark-base-500">Lead Sources:</span>
                            <span class="dark:text-dark-base-600 ml-2">${(customer.lead_sources || []).join(', ') || 'N/A'}</span>
                        </div>
                        <div>
                            <span class="dark:text-dark-base-500">Requirements:</span>
                            <span class="dark:text-dark-base-600 ml-2">${(customer.requirements || []).join(', ') || 'N/A'}</span>
                        </div>
                    </div>
                </div>
                
                <div class="approval-actions flex gap-3">
                    <button onclick="approveCustomer('${customer.id}')" class="flex-1 px-4 py-2 rounded-lg dark:bg-dark-success-600 dark:text-utility-white hover:dark:bg-dark-success-600/90 text-body-s-semibold">
                        Approve
                    </button>
                    <button onclick="rejectCustomer('${customer.id}')" class="flex-1 px-4 py-2 rounded-lg dark:bg-dark-semantic-danger-300 dark:text-utility-white hover:dark:bg-dark-semantic-danger-300/90 text-body-s-semibold">
                        Reject
                    </button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Customer approval functions
async function approveCustomer(customerId) {
    try {
        const customer = customers.find(c => c.id === customerId);
        if (!customer) return;
        
        // Calculate POC end date
        const startDate = customer.poc_start_date ? new Date(customer.poc_start_date) : new Date();
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + (customer.poc_duration || 30));
        
        const { error } = await supabase
            .from('customers')
            .update({
                approval_status: 'approved',
                poc_start_date: customer.poc_start_date || new Date().toISOString().split('T')[0],
                poc_end_date: endDate.toISOString().split('T')[0]
            })
            .eq('id', customerId);

        if (error) throw error;
        
        showEmailToast(`Customer "${customer.customer_name}" approved successfully`);
        loadData();
        
    } catch (error) {
        console.error('Error approving customer:', error);
        showEmailToast('Error approving customer', 'error');
    }
}

async function rejectCustomer(customerId) {
    if (!confirm('Are you sure you want to reject this customer?')) return;
    
    try {
        const customer = customers.find(c => c.id === customerId);
        if (!customer) return;
        
        const { error } = await supabase
            .from('customers')
            .update({
                approval_status: 'rejected',
                status: 'closed'
            })
            .eq('id', customerId);

        if (error) throw error;
        
        showEmailToast(`Customer "${customer.customer_name}" rejected`);
        loadData();
        
    } catch (error) {
        console.error('Error rejecting customer:', error);
        showEmailToast('Error rejecting customer', 'error');
    }
}

// Tab update functions
function updateAllTab() {
    updateCustomerList(filteredCustomers, 'allTabContent');
}

function updatePOCTab() {
    const pocCustomers = filteredCustomers.filter(c => 
        c.status === 'active' && c.approval_status === 'approved'
    );
    updateCustomerList(pocCustomers, 'pocTabContent');
}

function updateOnboardedTab() {
    const onboardedCustomers = filteredCustomers.filter(c => c.status === 'onboarded');
    updateCustomerList(onboardedCustomers, 'onboardedTabContent');
}

function updateClosedTab() {
    const closedCustomers = filteredCustomers.filter(c => c.status === 'closed');
    updateCustomerList(closedCustomers, 'closedTabContent');
}

function updateOngoingLeadsTab() {
    updateLeadsList(filteredLeads, 'ongoingLeadsTabContent');
}

function updateCustomerList(customerList, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const listContainer = container.querySelector('.customer-list') || container;
    
    if (customerList.length === 0) {
        listContainer.innerHTML = `
            <div class="text-center py-12">
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-4 dark:text-dark-base-500">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="m22 21-3-3"/>
                </svg>
                <h3 class="text-heading-6 dark:text-dark-base-600 mb-4">No Customers Found</h3>
                <p class="text-body-l-regular dark:text-dark-base-500">No customers match your current filter</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    customerList.forEach(customer => {
        const statusClass = getStatusClass(customer.status);
        const isExpiringSoon = isPOCExpiringSoon(customer);
        const daysLeft = getDaysLeft(customer.poc_end_date);
        
        html += `
            <div class="customer-card p-6 rounded-lg dark:bg-dark-fill-base-300 dark:border dark:border-dark-stroke-contrast-400 ${isExpiringSoon ? 'border-warning' : ''}">
                <div class="flex items-start justify-between mb-4">
                    <div class="flex-1">
                        <h3 class="text-heading-6 dark:text-dark-base-600 mb-2">${customer.customer_name}</h3>
                        <p class="text-body-m-regular dark:text-dark-base-500 mb-1">${customer.customer_email}</p>
                        <p class="text-body-s-regular dark:text-dark-base-400">Account Manager: ${customer.account_manager_name}</p>
                    </div>
                    <div class="flex flex-col items-end gap-2">
                        <div class="customer-status ${statusClass}">
                            <span class="status-dot"></span>
                            <span class="status-text">${customer.status}</span>
                        </div>
                        ${customer.approval_status === 'approved' && customer.poc_end_date ? `
                            <div class="text-body-s-regular ${isExpiringSoon ? 'dark:text-dark-warning-600' : 'dark:text-dark-base-500'}">
                                ${daysLeft > 0 ? `${daysLeft} days left` : 'Expired'}
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                ${customer.approval_status === 'approved' && customer.status === 'active' ? `
                    <div class="customer-actions flex gap-2 mb-4">
                        <button onclick="extendPOC('${customer.id}')" class="action-btn">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"/>
                                <polyline points="12,6 12,12 16,14"/>
                            </svg>
                            Extend
                        </button>
                        <button onclick="onboardCustomer('${customer.id}')" class="action-btn success">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="20,6 9,17 4,12"/>
                            </svg>
                            Onboard
                        </button>
                        <button onclick="closePOC('${customer.id}')" class="action-btn danger">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"/>
                                <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                            Close
                        </button>
                    </div>
                ` : ''}
                
                <div class="customer-details">
                    <div class="grid grid-cols-2 gap-4 text-body-s-regular">
                        ${customer.poc_type ? `
                            <div>
                                <span class="dark:text-dark-base-500">POC Type:</span>
                                <span class="dark:text-dark-base-600 ml-2">${customer.poc_type}</span>
                            </div>
                        ` : ''}
                        ${customer.poc_duration ? `
                            <div>
                                <span class="dark:text-dark-base-500">Duration:</span>
                                <span class="dark:text-dark-base-600 ml-2">${customer.poc_duration} days</span>
                            </div>
                        ` : ''}
                        ${customer.poc_start_date ? `
                            <div>
                                <span class="dark:text-dark-base-500">Start Date:</span>
                                <span class="dark:text-dark-base-600 ml-2">${formatDate(customer.poc_start_date)}</span>
                            </div>
                        ` : ''}
                        ${customer.poc_end_date ? `
                            <div>
                                <span class="dark:text-dark-base-500">End Date:</span>
                                <span class="dark:text-dark-base-600 ml-2">${formatDate(customer.poc_end_date)}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                <div class="customer-email-actions mt-4 pt-4 border-t dark:border-dark-stroke-contrast-400">
                    <div class="flex gap-2">
                        <button onclick="sendCustomEmail('${customer.id}', 'poc_reminder')" class="email-btn">
                            📧 POC Reminder
                        </button>
                        <button onclick="sendCustomEmail('${customer.id}', 'extension_offer')" class="email-btn">
                            📧 Extension Offer
                        </button>
                        <button onclick="sendCustomEmail('${customer.id}', 'onboarding_invitation')" class="email-btn">
                            📧 Onboarding Invite
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
    
    listContainer.innerHTML = html;
}

function updateLeadsList(leadsList, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const listContainer = container.querySelector('.leads-list') || container;
    
    if (leadsList.length === 0) {
        listContainer.innerHTML = `
            <div class="text-center py-12">
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-4 dark:text-dark-base-500">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22,4 12,14.01 9,11.01"/>
                </svg>
                <h3 class="text-heading-6 dark:text-dark-base-600 mb-4">No Leads Found</h3>
                <p class="text-body-l-regular dark:text-dark-base-500">No leads match your current filter</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    leadsList.forEach(lead => {
        const statusClass = getLeadStatusClass(lead.status);
        
        html += `
            <div class="lead-card p-6 rounded-lg dark:bg-dark-fill-base-300 dark:border dark:border-dark-stroke-contrast-400">
                <div class="flex items-start justify-between mb-4">
                    <div>
                        <h3 class="text-heading-6 dark:text-dark-base-600 mb-2">${lead.customer_name}</h3>
                        <p class="text-body-m-regular dark:text-dark-base-500">${lead.contact}</p>
                        <p class="text-body-s-regular dark:text-dark-base-400">Fleet Size: ${lead.fleet_size || 'N/A'}</p>
                    </div>
                    <div class="lead-status ${statusClass}">
                        <span class="status-dot"></span>
                        <span class="status-text">${lead.status}</span>
                    </div>
                </div>
                
                <div class="lead-details">
                    <div class="grid grid-cols-2 gap-4 text-body-s-regular">
                        <div>
                            <span class="dark:text-dark-base-500">Type:</span>
                            <span class="dark:text-dark-base-600 ml-2">${lead.type || 'N/A'}</span>
                        </div>
                        <div>
                            <span class="dark:text-dark-base-500">Created:</span>
                            <span class="dark:text-dark-base-600 ml-2">${formatDate(lead.created_at)}</span>
                        </div>
                    </div>
                </div>
                
                <div class="lead-actions mt-4 flex gap-2">
                    <button onclick="convertToCustomer('${lead.id}')" class="action-btn success">
                        Convert to Customer
                    </button>
                    <button onclick="updateLeadStatus('${lead.id}', 'closed')" class="action-btn danger">
                        Close Lead
                    </button>
                </div>
            </div>
        `;
    });
    
    listContainer.innerHTML = html;
}

// Customer action functions
async function extendPOC(customerId) {
    const days = prompt('Enter number of days to extend:', '7');
    if (!days || isNaN(days)) return;
    
    try {
        const customer = customers.find(c => c.id === customerId);
        if (!customer) return;
        
        const currentEndDate = new Date(customer.poc_end_date);
        const newEndDate = new Date(currentEndDate);
        newEndDate.setDate(newEndDate.getDate() + parseInt(days));
        
        const { error } = await supabase
            .from('customers')
            .update({
                poc_end_date: newEndDate.toISOString().split('T')[0],
                extension_count: (customer.extension_count || 0) + 1,
                poc_extended_days: (customer.poc_extended_days || 0) + parseInt(days)
            })
            .eq('id', customerId);

        if (error) throw error;
        
        showEmailToast(`POC extended by ${days} days for "${customer.customer_name}"`);
        loadData();
        
    } catch (error) {
        console.error('Error extending POC:', error);
        showEmailToast('Error extending POC', 'error');
    }
}

async function onboardCustomer(customerId) {
    if (!confirm('Are you sure you want to onboard this customer?')) return;
    
    try {
        const customer = customers.find(c => c.id === customerId);
        if (!customer) return;
        
        const { error } = await supabase
            .from('customers')
            .update({
                status: 'onboarded',
                onboard_source: 'poc_conversion'
            })
            .eq('id', customerId);

        if (error) throw error;
        
        showEmailToast(`Customer "${customer.customer_name}" onboarded successfully`);
        loadData();
        
    } catch (error) {
        console.error('Error onboarding customer:', error);
        showEmailToast('Error onboarding customer', 'error');
    }
}

async function closePOC(customerId) {
    if (!confirm('Are you sure you want to close this POC?')) return;
    
    try {
        const customer = customers.find(c => c.id === customerId);
        if (!customer) return;
        
        const { error } = await supabase
            .from('customers')
            .update({
                status: 'closed'
            })
            .eq('id', customerId);

        if (error) throw error;
        
        showEmailToast(`POC closed for "${customer.customer_name}"`);
        loadData();
        
    } catch (error) {
        console.error('Error closing POC:', error);
        showEmailToast('Error closing POC', 'error');
    }
}

// Lead action functions
async function convertToCustomer(leadId) {
    if (!confirm('Convert this lead to customer?')) return;
    
    try {
        const lead = leads.find(l => l.id === leadId);
        if (!lead) return;
        
        // Create customer from lead
        const customerData = {
            customer_name: lead.customer_name,
            customer_email: lead.contact,
            customer_mobile: '',
            account_manager_name: 'System Generated',
            account_manager_id: 'AUTO',
            lead_sources: ['converted_lead'],
            requirements: [],
            poc_type: 'poc',
            poc_duration: 30,
            status: 'active',
            approval_status: 'pending',
            onboard_source: 'lead_conversion',
            created_at: new Date().toISOString()
        };
        
        const { error } = await supabase
            .from('customers')
            .insert([customerData]);

        if (error) throw error;
        
        // Update lead status
        await supabase
            .from('leads')
            .update({ status: 'converted' })
            .eq('id', leadId);
        
        showEmailToast(`Lead "${lead.customer_name}" converted to customer`);
        loadData();
        
    } catch (error) {
        console.error('Error converting lead:', error);
        showEmailToast('Error converting lead', 'error');
    }
}

async function updateLeadStatus(leadId, status) {
    try {
        const lead = leads.find(l => l.id === leadId);
        if (!lead) return;
        
        const { error } = await supabase
            .from('leads')
            .update({ status })
            .eq('id', leadId);

        if (error) throw error;
        
        showEmailToast(`Lead "${lead.customer_name}" status updated to ${status}`);
        loadData();
        
    } catch (error) {
        console.error('Error updating lead status:', error);
        showEmailToast('Error updating lead status', 'error');
    }
}

// Email functions
async function sendCustomEmail(customerId, emailType) {
    try {
        const customer = customers.find(c => c.id === customerId);
        if (!customer) return;
        
        const emailData = {
            customer_id: customerId,
            customer_name: customer.customer_name,
            customer_email: customer.customer_email,
            email_type: emailType,
            status: 'sent',
            sent_at: new Date().toISOString(),
            created_at: new Date().toISOString()
        };
        
        const { error } = await supabase
            .from('sent_emails')
            .insert([emailData]);

        if (error) throw error;
        
        // Update customer email count
        await supabase
            .from('customers')
            .update({
                email_notifications_sent: (customer.email_notifications_sent || 0) + 1
            })
            .eq('id', customerId);
        
        showEmailToast(`${getEmailTypeLabel(emailType)} sent to "${customer.customer_name}"`);
        
    } catch (error) {
        console.error('Error sending email:', error);
        showEmailToast('Error sending email', 'error');
    }
}

function getEmailTypeLabel(emailType) {
    const labels = {
        'poc_reminder': 'POC Reminder',
        'extension_offer': 'Extension Offer',
        'onboarding_invitation': 'Onboarding Invitation',
        'expiry_warning': 'Expiry Warning',
        'closure_notice': 'Closure Notice'
    };
    return labels[emailType] || emailType;
}

// Search functions
function handleSearch(e) {
    currentFilter = e.target.value.toLowerCase().trim();
    filterCustomers();
    
    // Update current active tab
    const activeTab = document.querySelector('.tab-button.active');
    if (activeTab) {
        const tabId = activeTab.id;
        if (tabId === 'allTab') updateAllTab();
        else if (tabId === 'pocTab') updatePOCTab();
        else if (tabId === 'onboardedTab') updateOnboardedTab();
        else if (tabId === 'closedTab') updateClosedTab();
    }
}

function handleLeadSearch(e) {
    const filter = e.target.value.toLowerCase().trim();
    if (filter === '') {
        filteredLeads = [...leads];
    } else {
        filteredLeads = leads.filter(lead => 
            lead.customer_name.toLowerCase().includes(filter) ||
            lead.contact.toLowerCase().includes(filter) ||
            lead.type.toLowerCase().includes(filter) ||
            lead.status.toLowerCase().includes(filter)
        );
    }
    updateOngoingLeadsTab();
}

function filterCustomers() {
    if (currentFilter === '') {
        filteredCustomers = [...customers];
    } else {
        filteredCustomers = customers.filter(customer => 
            customer.customer_name.toLowerCase().includes(currentFilter) ||
            customer.customer_email.toLowerCase().includes(currentFilter) ||
            customer.account_manager_name.toLowerCase().includes(currentFilter) ||
            customer.status.toLowerCase().includes(currentFilter) ||
            (customer.lead_sources && customer.lead_sources.some(source => 
                source.toLowerCase().includes(currentFilter)
            )) ||
            (customer.requirements && customer.requirements.some(req => 
                req.toLowerCase().includes(currentFilter)
            ))
        );
    }
}

function clearSearch() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = '';
        currentFilter = '';
        filteredCustomers = [...customers];
        
        // Refresh current tab
        const searchEvent = { target: { value: currentFilter } };
        handleSearch(searchEvent);
    }
}

// Utility functions
function getStatusClass(status) {
    switch (status) {
        case 'active': return 'active';
        case 'onboarded': return 'success';
        case 'closed': return 'danger';
        default: return 'pending';
    }
}

function getLeadStatusClass(status) {
    switch (status) {
        case 'active': return 'active';
        case 'converted': return 'success';
        case 'closed': return 'danger';
        default: return 'pending';
    }
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
}

function isPOCExpiringSoon(customer) {
    if (!customer.poc_end_date || customer.status !== 'active') return false;
    
    const endDate = new Date(customer.poc_end_date);
    const today = new Date();
    const daysLeft = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
    
    return daysLeft <= 3 && daysLeft >= 0;
}

function getDaysLeft(endDate) {
    if (!endDate) return 0;
    
    const end = new Date(endDate);
    const today = new Date();
    return Math.ceil((end - today) / (1000 * 60 * 60 * 24));
}

// Loading overlay functions
function showLoadingOverlay() {
    document.getElementById('loadingOverlay').classList.remove('hidden');
}

function hideLoadingOverlay() {
    document.getElementById('loadingOverlay').classList.add('hidden');
}

// Toast notification functions
function showEmailToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 z-50 max-w-sm p-4 rounded-lg shadow-lg ${type === 'error' ? 'dark:bg-dark-semantic-danger-300' : 'dark:bg-dark-success-600'} dark:text-utility-white`;
    toast.innerHTML = `
        <div class="flex items-center">
            <span class="h-5 w-5 mr-2">
                ${type === 'error' ? '❌' : '✅'}
            </span>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Customer dropdown functions
function toggleCustomerDropdown() {
    const dropdown = document.getElementById('customerDropdown');
    dropdown.classList.toggle('hidden');
}

function selectCustomer(customerId, customerName) {
    selectedCustomerId = customerId;
    document.getElementById('selectedCustomerText').textContent = customerName;
    document.getElementById('customerDropdown').classList.add('hidden');
}

// Floating add button functions
function toggleAddMenu() {
    const addMenu = document.getElementById('addMenu');
    addMenu.classList.toggle('hidden');
}

// POC monitoring functions
function checkExpiredPOCs() {
    const today = new Date();
    const expiredPOCs = customers.filter(customer => {
        if (customer.status !== 'active' || !customer.poc_end_date) return false;
        const endDate = new Date(customer.poc_end_date);
        return endDate < today;
    });
    
    if (expiredPOCs.length > 0) {
        console.log(`Found ${expiredPOCs.length} expired POCs`);
        expiredPOCs.forEach(customer => {
            scheduleEmail(customer.id, 'expiry_warning', 'immediate');
        });
    }
}

function checkPOCReminders() {
    const today = new Date();
    const upcomingPOCs = customers.filter(customer => {
        if (customer.status !== 'active' || !customer.poc_end_date) return false;
        const endDate = new Date(customer.poc_end_date);
        const daysLeft = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
        return daysLeft === 3; // Remind 3 days before expiry
    });
    
    if (upcomingPOCs.length > 0) {
        console.log(`Found ${upcomingPOCs.length} POCs expiring soon`);
        upcomingPOCs.forEach(customer => {
            scheduleEmail(customer.id, 'poc_reminder', 'immediate');
        });
    }
}

async function scheduleEmail(customerId, emailType, timing) {
    try {
        const customer = customers.find(c => c.id === customerId);
        if (!customer) return;
        
        const emailData = {
            customer_id: customerId,
            customer_name: customer.customer_name,
            customer_email: customer.customer_email,
            email_type: emailType,
            scheduled_time: new Date().toISOString(),
            status: 'scheduled',
            created_at: new Date().toISOString()
        };
        
        const { error } = await supabase
            .from('scheduled_emails')
            .insert([emailData]);

        if (error) throw error;
        
        console.log(`Scheduled ${emailType} email for ${customer.customer_name}`);
        
    } catch (error) {
        console.error('Error scheduling email:', error);
    }
}

async function checkScheduledEmails() {
    try {
        const now = new Date();
        const { data, error } = await supabase
            .from('scheduled_emails')
            .select('*')
            .eq('status', 'scheduled')
            .lte('scheduled_time', now.toISOString());

        if (error) throw error;

        if (data && data.length > 0) {
            for (const email of data) {
                await sendScheduledEmail(email);
            }
        }
        
    } catch (error) {
        console.error('Error checking scheduled emails:', error);
    }
}

async function sendScheduledEmail(email) {
    try {
        // Mark email as sent
        const { error } = await supabase
            .from('scheduled_emails')
            .update({
                status: 'sent',
                sent_at: new Date().toISOString()
            })
            .eq('id', email.id);

        if (error) throw error;
        
        console.log(`Sent scheduled ${email.email_type} email to ${email.customer_name}`);
        
    } catch (error) {
        console.error('Error sending scheduled email:', error);
    }
}

// Stock/Inventory page navigation functions
function showStockPage() {
    window.location.href = 'stock.html';
}

function showInventoryPage() {
    window.location.href = 'inventory.html';
}

// Add credentials functions
function showAddCredentials() {
    hideAllContent();
    document.getElementById('addCredentialsContent').classList.remove('hidden');
    updateMenuHighlight('credentials');
    updateCredentialsTab();
}

function updateCredentialsTab() {
    updateCredentialsList();
}

function updateCredentialsList() {
    const container = document.getElementById('credentialsList');
    if (!container) return;
    
    if (credentials.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12">
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-4 dark:text-dark-base-500">
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                    <circle cx="12" cy="16" r="1"/>
                    <path d="m7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <h3 class="text-heading-6 dark:text-dark-base-600 mb-4">No Credentials</h3>
                <p class="text-body-l-regular dark:text-dark-base-500">No credentials have been added yet</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    credentials.forEach(credential => {
        html += `
            <div class="credential-card p-6 rounded-lg dark:bg-dark-fill-base-300 dark:border dark:border-dark-stroke-contrast-400">
                <div class="flex items-start justify-between mb-4">
                    <div>
                        <h3 class="text-heading-6 dark:text-dark-base-600 mb-2">${credential.service_name}</h3>
                        <p class="text-body-m-regular dark:text-dark-base-500">${credential.username || credential.email}</p>
                        <p class="text-body-s-regular dark:text-dark-base-400">Added: ${formatDate(credential.created_at)}</p>
                    </div>
                    <div class="credential-status">
                        <span class="status-dot success"></span>
                        <span class="status-text">Active</span>
                    </div>
                </div>
                
                <div class="credential-details">
                    <div class="grid grid-cols-2 gap-4 text-body-s-regular">
                        ${credential.api_endpoint ? `
                            <div>
                                <span class="dark:text-dark-base-500">API Endpoint:</span>
                                <span class="dark:text-dark-base-600 ml-2">${credential.api_endpoint}</span>
                            </div>
                        ` : ''}
                        ${credential.environment ? `
                            <div>
                                <span class="dark:text-dark-base-500">Environment:</span>
                                <span class="dark:text-dark-base-600 ml-2">${credential.environment}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                <div class="credential-actions mt-4 flex gap-2">
                    <button onclick="testCredential('${credential.id}')" class="action-btn">
                        Test Connection
                    </button>
                    <button onclick="editCredential('${credential.id}')" class="action-btn">
                        Edit
                    </button>
                    <button onclick="deleteCredential('${credential.id}')" class="action-btn danger">
                        Delete
                    </button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

async function testCredential(credentialId) {
    try {
        const credential = credentials.find(c => c.id === credentialId);
        if (!credential) return;
        
        // Simulate credential testing
        showEmailToast(`Testing connection to ${credential.service_name}...`);
        
        setTimeout(() => {
            showEmailToast(`Connection to ${credential.service_name} successful`);
        }, 1500);
        
    } catch (error) {
        console.error('Error testing credential:', error);
        showEmailToast('Error testing credential', 'error');
    }
}

function editCredential(credentialId) {
    showEmailToast('Edit credential functionality coming soon');
}

async function deleteCredential(credentialId) {
    if (!confirm('Are you sure you want to delete this credential?')) return;
    
    try {
        const credential = credentials.find(c => c.id === credentialId);
        if (!credential) return;
        
        const { error } = await supabase
            .from('credentials')
            .delete()
            .eq('id', credentialId);

        if (error) throw error;
        
        showEmailToast(`Credential for ${credential.service_name} deleted`);
        loadData();
        
    } catch (error) {
        console.error('Error deleting credential:', error);
        showEmailToast('Error deleting credential', 'error');
    }
}

// Menu navigation functions
function showCustomersOverview() {
    hideAllContent();
    document.getElementById('customersOverviewContent').classList.remove('hidden');
    document.getElementById('floatingAddBtn').classList.remove('hidden');
    updateMenuHighlight('customers');
}

function showGroundOperations() {
    hideAllContent();
    document.getElementById('groundOperationsContent').classList.remove('hidden');
    updateMenuHighlight('ground');
}

function showStock() {
    // Use the full stock page instead of placeholder content
    showStockPage();
}

function showInventoryManagement() {
    // Use the full inventory page instead of placeholder content
    showInventoryPage();
}

function hideAllContent() {
    document.getElementById('customersOverviewContent').classList.add('hidden');
    document.getElementById('financeContent').classList.add('hidden');
    document.getElementById('groundOperationsContent').classList.add('hidden');
    document.getElementById('inventoryManagementContent').classList.add('hidden');
    document.getElementById('stockContent').classList.add('hidden');
    document.getElementById('addCredentialsContent').classList.add('hidden');
    document.getElementById('floatingAddBtn').classList.add('hidden');
}

function updateMenuHighlight(activeMenu) {
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('dark:bg-brand-blue-600', 'dark:text-utility-white');
        item.classList.add('hover:dark:bg-dark-fill-base-600');
    });
    
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        const onclick = item.getAttribute('onclick');
        if ((activeMenu === 'customers' && onclick && onclick.includes('showCustomersOverview')) ||
            (activeMenu === 'finance' && onclick && onclick.includes('showFinance')) ||
            (activeMenu === 'stock' && onclick && onclick.includes('showStock')) ||
            (activeMenu === 'ground' && onclick && onclick.includes('showGroundOperations')) ||
            (activeMenu === 'inventory' && onclick && onclick.includes('showInventoryManagement')) ||
            (activeMenu === 'credentials' && onclick && onclick.includes('showAddCredentials'))) {
            item.classList.add('dark:bg-brand-blue-600', 'dark:text-utility-white');
            item.classList.remove('hover:dark:bg-dark-fill-base-600');
        }
    });
}

// Dashboard tab functions
function showAllTab() {
    hideAllTabContent();
    document.getElementById('allTabContent').classList.remove('hidden');
    updateTabHighlight('allTab');
    updateAllTab();
}

function showPOCTab() {
    hideAllTabContent();
    document.getElementById('pocTabContent').classList.remove('hidden');
    updateTabHighlight('pocTab');
    updatePOCTab();
}

function showOnboardedTab() {
    hideAllTabContent();
    document.getElementById('onboardedTabContent').classList.remove('hidden');
    updateTabHighlight('onboardedTab');
    updateOnboardedTab();
}

function showClosedTab() {
    hideAllTabContent();
    document.getElementById('closedTabContent').classList.remove('hidden');
    updateTabHighlight('closedTab');
    updateClosedTab();
}

function showOngoingLeadsTab() {
    hideAllTabContent();
    document.getElementById('ongoingLeadsTabContent').classList.remove('hidden');
    updateTabHighlight('ongoingLeadsTab');
    updateOngoingLeadsTab();
}

function hideAllTabContent() {
    document.getElementById('allTabContent').classList.add('hidden');
    document.getElementById('pocTabContent').classList.add('hidden');
    document.getElementById('onboardedTabContent').classList.add('hidden');
    document.getElementById('closedTabContent').classList.add('hidden');
    document.getElementById('ongoingLeadsTabContent').classList.add('hidden');
}

function updateTabHighlight(activeTabId) {
    document.querySelectorAll('.tab-button').forEach(tab => {
        tab.classList.remove('active');
    });
    
    if (activeTabId) {
        const activeTab = document.getElementById(activeTabId);
        if (activeTab) {
            activeTab.classList.add('active');
        }
    }
}

// Multi-step form functions
function goToStep2() {
    console.log('goToStep2 called - starting validation');
    
    // Simple validation - just check if key fields have something
    const form = document.getElementById('addCustomerForm');
    
    // Get field values using a safer method
    const managerNameField = form.querySelector('input[name="accountManagerName"]');
    const managerIdField = form.querySelector('input[name="accountManagerId"]');
    const custNameField = form.querySelector('input[name="customerName"]');
    const custMobileField = form.querySelector('input[name="customerMobile"]');
    const custEmailField = form.querySelector('input[name="customerEmail"]');
    
    // Get values safely
    const managerName = managerNameField ? managerNameField.value.trim() : '';
    const managerId = managerIdField ? managerIdField.value.trim() : '';
    const custName = custNameField ? custNameField.value.trim() : '';
    const custMobile = custMobileField ? custMobileField.value.trim() : '';
    const custEmail = custEmailField ? custEmailField.value.trim() : '';
    
    // Very basic validation
    if (managerName.length < 2) {
        alert('Please enter Account Manager Name');
        if (managerNameField) managerNameField.focus();
        return;
    }
    
    if (custName.length < 2) {
        alert('Please enter Customer Name');
        if (custNameField) custNameField.focus();
        return;
    }
    
    if (custEmail.length < 5) {
        alert('Please enter Customer Email');
        if (custEmailField) custEmailField.focus();
        return;
    }
    
    // Check lead source - but more forgiving
    const leadSources = form.querySelectorAll('input[name="leadSource"]:checked');
    
    if (leadSources.length === 0) {
        // Don't block, just warn
        if (!confirm('No lead source selected. Continue anyway?')) {
            return;
        }
    }

    // Proceed to step 2
    document.getElementById('step1Content').classList.add('hidden');
    document.getElementById('step2Content').classList.remove('hidden');
    
    // Update step indicator
    document.getElementById('step1Indicator').classList.remove('active');
    document.getElementById('step1Indicator').classList.add('completed');
    document.getElementById('step2Indicator').classList.add('active');
}

function goToStep1() {
    document.getElementById('step2Content').classList.add('hidden');
    document.getElementById('step1Content').classList.remove('hidden');
    
    // Update step indicator
    document.getElementById('step2Indicator').classList.remove('active');
    document.getElementById('step1Indicator').classList.remove('completed');
    document.getElementById('step1Indicator').classList.add('active');
}

// Form modal functions
function showAddLeadForm() {
    document.getElementById('addLeadModal').classList.remove('hidden');
    document.getElementById('addMenu').classList.add('hidden');
}

function closeAddLeadForm() {
    document.getElementById('addLeadModal').classList.add('hidden');
    document.getElementById('addLeadForm').reset();
}

function showAddCustomerForm() {
    document.getElementById('addCustomerModal').classList.remove('hidden');
    document.getElementById('addMenu').classList.add('hidden');
    // Reset to step 1
    goToStep1();
}

function closeAddCustomerForm() {
    document.getElementById('addCustomerModal').classList.add('hidden');
    document.getElementById('addCustomerForm').reset();
    document.getElementById('customDurationDiv').classList.add('hidden');
    // Reset to step 1
    goToStep1();
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
            showEmailToast(`Lead "${leadData.customer_name}" added successfully`);
        }
    } catch (error) {
        console.error('Error saving lead:', error);
        alert('Error saving lead');
    }
}

// Handle Add Customer
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

    // Get POC duration
    let pocDuration = parseInt(formData.get('pocDuration'));
    if (formData.get('pocDuration') === 'custom') {
        pocDuration = parseInt(formData.get('customDuration')) || 30;
    }

    const customerData = {
        account_manager_name: formData.get('accountManagerName'),
        account_manager_id: formData.get('accountManagerId'),
        customer_name: formData.get('customerName'),
        customer_mobile: formData.get('customerMobile'),
        customer_email: formData.get('customerEmail'),
        lead_sources: leadSources,
        requirements: requirements,
        poc_type: formData.get('pocType'),
        poc_duration: pocDuration,
        poc_start_date: formData.get('pocStartDate') || null,
        poc_end_date: null, // Will be set after approval
        status: formData.get('pocType') === 'direct_onboarding' ? 'onboarded' : 'active',
        onboard_source: formData.get('pocType') === 'direct_onboarding' ? 'direct' : 'poc_conversion',
        approval_status: 'pending', // Set to pending
        extension_count: 0,
        poc_extended_days: 0,
        email_notifications_sent: 0,
        created_at: new Date().toISOString()
    };

    try {
        const { data, error } = await supabase
            .from('customers')
            .insert([customerData])
            .select();

        if (error) {
            console.error('Error saving customer:', error);
            alert('Error saving customer: ' + error.message);
        } else {
            alert('Customer submitted successfully! Awaiting finance approval.');
            closeAddCustomerForm();
            loadData();
            
            // Navigate to Finance tab
            showFinance();
            
            showEmailToast(`Customer "${customerData.customer_name}" submitted for approval`);
        }
    } catch (error) {
        console.error('Error saving customer:', error);
        alert('Error saving customer');
    }
}

// Logout function
function logout() {
    // Clear session
    clearUserSession();
    
    // Reset UI
    document.getElementById('dashboardPage').classList.add('hidden');
    document.getElementById('forgotPasswordPage').classList.add('hidden');
    document.getElementById('loginPage').classList.remove('hidden');
    document.getElementById('floatingAddBtn').classList.add('hidden');
    
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';
    
    // Reset global variables
    customers = [];
    leads = [];
    credentials = [];
    scheduledEmails = [];
    pendingApprovals = [];
    approvedCustomers = [];
    filteredCustomers = [];
    filteredLeads = [];
    currentFilter = '';
    currentPOCAction = null;
    currentEmailTarget = null;
    selectedCustomerId = null;
    
    showEmailToast('Logged out successfully');
}

// Run checks periodically
setInterval(checkExpiredPOCs, 60 * 60 * 1000); // Every hour
setInterval(checkPOCReminders, 60 * 60 * 1000 * 24); // Every 24 hours
setInterval(checkScheduledEmails, 60 * 1000); // Every minute
