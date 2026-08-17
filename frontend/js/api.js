// ==========================================================================
// api.js - Core Utilities, Authentication, Navigation & SaaS UI Helpers
// ==========================================================================

const API_BASE = '/api';

// Authentication Check
function requireAuth() {
    const isAuth = sessionStorage.getItem('auth');
    if (!isAuth) {
        window.location.href = '/';
    }
}

// Redirect if already logged in
function checkAlreadyLogged() {
    const isAuth = sessionStorage.getItem('auth');
    if (isAuth) {
        window.location.href = '/index.html';
    }
}

// Logout functionality
function logout() {
    sessionStorage.removeItem('auth');
    window.location.href = '/';
}

// ==========================================================================
// Toast Notification System
// Types: 'success', 'error', 'warning', 'info'
// ==========================================================================
function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let iconText = '✓';
    if (type === 'error') iconText = '✕';
    if (type === 'warning') iconText = '⚠';
    if (type === 'info') iconText = 'ℹ';

    toast.innerHTML = `
        <div class="toast-icon">${iconText}</div>
        <div class="toast-message">${escapeHtml(message)}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3500);
}

// Alias for compatibility
function showMessage(message, type = 'success') {
    showToast(message, type);
}

// ==========================================================================
// Modal Handlers
// ==========================================================================
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Close on backdrop click and Esc key
document.addEventListener('DOMContentLoaded', () => {
    // Backdrop close
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    });

    // Close buttons with .modal-close-btn
    document.querySelectorAll('.modal-close-btn, .btn-modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal-overlay');
            if (modal) {
                modal.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    });

    // Esc key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay.active').forEach(m => {
                m.classList.remove('active');
                document.body.style.overflow = '';
            });
        }
    });

    // Sync Topbar Date & Active Navigation
    syncTopbarDate();
    highlightActiveNav();
});

// ==========================================================================
// Mobile Sidebar Toggle
// ==========================================================================
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    let overlay = document.querySelector('.sidebar-overlay');
    
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        document.body.appendChild(overlay);
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('mobile-active');
            overlay.classList.remove('active');
        });
    }

    if (sidebar) {
        sidebar.classList.toggle('mobile-active');
        overlay.classList.toggle('active', sidebar.classList.contains('mobile-active'));
    }
}

// ==========================================================================
// Currency & Date Formatters
// ==========================================================================
function formatCurrency(amount) {
    const num = Number(amount) || 0;
    return '₹' + num.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatDate(dateString) {
    if (!dateString) return '—';
    try {
        const d = new Date(dateString);
        return d.toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch (e) {
        return dateString;
    }
}

function syncTopbarDate() {
    const dateChip = document.getElementById('currentDateDisplay');
    if (dateChip) {
        const now = new Date();
        const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
        dateChip.innerText = now.toLocaleDateString('en-US', options);
    }
}

function highlightActiveNav() {
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPath || (currentPath === '' && href === 'index.html')) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

// HTML Escaper for XSS Prevention
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
