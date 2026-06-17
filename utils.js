// ==========================================
// DARK MODE ENGINE
// ==========================================
function applyThemeForRole(role) {
    if (role === 'tenant' || role === 'anonymous') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    applyThemeForRole('anonymous');
});

function toggleDarkMode() {
    const html = document.documentElement;
    const isDark = !html.classList.contains('dark');
    
    if (isDark) {
        html.classList.add('dark');
    } else {
        html.classList.remove('dark');
    }
    
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
function parseFloorAndBhk(r) {
    let customBhk = `${r.bhk} BHK`;
    let floorLevel = String(r.floor_level || '');
    let buildingType = 'Shared Flat';
    
    if (floorLevel.includes('|')) {
        const parts = floorLevel.split('|');
        customBhk = parts[0].trim();
        floorLevel = parts[1].trim();
        if (parts.length > 2) {
            buildingType = parts[2].trim();
        }
    }
    return { customBhk, floorLevel, buildingType };
}

function parseLocationFields(locationStr) {
    let mainArea = '';
    let exactLocation = locationStr || '';
    let landmark = '';
    
    if (locationStr && locationStr.includes(' - ')) {
        const parts = locationStr.split(' - ');
        mainArea = parts[0].trim();
        let rest = parts.slice(1).join(' - ').trim();
        
        if (rest.includes('(Landmark: ') && rest.endsWith(')')) {
            const startIdx = rest.indexOf('(Landmark: ');
            landmark = rest.substring(startIdx + 11, rest.length - 1).trim();
            exactLocation = rest.substring(0, startIdx).trim();
        } else {
            exactLocation = rest;
        }
    }
    return { mainArea, exactLocation, landmark };
}

