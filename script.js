// Supabase Configuration
const supabaseUrl = 'https://jcmjazindwonrplvjwxl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjbWphemluZHdvbnJwbHZqd3hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczMDEyNjMsImV4cCI6MjA3Mjg3NzI2M30.1B6sKnzrzdNFhvQUXVnRzzQnItFMaIFL0Y9WK_Gie9g';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Global variables
let sidebarExpanded = false;
let customers = [];
let leads = [];
let credentials = [];
let scheduledEmails = [];
let pendingApprovals = [];
let approvedCustomers = []; // NEW: Only approved customers
let filteredCustomers = [];
let filteredLeads = [];
let currentFilter = '';
let currentPOCAction = null;
let currentEmailTarget = null;
let userSession = null;
let searchTimeout = null;

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    updateTabHighlight('addTab');
    
    // Check for existing session
    checkUserSession();
    
    loadData();
    checkExpiredPOCs();
    setupEventListeners();
    setupRealtimeListeners();
    checkPOCReminders();
    
    // Start email scheduler
    startEmailScheduler();
    
    // Auto-save session every 30 seconds
    setInterval(saveUserSession, 30000);
});

// Session Management - Prevents logout on refresh
function saveUserSession() {
    if (userSession) {
        localStorage.setItem('cautio_user_session', JSON.stringify({
            user: userSession,
            timestamp: Date.now(),
            expires: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
        }));
    }
}

function checkUserSession() {
    const savedSession = localStorage.getItem('cautio_user_session');
    if (savedSession) {
        try {
            const sessionData = JSON.parse(savedSession);
            if (sessionData.expires > Date.now()) {
                // Valid session found
                userSession = sessionData.user;
                navigateToDashboard();
                showSessionRestored();
            } else {
                // Expired session
                localStorage.removeItem('cautio_user_session');
            }
        } catch (error) {
            console.error('Error parsing session:', error);
            localStorage.removeItem('cautio_user_session');
        }
    }
}

function clearUserSession() {
    userSession = null;
    localStorage.removeItem('cautio_user_session');
}

function showSessionRestored() {
    showEmailToast(`Welcome back, ${userSession.full_name || userSession.email}! Session restored.`);
}

// Email Scheduling System
async function startEmailScheduler() {
    // Load scheduled emails
    await loadScheduledEmails();
    
    // Check every minute for emails to send
    setInterval(checkScheduledEmails, 60000);
    
    console.log('📧 Email scheduler started');
}

async function loadScheduledEmails() {
    try {
        const { data, error } = await supabase
            .from('scheduled_emails')
            .select('*')
            .eq('status', 'pending')
            .order('scheduled_datetime', { ascending: true });

        if (error) {
            console.error('Error loading scheduled emails:', error);
            return;
        }

        scheduledEmails = data || [];
        console.log(`📧 Loaded ${scheduledEmails.length} scheduled emails`);
    } catch (error) {
        console.error('Error loading scheduled emails:', error);
    }
}

async function checkScheduledEmails() {
    const now = new Date();
    
    for (const scheduledEmail of scheduledEmails) {
        const scheduledTime = new Date(scheduledEmail.scheduled_datetime);
        
        if (scheduledTime <= now) {
            await processScheduledEmail(scheduledEmail);
        }
    }
}

async function processScheduledEmail(scheduledEmail) {
    try {
        // Get customer data
        const { data: customer, error: customerError } = await supabase
            .from('customers')
            .select('*')
            .eq('id', scheduledEmail.customer_id)
            .single();

        if (customerError) {
            console.error('Error fetching customer:', customerError);
            return;
        }

        // Send the email
        const emailSent = await sendEmail(
            scheduledEmail.email_type, 
            customer, 
            scheduledEmail.custom_message || ''
        );

        if (emailSent) {
            // Mark as sent
            await supabase
                .from('scheduled_emails')
                .update({ 
                    status: 'sent',
                    sent_at: new Date().toISOString()
                })
                .eq('id', scheduledEmail.id);

            // Remove from local array
            scheduledEmails = scheduledEmails.filter(e => e.id !== scheduledEmail.id);
            
            console.log(`📧 Sent scheduled email to ${customer.customer_name}`);
        }
    } catch (error) {
        console.error('Error processing scheduled email:', error);
        
        // Mark as failed
        await supabase
            .from('scheduled_emails')
            .update({ 
                status: 'failed',
                error_message: error.message
            })
            .eq('id', scheduledEmail.id);
    }
}

// Manual Email Scheduling
function showManualEmailModal(customer) {
    currentEmailTarget = customer;
    document.getElementById('selectedCustomerName').textContent = customer.customer_name;
    document.getElementById('manualEmailModal').classList.remove('hidden');
    
    // Set default date and time to tomorrow at 9 AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    
    document.querySelector('input[name="scheduleDate"]').value = tomorrow.toISOString().split('T')[0];
    document.querySelector('input[name="scheduleTime"]').value = '09:00';
}

function closeManualEmailModal() {
    currentEmailTarget = null;
    document.getElementById('manualEmailModal').classList.add('hidden');
    document.getElementById('manualEmailForm').reset();
    document.getElementById('customMessageDiv').classList.add('hidden');
}

async function handleManualEmailScheduling(e) {
    e.preventDefault();
    
    if (!currentEmailTarget) return;
    
    const formData = new FormData(e.target);
    const scheduleDate = formData.get('scheduleDate');
    const scheduleTime = formData.get('scheduleTime');
    const emailType = formData.get('emailType');
    const customMessage = formData.get('customMessage');
    
    const scheduledDateTime = new Date(`${scheduleDate}T${scheduleTime}`);
    
    try {
        const { error } = await supabase
            .from('scheduled_emails')
            .insert([{
                customer_id: currentEmailTarget.id,
                email_type: emailType,
                scheduled_datetime: scheduledDateTime.toISOString(),
                custom_message: emailType === 'custom' ? customMessage : null,
                status: 'pending',
                created_by: userSession?.email || 'admin',
                created_at: new Date().toISOString()
            }]);

        if (error) {
            console.error('Error scheduling email:', error);
            alert('Error scheduling email: ' + error.message);
            return;
        }

        alert(`Email scheduled for ${currentEmailTarget.customer_name} on ${scheduledDateTime.toLocaleString()}`);
        closeManualEmailModal();
        
        // Reload scheduled emails
        await loadScheduledEmails();
        
        showEmailToast(`Email scheduled for ${scheduledDateTime.toLocaleString()}`);
    } catch (error) {
        console.error('Error scheduling email:', error);
        alert('Error scheduling email');
    }
}

// Setup Event Listeners
function setupEventListeners() {
    // Login form
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // Forgot password form
    document.getElementById('forgotPasswordForm').addEventListener('submit', handleForgotPassword);
    
    // Add credential form
    document.getElementById('addCredentialForm').addEventListener('submit', handleAddCredential);
    
    // Manual email form
    document.getElementById('manualEmailForm').addEventListener('submit', handleManualEmailScheduling);
    
    // Email type change listener
    document.querySelector('select[name="emailType"]').addEventListener('change', function(e) {
        const customDiv = document.getElementById('customMessageDiv');
        if (e.target.value === 'custom') {
            customDiv.classList.remove('hidden');
        } else {
            customDiv.classList.add('hidden');
        }
    });

    // POC Duration change listener
    document.getElementById('pocDurationSelect').addEventListener('change', function(e) {
        const customDiv = document.getElementById('customDurationDiv');
        if (e.target.value === 'custom') {
            customDiv.classList.remove('hidden');
            customDiv.classList.add('show');
        } else {
            customDiv.classList.add('hidden');
            customDiv.classList.remove('show');
        }
    });
    
    // Sidebar toggle
    document.getElementById('hamburgerBtn').addEventListener('click', toggleSidebar);
    
    // Sidebar hover
    const sidebar = document.getElementById('sidebar');
    sidebar.addEventListener('mouseenter', handleSidebarMouseEnter);
    sidebar.addEventListener('mouseleave', handleSidebarMouseLeave);
    
    // Enhanced Search functionality
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', handleSearchInput);
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            performSearch(e.target.value);
        }
    });
    
    // Clear search button functionality
    searchInput.addEventListener('input', function(e) {
        const clearBtn = document.querySelector('.clear-search-btn');
        if (e.target.value.length > 0) {
            clearBtn.style.opacity = '1';
        } else {
            clearBtn.style.opacity = '0';
        }
    });
    
    // Form submissions
    document.getElementById('addLeadForm').addEventListener('submit', handleAddLead);
    document.getElementById('addCustomerForm').addEventListener('submit', handleAddCustomer);
}

// Enhanced Search Input Handler
function handleSearchInput(e) {
    const searchTerm = e.target.value.toLowerCase().trim();
    
    // Clear existing timeout
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }
    
    // Debounce search for 300ms
    searchTimeout = setTimeout(() => {
        performSearch(searchTerm);
    }, 300);
}

// Enhanced Search Function
function performSearch(searchTerm) {
    currentFilter = searchTerm;
    
    if (!searchTerm) {
        // If search is empty, show all approved data
        filteredCustomers = [...approvedCustomers];
        filteredLeads = [...leads];
        hideSearchResults();
    } else {
        // Filter approved customers only
        filteredCustomers = approvedCustomers.filter(customer => {
            return (
                customer.customer_name.toLowerCase().includes(searchTerm) ||
                customer.customer_email.toLowerCase().includes(searchTerm) ||
                customer.customer_mobile.includes(searchTerm) ||
                customer.account_manager_name.toLowerCase().includes(searchTerm) ||
                customer.account_manager_id.toLowerCase().includes(searchTerm) ||
                (customer.lead_sources && customer.lead_sources.some(source => 
                    source.toLowerCase().includes(searchTerm)
                )) ||
                (customer.requirements && customer.requirements.some(req => 
                    req.toLowerCase().includes(searchTerm)
                )) ||
                customer.poc_type.toLowerCase().includes(searchTerm) ||
                (customer.status && customer.status.toLowerCase().includes(searchTerm))
            );
        });

        // Filter leads
        filteredLeads = leads.filter(lead => {
            return (
                lead.customer_name.toLowerCase().includes(searchTerm) ||
                lead.contact.toLowerCase().includes(searchTerm) ||
                lead.status.toLowerCase().includes(searchTerm) ||
                lead.type.toLowerCase().includes(searchTerm) ||
                (lead.fleet_size && lead.fleet_size.toString().includes(searchTerm))
            );
        });

        showSearchResults(searchTerm);
    }
    
    // Update all tabs content
    updateTabsContent();
}

// Show Search Results
function showSearchResults(searchTerm) {
    const totalResults = filteredCustomers.length + filteredLeads.length;
    
    if (totalResults === 0) {
        showEmailToast(`No results found for "${searchTerm}"`);
    } else {
        showEmailToast(`Found ${totalResults} result(s) for "${searchTerm}"`);
    }
    
    // Add visual feedback to search input
    const searchInput = document.getElementById('searchInput');
    searchInput.style.borderColor = totalResults > 0 ? '#10b981' : '#ef4444';
    
    setTimeout(() => {
        searchInput.style.borderColor = '';
    }, 2000);
}

// Hide Search Results
function hideSearchResults() {
    const searchInput = document.getElementById('searchInput');
    searchInput.style.borderColor = '';
}

// Clear Search Function
function clearSearch() {
    const searchInput = document.getElementById('searchInput');
    searchInput.value = '';
    currentFilter = '';
    filteredCustomers = [...approvedCustomers];
    filteredLeads = [...leads];
    hideSearchResults();
    updateTabsContent();
    showEmailToast('Search cleared - showing all data');
    
    // Hide clear button
    const clearBtn = document.querySelector('.clear-search-btn');
    clearBtn.style.opacity = '0';
}

// Automatic 7-day Email System
async function checkPOCReminders() {
    try {
        const { data: pocCustomers, error } = await supabase
            .from('customers')
            .select('*')
            .in('poc_type', ['free_poc', 'paid_poc'])
            .neq('status', 'closed')
            .eq('approval_status', 'approved'); // Only approved customers

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
                
                // Check if it's been exactly 7, 14, 21, 28, etc. days since start
                if (diffDays > 0 && diffDays % 7 === 0) {
                    // Check if we already sent an email for this specific day
                    const { data: existingEmails, error: emailError } = await supabase
                        .from('email_logs')
                        .select('*')
                        .eq('customer_id', customer.id)
                        .eq('email_type', 'poc_reminder')
                        .gte('sent_at', new Date(today.setHours(0, 0, 0, 0)).toISOString());

                    if (emailError) {
                        console.error('Error checking existing emails:', emailError);
                        continue;
                    }

                    // If no email sent today, send reminder
                    if (existingEmails.length === 0) {
                        await sendEmail('poc_reminder', customer, `${diffDays} days since POC start`);
                        
                        // Show action modal for manual review
                        if (diffDays >= 14) { // Show modal after 2 weeks
                            showPOCActionModal(customer);
                        }
                        
                        console.log(`📧 Sent automatic POC reminder to ${customer.customer_name} (Day ${diffDays})`);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error processing POC reminders:', error);
    }
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

// Email Service Integration
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
        'password_reset': `Password Reset Request - Cautio Dashboard`,
        'followup': `Follow-up - ${customerName}`,
        'onboarding_reminder': `Onboarding Reminder - ${customerName}`,
        'custom': `Message from Cautio - ${customerName}`
    };
    return subjects[type] || `Notification - ${customerName}`;
}

function getEmailMessage(type, customerData, additionalInfo = '') {
    const messages = {
        'poc_reminder': `Dear ${customerData.customer_name},\n\nThis is a reminder that your POC requires review. Please contact your account manager ${customerData.account_manager_name} for next steps.\n\n${additionalInfo}\n\nBest regards,\nCautio Team`,
        'poc_extended': `Dear ${customerData.customer_name},\n\nYour POC has been extended by ${additionalInfo} days.\n\nBest regards,\nCautio Team`,
        'poc_ended': `Dear ${customerData.customer_name},\n\nYour POC period has concluded. Thank you for trying Cautio. Please contact us if you'd like to continue with our services.\n\nBest regards,\nCautio Team`,
        'customer_onboarded': `Dear ${customerData.customer_name},\n\nWelcome to Cautio! We're excited to have you onboard. Your account manager ${customerData.account_manager_name} will be in touch soon.\n\nBest regards,\nCautio Team`,
        'poc_started': `Dear ${customerData.customer_name},\n\nYour POC has started successfully. Duration: ${additionalInfo}.\n\nYour account manager: ${customerData.account_manager_name}\n\nBest regards,\nCautio Team`,
        'followup': `Dear ${customerData.customer_name},\n\nWe wanted to follow up on your recent interaction with Cautio. Please let us know if you have any questions.\n\nBest regards,\nCautio Team`,
        'onboarding_reminder': `Dear ${customerData.customer_name},\n\nThis is a friendly reminder about your onboarding process. Please contact your account manager if you need any assistance.\n\nBest regards,\nCautio Team`,
        'custom': additionalInfo || `Dear ${customerData.customer_name},\n\nThank you for choosing Cautio.\n\nBest regards,\nCautio Team`
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
        created_by: userSession?.email || 'admin',
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

    // Listen for scheduled email changes
    supabase
        .channel('scheduled_emails')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'scheduled_emails' }, 
            (payload) => {
                console.log('Scheduled email change received!', payload);
                loadScheduledEmails();
            }
        )
        .subscribe();
}

// UPDATED: Load data from Supabase with proper approval filtering
async function loadData() {
    try {
        // Load all customers
        const { data: customerData, error: customerError } = await supabase
            .from('customers')
            .select('*')
            .order('created_at', { ascending: false });

        if (customerError) {
            console.error('Error loading customers:', customerError);
        } else {
            customers = customerData || [];
            
            // Separate approved and pending customers
            approvedCustomers = customers.filter(customer => customer.approval_status === 'approved');
            filteredCustomers = [...approvedCustomers]; // Only show approved customers in overview
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
            filteredLeads = [...leads];
        }

        // Load pending approvals (only pending customers)
        const { data: approvalData, error: approvalError } = await supabase
            .from('customers')
            .select('*')
            .eq('approval_status', 'pending')
            .order('created_at', { ascending: false });

        if (approvalError) {
            console.error('Error loading pending approvals:', approvalError);
        } else {
            pendingApprovals = approvalData || [];
        }

        // Update UI
        updateCustomerCounts();
        updateTabsContent();
        updateFinanceContent();
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
    document.getElementById('extendPOCForm').classList.add('hidden');
}

// Show Extend POC Form
function showExtendPOCForm() {
    document.getElementById('extendPOCForm').classList.remove('hidden');
}

// Hide Extend POC Form
function hideExtendPOCForm() {
    document.getElementById('extendPOCForm').classList.add('hidden');
}

// Confirm Extend POC with custom days
async function confirmExtendPOC() {
    if (!currentPOCAction) return;
    
    const extendDays = parseInt(document.getElementById('extendDaysInput').value) || 10;
    
    try {
        const currentEndDate = new Date(currentPOCAction.poc_end_date);
        const newEndDate = new Date(currentEndDate);
        newEndDate.setDate(newEndDate.getDate() + extendDays);
        
        const { error } = await supabase
            .from('customers')
            .update({
                poc_end_date: newEndDate.toISOString().split('T')[0],
                last_extended: new Date().toISOString(),
                extension_count: (currentPOCAction.extension_count || 0) + 1,
                poc_extended_days: (currentPOCAction.poc_extended_days || 0) + extendDays
            })
            .eq('id', currentPOCAction.id);

        if (error) {
            console.error('Error extending POC:', error);
            alert('Error extending POC: ' + error.message);
        } else {
            alert(`POC extended by ${extendDays} days for ${currentPOCAction.customer_name}`);
            closePOCActionModal();
            loadData();
            
            // Send confirmation email
            await sendEmail('poc_extended', currentPOCAction, extendDays.toString());
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

// UPDATED: Update customer counts - only count approved customers
function updateCustomerCounts() {
    const totalCustomers = approvedCustomers.length; // Only approved customers
    
    // Count different categories from approved customers only
    const leadsCount = leads.filter(lead => lead.status !== 'Closed').length;
    const pocCount = approvedCustomers.filter(customer => 
        (customer.poc_type === 'free_poc' || customer.poc_type === 'paid_poc') && 
        customer.status !== 'closed'
    ).length;
    const onboardedCount = approvedCustomers.filter(customer => 
        customer.poc_type === 'direct_onboarding' || customer.status === 'onboarded'
    ).length;
    const closedCount = approvedCustomers.filter(customer => customer.status === 'closed').length;
    
    // Update main display
    document.getElementById('totalCustomersDisplay').textContent = totalCustomers;
    
    // Update tab counts with animation
    updateTabCount('leadsCount', leadsCount);
    updateTabCount('pocCount', pocCount);
    updateTabCount('onboardedCount', onboardedCount);
    updateTabCount('closedCount', closedCount);
    
    // Update finance stats
    updateFinanceStats();
}

// Animated tab count update
function updateTabCount(elementId, newCount) {
    const element = document.getElementById(elementId);
    const currentCount = parseInt(element.textContent) || 0;
    
    if (currentCount !== newCount) {
        element.style.transform = 'scale(1.2)';
        element.style.transition = 'transform 0.2s ease';
        
        setTimeout(() => {
            element.textContent = newCount;
            element.style.transform = 'scale(1)';
        }, 100);
    }
}

// Update finance stats
function updateFinanceStats() {
    const pendingCount = pendingApprovals.length;
    const approvedCount = approvedCustomers.length;
    const rejectedCount = customers.filter(c => c.approval_status === 'rejected').length;
    
    const pendingElement = document.getElementById('pendingApprovalsCount');
    const approvedElement = document.getElementById('totalApprovedCount');
    const rejectedElement = document.getElementById('totalRejectedCount');
    
    if (pendingElement) pendingElement.textContent = pendingCount;
    if (approvedElement) approvedElement.textContent = approvedCount;
    if (rejectedElement) rejectedElement.textContent = rejectedCount;
}

// Update tabs content
function updateTabsContent() {
    updateLeadsTab();
    updatePOCTab();
    updateOnboardedTab();
    updateClosedLeadsTab();
}

// Update leads tab
function updateLeadsTab() {
    const activeLeads = filteredLeads.filter(lead => lead.status !== 'Closed');
    const leadsList = document.getElementById('leadsList');
    const leadsEmpty = document.getElementById('leadsEmptyState');

    if (activeLeads.length === 0) {
        leadsList.innerHTML = '';
        leadsEmpty.style.display = 'block';
    } else {
        leadsEmpty.style.display = 'none';
        leadsList.innerHTML = activeLeads.map(lead => createLeadCard(lead)).join('');
    }
}

// Create lead card HTML - Updated with only 2 actions
function createLeadCard(lead) {
    const formatDate = (dateString) => {
        if (!dateString) return 'Not set';
        return new Date(dateString).toLocaleDateString();
    };

    const getLeadStatusBadge = (status) => {
        const statusClasses = {
            'New': 'status-badge lead-new',
            'In Progress': 'status-badge lead-progress',
            'Qualified': 'status-badge lead-qualified',
            'Not Qualified': 'status-badge lead-not-qualified',
            'Converted': 'status-badge lead-converted',
            'Closed': 'status-badge lead-closed'
        };
        
        return `<span class="${statusClasses[status] || 'status-badge'}">${status}</span>`;
    };

    const getTypeColor = (type) => {
        return type === 'Inbound' ? 'text-green-600' : 'text-blue-600';
    };

    return `
        <div class="lead-card p-4 rounded-lg dark:bg-dark-fill-base-300 dark:border dark:border-dark-stroke-contrast-400">
            <div class="flex justify-between items-start mb-3">
                <div>
                    <h4 class="text-body-l-semibold dark:text-dark-base-600">${lead.customer_name}</h4>
                    <p class="text-body-m-regular dark:text-dark-base-500">${lead.contact}</p>
                </div>
                <div class="flex flex-col gap-2 items-end">
                    ${getLeadStatusBadge(lead.status)}
                    <span class="px-2 py-1 text-xs rounded-full dark:bg-dark-stroke-base-400 dark:text-dark-base-600 ${getTypeColor(lead.type)}">
                        ${lead.type}
                    </span>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-4 text-body-s-regular dark:text-dark-base-500">
                <div>
                    <span class="font-semibold">Fleet Size:</span> ${lead.fleet_size || 'N/A'}
                </div>
                <div>
                    <span class="font-semibold">Created:</span> ${formatDate(lead.created_at)}
                </div>
            </div>
            <div class="mt-3 flex gap-2">
                <button onclick="convertLeadToCustomer(${lead.id})" class="px-3 py-1 text-xs rounded-lg dark:bg-dark-success-600 dark:text-utility-white hover:dark:bg-dark-success-600/90">
                    Add to Customer
                </button>
                <button onclick="closeLeadAction(${lead.id})" class="px-3 py-1 text-xs rounded-lg dark:bg-dark-semantic-danger-300 dark:text-utility-white hover:dark:bg-dark-semantic-danger-300/90">
                    Close Lead
                </button>
            </div>
        </div>
    `;
}

// UPDATED: Convert lead to customer - Now creates customer directly with pending approval
async function convertLeadToCustomer(leadId) {
    try {
        const lead = leads.find(l => l.id === leadId);
        if (!lead) return;

        // Create customer from lead data with pending approval status
        const customerData = {
            account_manager_name: 'Lead Converter',
            account_manager_id: 'LC001',
            customer_name: lead.customer_name,
            customer_mobile: lead.contact.includes('@') ? '' : lead.contact,
            customer_email: lead.contact.includes('@') ? lead.contact : `${lead.customer_name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
            lead_sources: ['lead_conversion'],
            requirements: [],
            poc_type: 'free_poc', // Default to free POC
            poc_duration: 30,
            poc_start_date: new Date().toISOString().split('T')[0],
            poc_end_date: null, // Will be set after approval
            status: 'active',
            onboard_source: 'lead_conversion',
            approval_status: 'pending', // IMPORTANT: Set to pending
            extension_count: 0,
            poc_extended_days: 0,
            email_notifications_sent: 0,
            created_at: new Date().toISOString()
        };

        const { data: newCustomer, error: customerError } = await supabase
            .from('customers')
            .insert([customerData])
            .select()
            .single();

        if (customerError) {
            console.error('Error creating customer:', customerError);
            alert('Error creating customer: ' + customerError.message);
            return;
        }

        // Mark lead as converted
        const { error: leadError } = await supabase
            .from('leads')
            .update({ status: 'Converted' })
            .eq('id', leadId);

        if (leadError) {
            console.error('Error updating lead:', leadError);
        }

        loadData();
        
        // Navigate to Finance tab to show the pending approval
        showFinance();
        
        showEmailToast(`Lead converted to customer: ${lead.customer_name}. Awaiting finance approval.`);
        
    } catch (error) {
        console.error('Error converting lead:', error);
        alert('Error converting lead');
    }
}

// Close lead action - Move to Closed Leads
async function closeLeadAction(leadId) {
    try {
        const lead = leads.find(l => l.id === leadId);
        if (!lead) return;

        if (!confirm(`Are you sure you want to close lead "${lead.customer_name}"?`)) {
            return;
        }

        const { error } = await supabase
            .from('leads')
            .update({ status: 'Closed' })
            .eq('id', leadId);

        if (error) {
            console.error('Error closing lead:', error);
            alert('Error closing lead: ' + error.message);
            return;
        }

        loadData();
        showEmailToast(`Lead closed: ${lead.customer_name}`);
        
        // Show Closed Leads tab
        showClosedLeadsTab();
    } catch (error) {
        console.error('Error closing lead:', error);
        alert('Error closing lead');
    }
}

// UPDATED: Update POC tab - Only show approved customers
function updatePOCTab() {
    const pocCustomers = filteredCustomers.filter(customer => 
        (customer.poc_type === 'free_poc' || customer.poc_type === 'paid_poc') && 
        customer.status !== 'closed' &&
        customer.approval_status === 'approved' // Only approved customers
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

// UPDATED: Update onboarded tab - Only show approved customers
function updateOnboardedTab() {
    const onboardedCustomers = filteredCustomers.filter(customer => 
        (customer.poc_type === 'direct_onboarding' || customer.status === 'onboarded') &&
        customer.approval_status === 'approved' // Only approved customers
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

// UPDATED: Update closed leads tab - Only show approved closed customers
function updateClosedLeadsTab() {
    const closedCustomers = filteredCustomers.filter(customer => 
        customer.status === 'closed' &&
        customer.approval_status === 'approved' // Only approved customers
    );
    const closedLeads = filteredLeads.filter(lead => lead.status === 'Closed');

    const closedList = document.getElementById('closedLeadsList');
    const closedEmpty = document.getElementById('closedLeadsEmptyState');

    if (closedCustomers.length === 0 && closedLeads.length === 0) {
        closedList.innerHTML = '';
        closedEmpty.style.display = 'block';
    } else {
        closedEmpty.style.display = 'none';
        
        let closedHTML = '';
        
        // Add closed customers
        if (closedCustomers.length > 0) {
            closedHTML += '<h4 class="text-body-l-semibold dark:text-dark-base-600 mb-4">Closed Customers</h4>';
            closedHTML += closedCustomers.map(customer => createCustomerCard(customer)).join('');
        }
        
        // Add closed leads
        if (closedLeads.length > 0) {
            if (closedCustomers.length > 0) {
                closedHTML += '<h4 class="text-body-l-semibold dark:text-dark-base-600 mb-4 mt-8">Closed Leads</h4>';
            } else {
                closedHTML += '<h4 class="text-body-l-semibold dark:text-dark-base-600 mb-4">Closed Leads</h4>';
            }
            closedHTML += closedLeads.map(lead => createLeadCard(lead)).join('');
        }
        
        closedList.innerHTML = closedHTML;
    }
}

// Create customer card HTML with enhanced features
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
        } else if (onboardSource === 'lead_conversion') {
            return '<span class="px-2 py-1 text-xs rounded-full dark:bg-dark-info-600 dark:text-utility-white">Lead Converted</span>';
        }
        return '<span class="px-2 py-1 text-xs rounded-full dark:bg-dark-stroke-base-400 dark:text-dark-base-600">Unknown Source</span>';
    };

    const getTimeRemainingBadge = (endDate) => {
        if (!endDate) return '';
        const daysRemaining = calculateDaysRemaining(endDate);
        if (daysRemaining === null) return '';
        
        let badgeClass = 'dark:bg-dark-info-600 days-remaining-safe';
        let text = `${daysRemaining} days left`;
        
        if (daysRemaining <= 0) {
            badgeClass = 'dark:bg-dark-semantic-danger-300 days-remaining-expired';
            text = 'Expired';
        } else if (daysRemaining <= 3) {
            badgeClass = 'dark:bg-dark-warning-600 days-remaining-warning';
            text = `${daysRemaining} days left`;
        }
        
        return `<span class="px-2 py-1 text-xs rounded-full ${badgeClass} dark:text-utility-white">${text}</span>`;
    };

    const manageButtons = (customer.poc_type === 'free_poc' || customer.poc_type === 'paid_poc') && customer.status !== 'closed' ? 
        `<button onclick="showPOCActionModal(${JSON.stringify(customer).replace(/"/g, '&quot;')})" class="mt-2 px-3 py-1 text-xs rounded-lg dark:bg-brand-blue-600 dark:text-utility-white hover:dark:bg-brand-blue-500">
            Manage POC
        </button>` : '';

    const emailButton = customer.status !== 'closed' ? `
        <button onclick="showManualEmailModal(${JSON.stringify(customer).replace(/"/g, '&quot;')})" class="mt-2 ml-2 px-3 py-1 text-xs rounded-lg manual-email-btn dark:text-utility-white">
            📧 Schedule Email
        </button>` : '';

    const extensionInfo = customer.extension_count > 0 ? 
        `<div class="text-body-s-regular dark:text-dark-base-500">
            <span class="font-semibold">Extensions:</span> ${customer.extension_count} (${customer.poc_extended_days || 0} days)
        </div>` : '';

    const emailInfo = customer.email_notifications_sent > 0 ? 
        `<div class="text-body-s-regular dark:text-dark-base-500">
            <span class="font-semibold">Emails Sent:</span> ${customer.email_notifications_sent}
            ${customer.last_email_sent ? `(Last: ${formatDate(customer.last_email_sent)})` : ''}
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
                ${emailInfo}
            </div>
            <div class="flex items-center">
                ${manageButtons}
                ${emailButton}
            </div>
        </div>
    `;
}

// Finance Tab Content
function showFinance() {
    hideAllContent();
    document.getElementById('financeContent').classList.remove('hidden');
    updateMenuHighlight('finance');
    updateFinanceContent();
}

function updateFinanceContent() {
    const pendingList = document.getElementById('pendingApprovalsList');
    const financeEmpty = document.getElementById('financeEmptyState');

    if (pendingApprovals.length === 0) {
        pendingList.innerHTML = '';
        financeEmpty.style.display = 'block';
    } else {
        financeEmpty.style.display = 'none';
        pendingList.innerHTML = pendingApprovals.map(customer => createApprovalCard(customer)).join('');
    }
}

function createApprovalCard(customer) {
    const formatDate = (dateString) => {
        if (!dateString) return 'Not set';
        return new Date(dateString).toLocaleDateString();
    };

    return `
        <div class="approval-card p-4 rounded-lg dark:bg-dark-fill-base-300 dark:border dark:border-dark-stroke-contrast-400">
            <div class="flex justify-between items-start mb-3">
                <div>
                    <h4 class="text-body-l-semibold dark:text-dark-base-600">${customer.customer_name}</h4>
                    <p class="text-body-m-regular dark:text-dark-base-500">${customer.customer_email}</p>
                    <p class="text-body-s-regular dark:text-dark-base-500">Submitted: ${formatDate(customer.created_at)}</p>
                </div>
                <div class="flex flex-col gap-2 items-end">
                    <span class="px-2 py-1 text-xs rounded-full dark:bg-dark-warning-600 dark:text-utility-white">Pending Approval</span>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-4 text-body-s-regular dark:text-dark-base-500 mb-4">
                <div>
                    <span class="font-semibold">Mobile:</span> ${customer.customer_mobile}
                </div>
                <div>
                    <span class="font-semibold">Account Manager:</span> ${customer.account_manager_name}
                </div>
                <div>
                    <span class="font-semibold">POC Type:</span> ${customer.poc_type}
                </div>
                <div>
                    <span class="font-semibold">POC Duration:</span> ${customer.poc_duration || 30} days
                </div>
            </div>
            <div class="flex gap-2">
                <button onclick="approveCustomer(${customer.id})" class="px-4 py-2 text-xs rounded-lg dark:bg-dark-success-600 dark:text-utility-white hover:dark:bg-dark-success-600/90">
                    Approve
                </button>
                <button onclick="rejectCustomer(${customer.id})" class="px-4 py-2 text-xs rounded-lg dark:bg-dark-semantic-danger-300 dark:text-utility-white hover:dark:bg-dark-semantic-danger-300/90">
                    Reject
                </button>
            </div>
        </div>
    `;
}

// UPDATED: Approve customer from finance - Now calculates POC end date properly
async function approveCustomer(customerId) {
    try {
        const customer = pendingApprovals.find(c => c.id === customerId);
        if (!customer) return;

        if (!confirm(`Approve customer "${customer.customer_name}"?`)) {
            return;
        }

        // Calculate POC end date from start date and duration
        let pocEndDate = null;
        if (customer.poc_start_date && customer.poc_duration) {
            const startDate = new Date(customer.poc_start_date);
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + parseInt(customer.poc_duration));
            pocEndDate = endDate.toISOString().split('T')[0];
        }

        const { error } = await supabase
            .from('customers')
            .update({
                approval_status: 'approved',
                poc_end_date: pocEndDate,
                approved_at: new Date().toISOString(),
                approved_by: userSession?.email || 'admin'
            })
            .eq('id', customerId);

        if (error) {
            console.error('Error approving customer:', error);
            alert('Error approving customer: ' + error.message);
            return;
        }

        alert(`Customer "${customer.customer_name}" approved successfully!`);
        loadData();
        
        // Send approval email
        await sendEmail('customer_onboarded', customer);
        showEmailToast(`Customer approved: ${customer.customer_name}`);
    } catch (error) {
        console.error('Error approving customer:', error);
        alert('Error approving customer');
    }
}

// Reject customer from finance
async function rejectCustomer(customerId) {
    try {
        const customer = pendingApprovals.find(c => c.id === customerId);
        if (!customer) return;

        const reason = prompt(`Reject customer "${customer.customer_name}"?\nPlease provide a reason:`);
        if (!reason) return;

        const { error } = await supabase
            .from('customers')
            .update({
                approval_status: 'rejected',
                rejection_reason: reason,
                rejected_at: new Date().toISOString(),
                rejected_by: userSession?.email || 'admin'
            })
            .eq('id', customerId);

        if (error) {
            console.error('Error rejecting customer:', error);
            alert('Error rejecting customer: ' + error.message);
            return;
        }

        alert(`Customer "${customer.customer_name}" rejected.`);
        loadData();
        showEmailToast(`Customer rejected: ${customer.customer_name}`);
    } catch (error) {
        console.error('Error rejecting customer:', error);
        alert('Error rejecting customer');
    }
}

// UPDATED: Check expired POCs - Only check approved customers
async function checkExpiredPOCs() {
    const today = new Date().toISOString().split('T')[0];
    
    try {
        const { data: expiredPOCs, error } = await supabase
            .from('customers')
            .select('*')
            .lt('poc_end_date', today)
            .neq('status', 'closed')
            .in('poc_type', ['free_poc', 'paid_poc'])
            .eq('approval_status', 'approved'); // Only check approved customers

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

// Login functionality with session management
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

                // Set session
                userSession = user;
                saveUserSession();

                // Navigate to dashboard
                navigateToDashboard();
                
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

function navigateToDashboard() {
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('forgotPasswordPage').classList.add('hidden');
    document.getElementById('dashboardPage').classList.remove('hidden');
    
    showCustomersOverview();
    loadData();
}

// Toggle password visibility
function togglePasswordVisibility() {
    const passwordField = document.getElementById('loginPassword');
    const type = passwordField.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordField.setAttribute('type', type);
}

// Enhanced Sidebar toggle functionality
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    
    sidebarExpanded = !sidebarExpanded;
    
    if (sidebarExpanded) {
        sidebar.classList.remove('collapsed');
        sidebar.classList.add('expanded');
        mainContent.classList.remove('sidebar-collapsed');
        mainContent.classList.add('sidebar-expanded');
    } else {
        sidebar.classList.remove('expanded');
        sidebar.classList.add('collapsed');
        mainContent.classList.remove('sidebar-expanded');
        mainContent.classList.add('sidebar-collapsed');
    }
}

// Enhanced Sidebar hover functionality
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

// UPDATED: Show all customers - Only show approved customers
function showAllCustomers() {
    showCustomersOverview();
    
    // Clear any existing search filter
    currentFilter = '';
    document.getElementById('searchInput').value = '';
    filteredCustomers = [...approvedCustomers]; // Only approved customers
    filteredLeads = [...leads];
    
    // Show special "All Customers" view
    showAllCustomersView();
}

// UPDATED: Function to show all approved customers in a comprehensive view
function showAllCustomersView() {
    hideAllTabContent();
    
    // Create a new tab content for showing all customers
    const tabContent = document.getElementById('tabContent');
    
    // Remove any existing "All Customers" content
    const existingAllCustomersContent = document.getElementById('allCustomersTabContent');
    if (existingAllCustomersContent) {
        existingAllCustomersContent.remove();
    }
    
    // Create new content div
    const allCustomersContent = document.createElement('div');
    allCustomersContent.id = 'allCustomersTabContent';
    allCustomersContent.innerHTML = `
        <div class="mb-4">
            <h3 class="text-heading-6 dark:text-dark-base-600 mb-2">All Approved Customers</h3>
            <p class="text-body-m-regular dark:text-dark-base-500">Complete overview of all approved customers in the system</p>
        </div>
        <div id="allCustomersList" class="space-y-4">
            ${approvedCustomers.map(customer => createCustomerCard(customer, true, true)).join('')}
        </div>
        ${approvedCustomers.length === 0 ? `
            <div class="text-center py-12">
                <h3 class="text-heading-6 dark:text-dark-base-600 mb-4">No Approved Customers Found</h3>
                <p class="text-body-l-regular dark:text-dark-base-500">All customers are pending finance approval</p>
            </div>
        ` : ''}
    `;
    
    tabContent.appendChild(allCustomersContent);
    
    // Update tab highlighting to show we're viewing all customers
    updateTabHighlight(''); // Clear all highlights
    showEmailToast(`Showing all ${approvedCustomers.length} approved customers`);
}

// Apply current search filter
function applyCurrentFilter() {
    if (currentFilter) {
        // Reapply current search filter
        performSearch(currentFilter);
    }
}

// Menu navigation functions
function showCustomersOverview() {
    hideAllContent();
    document.getElementById('customersOverviewContent').classList.remove('hidden');
    updateMenuHighlight('customers');
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

function showLeadsTab() {
    hideAllTabContent();
    document.getElementById('leadsTabContent').classList.remove('hidden');
    updateTabHighlight('leadsTab');
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
    document.getElementById('leadsTabContent').classList.add('hidden');
    document.getElementById('pocTabContent').classList.add('hidden');
    document.getElementById('onboardedTabContent').classList.add('hidden');
    document.getElementById('closedLeadsTabContent').classList.add('hidden');
    
    // Also hide the "All Customers" view if it exists
    const allCustomersContent = document.getElementById('allCustomersTabContent');
    if (allCustomersContent) {
        allCustomersContent.remove();
    }
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

// FIXED: Multi-step form functions - PRACTICAL VALIDATION SOLUTION
function goToStep2() {
    console.log('goToStep2 called - starting validation'); // Debug
    
    // Simple validation - just check if key fields have something
    const form = document.getElementById('addCustomerForm');
    
    // Get field values using a safer method
    const managerNameField = form.querySelector('input[name="accountManagerName"]');
    const managerIdField = form.querySelector('input[name="accountManagerId"]');
    const custNameField = form.querySelector('input[name="customerName"]');
    const custMobileField = form.querySelector('input[name="customerMobile"]');
    const custEmailField = form.querySelector('input[name="customerEmail"]');
    
    console.log('Fields found:', {
        managerName: !!managerNameField,
        managerId: !!managerIdField,
        custName: !!custNameField,
        custMobile: !!custMobileField,
        custEmail: !!custEmailField
    }); // Debug
    
    // Get values safely
    const managerName = managerNameField ? managerNameField.value.trim() : '';
    const managerId = managerIdField ? managerIdField.value.trim() : '';
    const custName = custNameField ? custNameField.value.trim() : '';
    const custMobile = custMobileField ? custMobileField.value.trim() : '';
    const custEmail = custEmailField ? custEmailField.value.trim() : '';
    
    console.log('Field values:', {
        managerName: managerName,
        managerId: managerId,
        custName: custName,
        custMobile: custMobile,
        custEmail: custEmail
    }); // Debug
    
    // Very basic validation - just check if major fields are not empty
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
    console.log('Lead sources checked:', leadSources.length); // Debug
    
    if (leadSources.length === 0) {
        // Don't block, just warn
        if (!confirm('No lead source selected. Continue anyway?')) {
            return;
        }
    }

    console.log('All validations passed, proceeding to step 2'); // Debug

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
}

function closeAddLeadForm() {
    document.getElementById('addLeadModal').classList.add('hidden');
    document.getElementById('addLeadForm').reset();
}

function showAddCustomerForm() {
    document.getElementById('addCustomerModal').classList.remove('hidden');
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

// UPDATED: Handle Add Customer - Now creates customer with pending approval
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
        approval_status: 'pending', // IMPORTANT: Set to pending
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

// Enhanced Logout function with session cleanup
function logout() {
    // Clear session
    clearUserSession();
    
    // Reset UI
    document.getElementById('dashboardPage').classList.add('hidden');
    document.getElementById('forgotPasswordPage').classList.add('hidden');
    document.getElementById('loginPage').classList.remove('hidden');
    
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
    
    // Reset sidebar state
    sidebarExpanded = false;
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    sidebar.classList.remove('expanded');
    sidebar.classList.add('collapsed');
    mainContent.classList.remove('sidebar-expanded');
    mainContent.classList.add('sidebar-collapsed');
    
    showEmailToast('Logged out successfully');
}

// Run checks periodically
setInterval(checkExpiredPOCs, 60 * 60 * 1000); // Every hour
setInterval(checkPOCReminders, 60 * 60 * 1000 * 24); // Every 24 hours
setInterval(checkScheduledEmails, 60 * 1000); // Every minute
