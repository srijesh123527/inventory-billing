// ============================================================================
// api.js — Centralized API Client, Authentication & UI Framework
// ============================================================================

// Centralized API Base URL Configuration (Production & Vercel friendly)
const API_BASE = '/api';

// ============================================================================
// Centralized API Fetch Wrapper
// ============================================================================
async function apiFetch(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;

    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };

    // Attach JWT Bearer token if present
    const token = sessionStorage.getItem('invflow_token') || localStorage.getItem('invflow_token');
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
        ...options,
        headers
    };

    try {
        const response = await fetch(url, config);

        // Handle Session Expiry / Unauthorized
        if (response.status === 401) {
            sessionStorage.removeItem('invflow_token');
            sessionStorage.removeItem('invflow_user');
            sessionStorage.removeItem('auth');
            if (!window.location.pathname.endsWith('login.html') && window.location.pathname !== '/') {
                showToast('Session expired. Please sign in again.', 'warning');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 1200);
            }
            throw new Error('Authentication required');
        }

        const data = await response.json().catch(() => null);

        if (!response.ok) {
            const errorMsg = (data && data.message) || `Request failed with status ${response.status}`;
            throw new Error(errorMsg);
        }

        return data;
    } catch (err) {
        console.error(`API Error [${endpoint}]:`, err);
        throw err;
    }
}

// ============================================================================
// Authentication & Session Guard
// ============================================================================

function setAuthSession(token, user) {
    sessionStorage.setItem('invflow_token', token);
    sessionStorage.setItem('invflow_user', JSON.stringify(user || { username: 'admin' }));
    sessionStorage.setItem('auth', 'true');
}

function getAuthUser() {
    try {
        const userStr = sessionStorage.getItem('invflow_user');
        return userStr ? JSON.parse(userStr) : { username: 'Admin', role: 'Super Admin' };
    } catch (e) {
        return { username: 'Admin', role: 'Super Admin' };
    }
}

function requireAuth() {
    const isAuth = sessionStorage.getItem('auth') || sessionStorage.getItem('invflow_token');
    if (!isAuth) {
        window.location.href = 'login.html';
    }
}

function checkAlreadyLogged() {
    const isAuth = sessionStorage.getItem('auth') || sessionStorage.getItem('invflow_token');
    if (isAuth) {
        window.location.href = 'index.html';
    }
}

function logout() {
    sessionStorage.removeItem('invflow_token');
    sessionStorage.removeItem('invflow_user');
    sessionStorage.removeItem('auth');
    localStorage.removeItem('invflow_token');
    showToast('Signed out successfully', 'info');
    setTimeout(() => {
        window.location.href = 'login.html';
    }, 400);
}

// ============================================================================
// Toast Notification System
// Types: 'success', 'error', 'warning', 'info'
// ============================================================================
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

function showMessage(message, type = 'success') {
    showToast(message, type);
}

// ============================================================================
// Accessible Modal Controller
// ============================================================================
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

// Attach event listeners for backdrop clicks, close buttons, and Esc key
document.addEventListener('DOMContentLoaded', () => {
    // Backdrop click close
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    });

    // Close button triggers
    document.querySelectorAll('.modal-close-btn, .btn-modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal-overlay');
            if (modal) {
                modal.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    });

    // Esc key trigger
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay.active').forEach(m => {
                m.classList.remove('active');
                document.body.style.overflow = '';
            });
        }
    });

    // UI Helpers
    syncTopbarDate();
    highlightActiveNav();
    syncUserInfo();
});

// ============================================================================
// Mobile Drawer & Sidebar Navigation
// ============================================================================
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

// ============================================================================
// Formatting & XSS Helpers
// ============================================================================
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

function formatDateTime(dateString) {
    if (!dateString) return '—';
    try {
        const d = new Date(dateString);
        return d.toLocaleString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
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

function syncUserInfo() {
    const user = getAuthUser();
    const avatarEl = document.querySelector('.user-avatar');
    const nameEl = document.querySelector('.user-name');
    const roleEl = document.querySelector('.user-role');

    if (nameEl && user && user.username) {
        nameEl.innerText = user.username.charAt(0).toUpperCase() + user.username.slice(1);
    }
    if (avatarEl && user && user.username) {
        avatarEl.innerText = user.username.slice(0, 2).toUpperCase();
    }
    if (roleEl && user && user.role) {
        roleEl.innerText = user.role;
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

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
