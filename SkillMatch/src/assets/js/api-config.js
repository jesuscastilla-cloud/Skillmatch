/* =====================================================================
 *  SkillMatch - Configuracion de la API
 *
 *  UNICO lugar que hay que tocar para cambiar a donde apunta el frontend.
 *
 *  Como decide la URL, en este orden:
 *   1. ?api=http://192.168.0.12:8080/api en la barra de direcciones, para
 *      probar contra otro backend. SOLO en tu PC o tu red local y hacia un
 *      servidor local (ver esDireccionLocal).
 *   2. API_URL_PRODUCCION, si lo defines abajo
 *   3. En tu PC o tu red local: el backend en el puerto 8080 de ese equipo
 *      (desde el celular en tu wifi funciona sin ?api=)
 *   4. El mismo dominio desde donde se sirve la pagina (/api)
 *
 *  Si el backend sirve tambien el frontend (opcion recomendada, un solo
 *  deploy), no hay que configurar NADA: el caso 4 funciona solo.
 * ===================================================================== */

// Dejalo vacio si el backend sirve el frontend.
// Si el frontend va en Netlify/Vercel y el backend aparte, pon aqui la URL:
// const API_URL_PRODUCCION = 'https://skillmatchproject-production.up.railway.app/api';
const API_URL_PRODUCCION = '';

/** Este equipo o la red de la casa/oficina: localhost, 127.x, 10.x, 172.16-31.x y 192.168.x. */
function esDireccionLocal(host) {
    return host === '' || host === 'localhost' || host === '[::1]' || host === '::1' ||
        /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(host);
}

/** La URL de ?api= solo vale si es http(s) y apunta a un servidor local. */
function apiDePrueba(url) {
    try {
        const destino = new URL(url);
        if (/^https?:$/.test(destino.protocol) && esDireccionLocal(destino.hostname)) return url.replace(/\/$/, '');
    } catch (e) { /* no es una URL */ }
    return '';
}

function resolverBaseUrl() {
    const host = window.location.hostname;
    const enLocal = esDireccionLocal(host);

    // 1. ?api= para probar contra otro backend. En el sitio publicado se
    //    ignora: un enlace con ?api=https://servidor-ajeno hacia que el login
    //    mandara el correo y la contrasena a ese servidor (y quedaba guardado).
    if (!enLocal) {
        localStorage.removeItem('skillmatch_api_url'); // por si alguien ya lo dejo guardado
    } else {
        const desdeUrl = apiDePrueba(new URLSearchParams(window.location.search).get('api') || '');
        if (desdeUrl) localStorage.setItem('skillmatch_api_url', desdeUrl);
        const guardada = apiDePrueba(localStorage.getItem('skillmatch_api_url') || '');
        if (guardada) return guardada;
        localStorage.removeItem('skillmatch_api_url');
    }

    // 2. URL fija de produccion, si se definio
    if (API_URL_PRODUCCION) return API_URL_PRODUCCION.replace(/\/$/, '');

    // 3. En este equipo o en la red local: el backend escucha en el 8080
    //    (desde el celular, http://192.168.0.12:5500 -> http://192.168.0.12:8080/api)
    if (enLocal) {
        const equipo = (host === '' || host === '127.0.0.1' || host === '[::1]' || host === '::1') ? 'localhost' : host;
        return 'http://' + equipo + ':8080/api';
    }

    // 4. Mismo origen que la pagina
    return window.location.origin + '/api';
}

const API_CONFIG = {
    BASE_URL: resolverBaseUrl(),
    ENDPOINTS: {
        LOGIN: '/auth/login',
        REGISTRO_USUARIO: '/auth/register',
        REGISTRO_EMPRESA: '/auth/register',
        HEALTH: '/health',
        STATS: '/public/stats',
        JOBS: '/jobs',
        COMPANIES: '/companies',
        APPLICATIONS: '/applications',
        CONNECTIONS: '/connections',
        MESSAGES: '/messages',
        NOTIFICATIONS: '/notifications',
        SAVED_JOBS: '/saved-jobs',
        USERS: '/users',
        USER_PROFILE: (userId) => `/users/${userId}`,
        USER_SKILLS: (userId) => `/users/${userId}/skills`,
        USER_EXPERIENCES: (userId) => `/users/${userId}/experiences`,
        USER_EDUCATION: (userId) => `/users/${userId}/educations`
    }
};

const API_BASE_URL = API_CONFIG.BASE_URL;

/* ---------- Sesion ---------- */

function saveToken(token) {
    if (token) localStorage.setItem('token', token);
}

function saveUserData(userData) {
    localStorage.setItem('userData', JSON.stringify(userData));
}

function getUserData() {
    const data = localStorage.getItem('userData');
    try {
        return data ? JSON.parse(data) : null;
    } catch (_) {
        localStorage.removeItem('userData');
        return null;
    }
}

function isAuthenticated() {
    const token = localStorage.getItem('token');
    if (!token) return false;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.exp * 1000 > Date.now();
    } catch (_) {
        return false;
    }
}

/**
 * Texto del servidor dentro de HTML. Lo que escribe una persona (un mensaje,
 * su nombre, el titulo de una vacante) puede traer "<script>" o un <img onerror>:
 * sin escapar, ese codigo se ejecutaria en la sesion de quien lo ve.
 * Este archivo se carga primero en todas las paginas, por eso vive aqui.
 */
function escaparHtml(texto) {
    if (texto === null || texto === undefined) return '';
    return String(texto).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Solo enlaces http(s) o relativos: un "javascript:..." en un adjunto ejecutaria codigo. */
function urlSegura(url) {
    const u = String(url || '').trim();
    return /^(https?:\/\/|\/|\.{1,2}\/)/i.test(u) ? escaparHtml(u) : '#';
}

function limpiarSesion() {
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    localStorage.removeItem('companyOffers');
    localStorage.removeItem('skillmatch_saved_opportunities');
}

async function logout() {
    const token = localStorage.getItem('token');
    try {
        await fetch(`${API_BASE_URL}/auth/logout`, {
            method: 'POST',
            credentials: 'include',
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
    } catch (_) { /* aunque falle el servidor, cerramos sesion en el navegador */ }

    limpiarSesion();

    const path = window.location.pathname;
    const isPublicPage = /index\.html|login|registro|seleccionar-registro/.test(path);
    if (!isPublicPage) {
        window.location.href = 'index.html';
    }
}

/* ---------- Peticiones ---------- */

async function fetchWithAuth(url, options = {}) {
    const token = localStorage.getItem('token');

    // Acepta tanto '/jobs' como la URL completa
    const destino = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;

    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options.headers
    };

    // No forzar Content-Type cuando se sube un FormData
    if (options.body instanceof FormData) {
        delete headers['Content-Type'];
    }

    const response = await fetch(destino, {
        ...options,
        credentials: 'include',
        headers
    });

    // Token vencido o invalido: cerrar sesion y volver al login
    if (response.status === 401 && token) {
        limpiarSesion();
        const path = window.location.pathname;
        if (!/index\.html|login|registro|seleccionar-registro/.test(path)) {
            window.location.href = 'login.html';
        }
    }

    return response;
}

