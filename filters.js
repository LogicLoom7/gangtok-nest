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
// Note: activeLocality declared in tenant.js; this is a no-op re-binding for backward compat
function handleLocalityChange(value) {
    if (typeof activeLocality !== 'undefined') activeLocality = value;
}

// Favorites toggle state action
async function toggleFavorite(roomId) {
    if (typeof currentUserProfile === 'undefined' || !currentUserProfile) {
        alert("Please log in to save properties.");
        return;
    }

    const idx = favorites.indexOf(roomId);
    if (idx === -1) {
        favorites.push(roomId);
        filterTenantRooms(); // Optimistic update
        
        try {
            const { error } = await supabaseClient.from('tenant_favorites').insert({
                tenant_id: currentUserProfile.id,
                room_id: roomId
            });
            if (error) {
                console.error('Supabase Error:', error);
                alert("Database Error: " + error.message + "\n\n(Note: If this is an RLS policy error, please make sure you disabled Row Level Security for the tenant_favorites table or added an INSERT policy in Supabase!)");
                
                // Revert optimistic update on failure
                const revertIdx = favorites.indexOf(roomId);
                if (revertIdx > -1) favorites.splice(revertIdx, 1);
                filterTenantRooms();
            }
        } catch (err) {
            console.error('Failed to save favorite:', err);
        }
    } else {
        favorites.splice(idx, 1);
        filterTenantRooms(); // Optimistic update
        
        try {
            const { error } = await supabaseClient.from('tenant_favorites')
                .delete()
                .match({
                    tenant_id: currentUserProfile.id,
                    room_id: roomId
                });
            if (error) {
                console.error('Supabase Error:', error);
                alert("Database Error: " + error.message);
                
                // Revert optimistic update on failure
                favorites.push(roomId);
                filterTenantRooms();
            }
        } catch (err) {
            console.error('Failed to remove favorite:', err);
        }
    }
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
    if (typeof setTenantTab === 'function') setTenantTab('explore');
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
    filterWifi = false;
    
    document.querySelectorAll('.tn-bhk-btn').forEach(btn => {
        if (btn.innerText === 'ALL') {
            btn.className = "tn-bhk-btn active-bhk px-3.5 py-1.5 rounded-lg text-[9px] font-black bg-primary text-white dark:text-surface shadow uppercase transition-colors";
        } else {
            btn.className = "tn-bhk-btn px-3.5 py-1.5 rounded-lg text-[9px] font-black bg-transparent text-on-surface uppercase transition-colors";
        }
    });
    
    const priceInput = document.getElementById('tn-price');
    if (priceInput) { priceInput.value = 50000; }
    const priceLabel = document.getElementById('tn-price-label');
    if (priceLabel) priceLabel.innerText = '₹50K';
    
    filterSunlight = false;
    filterParking = false;
    filterBalcony = false;
    filterWifi = false;
    
    // Reset all sidebar checkboxes (property type, BHK, suitable, amenities)
    const sidebarCheckboxIds = [
        'tn-filter-type-flat', 'tn-filter-type-hostel', 'tn-filter-type-house',
        'tn-filter-bhk-1rk', 'tn-filter-bhk-1', 'tn-filter-bhk-2', 'tn-filter-bhk-3', 'tn-filter-bhk-4', 'tn-filter-bhk-5',
        'tn-filter-suitable-students', 'tn-filter-suitable-professionals', 'tn-filter-suitable-govt',
        'tn-filter-suitable-family', 'tn-filter-suitable-bachelor-male', 'tn-filter-suitable-bachelor-female',
        'tn-filter-amenity-bathroom', 'tn-filter-amenity-kitchen', 'tn-filter-amenity-balcony',
        'tn-filter-amenity-terrace', 'tn-filter-amenity-furnished', 'tn-filter-amenity-wifi',
        'tn-filter-amenity-parking', 'tn-filter-amenity-water',
        'tn-chip-sunlight', 'tn-chip-parking', 'tn-chip-wifi', 'tn-chip-balcony',
        'tn-chip-bathroom', 'tn-chip-furnished', 'tn-chip-college', 'tn-chip-terrace', 'tn-chip-kitchen'
    ];
    sidebarCheckboxIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = false;
    });

    // Reset property type and BHK top selects
    const topType = document.getElementById('tn-property-type-select');
    if (topType) topType.value = '';
    const topBhk = document.getElementById('tn-bhk-select');
    if (topBhk) topBhk.value = '0';
    const sortSel = document.getElementById('tn-sort-select');
    if (sortSel) sortSel.value = 'relevant';
    
    // Reset sidebar locality
    const sideLocality = document.getElementById('tn-sidebar-locality-select');
    if (sideLocality) sideLocality.value = '';
    const topLocality = document.getElementById('tn-locality-select');
    if (topLocality) topLocality.value = '';
    activeLocality = '';

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
