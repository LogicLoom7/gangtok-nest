// LANDLORD PORTAL STATE & UTILITIES
// ==========================================
let landlordListings = [];
let editingListingId = null;
let editingListingOriginalImageUrl = '';
let currentPublishStep = 1;

// ==========================================
// LANDLORD ROUTING & INTERFACE HANDLERS
// ==========================================
// Page title mapping for mobile header
const LL_PAGE_TITLES = {
    dashboard:  { label: 'Overview',        icon: 'dashboard' },
    listings:   { label: 'Active Listings',  icon: 'list_alt' },
    rented:     { label: 'Rented Out',       icon: 'key' },
    publish:    { label: 'Publish Property', icon: 'add_circle' },
    analytics:  { label: 'Analytics',        icon: 'bar_chart' },
    visits:     { label: 'Visit Requests',   icon: 'event' },
    messages:   { label: 'Messages',         icon: 'chat' },
    profile:    { label: 'Profile',          icon: 'person' },
    settings:   { label: 'Settings',         icon: 'settings' },
};

function switchLandlordView(viewId, isEdit = false) {
    const sections = [
        'dashboard', 'listings', 'rented', 'publish',
        'profile', 'settings', 'analytics', 'visits', 'messages'
    ];

    // Remove active from all nav buttons
    document.querySelectorAll('.ll-nav-btn').forEach(btn => btn.classList.remove('active'));

    // Hide all sections
    sections.forEach(s => {
        const secEl = document.getElementById(`ll-section-${s}`);
        if (secEl) secEl.classList.add('hidden');
    });

    // Show target section
    const activeSec = document.getElementById(`ll-section-${viewId}`);
    if (activeSec) activeSec.classList.remove('hidden');

    // Mark active nav button
    const activeBtn = document.getElementById(`ll-nav-top-${viewId}`);
    if (activeBtn) activeBtn.classList.add('active');

    // Update mobile top bar
    const pageInfo = LL_PAGE_TITLES[viewId] || { label: viewId, icon: 'home' };
    const titleEl = document.getElementById('ll-page-title');
    const iconEl  = document.getElementById('ll-mobile-icon');
    if (titleEl) titleEl.innerText = pageInfo.label;
    if (iconEl)  iconEl.innerText  = pageInfo.icon;

    // Close mobile sidebar if open
    closeLandlordSidebar();

    // Section-specific side effects
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
        const aViews = document.getElementById('analytics-views');
        const aFavs  = document.getElementById('analytics-favs');
        const aList  = document.getElementById('analytics-listings');
        if (aViews) aViews.innerText = landlordListings.reduce((s,r) => s + parseInt(localStorage.getItem('gn_views_' + r.id)||0),0);
        if (aFavs)  aFavs.innerText  = Math.round(landlordListings.length * 1.8);
        if (aList)  aList.innerText  = landlordListings.filter(r => !r.is_rented).length;
    } else if (viewId === 'visits') {
        renderVisitsView();
    }
}

function openLandlordSidebar() {
    const sidebar  = document.getElementById('ll-sidebar');
    const backdrop = document.getElementById('ll-sidebar-backdrop');
    if (!sidebar) return;
    sidebar.classList.remove('-translate-x-full');
    if (backdrop) {
        backdrop.classList.remove('hidden');
        requestAnimationFrame(() => backdrop.classList.replace('opacity-0','opacity-100'));
    }
}

function closeLandlordSidebar() {
    const sidebar  = document.getElementById('ll-sidebar');
    const backdrop = document.getElementById('ll-sidebar-backdrop');
    if (!sidebar) return;
    // Only close if we're on mobile (sidebar should not be closed on desktop)
    if (window.innerWidth >= 1024) return;
    sidebar.classList.add('-translate-x-full');
    if (backdrop) {
        backdrop.classList.replace('opacity-100','opacity-0');
        setTimeout(() => backdrop.classList.add('hidden'), 300);
    }
}

// Legacy alias — kept for compatibility
function toggleLandlordSidebar() { openLandlordSidebar(); }

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

    // Update step dots
    for (let i = 1; i <= 3; i++) {
        const dot = document.getElementById(`step-dot-${i}`);
        if (dot) {
            dot.className = 'step-dot';
            if (i < currentPublishStep) {
                dot.classList.add('completed');
                dot.innerHTML = '<span class="material-symbols-outlined text-sm" style="font-variation-settings:\'FILL\' 1">check</span>';
            } else if (i === currentPublishStep) {
                dot.classList.add('active');
                dot.innerHTML = i;
            } else {
                dot.innerHTML = i;
            }
        }
        // Update connector lines (exist between steps)
        if (i < 3) {
            const line = document.getElementById(`step-line-${i}`);
            if (line) {
                if (i < currentPublishStep) {
                    line.classList.add('completed');
                } else {
                    line.classList.remove('completed');
                }
            }
        }
    }

    const prevBtn   = document.getElementById('ll-btn-prev');
    const nextBtn   = document.getElementById('ll-btn-next');
    const submitBtn = document.getElementById('ll-btn-submit');

    if (currentPublishStep === 1) {
        if (prevBtn)   { prevBtn.classList.add('hidden');    prevBtn.classList.remove('flex'); }
        if (nextBtn)   { nextBtn.classList.remove('hidden'); nextBtn.classList.add('flex'); }
        if (submitBtn) { submitBtn.classList.add('hidden');  submitBtn.classList.remove('flex'); }
        
        // Initialize Map when step 1 is shown
        setTimeout(() => {
            if (typeof initLandlordMap === 'function') initLandlordMap();
        }, 50);
        
    } else if (currentPublishStep === 2) {
        if (prevBtn)   { prevBtn.classList.remove('hidden'); prevBtn.classList.add('flex'); }
        if (nextBtn)   { nextBtn.classList.remove('hidden'); nextBtn.classList.add('flex'); }
        if (submitBtn) { submitBtn.classList.add('hidden');  submitBtn.classList.remove('flex'); }
    } else if (currentPublishStep === 3) {
        if (prevBtn)   { prevBtn.classList.remove('hidden'); prevBtn.classList.add('flex'); }
        if (nextBtn)   { nextBtn.classList.add('hidden');    nextBtn.classList.remove('flex'); }
        if (submitBtn) { submitBtn.classList.remove('hidden'); submitBtn.classList.add('flex'); }
    }
}

function nextStep() {
    if (currentPublishStep === 1) {
        const title   = document.getElementById('ll-title').value.trim();
        const mainArea = document.getElementById('ll-main-area-select').value;
        const loc     = document.getElementById('ll-loc').value.trim();
        if (!title || !mainArea || !loc) {
            llToast('error', 'Please fill out Title, Main Area, and Exact Address before proceeding.');
            return;
        }
        currentPublishStep = 2;
    } else if (currentPublishStep === 2) {
        const bhk   = document.getElementById('ll-bhk').value.trim();
        const rent  = document.getElementById('ll-rent').value.trim();
        const floor = document.getElementById('ll-floor').value;
        const phone = document.getElementById('ll-phone').value.trim();
        if (!bhk || !rent || !floor || !phone) {
            llToast('error', 'Please fill out BHK Type, Rent, Floor, and WhatsApp Number.');
            return;
        }
        currentPublishStep = 3;
    }
    updateFormSteps();
    // Scroll form into view
    document.getElementById('ll-section-publish')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    const form = document.getElementById('landlordForm');
    if (form) form.reset();
    clearSelectedImage();
    currentLat = null;
    currentLng = null;

    const locText = document.getElementById('loc-text');
    if (locText) locText.innerText = 'Capture GPS Location Coordinates';
    const locBtn = document.getElementById('btn-detect-loc');
    if (locBtn) {
        locBtn.classList.remove('bg-emerald-500/10', 'text-emerald-500', 'border-emerald-500/30', 'hover:border-primary/30');
        locBtn.classList.add('bg-surface-container', 'text-on-surface');
    }

    // Reset new fields
    ['ll-category', 'll-deposit', 'll-bathroom', 'll-kitchen', 'll-balcony-count', 'll-terrace'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = el.options ? el.options[0]?.value || '' : '';
    });
    ['ll-suitable-students','ll-suitable-professionals','ll-suitable-govt','ll-suitable-family',
     'll-suitable-bachelor-male','ll-suitable-bachelor-female','ll-suitable-anyone'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = false;
    });
    ['ll-furnished','ll-wifi','ll-power-backup','ll-lift','ll-cctv','ll-gated',
     'll-study-table','ll-wardrobe','ll-laundry','ll-mess',
     'll-near-college','ll-near-market','ll-near-hospital','ll-near-bus'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = false;
    });
    const descEl = document.getElementById('ll-description');
    if (descEl) descEl.value = '';
    const descCounter = document.getElementById('ll-desc-counter');
    if (descCounter) descCounter.innerText = '0 / 500';

    document.getElementById('ll-publish-headline').innerText = 'Publish Property';
    document.getElementById('ll-publish-subheadline').innerText = 'Enter accurate details to list your room instantly.';
    const submitBtn = document.getElementById('ll-btn-submit');
    if (submitBtn) submitBtn.innerText = 'Publish Listing';

    currentPublishStep = 1;
    updateFormSteps();
}



// ==========================================
// HELPER: Description character counter
// ==========================================
function updateDescCounter(el) {
    const counter = document.getElementById('ll-desc-counter');
    if (counter) counter.innerText = `${el.value.length} / 500`;
    if (el.value.length > 500) el.value = el.value.slice(0, 500);
}

// ==========================================
// HELPER: Toast Notifications
// ==========================================
function llToast(type, message) {
    const container = document.getElementById('ll-toast-container');
    if (!container) { alert(message); return; }

    const icons = { success: 'check_circle', error: 'error', info: 'info', warning: 'warning' };
    const colors = { success: 'text-success', error: 'text-error', info: 'text-primary', warning: 'text-warning' };

    const toast = document.createElement('div');
    toast.className = 'll-toast';
    toast.innerHTML = `
        <span class="material-symbols-outlined ${colors[type] || 'text-primary'} text-xl flex-shrink-0" style="font-variation-settings:'FILL' 1">${icons[type] || 'info'}</span>
        <span class="flex-grow text-xs">${message}</span>
        <button onclick="this.parentElement.remove()" class="flex-shrink-0 text-on-surface-variant/60 hover:text-on-surface transition-colors">
            <span class="material-symbols-outlined text-base">close</span>
        </button>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 320);
    }, 4000);
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
        let badgeClass = 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
        let dotColor   = 'bg-emerald-500';
        if (isRented) {
            statusText = 'Rented';  badgeClass = 'bg-secondary/10 text-secondary border-secondary/20'; dotColor = 'bg-secondary';
        } else if (isPaused) {
            statusText = 'Paused';  badgeClass = 'bg-warning/10 text-warning border-warning/20';   dotColor = 'bg-warning';
        }

        const { customBhk, floorLevel, buildingType } = parseFloorAndBhk(r);
        const escapedTitle    = escapeHtml(r.title);
        const escapedLocation = escapeHtml(r.location);
        const escapedFloor    = escapeHtml(floorLevel);
        const escapedRoad     = escapeHtml(r.road_dist);
        const escapedImage    = escapeHtml(r.image_url);
        const safeTitleForClick = String(r.title || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const views           = parseInt(localStorage.getItem('gn_views_' + r.id) || 0);

        // Load extras from localStorage
        const extras = JSON.parse(localStorage.getItem('gn_extras_' + r.id) || '{}');
        const deposit = extras.deposit ? `₹${parseInt(extras.deposit).toLocaleString()} deposit` : '';

        return `
        <div class="ll-listing-card group">

            <!-- Image Header -->
            <div class="relative h-40 bg-surface-container overflow-hidden">
                ${escapedImage
                    ? `<img src="${escapedImage}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\'w-full h-full flex items-center justify-center bg-primary/5\'><span class=\'material-symbols-outlined text-primary/20 text-5xl\'>apartment</span></div>'">`
                    : `<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5"><span class="material-symbols-outlined text-primary/20 text-5xl">apartment</span></div>`
                }
                <!-- Status badge overlay -->
                <div class="absolute top-3 left-3">
                    <span class="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border ${badgeClass} bg-surface-lowest/90 backdrop-blur-sm">
                        <span class="w-1.5 h-1.5 rounded-full ${dotColor} flex-shrink-0"></span>${statusText}
                    </span>
                </div>
                <!-- Views badge -->
                <div class="absolute top-3 right-3">
                    <span class="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold bg-black/40 text-white backdrop-blur-sm">
                        <span class="material-symbols-outlined text-[10px]">visibility</span>${views}
                    </span>
                </div>
                <!-- Action menu trigger -->
                <div class="absolute bottom-3 right-3">
                    <div class="relative">
                        <button onclick="toggleActionMenu('${r.id}', event)" class="p-1.5 rounded-lg bg-black/40 hover:bg-black/60 text-white backdrop-blur-sm transition-colors">
                            <span class="material-symbols-outlined text-sm">more_vert</span>
                        </button>
                        <div id="action-menu-${r.id}" class="hidden absolute right-0 bottom-9 bg-surface-lowest border border-outline-variant/20 rounded-xl shadow-2xl py-1.5 w-40 z-20">
                            <button onclick="editListing('${r.id}'); event.stopPropagation();" class="w-full text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-on-surface hover:bg-primary/5 hover:text-primary transition-colors flex items-center gap-2">
                                <span class="material-symbols-outlined text-xs">edit</span> Edit Listing
                            </button>
                            ${!isRented ? `
                            <button onclick="openRentedModal('${r.id}'); event.stopPropagation();" class="w-full text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-on-surface hover:bg-success/5 hover:text-success transition-colors flex items-center gap-2">
                                <span class="material-symbols-outlined text-xs">check_circle</span> Mark Rented
                            </button>` : `
                            <button onclick="markListingActive('${r.id}'); event.stopPropagation();" class="w-full text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-on-surface hover:bg-primary/5 hover:text-primary transition-colors flex items-center gap-2">
                                <span class="material-symbols-outlined text-xs">refresh</span> Make Active
                            </button>`}
                            <button onclick="togglePauseListing('${r.id}'); event.stopPropagation();" class="w-full text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-on-surface hover:bg-warning/5 hover:text-warning transition-colors flex items-center gap-2">
                                <span class="material-symbols-outlined text-xs">${isPaused ? 'play_arrow' : 'pause'}</span> ${isPaused ? 'Resume' : 'Pause'}
                            </button>
                            <button onclick="openMapModal(${r.lat}, ${r.lng}, '${safeTitleForClick}'); event.stopPropagation();" class="w-full text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-on-surface hover:bg-accent/5 hover:text-accent transition-colors flex items-center gap-2">
                                <span class="material-symbols-outlined text-xs">map</span> View Map
                            </button>
                            <div class="h-px bg-outline-variant/15 my-1"></div>
                            <button onclick="deleteListing('${r.id}'); event.stopPropagation();" class="w-full text-left px-3 py-2 text-[10px] font-black uppercase tracking-wider text-error hover:bg-error/5 transition-colors flex items-center gap-2">
                                <span class="material-symbols-outlined text-xs">delete</span> Delete
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Card Body -->
            <div class="p-4 flex-grow flex flex-col">
                <h4 class="font-headline font-black text-sm text-primary truncate mb-1" title="${escapedTitle}">${escapedTitle}</h4>
                <p class="text-[10px] text-on-surface-variant font-bold truncate flex items-center gap-1 mb-3">
                    <span class="material-symbols-outlined text-[11px]">location_on</span>${escapedLocation}
                </p>

                <div class="flex items-center gap-2 mb-3 flex-wrap">
                    <span class="bg-primary/8 text-primary text-[9px] font-black px-2 py-1 rounded-lg border border-primary/15">${customBhk}</span>
                    <span class="bg-success/8 text-success text-[9px] font-black px-2 py-1 rounded-lg border border-success/15">₹${r.rent.toLocaleString()}/mo</span>
                    ${deposit ? `<span class="bg-surface-container text-on-surface-variant text-[9px] font-bold px-2 py-1 rounded-lg">${deposit}</span>` : ''}
                </div>

                <div class="mt-auto pt-3 border-t border-outline-variant/15 grid grid-cols-3 gap-1 text-[8px] font-bold uppercase text-on-surface-variant">
                    <div class="flex items-center gap-0.5 truncate">
                        <span class="material-symbols-outlined text-[11px] text-primary/60 flex-shrink-0">stairs</span>
                        <span class="truncate">${escapedFloor}</span>
                    </div>
                    <div class="flex items-center gap-0.5 truncate">
                        <span class="material-symbols-outlined text-[11px] text-primary/60 flex-shrink-0">add_road</span>
                        <span class="truncate">${escapedRoad}</span>
                    </div>
                    <div class="flex items-center gap-0.5 truncate">
                        <span class="material-symbols-outlined text-[11px] text-primary/60 flex-shrink-0">home</span>
                        <span class="truncate">${escapeHtml(buildingType)}</span>
                    </div>
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

let landlordMap = null;
let landlordMarker = null;

function updateLandlordCoordinates(lat, lng) {
    currentLat = lat;
    currentLng = lng;
    document.getElementById('ll-lat').value = lat.toFixed(6);
    document.getElementById('ll-lng').value = lng.toFixed(6);
}

function initLandlordMap() {
    if (landlordMap) {
        landlordMap.invalidateSize();
        // If editing an existing listing, center on existing coordinates
        if (currentLat && currentLng) {
            landlordMap.setView([currentLat, currentLng], 15);
            landlordMarker.setLatLng([currentLat, currentLng]);
            updateLandlordCoordinates(currentLat, currentLng);
        }
        return;
    }
    
    // Default Gangtok coordinates
    let startLat = 27.3314;
    let startLng = 88.6138;
    
    if (currentLat && currentLng) {
        startLat = currentLat;
        startLng = currentLng;
    }

    landlordMap = L.map('ll-map').setView([startLat, startLng], 14);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(landlordMap);
    
    landlordMarker = L.marker([startLat, startLng], { draggable: true }).addTo(landlordMap);
    
    if (currentLat && currentLng) {
        updateLandlordCoordinates(startLat, startLng);
    }
    
    landlordMarker.on('dragend', function (e) {
        const position = landlordMarker.getLatLng();
        updateLandlordCoordinates(position.lat, position.lng);
    });
    
    landlordMap.on('click', function(e) {
        landlordMarker.setLatLng(e.latlng);
        updateLandlordCoordinates(e.latlng.lat, e.latlng.lng);
    });

    setTimeout(() => {
        landlordMap.invalidateSize();
    }, 200);
}

async function searchLocationOnMap() {
    const query = document.getElementById('ll-map-search').value.trim();
    if (!query) return;
    
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', Gangtok, Sikkim')}`);
        const data = await response.json();
        
        if (data && data.length > 0) {
            const lat = parseFloat(data[0].lat);
            const lng = parseFloat(data[0].lon);
            
            if (landlordMap && landlordMarker) {
                landlordMap.setView([lat, lng], 16);
                landlordMarker.setLatLng([lat, lng]);
                updateLandlordCoordinates(lat, lng);
            }
        } else {
            alert("Location not found. Try a different search term or drag the marker manually.");
        }
    } catch (e) {
        console.error("Geocoding failed", e);
        alert("Failed to search location. Please try again.");
    }
}

function detectLocation() {
    const btnText = document.getElementById('loc-text');
    const btn = document.getElementById('btn-detect-loc');
    
    btnText.innerText = "Detecting GPS...";
    
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                
                if (landlordMap && landlordMarker) {
                    landlordMap.setView([lat, lng], 16);
                    landlordMarker.setLatLng([lat, lng]);
                    updateLandlordCoordinates(lat, lng);
                } else {
                    currentLat = lat;
                    currentLng = lng;
                }
                
                btnText.innerText = "GPS Applied ✓";
                btn.classList.add('bg-emerald-500/10', 'text-emerald-500', 'border-emerald-500/30');
                btn.classList.remove('bg-surface', 'text-on-surface');
            },
            (error) => {
                alert("Could not get location. Please allow location permissions in your browser.");
                btnText.innerText = "Use My GPS";
            }
        );
    } else {
        alert("Geolocation is not supported by your browser.");
        btnText.innerText = "Use My GPS";
    }
}

function editListing(id) {
    const listing = landlordListings.find(r => r.id === id);
    if (!listing) return;

    editingListingId = listing.id;
    editingListingOriginalImageUrl = listing.image_url;

    document.getElementById('ll-title').value = listing.title;

    const { mainArea, exactLocation, landmark } = parseLocationFields(listing.location);
    document.getElementById('ll-main-area-select').value = mainArea;
    document.getElementById('ll-loc').value = exactLocation;
    document.getElementById('ll-landmark').value = landmark || '';

    const { customBhk, floorLevel, buildingType } = parseFloorAndBhk(listing);
    document.getElementById('ll-bhk').value = customBhk;

    // Floor is now a select — try to match, fall back to text
    const floorSel = document.getElementById('ll-floor');
    if (floorSel) {
        const opt = Array.from(floorSel.options).find(o => o.value === floorLevel);
        floorSel.value = opt ? floorLevel : '';
    }
    document.getElementById('ll-rent').value = listing.rent;
    document.getElementById('ll-phone').value = listing.contact;
    document.getElementById('ll-water').value = listing.water || '24/7';
    document.getElementById('ll-road').value = listing.road_dist || 'Roadside (0 min)';
    document.getElementById('ll-sun').checked  = !!listing.sunlight;
    document.getElementById('ll-park').checked = !!listing.parking;
    document.getElementById('ll-balc').checked = !!listing.balcony;

    // amenities is a text[] column — read the first element
    const amenitiesVal = Array.isArray(listing.amenities) ? listing.amenities[0] : (listing.amenities || '');
    document.getElementById('ll-about-landlord').value = amenitiesVal;

    // Load localStorage extras
    const extras = JSON.parse(localStorage.getItem('gn_extras_' + id) || '{}');
    if (extras.category)   { const el = document.getElementById('ll-category');       if (el) el.value = extras.category; }
    if (extras.deposit)    { const el = document.getElementById('ll-deposit');        if (el) el.value = extras.deposit; }
    if (extras.bathroom)   { const el = document.getElementById('ll-bathroom');       if (el) el.value = extras.bathroom; }
    if (extras.kitchen)    { const el = document.getElementById('ll-kitchen');        if (el) el.value = extras.kitchen; }
    if (extras.balconyCount) { const el = document.getElementById('ll-balcony-count'); if (el) el.value = extras.balconyCount; }
    if (extras.terrace)    { const el = document.getElementById('ll-terrace');        if (el) el.value = extras.terrace; }
    if (extras.description) { const el = document.getElementById('ll-description');  if (el) { el.value = extras.description; updateDescCounter(el); } }
    // suitable-for checkboxes
    const suitableIds = ['students','professionals','govt','family','bachelor-male','bachelor-female','anyone'];
    (extras.suitableFor || []).forEach(val => {
        const el = document.getElementById(`ll-suitable-${val}`);
        if (el) el.checked = true;
    });
    // extra amenity checkboxes
    const extraAmenities = extras.extraAmenities || [];
    ['ll-furnished','ll-wifi','ll-power-backup','ll-lift','ll-cctv','ll-gated',
     'll-study-table','ll-wardrobe','ll-laundry','ll-mess',
     'll-near-college','ll-near-market','ll-near-hospital','ll-near-bus'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = extraAmenities.includes(id);
    });

    if (listing.image_url) {
        const imgPreview = document.getElementById('ll-image-preview');
        const container  = document.getElementById('ll-image-preview-container');
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
        if (locText) locText.innerText = "GPS Applied ✓";
        if (locBtn) {
            locBtn.classList.add('bg-emerald-500/10', 'text-emerald-500', 'border-emerald-500/30');
            locBtn.classList.remove('bg-surface', 'text-on-surface');
        }
    } else {
        if (locText) locText.innerText = "Use My GPS";
        if (locBtn) {
            locBtn.classList.remove('bg-emerald-500/10', 'text-emerald-500', 'border-emerald-500/30');
            locBtn.classList.add('bg-surface', 'text-on-surface');
        }
    }
    
    // Update map if it is already initialized, otherwise wait for step 1
    if (typeof initLandlordMap === 'function') {
        setTimeout(() => { initLandlordMap(); }, 100);
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
    
    const landmark = document.getElementById('ll-landmark').value.trim();
    const categoryValue = document.getElementById('ll-category').value;
    const aboutLandlord = document.getElementById('ll-about-landlord').value.trim();

    const combinedLocation = landmark 
        ? `${mainArea} - ${exactLoc} (Landmark: ${landmark})`
        : `${mainArea} - ${exactLoc}`;
    const bhkInt = parseInt(bhkInput.match(/\d+/)?.[0]) || 1;
    const floorLevelEncoded = `${bhkInput} | ${floorInput} | ${categoryValue}`;
    
    let lat = currentLat;
    let lng = currentLng;
    
    if (!lat || !lng) {
        alert("Please select the exact property location on the map.");
        btn.innerText = original;
        return;
    }
    
    btn.innerText = "Syncing Cloud...";
    
    try {
        const file = document.getElementById('ll-photo').files[0];
        let url = editingListingOriginalImageUrl;
        
        if (file) {
            const path = `${Date.now()}_${file.name}`;
            const { data: uploadData, error: uploadError } = await supabaseClient.storage
                .from('room-photos')
                .upload(path, file, { upsert: true });
            if (uploadError) {
                throw new Error(`Photo upload failed: ${uploadError.message}`);
            }
            url = supabaseClient.storage.from('room-photos').getPublicUrl(path).data.publicUrl;
            if (!url) throw new Error('Could not get public URL for uploaded photo.');
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
            amenities: aboutLandlord ? [aboutLandlord] : [],  // text[] column in DB
            image_url: url,
            user_id: user.id,
            lat: lat,
            lng: lng
        };
        
        let insertResult = null;
        if (editingListingId) {
            const { error } = await supabaseClient.from('listings').update(payload).eq('id', editingListingId);
            if (error) throw error;
            llToast('success', 'Listing updated successfully! ✅');
        } else {
            insertResult = await supabaseClient.from('listings').insert([payload]).select();
            if (insertResult.error) throw insertResult.error;
            llToast('success', 'Property published successfully! 🎉');
        }

        // Save extras to localStorage keyed by listing ID
        const savedId = editingListingId || (insertResult?.data?.[0]?.id);
        if (savedId) {
            const extraData = {
                category:      (document.getElementById('ll-category')?.value || ''),
                deposit:       (document.getElementById('ll-deposit')?.value || ''),
                bathroom:      (document.getElementById('ll-bathroom')?.value || ''),
                kitchen:       (document.getElementById('ll-kitchen')?.value || ''),
                balconyCount:  (document.getElementById('ll-balcony-count')?.value || ''),
                terrace:       (document.getElementById('ll-terrace')?.value || ''),
                description:   (document.getElementById('ll-description')?.value || ''),
                suitableFor: ['students','professionals','govt','family','bachelor-male','bachelor-female','anyone']
                    .filter(v => document.getElementById(`ll-suitable-${v}`)?.checked),
                extraAmenities: ['ll-furnished','ll-wifi','ll-power-backup','ll-lift','ll-cctv','ll-gated',
                    'll-study-table','ll-wardrobe','ll-laundry','ll-mess',
                    'll-near-college','ll-near-market','ll-near-hospital','ll-near-bus']
                    .filter(id => document.getElementById(id)?.checked),
            };
            localStorage.setItem('gn_extras_' + savedId, JSON.stringify(extraData));
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

