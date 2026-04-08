/* Supabase Client */
const supabaseClient = window.supabase.createClient(
    'https://vafsigyuefiovfxfbwlp.supabase.co', 
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhZnNpZ3l1ZWZpb3ZmeGZid2xwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2MjEyNDksImV4cCI6MjA5MTE5NzI0OX0.2JygpUTPkuIC56s8BIDWfbWRHwyw9rnHBy2Ctae18Gs'
);

/* State Management */
function togglePassword() {
    const pwd = document.getElementById('authPassword');
    const icon = document.getElementById('passwordIcon');
    if (pwd.type === 'password') { pwd.type = 'text'; icon.innerText = 'visibility_off'; } 
    else { pwd.type = 'password'; icon.innerText = 'visibility'; }
}

function showTenantView() {
    document.getElementById('authView').classList.add('hidden');
    document.getElementById('landlordView').classList.add('hidden');
    document.getElementById('tenantView').classList.remove('hidden');
    document.getElementById('navTenant').classList.add('nav-active');
    document.getElementById('navLandlord').classList.remove('nav-active');
    fetchRooms();
}

async function showLandlordView() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    document.getElementById('tenantView').classList.add('hidden');
    document.getElementById('navLandlord').classList.add('nav-active');
    document.getElementById('navTenant').classList.remove('nav-active');
    if (user) {
        document.getElementById('authView').classList.add('hidden');
        document.getElementById('landlordView').classList.remove('hidden');
    } else {
        document.getElementById('landlordView').classList.add('hidden');
        document.getElementById('authView').classList.remove('hidden');
    }
}

/* Authentication Logic */
async function handleAuth(type) {
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    if (type === 'signup') {
        const { error } = await supabaseClient.auth.signUp({ email, password });
        if (error) alert(error.message); else alert("Check email or try Login.");
    } else {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) alert(error.message); else showLandlordView();
    }
}

async function signOut() { await supabaseClient.auth.signOut(); location.reload(); }

/* Form Logic with Phone Validation */
document.getElementById('landlordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const phoneInput = document.getElementById('phone');
    const phoneError = document.getElementById('phoneError');
    const btn = document.getElementById('submitBtn');

    if (!/^[0-9]{10}$/.test(phoneInput.value)) {
        phoneError.classList.remove('hidden');
        phoneInput.classList.add('border-red-500');
        return;
    }

    btn.innerText = "Processing..."; btn.disabled = true;
    const { data: { user } } = await supabaseClient.auth.getUser();
    const photoFile = document.getElementById('roomPhoto').files[0];
    let imageUrl = '';

    if (photoFile) {
        const fileName = `${Date.now()}_${photoFile.name}`;
        const { error } = await supabaseClient.storage.from('room-photos').upload(fileName, photoFile);
        if (!error) {
            const { data: urlData } = supabaseClient.storage.from('room-photos').getPublicUrl(fileName);
            imageUrl = urlData.publicUrl;
        }
    }

    const listing = {
        title: document.getElementById('title').value,
        location: document.getElementById('loc').value,
        rent: parseInt(document.getElementById('price').value),
        contact: phoneInput.value,
        water: document.getElementById('water').value,
        washroom: document.getElementById('washroom').value,
        image_url: imageUrl,
        is_rented: false,
        user_id: user.id
    };

    const { error } = await supabaseClient.from('listings').insert([listing]);
    if (!error) { alert("Successfully Listed!"); showTenantView(); } else { alert(error.message); }
    btn.innerText = "Post My Room"; btn.disabled = false;
});

/* Discovery & Render Logic */
async function fetchRooms() {
    const { data } = await supabaseClient.from('listings').select('*').eq('is_rented', false).order('created_at', { ascending: false });
    renderRooms(data || []);
}

async function searchRooms() {
    const term = document.getElementById('locSearch').value;
    const { data } = await supabaseClient.from('listings').select('*').ilike('location', `%${term}%`).eq('is_rented', false);
    renderRooms(data || []);
}

function renderRooms(rooms) {
    const container = document.getElementById('roomContainer');
    const counter = document.getElementById('resultCount');
    counter.innerText = rooms.length ? `${rooms.length} Nests Found` : "Searching...";

    if (rooms.length === 0) {
        container.innerHTML = `<div class="text-center py-10 opacity-40">No nests available here.</div>`;
        return;
    }

    container.innerHTML = '';
    rooms.forEach(r => {
        const img = r.image_url || 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?q=80&w=600';
        container.innerHTML += `
        <div class="room-card">
            <img src="${img}" class="room-img" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?q=80&w=600'">
            <div class="room-details">
                <div class="flex justify-between items-start mb-2">
                    <h3 class="font-bold text-xl text-[#00253b]">${r.title}</h3>
                    <div class="text-right">
                        <span class="text-emerald-600 font-black text-lg">₹${r.rent.toLocaleString('en-IN')}</span>
                        <p class="text-[10px] text-slate-400 font-bold uppercase">Per Month</p>
                    </div>
                </div>
                <p class="text-slate-500 text-sm mb-6 flex items-center gap-1">
                    <span class="material-symbols-outlined text-sm text-sky-500">location_on</span>${r.location}
                </p>
                <div class="flex gap-2 mb-6">
                    <span class="bg-slate-100 text-[10px] font-black px-2 py-1 rounded">💧 ${r.water}</span>
                    <span class="bg-slate-100 text-[10px] font-black px-2 py-1 rounded">🚽 ${r.washroom}</span>
                </div>
                <a href="tel:${r.contact}" class="primary-btn block text-center py-3 text-sm">Call Landlord</a>
            </div>
        </div>`;
    });
}

showLandlordView();