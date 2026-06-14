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

