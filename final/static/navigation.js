// navigation.js - This should be included in ALL HTML files

// Global navigation state
let currentPage = 'dashboard';

// Set up navigation functionality
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const currentPath = window.location.pathname;
    
    // Determine current page based on URL
    if (currentPath.includes('/insights/')) {
        currentPage = 'insights';
    } else if (currentPath.includes('/tasks/')) {
        currentPage = 'tasks';
    } else if (currentPath.includes('/leaderboard/')) {
        currentPage = 'leaderboard';
    } else {
        currentPage = 'dashboard';
    }
    
    // Set active state for current page
    navItems.forEach(item => {
        const page = item.getAttribute('data-page');
        if (page === currentPage) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    // Add click handlers
    navItems.forEach(function(navItem) {
        navItem.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetPage = this.getAttribute('data-page');
            
            // Don't do anything if we're already on this page
            if (targetPage === currentPage) return;
            
            // Update current page
            currentPage = targetPage;
            
            // Navigate to the appropriate page using Django URLs
            switch(targetPage) {
                case 'dashboard':
                    window.location.href = '/';
                    break;
                case 'insights':
                    window.location.href = '/insights/';
                    break;
                case 'tasks':
                    window.location.href = '/tasks/';
                    break;
                case 'leaderboard':
                    window.location.href = '/leaderboard/';
                    break;
            }
        });
    });
}

// Initialize navigation when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    setupNavigation();
});