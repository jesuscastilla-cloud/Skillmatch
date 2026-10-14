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

// ?tab= en la direccion. La notificacion de una solicitud llega con
// "?tab=pending" (nombre del backend) y antes se abria siempre "Mis conexiones".
// Las demas usan el nombre de la pestana: ?tab=solicitudes, ?tab=sugerencias...
const PESTANA_PRIMERA = 'mis-conexiones';
const PESTANAS_DEL_BACKEND = { pending: 'solicitudes' };

function setupTabs() {
    const tabBtns = [...document.querySelectorAll('.tab-btn')];

    tabBtns.forEach((btn, i) => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-tab');
            abrirPestana(id);
            // La direccion recuerda la pestana: al recargar o volver, sigue ahi
            const direccion = new URL(window.location.href);
            if (id === PESTANA_PRIMERA) direccion.searchParams.delete('tab'); else direccion.searchParams.set('tab', id);
            direccion.searchParams.delete('solicitud');
            history.replaceState(null, '', direccion);
        });
        // Flechas para pasar de una pestana a otra (lo que espera un lector de pantalla)
        btn.addEventListener('keydown', e => {
            const paso = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
            const destino = paso ? tabBtns[(i + paso + tabBtns.length) % tabBtns.length]
                : e.key === 'Home' ? tabBtns[0] : e.key === 'End' ? tabBtns[tabBtns.length - 1] : null;
            if (!destino) return;
            e.preventDefault();
            destino.focus();
            destino.click();
        });
    });

    const tab = new URLSearchParams(window.location.search).get('tab') || '';
    const pedida = PESTANAS_DEL_BACKEND[tab] || tab;
    abrirPestana(tabBtns.some(b => b.getAttribute('data-tab') === pedida) ? pedida : PESTANA_PRIMERA);
}

function abrirPestana(id) {
    document.querySelectorAll('.tab-btn').forEach(b => {
        const activa = b.getAttribute('data-tab') === id;
        b.classList.toggle('active', activa);
        b.setAttribute('aria-selected', activa ? 'true' : 'false');
        b.tabIndex = activa ? 0 : -1;
    });
    document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === id));
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

// Usa los avisos de ui.js (ya traen su icono). Antes se escribia con
// textContent y el "<i data-ico...>" del mensaje salia como texto.
function showToast(message, type = 'success') {
    const texto = message.replace(/<i [^>]*><\/i>\s*/g, '');
    if (window.SkillMatchUI) {
        SkillMatchUI.aviso(texto, type === 'error' || type === 'info' ? type : 'ok');
        return;
    }
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = texto;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function avatarCircle(name) {
    const initial = name ? name.charAt(0).toUpperCase() : '?';
    return `<div class="connection-avatar-circle">${escaparHtml(initial)}</div>`;
}

// ─── Mis conexiones ───────────────────────────────────────────────────────────

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
                        <h3>${escaparHtml(name || 'Usuario')}</h3>
                        <p class="connection-type">${escaparHtml(headline)}</p>
                        <p class="connection-time">${since ? 'Desde ' + since : 'Conectado'}</p>
                    </div>
                    <div class="connection-actions">
                        <button class="btn btn-primary btn-small" onclick="goToMessages('${otherId}')"><i data-ico="chat"></i> Mensaje</button>
                        <button class="btn btn-secondary btn-small" onclick="viewProfile('${otherId}')">Ver perfil</button>
                    </div>
                </div>
                ${conn.message ? `<div class="connection-body"><p class="connection-note">${escaparHtml(conn.message)}</p></div>` : ''}
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
            marcarSolicitudPedida(requests);
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
            <div class="connection-card" data-solicitud="${escaparHtml(req.id)}">
                <div class="connection-header">
                    ${avatarCircle(req.userName)}
                    <div class="connection-info">
                        <h3>${escaparHtml(req.userName || 'Usuario')}</h3>
                        <p class="connection-type">${escaparHtml(req.userHeadline)}</p>
                        <p class="connection-time">${date}</p>
                    </div>
                    <div class="connection-actions">
                        <button class="btn btn-primary btn-small" onclick="acceptConnection('${req.id}')"><i data-ico="check"></i> Aceptar</button>
                        <button class="btn btn-secondary btn-small" onclick="rejectConnection('${req.id}')"><i data-ico="close"></i> Rechazar</button>
                    </div>
                </div>
                ${req.message ? `<div class="connection-body"><p class="connection-note">"${escaparHtml(req.message)}"</p></div>` : ''}
            </div>`;
    }).join('');
}

// La notificacion de una solicitud trae cual es (?solicitud=): se marca. Solo
// la primera vez: despues de aceptar o rechazar, la lista se vuelve a pintar
let solicitudPedida = new URLSearchParams(window.location.search).get('solicitud');
function marcarSolicitudPedida(requests) {
    if (!solicitudPedida) return;
    const pedida = solicitudPedida;
    solicitudPedida = null;
    if (!requests.some(r => String(r.id) === pedida)) {
        showToast('Esa solicitud ya fue respondida.', 'info');
        return;
    }
    const tarjeta = [...document.querySelectorAll('#requests-container [data-solicitud]')].find(t => t.dataset.solicitud === pedida);
    if (tarjeta && window.SkillMatchUI) SkillMatchUI.resaltar(tarjeta);
}

// ─── Sugerencias ─────────────────────────────────────────────────────────────

// Personas a las que ya se les envio solicitud (el backend las sigue sugiriendo)
let sentRequestIds = new Set();

// Minusculas y sin tildes, para comparar habilidades y ciudades
function normalizar(nombre) {
    return String(nombre || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Pide un recurso y, si falla, devuelve el valor por defecto sin romper lo demas
async function getJsonOr(url, porDefecto) {
    try {
        const r = await fetchWithAuth(url);
        return r.ok ? await r.json() : porDefecto;
    } catch (e) {
        return porDefecto;
    }
}

async function loadSuggestions() {
    const container = document.getElementById('suggestions-container');
    container.innerHTML = '<div class="loading-message">Cargando sugerencias...</div>';

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/connections/suggestions`);
        if (response.ok) {
            const suggestions = await response.json();
            // Lo propio para explicar cada sugerencia: ciudad, habilidades y
            // solicitudes ya enviadas (si algo falla, la tarjeta sale sin ese dato)
            const yo = getCurrentUserId();
            const [perfil, misHabilidades, enviadas] = await Promise.all([
                getJsonOr(`${API_BASE_URL}/users/${yo}`, {}),
                getJsonOr(`${API_BASE_URL}/users/${yo}/skills`, []),
                getJsonOr(`${API_BASE_URL}/connections/sent-requests`, [])
            ]);
            sentRequestIds = new Set(enviadas.map(r => String(r.connectedUserId)));
            displaySuggestions(suggestions, {
                ciudad: perfil.location || '',
                habilidades: new Set(misHabilidades.map(s => normalizar(s.name)))
            });
        } else {
            container.innerHTML = '<div class="error-message">Error al cargar sugerencias</div>';
        }
    } catch (error) {
        container.innerHTML = '<div class="error-message">Error al cargar sugerencias</div>';
    }
}

function displaySuggestions(suggestions, yo = { ciudad: '', habilidades: new Set() }) {
    const container = document.getElementById('suggestions-container');

    if (!suggestions.length) {
        container.innerHTML = '<div class="no-results-message"><p>No hay sugerencias disponibles</p></div>';
        return;
    }

    // Cada habilidad llega como objeto {name, level}: unirlas directo
    // escribia "[object Object]"
    const tarjetas = suggestions.map(user => {
        const habilidades = (user.skills || []).map(s => (s && s.name) || s).filter(Boolean);
        const comunes = habilidades.filter(h => yo.habilidades.has(normalizar(h)));
        return { user, habilidades, comunes };
    });
    // Primero quienes comparten mas habilidades contigo
    tarjetas.sort((a, b) => b.comunes.length - a.comunes.length);

    container.innerHTML = tarjetas.map(({ user, habilidades, comunes }) => {
        const name = `${user.firstName || ''} ${user.lastName || ''}`.trim();

        // Por que se sugiere: misma ciudad y habilidades en comun
        const motivos = [];
        if (yo.ciudad && normalizar(user.location) === normalizar(yo.ciudad)) {
            motivos.push(`<span><i data-ico="pin"></i> También en ${escaparHtml(user.location)}</span>`);
        }
        if (comunes.length) {
            motivos.push(`<span><i data-ico="target"></i> ${comunes.length} ${comunes.length === 1 ? 'habilidad' : 'habilidades'} en común</span>`);
        }

        // Las comunes primero y marcadas; maximo 4 para que la tarjeta no crezca
        const enComun = new Set(comunes);
        const chips = [...comunes, ...habilidades.filter(h => !enComun.has(h))].slice(0, 4)
            .map(h => `<span class="skill${enComun.has(h) ? ' is-common' : ''}">${enComun.has(h) ? '<i data-ico="check"></i>' : ''}${escaparHtml(h)}</span>`)
            .join('');

        const enviada = sentRequestIds.has(String(user.id));
        const conectar = enviada
            ? `<button class="btn btn-secondary btn-small btn-estado" disabled><i data-ico="clock"></i> Solicitud enviada</button>`
            : `<button class="btn btn-primary btn-small" onclick="sendConnectionRequest('${user.id}', this)"><i data-ico="handshake"></i> Conectar</button>`;

        return `
            <div class="suggestion-card">
                <div class="suggestion-header">
                    ${avatarCircle(user.firstName)}
                    <div class="suggestion-info">
                        <h3>${escaparHtml(name || 'Usuario')}</h3>
                        ${user.headline ? `<p class="suggestion-headline">${escaparHtml(user.headline)}</p>` : ''}
                    </div>
                </div>
                ${motivos.length ? `<p class="suggestion-reason">${motivos.join('')}</p>` : ''}
                ${chips ? `<div class="card-skills">${chips}</div>` : ''}
                <div class="suggestion-actions">
                    ${conectar}
                    <button class="btn btn-secondary btn-small" onclick="viewProfile('${user.id}')">Ver perfil</button>
                </div>
            </div>`;
    }).join('');
}

// ─── Acciones ────────────────────────────────────────────────────────────────

async function sendConnectionRequest(userId, boton) {
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/connections`, {
            method: 'POST',
            // Sin mensaje inventado: antes se mandaba siempre "¡Me gustaría conectar
            // contigo!" y la otra persona lo veia como si lo hubieras escrito tu
            body: JSON.stringify({ connectedUserId: userId })
        });
        if (response.ok) {
            showToast('<i data-ico="check"></i> Solicitud enviada');
            // Antes se recargaba la lista y la misma persona volvia a salir con
            // "Conectar"; ahora el boton cambia en su sitio
            sentRequestIds.add(String(userId));
            if (boton) {
                boton.outerHTML = '<button class="btn btn-secondary btn-small btn-estado" disabled><i data-ico="clock"></i> Solicitud enviada</button>';
            } else {
                loadSuggestions();
            }
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
