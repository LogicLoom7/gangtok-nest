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
    // Alias – delegates to the unified map toggle
    toggleMapView();
}

function toggleMapView() {
    const tenantContainer = document.getElementById('landing-tenant');
    const listingsPanel = document.getElementById('tn-listings-panel');
    const mapPanel = document.getElementById('tn-map-panel');
    const toggleBtn = document.getElementById('btn-mobile-toggle-view');
    const toggleText = document.getElementById('mobile-toggle-text');
    const mapViewBtn = document.querySelector('[onclick="toggleMobileMap()"]');
    
    if (!listingsPanel || !mapPanel) return;
    
    const mapIsVisible = !mapPanel.classList.contains('hidden');
    
    if (!mapIsVisible) {
        // Show map
        mobileActivePanel = 'map';
        
        // Make container row-layout for side-by-side on desktop
        if (tenantContainer) {
            tenantContainer.classList.remove('flex-col');
            tenantContainer.classList.add('flex-row', 'h-screen', 'overflow-hidden');
        }
        
        listingsPanel.classList.remove('w-full');
        listingsPanel.classList.add('flex-1', 'overflow-y-auto');
        
        mapPanel.classList.remove('hidden', 'mobile-panel-hidden');
        mapPanel.classList.add('mobile-panel-visible');
        
        if (toggleText) toggleText.innerText = 'Show List';
        if (toggleBtn) {
            const icon = toggleBtn.querySelector('.material-symbols-outlined');
            if (icon) icon.innerText = 'list';
        }
        
        // Initialize & resize map
        setTimeout(() => {
            initTenantMap();
            if (mainTenantMap) {
                mainTenantMap.invalidateSize();
                filterTenantRooms();
            }
        }, 200);
        
    } else {
        // Hide map - go back to full-width listing
        mobileActivePanel = 'listings';
        
        if (tenantContainer) {
            tenantContainer.classList.remove('flex-row', 'h-screen', 'overflow-hidden');
            tenantContainer.classList.add('flex-col');
        }
        
        listingsPanel.classList.remove('flex-1', 'overflow-y-auto');
        listingsPanel.classList.add('w-full');
        
        mapPanel.classList.add('hidden', 'mobile-panel-hidden');
        mapPanel.classList.remove('mobile-panel-visible');
        
        if (toggleText) toggleText.innerText = 'Show Map';
        if (toggleBtn) {
            const icon = toggleBtn.querySelector('.material-symbols-outlined');
            if (icon) icon.innerText = 'map';
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

