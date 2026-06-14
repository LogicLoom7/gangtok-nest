let analyticsChartInstance = null;

function renderAnalyticsChart() {
    // Generate dummy data based on active listings
    const totalListings = landlordListings.filter(r => r.landlord_id === currentUserProfile?.id).length || 2;
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
