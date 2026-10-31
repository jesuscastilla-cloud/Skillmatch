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
    //    Con el mismo nombre que la pagina (127.0.0.1 o localhost): para el navegador
    //    son sitios distintos y la cookie de la sesion solo viaja dentro del mismo
    if (enLocal) {
        return 'http://' + (host || 'localhost') + ':8080/api';
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

/* ---------- Servidor dormido ---------- */

// Render (plan gratis) apaga el backend tras 15 minutos sin visitas y la primera
// respuesta tarda hasta un minuto: sin aviso, la pagina parece rota. Aqui se
// cuentan las consultas a la API que siguen esperando; si alguna pasa de
// ESPERA_SERVIDOR_MS, ui.js muestra un aviso y lo quita cuando terminan todas.
// Va en este archivo porque se carga primero: asi tambien cuenta las consultas
// que los modulos hacen apenas cargan.
const ESPERA_SERVIDOR_MS = 4000;
(function vigilarServidor() {
    const fetchOriginal = window.fetch;
    if (!fetchOriginal) return;
    const estado = { esperando: 0, lento: false };
    const base = new URL(API_BASE_URL, window.location.href).href;
    let temporizador = null;
    const avisar = lento => {
        estado.lento = lento;
        window.dispatchEvent(new CustomEvent('skillmatch:servidor', { detail: { lento } }));
    };
    window.fetch = function (recurso) {
        const promesa = fetchOriginal.apply(window, arguments);
        let url = '';
        try { url = new URL(recurso instanceof Request ? recurso.url : String(recurso), window.location.href).href; } catch (e) { /* no es una URL */ }
        if (url.indexOf(base) !== 0) return promesa;
        estado.esperando++;
        if (!temporizador && !estado.lento) {
            temporizador = setTimeout(() => { temporizador = null; if (estado.esperando) avisar(true); }, ESPERA_SERVIDOR_MS);
        }
        const terminar = () => {
            estado.esperando--;
            if (estado.esperando > 0) return;
            clearTimeout(temporizador);
            temporizador = null;
            if (estado.lento) avisar(false);
        };
        promesa.then(terminar, terminar);
        return promesa;
    };
    // ui.js lo lee al arrancar, por si la espera empezo antes de que cargara
    window.SkillMatchServidor = estado;
})();

/* ---------- Sesion ----------
 * El token (JWT) vive SOLO en la cookie httpOnly "auth_token" (docs/CAMBIOS-FRONTEND.md,
 * F4): ningun script puede leerlo, ni uno ajeno que se colara en la pagina. Aqui solo
 * quedan los datos visibles de la cuenta (userData) y cuando vence la sesion, para saber
 * si hay sesion sin preguntarle al servidor. */

const SESION_VENCE_KEY = 'skillmatch_sesion_vence';
const SESION_POR_DEFECTO_MS = 24 * 60 * 60 * 1000; // jwt.expiration del backend

/** Tras entrar, registrarse o cambiar la contrasena: expiresAt viene en la respuesta. */
function guardarSesion(expiresAt) {
    const vence = Number(expiresAt) > Date.now() ? Number(expiresAt) : Date.now() + SESION_POR_DEFECTO_MS;
    localStorage.setItem(SESION_VENCE_KEY, String(vence));
}

function haySesion() {
    return Number(localStorage.getItem(SESION_VENCE_KEY) || 0) > Date.now() && !!localStorage.getItem('userData');
}

// Las sesiones abiertas antes de F4 guardaban aqui el token: se pasa su vencimiento
// a la marca nueva y se borra (la cookie de esa sesion sigue valiendo)
(function migrarSesionVieja() {
    const viejo = localStorage.getItem('token');
    if (!viejo) return;
    try {
        const carga = JSON.parse(atob(viejo.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        if (carga.exp) localStorage.setItem(SESION_VENCE_KEY, String(carga.exp * 1000));
    } catch (_) { /* token roto: queda sin sesion */ }
    localStorage.removeItem('token');
})();

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
    return haySesion();
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
/** El backend ya busca el texto tal cual (literal): no hace falta escaparlo. */
function textoParaBuscar(texto) {
    return String(texto || '').trim();
}

function urlSegura(url) {
    const u = String(url || '').trim();
    return /^(https?:\/\/|\/|\.{1,2}\/)/i.test(u) ? escaparHtml(u) : '#';
}

/* ---------- Validaciones ----------
 * Las mismas reglas que el backend (validation/Nombres y EntradaSegura): aquí avisan
 * antes de enviar; el servidor las vuelve a revisar. Cada una devuelve el problema
 * en palabras, o '' si está bien. */

const Validar = {
    /** Quita invisibles (de control o de ancho cero), une espacios repetidos y recorta. */
    limpiar(texto) {
        return String(texto == null ? '' : texto).normalize('NFC')
            .replace(/[\u0000-\u001F\u007F-\u009F\u00AD\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFEFF]/g, '')
            .replace(/\s+/g, ' ').trim();
    },
    /** Nombre o apellido de una persona: letras, espacios, - y ', entre 2 y 50. */
    persona(texto, campo = 'El nombre') {
        const v = Validar.limpiar(texto);
        if (!v) return `${campo} es obligatorio.`;
        if ([...v].length < 2 || [...v].length > 50) return `${campo} debe tener entre 2 y 50 caracteres.`;
        if (!/^[\p{L}\p{M}]+(?:[ '’-][\p{L}\p{M}]+)*$/u.test(v)) {
            return `${campo} solo puede tener letras, espacios, guion (-) y apóstrofo (').`;
        }
        return '';
    },
    /** Nombre de una empresa: además números y & . , ( ), hasta 100. */
    empresa(texto) {
        const v = Validar.limpiar(texto);
        const letras = [...v].filter(c => /[\p{L}\d]/u.test(c)).length;
        if (!v || letras < 2) return 'Escribe el nombre de la empresa.';
        if ([...v].length > 100) return 'El nombre de la empresa puede tener hasta 100 caracteres.';
        if (!/^[\p{L}\p{M}\d(][\p{L}\p{M}\d .,&'’()-]*$/u.test(v)) {
            return 'El nombre de la empresa solo puede tener letras, números, espacios y & . , ( ) -';
        }
        return '';
    },
    /** Una ciudad (vacía vale): letras, números, espacios y , . ( ) / - '. */
    lugar(texto) {
        const v = Validar.limpiar(texto);
        if (!v) return '';
        return /^[\p{L}\p{M}\d][\p{L}\p{M}\d .,()/'’–-]{0,99}$/u.test(v) ? '' : 'La ciudad solo puede tener letras, números, espacios y , . ( ) / -';
    },
    /** Una habilidad: letras, números, espacios y + # . / & ( ) -, para "C#", "C++" o "Node.js". */
    habilidad(texto) {
        const v = Validar.limpiar(texto);
        if (!v) return 'Escribe la habilidad.';
        return /^[\p{L}\p{M}\d.#+][\p{L}\p{M}\d +#./&()'’-]{0,79}$/u.test(v) ? '' : 'La habilidad solo puede tener letras, números, espacios y + # . / & ( ) -';
    },
    /**
     * Fechas de una experiencia ('experiencia') o un estudio ('estudio'), como "2025-01-31".
     * Experiencia: inicio y fin hasta hoy. Estudio: inicio hasta el próximo año y fin
     * (grado esperado) hasta 10 años adelante. Desde 1950 en los dos.
     */
    fechas(inicio, fin, actual, tipo) {
        if (!inicio) return 'Escribe la fecha de inicio.';
        const hoy = new Date().toISOString().slice(0, 10);
        const anio = Number(hoy.slice(0, 4));
        const masTarde = (n) => (anio + n) + hoy.slice(4);
        const maxInicio = tipo === 'estudio' ? masTarde(1) : hoy;
        if (inicio < '1950-01-01' || inicio > maxInicio) {
            return tipo === 'estudio' ? 'La fecha de inicio debe estar entre 1950 y el próximo año.'
                : 'La fecha de inicio no puede ser en el futuro ni antes de 1950.';
        }
        if (!actual && fin) {
            if (fin < inicio) return 'La fecha de fin no puede ser antes del inicio.';
            if (fin > (tipo === 'estudio' ? masTarde(10) : hoy)) {
                return tipo === 'estudio' ? 'La fecha de fin no puede ser más de 10 años en el futuro.'
                    : 'La fecha de fin no puede ser en el futuro. Si sigues ahí, marca "Trabajo actual".';
            }
        }
        return '';
    }
};

function limpiarSesion() {
    localStorage.removeItem('token');
    localStorage.removeItem(SESION_VENCE_KEY);
    localStorage.removeItem('userData');
    localStorage.removeItem('companyOffers');
    localStorage.removeItem('skillmatch_saved_opportunities');
}

async function logout() {
    try {
        // La cookie va sola; el servidor la anula y la borra
        await fetch(`${API_BASE_URL}/auth/logout`, {
            method: 'POST',
            credentials: 'include'
        });
    } catch (_) { /* aunque falle el servidor, cerramos sesion en el navegador */ }

    limpiarSesion();

    const path = window.location.pathname;
    const isPublicPage = /index\.html|login|registro|seleccionar-registro|recuperar/.test(path);
    if (!isPublicPage) {
        window.location.href = 'index.html';
    }
}

/* ---------- Peticiones ---------- */

async function fetchWithAuth(url, options = {}) {
    // La sesion viaja en la cookie (credentials: 'include'), no en un encabezado
    const conSesion = haySesion();

    // Acepta tanto '/jobs' como la URL completa
    const destino = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;

    const headers = {
        'Content-Type': 'application/json',
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

    // Sesion vencida o anulada: cerrar sesion y volver al login
    if (response.status === 401 && conSesion) {
        // Una sola sesion por cuenta: si entro en otro dispositivo, se dice asi
        // (alert de ui.js: el aviso pasa a la pagina del login)
        // (una vez, aunque varias consultas respondan 401 al mismo tiempo)
        const cuerpo = await response.clone().json().catch(() => ({}));
        if (cuerpo.motivo === 'OTRA_SESION' && !fetchWithAuth.avisoOtraSesion) {
            fetchWithAuth.avisoOtraSesion = true;
            alert(cuerpo.message);
        }
        limpiarSesion();
        const path = window.location.pathname;
        if (!/index\.html|login|registro|seleccionar-registro/.test(path)) {
            window.location.href = 'login.html';
        }
    }

    return response;
}

