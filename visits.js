function getVisits() {
    return JSON.parse(localStorage.getItem('gn_visits') || '[]');
}
function saveVisits(visits) {
    localStorage.setItem('gn_visits', JSON.stringify(visits));
}
function viewLandlordDetails(roomId) {
    const room = allRooms.find(r => r.id === roomId);
    if (!room) return;
    
    document.getElementById('ld-modal-phone').innerText = `+91 ${room.contact}`;
    document.getElementById('ld-modal-call-btn').href = `tel:${room.contact}`;
    
    const waMessage = `Hi! I found your property (${room.bhk} BHK in ${room.location}) on GangtokNest. I am interested to know more.`;
    document.getElementById('ld-modal-wa-btn').href = `https://wa.me/91${room.contact}?text=${encodeURIComponent(waMessage)}`;
    
    const aboutEl = document.getElementById('ld-modal-about');
    const aboutContainer = document.getElementById('ld-modal-about-container');
    if (aboutEl && aboutContainer) {
        // amenities is a text[] column in Supabase
        const aboutText = Array.isArray(room.amenities) ? room.amenities[0] : room.amenities;
        if (aboutText && aboutText.trim() !== '') {
            aboutEl.innerText = aboutText;
            aboutContainer.classList.remove('hidden');
        } else {
            aboutContainer.classList.add('hidden');
        }
    }
    
    document.getElementById('landlord-details-modal').classList.remove('hidden');
}

function closeLandlordDetails() {
    document.getElementById('landlord-details-modal').classList.add('hidden');
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
    const myRoomIds = landlordListings.filter(r => r.landlord_id === currentUserProfile?.id).map(r => r.id);
    const myVisits = visits.filter(v => myRoomIds.includes(v.room_id));
    
    if (myVisits.length === 0) {
        tbody.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    
    tbody.innerHTML = myVisits.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).map(v => {
        const room = landlordListings.find(r => r.id === v.room_id);
        const roomName = room ? `${room.bhk} BHK in ${room.location}` : 'Unknown Property';
        
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
                    <div class="font-bold text-on-surface">${escapeHtml(v.tenant_name || 'User')}</div>
                    <div class="text-[10px] text-on-surface-variant mt-0.5">ID: ${(v.tenant_id || '').substring(0,8)}</div>
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

