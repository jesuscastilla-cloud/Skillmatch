// Script para la página de conexiones

document.addEventListener('DOMContentLoaded', function() {

    if (!isAuthenticated()) {
        window.location.href = 'login-usuario.html';
        return;
    }

    setupTabs();
    loadMyConnections();
    loadPendingRequests();
    loadSuggestions();
});

function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            document.getElementById(this.getAttribute('data-tab')).classList.add('active');
        });
    });
}

function getCurrentUserId() {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    if (userData.id) return userData.id;
    try {
        const token = localStorage.getItem('token');
        if (token) {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.userId || null;
        }
    } catch (e) { /* token malformed */ }
    return null;
}

function updateTabCount(spanId, count) {
    const el = document.getElementById(spanId);
    if (el) el.textContent = count > 0 ? ` (${count})` : '';
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function avatarCircle(name) {
    const initial = name ? name.charAt(0).toUpperCase() : '?';
    return `<div class="connection-avatar-circle">${initial}</div>`;
}

// ─── Mis Conexiones ───────────────────────────────────────────────────────────

async function loadMyConnections() {
    const container = document.getElementById('connections-container');
    container.innerHTML = '<div class="loading-message">Cargando conexiones...</div>';

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/connections/my-connections`);
        if (response.ok) {
            const connections = await response.json();
            updateTabCount('connections-count', connections.length);
            displayConnections(connections);
        } else {
            container.innerHTML = '<div class="error-message">Error al cargar conexiones</div>';
        }
    } catch (error) {
        container.innerHTML = '<div class="error-message">Error al cargar conexiones</div>';
    }
}

function displayConnections(connections) {
    const container = document.getElementById('connections-container');
    const currentUserId = getCurrentUserId();

    if (!connections.length) {
        container.innerHTML = '<div class="no-results-message"><p>Aún no tienes conexiones. Explora las sugerencias.</p></div>';
        return;
    }

    container.innerHTML = connections.map(conn => {
        const isRequester = String(conn.userId) === String(currentUserId);
        const name     = isRequester ? conn.connectedUserName  : conn.userName;
        const headline = isRequester ? conn.connectedUserHeadline : conn.userHeadline;
        const otherId  = isRequester ? conn.connectedUserId    : conn.userId;
        const since    = conn.respondedAt
            ? new Date(conn.respondedAt).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })
            : '';

        return `
            <div class="connection-card">
                <div class="connection-header">
                    ${avatarCircle(name)}
                    <div class="connection-info">
                        <h3>${name || 'Usuario'}</h3>
                        <p class="connection-type">${headline || ''}</p>
                        <p class="connection-time">${since ? 'Desde ' + since : 'Conectado'}</p>
                    </div>
                    <div class="connection-actions">
                        <button class="btn btn-primary btn-small" onclick="goToMessages('${otherId}')"><i data-ico="chat"></i> Mensaje</button>
                        <button class="btn btn-secondary btn-small" onclick="viewProfile('${otherId}')">Ver Perfil</button>
                    </div>
                </div>
                ${conn.message ? `<div class="connection-body"><p class="connection-note">${conn.message}</p></div>` : ''}
            </div>`;
    }).join('');
}

// ─── Solicitudes Pendientes ───────────────────────────────────────────────────

async function loadPendingRequests() {
    const container = document.getElementById('requests-container');
    container.innerHTML = '<div class="loading-message">Cargando solicitudes...</div>';

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/connections/pending-requests`);
        if (response.ok) {
            const requests = await response.json();
            updateTabCount('requests-count', requests.length);
            displayRequests(requests);
        } else {
            container.innerHTML = '<div class="error-message">Error al cargar solicitudes</div>';
        }
    } catch (error) {
        container.innerHTML = '<div class="error-message">Error al cargar solicitudes</div>';
    }
}

function displayRequests(requests) {
    const container = document.getElementById('requests-container');

    if (!requests.length) {
        container.innerHTML = '<div class="no-results-message"><p>No tienes solicitudes pendientes</p></div>';
        return;
    }

    container.innerHTML = requests.map(req => {
        const date = req.requestedAt
            ? new Date(req.requestedAt).toLocaleDateString('es-ES')
            : '';

        return `
            <div class="connection-card">
                <div class="connection-header">
                    ${avatarCircle(req.userName)}
                    <div class="connection-info">
                        <h3>${req.userName || 'Usuario'}</h3>
                        <p class="connection-type">${req.userHeadline || ''}</p>
                        <p class="connection-time">${date}</p>
                    </div>
                    <div class="connection-actions">
                        <button class="btn btn-primary btn-small" onclick="acceptConnection('${req.id}')"><i data-ico="check"></i> Aceptar</button>
                        <button class="btn btn-secondary btn-small" onclick="rejectConnection('${req.id}')"><i data-ico="close"></i> Rechazar</button>
                    </div>
                </div>
                ${req.message ? `<div class="connection-body"><p class="connection-note">"${req.message}"</p></div>` : ''}
            </div>`;
    }).join('');
}

// ─── Sugerencias ─────────────────────────────────────────────────────────────

async function loadSuggestions() {
    const container = document.getElementById('suggestions-container');
    container.innerHTML = '<div class="loading-message">Cargando sugerencias...</div>';

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/connections/suggestions`);
        if (response.ok) {
            const suggestions = await response.json();
            displaySuggestions(suggestions);
        } else {
            container.innerHTML = '<div class="error-message">Error al cargar sugerencias</div>';
        }
    } catch (error) {
        container.innerHTML = '<div class="error-message">Error al cargar sugerencias</div>';
    }
}

function displaySuggestions(suggestions) {
    const container = document.getElementById('suggestions-container');

    if (!suggestions.length) {
        container.innerHTML = '<div class="no-results-message"><p>No hay sugerencias disponibles</p></div>';
        return;
    }

    container.innerHTML = suggestions.map(user => {
        const name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
        const skills = user.skills ? user.skills.slice(0, 3).join(', ') : '';

        return `
            <div class="suggestion-card">
                <div class="suggestion-header">
                    ${avatarCircle(user.firstName)}
                    <div class="suggestion-info">
                        <h3>${name || 'Usuario'}</h3>
                        <p class="suggestion-category">${user.headline || ''}</p>
                        ${skills ? `<p class="suggestion-reason"><i data-ico="target"></i> ${skills}</p>` : ''}
                    </div>
                </div>
                <div class="suggestion-actions">
                    <button class="btn btn-primary btn-small" onclick="sendConnectionRequest('${user.id}')"><i data-ico="handshake"></i> Conectar</button>
                    <button class="btn btn-secondary btn-small" onclick="viewProfile('${user.id}')">Ver Perfil</button>
                </div>
            </div>`;
    }).join('');
}

// ─── Acciones ────────────────────────────────────────────────────────────────

async function sendConnectionRequest(userId) {
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/connections`, {
            method: 'POST',
            body: JSON.stringify({ connectedUserId: userId, message: '¡Me gustaría conectar contigo!' })
        });
        if (response.ok) {
            showToast('<i data-ico="check"></i> Solicitud enviada');
            loadSuggestions();
        } else {
            const err = await response.json().catch(() => ({}));
            showToast(err.message || 'Error al enviar solicitud', 'error');
        }
    } catch (error) {
        showToast('Error al enviar solicitud', 'error');
    }
}

async function acceptConnection(connectionId) {
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/connections/${connectionId}/accept`, { method: 'PATCH' });
        if (response.ok) {
            showToast('<i data-ico="check"></i> Conexión aceptada');
            loadPendingRequests();
            loadMyConnections();
        } else {
            showToast('Error al aceptar conexión', 'error');
        }
    } catch (error) {
        showToast('Error al aceptar conexión', 'error');
    }
}

async function rejectConnection(connectionId) {
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/connections/${connectionId}/reject`, { method: 'PATCH' });
        if (response.ok) {
            showToast('Solicitud rechazada');
            loadPendingRequests();
        } else {
            showToast('Error al rechazar solicitud', 'error');
        }
    } catch (error) {
        showToast('Error al rechazar solicitud', 'error');
    }
}

function viewProfile(userId) {
    window.location.href = `perfil-usuario.html?id=${userId}`;
}

function goToMessages(userId) {
    window.location.href = `mensajes.html?userId=${userId}`;
}
