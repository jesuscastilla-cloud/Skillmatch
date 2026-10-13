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
                <button type="button" class="notifications-btn" id="notificationsBtn" aria-label="Notificaciones" aria-expanded="false" aria-controls="notificationsDropdown">
                    <i data-ico="bell"></i>
                    <span class="notifications-badge" id="notificationsBadge" style="display: none;" aria-hidden="true">0</span>
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
                        <button type="button" id="viewAllNotificationsBtn">Ver todas</button>
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
            mostrarNotificaciones(!isVisible);
        });
    }

    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', markAllAsRead);
    }

    // "Ver todas": antes era un enlace a "#" que no llevaba a ningun lado.
    // Ahora cambia la lista entre las nuevas y todas (tambien las ya leidas).
    const verTodas = document.getElementById('viewAllNotificationsBtn');
    if (verTodas) {
        verTodas.addEventListener('click', () => {
            verTodasLasNotificaciones = !verTodasLasNotificaciones;
            verTodas.textContent = verTodasLasNotificaciones ? 'Ver solo las nuevas' : 'Ver todas';
            loadNotifications();
        });
    }

    // Cada aviso lleva a su pagina. Antes era un onclick en un <div>: con el
    // teclado no se podia abrir
    const lista = document.getElementById('notificationsList');
    if (lista) {
        lista.addEventListener('click', e => abrirNotificacion(e.target.closest('.notification-item')));
        lista.addEventListener('keydown', e => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            const item = e.target.closest('.notification-item');
            if (!item) return;
            e.preventDefault();
            abrirNotificacion(item);
        });
    }

    // Cerrar dropdown al hacer clic fuera o con Escape
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.notifications-container')) mostrarNotificaciones(false);
    });
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape' || !notificationsDropdown || notificationsDropdown.style.display !== 'block') return;
        mostrarNotificaciones(false);
        notificationsBtn.focus();
    });
}

let verTodasLasNotificaciones = false;

function mostrarNotificaciones(si) {
    const dropdown = document.getElementById('notificationsDropdown');
    const boton = document.getElementById('notificationsBtn');
    if (!dropdown) return;
    dropdown.style.display = si ? 'block' : 'none';
    if (boton) boton.setAttribute('aria-expanded', si ? 'true' : 'false');
    if (si) loadNotifications();
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
            // El backend manda {count: 6}. Antes se comparaba el objeto entero
            // con 0 y el numero de la campana no salia nunca
            const datos = await countResponse.json();
            updateNotificationBadge(Number(datos && typeof datos === 'object' ? datos.count : datos) || 0);
        }

        const ruta = verTodasLasNotificaciones ? '/notifications' : '/notifications/unread';
        const response = await fetchWithAuth(`${API_BASE_URL}${ruta}`, { signal });
        if (response.ok) {
            const notifications = await response.json();
            displayNotifications(notifications);
        }
    } catch (error) {
        // Sin conexion: se intenta otra vez en el proximo ciclo (antes el error
        // quedaba sin atrapar y llenaba la consola cada 30 segundos)
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
    // El numero se ve pero un lector de pantalla no lo lee: va en el nombre del boton
    const boton = document.getElementById('notificationsBtn');
    if (boton) boton.setAttribute('aria-label', count > 0 ? `Notificaciones, ${count} sin leer` : 'Notificaciones');
}

// Mostrar notificaciones
function displayNotifications(notifications) {
    const container = document.getElementById('notificationsList');
    if (!container) return;
    
    if (notifications.length === 0) {
        container.innerHTML = `<div class="no-notifications">${verTodasLasNotificaciones ? 'Todavía no tienes notificaciones' : 'No tienes notificaciones nuevas'}</div>`;
        return;
    }

    // Las nuevas: las 5 primeras. Todas: hasta 30 (la lista tiene scroll)
    container.innerHTML = notifications.slice(0, verTodasLasNotificaciones ? 30 : 5).map(notif => {
        const icon = getNotificationIcon(notif.type);
        const time = formatNotificationTime(notif.createdAt);
        const destino = destinoNotificacion(notif);

        return `
            <div class="notification-item ${notif.isRead ? 'read' : 'unread'}" data-id="${escaparHtml(notif.id)}" data-destino="${escaparHtml(destino)}" role="link" tabindex="0">
                <div class="notification-icon">${icon}</div>
                <div class="notification-content">
                    <p class="notification-message">${escaparHtml(notif.content || notif.message || '')}</p>
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

// Que solicitud o postulacion anuncia cada tipo de aviso: la pagina de destino
// la busca con este dato y la marca (SkillMatchUI.resaltar)
const DATO_DE_NOTIFICACION = {
    connection_request: 'solicitud',
    application_received: 'postulacion',
    application_update: 'postulacion'
};

// A donde lleva un aviso. El backend manda "/pages/conexiones.html?tab=pending":
// todas las paginas estan en la misma carpeta, asi que se usa la ruta relativa
// (con "/pages/" fallaba en Live Server, donde la carpeta es otra). Solo se
// aceptan paginas de este mismo sitio.
function destinoNotificacion(notif) {
    if (!notif.actionUrl || notif.actionUrl === 'null') return '';
    try {
        const url = new URL(notif.actionUrl.replace(/^\/?pages\//, ''), window.location.href);
        if (url.origin !== window.location.origin) return '';
        const dato = DATO_DE_NOTIFICACION[notif.type];
        if (dato && notif.relatedId) url.searchParams.set(dato, notif.relatedId);
        return url.pathname.split('/').pop() + url.search;
    } catch (e) {
        return '';
    }
}

function abrirNotificacion(item) {
    if (item) handleNotificationClick(item.dataset.id, item.dataset.destino);
}

// Manejar clic en notificación
async function handleNotificationClick(notificationId, destino) {
    // Marcar como leida. keepalive: la peticion termina aunque la pagina cambie
    const marcar = fetchWithAuth(`${API_BASE_URL}/notifications/${encodeURIComponent(notificationId)}/read`, {
        method: 'PATCH',
        keepalive: true
    }).catch(() => { /* sin conexion: se ira igual a la pagina */ });

    // Antes, si fallaba marcarla como leida, el clic no llevaba a ningun lado
    if (destino) {
        window.location.href = destino;
        return;
    }
    await marcar;
    loadNotifications();
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
