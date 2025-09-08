// Supabase Configuration
const supabaseUrl = 'https://jcmjazindwonrplvjwxl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjbWphemluZHdvbnJwbHZqd3hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczMDEyNjMsImV4cCI6MjA3Mjg3NzI2M30.1B6sKnzrzdNFhvQUXVnRzzQnItFMaIFL0Y9WK_Gie9g';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Global variables
let sidebarExpanded = false;
let customers = [];
let leads = [];
let credentials = [];
let filteredCustomers = [];
let currentFilter = '';
let currentPOCAction = null;

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    updateTabHighlight('addTab');
    loadData();
    checkExpiredPOCs();
    setupEventListeners();
    setupRealtimeListeners();
    checkPOCReminders();
});

// Setup Event Listeners
function setupEventListeners() {
    // Login form
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // Forgot password form
    document.getElementById('forgotPasswordForm').addEventListener('submit', handleForgotPassword);
    
    // Add credential form
    document.getElementById('addCredentialForm').addEventListener('submit', handleAddCredential);
    
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

// Show/Hide Loading Overlay
function showLoadingOverlay() {
    document.getElementById('loadingOverlay').classList.remove('hidden');
}

function hideLoadingOverlay() {
    document.getElementById('loadingOverlay').classList.add('hidden');
}

// Show email toast notification
function showEmailToast(message) {
    const toast = document.getElementById('emailToast');
    const messageEl = document.getElementById('emailToastMessage');
    messageEl.textContent = message;
    toast.classList.remove('hidden');
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 300);
    }, 3000);
}

// Email Service Integration (Simulation)
async function sendEmail(type, customerData, additionalInfo = '') {
    try {
        // Log email to database
        const emailData = {
            customer_id: customerData.id,
            email_type: type,
            recipient_email: customerData.customer_email,
            subject: getEmailSubject(type, customerData.customer_name),
            message: getEmailMessage(type, customerData, additionalInfo),
            status: 'sent',
            sent_at: new Date().toISOString()
        };

        const { error } = await supabase
            .from('email_logs')
            .insert([emailData]);

        if (error) {
            console.error('Error logging email:', error);
        }

        // Update customer email tracking
        await supabase
            .from('customers')
            .update({
                email_notifications_sent: (customerData.email_notifications_sent || 0) + 1,
                last_email_sent: new Date().toISOString()
            })
            .eq('id', customerData.id);

        // Show success notification
        showEmailToast(`Email sent to ${customerData.customer_name} (${customerData.customer_email})`);
        
        // In real implementation, integrate with email service:
        // - SendGrid: await sendgrid.send(emailData)
        // - Mailgun: await mailgun.messages().send(emailData)
        // - AWS SES: await ses.sendEmail(emailData).promise()
        
        console.log(`📧 EMAIL SENT: ${getEmailSubject(type, customerData.customer_name)}`);
        console.log(`📧 To: ${customerData.customer_email}`);
        console.log(`📧 Message: ${getEmailMessage(type, customerData, additionalInfo)}`);
        
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
}

function getEmailSubject(type, customerName) {
    const subjects = {
        'poc_reminder': `POC Review Required - ${customerName}`,
        'poc_extended': `POC Extended - ${customerName}`,
        'poc_ended': `POC Concluded - ${customerName}`,
        'customer_onboarded': `Welcome to Cautio - ${customerName}`,
        'poc_started': `POC Started - ${customerName}`,
        'password_reset': `Password Reset Request - Cautio Dashboard`
    };
    return subjects[type] || `Notification - ${customerName}`;
}

function getEmailMessage(type, customerData, additionalInfo = '') {
    const messages = {
        'poc_reminder': `Dear ${customerData.customer_name},\n\nThis is a reminder that your POC requires review. Please contact your account manager ${customerData.account_manager_name} for next steps.\n\nBest regards,\nCautio Team`,
        'poc_extended': `Dear ${customerData.customer_name},\n\nYour POC has been extended by 10 days. ${additionalInfo}\n\nNew end date: ${additionalInfo}\n\nBest regards,\nCautio Team`,
        'poc_ended': `Dear ${customerData.customer_name},\n\nYour POC period has concluded. Thank you for trying Cautio. Please contact us if you'd like to continue with our services.\n\nBest regards,\nCautio Team`,
        'customer_onboarded': `Dear ${customerData.customer_name},\n\nWelcome to Cautio! We're excited to have you onboard. Your account manager ${customerData.account_manager_name} will be in touch soon.\n\nBest regards,\nCautio Team`,
        'poc_started': `Dear ${customerData.customer_name},\n\nYour POC has started successfully. Duration: ${additionalInfo}.\n\nYour account manager: ${customerData.account_manager_name}\n\nBest regards,\nCautio Team`
    };
    return messages[type] || `Dear ${customerData.customer_name},\n\nThank you for choosing Cautio.\n\nBest regards,\nCautio Team`;
}

// Forgot Password Page Functions
function showForgotPasswordPage() {
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('forgotPasswordPage').classList.remove('hidden');
    document.getElementById('dashboardPage').classList.add('hidden');
}

function backToLogin() {
    document.getElementById('forgotPasswordPage').classList.add('hidden');
    document.getElementById('loginPage').classList.remove('hidden');
    document.getElementById('dashboardPage').classList.add('hidden');
    document.getElementById('forgotPasswordForm').reset();
}

async function handleForgotPassword(e) {
    e.preventDefault();
    
    showLoadingOverlay();
    const formData = new FormData(e.target);
    const email = formData.get('resetEmail');
    
    // Generate reset token
    const resetToken = generateResetToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiry
    
    try {
        // Save reset request to database
        const { error: resetError } = await supabase
            .from('password_reset_requests')
            .insert([{
                email: email,
                reset_token: resetToken,
                expires_at: expiresAt.toISOString(),
                used: false
            }]);

        if (resetError) {
            console.error('Error creating reset request:', resetError);
            throw resetError;
        }

        // Log the password reset email
        const { error: emailError } = await supabase
            .from('email_logs')
            .insert([{
                customer_id: null,
                email_type: 'password_reset',
                recipient_email: email,
                subject: 'Password Reset Request - Cautio Dashboard',
                message: `A password reset link has been sent to ${email}. The link will expire in 1 hour. Reset token: ${resetToken}`,
                status: 'sent'
            }]);

        if (emailError) {
            console.error('Error logging email:', emailError);
        }
        
        hideLoadingOverlay();
        alert(`Password reset link has been sent to ${email}. Please check your email and follow the instructions.`);
        
        // Show email toast
        showEmailToast(`Password reset link sent to ${email}`);
        
        // Auto redirect back to login after 3 seconds
        setTimeout(() => {
            backToLogin();
        }, 3000);
        
    } catch (error) {
        hideLoadingOverlay();
        console.error('Error sending password reset:', error);
        alert('Error sending password reset email. Please try again.');
    }
}

function generateResetToken() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Add Credentials Functions
function showAddCredentials() {
    hideAllContent();
    document.getElementById('addCredentialsContent').classList.remove('hidden');
    updateMenuHighlight('credentials');
    loadCredentials();
}

async function loadCredentials() {
    try {
        const { data, error } = await supabase
            .from('user_credentials')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error loading credentials:', error);
            return;
        }

        credentials = data || [];
        updateCredentialsList();
    } catch (error) {
        console.error('Error loading credentials:', error);
    }
}

function updateCredentialsList() {
    const credentialsList = document.getElementById('credentialsList');
    
    if (credentials.length === 0) {
        credentialsList.innerHTML = `
            <div class="text-center py-8">
                <p class="text-body-l-regular dark:text-dark-base-500">No users found</p>
            </div>
        `;
        return;
    }

    credentialsList.innerHTML = credentials.map(credential => `
        <div class="p-4 rounded-lg dark:bg-dark-fill-base-400 dark:border dark:border-dark-stroke-contrast-400">
            <div class="flex justify-between items-start mb-2">
                <div>
                    <h4 class="text-body-l-semibold dark:text-dark-base-600">${credential.full_name || 'N/A'}</h4>
                    <p class="text-body-m-regular dark:text-dark-base-500">${credential.email}</p>
                </div>
                <div class="flex items-center gap-2">
                    <span class="px-2 py-1 text-xs rounded-full ${getRoleBadgeClass(credential.role)} dark:text-utility-white">
                        ${credential.role.toUpperCase()}
                    </span>
                    <span class="px-2 py-1 text-xs rounded-full ${credential.is_active ? 'dark:bg-dark-success-600' : 'dark:bg-dark-semantic-danger-300'} dark:text-utility-white">
                        ${credential.is_active ? 'Active' : 'Inactive'}
                    </span>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-4 text-body-s-regular dark:text-dark-base-500">
                <div>
                    <span class="font-semibold">Department:</span> ${credential.department || 'N/A'}
                </div>
                <div>
                    <span class="font-semibold">Created:</span> ${new Date(credential.created_at).toLocaleDateString()}
                </div>
                <div>
                    <span class="font-semibold">Last Login:</span> ${credential.last_login ? new Date(credential.last_login).toLocaleDateString() : 'Never'}
                </div>
                <div>
                    <span class="font-semibold">Created By:</span> ${credential.created_by || 'N/A'}
                </div>
            </div>
            <div class="mt-3 flex gap-2">
                <button onclick="toggleCredentialStatus(${credential.id}, ${!credential.is_active})" class="px-3 py-1 text-xs rounded-lg ${credential.is_active ? 'dark:bg-dark-semantic-danger-300' : 'dark:bg-dark-success-600'} dark:text-utility-white hover:opacity-90">
                    ${credential.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button onclick="deleteCredential(${credential.id})" class="px-3 py-1 text-xs rounded-lg dark:bg-dark-semantic-danger-300 dark:text-utility-white hover:opacity-90">
                    Delete
                </button>
            </div>
        </div>
    `).join('');
}

function getRoleBadgeClass(role) {
    switch (role) {
        case 'admin': return 'dark:bg-dark-semantic-danger-300';
        case 'manager': return 'dark:bg-dark-warning-600';
        case 'user': return 'dark:bg-dark-info-600';
        default: return 'dark:bg-dark-stroke-base-400';
    }
}

async function handleAddCredential(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const credentialData = {
        full_name: formData.get('fullName'),
        email: formData.get('email'),
        password: formData.get('password'),
        role: formData.get('role'),
        department: formData.get('department'),
        is_active: true,
        created_by: 'admin', // In real app, get from current user session
        created_at: new Date().toISOString()
    };

    try {
        const { data, error } = await supabase
            .from('user_credentials')
            .insert([credentialData]);

        if (error) {
            console.error('Error saving credential:', error);
            if (error.code === '23505') { // Unique constraint violation
                alert('Error: Email already exists!');
            } else {
                alert('Error saving credential: ' + error.message);
            }
            return;
        }

        alert('User credential added successfully!');
        document.getElementById('addCredentialForm').reset();
        loadCredentials();
        
        // Show email notification
        showEmailToast(`User account created for ${credentialData.email}`);

    } catch (error) {
        console.error('Error saving credential:', error);
        alert('Error saving credential');
    }
}

async function toggleCredentialStatus(id, newStatus) {
    try {
        const { error } = await supabase
            .from('user_credentials')
            .update({ is_active: newStatus })
            .eq('id', id);

        if (error) {
            console.error('Error updating credential status:', error);
            alert('Error updating status: ' + error.message);
            return;
        }

        loadCredentials();
        showEmailToast(`User ${newStatus ? 'activated' : 'deactivated'} successfully`);
    } catch (error) {
        console.error('Error updating credential status:', error);
        alert('Error updating status');
    }
}

async function deleteCredential(id) {
    if (!confirm('Are you sure you want to delete this user credential?')) {
        return;
    }

    try {
        const { error } = await supabase
            .from('user_credentials')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting credential:', error);
            alert('Error deleting credential: ' + error.message);
            return;
        }

        loadCredentials();
        showEmailToast('User credential deleted successfully');
    } catch (error) {
        console.error('Error deleting credential:', error);
        alert('Error deleting credential');
    }
}

function toggleNewUserPasswordVisibility() {
    const passwordField = document.getElementById('newUserPassword');
    const type = passwordField.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordField.setAttribute('type', type);
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

    // Listen for credential changes
    supabase
        .channel('credentials')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_credentials' }, 
            (payload) => {
                console.log('Credential change received!', payload);
                loadCredentials();
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

// Calculate days remaining for POC
function calculateDaysRemaining(endDate) {
    if (!endDate) return null;
    const today = new Date();
    const pocEnd = new Date(endDate);
    const diffTime = pocEnd - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

// Check for POC reminders (every 7 days)
async function checkPOCReminders() {
    try {
        const { data: pocCustomers, error } = await supabase
            .from('customers')
            .select('*')
            .in('poc_type', ['free_poc', 'paid_poc'])
            .neq('status', 'closed');

        if (error) {
            console.error('Error checking POC reminders:', error);
            return;
        }

        for (const customer of pocCustomers) {
            if (customer.poc_start_date) {
                const startDate = new Date(customer.poc_start_date);
                const today = new Date();
                const diffTime = today - startDate;
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                
                // Check if it's been 7 days or multiples of 7 days since start
                if (diffDays > 0 && diffDays % 7 === 0) {
                    // Send email reminder
                    await sendEmail('poc_reminder', customer, `${diffDays} days since POC start`);
                    
                    // Show action modal
                    showPOCActionModal(customer);
                }
            }
        }
    } catch (error) {
        console.error('Error processing POC reminders:', error);
    }
}

// Show POC Action Modal
function showPOCActionModal(customer) {
    currentPOCAction = customer;
    document.getElementById('pocCustomerName').textContent = customer.customer_name;
    document.getElementById('pocActionModal').classList.remove('hidden');
}

// Close POC Action Modal
function closePOCActionModal() {
    currentPOCAction = null;
    document.getElementById('pocActionModal').classList.add('hidden');
}

// Extend POC by 10 days - FIXED
async function extendPOC() {
    if (!currentPOCAction) return;
    
    try {
        const currentEndDate = new Date(currentPOCAction.poc_end_date);
        const newEndDate = new Date(currentEndDate);
        newEndDate.setDate(newEndDate.getDate() + 10);
        
        const { error } = await supabase
            .from('customers')
            .update({
                poc_end_date: newEndDate.toISOString().split('T')[0],
                last_extended: new Date().toISOString(),
                extension_count: (currentPOCAction.extension_count || 0) + 1,
                poc_extended_days: (currentPOCAction.poc_extended_days || 0) + 10
            })
            .eq('id', currentPOCAction.id);

        if (error) {
            console.error('Error extending POC:', error);
            alert('Error extending POC: ' + error.message);
        } else {
            alert(`POC extended by 10 days for ${currentPOCAction.customer_name}`);
            closePOCActionModal();
            loadData();
            
            // Send confirmation email
            await sendEmail('poc_extended', currentPOCAction, newEndDate.toDateString());
        }
    } catch (error) {
        console.error('Error extending POC:', error);
        alert('Error extending POC');
    }
}

// End POC
async function endPOC() {
    if (!currentPOCAction) return;
    
    try {
        const { error } = await supabase
            .from('customers')
            .update({
                status: 'closed',
                poc_end_date: new Date().toISOString().split('T')[0]
            })
            .eq('id', currentPOCAction.id);

        if (error) {
            console.error('Error ending POC:', error);
            alert('Error ending POC: ' + error.message);
        } else {
            alert(`POC ended for ${currentPOCAction.customer_name}`);
            closePOCActionModal();
            loadData();
            
            // Send confirmation email
            await sendEmail('poc_ended', currentPOCAction);
        }
    } catch (error) {
        console.error('Error ending POC:', error);
        alert('Error ending POC');
    }
}

// Onboard Customer
async function onboardCustomer() {
    if (!currentPOCAction) return;
    
    try {
        const { error } = await supabase
            .from('customers')
            .update({
                status: 'onboarded',
                poc_type: 'direct_onboarding',
                onboard_source: 'poc_conversion'
            })
            .eq('id', currentPOCAction.id);

        if (error) {
            console.error('Error onboarding customer:', error);
            alert('Error onboarding customer: ' + error.message);
        } else {
            alert(`${currentPOCAction.customer_name} has been onboarded successfully!`);
            closePOCActionModal();
            loadData();
            
            // Send confirmation email
            await sendEmail('customer_onboarded', currentPOCAction);
        }
    } catch (error) {
        console.error('Error onboarding customer:', error);
        alert('Error onboarding customer');
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
        pocList.innerHTML = pocCustomers.map(customer => createCustomerCard(customer, true)).join('');
    }
}

// Update onboarded tab - ENHANCED to show onboard source
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
        onboardedList.innerHTML = onboardedCustomers.map(customer => createCustomerCard(customer, false, true)).join('');
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

// Create customer card HTML - ENHANCED for onboard source tracking
function createCustomerCard(customer, showTimeRemaining = false, showOnboardSource = false) {
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

    const getOnboardSourceBadge = (onboardSource) => {
        if (!showOnboardSource) return '';
        
        if (onboardSource === 'direct') {
            return '<span class="px-2 py-1 text-xs rounded-full dark:bg-brand-blue-600 dark:text-utility-white">Direct Onboarded</span>';
        } else if (onboardSource === 'poc_conversion') {
            return '<span class="px-2 py-1 text-xs rounded-full dark:bg-dark-success-600 dark:text-utility-white">POC Converted</span>';
        }
        return '<span class="px-2 py-1 text-xs rounded-full dark:bg-dark-stroke-base-400 dark:text-dark-base-600">Unknown Source</span>';
    };

    const getTimeRemainingBadge = (endDate) => {
        if (!endDate) return '';
        const daysRemaining = calculateDaysRemaining(endDate);
        if (daysRemaining === null) return '';
        
        let badgeClass = 'dark:bg-dark-info-600';
        let text = `${daysRemaining} days left`;
        
        if (daysRemaining <= 0) {
            badgeClass = 'dark:bg-dark-semantic-danger-300';
            text = 'Expired';
        } else if (daysRemaining <= 3) {
            badgeClass = 'dark:bg-dark-warning-600';
            text = `${daysRemaining} days left`;
        }
        
        return `<span class="px-2 py-1 text-xs rounded-full ${badgeClass} dark:text-utility-white">${text}</span>`;
    };

    const extendButton = (customer.poc_type === 'free_poc' || customer.poc_type === 'paid_poc') && customer.status !== 'closed' ? 
        `<button onclick="showPOCActionModal(${JSON.stringify(customer).replace(/"/g, '&quot;')})" class="mt-2 px-3 py-1 text-xs rounded-lg dark:bg-brand-blue-600 dark:text-utility-white hover:dark:bg-brand-blue-500">
            Manage POC
        </button>` : '';

    const extensionInfo = customer.extension_count > 0 ? 
        `<div class="text-body-s-regular dark:text-dark-base-500">
            <span class="font-semibold">Extensions:</span> ${customer.extension_count} (${customer.poc_extended_days || 0} days)
        </div>` : '';

    return `
        <div class="p-4 rounded-lg dark:bg-dark-fill-base-300 dark:border dark:border-dark-stroke-contrast-400">
            <div class="flex justify-between items-start mb-3">
                <div>
                    <h4 class="text-body-l-semibold dark:text-dark-base-600">${customer.customer_name}</h4>
                    <p class="text-body-m-regular dark:text-dark-base-500">${customer.customer_email}</p>
                </div>
                <div class="flex flex-col gap-2 items-end">
                    ${getStatusBadge(customer.status, customer.poc_type)}
                    ${getOnboardSourceBadge(customer.onboard_source)}
                    ${showTimeRemaining ? getTimeRemainingBadge(customer.poc_end_date) : ''}
                </div>
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
                ${extensionInfo}
            </div>
            ${extendButton}
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
                
            // Send expired POC email
            await sendEmail('poc_ended', customer, 'POC expired automatically');
        }

        if (expiredPOCs.length > 0) {
            console.log(`Moved ${expiredPOCs.length} expired POCs to closed leads`);
            loadData(); // Refresh data
        }
    } catch (error) {
        console.error('Error processing expired POCs:', error);
    }
}

// Login functionality - ENHANCED with database credential checking
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    showLoadingOverlay();
    
    try {
        // Check credentials in database
        const { data: users, error } = await supabase
            .from('user_credentials')
            .select('*')
            .eq('email', email)
            .eq('password', password)
            .eq('is_active', true);

        setTimeout(() => {
            hideLoadingOverlay();
            
            if (error) {
                console.error('Error checking credentials:', error);
                alert('Error checking credentials. Please try again.');
                return;
            }

            if (users && users.length > 0) {
                const user = users[0];
                
                // Update last login
                supabase
                    .from('user_credentials')
                    .update({ last_login: new Date().toISOString() })
                    .eq('id', user.id);

                // Navigate to dashboard
                document.getElementById('loginPage').classList.add('hidden');
                document.getElementById('forgotPasswordPage').classList.add('hidden');
                document.getElementById('dashboardPage').classList.remove('hidden');
                
                showCustomersOverview();
                loadData();
                
                showEmailToast(`Welcome back, ${user.full_name || user.email}!`);
            } else {
                alert('Invalid credentials. Please check your email and password.');
            }
        }, 2000); // 2 second loading simulation
        
    } catch (error) {
        hideLoadingOverlay();
        console.error('Error during login:', error);
        alert('Error during login. Please try again.');
    }
}

// Toggle password visibility
function togglePasswordVisibility() {
    const passwordField = document.getElementById('loginPassword');
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
    document.getElementById('addCredentialsContent').classList.add('hidden');
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
            (activeMenu === 'ground' && onclick && onclick.includes('showGroundOperations')) ||
            (activeMenu === 'inventory' && onclick && onclick.includes('showInventoryManagement')) ||
            (activeMenu === 'credentials' && onclick && onclick.includes('showAddCredentials'))) {
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
        onboard_source: formData.get('pocType') === 'direct_onboarding' ? 'direct' : 'poc_conversion',
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
            alert('Customer saved successfully!');
            closeAddCustomerForm();
            loadData();
            
            // Send welcome email
            if (data && data[0]) {
                if (customerData.poc_type !== 'direct_onboarding') {
                    const pocDuration = customerData.poc_start_date && customerData.poc_end_date ? 
                        `${customerData.poc_start_date} to ${customerData.poc_end_date}` : 'As discussed';
                    await sendEmail('poc_started', data[0], pocDuration);
                } else {
                    await sendEmail('customer_onboarded', data[0]);
                }
            }
        }
    } catch (error) {
        console.error('Error saving customer:', error);
        alert('Error saving customer');
    }
}

// Logout function
function logout() {
    document.getElementById('dashboardPage').classList.add('hidden');
    document.getElementById('forgotPasswordPage').classList.add('hidden');
    document.getElementById('loginPage').classList.remove('hidden');
    
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';
}

// Run checks periodically
setInterval(checkExpiredPOCs, 60 * 60 * 1000); // Every hour
setInterval(checkPOCReminders, 60 * 60 * 1000 * 24); // Every 24 hours
