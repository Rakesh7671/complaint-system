// ===== SHARED UTILITIES =====

const API_BASE = '';

// Token management
function getToken() { return localStorage.getItem('grievease_token'); }
function saveToken(t) { localStorage.setItem('grievease_token', t); }
function removeToken() { localStorage.removeItem('grievease_token'); localStorage.removeItem('grievease_user'); }
function getUser() { try { return JSON.parse(localStorage.getItem('grievease_user')); } catch { return null; } }
function saveUser(u) { localStorage.setItem('grievease_user', JSON.stringify(u)); }

// API helper
async function apiFetch(url, options = {}) {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers };
    const res = await fetch(API_BASE + url, { ...options, headers });
    const data = await res.json().catch(() => ({ error: 'Unknown error' }));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
}
async function apiGet(url) { return apiFetch(url, { method: 'GET' }); }
async function apiPost(url, body) { return apiFetch(url, { method: 'POST', body: JSON.stringify(body) }); }
async function apiPatch(url, body) { return apiFetch(url, { method: 'PATCH', body: JSON.stringify(body) }); }

// Form data API (for file uploads)
async function apiPostForm(url, formData) {
    const token = getToken();
    const res = await fetch(API_BASE + url, {
        method: 'POST', body: formData,
        headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    const data = await res.json().catch(() => ({ error: 'Unknown error' }));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
}

// Auth guard
function requireAuth(allowedRoles = []) {
    const token = getToken();
    const user = getUser();
    if (!token || !user) { window.location.href = '/login.html'; return false; }
    if (allowedRoles.length && !allowedRoles.includes(user.role)) {
        window.location.href = user.role === 'student' ? '/student-dashboard.html' : '/admin-dashboard.html';
        return false;
    }
    return user;
}

// Toast notifications
function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toastContainer') || (() => {
        const el = document.createElement('div');
        el.id = 'toastContainer';
        el.className = 'toast-container';
        document.body.appendChild(el);
        return el;
    })();
    const icons = { success: 'fas fa-check-circle', error: 'fas fa-times-circle', info: 'fas fa-info-circle', warning: 'fas fa-exclamation-triangle' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="${icons[type] || icons.info} toast-icon"></i><span class="toast-message">${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.transition = 'opacity 0.3s, transform 0.3s';
        toast.style.opacity = '0'; toast.style.transform = 'translateX(100px)';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Format relative time
function timeAgo(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Status badge HTML
function statusBadge(status) {
    const map = { 'Pending': 'badge-pending', 'In Progress': 'badge-progress', 'Resolved': 'badge-resolved' };
    const icons = { 'Pending': 'fa-clock', 'In Progress': 'fa-spinner', 'Resolved': 'fa-check-circle' };
    return `<span class="badge ${map[status] || 'badge-pending'}"><i class="fas ${icons[status] || 'fa-circle'}"></i> ${status}</span>`;
}

// Priority badge HTML
function priorityBadge(priority) {
    const map = { 'High': 'badge-high', 'Medium': 'badge-medium', 'Low': 'badge-low' };
    const icons = { 'High': '🔴', 'Medium': '🟡', 'Low': '🟢' };
    return `<span class="badge ${map[priority] || 'badge-medium'}">${icons[priority] || '🟡'} ${priority}</span>`;
}

// Logout – clears local JWT AND Firebase session
async function logout() {
    removeToken();
    // Sign out of Firebase if the SDK is available
    try {
        const { initializeApp, getApps } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js");
        const { getAuth, signOut } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js");
        const firebaseConfig = {
            apiKey: "AIzaSyBTD_ZrX-SSd6eVNEWfaB98bHWSNKyRP-E",
            authDomain: "fir-demo-90f79.firebaseapp.com",
            projectId: "fir-demo-90f79",
            storageBucket: "fir-demo-90f79.firebasestorage.app",
            messagingSenderId: "388352631458",
            appId: "1:388352631458:web:400a5769ade1fcf3f4edfb"
        };
        const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
        await signOut(getAuth(app));
    } catch (_) { /* Firebase not critical for logout */ }
    showToast('Logged out successfully', 'info');
    setTimeout(() => window.location.href = '/login.html', 600);
}

// Initialize sidebar user chip
function initSidebar() {
    const user = getUser();
    if (!user) return;
    const nameEl = document.getElementById('sidebarUserName');
    const roleEl = document.getElementById('sidebarUserRole');
    const avatarEl = document.getElementById('sidebarAvatar');
    if (nameEl) nameEl.textContent = user.name;
    if (roleEl) roleEl.textContent = user.role.replace('_', ' ');
    if (avatarEl) avatarEl.textContent = user.name.charAt(0).toUpperCase();

    // Mobile hamburger
    const hamburger = document.getElementById('hamburger');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (hamburger && sidebar) {
        hamburger.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            overlay?.classList.toggle('visible');
        });
        overlay?.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('visible');
        });
    }
}

// Load notifications
async function loadNotifications() {
    try {
        const notifs = await apiGet('/api/auth/notifications');
        const badge = document.getElementById('notifCount');
        const list = document.getElementById('notifList');
        const unread = notifs.filter(n => !n.is_read);
        if (badge) {
            badge.textContent = unread.length;
            badge.style.display = unread.length > 0 ? 'inline-flex' : 'none';
        }
        if (list) {
            list.innerHTML = notifs.length === 0
                ? '<div class="empty-state" style="padding:24px;"><p>No notifications yet</p></div>'
                : notifs.map(n => `
          <div class="notif-item ${n.is_read ? '' : 'unread'}" onclick="markNotifRead(${n.id}, ${n.complaint_id})">
            <div class="notif-icon"><i class="fas fa-bell"></i></div>
            <div>
              <div class="notif-text">${n.message}</div>
              <div class="notif-time">${timeAgo(n.created_at)}</div>
            </div>
          </div>`).join('');
        }
    } catch { }
}

async function markNotifRead(id, complaintId) {
    try { await apiPatch(`/api/auth/notifications/${id}/read`, {}); } catch { }
    if (complaintId) window.location.href = `/complaint-detail.html?id=${complaintId}`;
    await loadNotifications();
}

async function markAllNotifRead() {
    try { await apiPatch('/api/auth/notifications/read-all', {}); showToast('All notifications marked as read', 'success'); await loadNotifications(); } catch { }
}

// Toggle notification panel
function toggleNotifPanel() {
    const panel = document.getElementById('notifPanel');
    if (panel) panel.classList.toggle('hidden');
}

document.addEventListener('click', (e) => {
    const panel = document.getElementById('notifPanel');
    const btn = document.getElementById('notifBtn');
    if (panel && !panel.contains(e.target) && btn && !btn.contains(e.target)) {
        panel.classList.add('hidden');
    }
});
