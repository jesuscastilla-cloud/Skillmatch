/* =====================================================================
 *  SkillMatch - Configuracion de la API
 *
 *  UNICO lugar que hay que tocar para cambiar a donde apunta el frontend.
 *
 *  Como decide la URL, en este orden:
 *   1. ?api=https://mi-backend.com/api  en la barra de direcciones (para probar)
 *   2. API_URL_PRODUCCION, si lo defines abajo
 *   3. http://localhost:8080/api cuando abres el sitio en tu maquina
 *   4. El mismo dominio desde donde se sirve la pagina (/api)
 *
 *  Si el backend sirve tambien el frontend (opcion recomendada, un solo
 *  deploy), no hay que configurar NADA: el caso 4 funciona solo.
 * ===================================================================== */

// Dejalo vacio si el backend sirve el frontend.
// Si el frontend va en Netlify/Vercel y el backend aparte, pon aqui la URL:
// const API_URL_PRODUCCION = 'https://skillmatchproject-production.up.railway.app/api';
const API_URL_PRODUCCION = '';

function resolverBaseUrl() {
    // 1. Override temporal por querystring, util para probar contra otro backend
    const params = new URLSearchParams(window.location.search);
    const desdeUrl = params.get('api');
    if (desdeUrl) {
        localStorage.setItem('skillmatch_api_url', desdeUrl.replace(/\/$/, ''));
    }
    const guardada = localStorage.getItem('skillmatch_api_url');
    if (guardada) return guardada;

    // 2. URL fija de produccion, si se definio
    if (API_URL_PRODUCCION) return API_URL_PRODUCCION.replace(/\/$/, '');

    // 3. Desarrollo local: el backend escucha en el 8080
    const host = window.location.hostname;
    const esLocal = host === 'localhost' || host === '127.0.0.1' || host === '';
    if (esLocal) return 'http://localhost:8080/api';

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

/** Comprueba que el backend responde. Devuelve true/false. */
async function apiDisponible() {
    try {
        const r = await fetch(`${API_BASE_URL}/health`, { method: 'GET' });
        return r.ok;
    } catch (_) {
        return false;
    }
}
