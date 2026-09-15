// Sistema de notificaciones global

let notificationsInterval = null;
let notificationsAbortController = null;

// Inicializar sistema de notificaciones
function initNotifications() {
    if (!isAuthenticated()) return;

    createNotificationsDropdown();
    loadNotifications();

    notificationsInterval = setInterval(loadNotifications, 30000);
    setupNotificationListeners();

    // Pause polling when tab is hidden, resume when visible again
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            clearInterval(notificationsInterval);
            notificationsInterval = null;
            if (notificationsAbortController) {
                notificationsAbortController.abort();
                notificationsAbortController = null;
            }
        } else {
            loadNotifications();
            notificationsInterval = setInterval(loadNotifications, 30000);
        }
    });
}

// Crear dropdown de notificaciones
function createNotificationsDropdown() {
    // Verificar si ya existe
    if (document.getElementById('notificationsDropdown')) return;
    
    // Buscar el botón de usuario
    const userNav = document.querySelector('.user-nav, nav > ul.nav-links');
    if (!userNav) return;
    
    // Crear estructura de notificaciones
    const notificationsHTML = `
        <li class="nav-notification-item">
            <div class="notifications-container">
                <button class="notifications-btn" id="notificationsBtn">
                    <i data-ico="bell"></i>
                    <span class="notifications-badge" id="notificationsBadge" style="display: none;">0</span>
                </button>
                <div class="notifications-dropdown" id="notificationsDropdown" style="display: none;">
                    <div class="notifications-header">
                        <h3><i data-ico="bell"></i> Notificaciones</h3>
                        <button class="btn-mark-all-read" id="markAllReadBtn">Marcar todas como leídas</button>
                    </div>
                    <div class="notifications-list" id="notificationsList">
                        <div class="loading-message">Cargando...</div>
                    </div>
                    <div class="notifications-footer">
                        <a href="#" id="viewAllNotificationsBtn">Ver todas</a>
                    </div>
                </div>
            </div>
        </li>
    `;
    
    // Insertar antes del menú de usuario
    const userMenu = userNav.querySelector('.user-menu, li:last-child');
    if (userMenu) {
        userMenu.insertAdjacentHTML('beforebegin', notificationsHTML);
    } else {
        userNav.insertAdjacentHTML('beforeend', notificationsHTML);
    }
}

// Configurar listeners
function setupNotificationListeners() {
    const notificationsBtn = document.getElementById('notificationsBtn');
    const notificationsDropdown = document.getElementById('notificationsDropdown');
    const markAllReadBtn = document.getElementById('markAllReadBtn');
    
    if (notificationsBtn) {
        notificationsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = notificationsDropdown.style.display === 'block';
            notificationsDropdown.style.display = isVisible ? 'none' : 'block';
            
            if (!isVisible) {
                loadNotifications();
            }
        });
    }
    
    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', markAllAsRead);
    }
    
    // Cerrar dropdown al hacer clic fuera
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.notifications-container')) {
            if (notificationsDropdown) {
                notificationsDropdown.style.display = 'none';
            }
        }
    });
}

// Cargar notificaciones
async function loadNotifications() {
    if (!isAuthenticated()) return;

    if (notificationsAbortController) {
        notificationsAbortController.abort();
    }
    notificationsAbortController = new AbortController();
    const signal = notificationsAbortController.signal;

    try {
        const countResponse = await fetchWithAuth(`${API_BASE_URL}/notifications/count`, { signal });
        if (countResponse.ok) {
            const count = await countResponse.json();
            updateNotificationBadge(count);
        }

        const response = await fetchWithAuth(`${API_BASE_URL}/notifications/unread`, { signal });
        if (response.ok) {
            const notifications = await response.json();
            displayNotifications(notifications);
        }
    } catch (error) {
        if (error.name !== 'AbortError') throw error;
    }
}

// Actualizar badge
function updateNotificationBadge(count) {
    const badge = document.getElementById('notificationsBadge');
    if (!badge) return;
    
    if (count > 0) {
        badge.textContent = count > 9 ? '9+' : count;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

// Mostrar notificaciones
function displayNotifications(notifications) {
    const container = document.getElementById('notificationsList');
    if (!container) return;
    
    if (notifications.length === 0) {
        container.innerHTML = '<div class="no-notifications">No tienes notificaciones nuevas</div>';
        return;
    }
    
    container.innerHTML = notifications.slice(0, 5).map(notif => {
        const icon = getNotificationIcon(notif.type);
        const time = formatNotificationTime(notif.createdAt);
        
        return `
            <div class="notification-item ${notif.isRead ? 'read' : 'unread'}" data-id="${notif.id}" onclick="handleNotificationClick('${notif.id}', '${notif.actionUrl || ''}')">
                <div class="notification-icon">${icon}</div>
                <div class="notification-content">
                    <p class="notification-message">${notif.message}</p>
                    <span class="notification-time">${time}</span>
                </div>
            </div>
        `;
    }).join('');
}

// Obtener icono según tipo
function getNotificationIcon(type) {
    const icons = {
        'connection_request': '<i data-ico="handshake"></i>',
        'connection_accepted': '<i data-ico="check"></i>',
        'message': '<i data-ico="chat"></i>',
        'application_update': '<i data-ico="list"></i>',
        'new_job': '<i data-ico="briefcase"></i>',
        'application_received': '<i data-ico="mail"></i>'
    };
    return icons[type] || '<i data-ico="bell"></i>';
}

// Formatear tiempo
function formatNotificationTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffMinutes = Math.ceil(diffTime / (1000 * 60));
    const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffMinutes < 60) return `Hace ${diffMinutes}m`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

// Manejar clic en notificación
async function handleNotificationClick(notificationId, actionUrl) {
    // Marcar como leída
    try {
        await fetchWithAuth(`${API_BASE_URL}/notifications/${notificationId}/read`, {
            method: 'PATCH'
        });
        
        // Actualizar UI
        loadNotifications();
        
        // Navegar si hay URL
        if (actionUrl && actionUrl !== 'null') {
            window.location.href = actionUrl;
        }
    } catch (error) {
    }
}

// Marcar todas como leídas
async function markAllAsRead() {
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/notifications/read-all`, {
            method: 'PATCH'
        });
        
        if (response.ok) {
            loadNotifications();
        }
    } catch (error) {
    }
}

// Limpiar al salir
function cleanupNotifications() {
    if (notificationsInterval) {
        clearInterval(notificationsInterval);
        notificationsInterval = null;
    }
}

// Auto-inicializar si hay token
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNotifications);
} else {
    initNotifications();
}

// Limpiar al salir de la página
window.addEventListener('beforeunload', cleanupNotifications);
