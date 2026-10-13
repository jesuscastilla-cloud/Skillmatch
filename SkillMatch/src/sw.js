/* =====================================================================
 *  SkillMatch: service worker (la parte que hace que se pueda instalar
 *  como app y abrir sin internet)
 *
 *  Vive en la raiz del sitio (junto a pages/ y assets/) para controlar
 *  todas las paginas. Reglas:
 *  - La API (/api/) y lo de otros sitios (fuentes, el backend en local)
 *    NUNCA se guarda: ahi van los datos de cada persona.
 *  - Paginas, CSS y JS: primero la red, asi una version nueva se ve al
 *    instante; la copia guardada solo se usa sin conexion.
 *  - Imagenes: primero la copia guardada (casi nunca cambian).
 *  - Sin conexion y sin copia de la pagina: pages/sin-conexion.html.
 *
 *  Al cambiar la lista de archivos basicos, subir VERSION: las copias
 *  viejas se borran al activarse la nueva.
 * ===================================================================== */

const VERSION = 'skillmatch-v1';

// Lo minimo para que la app abra sin conexion (rutas relativas a este archivo)
const BASICOS = [
    'pages/sin-conexion.html',
    'pages/index.html',
    'assets/css/app.css',
    'assets/js/api-config.js',
    'assets/js/ui.js',
    'assets/img/logo.png',
    'assets/img/logo-oscuro.png',
    'assets/img/favicon/favicon-32.png',
    'assets/img/favicon/icon-192.png'
];

self.addEventListener('install', function (evento) {
    evento.waitUntil(
        caches.open(VERSION)
            .then(function (cache) { return cache.addAll(BASICOS); })
            .then(function () { return self.skipWaiting(); })
    );
});

self.addEventListener('activate', function (evento) {
    evento.waitUntil(
        caches.keys()
            .then(function (nombres) {
                return Promise.all(nombres
                    .filter(function (n) { return n.indexOf('skillmatch-') === 0 && n !== VERSION; })
                    .map(function (n) { return caches.delete(n); }));
            })
            .then(function () { return self.clients.claim(); })
    );
});

function guardar(peticion, respuesta) {
    // Solo respuestas completas y de este sitio (no errores ni redirecciones)
    if (!respuesta || !respuesta.ok || respuesta.type !== 'basic') return respuesta;
    const copia = respuesta.clone();
    caches.open(VERSION).then(function (cache) { cache.put(peticion, copia); });
    return respuesta;
}

function primeroLaRed(peticion, esPagina) {
    return fetch(peticion)
        .then(function (respuesta) { return guardar(peticion, respuesta); })
        .catch(function () {
            // ignoreSearch: "oportunidades.html?q=mesero" usa la copia de oportunidades.html
            return caches.match(peticion, { ignoreSearch: true }).then(function (copia) {
                if (copia) return copia;
                if (esPagina) return caches.match(new URL('pages/sin-conexion.html', self.registration.scope));
                return Response.error();
            });
        });
}

function primeroLaCopia(peticion) {
    return caches.match(peticion).then(function (copia) {
        return copia || fetch(peticion).then(function (respuesta) { return guardar(peticion, respuesta); });
    });
}

self.addEventListener('fetch', function (evento) {
    const peticion = evento.request;
    if (peticion.method !== 'GET') return;
    const url = new URL(peticion.url);
    if (url.origin !== self.location.origin) return;
    if (url.pathname.indexOf('/api/') !== -1) return;

    if (peticion.mode === 'navigate') {
        evento.respondWith(primeroLaRed(peticion, true));
    } else if (peticion.destination === 'image') {
        evento.respondWith(primeroLaCopia(peticion));
    } else if (peticion.destination === 'style' || peticion.destination === 'script' || peticion.destination === 'manifest') {
        evento.respondWith(primeroLaRed(peticion, false));
    }
});
