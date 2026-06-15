let currentUserProfile = null;

// COMPACT UI Role Selection
function selectRole(role) {
    authRole = role;
    
    const head = document.getElementById('loginHeading');
    if(head) head.innerText = role === 'landlord' ? "Sign In" : "Tenant Sign In";
    
    const sub = document.getElementById('loginSubheading');
    if (sub) {
        sub.innerText = role === 'landlord' 
            ? "Access your landlord portfolio" 
            : "Access your tenant account";
    }
}

// UPDATED: Dynamic text and icon handling for the new Create Account button
function toggleAuthMode() {
    isSignUpMode = !isSignUpMode;
    const btnText = document.getElementById('authBtnText');
    const btnInner = document.getElementById('authBtnInner');
    const toggleIcon = document.getElementById('authToggleIcon');
    const toggleMsg = document.getElementById('authToggleMsg');
    
    if (btnText) btnText.innerText = isSignUpMode ? "Register Account" : "Access Portal";
    if (btnInner) btnInner.innerText = isSignUpMode ? "Sign In Securely" : "Sign up now";
    if (toggleIcon) toggleIcon.innerText = isSignUpMode ? "login" : "person_add";
    if (toggleMsg) toggleMsg.innerText = isSignUpMode ? "Already have an account?" : "New to GangtokNest?";
    
    const nameWrapper = document.getElementById('nameWrapper');
    if (nameWrapper) {
        if (isSignUpMode) {
            nameWrapper.classList.remove('hidden');
        } else {
            nameWrapper.classList.add('hidden');
        }
    }

    const strengthWrapper = document.getElementById('passwordStrengthWrapper');
    if (strengthWrapper) {
        if (isSignUpMode) strengthWrapper.classList.remove('hidden');
        else strengthWrapper.classList.add('hidden');
    }

    const confirmWrapper = document.getElementById('confirmPasswordWrapper');
    if (confirmWrapper) {
        if (isSignUpMode) confirmWrapper.classList.remove('hidden');
        else confirmWrapper.classList.add('hidden');
    }

    clearAllAuthValidations();
}

function togglePassword() {
    const input = document.getElementById('authPassword');
    if (input) input.type = input.type === 'password' ? 'text' : 'password';
}

function switchTab(tabId, btn) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('[data-tab-content]').forEach(c => c.classList.remove('active-content'));
    document.getElementById(tabId).classList.add('active-content');
}

async function handleAuthAction() {
    clearGeneralError();
    const btn = document.getElementById('authSubmitBtn');
    if (!btn) return;
    const original = btn.innerHTML;
    btn.innerText = isSignUpMode ? "Registering..." : "Signing In...";
    
    const emailInput = document.getElementById('authEmail');
    const passwordInput = document.getElementById('authPassword');
    if (!emailInput || !passwordInput) {
        btn.innerHTML = original;
        return;
    }
    
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    
    try {
        let isValid = true;
        if (isSignUpMode) {
            isValid = validateFirstName() && isValid;
            isValid = validateLastName() && isValid;
            isValid = validateLocation() && isValid;
            isValid = validatePhone() && isValid;
            isValid = validateEmail() && isValid;
            isValid = validatePassword() && isValid;
            isValid = validateConfirmPassword() && isValid;
        } else {
            isValid = validateEmail() && isValid;
            isValid = validatePassword() && isValid; // Checks only if not empty for login
        }
        
        if (!isValid) {
            throw new Error("Please correct the validation errors in the form.");
        }
        
        let res;
        if (isSignUpMode) {
            const fName = document.getElementById('authFirstName').value.trim();
            const lName = document.getElementById('authLastName').value.trim();
            const location = document.getElementById('authLocation').value.trim();
            const phone = document.getElementById('authPhone').value.trim();
            
            // Check for duplicate phone number in listings table
            const { data: phoneMatch, error: phoneErr } = await supabaseClient
                .from('listings')
                .select('id')
                .eq('contact', phone)
                .limit(1);
            
            if (phoneMatch && phoneMatch.length > 0) {
                showFieldError(document.getElementById('authPhone'), document.getElementById('error-authPhone'), "An account with this phone number already exists.");
                throw new Error("An account with this phone number already exists.");
            }
            
            const fullName = `${fName} ${lName}`.trim() || 'User';
            
            res = await supabaseClient.auth.signUp({ 
                email, 
                password, 
                options: { 
                    data: { 
                        full_name: fullName, 
                        first_name: fName,
                        last_name: lName,
                        location: location,
                        phone: phone,
                        role: authRole 
                    }
                }
            });
            
            if (res.error) throw res.error;
            
            // Check duplicate email
            if (res.data.user && (!res.data.user.identities || res.data.user.identities.length === 0)) {
                showFieldError(document.getElementById('authEmail'), document.getElementById('error-authEmail'), "An account with this email address already exists.");
                throw new Error("An account with this email address already exists.");
            }
            
            // Handle successful sign up with email confirmation link screen
            if (!res.data.session) {
                showVerificationInstructions(email);
                btn.innerHTML = original;
                return;
            }
        } else {
            res = await supabaseClient.auth.signInWithPassword({ email, password });
            if (res.error) {
                // Friendly error for unconfirmed email
                if (res.error.message.toLowerCase().includes("confirm") || res.error.message.toLowerCase().includes("verified")) {
                    throw new Error("Please verify your email address before signing in. Check your inbox for the verification link.");
                }
                throw new Error("Invalid email or password.");
            }
            if (res.data.user) {
                const user = res.data.user;
                if (!user.user_metadata?.role || user.user_metadata?.role !== authRole) {
                    const { data: { user: updatedUser }, error: updateError } = await supabaseClient.auth.updateUser({
                        data: { role: authRole }
                    });
                    if (!updateError && updatedUser) {
                        res.data.user = updatedUser;
                    }
                }
            }
        }
        if (res.data.user) loadDashboard(res.data.user);
    } catch (e) { 
        showGeneralError(e.message); 
        btn.innerHTML = original; 
    }
}

async function signOut() { await supabaseClient.auth.signOut(); location.reload(); }

function loadDashboard(user) {
    currentUserProfile = user;
    const role = user.user_metadata?.role || authRole;
    closeAuthModal();
    
    document.getElementById('header-landing').classList.add('hidden');
    document.getElementById('header-dashboard').classList.remove('hidden');
    document.getElementById('userGreeting').innerText = `${user.user_metadata?.full_name || role}`;
    
    const headerLogout = document.getElementById('btn-header-logout');
    
    if (role === 'landlord') {
        document.getElementById('view-landing').classList.add('hidden');
        document.getElementById('view-landlord').classList.remove('hidden');
        if (headerLogout) headerLogout.classList.add('hidden');
        
        // Populate Profile
        const pName = document.getElementById('ll-profile-name');
        const pLoc = document.getElementById('ll-profile-location');
        const pPhone = document.getElementById('ll-profile-phone');
        const pEmail = document.getElementById('ll-profile-email');
        const sName = document.getElementById('ll-sidebar-name');
        if (pName) pName.innerText = user.user_metadata?.full_name || 'Landlord Name';
        if (pLoc) pLoc.innerText = user.user_metadata?.location || 'Location not set';
        if (pPhone) pPhone.innerText = user.user_metadata?.phone || 'Phone not set';
        if (pEmail) pEmail.innerText = user.email || 'Email not set';
        if (sName) sName.innerText = user.user_metadata?.full_name || 'Landlord';
        
        fetchLandlordData(user.id);
    } else {
        document.getElementById('view-landing').classList.remove('hidden');
        document.getElementById('view-landlord').classList.add('hidden');
        document.getElementById('landing-anonymous').classList.add('hidden');
        document.getElementById('landing-tenant').classList.remove('hidden');
        const tNameEl = document.getElementById('tenantName');
        if (tNameEl) tNameEl.innerText = user.user_metadata?.full_name || 'Renter';
        if (headerLogout) headerLogout.classList.remove('hidden');
        fetchTenantData();
    }
}

async function softRefresh() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (user) {
        const role = user.user_metadata?.role || authRole;
        role === 'landlord' ? fetchLandlordData(user.id) : fetchTenantData();
    }
}

// ==========================================
function openAuthModal() {
    selectRole('landlord');
    document.getElementById('auth-modal').classList.remove('hidden');
}

function openTenantAuthModal(forceSignUp = false) {
    selectRole('tenant');
    document.getElementById('auth-modal').classList.remove('hidden');
    
    // Toggle to requested state if needed
    if (forceSignUp && !isSignUpMode) {
        toggleAuthMode();
    } else if (!forceSignUp && isSignUpMode) {
        toggleAuthMode();
    }
}

function closeAuthModal() {
    document.getElementById('auth-modal').classList.add('hidden');
}

// ==========================================
// REGISTRATION AND LOGIN VALIDATION ENGINES
// ==========================================

function showFieldError(inputEl, errorEl, message) {
    if (inputEl) {
        inputEl.classList.remove('border-white/20', 'border-green-500', 'bg-green-500/10');
        inputEl.classList.add('border-red-500', 'focus:border-red-500', 'bg-red-500/10');
    }
    if (errorEl) {
        errorEl.innerText = message;
        errorEl.classList.remove('hidden');
    }
}

function showFieldSuccess(inputEl, errorEl) {
    if (inputEl) {
        inputEl.classList.remove('border-white/20', 'border-red-500', 'bg-red-500/10');
        inputEl.classList.add('border-green-500', 'focus:border-green-500', 'bg-green-500/10');
    }
    if (errorEl) {
        errorEl.innerText = "";
        errorEl.classList.add('hidden');
    }
}

function clearFieldError(inputEl, errorEl) {
    if (inputEl) {
        inputEl.classList.remove('border-red-500', 'border-green-500', 'bg-red-500/10', 'bg-green-500/10');
        inputEl.classList.add('border-white/20');
    }
    if (errorEl) {
        errorEl.innerText = "";
        errorEl.classList.add('hidden');
    }
}

function showGeneralError(message) {
    const el = document.getElementById('authGeneralError');
    if (el) {
        el.innerText = message;
        el.classList.remove('hidden');
    } else {
        alert(message);
    }
}

function clearGeneralError() {
    const el = document.getElementById('authGeneralError');
    if (el) {
        el.innerText = "";
        el.classList.add('hidden');
    }
}

function validateFirstName(realTime = false) {
    const el = document.getElementById('authFirstName');
    if (!el || (!isSignUpMode && realTime)) return true;
    
    const val = el.value.trim();
    const errEl = document.getElementById('error-authFirstName');
    
    if (realTime && val === "") {
        clearFieldError(el, errEl);
        return true;
    }
    
    if (val === "") {
        showFieldError(el, errEl, "First name is required.");
        return false;
    }
    
    const regex = /^[A-Za-z]+$/;
    if (!regex.test(val)) {
        showFieldError(el, errEl, "First name must contain only letters.");
        return false;
    }
    
    showFieldSuccess(el, errEl);
    return true;
}

function validateLastName(realTime = false) {
    const el = document.getElementById('authLastName');
    if (!el || (!isSignUpMode && realTime)) return true;
    
    const val = el.value.trim();
    const errEl = document.getElementById('error-authLastName');
    
    if (realTime && val === "") {
        clearFieldError(el, errEl);
        return true;
    }
    
    if (val === "") {
        showFieldError(el, errEl, "Last name is required.");
        return false;
    }
    
    const regex = /^[A-Za-z]+$/;
    if (!regex.test(val)) {
        showFieldError(el, errEl, "Last name must contain only letters.");
        return false;
    }
    
    showFieldSuccess(el, errEl);
    return true;
}

function validateLocation(realTime = false) {
    const el = document.getElementById('authLocation');
    if (!el || (!isSignUpMode && realTime)) return true;
    
    const val = el.value.trim();
    const errEl = document.getElementById('error-authLocation');
    
    if (realTime && val === "") {
        clearFieldError(el, errEl);
        return true;
    }
    
    if (val === "") {
        showFieldError(el, errEl, "City / Location is required.");
        return false;
    }
    
    showFieldSuccess(el, errEl);
    return true;
}

function validatePhone(realTime = false) {
    const el = document.getElementById('authPhone');
    if (!el || (!isSignUpMode && realTime)) return true;
    
    const val = el.value.trim();
    const errEl = document.getElementById('error-authPhone');
    
    if (realTime && val === "") {
        clearFieldError(el, errEl);
        return true;
    }
    
    if (val === "") {
        showFieldError(el, errEl, "Enter a valid 10-digit mobile number.");
        return false;
    }
    
    const regex = /^[6-9]\d{9}$/;
    if (!regex.test(val)) {
        showFieldError(el, errEl, "Enter a valid 10-digit mobile number.");
        return false;
    }
    
    showFieldSuccess(el, errEl);
    return true;
}

function validateEmail(realTime = false) {
    const el = document.getElementById('authEmail');
    if (!el) return true;
    
    const val = el.value.trim().toLowerCase();
    const errEl = document.getElementById('error-authEmail');
    
    if (realTime && val === "") {
        clearFieldError(el, errEl);
        return true;
    }
    
    if (val === "") {
        showFieldError(el, errEl, "Email address is required.");
        return false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(val)) {
        showFieldError(el, errEl, "Enter a valid email address.");
        return false;
    }
    
    const tempDomains = ["tempmail.com", "10minutemail.com", "mailinator.com", "guerrillamail.com"];
    const domain = val.split('@')[1];
    if (tempDomains.includes(domain)) {
        showFieldError(el, errEl, "Temporary email addresses are not allowed.");
        return false;
    }
    
    showFieldSuccess(el, errEl);
    return true;
}

function validatePassword(realTime = false) {
    const el = document.getElementById('authPassword');
    if (!el) return true;
    
    const val = el.value;
    const errEl = document.getElementById('error-authPassword');
    
    if (realTime && val === "") {
        clearFieldError(el, errEl);
        if (isSignUpMode) {
            updatePasswordStrength("");
        }
        return true;
    }
    
    if (val === "") {
        showFieldError(el, errEl, "Password is required.");
        return false;
    }
    
    if (!isSignUpMode) {
        showFieldSuccess(el, errEl);
        return true;
    }
    
    // Simplified validation: just check minimum 6 characters (Supabase default)
    if (val.length < 6) {
        showFieldError(el, errEl, "Password must be at least 6 characters long.");
        return false;
    }
    
    updatePasswordStrength(val);
    
    showFieldSuccess(el, errEl);
    return true;
}

function updatePasswordStrength(val) {
    const textEl = document.getElementById('passwordStrengthText');
    
    if (!textEl) return 0;
    
    if (!val) {
        textEl.innerText = "Too Weak";
        textEl.className = "font-bold text-red-500";
        setBarsColor('bg-transparent', 'bg-transparent', 'bg-transparent', 'bg-transparent');
        return 0;
    }
    
    let score = 0;
    if (val.length >= 8) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[a-z]/.test(val)) score++;
    if (/\d/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;
    
    if (score <= 2) {
        textEl.innerText = "Weak";
        textEl.className = "font-bold text-red-500";
        setBarsColor('bg-red-500', 'bg-transparent', 'bg-transparent', 'bg-transparent');
    } else if (score === 3 || score === 4) {
        if (score === 4 && val.length >= 8) {
            textEl.innerText = "Strong";
            textEl.className = "font-bold text-yellow-500";
            setBarsColor('bg-yellow-500', 'bg-yellow-500', 'bg-yellow-500', 'bg-transparent');
        } else {
            textEl.innerText = "Medium";
            textEl.className = "font-bold text-orange-500";
            setBarsColor('bg-orange-500', 'bg-orange-500', 'bg-transparent', 'bg-transparent');
        }
    } else if (score === 5) {
        textEl.innerText = "Very Strong";
        textEl.className = "font-bold text-green-500";
        setBarsColor('bg-green-500', 'bg-green-500', 'bg-green-500', 'bg-green-500');
    }
    
    return score;
}

function setBarsColor(c1, c2, c3, c4) {
    const bar1 = document.getElementById('strengthBar1');
    const bar2 = document.getElementById('strengthBar2');
    const bar3 = document.getElementById('strengthBar3');
    const bar4 = document.getElementById('strengthBar4');
    
    if (bar1) bar1.className = `h-full w-1/4 rounded-full transition-all duration-300 ${c1}`;
    if (bar2) bar2.className = `h-full w-1/4 rounded-full transition-all duration-300 ${c2}`;
    if (bar3) bar3.className = `h-full w-1/4 rounded-full transition-all duration-300 ${c3}`;
    if (bar4) bar4.className = `h-full w-1/4 rounded-full transition-all duration-300 ${c4}`;
}

function updateChecklistRule(ruleId, passed) {
    const el = document.getElementById(ruleId);
    if (!el) return;
    
    const icon = el.querySelector('span');
    if (icon) {
        if (passed) {
            icon.innerText = "check_circle";
            icon.className = "material-symbols-outlined text-[12px] text-green-500";
            el.className = "flex items-center gap-1.5 text-green-400 font-semibold";
        } else {
            icon.innerText = "cancel";
            icon.className = "material-symbols-outlined text-[12px] text-red-400";
            el.className = "flex items-center gap-1.5 text-white/50";
        }
    }
}

function validateConfirmPassword(realTime = false) {
    const el = document.getElementById('authConfirmPassword');
    if (!el || (!isSignUpMode && realTime)) return true;
    
    const val = el.value;
    const passEl = document.getElementById('authPassword');
    const errEl = document.getElementById('error-authConfirmPassword');
    
    if (realTime && val === "") {
        clearFieldError(el, errEl);
        return true;
    }
    
    if (val === "") {
        showFieldError(el, errEl, "Confirm password is required.");
        return false;
    }
    
    if (passEl && val !== passEl.value) {
        showFieldError(el, errEl, "Passwords do not match.");
        return false;
    }
    
    showFieldSuccess(el, errEl);
    return true;
}

function toggleConfirmPassword() {
    const input = document.getElementById('authConfirmPassword');
    if (input) {
        input.type = input.type === 'password' ? 'text' : 'password';
    }
}

function clearAllAuthValidations() {
    const fields = [
        'authFirstName', 'authLastName', 'authLocation', 
        'authPhone', 'authEmail', 'authPassword', 'authConfirmPassword'
    ];
    
    fields.forEach(id => {
        const inputEl = document.getElementById(id);
        const errorEl = document.getElementById(`error-${id}`);
        if (inputEl) inputEl.value = "";
        clearFieldError(inputEl, errorEl);
    });
    
    clearGeneralError();
    updatePasswordStrength("");
}

function showVerificationInstructions(email) {
    document.getElementById('authMainContainer').classList.add('hidden');
    document.getElementById('verificationEmail').innerText = email;
    document.getElementById('authVerificationScreen').classList.remove('hidden');
}

function showAuthMain() {
    document.getElementById('authVerificationScreen').classList.add('hidden');
    document.getElementById('authMainContainer').classList.remove('hidden');
    // Switch to login mode on redirect
    isSignUpMode = true; // toggle will flip it to false (login)
    toggleAuthMode();
}

function setupAuthValidation() {
    const inputs = [
        { id: 'authFirstName', check: validateFirstName },
        { id: 'authLastName', check: validateLastName },
        { id: 'authLocation', check: validateLocation },
        { id: 'authPhone', check: validatePhone },
        { id: 'authEmail', check: validateEmail },
        { id: 'authPassword', check: validatePassword },
        { id: 'authConfirmPassword', check: validateConfirmPassword }
    ];

    inputs.forEach(({ id, check }) => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => {
                check(true); // real-time validation
            });
            el.addEventListener('blur', () => {
                check(true);
            });
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    setupAuthValidation();
});
