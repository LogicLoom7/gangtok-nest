// TENANT DISCOVERY & MATCHING ENGINE
// ==========================================
// allRooms and activeBHK are declared in supabase.js as global state
let activeLocality = '';


async function fetchTenantData() {
    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/listings?select=*&order=created_at.desc`, {
            headers: {
                'apikey': supabaseKey,
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) throw new Error("Failed to fetch listings");
        const data = await response.json();
        allRooms = data || [];
        
        // Initialize the Leaflet map dynamically
        setTimeout(() => {
            initTenantMap();
            filterTenantRooms();
            renderLandingFeaturedRooms();
        }, 100);
    } catch (e) {
        console.error(e);
        allRooms = [];
        filterTenantRooms();
        renderLandingFeaturedRooms();
    }
}

function setTenantBHK(b, btn) {
    activeBHK = b;
    document.querySelectorAll('.tn-bhk-btn').forEach(x => {
        x.className = "tn-bhk-btn px-3.5 py-1.5 rounded-lg text-[9px] font-black bg-transparent text-on-surface uppercase transition-colors";
    });
    if (btn) {
        btn.className = "tn-bhk-btn active-bhk px-3.5 py-1.5 rounded-lg text-[9px] font-black bg-primary text-white dark:text-surface shadow uppercase transition-colors";
    }
    filterTenantRooms();
}

function syncLocalitySelect(val) {
    const topSel = document.getElementById('tn-locality-select');
    const sideSel = document.getElementById('tn-sidebar-locality-select');
    if (topSel) topSel.value = val;
    if (sideSel) sideSel.value = val;
    activeLocality = val;
    filterTenantRooms();
}

function handleLocalityChange(value) {
    activeLocality = value;
    const sideSel = document.getElementById('tn-sidebar-locality-select');
    if (sideSel) sideSel.value = value;
    filterTenantRooms();
}

// Haversine distance calculator helper
function calculateDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 6371; // radius of Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Share property copy-text logic
function shareRoom(roomId) {
    const room = allRooms.find(r => r.id === roomId);
    if (!room) return;

    const bhkText = room.bhk === 4 ? 'Homestay / 4+ BHK' : `${room.bhk} BHK`;
    const features = [];
    if(room.parking) features.push('Parking');
    if(room.balcony) features.push('a Balcony');
    if(room.sunlight) features.push('great Sunlight');
    
    const featureString = features.length > 0 ? ` with ${features.join(', ')}` : '';
    const shareText = `Hey! Found this ${bhkText} in ${room.location} for ₹${room.rent}/mo${featureString} on GangtokNest.\n\nCheck it out here: ${window.location.origin}`;

    if (navigator.share) {
        navigator.share({
            title: 'GangtokNest Property',
            text: shareText
        }).catch(err => console.log('Share dismissed', err));
    } else {
        navigator.clipboard.writeText(shareText).then(() => {
            llToast('success', 'Property link copied to clipboard! Share it with friends.');
        });
    }
}

function executeCentralSearch() {
    // Reveal grid and scroll to it
    const resultsContainer = document.getElementById('tn-results-container');
    if (resultsContainer) {
        resultsContainer.classList.remove('hidden');
        resultsContainer.scrollIntoView({ behavior: 'smooth' });
    }
    
    // Execute search filter
    filterTenantRooms(true);
}

// ADVANCED SEARCH FILTER ENGINE
// ==========================================
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
            const bhkMatch = s.match(/\b([1-4])\s*(?:bhk|b|bed|bedroom|bedrooms)\b/i);
            if (bhkMatch) searchBHK = parseInt(bhkMatch[1]);
            
            const priceKMatch = s.match(/\b(\d+)\s*k\b/i);
            if (priceKMatch) {
                searchRentLimit = parseInt(priceKMatch[1]) * 1000;
            } else {
                const priceNumMatch = s.match(/\b(\d{4,6})\b/);
                if (priceNumMatch) searchRentLimit = parseInt(priceNumMatch[1]);
            }
            
            if (/\b(parking|park|car)\b/i.test(s)) searchParking = true;
            if (/\b(sunlight|sun|sunny)\b/i.test(s)) searchSunlight = true;
            if (/\b(balcony|terrace)\b/i.test(s)) searchBalcony = true;
            
            const allTokens = s.split(/\s+/).filter(t => t.length > 0);
            for (let i = 0; i < allTokens.length; i++) {
                const token = allTokens[i];
                if (/^\d{4,6}$/.test(token) || /^\d+k$/i.test(token)) continue;
                if (/^\d(?:bhk|b)$/i.test(token) || /^(bhk|b|bed|bedroom|bedrooms)$/i.test(token)) continue;
                if (/^[1-4]$/.test(token) && i + 1 < allTokens.length && /^(bhk|b|bed|bedroom|bedrooms)$/i.test(allTokens[i+1])) continue;
                if (/^(bhk|b|bed|bedroom|bedrooms)$/i.test(token) && i - 1 >= 0 && /^[1-4]$/.test(allTokens[i-1])) continue;
                if (/^(parking|park|car|sunlight|sun|sunny|balcony|terrace)$/i.test(token)) continue;
                keywordTokens.push(token);
            }
        }

        // Get Property Type selects and sidebar checkboxes
        const topType = document.getElementById('tn-property-type-select')?.value;
        const typeFlat = document.getElementById('tn-filter-type-flat')?.checked;
        const typeHostel = document.getElementById('tn-filter-type-hostel')?.checked;
        const typeHouse = document.getElementById('tn-filter-type-house')?.checked;
        const hasTypeFilter = typeFlat || typeHostel || typeHouse;

        // Get BHK checkboxes
        const bhk1rk = document.getElementById('tn-filter-bhk-1rk')?.checked;
        const bhk1 = document.getElementById('tn-filter-bhk-1')?.checked;
        const bhk2 = document.getElementById('tn-filter-bhk-2')?.checked;
        const bhk3 = document.getElementById('tn-filter-bhk-3')?.checked;
        const bhk4 = document.getElementById('tn-filter-bhk-4')?.checked;
        const bhk5 = document.getElementById('tn-filter-bhk-5')?.checked;
        const hasBhkFilter = bhk1rk || bhk1 || bhk2 || bhk3 || bhk4 || bhk5;
        const topBhk = document.getElementById('tn-bhk-select')?.value || '0';

        // Get Suitable For checkboxes
        const suitStudents = document.getElementById('tn-filter-suitable-students')?.checked;
        const suitProfessionals = document.getElementById('tn-filter-suitable-professionals')?.checked;
        const suitGovt = document.getElementById('tn-filter-suitable-govt')?.checked;
        const suitFamily = document.getElementById('tn-filter-suitable-family')?.checked;
        const suitBachelorMale = document.getElementById('tn-filter-suitable-bachelor-male')?.checked;
        const suitBachelorFemale = document.getElementById('tn-filter-suitable-bachelor-female')?.checked;
        const suitAnyone = document.getElementById('tn-filter-suitable-anyone')?.checked;
        const hasSuitableFilter = suitStudents || suitProfessionals || suitGovt || suitFamily || suitBachelorMale || suitBachelorFemale || suitAnyone;

        // Get Amenity checkboxes & chips
        const filterAmenityBathroom = document.getElementById('tn-filter-amenity-bathroom')?.checked || document.getElementById('tn-chip-bathroom')?.checked;
        const filterAmenityKitchen = document.getElementById('tn-filter-amenity-kitchen')?.checked || document.getElementById('tn-chip-kitchen')?.checked;
        const filterAmenityBalcony = document.getElementById('tn-filter-amenity-balcony')?.checked || document.getElementById('tn-chip-balcony')?.checked;
        const filterAmenityTerrace = document.getElementById('tn-filter-amenity-terrace')?.checked || document.getElementById('tn-chip-terrace')?.checked;
        const filterAmenityFurnished = document.getElementById('tn-filter-amenity-furnished')?.checked || document.getElementById('tn-chip-furnished')?.checked;
        const filterAmenityWifi = document.getElementById('tn-filter-amenity-wifi')?.checked || document.getElementById('tn-chip-wifi')?.checked;
        const filterAmenityParking = document.getElementById('tn-filter-amenity-parking')?.checked || document.getElementById('tn-chip-parking')?.checked;
        const filterAmenityWater = document.getElementById('tn-filter-amenity-water')?.checked;
        const filterAmenityPower = document.getElementById('tn-filter-amenity-power')?.checked;
        const filterAmenityCctv = document.getElementById('tn-filter-amenity-cctv')?.checked;
        const filterAmenityFood = document.getElementById('tn-filter-amenity-food')?.checked;
        
        const filterSunlightChip = document.getElementById('tn-chip-sunlight')?.checked;
        const filterAmenitySunlight = document.getElementById('tn-filter-amenity-sunlight')?.checked;
        const filterAmenityLift = document.getElementById('tn-filter-amenity-lift')?.checked;
        const filterAmenityGated = document.getElementById('tn-filter-amenity-gated')?.checked;
        const filterCollegeChip = document.getElementById('tn-chip-college')?.checked;

        // Array Filter
        let filtered = allRooms.filter(r => {
            // Check Active
            const isActive = !r.is_rented && localStorage.getItem('gn_paused_' + r.id) !== 'true';
            if (!isActive) return false;

            const extras = JSON.parse(localStorage.getItem('gn_extras_' + r.id) || '{}');
            const category = extras.category || '';
            const titleLower = String(r.title || '').toLowerCase();
            const locationLower = String(r.location || '').toLowerCase();

            // 1. Keyword search (s)
            if (keywordTokens.length > 0) {
                const matchesKeywords = keywordTokens.every(token => {
                    return titleLower.includes(token) || 
                           locationLower.includes(token) ||
                           (String(r.road_dist || '').toLowerCase().includes(token)) ||
                           (extras.description && String(extras.description).toLowerCase().includes(token));
                });
                if (!matchesKeywords) return false;
            }

            // 2. Locality filter
            if (activeLocality !== '') {
                const matchesLoc = locationLower.includes(activeLocality.toLowerCase());
                if (!matchesLoc) return false;
            }

            // 3. Rent Price Limit
            const rentLimitToUse = searchRentLimit !== null ? searchRentLimit : p;
            if (r.rent > rentLimitToUse) return false;

            // 4. Property Type
            if (topType && topType !== '') {
                const matchesTopType = category === topType || 
                    (topType === 'Flat / Apartment' && (category === 'Flat/Apartment' || titleLower.includes('flat') || titleLower.includes('apartment'))) ||
                    (topType === 'Hostel / PG' && (category === 'Hostel/PG' || titleLower.includes('hostel') || titleLower.includes('pg'))) ||
                    (topType === 'Independent House' && (category === 'Independent House' || titleLower.includes('house')));
                if (!matchesTopType) return false;
            }
            if (hasTypeFilter) {
                let matchedType = false;
                if (typeFlat && (category === 'Flat/Apartment' || titleLower.includes('flat') || titleLower.includes('apartment'))) matchedType = true;
                if (typeHostel && (category === 'Hostel/PG' || titleLower.includes('hostel') || titleLower.includes('pg'))) matchedType = true;
                if (typeHouse && (category === 'Independent House' || titleLower.includes('house'))) matchedType = true;
                if (!matchedType) return false;
            }

            // 5. BHK Type select & checkboxes
            const is1rkCat = category === '1 RK' || titleLower.includes('1rk') || titleLower.includes('1 rk');
            if (topBhk !== '0') {
                if (topBhk === '1rk') {
                    if (!is1rkCat) return false;
                } else if (topBhk === '1') {
                    if (r.bhk !== 1 || is1rkCat) return false;
                } else if (topBhk === '5') {
                    if (r.bhk < 5) return false;
                } else {
                    if (r.bhk !== parseInt(topBhk)) return false;
                }
            }
            if (hasBhkFilter) {
                let matchedBhk = false;
                if (bhk1rk && is1rkCat) matchedBhk = true;
                if (bhk1 && r.bhk === 1 && !is1rkCat) matchedBhk = true;
                if (bhk2 && r.bhk === 2) matchedBhk = true;
                if (bhk3 && r.bhk === 3) matchedBhk = true;
                if (bhk4 && r.bhk === 4) matchedBhk = true;
                if (bhk5 && r.bhk >= 5) matchedBhk = true;
                if (!matchedBhk) return false;
            }

            // 6. Suitable For Filter
            if (hasSuitableFilter) {
                let matchedSuitable = false;
                const suitableList = (extras.suitableFor || []).map(x => x.toLowerCase());
                if (suitableList.length === 0) suitableList.push('anyone');
                
                if (suitStudents && (suitableList.includes('students') || suitableList.includes('anyone'))) matchedSuitable = true;
                if (suitProfessionals && (suitableList.includes('professionals') || suitableList.includes('anyone'))) matchedSuitable = true;
                if (suitGovt && (suitableList.includes('govt') || suitableList.includes('anyone'))) matchedSuitable = true;
                if (suitFamily && (suitableList.includes('family') || suitableList.includes('anyone'))) matchedSuitable = true;
                if (suitBachelorMale && (suitableList.includes('bachelor-male') || suitableList.includes('anyone'))) matchedSuitable = true;
                if (suitBachelorFemale && (suitableList.includes('bachelor-female') || suitableList.includes('anyone'))) matchedSuitable = true;
                if (suitAnyone && (suitableList.length > 0)) matchedSuitable = true;
                if (!matchedSuitable) return false;
            }

            // 7. Amenities Checks
            if (filterSunlight || filterSunlightChip || filterAmenitySunlight) {
                if (!r.sunlight) return false;
            }
            if (filterParking || filterAmenityParking) {
                if (!r.parking) return false;
            }
            if (filterBalcony || filterAmenityBalcony) {
                if (!r.balcony) return false;
            }
            if (filterWifi || filterAmenityWifi) {
                const hasWifi = String(r.wifi) === 'true' || (extras.extraAmenities && extras.extraAmenities.includes('ll-wifi'));
                if (!hasWifi) return false;
            }
            if (filterAmenityBathroom) {
                const hasBath = extras.bathroom === 'Attached' || (extras.extraAmenities && extras.extraAmenities.includes('ll-bathroom')) || titleLower.includes('attached');
                if (!hasBath) return false;
            }
            if (filterAmenityKitchen) {
                const hasKitchen = extras.kitchen === 'Separate' || (extras.extraAmenities && extras.extraAmenities.includes('ll-kitchen')) || titleLower.includes('kitchen');
                if (!hasKitchen) return false;
            }
            if (filterAmenityTerrace) {
                const hasTerrace = extras.terrace === 'Yes' || (extras.extraAmenities && extras.extraAmenities.includes('ll-terrace'));
                if (!hasTerrace) return false;
            }
            if (filterAmenityFurnished) {
                const hasFurnished = extras.extraAmenities && extras.extraAmenities.includes('ll-furnished');
                if (!hasFurnished) return false;
            }
            if (filterAmenityWater) {
                const hasWater = r.water === '24/7' || String(r.water || '').toLowerCase().includes('24');
                if (!hasWater) return false;
            }
            if (filterAmenityPower) {
                const hasPower = extras.extraAmenities && extras.extraAmenities.includes('ll-power-backup');
                if (!hasPower) return false;
            }
            if (filterAmenityCctv) {
                const hasCctv = extras.extraAmenities && extras.extraAmenities.includes('ll-cctv');
                if (!hasCctv) return false;
            }
            if (filterAmenityFood) {
                const hasFood = extras.extraAmenities && extras.extraAmenities.includes('ll-mess');
                if (!hasFood) return false;
            }
            if (filterAmenityLift) {
                const hasLift = extras.extraAmenities && extras.extraAmenities.includes('ll-lift');
                if (!hasLift) return false;
            }
            if (filterAmenityGated) {
                const hasGated = extras.extraAmenities && extras.extraAmenities.includes('ll-gated');
                if (!hasGated) return false;
            }
            if (filterCollegeChip) {
                const hasNearCol = extras.extraAmenities && extras.extraAmenities.includes('ll-near-college');
                if (!hasNearCol) return false;
            }
            if (filterAmenityWater) {
                if (r.water !== '24/7' && r.water !== '24x7') return false;
            }

            // 8. Water supply pill
            if (filterWater !== 'all') {
                if (String(r.water) !== filterWater) return false;
            }

            // 9. Favorites tab
            if (filterFavorites && !favorites.includes(r.id)) return false;

            return true;
        });

        // Compute match score for sorting if preference filters are active
        filtered = filtered.map(r => {
            let totalPrefs = 0;
            let matchedPrefs = 0;
            const extras = JSON.parse(localStorage.getItem('gn_extras_' + r.id) || '{}');
            
            if (filterSunlight || filterSunlightChip || filterAmenitySunlight) {
                totalPrefs++;
                if (r.sunlight) matchedPrefs++;
            }
            if (filterAmenityLift) {
                totalPrefs++;
                const hasLift = extras.extraAmenities && extras.extraAmenities.includes('ll-lift');
                if (hasLift) matchedPrefs++;
            }
            if (filterAmenityGated) {
                totalPrefs++;
                const hasGated = extras.extraAmenities && extras.extraAmenities.includes('ll-gated');
                if (hasGated) matchedPrefs++;
            }
            if (filterParking || filterAmenityParking) {
                totalPrefs++;
                if (r.parking) matchedPrefs++;
            }
            if (filterBalcony || filterAmenityBalcony) {
                totalPrefs++;
                if (r.balcony) matchedPrefs++;
            }
            if (filterWifi || filterAmenityWifi) {
                totalPrefs++;
                const hasWifi = String(r.wifi) === 'true' || (extras.extraAmenities && extras.extraAmenities.includes('ll-wifi'));
                if (hasWifi) matchedPrefs++;
            }
            
            const score = totalPrefs > 0 ? Math.round((matchedPrefs / totalPrefs) * 100) : null;
            return { ...r, matchScore: score };
        });

        // 10. Sorting Selection
        const sortVal = document.getElementById('tn-sort-select')?.value || 'relevant';
        if (sortVal === 'newest') {
            filtered.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        } else if (sortVal === 'lowest') {
            filtered.sort((a, b) => a.rent - b.rent);
        } else if (sortVal === 'highest') {
            filtered.sort((a, b) => b.rent - a.rent);
        } else {
            // Default "Most Relevant" score sorting
            const hasPreferences = (filterSunlight || filterParking || filterBalcony || filterWifi || filterAmenityParking || filterAmenityBalcony || filterAmenityWifi || filterSunlightChip || filterAmenitySunlight || filterAmenityLift || filterAmenityGated);
            if (hasPreferences) {
                filtered.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
            }
        }

        // Sync map markers if map exists
        if (mainTenantMap) {
            updateTenantMapMarkers(filtered);
        }

        // Render count
        const countEl = document.getElementById('results-count');
        if (countEl) countEl.innerText = filtered.length;

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

        gridContainer.innerHTML = filtered.map((r, idx) => {
            const hasMap = r.lat && r.lng; 
            const escapedTitle = escapeHtml(r.title);
            const escapedLocation = escapeHtml(r.location);
            const { customBhk, floorLevel, buildingType } = parseFloorAndBhk(r);
            const escapedFloor = escapeHtml(floorLevel);
            const escapedRoad = escapeHtml(r.road_dist);
            const escapedImage = r.image_url ? escapeHtml(r.image_url) : '';

            const extras = JSON.parse(localStorage.getItem('gn_extras_' + r.id) || '{}');
            const category = extras.category || 'Room';
            const deposit = extras.deposit ? `₹${parseInt(extras.deposit).toLocaleString()}` : '';
            const suitableList = extras.suitableFor || ['Students', 'Professionals'];

            // Calculate Distance from MG Marg
            const dist = calculateDistance(r.lat, r.lng, 27.3314, 88.6138);
            let distText = dist ? `${dist.toFixed(1)} km from MG Marg` : '';
            if (!distText) {
                const { mainArea } = parseLocationFields(r.location);
                const mainAreaLower = mainArea.toLowerCase();
                if (mainAreaLower.includes('tadong')) distText = '2.8 km from MG Marg';
                else if (mainAreaLower.includes('deorali')) distText = '1.2 km from MG Marg';
                else if (mainAreaLower.includes('sichey')) distText = '1.8 km from MG Marg';
                else if (mainAreaLower.includes('burtuk')) distText = '3.0 km from MG Marg';
                else if (mainAreaLower.includes('ranipool')) distText = '8.5 km from MG Marg';
                else if (mainAreaLower.includes('development')) distText = '0.9 km from MG Marg';
                else if (mainAreaLower.includes('syari')) distText = '2.2 km from MG Marg';
                else if (mainAreaLower.includes('lingding')) distText = '3.4 km from MG Marg';
                else distText = '2.0 km from MG Marg';
            }

            // Highlights
            let highlightsHtml = '';
            if (r.sunlight) highlightsHtml += `<span class="bg-amber-500/10 text-amber-600 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 border border-amber-500/15"><span class="material-symbols-outlined text-[10px]" style="font-variation-settings: 'FILL' 1">wb_sunny</span>Sunlight</span>`;
            if (r.parking) highlightsHtml += `<span class="bg-blue-500/10 text-blue-600 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 border border-blue-500/15"><span class="material-symbols-outlined text-[10px]" style="font-variation-settings: 'FILL' 1">local_parking</span>Parking</span>`;
            if (r.balcony) highlightsHtml += `<span class="bg-emerald-500/10 text-emerald-600 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 border border-emerald-500/15"><span class="material-symbols-outlined text-[10px]" style="font-variation-settings: 'FILL' 1">deck</span>Balcony</span>`;
            const hasWifi = String(r.wifi) === 'true' || (extras.extraAmenities && extras.extraAmenities.includes('ll-wifi'));
            if (hasWifi) highlightsHtml += `<span class="bg-indigo-500/10 text-indigo-600 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 border border-indigo-500/15"><span class="material-symbols-outlined text-[10px]">wifi</span>WiFi</span>`;

            const extraAmenitiesMap = {
                'll-furnished': { label: 'Furnished', icon: 'chair', classes: 'bg-purple-500/10 text-purple-600 border-purple-500/15' },
                'll-power-backup': { label: 'Power Backup', icon: 'battery_charging_full', classes: 'bg-orange-500/10 text-orange-600 border-orange-500/15' },
                'll-lift': { label: 'Lift', icon: 'elevator', classes: 'bg-slate-500/10 text-slate-600 border-slate-500/15' },
                'll-cctv': { label: 'CCTV', icon: 'videocam', classes: 'bg-red-500/10 text-red-600 border-red-500/15' },
                'll-gated': { label: 'Gated', icon: 'gate', classes: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/15' },
                'll-study-table': { label: 'Study Table', icon: 'desk', classes: 'bg-stone-500/10 text-stone-600 border-stone-500/15' },
                'll-wardrobe': { label: 'Wardrobe', icon: 'checkroom', classes: 'bg-pink-500/10 text-pink-600 border-pink-500/15' },
                'll-laundry': { label: 'Laundry', icon: 'local_laundry_service', classes: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/15' },
                'll-mess': { label: 'Food/Mess', icon: 'restaurant', classes: 'bg-rose-500/10 text-rose-600 border-rose-500/15' },
                'll-near-college': { label: 'Near College', icon: 'school', classes: 'bg-primary/10 text-primary border-primary/15' },
                'll-near-market': { label: 'Near Market', icon: 'shopping_bag', classes: 'bg-orange-500/10 text-orange-600 border-orange-500/15' },
                'll-near-hospital': { label: 'Near Hospital', icon: 'local_hospital', classes: 'bg-red-500/10 text-red-600 border-red-500/15' },
                'll-near-bus': { label: 'Near Bus Stand', icon: 'directions_bus', classes: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/15' }
            };

            if (extras.extraAmenities && Array.isArray(extras.extraAmenities)) {
                extras.extraAmenities.forEach(amenityId => {
                    if (amenityId === 'll-wifi') return; // Handled separately above
                    const mapped = extraAmenitiesMap[amenityId];
                    if (mapped) {
                        highlightsHtml += `<span class="${mapped.classes} px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 border"><span class="material-symbols-outlined text-[10px]">${mapped.icon}</span>${mapped.label}</span>`;
                    }
                });
            }

            // Suitable tags
            const suitableTagsHtml = suitableList.map(tag => `<span class="px-2 py-0.5 border border-outline-variant/35 bg-surface text-on-surface-variant text-[8px] font-bold rounded-full uppercase tracking-wider">${tag}</span>`).join('');

            // Post date
            const postedText = idx === 0 ? 'Just Posted' : idx === 1 ? '1 day ago' : `${idx + 1} days ago`;

            const isFav = favorites.includes(r.id);
            const isFeatured = idx <= 2 && !filterFavorites;

            return `
            <article id="room-${r.id}" class="bg-white rounded-2xl overflow-hidden border border-outline-variant/30 flex flex-col group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative cursor-pointer" onclick="viewRoomDetails('${r.id}')">
                
                <!-- Media Container -->
                <div class="h-44 relative overflow-hidden bg-surface-container">
                    ${escapedImage && escapedImage !== 'null' && escapedImage !== 'undefined' && escapedImage !== ''
                        ? `<img src="${escapedImage}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy">`
                        : `<div class="w-full h-full flex flex-col items-center justify-center bg-surface-container text-center px-4">
                            <span class="material-symbols-outlined text-on-surface-variant/40 text-4xl mb-2">photo_camera</span>
                            <p class="text-[11px] font-bold text-on-surface-variant leading-tight">No Property Image</p>
                           </div>`
                    }

                    <!-- Featured Tag -->
                    ${isFeatured ? `
                    <div class="absolute top-3 left-3">
                        <span class="bg-gradient-to-r from-primary via-indigo-600 to-accent text-white px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-md flex items-center gap-1">
                            <span class="material-symbols-outlined text-[10px] font-filled" style="font-variation-settings: 'FILL' 1">grade</span>Featured
                        </span>
                    </div>
                    ` : `
                    <div class="absolute top-3 left-3">
                        <span class="bg-[#25D366] text-white border border-[#1DA851] px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider shadow-sm">
                            ${category}
                        </span>
                    </div>
                    `}

                    <!-- Favorite action -->
                    <div class="absolute top-3 right-3 flex flex-col gap-2">
                        <button onclick="toggleFavorite('${r.id}'); event.stopPropagation();" class="bg-white/85 backdrop-blur-sm text-error hover:scale-115 active:scale-95 w-8.5 h-8.5 rounded-full flex items-center justify-center shadow-lg transition-all" title="${isFav ? 'Remove from Saved' : 'Save Property'}">
                            <span class="material-symbols-outlined ${isFav ? 'font-filled' : ''} text-base">${isFav ? 'favorite' : 'favorite_border'}</span>
                        </button>
                    </div>

                    <!-- Image counter badge -->
                    <div class="absolute bottom-3 right-3">
                        <span class="flex items-center gap-1 px-2 py-0.5 rounded bg-black/40 text-white backdrop-blur-sm text-[8px] font-bold">
                            <span class="material-symbols-outlined text-[9px]">photo_camera</span>${idx + 3} photos
                        </span>
                    </div>
                </div>

                <!-- Card Body -->
                <div class="p-4 flex flex-col flex-grow">
                    <h4 class="font-headline font-black text-sm text-primary truncate mb-1" title="${escapedTitle}">${escapedTitle}</h4>
                    <p class="text-[10px] text-on-surface-variant font-bold truncate flex items-center gap-1 mb-2">
                        <span class="material-symbols-outlined text-[11px] text-primary/60">location_on</span>${escapedLocation}
                    </p>

                    <div class="flex items-center justify-between mb-3">
                        <div class="flex items-center gap-1.5">
                            <span class="text-sm font-black text-primary">₹${r.rent.toLocaleString()}/mo</span>
                            ${deposit ? `<span class="text-[9px] bg-success/8 text-success border border-success/15 px-1.5 py-0.2 rounded font-black">Dep: ${deposit}</span>` : ''}
                        </div>
                        <span class="text-[9px] text-on-surface-variant font-bold flex items-center gap-0.5">
                            <span class="material-symbols-outlined text-[10px]">directions_walk</span>${distText}
                        </span>
                    </div>

                    <!-- Highlight chips -->
                    <div class="flex flex-wrap gap-1.5 mb-3">
                        ${highlightsHtml}
                    </div>

                    <!-- Suitable chips -->
                    <div class="flex flex-wrap gap-1.5 mb-4 border-t border-outline-variant/15 pt-3">
                        ${suitableTagsHtml}
                    </div>

                    <!-- Footer elements -->
                    <div class="mt-auto pt-3 border-t border-outline-variant/15 flex items-center justify-between gap-3">
                        <span class="text-[9px] font-semibold text-on-surface-variant">${postedText}</span>
                        <div class="flex gap-2">
                            <button onclick="focusMapOnRoom('${r.id}'); event.stopPropagation();" class="px-3 py-1.5 bg-surface border border-outline-variant/40 hover:border-primary/50 text-on-surface font-black uppercase text-[8px] rounded-lg transition-all flex items-center gap-1"><span class="material-symbols-outlined text-[10px]">map</span> Map</button>
                            <a href="https://wa.me/91${r.contact}" target="_blank" onclick="event.stopPropagation();" class="px-3 py-1.5 bg-[#25D366] text-white hover:bg-[#1DA851] font-black uppercase text-[8px] rounded-lg shadow-sm flex items-center gap-1 transition-all">
                                <span class="material-symbols-outlined text-[10px] font-filled">forum</span> WhatsApp
                            </a>
                        </div>
                    </div>
                </div>
            </article>
            `;
        }).join('');

    } catch (e) {
        alert("FILTER CRASH: " + e.message + "\n" + e.stack);
        console.error(e);
    }
}

function quickSearch(tag) {
    clearTenantSearch();
    const searchInput = document.getElementById('tn-search');
    const localitySelect = document.getElementById('tn-locality-select');
    const lTag = tag.toLowerCase();
    const localities = ['tadong', 'deorali', 'sichey', 'burtuk', 'ranipool', 'development area', 'syari', 'lingding', 'other'];
    
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
    setTenantTab('explore');
}

function openFeaturedModal() {
    renderFeaturedRooms();
    const backdrop = document.getElementById('featured-backdrop');
    const drawer = document.getElementById('featured-modal');
    if (!drawer) return;
    backdrop.classList.remove('hidden');
    setTimeout(() => backdrop.classList.remove('opacity-0'), 10);
    drawer.classList.remove('translate-x-full');
    drawer.classList.add('translate-x-0');
    document.body.style.overflow = 'hidden';
}

function closeFeaturedModal() {
    const backdrop = document.getElementById('featured-backdrop');
    const drawer = document.getElementById('featured-modal');
    if (!drawer) return;
    drawer.classList.add('translate-x-full');
    drawer.classList.remove('translate-x-0');
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

    const activeListings = allRooms.filter(r => !r.is_rented && localStorage.getItem('gn_paused_' + r.id) !== 'true');
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
        if (r.sunlight) badges.push(`<span class="bg-amber-500/15 text-amber-600 px-2 py-0.5 rounded-md text-[8px] font-bold uppercase">☀ Sunlight</span>`);
        if (r.parking) badges.push(`<span class="bg-blue-500/15 text-blue-600 px-2 py-0.5 rounded-md text-[8px] font-bold uppercase">🚗 Parking</span>`);
        if (r.balcony) badges.push(`<span class="bg-emerald-500/15 text-emerald-600 px-2 py-0.5 rounded-md text-[8px] font-bold uppercase">🌿 Balcony</span>`);

        const isFav = favorites.includes(r.id);
        const rankColors = ['bg-accent', 'bg-primary', 'bg-secondary'];
        const rankLabel = ['#1 Pick', '#2 Pick', '#3 Pick'];

        return `
        <div class="bg-surface-container rounded-2xl overflow-hidden shadow-md border border-outline-variant/20 group hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 cursor-pointer" onclick="closeFeaturedModal(); setTimeout(() => viewRoomDetails('${r.id}'), 350);">
            <div class="relative h-44 overflow-hidden">
                ${escapedImage && escapedImage !== 'null' && escapedImage !== 'undefined' && escapedImage !== ''
                    ? `<img src="${escapedImage}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="${escapedTitle}">`
                    : `<div class="w-full h-full flex flex-col items-center justify-center bg-surface-container text-center px-4">
                        <span class="material-symbols-outlined text-on-surface-variant/40 text-4xl mb-2">photo_camera</span>
                        <p class="text-[11px] font-bold text-on-surface-variant leading-tight">No Property Image</p>
                       </div>`
                }
                <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent"></div>
                <div class="absolute top-3 left-3">
                    <span class="${rankColors[idx] || 'bg-primary'} text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-lg">
                        <span class="material-symbols-outlined text-[11px] font-filled">grade</span> ${rankLabel[idx] || 'Featured'}
                    </span>
                </div>
                <button onclick="toggleFavorite('${r.id}'); renderFeaturedRooms(); event.stopPropagation();" class="absolute top-3 right-3 w-8 h-8 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-error/80 transition-all" title="${isFav ? 'Remove from Saved' : 'Save Room'}">
                    <span class="material-symbols-outlined ${isFav ? 'font-filled' : ''} text-base">favorite</span>
                </button>
                <div class="absolute bottom-3 right-3 bg-primary text-white px-3 py-1 rounded-lg font-black text-sm shadow-lg">₹${r.rent}<span class="text-[9px] font-bold opacity-80">/mo</span></div>
                <div class="absolute bottom-3 left-3 bg-black/50 backdrop-blur-sm text-white px-2.5 py-1 rounded-lg font-black text-[9px] uppercase tracking-wider">${customBhk}</div>
            </div>
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
                    ${hasMap ? `<button onclick="closeFeaturedModal(); setTimeout(() => viewRoomDetails('${r.id}'), 350); event.stopPropagation();" class="flex-1 py-2.5 rounded-xl bg-surface-container-high text-on-surface font-black text-[10px] uppercase flex items-center justify-center gap-1.5 hover:bg-outline-variant/30 transition-all">
                        <span class="material-symbols-outlined text-[12px]">open_in_new</span> View Details
                    </button>` : ''}
                </div>
            </div>
        </div>`;
    }).join('');
}

function renderLandingFeaturedRooms() {
    const gridContainer = document.getElementById('landing-featured-grid');
    if (!gridContainer) return;

    const activeListings = allRooms.filter(r => !r.is_rented && localStorage.getItem('gn_paused_' + r.id) !== 'true');
    const featured = activeListings.slice(0, 4);

    if (featured.length === 0) {
        gridContainer.innerHTML = '<div class="col-span-full text-center text-on-surface-variant py-10 font-bold">No handpicked properties available at the moment.</div>';
        return;
    }

    gridContainer.innerHTML = featured.map((r, idx) => {
        const escapedTitle = escapeHtml(r.title);
        const escapedLocation = escapeHtml(r.location);
        const { customBhk } = parseFloorAndBhk(r);
        const escapedImage = escapeHtml(r.image_url);
        const isFav = typeof favorites !== 'undefined' && favorites.includes(r.id);

        const badges = [];
        if (customBhk) badges.push(`<span class="flex items-center gap-1.5"><span class="material-symbols-outlined text-[14px]">bed</span> ${customBhk}</span>`);
        if (r.bathroom === 'Yes') badges.push(`<span class="flex items-center gap-1.5"><span class="material-symbols-outlined text-[14px]">bathtub</span> Bath</span>`);
        if (r.parking) badges.push(`<span class="flex items-center gap-1.5"><span class="material-symbols-outlined text-[14px]">local_parking</span> Parking</span>`);
        if (r.balcony) badges.push(`<span class="flex items-center gap-1.5"><span class="material-symbols-outlined text-[14px]">balcony</span> Balcony</span>`);

        const footerBadges = badges.slice(0, 3).join('');
        
        // Mockup specific tag styling
        const tags = ['ROOM', '1 RK', '2 BHK FLAT', 'INDEPENDENT HOUSE'];
        const tagColors = ['bg-primary', 'bg-secondary', 'bg-accent', 'bg-primary'];

        return `
        <div class="bg-white rounded-[1.25rem] overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-outline-variant/20 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col group" onclick="if(typeof openTenantAuthModal === 'function') openTenantAuthModal();">
            <div class="relative h-48 overflow-hidden bg-surface-container-high">
                ${escapedImage && escapedImage !== 'null' && escapedImage !== 'undefined' && escapedImage !== ''
                    ? `<img src="${escapedImage}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="${escapedTitle}">`
                    : `<div class="w-full h-full flex items-center justify-center"><span class="material-symbols-outlined text-outline-variant text-4xl">photo_camera</span></div>`
                }
                
                <div class="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
                
                <div class="absolute top-3 left-3 ${tagColors[idx] || 'bg-primary'} text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg shadow-sm">
                    ${tags[idx] || customBhk || 'ROOM'}
                </div>
                
                <button onclick="if(typeof openTenantAuthModal === 'function') openTenantAuthModal(); event.stopPropagation();" class="absolute top-3 right-3 w-8 h-8 bg-black/20 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/40 transition-all">
                    <span class="material-symbols-outlined text-[16px]">favorite_border</span>
                </button>
            </div>
            
            <div class="p-5 flex-grow flex flex-col justify-between">
                <div>
                    <h4 class="font-headline font-black text-on-surface text-[15px] truncate mb-1">${escapedTitle}</h4>
                    <p class="text-on-surface-variant text-[11px] flex items-center gap-1 mb-4">
                        <span class="material-symbols-outlined text-[14px] text-primary">location_on</span> ${escapedLocation}
                    </p>
                    <div class="font-headline font-black text-primary text-xl mb-4">
                        ₹${r.rent} <span class="text-on-surface-variant text-[11px] font-bold opacity-70">/month</span>
                    </div>
                </div>
                <div class="flex items-center justify-start gap-4 text-[10px] font-bold text-on-surface-variant border-t border-outline-variant/20 pt-4 uppercase tracking-wide">
                    ${footerBadges || '<span>No special amenities</span>'}
                </div>
            </div>
        </div>
        `;
    }).join('');
}


function toggleMobileMap() {
    // Delegate to the unified map toggle in map.js
    if (typeof toggleMapView === 'function') toggleMapView();
}



function updatePriceLabel() {
    const priceInput = document.getElementById('tn-price');
    if (priceInput) {
        const p = parseInt(priceInput.value);
        document.getElementById('tn-price-label').innerText = `₹${(p/1000).toFixed(0)}K`;
        filterTenantRooms();
    }
}

// ==========================================
// ROOM DETAILS MODAL
// ==========================================
function viewRoomDetails(roomId) {
    const r = allRooms.find(x => x.id === roomId);
    if (!r) return;
    
    // Increment view counter in Supabase
    try {
        supabaseClient.rpc('increment_view', { row_id: roomId }).catch(err => console.error('View tracking failed:', err));
    } catch(e) {
        console.error('Supabase client error (view):', e);
    }
    
    const rdImage = document.getElementById('rd-image');
    const rdNoImage = document.getElementById('rd-no-image');
    if (r.image_url && r.image_url !== 'null' && r.image_url !== 'undefined' && r.image_url !== '') {
        rdImage.src = r.image_url;
        rdImage.classList.remove('hidden');
        if (rdNoImage) rdNoImage.classList.add('hidden');
    } else {
        rdImage.classList.add('hidden');
        if (rdNoImage) rdNoImage.classList.remove('hidden');
    }
    document.getElementById('rd-title').innerText = r.title;
    document.getElementById('rd-loc-text').innerText = r.location;
    document.getElementById('rd-rent').innerText = `₹${r.rent.toLocaleString()}`;
    
    const extras = JSON.parse(localStorage.getItem('gn_extras_' + r.id) || '{}');
    document.getElementById('rd-deposit').innerText = extras.deposit ? `Deposit: ₹${parseInt(extras.deposit).toLocaleString()}` : 'No Deposit Mentioned';
    
    const { customBhk, floorLevel, buildingType } = parseFloorAndBhk(r);
    document.getElementById('rd-prop-type').innerText = buildingType || 'Not specified';
    document.getElementById('rd-room-type').innerText = customBhk;
    document.getElementById('rd-floor').innerText = floorLevel || 'N/A';
    document.getElementById('rd-water').innerText = r.water || 'N/A';
    document.getElementById('rd-road').innerText = r.road_dist || 'N/A';
    document.getElementById('rd-terrace').innerText = extras.terrace || 'No';
    
    const descContainer = document.getElementById('rd-desc-container');
    const descEl = document.getElementById('rd-desc');
    if (extras.description && extras.description.trim() !== '') {
        descEl.innerText = extras.description;
        descContainer.classList.remove('hidden');
    } else {
        descContainer.classList.add('hidden');
    }
    
    // Build tags
    let tagsHtml = '';
    const suitableMap = {
        'students': 'Students', 'professionals': 'Professionals', 'govt': 'Govt Employees',
        'family': 'Family', 'bachelor-male': 'Bachelors (Boys)', 'bachelor-female': 'Bachelors (Girls)', 'anyone': 'Anyone'
    };
    if (extras.suitableFor && extras.suitableFor.length > 0) {
        extras.suitableFor.forEach(s => {
            tagsHtml += `<span class="px-2.5 py-1 bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 rounded-lg text-[9px] font-black uppercase tracking-wider">${suitableMap[s] || s}</span>`;
        });
    }
    
    if (r.sunlight) tagsHtml += `<span class="px-2.5 py-1 bg-amber-500/10 text-amber-600 border border-amber-500/20 rounded-lg text-[9px] font-black uppercase tracking-wider">Sunlight</span>`;
    if (r.parking) tagsHtml += `<span class="px-2.5 py-1 bg-blue-500/10 text-blue-600 border border-blue-500/20 rounded-lg text-[9px] font-black uppercase tracking-wider">Parking</span>`;
    if (r.balcony) tagsHtml += `<span class="px-2.5 py-1 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 rounded-lg text-[9px] font-black uppercase tracking-wider">Balcony</span>`;
    
    const amenityMap = {
        'll-furnished': 'Furnished', 'll-wifi': 'WiFi', 'll-power-backup': 'Power Backup',
        'll-lift': 'Lift', 'll-cctv': 'CCTV', 'll-gated': 'Gated Security',
        'll-study-table': 'Study Table', 'll-wardrobe': 'Wardrobe', 'll-laundry': 'Laundry', 'll-mess': 'Mess Food',
        'll-near-college': 'Near College', 'll-near-market': 'Near Market', 'll-near-hospital': 'Near Hospital', 'll-near-bus': 'Near Bus Stop'
    };
    if (extras.extraAmenities && extras.extraAmenities.length > 0) {
        extras.extraAmenities.forEach(a => {
            tagsHtml += `<span class="px-2.5 py-1 bg-surface-container-highest text-on-surface border border-outline-variant/30 rounded-lg text-[9px] font-black uppercase tracking-wider">${amenityMap[a] || a}</span>`;
        });
    }
    
    document.getElementById('rd-tags').innerHTML = tagsHtml || '<span class="text-[10px] font-bold text-on-surface-variant">No special features listed.</span>';
    
    // Contact buttons
    document.getElementById('rd-call-btn').href = `tel:${r.contact}`;
    const waMessage = `Hi! I found your property (${customBhk} in ${r.location}) on GangtokNest. I am interested to know more.`;
    const waBtn = document.getElementById('rd-wa-btn');
    waBtn.href = `https://wa.me/91${r.contact}?text=${encodeURIComponent(waMessage)}`;
    waBtn.onclick = () => {
        // Increment inquiry counter in Supabase
        try {
            supabaseClient.rpc('increment_inquiry', { row_id: r.id }).catch(err => console.error('Inquiry tracking failed:', err));
        } catch(e) {
            console.error('Supabase client error (inquiry):', e);
        }
    };
    
    document.getElementById('rd-map-btn').onclick = () => {
        closeRoomDetails();
        setTimeout(() => focusMapOnRoom(r.id), 350);
    };
    
    const isPaused = localStorage.getItem('gn_paused_' + r.id) === 'true';
    const badge = document.getElementById('rd-badge');
    if (r.is_rented) {
        badge.innerText = 'Rented';
        badge.className = 'px-3 py-1 bg-secondary text-white text-[10px] font-black uppercase tracking-wider rounded-lg shadow-lg';
    } else if (isPaused) {
        badge.innerText = 'Paused';
        badge.className = 'px-3 py-1 bg-warning text-white text-[10px] font-black uppercase tracking-wider rounded-lg shadow-lg';
    } else {
        badge.innerText = 'Active';
        badge.className = 'px-3 py-1 bg-[#25D366] border border-[#1DA851] text-white text-[10px] font-black uppercase tracking-wider rounded-lg shadow-lg';
    }
    
    document.getElementById('room-details-modal').classList.remove('hidden');
    
    const viewKey = 'gn_views_' + r.id;
    let views = parseInt(localStorage.getItem(viewKey) || 0);
    localStorage.setItem(viewKey, views + 1);
}

function closeRoomDetails() {
    document.getElementById('room-details-modal').classList.add('hidden');
}
