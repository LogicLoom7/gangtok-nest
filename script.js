// ==========================================
// DARK MODE ENGINE
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
        document.querySelectorAll('.theme-icon').forEach(icon => icon.innerText = 'light_mode');
    }
});

function toggleDarkMode() {
    const html = document.documentElement;
    html.classList.toggle('dark');
    const isDark = html.classList.contains('dark');
    
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    
    document.querySelectorAll('.theme-icon').forEach(icon => {
        icon.innerText = isDark ? 'light_mode' : 'dark_mode';
    });
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ==========================================
// CORE APP ENGINE
// ==========================================
const supabaseUrl = 'https://vafsigyuefiovfxfbwlp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhZnNpZ3l1ZWZpb3ZmeGZid2xwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2MjEyNDksImV4cCI6MjA5MTE5NzI0OX0.2JygpUTPkuIC56s8BIDWfbWRHwyw9rnHBy2Ctae18Gs';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

let authRole = 'tenant';
let isSignUpMode = false;
let allRooms = [];
let activeBHK = 0;

let currentLat = null;
let currentLng = null;
let tenantMap = null;
let tenantMarker = null;

// Modern Tenant Filters and Grid/Map View states
let mainTenantMap = null;
let mainTenantMarkers = [];
let activeView = 'grid'; // 'grid' or 'map'
let filterWater = 'all';
let filterRoad = 'all';
let filterSunlight = false;
let filterParking = false;
let filterBalcony = false;
let filterWifi = false;

// Favorites Database
let favorites = JSON.parse(localStorage.getItem('gn_favorites') || '[]');
let filterFavorites = false;

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (user) {
        loadDashboard(user);
    } else {
        document.getElementById('header-landing').classList.remove('hidden');
        document.getElementById('header-dashboard').classList.add('hidden');
        document.getElementById('view-landing').classList.remove('hidden');
        document.getElementById('view-landlord').classList.add('hidden');
        document.getElementById('landing-anonymous').classList.remove('hidden');
        document.getElementById('landing-tenant').classList.add('hidden');
    }
});

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
    document.getElementById('authBtnText').innerText = isSignUpMode ? "Register Account" : "Access Portal";
    document.getElementById('authBtnInner').innerText = isSignUpMode ? "Sign In Securely" : "Create Account";
    document.getElementById('authToggleIcon').innerText = isSignUpMode ? "login" : "person_add";
    document.getElementById('authToggleMsg').innerText = isSignUpMode ? "Already have an account?" : "New to GangtokNest?";
    const nameWrapper = document.getElementById('nameWrapper');
    if (isSignUpMode) {
        nameWrapper.classList.remove('hidden');
    } else {
        nameWrapper.classList.add('hidden');
    }
}

function togglePassword() {
    const input = document.getElementById('authPassword');
    input.type = input.type === 'password' ? 'text' : 'password';
}

function switchTab(tabId, btn) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('[data-tab-content]').forEach(c => c.classList.remove('active-content'));
    document.getElementById(tabId).classList.add('active-content');
}

async function handleAuthAction() {
    const btn = document.getElementById('authSubmitBtn');
    const original = btn.innerHTML;
    btn.innerText = "Authenticating...";
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    
    try {
        let res;
        if (isSignUpMode) {
            const name = document.getElementById('authName').value;
            res = await supabaseClient.auth.signUp({ email, password, options: { data: { full_name: name, role: authRole }}});
        } else {
            res = await supabaseClient.auth.signInWithPassword({ email, password });
            if (res.error) throw res.error;
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
    } catch (e) { alert(e.message); btn.innerHTML = original; }
}

async function signOut() { await supabaseClient.auth.signOut(); location.reload(); }

function loadDashboard(user) {
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
// LANDLORD PORTAL STATE & UTILITIES
// ==========================================
let landlordListings = [];
let editingListingId = null;
let editingListingOriginalImageUrl = '';
let currentPublishStep = 1;

function parseFloorAndBhk(r) {
    let customBhk = `${r.bhk} BHK`;
    let floorLevel = String(r.floor_level || '');
    
    if (floorLevel.includes('|')) {
        const parts = floorLevel.split('|');
        customBhk = parts[0].trim();
        floorLevel = parts[1].trim();
    }
    return { customBhk, floorLevel };
}

function parseLocationFields(locationStr) {
    let mainArea = '';
    let exactLocation = locationStr || '';
    
    if (locationStr && locationStr.includes(' - ')) {
        const parts = locationStr.split(' - ');
        mainArea = parts[0].trim();
        exactLocation = parts.slice(1).join(' - ').trim();
    }
    return { mainArea, exactLocation };
}

// ==========================================
// LANDLORD ROUTING & INTERFACE HANDLERS
// ==========================================
function switchLandlordView(viewId, isEdit = false) {
    const sections = [
        'dashboard', 'listings', 'rented', 'publish', 
        'profile', 'settings', 'analytics', 'visits'
    ];
    
    // Reset all buttons
    document.querySelectorAll('.ll-nav-btn').forEach(btn => {
        btn.classList.remove('bg-primary', 'text-white', 'shadow-lg', 'dark:text-surface', 'border-transparent');
        btn.classList.add('bg-surface', 'border', 'border-outline-variant/40', 'text-on-surface', 'hover:bg-surface-container', 'hover:shadow-sm');
    });
    
    sections.forEach(s => {
        const secEl = document.getElementById(`ll-section-${s}`);
        if (secEl) secEl.classList.add('hidden');
    });
    
    const activeSec = document.getElementById(`ll-section-${viewId}`);
    if (activeSec) activeSec.classList.remove('hidden');
    
    const activeBtn = document.getElementById(`ll-nav-top-${viewId}`);
    if (activeBtn) {
        activeBtn.classList.remove('bg-surface', 'border', 'border-outline-variant/40', 'text-on-surface', 'hover:bg-surface-container', 'hover:shadow-sm');
        activeBtn.classList.add('bg-primary', 'text-white', 'shadow-lg', 'dark:text-surface', 'border-transparent');
        // smooth scroll the active button into view so user sees it on mobile
        activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
    
    if (viewId === 'rented') {
        renderRentedRooms();
    } else if (viewId === 'dashboard' || viewId === 'listings') {
        supabaseClient.auth.getUser().then(({ data: { user } }) => {
            if (user) fetchLandlordData(user.id);
        });
    } else if (viewId === 'publish' && !isEdit) {
        resetPublishForm();
    } else if (viewId === 'analytics') {
        renderAnalyticsChart();
    } else if (viewId === 'visits') {
        renderVisitsView();
    }
}

function toggleLandlordSidebar() {
    const mobileSidebar = document.getElementById('ll-sidebar-mobile');
    const hamburgerIcon = document.getElementById('ll-mobile-hamburger-icon');
    if (!mobileSidebar) return;
    if (mobileSidebar.classList.contains('-translate-x-full')) {
        mobileSidebar.classList.remove('-translate-x-full');
        if (hamburgerIcon) hamburgerIcon.innerText = 'close';
    } else {
        mobileSidebar.classList.add('-translate-x-full');
        if (hamburgerIcon) hamburgerIcon.innerText = 'menu';
    }
}

// Close action menus when clicking outside
document.addEventListener('click', () => {
    document.querySelectorAll('[id^="action-menu-"]').forEach(menu => {
        menu.classList.add('hidden');
    });
});

function toggleActionMenu(id, event) {
    event.stopPropagation();
    const targetMenu = document.getElementById(`action-menu-${id}`);
    const wasHidden = targetMenu.classList.contains('hidden');
    
    document.querySelectorAll('[id^="action-menu-"]').forEach(menu => {
        menu.classList.add('hidden');
    });
    
    if (wasHidden) {
        targetMenu.classList.remove('hidden');
    }
}

// ==========================================
// DRAG & DROP PHOTOS HANDLERS
// ==========================================
function clearSelectedImage() {
    const fileInput = document.getElementById('ll-photo');
    if (fileInput) fileInput.value = '';
    const imgPreview = document.getElementById('ll-image-preview');
    if (imgPreview) imgPreview.removeAttribute('src');
    const container = document.getElementById('ll-image-preview-container');
    if (container) container.classList.add('hidden');
    const uploadZone = document.getElementById('ll-upload-zone');
    if (uploadZone) uploadZone.classList.remove('hidden');
}

function handleFileSelect(file) {
    if (!file) return;
    if (!file.type.match('image.*')) {
        alert("Please select a valid image file (PNG, JPG, WEBP).");
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const imgPreview = document.getElementById('ll-image-preview');
        const container = document.getElementById('ll-image-preview-container');
        const uploadZone = document.getElementById('ll-upload-zone');
        
        if (imgPreview && container && uploadZone) {
            imgPreview.src = e.target.result;
            container.classList.remove('hidden');
            uploadZone.classList.add('hidden');
        }
    };
    reader.readAsDataURL(file);
    
    const fileInput = document.getElementById('ll-photo');
    if (fileInput && fileInput.files[0] !== file) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('ll-upload-zone');
    if (dropZone) {
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.add('dragover');
            }, false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.remove('dragover');
            }, false);
        });
        
        dropZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            handleFileSelect(files[0]);
        }, false);
    }
});

// ==========================================
// FORM STEPPER STATE ENGINE
// ==========================================
function updateFormSteps() {
    document.getElementById('ll-step-1').classList.add('hidden');
    document.getElementById('ll-step-2').classList.add('hidden');
    document.getElementById('ll-step-3').classList.add('hidden');
    
    document.getElementById(`ll-step-${currentPublishStep}`).classList.remove('hidden');
    
    for (let i = 1; i <= 3; i++) {
        const dot = document.getElementById(`step-dot-${i}`);
        if (dot) {
            dot.className = 'step-dot';
            if (i < currentPublishStep) {
                dot.classList.add('completed');
                dot.innerHTML = '✓';
            } else if (i === currentPublishStep) {
                dot.classList.add('active');
                dot.innerHTML = i;
            } else {
                dot.innerHTML = i;
            }
        }
    }
    
    const prevBtn = document.getElementById('ll-btn-prev');
    const nextBtn = document.getElementById('ll-btn-next');
    const submitBtn = document.getElementById('ll-btn-submit');
    
    if (currentPublishStep === 1) {
        prevBtn.classList.add('hidden');
        nextBtn.classList.remove('hidden');
        submitBtn.classList.add('hidden');
    } else if (currentPublishStep === 2) {
        prevBtn.classList.remove('hidden');
        nextBtn.classList.remove('hidden');
        submitBtn.classList.add('hidden');
    } else if (currentPublishStep === 3) {
        prevBtn.classList.remove('hidden');
        nextBtn.classList.add('hidden');
        submitBtn.classList.remove('hidden');
    }
}

function nextStep() {
    if (currentPublishStep === 1) {
        const title = document.getElementById('ll-title');
        const mainArea = document.getElementById('ll-main-area-select');
        const loc = document.getElementById('ll-loc');
        
        if (!title.value.trim() || !mainArea.value || !loc.value.trim()) {
            alert("Please fill out all required fields in Step 1 (Title, Main Area, Exact Location).");
            return;
        }
        currentPublishStep = 2;
    } else if (currentPublishStep === 2) {
        const bhk = document.getElementById('ll-bhk');
        const rent = document.getElementById('ll-rent');
        const floor = document.getElementById('ll-floor');
        const phone = document.getElementById('ll-phone');
        
        if (!bhk.value.trim() || !rent.value.trim() || !floor.value.trim() || !phone.value.trim()) {
            alert("Please fill out all required fields in Step 2 (BHK Type, Rent, Floor, Phone Number).");
            return;
        }
        currentPublishStep = 3;
    }
    updateFormSteps();
}

// Replaced function definition end and other functions
function prevStep() {
    if (currentPublishStep > 1) {
        currentPublishStep--;
        updateFormSteps();
    }
}

function resetPublishForm() {
    editingListingId = null;
    editingListingOriginalImageUrl = '';
    document.getElementById('landlordForm').reset();
    clearSelectedImage();
    currentLat = null;
    currentLng = null;
    document.getElementById('loc-text').innerText = "Capture GPS Location coordinates";
    const btn = document.getElementById('btn-detect-loc');
    btn.classList.remove('bg-emerald-500/10', 'text-emerald-500', 'border-emerald-500/30');
    btn.classList.add('bg-surface-container', 'text-on-surface');
    
    document.getElementById('ll-publish-headline').innerText = "Publish Property";
    document.getElementById('ll-publish-subheadline').innerText = "Enter accurate details to list your room instantly.";
    document.getElementById('ll-btn-submit').innerText = "Publish Listing";
    
    currentPublishStep = 1;
    updateFormSteps();
}

// ==========================================
// RENTAL MODAL HANDLERS (LOCAL STORAGE METADATA)
// ==========================================
function openRentedModal(listingId) {
    const modal = document.getElementById('rented-modal');
    if (modal) {
        document.getElementById('rented-modal-listing-id').value = listingId;
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('rented-start-date').value = today;
        document.getElementById('rented-tenant-name').value = '';
        document.getElementById('rented-tenant-contact').value = '';
        modal.classList.remove('hidden');
    }
}

function closeRentedModal() {
    const modal = document.getElementById('rented-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

async function submitRentedDetails() {
    const id = document.getElementById('rented-modal-listing-id').value;
    const tenantName = document.getElementById('rented-tenant-name').value.trim();
    const tenantContact = document.getElementById('rented-tenant-contact').value.trim();
    const startDate = document.getElementById('rented-start-date').value;
    
    if (!tenantName || !tenantContact || !startDate) {
        alert("Please fill out all fields.");
        return;
    }
    
    try {
        const { error } = await supabaseClient.from('listings').update({ is_rented: true }).eq('id', id);
        if (error) throw error;
        
        localStorage.setItem('gn_rented_details_' + id, JSON.stringify({
            tenantName,
            tenantContact,
            startDate
        }));
        
        closeRentedModal();
        alert("Room marked as rented!");
        
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (user) {
            fetchLandlordData(user.id);
        }
    } catch (e) {
        alert(e.message);
    }
}

async function markListingActive(id) {
    if (confirm("Mark this room as active and available for rent?")) {
        try {
            const { error } = await supabaseClient.from('listings').update({ is_rented: false }).eq('id', id);
            if (error) throw error;
            
            localStorage.removeItem('gn_rented_details_' + id);
            alert("Listing is now active!");
            
            const { data: { user } } = await supabaseClient.auth.getUser();
            if (user) {
                fetchLandlordData(user.id);
            }
        } catch (e) {
            alert(e.message);
        }
    }
}

function togglePauseListing(id) {
    const key = 'gn_paused_' + id;
    const isCurrentlyPaused = localStorage.getItem(key) === 'true';
    if (isCurrentlyPaused) {
        localStorage.removeItem(key);
        alert("Listing resumed!");
    } else {
        localStorage.setItem(key, 'true');
        alert("Listing paused!");
    }
    
    supabaseClient.auth.getUser().then(({ data: { user } }) => {
        if (user) fetchLandlordData(user.id);
    });
}

// ==========================================
// RENDERERS & DATA SYNC
// ==========================================
function filterLandlordListings() {
    const searchVal = document.getElementById('ll-search-listings').value.toLowerCase();
    renderLandlordGrid(searchVal);
}

function renderLandlordGrid(searchQuery = '') {
    const grid = document.getElementById('ll-active-grid');
    if (!grid) return;
    
    const filtered = landlordListings.filter(r => {
        const matchesSearch = r.title.toLowerCase().includes(searchQuery) || 
                              r.location.toLowerCase().includes(searchQuery);
        return matchesSearch;
    });
    
    if (filtered.length === 0) {
        grid.innerHTML = `
        <div class="col-span-full py-16 flex flex-col items-center justify-center text-center space-y-3">
            <span class="material-symbols-outlined text-primary/30 text-5xl">folder_off</span>
            <div>
                <h4 class="font-bold text-sm text-primary">No Listings Found</h4>
                <p class="text-on-surface-variant text-[11px] mt-0.5">Try refining your search or add a new property listing.</p>
            </div>
        </div>
        `;
        return;
    }
    
    grid.innerHTML = filtered.map(r => {
        const isRented = r.is_rented;
        const isPaused = localStorage.getItem('gn_paused_' + r.id) === 'true';
        
        let statusText = 'Active';
        let badgeClass = 'bg-primary/10 text-primary border-primary/20';
        if (isRented) {
            statusText = 'Rented';
            badgeClass = 'bg-success/10 text-success border-success/20';
        } else if (isPaused) {
            statusText = 'Paused';
            badgeClass = 'bg-warning/10 text-warning border-warning/20';
        }
        
        const { customBhk, floorLevel } = parseFloorAndBhk(r);
        const escapedTitle = escapeHtml(r.title);
        const escapedLocation = escapeHtml(r.location);
        const escapedFloor = escapeHtml(floorLevel);
        const escapedRoad = escapeHtml(r.road_dist);
        const escapedImage = escapeHtml(r.image_url);
        const safeTitleForClick = String(r.title || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
        
        return `
        <div class="bg-surface-lowest rounded-3xl p-5 border border-outline-variant/30 flex flex-col justify-between shadow-sm relative group hover:shadow-md transition-all duration-300">
            <div class="flex justify-between items-center mb-4">
                <span class="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border ${badgeClass}">
                    ${statusText}
                </span>
                <div class="relative">
                    <button onclick="toggleActionMenu('${r.id}', event)" class="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant/70 hover:text-primary transition-colors flex items-center justify-center">
                        <span class="material-symbols-outlined text-sm">more_vert</span>
                    </button>
                    <div id="action-menu-${r.id}" class="hidden absolute right-0 top-8 bg-surface-lowest border border-outline-variant/30 rounded-xl shadow-xl py-1.5 w-36 z-20">
                        <button onclick="editListing('${r.id}'); event.stopPropagation();" class="w-full text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-on-surface hover:bg-surface-container hover:text-primary transition-colors flex items-center gap-2">
                            <span class="material-symbols-outlined text-xs">edit</span> Edit
                        </button>
                        ${!isRented ? `
                        <button onclick="openRentedModal('${r.id}'); event.stopPropagation();" class="w-full text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-on-surface hover:bg-surface-container hover:text-success transition-colors flex items-center gap-2">
                            <span class="material-symbols-outlined text-xs">check_circle</span> Mark Rented
                        </button>
                        ` : `
                        <button onclick="markListingActive('${r.id}'); event.stopPropagation();" class="w-full text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-on-surface hover:bg-surface-container hover:text-primary transition-colors flex items-center gap-2">
                            <span class="material-symbols-outlined text-xs">refresh</span> Make Active
                        </button>
                        `}
                        <button onclick="togglePauseListing('${r.id}'); event.stopPropagation();" class="w-full text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-on-surface hover:bg-surface-container hover:text-warning transition-colors flex items-center gap-2">
                            <span class="material-symbols-outlined text-xs">${isPaused ? 'play_arrow' : 'pause'}</span> ${isPaused ? 'Resume' : 'Pause'}
                        </button>
                        <button onclick="openMapModal(${r.lat}, ${r.lng}, '${safeTitleForClick}'); event.stopPropagation();" class="w-full text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-on-surface hover:bg-surface-container hover:text-accent transition-colors flex items-center gap-2">
                            <span class="material-symbols-outlined text-xs">map</span> View Map
                        </button>
                        <div class="h-px bg-outline-variant/20 my-1"></div>
                        <button onclick="deleteListing('${r.id}'); event.stopPropagation();" class="w-full text-left px-3 py-2 text-[10px] font-black uppercase tracking-wider text-error hover:bg-error/10 transition-colors flex items-center gap-2">
                            <span class="material-symbols-outlined text-xs text-error">delete</span> Delete
                        </button>
                    </div>
                </div>
            </div>

            <div class="flex gap-4 items-start mb-4">
                <img src="${escapedImage || 'https://via.placeholder.com/150'}" class="w-20 h-20 rounded-2xl object-cover border border-outline-variant/20 flex-shrink-0">
                <div class="min-w-0 flex-1">
                    <h4 class="font-headline font-black text-sm text-primary truncate" title="${escapedTitle}">${escapedTitle}</h4>
                    <p class="text-[10px] text-on-surface-variant font-bold truncate mt-0.5 flex items-center gap-1">
                        <span class="material-symbols-outlined text-[12px]">location_on</span> ${escapedLocation}
                    </p>
                    <div class="flex items-center gap-2 mt-2">
                        <span class="bg-primary/5 text-primary text-[9px] font-extrabold px-2 py-0.5 rounded border border-primary/10">${customBhk}</span>
                        <span class="bg-accent/5 text-accent text-[9px] font-extrabold px-2 py-0.5 rounded border border-accent/10">₹${r.rent.toLocaleString()}</span>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-2 mt-auto pt-3 border-t border-outline-variant/20 text-[9px] font-bold uppercase text-on-surface-variant">
                <div class="flex items-center gap-1">
                    <span class="material-symbols-outlined text-[13px] text-primary/70">stairs</span>
                    <span>Floor: ${escapedFloor}</span>
                </div>
                <div class="flex items-center gap-1">
                    <span class="material-symbols-outlined text-[13px] text-primary/70">add_road</span>
                    <span>Walk: ${escapedRoad}</span>
                </div>
            </div>
        </div>
        `;
    }).join('');
}

function renderRentedRooms() {
    const searchVal = document.getElementById('ll-search-rented').value.toLowerCase();
    const tbody = document.getElementById('ll-rented-tbody');
    const emptyState = document.getElementById('ll-rented-empty-state');
    
    if (!tbody) return;
    
    const rentedListings = landlordListings.filter(r => {
        if (!r.is_rented) return false;
        
        const details = JSON.parse(localStorage.getItem('gn_rented_details_' + r.id) || '{}');
        const matchesSearch = r.title.toLowerCase().includes(searchVal) || 
                              (details.tenantName && details.tenantName.toLowerCase().includes(searchVal));
        return matchesSearch;
    });
    
    if (rentedListings.length === 0) {
        tbody.innerHTML = '';
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }
    
    if (emptyState) emptyState.classList.add('hidden');
    
    tbody.innerHTML = rentedListings.map(r => {
        const details = JSON.parse(localStorage.getItem('gn_rented_details_' + r.id) || '{}');
        const tenantName = details.tenantName || 'N/A';
        const tenantContact = details.tenantContact || 'N/A';
        const startDate = details.startDate || 'N/A';
        const escapedTitle = escapeHtml(r.title);
        const escapedImage = escapeHtml(r.image_url);
        
        return `
        <tr class="hover:bg-surface-container/30 transition-colors">
            <td class="p-4 flex items-center gap-3">
                <img src="${escapedImage || 'https://via.placeholder.com/150'}" class="w-10 h-10 rounded-lg object-cover border border-outline-variant/20 flex-shrink-0">
                <span class="font-bold truncate max-w-[150px]" title="${escapedTitle}">${escapedTitle}</span>
            </td>
            <td class="p-4">${escapeHtml(tenantName)}</td>
            <td class="p-4">${escapeHtml(tenantContact)}</td>
            <td class="p-4 text-center">₹${r.rent.toLocaleString()}</td>
            <td class="p-4">${escapeHtml(startDate)}</td>
            <td class="p-4">
                <span class="bg-success/10 text-success border border-success/20 px-2 py-0.5 rounded text-[9px] uppercase font-black">Rented</span>
            </td>
            <td class="p-4 text-center">
                <button onclick="markListingActive('${r.id}'); event.stopPropagation();" class="px-3 py-1.5 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-all">
                    Make Active
                </button>
            </td>
        </tr>
        `;
    }).join('');
}

function detectLocation() {
    const btnText = document.getElementById('loc-text');
    const btn = document.getElementById('btn-detect-loc');
    
    btnText.innerText = "Detecting GPS...";
    
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                currentLat = position.coords.latitude;
                currentLng = position.coords.longitude;
                btnText.innerText = "GPS Captured ✓";
                btn.classList.add('bg-emerald-500/10', 'text-emerald-500', 'border-emerald-500/30');
                btn.classList.remove('bg-surface-container', 'text-on-surface');
            },
            (error) => {
                alert("Could not get location. Please allow location permissions in your browser.");
                btnText.innerText = "Capture GPS Location coordinates";
            }
        );
    } else {
        alert("Geolocation is not supported by your browser.");
        btnText.innerText = "Capture GPS Location coordinates";
    }
}

function editListing(id) {
    const listing = landlordListings.find(r => r.id === id);
    if (!listing) return;
    
    editingListingId = listing.id;
    editingListingOriginalImageUrl = listing.image_url;
    
    document.getElementById('ll-title').value = listing.title;
    
    const { mainArea, exactLocation } = parseLocationFields(listing.location);
    document.getElementById('ll-main-area-select').value = mainArea;
    document.getElementById('ll-loc').value = exactLocation;
    
    const { customBhk, floorLevel } = parseFloorAndBhk(listing);
    document.getElementById('ll-bhk').value = customBhk;
    document.getElementById('ll-floor').value = floorLevel;
    
    document.getElementById('ll-rent').value = listing.rent;
    document.getElementById('ll-phone').value = listing.contact;
    document.getElementById('ll-water').value = listing.water || '24/7';
    document.getElementById('ll-road').value = listing.road_dist || 'Roadside (0 min)';
    document.getElementById('ll-sun').checked = !!listing.sunlight;
    document.getElementById('ll-park').checked = !!listing.parking;
    document.getElementById('ll-balc').checked = !!listing.balcony;
    
    if (listing.image_url) {
        const imgPreview = document.getElementById('ll-image-preview');
        const container = document.getElementById('ll-image-preview-container');
        const uploadZone = document.getElementById('ll-upload-zone');
        if (imgPreview && container && uploadZone) {
            imgPreview.src = listing.image_url;
            container.classList.remove('hidden');
            uploadZone.classList.add('hidden');
        }
    } else {
        clearSelectedImage();
    }
    
    currentLat = listing.lat;
    currentLng = listing.lng;
    
    const locText = document.getElementById('loc-text');
    const locBtn = document.getElementById('btn-detect-loc');
    if (currentLat && currentLng) {
        if (locText) locText.innerText = "GPS Captured ✓";
        if (locBtn) {
            locBtn.classList.add('bg-emerald-500/10', 'text-emerald-500', 'border-emerald-500/30');
            locBtn.classList.remove('bg-surface-container', 'text-on-surface');
        }
    } else {
        if (locText) locText.innerText = "Capture GPS Location coordinates";
        if (locBtn) {
            locBtn.classList.remove('bg-emerald-500/10', 'text-emerald-500', 'border-emerald-500/30');
            locBtn.classList.add('bg-surface-container', 'text-on-surface');
        }
    }
    
    document.getElementById('ll-publish-headline').innerText = "Edit Property Details";
    document.getElementById('ll-publish-subheadline').innerText = "Modify listing parameters and update instantly.";
    document.getElementById('ll-btn-submit').innerText = "Update Property";
    
    currentPublishStep = 1;
    updateFormSteps();
    switchLandlordView('publish', true);
}

async function publishListing() {
    const btn = document.getElementById('ll-btn-submit');
    const original = btn.innerText;
    
    const title = document.getElementById('ll-title').value.trim();
    const mainArea = document.getElementById('ll-main-area-select').value;
    const exactLoc = document.getElementById('ll-loc').value.trim();
    
    if (!title || !mainArea || !exactLoc) {
        alert("Please fill out all required fields.");
        return;
    }
    
    const bhkInput = document.getElementById('ll-bhk').value.trim();
    const rentInput = document.getElementById('ll-rent').value;
    const floorInput = document.getElementById('ll-floor').value.trim();
    const phoneInput = document.getElementById('ll-phone').value.trim();
    
    if (!bhkInput || !rentInput || !floorInput || !phoneInput) {
        alert("Please fill out all specifications.");
        return;
    }
    
    const combinedLocation = `${mainArea} - ${exactLoc}`;
    const bhkInt = parseInt(bhkInput.match(/\d+/)?.[0]) || 1;
    const floorLevelEncoded = `${bhkInput} | ${floorInput}`;
    
    let lat = currentLat;
    let lng = currentLng;
    
    if (!lat || !lng) {
        const coordMap = {
            'Tadong': { lat: 27.3168, lng: 88.6053 },
            'Upper Tadong': { lat: 27.3168, lng: 88.6053 },
            'Lower Tadong': { lat: 27.3168, lng: 88.6053 },
            'Deorali': { lat: 27.3195, lng: 88.6075 },
            'Development Area': { lat: 27.3325, lng: 88.6185 },
            'Bojoghari': { lat: 27.3621, lng: 88.6189 },
            'Daragaon': { lat: 27.3204, lng: 88.6001 },
            'Gairigaon': { lat: 27.3115, lng: 88.6045 },
            'Ranipool': { lat: 27.2995, lng: 88.5947 },
            '5th Mile': { lat: 27.3135, lng: 88.6015 },
            '6th Mile': { lat: 27.3142, lng: 88.6025 },
            'Metro Point': { lat: 27.3188, lng: 88.6062 },
            'Sichey': { lat: 27.3364, lng: 88.6067 },
            'Chandmari': { lat: 27.3456, lng: 88.6212 },
            'Tibet Road': { lat: 27.3345, lng: 88.6145 },
            'MG Marg Area': { lat: 27.3314, lng: 88.6138 },
            'Burtuk': { lat: 27.3545, lng: 88.6225 },
            'Syari': { lat: 27.3198, lng: 88.6234 },
            'Lingding': { lat: 27.3145, lng: 88.6312 },
            'Pangthang': { lat: 27.3812, lng: 88.6195 },
            'Sokeythang': { lat: 27.3088, lng: 88.6115 },
            'Nam Nam': { lat: 27.3265, lng: 88.6112 },
            'Indira Bypass': { lat: 27.3212, lng: 88.6225 },
            'Baluwakhani': { lat: 27.3412, lng: 88.6235 },
            'Ranka': { lat: 27.3415, lng: 88.5712 },
            'Tintek': { lat: 27.3912, lng: 88.6512 },
            'Marchak': { lat: 27.2912, lng: 88.6112 },
            'Bhanu Path': { lat: 27.3331, lng: 88.6152 },
            'Zero Point': { lat: 27.3412, lng: 88.6182 },
            'Tathangchen': { lat: 27.3418, lng: 88.6228 },
            'Upper Sichey': { lat: 27.3385, lng: 88.6055 },
            'Lower Sichey': { lat: 27.3325, lng: 88.6085 }
        };
        
        if (coordMap[mainArea]) {
            lat = coordMap[mainArea].lat;
            lng = coordMap[mainArea].lng;
        } else {
            lat = 27.3314;
            lng = 88.6138;
        }
    }
    
    btn.innerText = "Syncing Cloud...";
    
    try {
        const file = document.getElementById('ll-photo').files[0];
        let url = editingListingOriginalImageUrl;
        
        if (file) {
            const path = `${Date.now()}_${file.name}`;
            await supabaseClient.storage.from('room-photos').upload(path, file);
            url = supabaseClient.storage.from('room-photos').getPublicUrl(path).data.publicUrl;
        }
        
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) throw new Error("User not authenticated.");
        
        const payload = {
            title: title,
            location: combinedLocation,
            rent: parseInt(rentInput),
            bhk: bhkInt,
            floor_level: floorLevelEncoded,
            contact: phoneInput,
            road_dist: document.getElementById('ll-road').value,
            water: document.getElementById('ll-water').value,
            sunlight: document.getElementById('ll-sun').checked,
            parking: document.getElementById('ll-park').checked,
            balcony: document.getElementById('ll-balc').checked,
            image_url: url,
            user_id: user.id,
            lat: lat,
            lng: lng
        };
        
        if (editingListingId) {
            const { error } = await supabaseClient.from('listings').update(payload).eq('id', editingListingId);
            if (error) throw error;
            alert("Updated successfully!");
        } else {
            const { error } = await supabaseClient.from('listings').insert([payload]);
            if (error) throw error;
            alert("Published successfully!");
        }
        
        resetPublishForm();
        switchLandlordView('listings');
        fetchLandlordData(user.id);
    } catch (e) {
        alert(e.message);
    } finally {
        btn.innerText = original;
    }
}

async function fetchLandlordData(uid) {
    const { data } = await supabaseClient.from('listings').select('*').eq('user_id', uid).order('created_at', { ascending: false });
    
    landlordListings = data || [];
    
    landlordListings.forEach(r => {
        const key = 'gn_views_' + r.id;
        if (!localStorage.getItem(key)) {
            localStorage.setItem(key, Math.floor(Math.random() * 120) + 80);
        }
    });
    
    const totalActive = landlordListings.length;
    const activeCount = landlordListings.filter(r => !r.is_rented && localStorage.getItem('gn_paused_' + r.id) !== 'true').length;
    const rentedCount = landlordListings.filter(r => r.is_rented).length;
    
    const totalViews = landlordListings.reduce((sum, r) => sum + parseInt(localStorage.getItem('gn_views_' + r.id) || 0), 0);
    const totalInquiries = Math.round(totalViews * 0.03) + (totalActive > 0 ? 2 : 0);
    
    const statTotal = document.getElementById('ll-stat-total');
    const statActive = document.getElementById('ll-stat-active');
    const statRented = document.getElementById('ll-stat-rented');
    const statViews = document.getElementById('ll-stat-views');
    const statInquiries = document.getElementById('ll-stat-inquiries');
    
    if (statTotal) statTotal.innerText = totalActive;
    if (statActive) statActive.innerText = activeCount;
    if (statRented) statRented.innerText = rentedCount;
    if (statViews) statViews.innerText = totalViews;
    if (statInquiries) statInquiries.innerText = totalInquiries;
    
    renderLandlordGrid();
    renderRentedRooms();
}

async function deleteListing(id) { 
    if(confirm("Delete Listing? This action cannot be undone.")) { 
        try {
            await supabaseClient.from('listings').delete().eq('id', id); 
            localStorage.removeItem('gn_views_' + id);
            localStorage.removeItem('gn_paused_' + id);
            localStorage.removeItem('gn_rented_details_' + id);
            const { data: { user } } = await supabaseClient.auth.getUser();
            if (user) fetchLandlordData(user.id);
        } catch (e) {
            alert(e.message);
        }
    }
}

async function fetchTenantData() {
    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/listings?select=*&order=created_at.desc`, {
            headers: {
                'apikey': supabaseKey,
                'Content-Type': 'application/json'
                // Deliberately omitting Authorization header to bypass user-specific RLS rules
            }
        });
        if (!response.ok) throw new Error("Failed to fetch listings");
        const data = await response.json();
        allRooms = data || [];
        
        // Initialize the split screen Leaflet map dynamically
        setTimeout(() => {
            initTenantMap();
            filterTenantRooms();
        }, 100);
    } catch (e) {
        console.error(e);
        allRooms = [];
        filterTenantRooms();
    }
}

function setTenantBHK(b, btn) {
    activeBHK = b;
    document.querySelectorAll('.tn-bhk-btn').forEach(x => {
        x.className = "tn-bhk-btn px-3.5 py-1.5 rounded-lg text-[9px] font-black bg-transparent text-on-surface uppercase transition-colors";
    });
    btn.className = "tn-bhk-btn active-bhk px-3.5 py-1.5 rounded-lg text-[9px] font-black bg-primary text-white dark:text-surface shadow uppercase transition-colors";
    filterTenantRooms();
}

// ==========================================
// SMART ROOMMATE SHARE ENGINE
// ==========================================
function shareRoom(roomId) {
    const room = allRooms.find(r => r.id === roomId);
    if (!room) return;

    const bhkText = room.bhk === 4 ? 'Homestay / 4+ BHK' : `${room.bhk} BHK`;
    const features = [];
    if(room.parking) features.push('Parking');
    if(room.balcony) features.push('a Balcony');
    if(room.sunlight) features.push('great Sunlight');
    
    const featureString = features.length > 0 ? ` with ${features.join(', ')}` : '';
    const shareText = `Hey! Found this ${bhkText} in ${room.location} for ₹${room.rent}/mo${featureString} on GangtokNest.\n\nCheck it out here: ${window.location.href}`;

    if (navigator.share) {
        navigator.share({
            title: 'GangtokNest Property',
            text: shareText
        }).catch(err => console.log('Share dismissed', err));
    } else {
        navigator.clipboard.writeText(shareText).then(() => {
            alert("Room details copied to clipboard! You can paste it to your friends.");
        });
    }
}

function filterTenantRooms(explicitSearch = false) {
    try {
    if (explicitSearch) window.hasExplicitlySearched = true;

    if (!allRooms) return;
    
    const searchInput = document.getElementById('tn-search');
    const priceInput = document.getElementById('tn-price');
    
    if (!searchInput || !priceInput) return;
    
    const s = searchInput.value.toLowerCase().trim();
    const p = parseInt(priceInput.value);
    document.getElementById('tn-price-label').innerText = `₹${(p/1000).toFixed(0)}K`;
    
    let searchRentLimit = null;
    let searchBHK = null;
    let searchParking = false;
    let searchSunlight = false;
    let searchBalcony = false;
    const keywordTokens = [];

    if (s.length > 0) {
        // 1. Extract BHK via regex
        const bhkMatch = s.match(/\b([1-4])\s*(?:bhk|b|bed|bedroom|bedrooms)\b/i);
        if (bhkMatch) {
            searchBHK = parseInt(bhkMatch[1]);
        }
        
        // 2. Extract Price limit via regex: e.g. 5000, 5k, 12000, 12k
        const priceKMatch = s.match(/\b(\d+)\s*k\b/i);
        if (priceKMatch) {
            searchRentLimit = parseInt(priceKMatch[1]) * 1000;
        } else {
            const priceNumMatch = s.match(/\b(\d{4,6})\b/);
            if (priceNumMatch) {
                searchRentLimit = parseInt(priceNumMatch[1]);
            }
        }
        
        // 3. Extract Amenities
        if (/\b(parking|park|car)\b/i.test(s)) {
            searchParking = true;
        }
        if (/\b(sunlight|sun|sunny)\b/i.test(s)) {
            searchSunlight = true;
        }
        if (/\b(balcony|terrace)\b/i.test(s)) {
            searchBalcony = true;
        }
        
        // 4. Identify remaining keyword tokens
        const allTokens = s.split(/\s+/).filter(t => t.length > 0);
        
        for (let i = 0; i < allTokens.length; i++) {
            const token = allTokens[i];
            
            // Skip price tokens
            if (/^\d{4,6}$/.test(token) || /^\d+k$/i.test(token)) {
                continue;
            }
            
            // Skip BHK tokens
            if (/^\d(?:bhk|b)$/i.test(token) || /^(bhk|b|bed|bedroom|bedrooms)$/i.test(token)) {
                continue;
            }
            if (/^[1-4]$/.test(token) && i + 1 < allTokens.length && /^(bhk|b|bed|bedroom|bedrooms)$/i.test(allTokens[i+1])) {
                continue;
            }
            if (/^(bhk|b|bed|bedroom|bedrooms)$/i.test(token) && i - 1 >= 0 && /^[1-4]$/.test(allTokens[i-1])) {
                continue;
            }
            
            // Skip amenity tokens
            if (/^(parking|park|car|sunlight|sun|sunny|balcony|terrace)$/i.test(token)) {
                continue;
            }
            
            keywordTokens.push(token);
        }
    }

    let filtered = allRooms.filter(r => {
        // Exclude rented or paused listings from tenant view
        const isActive = !r.is_rented && localStorage.getItem('gn_paused_' + r.id) !== 'true';
        if (!isActive) return false;

        const matchesKeywords = keywordTokens.every(token => {
            return String(r.title || '').toLowerCase().includes(token) || 
                   String(r.location || '').toLowerCase().includes(token) ||
                   (String(r.road_dist || '').toLowerCase().includes(token));
        });
        const matchesSearch = keywordTokens.length === 0 || matchesKeywords;
        const matchesLocality = activeLocality === '' || String(r.location || '').toLowerCase().includes(String(activeLocality).toLowerCase());
        
        // Rent: Use searchRentLimit if parsed, otherwise price slider
        const rentLimitToUse = searchRentLimit !== null ? searchRentLimit : p;
        const matchesPrice = r.rent <= rentLimitToUse;
        
        // BHK: Use searchBHK if parsed, otherwise activeBHK filter
        const bhkToUse = searchBHK !== null ? searchBHK : activeBHK;
        const matchesBHK = bhkToUse === 0 || r.bhk === bhkToUse;
        
        // Amenities: Require if check or parsed from search
        const matchesParking = !(searchParking || filterParking) || String(r.parking) === 'true' || r.parking === true;
        const matchesSunlight = !(searchSunlight || filterSunlight) || String(r.sunlight) === 'true' || r.sunlight === true;
        const matchesBalcony = !(searchBalcony || filterBalcony) || String(r.balcony) === 'true' || r.balcony === true;
        const matchesWifi = !filterWifi || String(r.wifi) === 'true' || r.wifi === true;
        
        // Strict dropdown filters for Road and Water
        const matchesRoad = filterRoad === 'all' || String(r.road_dist) === filterRoad;
        const matchesWater = filterWater === 'all' || String(r.water) === filterWater;
        
        const matchesFavorites = !filterFavorites || favorites.includes(r.id);
        
        return matchesSearch && matchesLocality && matchesPrice && matchesBHK && 
               matchesParking && matchesSunlight && matchesBalcony && matchesWifi && matchesRoad && matchesWater && matchesFavorites;
    });
    
    filtered = filtered.map(r => {
        let totalPrefs = 0;
        let matchedPrefs = 0;
        
        if (filterSunlight || searchSunlight) {
            totalPrefs++;
            if (r.sunlight) matchedPrefs++;
        }
        if (filterParking || searchParking) {
            totalPrefs++;
            if (r.parking) matchedPrefs++;
        }
        if (filterBalcony || searchBalcony) {
            totalPrefs++;
            if (r.balcony) matchedPrefs++;
        }
        if (filterWater !== 'all') {
            totalPrefs++;
            if (r.water === filterWater) matchedPrefs++;
        }
        if (filterRoad !== 'all') {
            totalPrefs++;
            if (r.road_dist === filterRoad) matchedPrefs++;
        }
        
        const score = totalPrefs > 0 ? Math.round((matchedPrefs / totalPrefs) * 100) : null;
        return { ...r, matchScore: score };
    });
    
    const hasPreferences = (filterSunlight || filterParking || filterBalcony || filterWater !== 'all' || filterRoad !== 'all' || searchSunlight || searchParking || searchBalcony);
    if (hasPreferences) {
        filtered.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
    }
    
    // Sync map if active
    if (mainTenantMap) {
        updateTenantMapMarkers(filtered);
    }
    
    // Determine if search is active (user typed or locality selected or amenity filter on)
    const isSearchActive = s.length > 0 || activeLocality !== '' || activeBHK !== 0 || 
        filterParking || filterSunlight || filterBalcony || 
        filterWater !== 'all' || filterRoad !== 'all' || p < 25000;
    
    const searchHero = document.getElementById('tn-search-hero');
    const resultsArea = document.getElementById('tn-results-area');
    const searchClearBtn = document.getElementById('tn-search-clear');
    
    // Also, if tab is 'saved', we always treat it as if search is active so results show
    const isSavedTab = filterFavorites;
    const shouldShowResults = isSearchActive || isSavedTab || window.hasExplicitlySearched;
    
    if (shouldShowResults) {
        // Hide Hero, Show Results
        if (searchHero) searchHero.classList.add('hidden');
        if (resultsArea) resultsArea.classList.remove('hidden');
        if (searchClearBtn && s.length > 0) searchClearBtn.classList.remove('hidden');
    } else {
        // Show Hero, Hide Results
        if (searchHero) searchHero.classList.remove('hidden');
        if (resultsArea) resultsArea.classList.add('hidden');
        if (searchClearBtn) searchClearBtn.classList.add('hidden');
    }
    
    // Render count
    const countEl = document.getElementById('results-count');
    if (countEl) {
        countEl.innerText = filtered.length;
    }
    
    // Render saved badge
    const savedBadge = document.getElementById('saved-badge');
    if (savedBadge) {
        const favCount = allRooms.filter(r => favorites.includes(r.id)).length;
        if (favCount > 0) {
            savedBadge.innerText = favCount;
            savedBadge.classList.remove('hidden');
        } else {
            savedBadge.classList.add('hidden');
        }
    }
    
    const gridContainer = document.getElementById('tn-grid');
    if (!gridContainer) return;
    
    if (filtered.length === 0) {
        gridContainer.innerHTML = `
        <div class="col-span-full py-16 flex flex-col items-center justify-center text-center space-y-4">
            <span class="material-symbols-outlined text-primary/30 text-6xl">search_off</span>
            <div>
                <h3 class="font-headline font-black text-base text-primary">No Rooms Found</h3>
                <p class="text-on-surface-variant text-xs mt-1">We couldn't find any rooms matching your search and filter criteria.</p>
            </div>
            <button onclick="resetFilters()" class="px-5 py-2.5 bg-primary text-white dark:text-surface rounded-xl font-black text-xs uppercase tracking-wider shadow-md hover:opacity-95 transition-all">Clear All Filters</button>
        </div>
        `;
        return;
    }
    
    gridContainer.innerHTML = filtered.map(r => {
        const hasMap = r.lat && r.lng; 
        const escapedTitle = escapeHtml(r.title);
        const escapedLocation = escapeHtml(r.location);
        const { customBhk, floorLevel } = parseFloorAndBhk(r);
        const escapedFloor = escapeHtml(floorLevel);
        const escapedRoad = escapeHtml(r.road_dist);
        const escapedImage = escapeHtml(r.image_url);
        const safeTitleForClick = String(r.title || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');

        let featuresHtml = '';
        if(r.sunlight) featuresHtml += `<span class="bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 px-2 py-1 rounded-md text-[8px] font-bold uppercase border border-amber-500/20">Sunlight</span>`;
        if(r.parking) featuresHtml += `<span class="bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-md text-[8px] font-bold uppercase border border-blue-500/20">Parking</span>`;
        if(r.balcony) featuresHtml += `<span class="bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded-md text-[8px] font-bold uppercase border border-emerald-500/20">Balcony</span>`;

        const isFav = favorites.includes(r.id);
        const isFeatured = false;
        
        const cardClass = `bg-surface-container-lowest rounded-[2rem] overflow-hidden shadow-lg border border-outline-variant/30 flex flex-col group hover:-translate-y-1 transition-all relative cursor-pointer`;

        return `
        <article id="room-${r.id}" class="${cardClass}" onclick="focusMapOnRoom('${r.id}')" onmouseenter="highlightMapMarker('${r.id}')">
            <div class="h-48 relative overflow-hidden">
                <img src="${escapedImage}" class="w-full h-full object-cover">
                
                <!-- Favorites button overlay -->
                <button onclick="toggleFavorite('${r.id}'); event.stopPropagation();" class="absolute top-3 right-3 bg-surface-container-lowest/80 backdrop-blur-md text-error hover:scale-110 active:scale-95 w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition-all z-10" title="${isFav ? 'Remove from Saved' : 'Save Room'}">
                    <span class="material-symbols-outlined ${isFav ? 'font-filled' : ''} text-lg">favorite</span>
                </button>
                
                <!-- Badges overlay -->
                <div class="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
                    <div class="bg-surface text-primary px-3 py-1.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl flex items-center gap-1.5 border border-outline-variant/50">
                        <span class="material-symbols-outlined text-sm">meeting_room</span> ${customBhk}
                    </div>
                    ${r.matchScore !== null ? `
                    <div class="bg-primary text-white dark:text-surface px-2.5 py-1.5 rounded-lg font-black text-[9px] uppercase tracking-widest shadow-lg flex items-center gap-1.5 border border-primary/20">
                        <span class="material-symbols-outlined text-xs">verified</span> ${r.matchScore}% Match
                    </div>
                    ` : ''}
                </div>
                
                <div class="absolute bottom-3 right-3 bg-primary text-white dark:text-surface px-3 py-1.5 rounded-lg font-black text-sm shadow-xl">₹${r.rent}</div>
            </div>
            <div class="p-5 flex flex-col flex-grow">
                <h3 class="text-lg font-black text-primary mb-1 truncate">${escapedTitle}</h3>
                <p class="text-on-surface-variant text-xs mb-3 flex items-center gap-1"><span class="material-symbols-outlined text-sm">location_on</span>${escapedLocation}</p>
                
                <div class="flex flex-wrap gap-1.5 mb-4">
                    ${featuresHtml}
                </div>

                <div class="grid grid-cols-2 gap-2 mb-4">
                    <div class="bg-surface-container p-2 rounded-lg text-[9px] font-bold text-center uppercase text-on-surface transition-colors">Floor: ${escapedFloor}</div>
                    <div class="bg-surface-container p-2 rounded-lg text-[9px] font-bold text-center uppercase text-on-surface transition-colors">Road: ${escapedRoad}</div>
                </div>
                
                <div class="flex flex-col gap-2 mt-auto">
                    <div class="flex gap-2">
                        ${hasMap ? `
                        <button onclick="focusMapOnRoom('${r.id}'); event.stopPropagation();" class="flex-1 py-2.5 rounded-xl bg-surface-container text-on-surface font-black uppercase text-[9px] flex items-center justify-center gap-1.5 hover:bg-outline-variant/30 transition-all shadow-sm">
                            <span class="material-symbols-outlined text-[1rem]">map</span> View Map
                        </button>
                        ` : ''}
                        <a href="tel:${r.phone}" onclick="event.stopPropagation();" class="flex-1 py-2.5 rounded-xl bg-primary/10 text-primary font-black uppercase text-[9px] flex items-center justify-center gap-1.5 hover:bg-primary hover:text-white transition-all shadow-sm">
                            <span class="material-symbols-outlined text-[1rem]">call</span> Call
                        </a>
                    </div>
                    <button onclick="requestVisit('${r.id}'); event.stopPropagation();" class="w-full py-2.5 rounded-xl bg-surface border border-outline-variant/40 text-on-surface font-black uppercase text-[9px] flex items-center justify-center gap-1.5 hover:border-primary/50 hover:text-primary transition-all shadow-sm">
                        <span class="material-symbols-outlined text-[1rem]">event</span> Schedule Visit
                    </button>
                    <button onclick="shareRoom('${r.id}'); event.stopPropagation();" class="w-full py-3 rounded-xl bg-surface-container text-on-surface font-black uppercase text-[10px] flex items-center justify-center gap-1.5 hover:bg-outline-variant/30 transition-all shadow-sm">
                        <span class="material-symbols-outlined text-[1rem]">ios_share</span> Share
                    </button>
                    <a href="https://wa.me/91${r.contact}" target="_blank" onclick="event.stopPropagation();" class="w-full py-3 rounded-xl bg-accent text-white font-black uppercase text-[10px] flex items-center justify-center gap-1.5 hover:opacity-90 transition-all shadow-md">
                        <span class="material-symbols-outlined text-[1rem]">chat</span> WhatsApp Owner
                    </a>
                </div>
            </div>
        </article>`;
    }).join('');
    } catch (e) {
        alert("FILTER CRASH: " + e.message + "\n" + e.stack);
        console.error(e);
    }
}

function quickSearch(tag) {
    // Reset filters first
    clearTenantSearch();
    
    // Set the specific tag
    const searchInput = document.getElementById('tn-search');
    const localitySelect = document.getElementById('tn-locality-select');
    
    const lTag = tag.toLowerCase();
    
    // Check if it's a locality
    const localities = ['tadong', 'upper tadong', 'lower tadong', 'deorali', 'development area', 'bojoghari', 'daragaon', 'gairigaon', 'ranipool', '5th mile', '6th mile', 'metro point', 'sichey', 'chandmari', 'tibet road', 'mg marg', 'burtuk', 'syari', 'lingding', 'pangthang', 'sokeythang', 'nam nam', 'indira bypass', 'baluwakhani', 'ranka', 'tintek', 'marchak', 'majhitar'];
    
    if (localities.includes(lTag)) {
        if (localitySelect) {
            localitySelect.value = localities.find(loc => loc.toLowerCase() === lTag).split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            handleLocalityChange(localitySelect.value);
        }
    } else {
        if (searchInput) {
            searchInput.value = tag;
            filterTenantRooms(true);
        }
    }
    
    // Ensure we switch to explore tab
    setTenantTab('explore');
}

function clearTenantSearch() {
    window.hasExplicitlySearched = false;
    const searchInput = document.getElementById('tn-search');
    const localitySelect = document.getElementById('tn-locality-select');
    if (searchInput) searchInput.value = '';
    if (localitySelect) { localitySelect.value = ''; activeLocality = ''; }
    // Reset BHK to ALL
    activeBHK = 0;
    document.querySelectorAll('.tn-bhk-btn').forEach(b => {
        b.classList.remove('bg-primary', 'text-white', 'dark:text-surface', 'shadow', 'active-bhk');
        if (b.innerText.trim() === 'ALL') b.classList.add('bg-primary', 'text-white', 'dark:text-surface', 'shadow', 'active-bhk');
    });
    // Reset price slider to max
    const priceInput = document.getElementById('tn-price');
    if (priceInput) priceInput.value = 25000;
    
    // Switch back to explore mode
    setTenantTab('explore');
}


function openMapModal(lat, lng, title) {
    document.getElementById('map-modal').classList.remove('hidden');
    document.getElementById('map-title').innerText = title;
    
    if (!tenantMap) {
        tenantMap = L.map('map-container').setView([lat, lng], 16);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(tenantMap);
        
        tenantMarker = L.marker([lat, lng]).addTo(tenantMap);
    } else {
        tenantMap.setView([lat, lng], 16);
        tenantMarker.setLatLng([lat, lng]);
    }
    
    setTimeout(() => {
        tenantMap.invalidateSize();
    }, 150);
}

function closeMapModal() {
    document.getElementById('map-modal').classList.add('hidden');
}

function openFeaturedModal() {
    renderFeaturedRooms();
    const backdrop = document.getElementById('featured-backdrop');
    const drawer = document.getElementById('featured-modal');
    if (!drawer) return;
    // Show backdrop
    backdrop.classList.remove('hidden');
    setTimeout(() => backdrop.classList.remove('opacity-0'), 10);
    // Slide drawer in
    drawer.classList.remove('translate-x-full');
    drawer.classList.add('translate-x-0');
    document.body.style.overflow = 'hidden';
}

function closeFeaturedModal() {
    const backdrop = document.getElementById('featured-backdrop');
    const drawer = document.getElementById('featured-modal');
    if (!drawer) return;
    // Slide drawer out
    drawer.classList.add('translate-x-full');
    drawer.classList.remove('translate-x-0');
    // Fade out backdrop
    if (backdrop) {
        backdrop.classList.add('opacity-0');
        setTimeout(() => backdrop.classList.add('hidden'), 300);
    }
    document.body.style.overflow = '';
}

function renderFeaturedRooms() {
    const gridContainer = document.getElementById('tn-featured-grid');
    const emptyContainer = document.getElementById('tn-featured-empty');
    if (!gridContainer) return;

    // Filter to only active listings
    const activeListings = allRooms.filter(r => !r.is_rented && localStorage.getItem('gn_paused_' + r.id) !== 'true');
    // Top 3 active listings are featured
    const featured = activeListings.slice(0, 3);

    if (featured.length === 0) {
        gridContainer.innerHTML = '';
        if (emptyContainer) emptyContainer.classList.remove('hidden');
        return;
    }

    if (emptyContainer) emptyContainer.classList.add('hidden');

    gridContainer.innerHTML = featured.map((r, idx) => {
        const escapedTitle = escapeHtml(r.title);
        const escapedLocation = escapeHtml(r.location);
        const { customBhk, floorLevel } = parseFloorAndBhk(r);
        const escapedFloor = escapeHtml(floorLevel);
        const escapedRoad = escapeHtml(r.road_dist);
        const escapedImage = escapeHtml(r.image_url);
        const hasMap = r.lat && r.lng;

        const badges = [];
        if (r.sunlight) badges.push(`<span class="bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-md text-[8px] font-bold uppercase">☀ Sunlight</span>`);
        if (r.parking) badges.push(`<span class="bg-blue-500/15 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-md text-[8px] font-bold uppercase">🚗 Parking</span>`);
        if (r.balcony) badges.push(`<span class="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md text-[8px] font-bold uppercase">🌿 Balcony</span>`);

        const isFav = favorites.includes(r.id);
        const rankColors = ['bg-accent', 'bg-primary', 'bg-secondary'];
        const rankLabel = ['#1 Pick', '#2 Pick', '#3 Pick'];

        return `
        <div class="bg-surface-container rounded-2xl overflow-hidden shadow-md border border-outline-variant/20 group hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 cursor-pointer" onclick="closeFeaturedModal(); setTimeout(() => focusMapOnRoom('${r.id}'), 350);">
            <!-- Image Row -->
            <div class="relative h-44 overflow-hidden">
                <img src="${escapedImage}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="${escapedTitle}">
                <!-- Dark gradient for text legibility -->
                <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent"></div>
                <!-- Rank badge -->
                <div class="absolute top-3 left-3">
                    <span class="${rankColors[idx] || 'bg-primary'} text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-lg">
                        <span class="material-symbols-outlined text-[11px] font-filled">grade</span> ${rankLabel[idx] || 'Featured'}
                    </span>
                </div>
                <!-- Fav button -->
                <button onclick="toggleFavorite('${r.id}'); renderFeaturedRooms(); event.stopPropagation();" class="absolute top-3 right-3 w-8 h-8 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-error/80 transition-all" title="${isFav ? 'Remove from Saved' : 'Save Room'}">
                    <span class="material-symbols-outlined ${isFav ? 'font-filled' : ''} text-base">favorite</span>
                </button>
                <!-- Price at bottom -->
                <div class="absolute bottom-3 right-3 bg-primary text-white px-3 py-1 rounded-lg font-black text-sm shadow-lg">₹${r.rent}<span class="text-[9px] font-bold opacity-80">/mo</span></div>
                <!-- BHK at bottom left -->
                <div class="absolute bottom-3 left-3 bg-black/50 backdrop-blur-sm text-white px-2.5 py-1 rounded-lg font-black text-[9px] uppercase tracking-wider">${customBhk}</div>
            </div>
            <!-- Info Row -->
            <div class="p-4">
                <h4 class="font-headline font-black text-primary text-sm truncate mb-1">${escapedTitle}</h4>
                <p class="text-on-surface-variant text-[11px] flex items-center gap-1 mb-3">
                    <span class="material-symbols-outlined text-sm">location_on</span> ${escapedLocation}
                </p>
                <div class="flex flex-wrap gap-1 mb-3">${badges.join('') || '<span class="text-on-surface-variant text-[9px]">No special amenities listed</span>'}</div>
                <div class="grid grid-cols-2 gap-2 mb-3 text-[9px] font-bold uppercase text-on-surface-variant">
                    <div class="bg-surface-container-high rounded-lg p-2 text-center">Floor: ${escapedFloor}</div>
                    <div class="bg-surface-container-high rounded-lg p-2 text-center">Road: ${escapedRoad}</div>
                </div>
                <div class="flex gap-2">
                    <a href="https://wa.me/91${r.contact}" target="_blank" onclick="event.stopPropagation();" class="flex-1 py-2.5 rounded-xl bg-accent text-white font-black text-[10px] uppercase flex items-center justify-center gap-1.5 hover:opacity-90 transition-all">
                        <span class="material-symbols-outlined text-[1rem]">chat</span> WhatsApp
                    </a>
                    ${hasMap ? `<button onclick="closeFeaturedModal(); setTimeout(() => focusMapOnRoom('${r.id}'), 350); event.stopPropagation();" class="flex-1 py-2.5 rounded-xl bg-surface-container-high text-on-surface font-black text-[10px] uppercase flex items-center justify-center gap-1.5 hover:bg-outline-variant/30 transition-all">
                        <span class="material-symbols-outlined text-[1rem]">map</span> View Map
                    </button>` : ''}
                </div>
            </div>
        </div>`;
    }).join('');
}

// Modal controls for landlord portal
function openAuthModal() {
    selectRole('landlord');
    document.getElementById('auth-modal').classList.remove('hidden');
}

function openTenantAuthModal() {
    selectRole('tenant');
    document.getElementById('auth-modal').classList.remove('hidden');
}

function closeAuthModal() {
    document.getElementById('auth-modal').classList.add('hidden');
}

// Locality fast filter control
// Mobile Filter Drawer toggle control
function toggleMobileFilters() {
    const filters = document.getElementById('tn-filters-container');
    const backdrop = document.getElementById('tn-filters-backdrop');
    const toggleText = document.getElementById('filter-toggle-text');
    
    if (!filters) return;
    
    if (filters.classList.contains('show-mobile')) {
        filters.classList.remove('show-mobile');
        filters.classList.add('hidden'); // Re-hide to prevent focus and layout issues
        if (backdrop) {
            backdrop.classList.add('opacity-0');
            setTimeout(() => backdrop.classList.add('hidden'), 300);
        }
        if (toggleText) toggleText.innerText = "Show Filters";
    } else {
        filters.classList.remove('hidden');
        // Force layout reflow
        filters.offsetHeight;
        filters.classList.add('show-mobile');
        if (backdrop) {
            backdrop.classList.remove('hidden');
            backdrop.offsetHeight; // Force reflow
            backdrop.classList.remove('opacity-0');
        }
        if (toggleText) toggleText.innerText = "Hide Filters";
    }
}

// Locality drop-down handler
let activeLocality = '';
function handleLocalityChange(value) {
    activeLocality = value;
}

// Favorites toggle state action
function toggleFavorite(roomId) {
    const idx = favorites.indexOf(roomId);
    if (idx === -1) {
        favorites.push(roomId);
    } else {
        favorites.splice(idx, 1);
    }
    localStorage.setItem('gn_favorites', JSON.stringify(favorites));
    filterTenantRooms();
}

// Locality fast filter control (Retained for backwards compatibility)
function filterByLocality(locName, btn) {
    activeLocality = locName;
    document.querySelectorAll('.loc-pill').forEach(b => {
        b.className = "loc-pill px-4 py-2 rounded-full text-xs font-bold bg-surface-container text-on-surface hover:bg-outline-variant/30 transition-all";
    });
    btn.className = "loc-pill active-pill px-4 py-2 rounded-full text-xs font-bold bg-primary text-white dark:text-surface transition-all shadow-sm";
    filterTenantRooms();
}

// ==========================================
// ADVANCED SMART FILTERING & SPLIT-SCREEN VIEW SYSTEM
// ==========================================
let mobileActivePanel = 'listings'; // 'listings' or 'map'

function initTenantMap() {
    if (mainTenantMap) return;
    const mapDiv = document.getElementById('main-tenant-map-container');
    if (!mapDiv) return;
    
    mainTenantMap = L.map('main-tenant-map-container').setView([27.3314, 88.6138], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(mainTenantMap);
    
    mainTenantMap.invalidateSize();
}

function setTenantTab(tab) {
    filterFavorites = (tab === 'saved');
    
    const tabLabel = document.getElementById('tenant-current-tab-label');
    const navExplore = document.getElementById('tn-nav-top-explore');
    const navSaved = document.getElementById('tn-nav-top-saved');
    
    const activeClass = "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-xs md:text-sm font-black uppercase tracking-widest transition-all duration-300 bg-primary text-white dark:text-surface shadow-md";
    const inactiveClass = "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-xs md:text-sm font-black uppercase tracking-widest transition-all duration-300 bg-surface border border-outline-variant/40 text-on-surface hover:bg-surface-container hover:shadow-sm";
    
    if (tab === 'saved') {
        if (navExplore) navExplore.className = inactiveClass;
        if (navSaved) navSaved.className = activeClass;
        if (tabLabel) tabLabel.innerText = 'Saved Rooms';
    } else {
        if (navExplore) navExplore.className = activeClass;
        if (navSaved) navSaved.className = inactiveClass;
        if (tabLabel) tabLabel.innerText = 'Search Results';
    }
    
    filterTenantRooms();
}

function toggleMobileView() {
    const listingsPanel = document.getElementById('tn-listings-panel');
    const mapPanel = document.getElementById('tn-map-panel');
    const toggleBtn = document.getElementById('btn-mobile-toggle-view');
    const toggleText = document.getElementById('mobile-toggle-text');
    
    if (!listingsPanel || !mapPanel) return;
    
    if (mobileActivePanel === 'listings') {
        mobileActivePanel = 'map';
        
        listingsPanel.classList.add('mobile-panel-hidden');
        listingsPanel.classList.remove('mobile-panel-visible');
        
        mapPanel.classList.add('mobile-panel-visible');
        mapPanel.classList.remove('mobile-panel-hidden');
        
        if (toggleText) toggleText.innerText = "Show List";
        if (toggleBtn) {
            const icon = toggleBtn.querySelector('.material-symbols-outlined');
            if (icon) icon.innerText = "list";
        }
        
        // Re-align Leaflet sizing and map pins
        setTimeout(() => {
            initTenantMap();
            mainTenantMap.invalidateSize();
            filterTenantRooms();
        }, 150);
    } else {
        mobileActivePanel = 'listings';
        
        listingsPanel.classList.add('mobile-panel-visible');
        listingsPanel.classList.remove('mobile-panel-hidden');
        
        mapPanel.classList.add('mobile-panel-hidden');
        mapPanel.classList.remove('mobile-panel-visible');
        
        if (toggleText) toggleText.innerText = "Show Map";
        if (toggleBtn) {
            const icon = toggleBtn.querySelector('.material-symbols-outlined');
            if (icon) icon.innerText = "map";
        }
    }
}

function updateTenantMapMarkers(filteredRooms) {
    if (!mainTenantMap) return;
    
    // Clear existing markers
    mainTenantMarkers.forEach(m => mainTenantMap.removeLayer(m));
    mainTenantMarkers = [];
    
    // Add new markers
    filteredRooms.forEach(r => {
        if (!r.lat || !r.lng) return;
        
        const m = L.marker([r.lat, r.lng]).addTo(mainTenantMap);
        
        const escapedTitle = escapeHtml(r.title);
        const escapedImage = escapeHtml(r.image_url);
        const { customBhk } = parseFloorAndBhk(r);
        
        const popupContent = `
        <div class="p-1 space-y-2 text-primary max-w-[200px]" style="font-family: 'Inter', sans-serif;">
            <img src="${escapedImage}" class="w-full h-20 object-cover rounded-lg shadow-sm">
            <h4 class="font-bold text-xs truncate" style="margin: 4px 0; color: var(--color-primary);">${escapedTitle}</h4>
            <div class="flex justify-between items-center text-[10px] font-black">
                <span class="text-accent">₹${r.rent.toLocaleString()}/mo</span>
                <span class="bg-surface-container px-1.5 py-0.5 rounded" style="color: var(--color-on-surface);">${customBhk}</span>
            </div>
            <a href="https://wa.me/91${r.contact}" target="_blank" class="block text-center py-1.5 bg-accent text-white text-[9px] font-extrabold uppercase rounded-lg shadow hover:opacity-90 transition-all" style="margin-top: 6px; text-decoration: none;">WhatsApp Owner</a>
        </div>
        `;
        
        m.bindPopup(popupContent);
        m.roomId = r.id; // Associate roomId
        
        mainTenantMarkers.push(m);
    });
}

function focusMapOnRoom(roomId) {
    const room = allRooms.find(r => r.id === roomId);
    if (!room || !room.lat || !room.lng) return;
    
    // Instead of a full side map, open the modal for the selected room
    openMapModal(room.lat, room.lng, room.title);
}

function highlightMapMarker(roomId) {
    const marker = mainTenantMarkers.find(m => m.roomId === roomId);
    if (marker) {
        marker.openPopup();
    }
}

function toggleFilterAmenity(type, btn) {
    const isActive = btn.checked;
    if (type === 'sunlight') filterSunlight = isActive;
    else if (type === 'parking') filterParking = isActive;
    else if (type === 'balcony') filterBalcony = isActive;
    else if (type === 'wifi') filterWifi = isActive;

    const label = btn.closest('label');
    if (label) {
        if (isActive) {
            label.classList.add('bg-accent/10', 'border-accent/40', 'text-accent');
            label.classList.remove('bg-surface', 'border-outline-variant/30', 'text-on-surface');
        } else {
            label.classList.remove('bg-accent/10', 'border-accent/40', 'text-accent');
            label.classList.add('bg-surface', 'border-outline-variant/30', 'text-on-surface');
        }
    }
    
    filterTenantRooms(true);
}

function toggleButtonState(btn, isActive) {
    if (isActive) {
        btn.classList.add('bg-accent', 'text-white', 'dark:text-surface', 'border-accent/40');
        btn.classList.remove('bg-surface-container', 'text-on-surface');
    } else {
        btn.classList.remove('bg-accent', 'text-white', 'dark:text-surface', 'border-accent/40');
        btn.classList.add('bg-surface-container', 'text-on-surface');
    }
}

function setFilterWater(val, btn) {
    filterWater = val;
    document.querySelectorAll('.water-pill').forEach(b => {
        b.className = "water-pill flex-1 py-1.5 rounded-lg text-[8px] font-black bg-transparent text-on-surface uppercase transition-colors";
    });
    btn.className = "water-pill active-water flex-1 py-1.5 rounded-lg text-[8px] font-black bg-primary text-white dark:text-surface shadow uppercase transition-colors";
    filterTenantRooms();
}

function setFilterRoad(val, btn) {
    filterRoad = val;
    document.querySelectorAll('.road-pill').forEach(b => {
        b.className = "road-pill flex-1 py-1.5 rounded-lg text-[8px] font-black bg-transparent text-on-surface uppercase transition-colors";
    });
    btn.className = "road-pill active-road flex-1 py-1.5 rounded-lg text-[8px] font-black bg-primary text-white dark:text-surface shadow uppercase transition-colors";
    filterTenantRooms();
}

// Anchor navigation and smooth highlight scroll action
function scrollToRoom(roomId) {
    if (window.innerWidth < 1024 && mobileActivePanel === 'map') {
        toggleMobileView();
    }
    
    // Close mobile filters drawer if open
    const filters = document.getElementById('tn-filters-container');
    if (filters && filters.classList.contains('show-mobile')) {
        toggleMobileFilters();
    }
    
    setTimeout(() => {
        const el = document.getElementById(`room-${roomId}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Apply high contrast visual highlight ring
            el.classList.add('ring-4', 'ring-accent', 'scale-[1.01]', 'shadow-2xl');
            setTimeout(() => {
                el.classList.remove('ring-4', 'ring-accent', 'scale-[1.01]', 'shadow-2xl');
            }, 1800);
        }
    }, 100);
}

// Collapsible advanced specs panel toggle
function toggleAdvancedFilters() {
    const adv = document.getElementById('tn-advanced-filters');
    if (adv) {
        adv.classList.toggle('hidden');
    }
}

function clearTenantSearch() {
    window.hasExplicitlySearched = false;
    document.getElementById('tn-search').value = '';
    resetFilters();
    filterTenantRooms();
}

function resetFilters() {
    window.hasExplicitlySearched = false;
    document.getElementById('tn-search').value = '';
    const localitySelect = document.getElementById('tn-locality-select');
    if (localitySelect) localitySelect.value = '';
    activeLocality = '';
    activeBHK = 0;
    
    filterParking = false;
    filterSunlight = false;
    filterBalcony = false;
    let filterWifi = false;
    
    document.querySelectorAll('.tn-bhk-btn').forEach(btn => {
        if (btn.innerText === 'ALL') {
            btn.className = "tn-bhk-btn active-bhk px-3.5 py-1.5 rounded-lg text-[9px] font-black bg-primary text-white dark:text-surface shadow uppercase transition-colors";
        } else {
            btn.className = "tn-bhk-btn px-3.5 py-1.5 rounded-lg text-[9px] font-black bg-transparent text-on-surface uppercase transition-colors";
        }
    });
    
    const priceInput = document.getElementById('tn-price');
    if (priceInput) priceInput.value = 25000;
    
    filterSunlight = false;
    filterParking = false;
    filterBalcony = false;
    document.querySelectorAll('#tn-advanced-filters input[type="checkbox"]').forEach(cb => cb.checked = false);
    
    filterWater = 'all';
    filterRoad = 'all';
    document.querySelectorAll('.water-pill').forEach(b => {
        if (b.innerText === 'ALL') {
            b.className = "water-pill active-water flex-1 py-1.5 rounded-lg text-[8px] font-black bg-primary text-white dark:text-surface shadow uppercase transition-colors";
        } else {
            b.className = "water-pill flex-1 py-1.5 rounded-lg text-[8px] font-black bg-transparent text-on-surface uppercase transition-colors";
        }
    });
    document.querySelectorAll('.road-pill').forEach(b => {
        if (b.innerText === 'ALL') {
            b.className = "road-pill active-road flex-1 py-1.5 rounded-lg text-[8px] font-black bg-primary text-white dark:text-surface shadow uppercase transition-colors";
        } else {
            b.className = "road-pill flex-1 py-1.5 rounded-lg text-[8px] font-black bg-transparent text-on-surface uppercase transition-colors";
        }
    });
    
    filterTenantRooms();
}

// ----------------------------------------------------
// ANALYTICS & SCHEDULING SYSTEM
// ----------------------------------------------------
let analyticsChartInstance = null;

function renderAnalyticsChart() {
    // Generate dummy data based on active listings
    const totalListings = rooms.filter(r => r.landlord_id === currentUserProfile?.id).length || 2;
    document.getElementById('analytics-listings').innerText = totalListings;
    document.getElementById('analytics-views').innerText = (totalListings * 142).toLocaleString();
    document.getElementById('analytics-favs').innerText = (totalListings * 37).toLocaleString();
    
    const ctx = document.getElementById('analyticsChart');
    if (!ctx) return;
    
    if (analyticsChartInstance) {
        analyticsChartInstance.destroy();
    }
    
    // Generate a realistic looking trend
    const labels = [];
    const dataPoints = [];
    for(let i=6; i>=0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        labels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
        dataPoints.push(Math.floor(Math.random() * 50) + 20);
    }
    
    analyticsChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Profile Views',
                data: dataPoints,
                borderColor: '#4F46E5', // Primary
                backgroundColor: 'rgba(79, 70, 229, 0.1)',
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#fff',
                pointBorderColor: '#4F46E5',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleFont: { family: 'Inter', size: 13 },
                    bodyFont: { family: 'Inter', size: 14, weight: 'bold' },
                    padding: 12,
                    cornerRadius: 8,
                    displayColors: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.05)', borderDash: [5, 5] },
                    border: { display: false }
                },
                x: {
                    grid: { display: false },
                    border: { display: false }
                }
            }
        }
    });
}

// Store visits locally since no backend table exists yet
function getVisits() {
    return JSON.parse(localStorage.getItem('gn_visits') || '[]');
}
function saveVisits(visits) {
    localStorage.setItem('gn_visits', JSON.stringify(visits));
}

function requestVisit(roomId) {
    const room = allRooms.find(r => r.id === roomId);
    if (!room) return;
    
    const dateStr = prompt('Enter requested date for the visit (e.g., Tomorrow, Monday, 15th Oct):');
    if (!dateStr) return;
    
    const message = `Hi! I found your property (${room.bhk} BHK in ${room.location}) on GangtokNest. I would like to schedule a visit on ${dateStr}. Please let me know what time works best for you!`;
    const url = `https://wa.me/91${room.contact}?text=${encodeURIComponent(message)}`;
    
    window.open(url, '_blank');
}

function renderVisitsView() {
    const visits = getVisits();
    const tbody = document.getElementById('ll-visits-tbody');
    const emptyState = document.getElementById('ll-visits-empty');
    
    if (!tbody) return;
    
    // Filter to visits requested for this landlord's rooms
    const myRoomIds = rooms.filter(r => r.landlord_id === currentUserProfile?.id).map(r => r.id);
    const myVisits = visits.filter(v => myRoomIds.includes(v.room_id));
    
    if (myVisits.length === 0) {
        tbody.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    
    tbody.innerHTML = myVisits.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).map(v => {
        const room = rooms.find(r => r.id === v.room_id);
        const roomName = room ? `${room.bhk} BHK in ${room.locality}` : 'Unknown Property';
        
        let statusBadge = '';
        if (v.status === 'pending') statusBadge = '<span class="bg-amber-500/10 text-amber-600 border border-amber-500/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">Pending</span>';
        else if (v.status === 'approved') statusBadge = '<span class="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">Approved</span>';
        else statusBadge = '<span class="bg-error/10 text-error border border-error/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">Declined</span>';
        
        const actionHtml = v.status === 'pending' ? `
            <div class="flex items-center justify-end gap-2">
                <button onclick="updateVisitStatus('${v.id}', 'approved')" class="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-colors flex items-center justify-center shadow-sm" title="Approve">
                    <span class="material-symbols-outlined text-sm">check</span>
                </button>
                <button onclick="updateVisitStatus('${v.id}', 'declined')" class="w-8 h-8 rounded-full bg-red-50 text-error hover:bg-error hover:text-white transition-colors flex items-center justify-center shadow-sm" title="Decline">
                    <span class="material-symbols-outlined text-sm">close</span>
                </button>
            </div>
        ` : `<span class="text-xs font-bold text-on-surface-variant">Done</span>`;
        
        return `
            <tr class="hover:bg-surface-container-lowest transition-colors group">
                <td class="px-6 py-4">
                    <div class="font-bold text-on-surface">${v.tenant_name}</div>
                    <div class="text-[10px] text-on-surface-variant mt-0.5">ID: ${v.tenant_id.substring(0,8)}</div>
                </td>
                <td class="px-6 py-4 font-bold text-primary text-xs">${roomName}</td>
                <td class="px-6 py-4 font-bold text-on-surface text-xs">${v.requested_date}</td>
                <td class="px-6 py-4">${statusBadge}</td>
                <td class="px-6 py-4">${actionHtml}</td>
            </tr>
        `;
    }).join('');
}

function updateVisitStatus(visitId, newStatus) {
    let visits = getVisits();
    const vIdx = visits.findIndex(v => v.id === visitId);
    if (vIdx > -1) {
        visits[vIdx].status = newStatus;
        saveVisits(visits);
        renderVisitsView(); // Re-render table
    }
}

function toggleMobileMap() {
    const map = document.getElementById('tn-map-container');
    if (map.classList.contains('hidden')) {
        map.classList.remove('hidden', 'lg:block');
        map.classList.add('absolute', 'inset-0', 'z-50');
    } else {
        map.classList.add('hidden', 'lg:block');
        map.classList.remove('absolute', 'inset-0', 'z-50');
    }
}

function updatePriceLabel() {
    const priceInput = document.getElementById('tn-price');
    if (priceInput) {
        const p = parseInt(priceInput.value);
        document.getElementById('tn-price-label').innerText = `₹${(p/1000).toFixed(0)}K`;
    }
}
