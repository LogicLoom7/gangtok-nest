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

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (user) loadDashboard(user);
});

function selectRole(role) {
    authRole = role;
    const btns = ['btn-role-tenant', 'btn-role-landlord'];
    btns.forEach(id => {
        const b = document.getElementById(id);
        b.className = "flex-1 py-2.5 px-4 rounded-full font-bold text-xs md:text-sm transition-all z-10 text-on-surface-variant hover:text-primary";
    });
    const active = document.getElementById(`btn-role-${role}`);
    active.className = "flex-1 py-2.5 px-4 rounded-full font-bold text-xs md:text-sm transition-all bg-surface-container-lowest text-primary segmented-control-active z-10 shadow-sm";
    document.getElementById('loginHeading').innerText = role === 'landlord' ? "Landlord Access" : "Renter Access";
}

function toggleAuthMode() {
    isSignUpMode = !isSignUpMode;
    document.getElementById('authBtnText').innerText = isSignUpMode ? "Register Account" : "Access Portal";
    document.getElementById('authToggleBtn').innerText = isSignUpMode ? "Sign In" : "Create Account";
    document.getElementById('nameWrapper').style.display = isSignUpMode ? 'block' : 'none';
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
        }
        if (res.error) throw res.error;
        if (res.data.user) loadDashboard(res.data.user);
    } catch (e) { alert(e.message); btn.innerHTML = original; }
}

async function signOut() { await supabaseClient.auth.signOut(); location.reload(); }

function loadDashboard(user) {
    const role = user.user_metadata?.role || authRole;
    document.getElementById('header-landing').style.display = 'none';
    document.getElementById('view-landing').style.display = 'none';
    document.getElementById('header-dashboard').style.display = 'flex';
    document.getElementById('userGreeting').innerText = `${user.user_metadata?.full_name || role}`;
    
    if (role === 'landlord') {
        document.getElementById('view-landlord').style.display = 'block';
        fetchLandlordData(user.id);
    } else {
        document.getElementById('view-tenant').style.display = 'block';
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
                btnText.innerText = "Capture GPS Location";
            }
        );
    } else {
        alert("Geolocation is not supported by your browser.");
        btnText.innerText = "Capture GPS Location";
    }
}

async function publishListing() {
    const btn = document.getElementById('ll-submit');
    const original = btn.innerText;
    
    if (!currentLat || !currentLng) {
        alert("Please click 'Capture GPS Location' before publishing.");
        return;
    }

    btn.innerText = "Syncing Cloud...";
    
    try {
        const file = document.getElementById('ll-photo').files[0];
        let url = '';
        if (file) {
            const path = `${Date.now()}_${file.name}`;
            await supabaseClient.storage.from('room-photos').upload(path, file);
            url = supabaseClient.storage.from('room-photos').getPublicUrl(path).data.publicUrl;
        }
        const { data: { user } } = await supabaseClient.auth.getUser();
        await supabaseClient.from('listings').insert([{
            title: document.getElementById('ll-title').value,
            location: document.getElementById('ll-loc').value,
            rent: parseInt(document.getElementById('ll-rent').value),
            bhk: parseInt(document.getElementById('ll-bhk').value),
            floor_level: document.getElementById('ll-floor').value,
            contact: document.getElementById('ll-phone').value,
            road_dist: document.getElementById('ll-road').value,
            water: document.getElementById('ll-water').value,
            sunlight: document.getElementById('ll-sun').checked,
            parking: document.getElementById('ll-park').checked,
            balcony: document.getElementById('ll-balc').checked,
            image_url: url, 
            user_id: user.id,
            lat: currentLat,
            lng: currentLng
        }]);
        
        alert("Published successfully!");
        
        document.getElementById('landlordForm').reset();
        document.getElementById('upload-text').innerText = "Upload Room Image";
        currentLat = null;
        currentLng = null;
        document.getElementById('loc-text').innerText = "Capture GPS Location";
        document.getElementById('btn-detect-loc').classList.remove('bg-emerald-500/10', 'text-emerald-500', 'border-emerald-500/30');
        document.getElementById('btn-detect-loc').classList.add('bg-surface-container', 'text-on-surface');

        fetchLandlordData(user.id);
        switchTab('active-tab', document.querySelectorAll('.tab-btn')[1]);
    } catch (e) { alert(e.message); } finally { btn.innerText = original; }
}

async function fetchLandlordData(uid) {
    const { data } = await supabaseClient.from('listings').select('*').eq('user_id', uid).order('created_at', { ascending: false });
    document.getElementById('ll-active-grid').innerHTML = (data || []).map(r => `
        <div class="bg-surface-container-lowest p-4 rounded-2xl shadow flex items-center gap-4 border border-outline-variant/30 transition-colors">
            <img src="${r.image_url}" class="w-16 h-16 rounded-xl object-cover">
            <div class="flex-1"><h4 class="font-bold text-sm text-primary truncate">${r.title}</h4><p class="text-xs text-accent font-black">₹${r.rent}</p></div>
            <button onclick="deleteListing('${r.id}')" class="text-error material-symbols-outlined hover:bg-error/10 p-2 rounded-full transition-colors">delete</button>
        </div>`).join('');
}

async function deleteListing(id) { 
    if(confirm("Delete?")) { 
        await supabaseClient.from('listings').delete().eq('id', id); 
        const { data: { user } } = await supabaseClient.auth.getUser();
        fetchLandlordData(user.id);
    }
}

async function fetchTenantData() {
    const { data } = await supabaseClient.from('listings').select('*').order('created_at', { ascending: false });
    allRooms = data || [];
    filterTenantRooms();
}

function setTenantBHK(b, btn) {
    activeBHK = b;
    document.querySelectorAll('.tn-bhk-btn').forEach(x => x.className = "tn-bhk-btn flex-1 py-3 rounded-xl text-[10px] font-black bg-surface-container text-on-surface uppercase transition-colors");
    btn.className = "tn-bhk-btn active-bhk flex-1 py-3 rounded-xl text-[10px] font-black bg-primary text-white shadow-md uppercase transition-colors";
    filterTenantRooms();
}

// ==========================================
// SMART ROOMMATE SHARE ENGINE
// ==========================================
function shareRoom(roomId) {
    // Find the specific room the user clicked on
    const room = allRooms.find(r => r.id === roomId);
    if (!room) return;

    // Build a smart sentence summarizing the room
    const bhkText = room.bhk === 4 ? 'Homestay / 4+ BHK' : `${room.bhk} BHK`;
    const features = [];
    if(room.parking) features.push('Parking');
    if(room.balcony) features.push('a Balcony');
    if(room.sunlight) features.push('great Sunlight');
    
    const featureString = features.length > 0 ? ` with ${features.join(', ')}` : '';
    const shareText = `Hey! Found this ${bhkText} in ${room.location} for ₹${room.rent}/mo${featureString} on GangtokNest.\n\nCheck it out here: ${window.location.href}`;

    // Use Native Share API if on Mobile, otherwise fallback to clipboard copy
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

function filterTenantRooms() {
    const s = document.getElementById('tn-search').value.toLowerCase();
    const p = parseInt(document.getElementById('tn-price').value);
    document.getElementById('tn-price-label').innerText = `₹${p.toLocaleString()}`;
    const f = allRooms.filter(r => (r.location.toLowerCase().includes(s)) && r.rent <= p && (activeBHK === 0 || r.bhk === activeBHK));
    
    document.getElementById('tn-grid').innerHTML = f.map(r => {
        const hasMap = r.lat && r.lng; 
        const safeTitle = r.title.replace(/'/g, "\\'");

        let featuresHtml = '';
        if(r.sunlight) featuresHtml += `<span class="bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 px-2 py-1 rounded-md text-[8px] font-bold uppercase border border-amber-500/20">Sunlight</span>`;
        if(r.parking) featuresHtml += `<span class="bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-md text-[8px] font-bold uppercase border border-blue-500/20">Parking</span>`;
        if(r.balcony) featuresHtml += `<span class="bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded-md text-[8px] font-bold uppercase border border-emerald-500/20">Balcony</span>`;

        return `
        <article class="bg-surface-container-lowest rounded-[2rem] overflow-hidden shadow-lg border border-outline-variant/30 flex flex-col group hover:-translate-y-1 transition-all">
            <div class="h-48 relative overflow-hidden">
                <img src="${r.image_url}" class="w-full h-full object-cover">
                <div class="absolute bottom-3 right-3 bg-primary text-white px-3 py-1.5 rounded-lg font-black text-sm shadow-xl">₹${r.rent}</div>
            </div>
            <div class="p-5 flex flex-col flex-grow">
                <h3 class="text-lg font-black text-primary mb-1 truncate">${r.title}</h3>
                <p class="text-on-surface-variant text-xs mb-3 flex items-center gap-1"><span class="material-symbols-outlined text-sm">location_on</span>${r.location}</p>
                
                <div class="flex flex-wrap gap-1.5 mb-4">
                    ${featuresHtml}
                </div>

                <div class="grid grid-cols-2 gap-2 mb-4">
                    <div class="bg-surface-container p-2 rounded-lg text-[9px] font-bold text-center uppercase text-on-surface transition-colors">Floor: ${r.floor_level}</div>
                    <div class="bg-surface-container p-2 rounded-lg text-[9px] font-bold text-center uppercase text-on-surface transition-colors">Road: ${r.road_dist}</div>
                </div>
                
                <div class="flex flex-col gap-2 mt-auto">
                    <div class="flex gap-2">
                        ${hasMap ? `
                        <button onclick="openMapModal(${r.lat}, ${r.lng}, '${safeTitle}')" class="flex-1 py-3 rounded-xl bg-surface-container text-on-surface font-black uppercase text-[10px] flex items-center justify-center gap-1.5 hover:bg-outline-variant/30 transition-all shadow-sm">
                            <span class="material-symbols-outlined text-[1rem]">map</span> Map
                        </button>
                        ` : ''}
                        <button onclick="shareRoom('${r.id}')" class="${hasMap ? 'flex-1' : 'w-full'} py-3 rounded-xl bg-surface-container text-on-surface font-black uppercase text-[10px] flex items-center justify-center gap-1.5 hover:bg-outline-variant/30 transition-all shadow-sm">
                            <span class="material-symbols-outlined text-[1rem]">ios_share</span> Share
                        </button>
                    </div>
                    <a href="https://wa.me/91${r.contact}" target="_blank" class="w-full py-3 rounded-xl bg-accent text-white font-black uppercase text-[10px] flex items-center justify-center gap-1.5 hover:opacity-90 transition-all shadow-md">
                        <span class="material-symbols-outlined text-[1rem]">chat</span> WhatsApp Owner
                    </a>
                </div>
            </div>
        </article>`;
    }).join('');
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