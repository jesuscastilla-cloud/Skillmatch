/* =====================================================================
 *  SkillMatch — capa de interfaz
 *
 *  Se encarga de trece cosas, y de nada mas:
 *    1. Iconos SVG (reemplazan a los emojis, se ven igual en todos lados)
 *    2. Orientacion: pagina activa, barra inferior en movil, progreso
 *    3. Estados de carga: esqueletos y botones ocupados
 *    4. Avisos al usuario (toast) y modales accesibles
 *    5. Movimiento: aparicion al hacer scroll (las listas se reparten como
 *       una baraja) y onda al hacer clic
 *    6. Listas desplegables de la marca en lugar de las nativas (data-lista)
 *    7. Campo de etiquetas para habilidades (SkillMatchUI.etiquetas)
 *    8. Carrusel de vacantes de la portada (SkillMatchUI.carrusel)
 *    9. Cuenta: ventanas desde JS, cambiar contrasena y mensajes sin leer
 *   10. Marcar lo que anuncio una notificacion (SkillMatchUI.resaltar)
 *   11. Instalar como app: service worker (sw.js) y boton del pie
 *   12. Tamano de letra (pie y paleta), para quien ve con dificultad
 *   13. Recorrido guiado la primera vez (SkillMatchUI.recorrido)
 *
 *  Se carga en todas las paginas y funciona sin configuracion.
 * ===================================================================== */

(function () {
    'use strict';

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Carpeta de ui.js: desde ahi se encuentran vendor/ y ../lottie/ en cualquier pagina
    const RUTA_JS = ((document.currentScript && document.currentScript.src) || '').replace(/[^/]*$/, '');

    /* ---------- 1. Iconos ---------- */

    // Trazos de 24x24, grosor 1.75. Se dibujan con currentColor.
    const ICONS = {
        search:    '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
        pin:       '<path d="M12 21s7-5.3 7-11a7 7 0 1 0-14 0c0 5.7 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
        briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7M3 12h18"/>',
        chart:     '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
        money:     '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v9M14.5 10a2.5 2.5 0 0 0-2.5-1.5c-1.4 0-2.5.7-2.5 1.9s1 1.6 2.5 1.9 2.5.8 2.5 1.9-1.1 1.8-2.5 1.8A2.6 2.6 0 0 1 9.4 14"/>',
        target:    '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8" fill="currentColor"/>',
        globe:     '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.2 2.3 3.4 5.3 3.4 8.5S14.2 18.2 12 20.5c-2.2-2.3-3.4-5.3-3.4-8.5S9.8 5.8 12 3.5Z"/>',
        settings:  '<circle cx="12" cy="12" r="3"/><path d="M19.4 14a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V20a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7.1 18.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 4 12.8H4a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 5.6 7.1L5.5 7a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H10a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/>',
        cap:       '<path d="m3 9 9-4.5L21 9l-9 4.5L3 9Z"/><path d="M7 11v4.5c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5V11M21 9v5"/>',
        arrow:     '<path d="M5 12h13M13 6l6 6-6 6"/>',
        trophy:    '<path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/><path d="M8 5.5H5.5A1.5 1.5 0 0 0 4 7c0 2 1.6 3.5 4 3.5M16 5.5h2.5A1.5 1.5 0 0 1 20 7c0 2-1.6 3.5-4 3.5M10 13v3.5h4V13M8 20h8"/>',
        handshake: '<path d="m11 16 2 2 3-3 3 3 2-2-5.5-5.5-2 2L11 10"/><path d="m13 8-2-2-4.5 4.5L3 14l2 2 3-3 3 3"/>',
        chat:      '<path d="M20 15a2 2 0 0 1-2 2H8l-4 3.5V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9Z"/>',
        user:      '<circle cx="12" cy="8" r="3.5"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
        users:     '<circle cx="9" cy="8" r="3.2"/><path d="M2.5 19.5a6.5 6.5 0 0 1 13 0M16.5 5.2a3.2 3.2 0 0 1 0 5.6M18 19.5a6.5 6.5 0 0 0-2.2-4.9"/>',
        trash:     '<path d="M4 7h16M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7M6.5 7l.8 12A1.6 1.6 0 0 0 8.9 20.5h6.2a1.6 1.6 0 0 0 1.6-1.5L17.5 7M10.5 11v6M13.5 11v6"/>',
        camera:    '<path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2L8 5h8l1.5 2h2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-9Z"/><circle cx="12" cy="12.5" r="3.5"/>',
        eye:       '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
        circle:    '<circle cx="12" cy="12" r="7.5"/>', /* punto pendiente de una lista */
        'eye-off': '<path d="m4 4 16 16"/><path d="M9.6 5.8A9 9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16.5 16.5 0 0 1-2.7 3.5M15.6 17.7a8.5 8.5 0 0 1-3.6.8c-6 0-9.5-6.5-9.5-6.5a16.5 16.5 0 0 1 3.8-4.5"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
        trending:  '<path d="M3 17 9.5 10.5l3.5 3.5L21 6.5"/><path d="M15 6.5h6v6"/>',
        building:  '<path d="M4 20V5.5A1.5 1.5 0 0 1 5.5 4h7A1.5 1.5 0 0 1 14 5.5V20M14 10h4.5A1.5 1.5 0 0 1 20 11.5V20M2.5 20h19M7 8h4M7 12h4M7 16h4M17 14h0M17 17h0"/>',
        pencil:    '<path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z"/><path d="m14.5 6.5 3 3"/>',
        close:     '<path d="M6 6l12 12M18 6 6 18"/>',
        image:     '<rect x="3" y="4.5" width="18" height="15" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m4 17 5-4.5 4 3.5 3-2.5 4 3.5"/>',
        list:      '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h0M3.5 12h0M3.5 18h0"/>',
        rocket:    '<path d="M12 3.5c3.2 1.6 5 4.8 5 8.5l-2.5 3h-5L7 12c0-3.7 1.8-6.9 5-8.5Z"/><circle cx="12" cy="10" r="1.6"/><path d="M9.5 15 7 20l3.5-1.5M14.5 15l2.5 5-3.5-1.5"/>',
        sprout:    '<path d="M12 20v-7"/><path d="M12 13c0-3-2-5-5-5 0 3 2 5 5 5ZM12 13c0-3 2-5 5-5 0 3-2 5-5 5Z"/>',
        book:      '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5v-13ZM11 4h7.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H11"/>',
        star:      '<path d="m12 4 2.4 5 5.6.8-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9 5.6-.8L12 4Z"/>',
        home:      '<path d="m3.5 10.5 8.5-6.5 8.5 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-4v-6H9v6H5A1.5 1.5 0 0 1 3.5 19v-8.5Z"/>',
        refresh:   '<path d="M20 11a8 8 0 0 0-13.6-4.6L3.5 9"/><path d="M4 13a8 8 0 0 0 13.6 4.6L20.5 15"/><path d="M3.5 4.5V9H8M20.5 19.5V15H16"/>',
        check:     '<path d="m5 12.5 4.5 4.5L19 7"/>',
        calendar:  '<rect x="3.5" y="5.5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3.5v4M16 3.5v4"/>',
        sparkle:   '<path d="m12 3 1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4L12 3Z"/><path d="M18.5 16.5 19 18l1.5.5-1.5.5-.5 1.5-.5-1.5L16.5 18l1.5-.5.5-1.5Z"/>',
        bulb:      '<path d="M9 17.5h6M10 20.5h4"/><path d="M12 3.5a5.5 5.5 0 0 0-3.2 10c.5.4.7.9.7 1.5h5c0-.6.2-1.1.7-1.5A5.5 5.5 0 0 0 12 3.5Z"/>',
        phone:     '<path d="M6.5 3.5h3l1.5 4-2 1.5a12 12 0 0 0 6 6l1.5-2 4 1.5v3a1.5 1.5 0 0 1-1.6 1.5A16.5 16.5 0 0 1 5 5.1 1.5 1.5 0 0 1 6.5 3.5Z"/>',
        clip:      '<path d="M20 11.5 12.4 19a4.6 4.6 0 0 1-6.5-6.5l8-8a3.1 3.1 0 0 1 4.4 4.4l-8 8a1.5 1.5 0 0 1-2.2-2.2l7.3-7.3"/>',
        bell:      '<path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13 6 9Z"/><path d="M10 18a2 2 0 0 0 4 0"/>',
        mail:      '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/>',
        inbox:     '<path d="M3.5 13h4l1.5 3h6l1.5-3h4"/><path d="M5.6 5.6h12.8l2.1 7.4V18a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18v-5l2.1-7.4Z"/>',
        clock:     '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5.2l3.2 2"/>',
        alert:     '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5M12 16h0"/>',
        heart:     '<path d="M12 20s-7.5-4.6-7.5-9.4A4.1 4.1 0 0 1 12 7.8a4.1 4.1 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20Z"/>',
        save:      '<path d="M5 4.5h11L19.5 8v11.5A1 1 0 0 1 18.5 20h-13a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1Z"/><path d="M8 4.5v5h7v-5M8 20v-5.5h8V20"/>',
        bookmark:  '<path d="M6.5 4h11a1 1 0 0 1 1 1v15l-6.5-4-6.5 4V5a1 1 0 0 1 1-1Z"/>',
        send:      '<path d="M21 4 3 11l7 2.5L12.5 21 21 4Z"/><path d="m10 14 4-4"/>',
        menu:      '<path d="M4 7h16M4 12h16M4 17h16"/>',
        columnas:  '<rect x="3.5" y="4" width="4.5" height="16" rx="1.2"/><rect x="9.75" y="4" width="4.5" height="11" rx="1.2"/><rect x="16" y="4" width="4.5" height="7" rx="1.2"/>',
        filter:    '<path d="M4 6h16M7 12h10M10 18h4"/>',
        logout:    '<path d="M14 7V5.5A1.5 1.5 0 0 0 12.5 4h-6A1.5 1.5 0 0 0 5 5.5v13A1.5 1.5 0 0 0 6.5 20h6a1.5 1.5 0 0 0 1.5-1.5V17"/><path d="M10 12h10M17 8.5l3.5 3.5L17 15.5"/>',
        plus:      '<path d="M12 5v14M5 12h14"/>',
        minus:     '<path d="M5 12h14"/>',
        chevron:   '<path d="m6 9 6 6 6-6"/>',
        lock:      '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
        upload:    '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5"/><path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15"/>',
        download:  '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5"/><path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15"/>',
        desktop:   '<rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M9 20h6M12 16.5V20"/>',
        sun:       '<circle cx="12" cy="12" r="4.5"/><path d="M12 3v2.2M12 18.8V21M4.2 12H2M22 12h-2.2M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6"/>',
        moon:      '<path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11Z"/>'
    };

    // Un emoji puede no existir en el equipo del usuario y cambia de forma
    // en cada sistema. Estos alias permiten sustituirlos sin tocar la logica.
    const ALIAS = {
        '🔍': 'search',  '📍': 'pin',      '💼': 'briefcase', '📊': 'chart',
        '💰': 'money',   '🎯': 'target',   '🌍': 'globe',     '⚙️': 'settings',
        '⚙': 'settings', '🎓': 'cap',      '→': 'arrow',      '🏆': 'trophy',
        '🤝': 'handshake','💬': 'chat',    '👤': 'user',      '🗑️': 'trash',
        '🗑': 'trash',   '📷': 'camera',   '👁️': 'eye',       '👁': 'eye',
        '📈': 'trending','🏢': 'building', '✏️': 'pencil',    '✏': 'pencil',
        '✕': 'close',    '✗': 'close',     '❌': 'close',     '🖼️': 'image',
        '🖼': 'image',   '📋': 'list',     '🚀': 'rocket',    '🌱': 'sprout',
        '📚': 'book',    '⭐': 'star',     '🏠': 'home',      '🔄': 'refresh',
        '✓': 'check',    '✅': 'check',    '📅': 'calendar',  '✨': 'sparkle',
        '📖': 'book',    '💡': 'bulb',     '📞': 'phone',     '📎': 'clip',
        '🔔': 'bell',    '✉️': 'mail',     '✉': 'mail',       '📨': 'mail',
        '📬': 'inbox',   '📭': 'inbox',    '⏳': 'clock',     '⏱️': 'clock',
        '◷': 'clock',    '⚠️': 'alert',    '⚠': 'alert',      '❤️': 'heart',
        '❤': 'heart',    '💾': 'save',     '☎️': 'phone',     '☎': 'phone',
        '🎤': 'chat',    '🖥️': 'desktop',  '🖥': 'desktop',   '⬜': 'bookmark'
    };

    function svgIcon(name, extraClass) {
        const body = ICONS[name];
        if (!body) return '';
        // ico-<nombre> deja que el CSS anime cada icono a su manera (seccion 25d)
        return '<svg class="ico ico-' + name + ' ' + (extraClass || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + body + '</svg>';
    }

    /** Convierte cada <i data-ico="nombre"> en un SVG real. */
    function hydrateIcons(root) {
        (root || document).querySelectorAll('[data-ico]').forEach(function (el) {
            const name = el.getAttribute('data-ico');
            if (!ICONS[name]) { el.remove(); return; }
            const wrapper = document.createElement('span');
            wrapper.innerHTML = svgIcon(name, el.className.replace('ico', '').trim());
            const svg = wrapper.firstChild;
            if (el.hasAttribute('data-ico-label')) {
                svg.setAttribute('aria-label', el.getAttribute('data-ico-label'));
                svg.removeAttribute('aria-hidden');
                svg.setAttribute('role', 'img');
            }
            el.replaceWith(svg);
        });
    }

    // El contenido que llega de la API se inserta despues; observamos el DOM
    // para que esos iconos tambien se dibujen, sin que cada modulo lo pida.
    const iconObserver = new MutationObserver(function (mutations) {
        for (const m of mutations) {
            for (const node of m.addedNodes) {
                if (node.nodeType !== 1) continue;
                if (node.hasAttribute && node.hasAttribute('data-ico')) hydrateIcons(node.parentNode);
                else if (node.querySelector && node.querySelector('[data-ico]')) hydrateIcons(node);
            }
        }
    });

    /* ---------- 2. Orientacion ---------- */

    const DESTINOS = [
        { href: 'index.html',          ico: 'home',      label: 'Inicio' },
        { href: 'oportunidades.html',  ico: 'briefcase', label: 'Vacantes' },
        { href: 'conexiones.html',     ico: 'users',     label: 'Red' },
        { href: 'mensajes.html',       ico: 'chat',      label: 'Mensajes' },
        { href: 'perfil-usuario.html', ico: 'user',      label: 'Perfil' }
    ];

    function paginaActual() {
        const parts = window.location.pathname.split('/');
        return parts[parts.length - 1] || 'index.html';
    }

    /** Marca el enlace de la pagina actual aunque el HTML no lo traiga. */
    // Paginas que pertenecen a la seccion de otra: el perfil de una empresa es
    // parte de "Empresas"
    const SECCION_DE = { 'empresa.html': 'empresas.html' };

    function marcarNavegacionActiva() {
        const actual = paginaActual();
        const seccion = SECCION_DE[actual] || actual;
        document.querySelectorAll('header .nav-links a').forEach(function (a) {
            const destino = (a.getAttribute('href') || '').split('/').pop();
            if (destino && destino === seccion && !a.classList.contains('btn-login') && !a.classList.contains('btn-register')) {
                a.classList.add('active-nav');
                a.setAttribute('aria-current', destino === actual ? 'page' : 'true');
            }
        });
    }

    /** Sesion en la barra superior.
     *  - Todo enlace con data-cerrar-sesion cierra la sesion de verdad. Antes,
     *    en Oportunidades y Conexiones "Cerrar sesion" solo llevaba al login y
     *    la sesion seguia abierta.
     *  - En las paginas publicas (portada, login, indicadores), si ya hay
     *    sesion, "Iniciar sesion / Unirse ahora" pasan a "Mi perfil / Cerrar sesion". */
    function sesionEnBarra() {
        document.addEventListener('click', function (e) {
            const enlace = e.target instanceof Element && e.target.closest('[data-cerrar-sesion]');
            if (!enlace) return;
            e.preventDefault();
            const salir = function () { window.location.href = 'index.html'; };
            if (typeof window.logout === 'function') {
                // logout() (api-config.js) avisa al backend y borra los datos guardados
                Promise.resolve(window.logout()).then(salir, salir);
            } else {
                ['token', 'userData', 'companyOffers', 'skillmatch_saved_opportunities'].forEach(function (k) {
                    try { localStorage.removeItem(k); } catch (err) { /* sin almacenamiento */ }
                });
                salir();
            }
        });

        let datos = null;
        try {
            datos = localStorage.getItem('token') ? JSON.parse(localStorage.getItem('userData') || 'null') : null;
        } catch (err) { datos = null; }

        // Barra escrita para una persona con sesion (Vacantes, Conexiones,
        // Mensajes y Mi perfil): se ajusta si quien la ve no es una persona
        const principales = document.querySelector('header .nav-principales');
        const conexiones = principales && principales.querySelector('a[href="conexiones.html"]');
        const miPerfil = document.querySelector('header .nav-links a[href="perfil-usuario.html"]');
        if (conexiones && !datos) {
            // Vacantes es publica: a un visitante se le mostraban "Mi perfil" y
            // "Cerrar sesion". Recibe la misma barra que la portada.
            const cambiar = function (a, href, texto, clase) {
                if (!a) return;
                a.setAttribute('href', href);
                a.textContent = texto;
                a.className = clase || '';
                a.removeAttribute('data-cerrar-sesion');
            };
            cambiar(conexiones, 'index.html#como-funciona', 'Cómo funciona');
            cambiar(principales.querySelector('a[href="mensajes.html"]'), 'empresas.html', 'Empresas');
            cambiar(miPerfil, 'login.html', 'Iniciar sesión', 'btn-login');
            cambiar(document.querySelector('header .nav-links a[data-cerrar-sesion]'), 'seleccionar-registro.html', 'Unirse ahora', 'btn-register');
            return;
        }
        if (!datos) return;
        if (conexiones && datos.userType === 'empresa') {
            // Las empresas no usan Conexiones y su perfil es el de la empresa
            conexiones.parentElement.remove();
            if (miPerfil) {
                miPerfil.textContent = 'Mi empresa';
                miPerfil.setAttribute('href', 'perfil-empresa.html');
            }
        }
        // Paginas publicas (portada, Indicadores, politica...) escritas con la
        // barra de visitante: con sesion se ve la misma barra del resto del sitio.
        // Antes una persona veia "Como funciona" y "Empresas" en lugar de
        // Conexiones y Mensajes (y el numero de mensajes sin leer no salia)
        const comoFunciona = principales && principales.querySelector('a[href$="#como-funciona"]');
        const enlaceEmpresas = principales && principales.querySelector('a[href="empresas.html"]');
        if (comoFunciona && enlaceEmpresas) {
            if (datos.userType === 'empresa') {
                comoFunciona.parentElement.remove();
            } else {
                comoFunciona.setAttribute('href', 'conexiones.html');
                comoFunciona.textContent = 'Conexiones';
            }
            enlaceEmpresas.setAttribute('href', 'mensajes.html');
            enlaceEmpresas.textContent = 'Mensajes';
        }
        const entrar = document.querySelector('header .nav-links a.btn-login:not([data-cerrar-sesion])');
        const unirse = document.querySelector('header .nav-links a.btn-register');
        if (!entrar) return;
        const esEmpresa = datos.userType === 'empresa';
        entrar.textContent = 'Cerrar sesión';
        entrar.setAttribute('href', 'index.html');
        entrar.setAttribute('data-cerrar-sesion', '');
        if (unirse) {
            // Igual que en las paginas con sesion: "Mi perfil" como enlace y
            // "Cerrar sesion" al final
            unirse.textContent = esEmpresa ? 'Mi empresa' : 'Mi perfil';
            unirse.setAttribute('href', esEmpresa ? 'perfil-empresa.html' : 'perfil-usuario.html');
            unirse.classList.remove('btn-register');
            unirse.parentElement.after(entrar.parentElement);
        }
    }

    /** Barra inferior en movil: cinco destinos, siempre los mismos. */
    function construirTabbar() {
        if (document.querySelector('.tabbar')) return;
        if (!document.querySelector('header nav')) return;

        const actual = paginaActual();
        const esPerfilEmpresa = document.querySelector('a[href="perfil-empresa.html"]');

        const nav = document.createElement('nav');
        nav.className = 'tabbar';
        nav.setAttribute('aria-label', 'Navegacion principal');
        nav.innerHTML = '<ul>' + DESTINOS.map(function (d) {
            let href = d.href;
            if (d.href === 'perfil-usuario.html' && esPerfilEmpresa) href = 'perfil-empresa.html';
            const activo = href === actual ? ' class="is-active" aria-current="page"' : '';
            return '<li><a href="' + href + '"' + activo + '>' + svgIcon(d.ico) + '<span>' + d.label + '</span></a></li>';
        }).join('') + '</ul>';

        document.body.appendChild(nav);
        document.body.classList.add('has-tabbar');
    }

    /** Tema oscuro: el <head> de cada pagina ya deja [data-theme] puesto
     *  en <html> antes de pintar (evita el parpadeo); aqui solo se
     *  agrega el boton para cambiarlo y se recuerda la eleccion. */
    const TEMA_KEY = 'skillmatch_theme';

    function aplicarTema(tema) {
        document.documentElement.setAttribute('data-theme', tema);
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', tema === 'dark' ? '#0B1B2C' : '#EDF2F8');
        logoSegunTema(tema);
    }

    /** "Skill" va en azul oscuro en el logo y no se lee sobre fondo oscuro:
     *  en modo oscuro se cambia por logo-oscuro.png (mismo logo, azul claro). */
    function logoSegunTema(tema) {
        const archivo = tema === 'dark' ? 'logo-oscuro.png' : 'logo.png';
        document.querySelectorAll('.logo img').forEach(function (img) {
            const src = img.getAttribute('src');
            if (src) img.setAttribute('src', src.replace(/logo(-oscuro)?\.png$/, archivo));
        });
    }

    function construirInterruptorTema() {
        if (document.querySelector('.theme-toggle')) return;
        const listas = document.querySelectorAll('header .nav-links');
        const lista = listas[listas.length - 1];
        if (!lista) return;

        const boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'theme-toggle';

        const pintar = function () {
            const oscuro = document.documentElement.getAttribute('data-theme') === 'dark';
            boton.innerHTML = svgIcon(oscuro ? 'sun' : 'moon');
            boton.setAttribute('aria-pressed', String(oscuro));
            boton.setAttribute('aria-label', oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
        };
        pintar();

        boton.addEventListener('click', function () {
            const nuevo = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            localStorage.setItem(TEMA_KEY, nuevo);
            cambiarTemaConEfecto(nuevo, boton, function () { aplicarTema(nuevo); pintar(); });
        });

        const li = document.createElement('li');
        li.appendChild(boton);
        lista.insertBefore(li, lista.firstChild);
    }

    /** Cambio de tema con efecto: el tema nuevo se revela en circulo desde el
     *  boton (View Transitions: el navegador toma una foto antes y despues y
     *  anima las fotos) y el icono entra girando. Las esporas que salian del
     *  boton se quitaron a pedido de Luis. Sin soporte o con movimiento
     *  reducido, el tema cambia al instante. El modo demo (?animar en los
     *  logins) lo muestra igual, para verlo con las animaciones de Windows
     *  apagadas. */
    function modoDemo() {
        try { return localStorage.getItem('skillmatch_animar') === '1'; } catch (e) { return false; }
    }

    function cambiarTemaConEfecto(nuevo, boton, aplicar) {
        if ((reduceMotion && !modoDemo()) || !document.startViewTransition) { aplicar(); return; }
        const r = boton.getBoundingClientRect();
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        const radio = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
        const raiz = document.documentElement;
        raiz.classList.add('tema-cambiando'); // sin fundido ni barras aparte (app.css)
        const transicion = document.startViewTransition(aplicar);
        transicion.ready.then(function () {
            raiz.animate({ clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + radio + 'px at ' + x + 'px ' + y + 'px)'] },
                         { duration: 650, easing: 'cubic-bezier(.4, 0, .2, 1)', pseudoElement: '::view-transition-new(root)' });
        }).catch(function () {});
        transicion.finished.finally(function () { raiz.classList.remove('tema-cambiando'); });
    }

    /** Sombra en la barra superior solo cuando hay contenido arriba. */
    function barraAlHacerScroll() {
        const header = document.querySelector('header');
        if (!header) return;
        const actualizar = function () {
            header.classList.toggle('is-scrolled', window.scrollY > 4);
        };
        actualizar();
        window.addEventListener('scroll', actualizar, { passive: true });
    }

    /** Barra de progreso al salir hacia otra pagina: quita la sensacion de cuelgue. */
    function progresoDeNavegacion() {
        const barra = document.createElement('div');
        barra.className = 'route-progress';
        document.body.appendChild(barra);

        let activa = false;
        window.SkillMatchUI_progress = function () {
            if (activa || reduceMotion) return;
            activa = true;
            barra.style.width = '30%';
            setTimeout(function () { barra.style.width = '72%'; }, 220);
        };

        document.addEventListener('click', function (e) {
            const a = e.target.closest('a');
            if (!a) return;
            const href = a.getAttribute('href');
            if (!href || href.startsWith('#') || href.startsWith('http') ||
                a.target === '_blank' || e.metaKey || e.ctrlKey) return;
            window.SkillMatchUI_progress();
        });

        window.addEventListener('pageshow', function () {
            barra.style.width = '0';
            activa = false;
        });
    }

    /* ---------- 3. Entrada de la pagina ---------- */

    /** Encabezados y tarjetas que aparecen al hacer scroll. Se marcan solos
     *  (tambien las vacantes que llegan despues desde la API), sin tocar el HTML. */
    const REVELAR = '.reveal, .section-header-center, .innovation-header, .why-header, ' +
                    '.feature-card, .benefit-item, .pathway-card, .roadmap-card, ' +
                    '.cartagena-photo, .opportunity-card, .connection-card, .suggestion-card, ' +
                    '.offer-card, .candidate-mini-card, .application-card';
    // Las vacantes no suben desde abajo: salen de debajo de la tarjeta de
    // arriba, una tras otra, como cartas que se reparten (idea de Luis)
    const BARAJA = '.opportunity-card';
    let observadorEntrada = null;

    function revelar(raiz) {
        if (!raiz.querySelectorAll) return;
        const elementos = Array.from(raiz.querySelectorAll(REVELAR));
        if (raiz.matches && raiz.matches(REVELAR)) elementos.push(raiz);
        elementos.forEach(function (el) {
            if (el.dataset.revelado) return;
            el.dataset.revelado = '1';
            if (observadorEntrada) {
                el.classList.add('reveal');
                if (el.matches(BARAJA)) el.classList.add('baraja');
                observadorEntrada.observe(el);
            } else if (el.classList.contains('reveal')) {
                // Movimiento reducido o navegador viejo: se muestra ya, sin animar
                el.classList.add('is-visible');
            }
        });
    }

    /** Una sola secuencia al cargar, y revelado por scroll en secciones largas. */
    function movimientoDeEntrada() {
        document.body.classList.add('page-enter');
        if (!reduceMotion && 'IntersectionObserver' in window) {
            observadorEntrada = new IntersectionObserver(function (entradas) {
                let n = 0;
                entradas.forEach(function (entrada) {
                    if (!entrada.isIntersecting) return;
                    // 40 ms entre tarjetas (90 en la baraja, para que se vea cada carta);
                    // tope de 8 para que una lista larga no se haga lenta
                    const el = entrada.target;
                    const baraja = el.classList.contains('baraja');
                    const orden = Math.min(n++, 8);
                    const retraso = orden * (baraja ? 90 : 40);
                    el.style.setProperty('--reveal-delay', retraso + 'ms');
                    // Cada carta pasa por debajo de la que salio antes que ella
                    if (baraja) el.style.setProperty('--baraja-z', -1 - orden);
                    el.classList.add('is-visible');
                    observadorEntrada.unobserve(el);
                    // Al terminar, la tarjeta recupera su hover y sus transiciones propias
                    setTimeout(function () {
                        el.classList.remove('reveal', 'is-visible', 'baraja');
                        el.style.removeProperty('--reveal-delay');
                        el.style.removeProperty('--baraja-z');
                    }, retraso + (baraja ? 800 : 700));
                });
            }, { rootMargin: '0px 0px -8% 0px', threshold: .08 });
        }
        revelar(document.body);
    }

    /* ---------- 4. Estados de carga ---------- */

    const UI = {
        /** Dibuja n tarjetas fantasma dentro de un contenedor mientras llegan los datos. */
        skeletons: function (contenedor, n) {
            const destino = typeof contenedor === 'string' ? document.querySelector(contenedor) : contenedor;
            if (!destino) return;
            let html = '';
            for (let i = 0; i < (n || 3); i++) {
                html += '<div class="skeleton-card" aria-hidden="true">' +
                        '<div class="skeleton-row">' +
                        '<div class="skeleton skeleton-avatar"></div>' +
                        '<div style="flex:1"><div class="skeleton skeleton-title"></div>' +
                        '<div class="skeleton skeleton-line w-40" style="margin-top:10px"></div></div>' +
                        '</div>' +
                        '<div class="skeleton skeleton-line w-80"></div>' +
                        '<div class="skeleton skeleton-line w-60"></div>' +
                        '</div>';
            }
            destino.innerHTML = html;
            destino.setAttribute('aria-busy', 'true');
        },

        limpiarSkeletons: function (contenedor) {
            const destino = typeof contenedor === 'string' ? document.querySelector(contenedor) : contenedor;
            if (destino) destino.removeAttribute('aria-busy');
        },

        /** Marca un boton como ocupado y devuelve la funcion que lo libera. */
        ocupado: function (boton) {
            const el = typeof boton === 'string' ? document.querySelector(boton) : boton;
            if (!el) return function () {};
            el.classList.add('is-loading');
            el.disabled = true;
            return function () {
                el.classList.remove('is-loading');
                el.disabled = false;
            };
        },

        /* ---------- 5. Avisos ---------- */

        /**
         * Aviso breve. El texto dice que paso, no pide disculpas.
         * tipo: 'ok' | 'error' | 'info'
         */
        aviso: function (mensaje, tipo, duracion) {
            let pila = document.querySelector('.toast-stack');
            if (!pila) {
                pila = document.createElement('div');
                pila.className = 'toast-stack';
                pila.setAttribute('role', 'status');
                pila.setAttribute('aria-live', 'polite');
                document.body.appendChild(pila);
            }

            const icono = tipo === 'error' ? 'alert' : (tipo === 'info' ? 'bulb' : 'check');
            const toast = document.createElement('div');
            toast.className = 'toast toast-' + (tipo || 'ok');
            toast.innerHTML = svgIcon(icono) + '<span>' + mensaje + '</span>' +
                              '<button type="button" aria-label="Cerrar aviso">' + svgIcon('close', 'ico-sm') + '</button>';

            const cerrar = function () {
                toast.classList.add('is-leaving');
                setTimeout(function () { toast.remove(); }, 240);
            };
            toast.querySelector('button').addEventListener('click', cerrar);
            pila.appendChild(toast);
            setTimeout(cerrar, duracion || 4200);
            return cerrar;
        },

        icono: svgIcon,
        hidratarIconos: hydrateIcons
    };

    /* ---------- 6. Modales accesibles ---------- */

    function modalesAccesibles() {
        // Cerrar con Escape y con clic en el fondo, en cualquier modal de la app.
        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') return;
            const abierto = document.querySelector('.modal.active, .modal.is-open');
            if (abierto) abierto.classList.remove('active', 'is-open');
        });

        document.addEventListener('click', function (e) {
            if (e.target.classList && e.target.classList.contains('modal')) {
                e.target.classList.remove('active', 'is-open');
            }
        });
    }

    /* ---------- 7. Formularios ---------- */

    function validacionVisible() {
        // El error aparece cuando la persona sale del campo, no mientras escribe.
        document.addEventListener('blur', function (e) {
            const campo = e.target;
            if (!campo.matches || !campo.matches('input, select, textarea')) return;
            if (!campo.value && !campo.required) {
                campo.classList.remove('is-invalid', 'is-valid');
                return;
            }
            campo.classList.toggle('is-invalid', !campo.checkValidity());
            campo.classList.toggle('is-valid', campo.checkValidity() && !!campo.value);
        }, true);

        document.addEventListener('input', function (e) {
            if (e.target.classList && e.target.classList.contains('is-invalid') && e.target.checkValidity()) {
                e.target.classList.remove('is-invalid');
            }
        });
    }

    /* ---------- 8. Anillos de compatibilidad ---------- */

    /** Cualquier .match-ring[data-pct] se anima al entrar en pantalla. */
    function anillos(root) {
        (root || document).querySelectorAll('.match-ring[data-pct]').forEach(function (anillo) {
            if (anillo.dataset.dibujado) return;
            anillo.dataset.dibujado = '1';
            const pct = Math.max(0, Math.min(100, parseInt(anillo.dataset.pct, 10) || 0));
            anillo.setAttribute('data-level', pct >= 80 ? 'alto' : (pct >= 55 ? 'medio' : 'bajo'));
            if (!anillo.querySelector('span')) {
                const s = document.createElement('span');
                s.textContent = pct + '%';
                anillo.appendChild(s);
            }
            if (reduceMotion) { anillo.style.setProperty('--pct', pct); return; }
            let actual = 0;
            const paso = function () {
                actual = Math.min(pct, actual + Math.max(1, pct / 28));
                anillo.style.setProperty('--pct', actual);
                if (actual < pct) requestAnimationFrame(paso);
            };
            requestAnimationFrame(paso);
        });
    }

    /* ---------- 10. Movimiento con el mouse y al hacer clic ---------- */

    // (El foco de luz que seguia al cursor dentro de las tarjetas se quito a
    // pedido de Luis: las tarjetas solo suben un poco al pasar el mouse.)
    const ONDA      = '.btn, .btn-save, .btn-apply, .btn-search-main, .search-btn, .btn-login, .btn-register';

    // (Los botones magneticos, que se acercaban al cursor, se quitaron a
    // pedido de Luis: ahora un destello los cruza al pasar el mouse, en app.css)

    /** Onda desde el punto exacto del clic (tambien en tactil). */
    function ondaAlPulsar(e) {
        if (reduceMotion || !(e.target instanceof Element)) return;
        const boton = e.target.closest(ONDA);
        if (!boton || boton.disabled) return;
        const r = boton.getBoundingClientRect();
        const lado = Math.max(r.width, r.height) * 2.2;
        const onda = document.createElement('span');
        onda.className = 'ripple';
        onda.setAttribute('aria-hidden', 'true');
        onda.style.width = onda.style.height = lado + 'px';
        onda.style.left = (e.clientX - r.left - lado / 2) + 'px';
        onda.style.top = (e.clientY - r.top - lado / 2) + 'px';
        boton.classList.add('has-ripple');
        boton.appendChild(onda);
        onda.addEventListener('animationend', function () { onda.remove(); });
    }

    function movimientoConMouse() {
        document.addEventListener('pointerdown', ondaAlPulsar, { passive: true });
    }

    // Tarjetas que llegan despues (vacantes de la API): aparecen y se mueven igual
    const observadorNuevos = new MutationObserver(function (mutations) {
        for (const m of mutations) {
            for (const node of m.addedNodes) {
                if (node.nodeType !== 1 || node.classList.contains('ripple')) continue;
                revelar(node);
                hidratarLottie(node);
            }
        }
    });

    /* ---------- 11. Iconos animados (Lottie, de Lottieflow) ---------- */

    // La libreria (vendor/lottie_light.min.js, ~165 KB) solo se descarga
    // la primera vez que una pagina pide una animacion.
    let cargaLottie = null;
    function cargarLottie() {
        if (window.lottie) return Promise.resolve(window.lottie);
        if (!cargaLottie) {
            cargaLottie = new Promise(function (ok, falla) {
                const s = document.createElement('script');
                s.src = RUTA_JS + 'vendor/lottie_light.min.js';
                s.onload = function () { ok(window.lottie); };
                s.onerror = falla;
                document.head.appendChild(s);
            });
        }
        return cargaLottie;
    }

    /** Dibuja assets/lottie/<nombre>.json dentro del contenedor. Si el archivo
     *  no existe o algo falla, el contenedor se queda como estaba. Con
     *  movimiento reducido se muestra el ultimo cuadro, quieto. */
    function lottie(contenedor, nombre, opciones) {
        const destino = typeof contenedor === 'string' ? document.querySelector(contenedor) : contenedor;
        if (!destino) return Promise.resolve(null);
        const o = Object.assign({ loop: false, autoplay: true }, opciones);
        const datos = fetch(RUTA_JS + '../lottie/' + nombre + '.json').then(function (r) {
            if (!r.ok) throw new Error('No existe ' + nombre + '.json');
            return r.json();
        });
        return Promise.all([cargarLottie(), datos]).then(function (res) {
            destino.innerHTML = '';
            const anim = res[0].loadAnimation({
                container: destino, renderer: 'svg', animationData: res[1],
                loop: o.loop && !reduceMotion, autoplay: false
            });
            anim.addEventListener('DOMLoaded', function () {
                if (reduceMotion) anim.goToAndStop(anim.totalFrames - 1, true);
                else if (o.autoplay) anim.play();
            });
            return anim;
        }).catch(function () { return null; });
    }

    /** <span data-lottie="exito"></span> se convierte solo en la animacion
     *  (data-lottie-loop para que se repita). Lo de adentro es el respaldo. */
    function hidratarLottie(raiz) {
        if (!raiz.querySelectorAll) return;
        const elementos = Array.from(raiz.querySelectorAll('[data-lottie]'));
        if (raiz.hasAttribute && raiz.hasAttribute('data-lottie')) elementos.push(raiz);
        elementos.forEach(function (el) {
            if (el.dataset.lottieHecho) return;
            el.dataset.lottieHecho = '1';
            lottie(el, el.getAttribute('data-lottie'), { loop: el.hasAttribute('data-lottie-loop') });
        });
    }
    UI.lottie = lottie;

    /* ---------- 12. Paleta de comandos (Ctrl+K / Cmd+K) ---------- */

    const ES_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    const API_PALETA = (typeof API_BASE_URL !== 'undefined') ? API_BASE_URL
        : (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'http://localhost:8080/api' : location.origin + '/api');

    let paleta = null, paletaAntes = null, opciones = [], elegida = 0, busquedaVacantes = null;

    /** Sin tildes ni mayusculas, para que "practica" encuentre "Práctica". */
    function normalizar(texto) {
        return (texto || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    }

    function sesion() {
        try { return JSON.parse(localStorage.getItem('userData') || 'null'); } catch (e) { return null; }
    }

    /** Acciones fijas: navegar, cuenta y preferencias. */
    function accionesFijas() {
        const s = sesion();
        const esEmpresa = s && s.userType === 'empresa';
        const lista = DESTINOS.map(function (d) {
            const href = (d.href === 'perfil-usuario.html' && esEmpresa) ? 'perfil-empresa.html' : d.href;
            return { grupo: 'Ir a', ico: d.ico, titulo: d.label === 'Perfil' ? 'Mi perfil' : d.label, claves: d.href, href: href };
        });
        lista.push({ grupo: 'Ir a', ico: 'building', titulo: 'Empresas', claves: 'empresas directorio companias negocios', href: 'empresas.html' });
        lista.push({ grupo: 'Ir a', ico: 'chart', titulo: 'Indicadores del mercado', claves: 'indicadores estadisticas cifras salarios', href: 'dashboard.html' });
        if (!localStorage.getItem('token')) {
            lista.push({ grupo: 'Cuenta', ico: 'user', titulo: 'Iniciar sesión', claves: 'entrar login acceder', href: 'login.html' });
            lista.push({ grupo: 'Cuenta', ico: 'sparkle', titulo: 'Crear mi perfil', claves: 'registro registrarme cuenta nueva', href: 'seleccionar-registro.html' });
        }
        if (recorridoDePagina) {
            lista.push({ grupo: 'Ayuda', ico: 'bulb', titulo: 'Ver el recorrido de esta página', claves: 'recorrido ayuda guia como funciona tour',
                accion: function () { UI.recorrido(Object.assign({}, recorridoDePagina, { forzar: true })); } });
        }
        TAMANOS_LETRA.forEach(function (t) {
            lista.push({ grupo: 'Preferencias', ico: 'eye', titulo: 'Tamaño de letra: ' + t.nombre.toLowerCase(),
                claves: 'letra texto grande pequena tamano zoom leer accesibilidad', accion: function () { ponerTamanoLetra(t.id); } });
        });
        const oscuro = document.documentElement.getAttribute('data-theme') === 'dark';
        lista.push({
            grupo: 'Preferencias', ico: oscuro ? 'sun' : 'moon',
            titulo: oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro', claves: 'tema oscuro claro noche',
            accion: function () {
                const boton = document.querySelector('.theme-toggle');
                if (boton) boton.click();
                else { const nuevo = oscuro ? 'light' : 'dark'; localStorage.setItem(TEMA_KEY, nuevo); aplicarTema(nuevo); }
            }
        });
        return lista;
    }

    function construirPaleta() {
        paleta = document.createElement('div');
        paleta.className = 'cmdk';
        paleta.hidden = true;
        paleta.setAttribute('role', 'dialog');
        paleta.setAttribute('aria-modal', 'true');
        paleta.setAttribute('aria-label', 'Buscar vacantes y navegar');
        paleta.innerHTML =
            '<div class="cmdk-fondo" data-cerrar></div>' +
            '<div class="cmdk-panel">' +
                '<div class="cmdk-campo">' + svgIcon('search') +
                    '<input type="text" role="combobox" aria-expanded="true" aria-controls="cmdk-lista" aria-autocomplete="list" ' +
                    'autocomplete="off" spellcheck="false" placeholder="Busca vacantes o escribe a dónde ir…" aria-label="Buscar">' +
                    '<kbd>Esc</kbd>' +
                '</div>' +
                '<ul class="cmdk-lista" id="cmdk-lista" role="listbox" aria-label="Resultados"></ul>' +
                '<div class="cmdk-pie"><span><kbd>↑</kbd><kbd>↓</kbd> moverse</span>' +
                '<span><kbd>Enter</kbd> abrir</span><span><kbd>' + (ES_MAC ? '⌘' : 'Ctrl') + '</kbd><kbd>K</kbd> abrir o cerrar</span></div>' +
            '</div>';
        document.body.appendChild(paleta);

        const campo = paleta.querySelector('input');
        campo.addEventListener('input', function () { pintarPaleta(campo.value); buscarVacantes(campo.value); });
        campo.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowDown') { e.preventDefault(); moverEleccion(1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); moverEleccion(-1); }
            else if (e.key === 'Enter') { e.preventDefault(); ejecutar(opciones[elegida]); }
            else if (e.key === 'Escape') { e.preventDefault(); cerrarPaleta(); }
            else if (e.key === 'Tab') { e.preventDefault(); } // el foco se queda en la paleta
        });
        paleta.addEventListener('click', function (e) {
            if (e.target.closest('[data-cerrar]')) return cerrarPaleta();
            const item = e.target.closest('.cmdk-item');
            if (item) ejecutar(opciones[+item.dataset.i]);
        });
        paleta.addEventListener('mousemove', function (e) {
            const item = e.target.closest('.cmdk-item');
            if (item && +item.dataset.i !== elegida) { elegida = +item.dataset.i; marcarEleccion(false); }
        });
    }

    /** Dibuja la lista: primero "buscar en vacantes", luego vacantes reales y acciones. */
    function pintarPaleta(texto, vacantes) {
        const q = normalizar(texto.trim());
        opciones = [];
        if (q) opciones.push({ grupo: 'Vacantes', ico: 'search', titulo: 'Buscar "' + texto.trim() + '" en vacantes', href: 'oportunidades.html?q=' + encodeURIComponent(texto.trim()) });
        (vacantes || []).forEach(function (v) {
            opciones.push({
                grupo: 'Vacantes', ico: 'briefcase', titulo: v.title,
                detalle: [v.companyName || (v.company && v.company.name), v.location].filter(Boolean).join(' · '),
                href: 'oportunidades.html?jobId=' + encodeURIComponent(v.id)
            });
        });
        accionesFijas().forEach(function (a) {
            if (!q || normalizar(a.titulo + ' ' + a.claves + ' ' + a.grupo).indexOf(q) !== -1) opciones.push(a);
        });
        elegida = Math.min(elegida, Math.max(opciones.length - 1, 0));

        const lista = paleta.querySelector('.cmdk-lista');
        lista.innerHTML = '';
        if (!opciones.length) {
            lista.innerHTML = '<li class="cmdk-vacio" role="presentation">Sin resultados. Prueba con un cargo, como "mesero" o "contador".</li>';
            return;
        }
        let grupoActual = '';
        opciones.forEach(function (o, i) {
            if (o.grupo !== grupoActual) {
                grupoActual = o.grupo;
                const titulo = document.createElement('li');
                titulo.className = 'cmdk-grupo';
                titulo.setAttribute('role', 'presentation');
                titulo.textContent = o.grupo;
                lista.appendChild(titulo);
            }
            const li = document.createElement('li');
            li.className = 'cmdk-item';
            li.id = 'cmdk-op-' + i;
            li.dataset.i = i;
            li.setAttribute('role', 'option');
            li.innerHTML = svgIcon(o.ico) + '<span class="cmdk-item-titulo"></span>' + (o.detalle ? '<span class="cmdk-item-detalle"></span>' : '');
            li.querySelector('.cmdk-item-titulo').textContent = o.titulo; // texto de la API: nunca como HTML
            if (o.detalle) li.querySelector('.cmdk-item-detalle').textContent = o.detalle;
            lista.appendChild(li);
        });
        marcarEleccion(false);
    }

    function marcarEleccion(desplazar) {
        paleta.querySelectorAll('.cmdk-item').forEach(function (li) {
            li.setAttribute('aria-selected', String(+li.dataset.i === elegida));
        });
        const actual = paleta.querySelector('#cmdk-op-' + elegida);
        paleta.querySelector('input').setAttribute('aria-activedescendant', actual ? actual.id : '');
        if (actual && desplazar) actual.scrollIntoView({ block: 'nearest' });
    }

    function moverEleccion(paso) {
        if (!opciones.length) return;
        elegida = (elegida + paso + opciones.length) % opciones.length;
        marcarEleccion(true);
    }

    /** Vacantes reales mientras se escribe (GET /api/jobs/search es publico). */
    const buscarVacantes = (function () {
        let espera = 0;
        return function (texto) {
            clearTimeout(espera);
            const q = texto.trim();
            if (busquedaVacantes) busquedaVacantes.abort();
            if (q.length < 2) return;
            espera = setTimeout(function () {
                busquedaVacantes = new AbortController();
                // El backend usa el texto como expresion regular: "(" le daba error
                const seguro = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                fetch(API_PALETA + '/jobs/search?keyword=' + encodeURIComponent(seguro), { signal: busquedaVacantes.signal })
                    .then(function (r) { return r.ok ? r.json() : null; })
                    .then(function (datos) {
                        if (!datos || paleta.hidden) return;
                        const vacantes = (datos.content || datos || []).slice(0, 5);
                        if (paleta.querySelector('input').value.trim() === q) pintarPaleta(q, vacantes);
                    })
                    .catch(function () { /* sin backend: quedan las acciones */ });
            }, 220);
        };
    })();

    function ejecutar(opcion) {
        if (!opcion) return;
        cerrarPaleta();
        if (opcion.accion) opcion.accion();
        else if (opcion.href) window.location.href = opcion.href;
    }

    function abrirPaleta() {
        if (!paleta) construirPaleta();
        if (!paleta.hidden) return;
        paletaAntes = document.activeElement;
        paleta.hidden = false;
        document.documentElement.classList.add('cmdk-abierta');
        const campo = paleta.querySelector('input');
        campo.value = '';
        elegida = 0;
        pintarPaleta('');
        campo.focus();
    }

    function cerrarPaleta() {
        if (!paleta || paleta.hidden) return;
        paleta.hidden = true;
        document.documentElement.classList.remove('cmdk-abierta');
        if (busquedaVacantes) busquedaVacantes.abort();
        if (paletaAntes && paletaAntes.focus) paletaAntes.focus();
    }
    UI.paleta = { abrir: abrirPaleta, cerrar: cerrarPaleta };

    /** Atajo de teclado y boton en la barra superior para descubrirla. */
    function paletaDeComandos() {
        document.addEventListener('keydown', function (e) {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
                e.preventDefault();
                if (paleta && !paleta.hidden) cerrarPaleta(); else abrirPaleta();
            }
        });
        const toggle = document.querySelector('.theme-toggle');
        if (!toggle || document.querySelector('.cmdk-boton')) return;
        const boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'cmdk-boton';
        boton.setAttribute('aria-label', 'Buscar vacantes y navegar (' + (ES_MAC ? 'Cmd' : 'Ctrl') + ' + K)');
        // En la barra se ve solo la lupa: el texto de ayuda sale al pasar el mouse
        boton.setAttribute('title', 'Buscar (' + (ES_MAC ? '⌘' : 'Ctrl') + ' + K)');
        boton.innerHTML = svgIcon('search') + '<span class="cmdk-texto">Buscar</span><kbd class="cmdk-atajo">' + (ES_MAC ? '⌘K' : 'Ctrl K') + '</kbd>';
        boton.addEventListener('click', abrirPaleta);
        const li = document.createElement('li');
        li.appendChild(boton);
        toggle.parentElement.parentElement.insertBefore(li, toggle.parentElement);
    }

    /* ---------- 13. Tooltips animados ---------- */

    // Botones de solo icono (title), el interruptor de tema y el anillo de match.
    // Aparecen al pasar el mouse (con una pausa corta) o al llegar con el teclado.
    const CON_TOOLTIP = 'button[title], a[title], [role="button"][title], [data-tooltip], .theme-toggle, .match-ring[aria-label]';
    let globo = null, globoDe = null, esperaGlobo = 0;

    function textoTooltip(el) {
        // El title nativo se pasa a data-tooltip (si no, salen dos globos) sin perder el nombre accesible
        if (el.hasAttribute('title')) {
            const t = el.getAttribute('title');
            el.removeAttribute('title');
            if (!el.dataset.tooltip) el.dataset.tooltip = t;
            if (!el.hasAttribute('aria-label') && !el.textContent.trim()) el.setAttribute('aria-label', t);
        }
        return el.dataset.tooltip || el.getAttribute('aria-label') || '';
    }

    function mostrarTooltip(el) {
        const texto = textoTooltip(el);
        if (!texto) return;
        if (!globo) {
            globo = document.createElement('div');
            globo.className = 'tooltip';
            globo.setAttribute('role', 'tooltip');
            document.body.appendChild(globo);
        }
        globo.textContent = texto;
        globo.classList.remove('is-visible');
        const r = el.getBoundingClientRect(), g = globo.getBoundingClientRect();
        const abajo = r.top - g.height - 10 < 8;
        const izquierda = Math.max(8, Math.min(window.innerWidth - g.width - 8, r.left + r.width / 2 - g.width / 2));
        globo.dataset.lado = abajo ? 'abajo' : 'arriba';
        globo.style.left = izquierda + 'px';
        globo.style.top = (abajo ? r.bottom + 10 : r.top - g.height - 10) + 'px';
        globo.style.setProperty('--flecha', (r.left + r.width / 2 - izquierda) + 'px');
        globoDe = el;
        requestAnimationFrame(function () { globo.classList.add('is-visible'); });
    }

    function ocultarTooltip() {
        clearTimeout(esperaGlobo);
        if (globo) globo.classList.remove('is-visible');
        globoDe = null;
    }

    function tooltips() {
        const conMouseFino = window.matchMedia('(hover: hover)').matches;
        if (conMouseFino) {
            document.addEventListener('pointerover', function (e) {
                const el = e.target instanceof Element && e.target.closest(CON_TOOLTIP);
                if (!el || el === globoDe) return;
                clearTimeout(esperaGlobo);
                textoTooltip(el); // quita el title de inmediato para que no salga el nativo
                esperaGlobo = setTimeout(function () { mostrarTooltip(el); }, 350);
            });
            document.addEventListener('pointerout', function (e) {
                const el = e.target instanceof Element && e.target.closest(CON_TOOLTIP);
                if (el && !el.contains(e.relatedTarget)) ocultarTooltip();
            });
        }
        document.addEventListener('focusin', function (e) {
            const el = e.target instanceof Element && e.target.closest(CON_TOOLTIP);
            if (el && el.matches(':focus-visible')) mostrarTooltip(el);
        });
        document.addEventListener('focusout', ocultarTooltip);
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') ocultarTooltip(); });
        window.addEventListener('scroll', ocultarTooltip, { passive: true });
        document.addEventListener('pointerdown', ocultarTooltip, { passive: true });
    }

    /* ---------- 14. Avisos de la marca en lugar de alert() ---------- */

    // Los modulos usan alert() (unas 80 veces) y el navegador lo muestra como
    // una ventana gris que bloquea la pagina. Aqui se convierte en un aviso de
    // SkillMatchUI.aviso. Si la pagina cambia justo despues (por ejemplo
    // "Registro exitoso" y luego ir al login), el aviso aparece en la siguiente.
    // confirm() no se toca: necesita una respuesta si/no en el momento.
    const AVISOS_KEY = 'skillmatch_avisos_pendientes';
    const avisosRecientes = [];

    function tipoDeAviso(texto) {
        const t = normalizar(texto);
        if (/error|no se pudo|no pudimos|invalid|incorrect|debe|complet|fall|requerid|no coincid|ingresa|selecciona|inicia sesion/.test(t)) return 'error';
        if (/exito|exitos|guardad|enviad|correctamente|actualizad|cread|registrad|eliminad|agregad|bienvenid|aplicaste/.test(t)) return 'ok';
        return 'info';
    }

    function escaparHtml(texto) {
        return texto.replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function mostrarAviso(texto, tipo) {
        UI.aviso(escaparHtml(texto), tipo, tipo === 'error' ? 6500 : 4200);
    }

    // Se instala al cargar ui.js (no al terminar la pagina): algunos modulos
    // avisan en su propio DOMContentLoaded, que corre antes que el de ui.js.
    window.alert = function (mensaje) {
        const texto = String(mensaje == null ? '' : mensaje);
        const tipo = tipoDeAviso(texto);
        avisosRecientes.push({ texto: texto, tipo: tipo, t: Date.now() });
        if (document.body) mostrarAviso(texto, tipo);
    };
    window.addEventListener('pagehide', function () {
        // Solo los avisos que dispararon el cambio de pagina (alert + redireccion seguida)
        const vigentes = avisosRecientes.filter(function (a) { return Date.now() - a.t < 800; });
        if (!vigentes.length) return;
        try { sessionStorage.setItem(AVISOS_KEY, JSON.stringify(vigentes)); } catch (e) { /* modo privado */ }
    });

    /** Muestra los avisos que quedaron pendientes de la pagina anterior. */
    function avisosPendientes() {
        let pendientes = [];
        try {
            pendientes = JSON.parse(sessionStorage.getItem(AVISOS_KEY) || '[]');
            sessionStorage.removeItem(AVISOS_KEY);
        } catch (e) { return; }
        pendientes.forEach(function (a) { mostrarAviso(a.texto, a.tipo); });
    }

    /* ---------- 15. Pie de pagina grande (el mismo en todas las paginas) ---------- */

    // Una sola fuente para las 13 paginas: aqui se dibuja dentro del <footer>
    // que trae cada HTML (si el JS fallara, queda el texto corto de siempre).
    // Solo enlaces reales; nada de redes ni datos de contacto inventados.
    const PIE_COLUMNAS = [
        { titulo: 'Busco trabajo', enlaces: [
            ['seleccionar-registro.html', 'Crear mi perfil'],
            ['oportunidades.html', 'Ver vacantes'],
            ['empresas.html', 'Conocer las empresas'],
            ['login-usuario.html', 'Iniciar sesión']
        ] },
        { titulo: 'Empresas', enlaces: [
            ['registro-empresa.html', 'Registrar mi empresa'],
            ['login-empresa.html', 'Acceso empresas']
        ] },
        { titulo: 'SkillMatch', enlaces: [
            ['index.html#como-funciona', 'Cómo funciona'],
            ['index.html#mapa-cartagena', 'Cartagena por zonas'],
            ['dashboard.html', 'Indicadores del mercado'],
            ['index.html#innovacion', 'Lo que viene'],
            // La Ley 1581 pide que la politica de datos este siempre a la mano
            ['politica-datos.html', 'Política de datos']
        ] }
    ];

    function construirPie() {
        const pie = document.querySelector('body > footer');
        if (!pie || pie.classList.contains('pie')) return;
        pie.classList.add('pie');
        pie.innerHTML =
            '<div class="pie-ola" aria-hidden="true"></div>' +
            '<div class="container">' +
                '<div class="pie-grid">' +
                    '<div class="pie-marca">' +
                        '<a href="index.html" class="pie-logo"><img src="../assets/img/logo-oscuro.png" alt="SkillMatch, ir al inicio" width="531" height="160" loading="lazy"></a>' +
                        '<p>La bolsa de empleo de Cartagena para todos los sectores: compara tus habilidades con cada vacante de la ciudad antes de postularte.</p>' +
                    '</div>' +
                    '<nav class="pie-columnas" aria-label="Enlaces del pie de página">' +
                        PIE_COLUMNAS.map(function (col) {
                            return '<div><h2 class="pie-titulo">' + col.titulo + '</h2><ul>' +
                                col.enlaces.map(function (e) { return '<li><a href="' + e[0] + '">' + e[1] + '</a></li>'; }).join('') +
                                '</ul></div>';
                        }).join('') +
                    '</nav>' +
                '</div>' +
                '<div class="pie-base">' +
                    '<p>&copy; ' + new Date().getFullYear() + ' SkillMatch Cartagena · Hecho en Cartagena de Indias para conectar a las personas y las empresas de la ciudad.</p>' +
                    // Tamano de letra (seccion 22): tres botones, el elegido marcado
                    '<div class="pie-letra" role="group" aria-label="Tamaño de letra">' +
                        '<span>Letra</span>' +
                        TAMANOS_LETRA.map(function (t) {
                            return '<button type="button" class="pie-letra-btn" data-letra="' + t.id + '" aria-pressed="false" aria-label="' + t.nombre + '" title="' + t.nombre + '">A</button>';
                        }).join('') +
                    '</div>' +
                    '<div class="pie-acciones">' +
                        // Solo aparece cuando el navegador deja instalar (seccion 21)
                        '<button type="button" class="pie-instalar" hidden><i data-ico="download"></i>Instalar la app</button>' +
                        '<button type="button" class="pie-arriba"><i data-ico="arrow"></i>Volver arriba</button>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="pie-gigante" aria-hidden="true"><span>Skill</span><span>Match</span></div>';

        pie.querySelectorAll('.pie-letra-btn').forEach(function (b) {
            b.addEventListener('click', function () { ponerTamanoLetra(b.dataset.letra); });
        });
        marcarTamanoLetra();

        // Volver arriba: sube (suave si se permite movimiento) y deja el foco
        // en el logo de la barra, para que con teclado se siga desde ahi
        pie.querySelector('.pie-arriba').addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
            const inicio = document.querySelector('header a');
            if (inicio) inicio.focus({ preventScroll: true });
        });

        // La palabra gigante sube al entrar en pantalla
        const gigante = pie.querySelector('.pie-gigante');
        if (reduceMotion || !('IntersectionObserver' in window)) {
            gigante.classList.add('is-visible');
        } else {
            const obs = new IntersectionObserver(function (entradas) {
                if (!entradas[0].isIntersecting) return;
                gigante.classList.add('is-visible');
                obs.disconnect();
            }, { threshold: 0.2 });
            obs.observe(gigante);
        }
    }

    /* ---------- 16. Listas desplegables ---------- */

    // La lista nativa de un <select> no se puede decorar: en Windows sale gris,
    // cuadrada y con todas las ciudades de golpe. Con <select data-lista> se
    // dibuja una de la marca y el <select> queda escondido como fuente de
    // verdad: al elegir se cambia su valor y se lanza "change", asi el codigo
    // de cada pagina no cambia. Con data-lista="buscable" se escribe para
    // filtrar (sin tildes y perdonando un error de tipeo).
    // Atributos opcionales: data-icono (icono del campo), data-todas (opcion
    // para quitar el filtro), data-destacar (grupo arriba con las opciones que
    // tienen resultados) y, en cada <option>, data-icono y data-cuenta.
    // (data-icono y no data-ico: hydrateIcons cambiaria el <option> por un SVG.)
    const LISTAS = [];
    let listasCreadas = 0;

    /** Opciones del <select>: "Turbaco (Bolívar)" -> texto "Turbaco", detalle "Bolívar". */
    function leerOpciones(select) {
        const items = [];
        Array.from(select.options).forEach(function (op) {
            if (!op.value) return;
            const completo = op.textContent.trim();
            const m = completo.match(/^(.*?)\s*\(([^)]+)\)$/);
            const cuenta = op.getAttribute('data-cuenta');
            items.push({
                valor: op.value,
                texto: m ? m[1] : completo,
                detalle: m ? m[2] : '',
                grupo: op.parentElement.tagName === 'OPTGROUP' ? op.parentElement.label : '',
                icono: op.getAttribute('data-icono') || '',
                cuenta: cuenta === null ? null : Number(cuenta),
                clave: normalizar(completo)
            });
        });
        return items;
    }

    // Cambios minimos para pasar de una palabra a otra (letra cambiada, de mas,
    // de menos o dos invertidas): "cartajena" esta a 1 de "cartagena".
    function distancia(a, b) {
        const d = [];
        for (let i = 0; i <= a.length; i++) d.push([i]);
        for (let j = 1; j <= b.length; j++) d[0][j] = j;
        for (let i = 1; i <= a.length; i++) {
            for (let j = 1; j <= b.length; j++) {
                d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
                if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
            }
        }
        return d[a.length][b.length];
    }

    // Que tan bien responde una opcion a lo escrito: 4 empieza igual, 3 una de
    // sus palabras empieza igual, 2 lo contiene, 1 se parece (error de tipeo).
    function parecido(item, q) {
        if (item.clave.startsWith(q)) return 4;
        if (item.clave.split(/[^a-z0-9]+/).some(function (p) { return p.startsWith(q); })) return 3;
        if (item.clave.includes(q)) return 2;
        if (q.length < 4) return 0;
        const tolerancia = q.length >= 7 ? 2 : 1;
        const palabras = item.clave.split(/[^a-z0-9]+/).filter(Boolean);
        palabras.push(palabras.join(' '));
        for (const p of palabras) {
            for (let largo = q.length - 1; largo <= q.length + 1; largo++) {
                if (largo > 0 && distancia(q, p.slice(0, largo)) <= tolerancia) return 1;
            }
        }
        return 0;
    }

    /** Texto con la parte que coincide resaltada (el indice sirve igual sin tildes). */
    function resaltar(texto, q) {
        const i = q ? normalizar(texto).indexOf(q) : -1;
        if (i < 0) return escaparHtml(texto);
        return escaparHtml(texto.slice(0, i)) + '<mark>' + escaparHtml(texto.slice(i, i + q.length)) + '</mark>' + escaparHtml(texto.slice(i + q.length));
    }

    function itemElegido(L) {
        return L.items.find(function (it) { return it.valor === L.select.value; }) || null;
    }

    /** Lo que muestra el campo cerrado: la opcion elegida o el texto de la vacia. */
    function pintarControl(L) {
        const it = itemElegido(L);
        L.raiz.classList.toggle('tiene-valor', !!it);
        if (L.buscable) {
            if (document.activeElement !== L.control || !L.abierta) L.control.value = it ? it.texto : '';
            L.limpiar.hidden = !it;
        } else {
            L.valor.textContent = it ? it.texto : L.vacia;
        }
    }

    /** Arma la lista visible: grupos, coincidencias resaltadas y conteos. */
    function pintarPanel(L) {
        const q = L.buscable ? normalizar(L.control.value.trim()) : '';
        const elegido = L.select.value;
        let filas = [];
        L.visibles = [];

        if (q) {
            const puntuados = L.items.map(function (it, orden) { return { it: it, p: parecido(it, q), orden: orden }; })
                .filter(function (x) { return x.p > 0; });
            const directos = puntuados.filter(function (x) { return x.p > 1; });
            // Los parecidos solo salen si nada coincide de verdad ("¿quisiste decir?")
            const usados = directos.length ? directos : puntuados;
            usados.sort(function (a, b) {
                return (b.p - a.p) || ((b.it.cuenta || 0) - (a.it.cuenta || 0)) || (a.orden - b.orden);
            });
            if (!directos.length && usados.length) filas.push({ grupo: 'Quizás quisiste decir' });
            usados.forEach(function (x) { filas.push({ it: x.it }); });
        } else {
            if (L.todas && (elegido || !L.buscable)) filas.push({ it: { valor: '', texto: L.todas, detalle: '', icono: '', cuenta: null } });
            let resto = L.items;
            // El titulo del grupo se lee cada vez: la pagina lo cambia segun sus datos
            const destacar = L.select.getAttribute('data-destacar') || '';
            const conResultados = destacar ? L.items.filter(function (it) { return it.cuenta > 0; }) : [];
            if (conResultados.length) {
                filas.push({ grupo: destacar });
                conResultados.slice().sort(function (a, b) { return b.cuenta - a.cuenta; })
                    .forEach(function (it) { filas.push({ it: it }); });
                resto = L.items.filter(function (it) { return !(it.cuenta > 0); });
            }
            let grupo = null;
            resto.forEach(function (it) {
                if (it.grupo && it.grupo !== grupo) filas.push({ grupo: it.grupo });
                grupo = it.grupo;
                filas.push({ it: it });
            });
        }

        let html = '', grupoVisto = '';
        filas.forEach(function (f) {
            if (f.grupo) { grupoVisto = f.grupo; html += '<li class="lista-grupo" role="presentation">' + escaparHtml(f.grupo) + '</li>'; return; }
            const it = f.it, n = L.visibles.length;
            // Bajo el grupo "Bolívar" no hace falta repetir "Bolívar" en cada ciudad
            const detalle = (it.detalle && (q || it.detalle !== grupoVisto)) ? it.detalle : '';
            L.visibles.push(it);
            const sel = it.valor === elegido;
            html += '<li class="lista-opcion" role="option" id="' + L.id + '-op' + n + '" data-n="' + n + '" aria-selected="' + sel + '">' +
                (it.icono ? svgIcon(it.icono, 'lista-icono') : '') +
                '<span class="lista-texto">' + resaltar(it.texto, q) +
                (detalle ? ' <small>' + resaltar(detalle, q) + '</small>' : '') + '</span>' +
                (it.cuenta !== null && it.cuenta !== undefined
                    ? '<span class="lista-cuenta' + (it.cuenta ? '' : ' es-cero') + '">' + it.cuenta + '<span class="sr-only">' + (it.cuenta === 1 ? ' vacante' : ' vacantes') + '</span></span>'
                    : '') +
                (sel ? svgIcon('check', 'lista-check') : '') + '</li>';
        });
        if (!L.visibles.length) {
            html = '<li class="lista-vacia" role="presentation">No encontramos «' + escaparHtml(L.control.value.trim()) + '». ' +
                   escaparHtml(L.select.getAttribute('data-vacio') || 'Prueba con otra palabra.') + '</li>';
        }
        L.panel.innerHTML = html;
        if (L.buscable && q) {
            L.estado.textContent = L.visibles.length ? L.visibles.length + (L.visibles.length === 1 ? ' resultado' : ' resultados') : 'Sin resultados';
        }
    }

    /** Marca la opcion activa (la que eligen Enter o las flechas). */
    function activar(L, n, desplazar) {
        L.activa = Math.max(0, Math.min(n, L.visibles.length - 1));
        L.panel.querySelectorAll('.lista-opcion.is-activa').forEach(function (li) { li.classList.remove('is-activa'); });
        const li = L.panel.querySelector('[data-n="' + L.activa + '"]');
        if (!li) { L.control.removeAttribute('aria-activedescendant'); return; }
        li.classList.add('is-activa');
        L.control.setAttribute('aria-activedescendant', li.id);
        if (desplazar !== false) li.scrollIntoView({ block: 'nearest' });
    }

    function abrirLista(L) {
        if (L.abierta) return;
        LISTAS.forEach(function (otra) { if (otra !== L) cerrarLista(otra); });
        L.abierta = true;
        pintarPanel(L);
        // Se abre hacia arriba si abajo no cabe (celular con el teclado abierto)
        const r = L.raiz.getBoundingClientRect();
        const abajo = window.innerHeight - r.bottom, arriba = r.top - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-bar-h')) || 0);
        const haciaArriba = abajo < 240 && arriba > abajo;
        L.raiz.classList.toggle('lista-arriba', haciaArriba);
        L.panel.style.maxHeight = Math.max(160, Math.min(340, (haciaArriba ? arriba : abajo) - 16)) + 'px';
        L.raiz.classList.remove('lista-derecha');
        L.panel.hidden = false;
        if (L.panel.getBoundingClientRect().right > document.documentElement.clientWidth - 8) L.raiz.classList.add('lista-derecha');
        L.raiz.classList.add('is-abierta');
        L.control.setAttribute('aria-expanded', 'true');
        const actual = L.visibles.findIndex(function (it) { return it.valor === L.select.value; });
        activar(L, actual >= 0 ? actual : 0);
    }

    function cerrarLista(L) {
        if (!L.abierta) return;
        L.abierta = false;
        L.panel.hidden = true;
        L.raiz.classList.remove('is-abierta');
        L.control.setAttribute('aria-expanded', 'false');
        L.control.removeAttribute('aria-activedescendant');
        pintarControl(L);
    }

    function elegirOpcion(L, it) {
        const cambio = L.select.value !== it.valor;
        L.select.value = it.valor;
        cerrarLista(L);
        if (L.buscable) L.control.value = it.valor ? it.texto : '';
        pintarControl(L);
        if (cambio) L.select.dispatchEvent(new Event('change', { bubbles: true }));
    }

    /** Al salir del campo buscable: si lo escrito es una opcion exacta se elige; si se borro, se quita el filtro. */
    function resolverEscrito(L) {
        const q = normalizar(L.control.value.trim());
        if (!q) { elegirOpcion(L, { valor: '', texto: '' }); return; }
        const exacta = L.items.find(function (it) { return normalizar(it.texto) === q || it.clave === q; });
        if (exacta) elegirOpcion(L, exacta);
        else cerrarLista(L);
    }

    function teclasLista(L, e) {
        const k = e.key;
        if (k === 'ArrowDown' || k === 'ArrowUp') {
            e.preventDefault();
            if (!L.abierta) { abrirLista(L); return; }
            activar(L, L.activa + (k === 'ArrowDown' ? 1 : -1));
        } else if ((k === 'Home' || k === 'End') && L.abierta && !L.buscable) {
            e.preventDefault();
            activar(L, k === 'Home' ? 0 : L.visibles.length - 1);
        } else if (k === 'Enter' || (k === ' ' && !L.buscable)) {
            if (L.abierta && L.visibles[L.activa]) { e.preventDefault(); elegirOpcion(L, L.visibles[L.activa]); }
            else if (!L.buscable) { e.preventDefault(); abrirLista(L); }
        } else if (k === 'Escape') {
            if (L.abierta) { e.preventDefault(); e.stopPropagation(); cerrarLista(L); }
            else if (L.buscable && L.select.value) { e.preventDefault(); elegirOpcion(L, { valor: '', texto: '' }); }
        } else if (k === 'Tab' && L.abierta) {
            if (L.buscable) resolverEscrito(L);
            else cerrarLista(L);
        } else if (!L.buscable && k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            // Escribir con la lista de botones salta a la opcion que empieza asi
            clearTimeout(L.tecleo);
            L.letras = (L.letras || '') + normalizar(k);
            L.tecleo = setTimeout(function () { L.letras = ''; }, 600);
            if (!L.abierta) abrirLista(L);
            const n = L.visibles.findIndex(function (it) { return normalizar(it.texto).startsWith(L.letras); });
            if (n >= 0) activar(L, n);
        }
    }

    function crearLista(select) {
        if (select.hasAttribute('data-lista-lista')) return;
        select.setAttribute('data-lista-lista', '');
        const n = ++listasCreadas;
        const L = {
            select: select,
            buscable: select.getAttribute('data-lista') === 'buscable',
            id: (select.id || 'lista' + n) + '-lista',
            todas: select.getAttribute('data-todas') || '',
            vacia: (select.options[0] && !select.options[0].value) ? select.options[0].textContent.trim() : 'Elegir',
            items: leerOpciones(select),
            visibles: [], activa: 0, abierta: false
        };
        const label = select.id ? document.querySelector('label[for="' + select.id + '"]') : null;
        const nombre = label ? label.textContent.trim() : L.vacia;
        const icono = select.getAttribute('data-icono');

        L.raiz = document.createElement('div');
        L.raiz.className = 'lista' + (L.buscable ? ' lista-buscable' : '');
        L.raiz.innerHTML =
            (L.buscable
                ? '<div class="lista-campo">' + (icono ? svgIcon(icono, 'lista-campo-icono') : '') +
                  '<input type="text" id="' + L.id + '" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="' + L.id + '-panel" autocomplete="off" spellcheck="false" placeholder="' + escaparHtml(select.getAttribute('data-placeholder') || L.vacia) + '">' +
                  '<button type="button" class="lista-limpiar" aria-label="Quitar ' + escaparHtml(nombre.toLowerCase()) + '" hidden>' + svgIcon('close') + '</button>' +
                  svgIcon('chevron', 'lista-flecha') + '</div>'
                : '<button type="button" class="lista-boton" id="' + L.id + '" role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-controls="' + L.id + '-panel">' +
                  (icono ? svgIcon(icono, 'lista-campo-icono') : '') + '<span class="lista-valor"></span>' + svgIcon('chevron', 'lista-flecha') + '</button>') +
            '<ul class="lista-panel" id="' + L.id + '-panel" role="listbox" aria-label="' + escaparHtml(nombre) + '" hidden></ul>' +
            (L.buscable ? '<span class="sr-only" role="status" aria-live="polite"></span>' : '');
        select.after(L.raiz);
        select.hidden = true;
        select.tabIndex = -1;

        L.control = L.raiz.querySelector('#' + CSS.escape(L.id));
        L.panel = L.raiz.querySelector('.lista-panel');
        L.valor = L.raiz.querySelector('.lista-valor');
        L.limpiar = L.raiz.querySelector('.lista-limpiar');
        L.estado = L.raiz.querySelector('[role="status"]');
        // El <label for> del select ahora nombra al campo nuevo
        if (label) label.htmlFor = L.id;
        else L.control.setAttribute('aria-label', nombre);

        L.control.addEventListener('keydown', function (e) { teclasLista(L, e); });
        if (L.buscable) {
            L.control.addEventListener('click', function () { abrirLista(L); });
            L.control.addEventListener('focus', function () { L.control.select(); });
            L.control.addEventListener('input', function () {
                if (!L.abierta) abrirLista(L);
                else pintarPanel(L);
                activar(L, 0);
            });
            L.control.addEventListener('blur', function () {
                // El clic en una opcion no quita el foco (mousedown cancelado)
                setTimeout(function () { if (!L.raiz.contains(document.activeElement)) resolverEscrito(L); }, 0);
            });
            L.raiz.querySelector('.lista-campo').addEventListener('mousedown', function (e) { if (e.target !== L.control) e.preventDefault(); });
            L.limpiar.addEventListener('click', function () {
                elegirOpcion(L, { valor: '', texto: '' });
                L.control.focus();
            });
            L.raiz.querySelector('.lista-flecha').addEventListener('click', function () {
                if (L.abierta) cerrarLista(L); else { L.control.focus(); abrirLista(L); }
            });
        } else {
            L.control.addEventListener('click', function () { if (L.abierta) cerrarLista(L); else abrirLista(L); });
            L.control.addEventListener('blur', function () { setTimeout(function () { if (!L.raiz.contains(document.activeElement)) cerrarLista(L); }, 0); });
        }
        // Elegir con el mouse sin que el campo pierda el foco
        L.panel.addEventListener('mousedown', function (e) { e.preventDefault(); });
        L.panel.addEventListener('click', function (e) {
            const li = e.target.closest('.lista-opcion');
            if (!li) return;
            elegirOpcion(L, L.visibles[Number(li.dataset.n)]);
            if (L.buscable && window.matchMedia('(pointer: coarse)').matches) L.control.blur();
        });
        L.panel.addEventListener('pointermove', function (e) {
            const li = e.target.closest('.lista-opcion');
            if (li && e.pointerType === 'mouse' && Number(li.dataset.n) !== L.activa) activar(L, Number(li.dataset.n), false);
        });
        // Si otra parte del codigo cambia el select (valor u opciones), se repinta
        select.addEventListener('change', function () { pintarControl(L); });
        new MutationObserver(function () {
            L.items = leerOpciones(select);
            if (L.abierta) { pintarPanel(L); activar(L, L.activa, false); }
            pintarControl(L);
        }).observe(select, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-cuenta'] });

        pintarControl(L);
        LISTAS.push(L);
    }

    function listas(raiz) {
        (raiz || document).querySelectorAll('select[data-lista]').forEach(crearLista);
    }
    UI.listas = listas;

    // Un clic o toque fuera cierra la lista abierta
    document.addEventListener('pointerdown', function (e) {
        LISTAS.forEach(function (L) {
            if (!L.abierta || L.raiz.contains(e.target)) return;
            if (L.buscable) resolverEscrito(L); else cerrarLista(L);
        });
    });

    /* ---------- 17. Etiquetas (habilidades) ---------- */

    // Sugerencias para cualquier campo de habilidades: primero las de cualquier
    // oficio y al final las de tecnología (docs/GUIA-DE-LENGUAJE.md)
    UI.HABILIDADES_SUGERIDAS = [
        'Atención al cliente', 'Ventas', 'Manejo de caja', 'Excel', 'Inglés', 'Comunicación', 'Trabajo en equipo',
        'Servicio de mesa', 'Cocina', 'Manipulación de alimentos', 'Bartender', 'Recepción', 'Reservas',
        'Aseo y limpieza', 'Conducción', 'Licencia de conducción C2', 'Bodega e inventarios', 'Montacargas',
        'Electricidad', 'Soldadura', 'Construcción', 'Mantenimiento', 'Primeros auxilios', 'Enfermería',
        'Facturación', 'Contabilidad', 'Archivo', 'Office', 'Guía turístico', 'Logística', 'Turismo',
        'Marketing digital', 'Redes sociales', 'Diseño gráfico', 'Power BI', 'Gestión de proyectos',
        'Python', 'Java', 'JavaScript', 'TypeScript', 'React', 'Angular', 'Vue.js', 'Node.js',
        'Spring Boot', 'Django', 'Flask', 'PHP', 'Laravel', 'C#', '.NET', 'Kotlin', 'Swift', 'Flutter',
        'SQL', 'MySQL', 'PostgreSQL', 'MongoDB', 'Git', 'Docker', 'Kubernetes', 'AWS', 'Azure', 'GCP',
        'REST API', 'GraphQL', 'CI/CD', 'TDD'
    ];

    /**
     * Campo de etiquetas: se escribe y Enter o coma agrega; la × o Retroceso
     * quita; elegir una sugerencia también agrega. "caja" es el contenedor con
     * la clase .chips-campo y "campo" el <input> de adentro.
     * Devuelve { obtener() } con la lista (agrega lo que quedó escrito).
     */
    UI.etiquetas = function (caja, campo, opciones) {
        opciones = opciones || {};
        const maximo = opciones.maximo || 15;
        const sugeridas = opciones.sugeridas || UI.HABILIDADES_SUGERIDAS;
        let lista = [];

        // Sugerencias del navegador (datalist) con el id del campo
        const idLista = campo.id + '-sugerencias';
        if (!document.getElementById(idLista)) {
            const datos = document.createElement('datalist');
            datos.id = idLista;
            datos.innerHTML = sugeridas.map(function (s) { return '<option value="' + escaparHtml(s) + '">'; }).join('');
            caja.after(datos);
        }
        campo.setAttribute('list', idLista);

        function pintar() {
            caja.querySelectorAll('.chip').forEach(function (chip) { chip.remove(); });
            lista.forEach(function (texto, i) {
                const chip = document.createElement('span');
                chip.className = 'chip';
                chip.innerHTML = escaparHtml(texto) + '<button type="button" data-i="' + i + '" aria-label="Quitar ' + escaparHtml(texto) + '">' + svgIcon('close') + '</button>';
                caja.insertBefore(chip, campo);
            });
        }
        function agregar(texto) {
            String(texto).split(',').map(function (t) { return t.trim().slice(0, 40); }).filter(Boolean).forEach(function (t) {
                const repetida = lista.some(function (h) { return normalizar(h) === normalizar(t); });
                if (!repetida && lista.length < maximo) lista.push(t);
            });
            campo.value = '';
            pintar();
        }

        campo.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                agregar(campo.value);
            } else if (e.key === 'Backspace' && !campo.value && lista.length) {
                lista.pop();
                pintar();
            }
        });
        campo.addEventListener('input', function () {
            if (sugeridas.indexOf(campo.value) >= 0) agregar(campo.value);
        });
        caja.addEventListener('click', function (e) {
            const quitar = e.target.closest('button[data-i]');
            if (quitar) {
                lista.splice(Number(quitar.dataset.i), 1);
                pintar();
            }
            campo.focus();
        });

        agregar((opciones.iniciales || []).join(','));
        return {
            obtener: function () {
                if (campo.value.trim()) agregar(campo.value);
                return lista.slice();
            }
        };
    };

    /* ---------- 18. Carrusel de vacantes ---------- */

    // Resultados de la busqueda de la portada. La tarjeta del centro va de
    // frente y completa, para que se pueda leer; las de los lados se inclinan,
    // se alejan y se oscurecen como vista previa. Se mueve con las flechas, los
    // puntos, el teclado (izquierda, derecha, Inicio, Fin), arrastrando con el
    // mouse, deslizando el dedo, con el gesto horizontal del touchpad y al tocar
    // una tarjeta de los lados.
    //
    // La posicion es un numero continuo (2,4 = entre la tercera y la cuarta).
    // Al tocar o soltar, el recorrido de cada tarjeta se le entrega al navegador
    // de una vez (Web Animations) y el lo dibuja en su propio hilo: sigue suave
    // aunque el celular este ocupado. Mientras se arrastra, la tarjeta sigue al
    // dedo directamente. Solo se animan transform y opacity.

    const CARRUSEL_CELULAR = window.matchMedia('(max-width: 700px)');
    const CARRUSEL_ANIMA = typeof Element.prototype.animate === 'function';
    // Curva de frenado: arranca con decision y frena suave. La misma en CSS
    // (para el navegador) y en JS (para saber donde va el carrusel si llega
    // otro toque a mitad de camino)
    const CARRUSEL_CURVA = 'cubic-bezier(.25, 1, .5, 1)';
    const carruselFrenado = curvaBezier(0.25, 1, 0.5, 1);

    /** Valor de una curva cubic-bezier de CSS para un tiempo x (0 a 1). */
    function curvaBezier(x1, y1, x2, y2) {
        const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
        const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
        function X(t) { return ((ax * t + bx) * t + cx) * t; }
        function Y(t) { return ((ay * t + by) * t + cy) * t; }
        function dX(t) { return (3 * ax * t + 2 * bx) * t + cx; }
        return function (x) {
            if (x <= 0) return 0;
            if (x >= 1) return 1;
            let t = x;
            for (let k = 0; k < 8; k++) {
                const error = X(t) - x;
                if (Math.abs(error) < 1e-5) break;
                const pendiente = dX(t);
                if (Math.abs(pendiente) < 1e-6) break;
                t = Math.min(1, Math.max(0, t - error / pendiente));
            }
            return Y(t);
        };
    }

    function dosCifras(n) { return String(n).padStart(2, '0'); }

    /** Marco del carrusel: escena, contador, puntos y flechas alrededor de las
     *  tarjetas (cada una un .carrusel-tarjeta). */
    UI.carruselMarco = function (tarjetasHtml, total, etiqueta) {
        const tactil = window.matchMedia('(hover: none)').matches;
        return '<div class="carrusel" role="region" aria-roledescription="carrusel" aria-label="' + escaparHtml(etiqueta) + '">' +
                 '<div class="carrusel-escena"><div class="carrusel-pista">' + tarjetasHtml + '</div></div>' +
                 '<div class="container"><div class="carrusel-barra">' +
                   '<p class="carrusel-cuenta" aria-hidden="true"><strong>01</strong><span>/ ' + dosCifras(total) + '</span></p>' +
                   '<div class="carrusel-centro">' +
                     '<p class="carrusel-ayuda">' + (tactil ? 'Desliza para ver más' : 'Arrastra · Flechas · Teclado') + '</p>' +
                     '<div class="carrusel-puntos" role="group" aria-label="Elegir vacante"></div>' +
                   '</div>' +
                   '<div class="carrusel-flechas">' +
                     '<button type="button" class="carrusel-flecha" data-carrusel="anterior" aria-label="Vacante anterior">' + svgIcon('chevron') + '</button>' +
                     '<button type="button" class="carrusel-flecha siguiente" data-carrusel="siguiente" aria-label="Vacante siguiente">' + svgIcon('chevron') + '</button>' +
                   '</div>' +
                 '</div></div>' +
                 '<p class="sr-only" data-carrusel="anuncio" aria-live="polite"></p>' +
               '</div>';
    };

    /** Da vida a un .carrusel (hecho con UI.carruselMarco).
     *  Devuelve { ir(indice), actual(), destruir() }. */
    UI.carrusel = function (raiz, opciones) {
        opciones = opciones || {};
        const pista = raiz.querySelector('.carrusel-pista');
        const tarjetas = Array.from(pista.querySelectorAll('.carrusel-tarjeta'));
        const total = tarjetas.length;
        const anterior = raiz.querySelector('[data-carrusel="anterior"]');
        const siguiente = raiz.querySelector('[data-carrusel="siguiente"]');
        const puntos = raiz.querySelector('.carrusel-puntos');
        const cuenta = raiz.querySelector('.carrusel-cuenta strong');
        const anuncio = raiz.querySelector('[data-carrusel="anuncio"]');
        if (!total) return null;

        let pos = 0;          // posicion continua cuando no hay animacion
        let destino = 0;      // a que tarjeta se va
        let activa = -1;      // la que cuenta como actual (contador, puntos, foco)
        let viaje = null;     // la animacion en curso
        let pintarPendiente = false;
        let arrastre = null;  // { x0, y0, dx, id, decidido, inicio, paso, muestras }
        let ignorarClic = false;
        let ruedaAcumulada = 0;
        let ruedaBloqueada = 0;

        // Velo de cada tarjeta: las de los lados se oscurecen con la distancia
        const velos = tarjetas.map(function (t) {
            const v = document.createElement('span');
            v.className = 'carrusel-velo';
            v.setAttribute('aria-hidden', 'true');
            t.appendChild(v);
            return v;
        });

        puntos.innerHTML = tarjetas.map(function (t, i) {
            return '<button type="button" class="carrusel-punto" data-indice="' + i + '" aria-label="Ir a la vacante ' + (i + 1) + ' de ' + total + '"></button>';
        }).join('');
        // Guardados una vez: buscarlos en cada cambio le costaba al celular
        const listaPuntos = Array.from(puntos.children);
        const botones = tarjetas.map(function (t) { return Array.from(t.querySelectorAll('a, button')); });
        // Lo ultimo que se escribio en cada tarjeta: solo se escribe lo que cambia
        const escrito = tarjetas.map(function () { return {}; });
        raiz.classList.toggle('carrusel-una', total === 1);

        function limitar(i) { return Math.max(0, Math.min(total - 1, i)); }
        // Mas alla de esta distancia la tarjeta no se ve. En el celular solo se
        // ven la del centro y las dos vecinas
        function lejos() { return CARRUSEL_CELULAR.matches ? 1.6 : 3.2; }

        /** Lugar de una tarjeta segun su distancia al centro (con decimales). */
        function estilo(d) {
            const ad = Math.min(Math.abs(d), 3);
            const lado = Math.sign(d);
            let x, giro, z, escala, opacidad, velo;
            if (CARRUSEL_CELULAR.matches) {
                // En el celular solo se asoman las vecinas, mas inclinadas
                x = lado * (Math.min(ad, 1) * 54 + Math.max(ad - 1, 0) * 20);
                giro = -lado * Math.min(ad, 1) * 42;
                z = -ad * 110;
                escala = 1 - Math.min(ad, 2) * 0.07;
                opacidad = ad <= 1.1 ? 1 : Math.max(0, (1.6 - ad) / 0.5);
                velo = Math.min(ad, 1.5) * 0.3;
            } else {
                x = lado * (Math.min(ad, 1) * 58 + Math.max(ad - 1, 0) * 34);
                giro = -lado * (Math.min(ad, 1) * 32 + Math.max(Math.min(ad, 2) - 1, 0) * 8);
                z = -ad * 150;
                escala = 1 - ad * 0.06;
                opacidad = ad <= 2 ? 1 : Math.max(0, 3 - ad);
                velo = Math.min(ad, 2) * 0.24;
            }
            return {
                transform: 'translateX(' + x.toFixed(2) + '%) translateZ(' + z.toFixed(1) + 'px) rotateY(' + giro.toFixed(2) + 'deg) scale(' + escala.toFixed(4) + ')',
                opacity: opacidad,
                velo: velo
            };
        }

        function poner(i, clave, elemento, propiedad, valor) {
            if (escrito[i][clave] === valor) return;
            escrito[i][clave] = valor;
            elemento.style[propiedad] = valor;
        }

        // El orden cambia a mitad de camino y solo entonces (cambiarlo en cada
        // cuadro obligaba al celular a reordenar las capas)
        function ordenar(p) {
            tarjetas.forEach(function (t, i) {
                poner(i, 'z', t, 'zIndex', String(100 - Math.round(Math.abs(i - p)) * 10));
            });
        }

        /** Escribe en cada tarjeta su lugar para la posicion p. */
        function pintar(p) {
            const limite = lejos();
            tarjetas.forEach(function (t, i) {
                const d = i - p;
                const visible = Math.abs(d) <= limite;
                poner(i, 'vis', t, 'visibility', visible ? '' : 'hidden');
                if (!visible) return;
                const e = estilo(d);
                poner(i, 'transform', t, 'transform', e.transform);
                poner(i, 'opacidad', t, 'opacity', e.opacity.toFixed(2));
                poner(i, 'velo', velos[i], 'opacity', e.velo.toFixed(2));
            });
            ordenar(p);
        }

        // Un solo pintado por cuadro aunque lleguen varios movimientos del dedo
        function pedirPintado() {
            if (pintarPendiente) return;
            pintarPendiente = true;
            requestAnimationFrame(function () { pintarPendiente = false; pintar(pos); });
        }

        /** Donde va el carrusel ahora mismo, haya o no animacion. */
        function posicionActual() {
            if (!viaje) return pos;
            const t = Math.min(1, Math.max(0, (performance.now() - viaje.inicio) / viaje.duracion));
            return viaje.desde + (viaje.hasta - viaje.desde) * carruselFrenado(t);
        }

        /** Para la animacion donde va (sin saltos) y deja las tarjetas ahi. */
        function detener() {
            if (!viaje) return;
            pos = posicionActual();
            const parado = viaje;
            viaje = null;
            cancelAnimationFrame(parado.cuadro);
            // Primero se escribe donde va y luego se quita la animacion: no salta
            pintar(pos);
            parado.animaciones.forEach(function (a) { a.cancel(); });
        }

        /** Lleva el carrusel a `hacia`. `duracion` (ms) es opcional: al soltar
         *  un deslizamiento se calcula con la velocidad del dedo. */
        function viajar(hacia, duracion) {
            const desde = posicionActual();
            detener();
            pos = desde;
            const distancia = Math.abs(hacia - desde);
            if (reduceMotion || !CARRUSEL_ANIMA || distancia < 0.001) {
                // Sin deslizar: cambia de lugar al instante
                pos = hacia;
                pintar(pos);
                return;
            }
            duracion = duracion || Math.min(950, 320 + 200 * Math.sqrt(distancia));

            // Entre dos medias tarjetas cada parte del movimiento (desplazamiento,
            // profundidad, giro, tamano) avanza en linea recta: basta con darle
            // al navegador esos puntos y la curva de frenado
            const sentido = Math.sign(hacia - desde);
            const marcas = [desde];
            let m = sentido > 0 ? Math.floor(desde * 2 + 1) / 2 : Math.ceil(desde * 2 - 1) / 2;
            while ((hacia - m) * sentido > 1e-6) { marcas.push(m); m += sentido * 0.5; }
            marcas.push(hacia);
            const limite = lejos();
            const animaciones = [];
            const tiempo = { duration: duracion, easing: CARRUSEL_CURVA, fill: 'both' };
            tarjetas.forEach(function (t, i) {
                if (!marcas.some(function (q) { return Math.abs(i - q) <= limite; })) return;
                const recorrido = marcas.map(function (q) { return { offset: (q - desde) / (hacia - desde), e: estilo(i - q) }; });
                poner(i, 'vis', t, 'visibility', '');
                animaciones.push(t.animate(recorrido.map(function (r) {
                    return { offset: r.offset, transform: r.e.transform, opacity: r.e.opacity.toFixed(3) };
                }), tiempo));
                animaciones.push(velos[i].animate(recorrido.map(function (r) {
                    return { offset: r.offset, opacity: r.e.velo.toFixed(3) };
                }), tiempo));
            });

            const este = { desde: desde, hasta: hacia, inicio: performance.now(), duracion: duracion, animaciones: animaciones, cuadro: 0 };
            viaje = este;
            // Lo unico que se hace en cada cuadro: reordenar a mitad de camino
            (function seguirOrden() {
                if (viaje !== este) return;
                ordenar(posicionActual());
                if (performance.now() - este.inicio < este.duracion) este.cuadro = requestAnimationFrame(seguirOrden);
            })();
            // Al terminar, la posicion final queda escrita en las tarjetas
            Promise.all(animaciones.map(function (a) { return a.finished; })).then(function () {
                if (viaje !== este) return;
                viaje = null;
                pos = hacia;
                pintar(pos);
                animaciones.forEach(function (a) { a.cancel(); });
            }).catch(function () { /* se cancelo porque llego otro movimiento */ });
        }

        /** El numero del contador entra desde abajo. */
        function reanimar(el, texto) {
            if (!el || el.textContent === texto) return;
            el.textContent = texto;
            if (reduceMotion || !CARRUSEL_ANIMA) return;
            el.animate([{ opacity: 0, transform: 'translateY(40%)' }, { opacity: 1, transform: 'none' }],
                { duration: 420, easing: 'cubic-bezier(.2, .8, .2, 1)' });
        }

        function estadoTarjeta(i, es) {
            if (i < 0 || i >= total) return;
            tarjetas[i].classList.toggle('es-activa', es);
            tarjetas[i].setAttribute('aria-hidden', String(!es));
            botones[i].forEach(function (el) { el.tabIndex = es ? 0 : -1; });
            listaPuntos[i].classList.toggle('activo', es);
            listaPuntos[i].setAttribute('aria-current', es ? 'true' : 'false');
        }

        function marcarActiva(indice, anunciar) {
            if (indice === activa && !anunciar) return;
            const antes = activa;
            activa = indice;
            // Solo cambian dos tarjetas: la que se va y la que llega
            estadoTarjeta(antes, false);
            estadoTarjeta(activa, true);
            // Si el foco estaba dentro de la tarjeta que se fue, pasa a la nueva
            if (antes >= 0 && antes !== activa && tarjetas[antes].contains(document.activeElement) && botones[activa][0]) {
                botones[activa][0].focus({ preventScroll: true });
            }
            anterior.disabled = activa === 0;
            siguiente.disabled = activa === total - 1;
            reanimar(cuenta, dosCifras(activa + 1));
            if (anunciar && anuncio) {
                anuncio.textContent = 'Vacante ' + (activa + 1) + ' de ' + total + ': ' + (tarjetas[activa].dataset.resumen || '');
            }
            if (opciones.alCambiar) opciones.alCambiar(activa, tarjetas[activa]);
        }

        function ir(indice) {
            destino = limitar(indice);
            if (destino !== activa) marcarActiva(destino, true);
            viajar(destino);
        }

        // Todas las tarjetas del alto de la mas alta: la pista no salta
        function medir() {
            let alto = 0;
            tarjetas.forEach(function (t) { t.style.height = 'auto'; alto = Math.max(alto, t.offsetHeight); });
            tarjetas.forEach(function (t) { t.style.height = ''; });
            pista.style.setProperty('--alto', alto + 'px');
        }

        // ---- Controles ----
        // Clics seguidos: cada uno suma desde el destino, no desde donde va
        anterior.addEventListener('click', function () { ir(destino - 1); });
        siguiente.addEventListener('click', function () { ir(destino + 1); });
        puntos.addEventListener('click', function (e) {
            const punto = e.target.closest('.carrusel-punto');
            if (punto) ir(Number(punto.dataset.indice));
        });

        raiz.addEventListener('keydown', function (e) {
            if (e.target.matches('input, textarea, select')) return;
            const objetivo = { ArrowLeft: destino - 1, ArrowRight: destino + 1, Home: 0, End: total - 1 }[e.key];
            if (objetivo === undefined) return;
            e.preventDefault();
            ir(objetivo);
        });

        // Tocar o hacer clic en una tarjeta de los lados la trae al centro (sin
        // abrir sus enlaces)
        pista.addEventListener('click', function (e) {
            if (ignorarClic) { e.preventDefault(); e.stopPropagation(); return; }
            const t = e.target.closest('.carrusel-tarjeta');
            if (t && !t.classList.contains('es-activa')) {
                e.preventDefault();
                e.stopPropagation();
                ir(tarjetas.indexOf(t));
            }
        }, true);

        // ---- Arrastrar con el mouse o deslizar con el dedo ----
        // Cuantos pixeles equivalen a pasar una tarjeta
        function paso() { return tarjetas[0].offsetWidth * (CARRUSEL_CELULAR.matches ? 0.54 : 0.58); }
        // Movimientos mas cortos que esto son un toque, no un arrastre: al
        // tocar, el dedo casi siempre se corre unos pixeles
        const UMBRAL = 10;

        pista.addEventListener('dragstart', function (e) { e.preventDefault(); });
        pista.addEventListener('pointerdown', function (e) {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            arrastre = { x0: e.clientX, y0: e.clientY, dx: 0, id: e.pointerId, decidido: false, inicio: 0, paso: 1, muestras: [] };
        });
        pista.addEventListener('pointermove', function (e) {
            if (!arrastre || e.pointerId !== arrastre.id) return;
            if (!arrastre.decidido) {
                const dx = e.clientX - arrastre.x0;
                const dy = e.clientY - arrastre.y0;
                if (Math.abs(dx) < UMBRAL && Math.abs(dy) < UMBRAL) return;
                // Si el gesto es vertical, es para mover la pagina
                if (Math.abs(dy) > Math.abs(dx)) { arrastre = null; return; }
                arrastre.decidido = true;
                // Si iba en movimiento, lo agarra donde va
                detener();
                arrastre.inicio = pos;
                arrastre.x0 = e.clientX;
                // Medido una vez: leerlo en cada movimiento forzaba a recalcular la pagina
                arrastre.paso = paso();
                // Sigue recibiendo el movimiento aunque el puntero salga de la pista
                try { pista.setPointerCapture(e.pointerId); } catch (err) { /* el puntero ya se solto */ }
                raiz.classList.add('arrastrando');
            }
            arrastre.dx = e.clientX - arrastre.x0;
            let nueva = arrastre.inicio - arrastre.dx / arrastre.paso;
            // En la primera y la ultima cuesta mas, como un resorte
            if (nueva < 0) nueva *= 0.35;
            if (nueva > total - 1) nueva = total - 1 + (nueva - (total - 1)) * 0.35;
            pos = nueva;
            // Para medir la velocidad al soltar
            const ahora = performance.now();
            arrastre.muestras.push({ t: ahora, pos: pos });
            while (arrastre.muestras.length > 2 && ahora - arrastre.muestras[0].t > 100) arrastre.muestras.shift();
            // El contador sigue a la tarjeta que va quedando al centro
            marcarActiva(limitar(Math.round(pos)), false);
            pedirPintado();
        });
        function soltar(e) {
            if (!arrastre || e.pointerId !== arrastre.id) return;
            const fin = arrastre;
            arrastre = null;
            if (!fin.decidido) return; // fue un toque: el clic hace lo suyo
            raiz.classList.remove('arrastrando');
            ignorarClic = true;
            setTimeout(function () { ignorarClic = false; }, 0);

            // Velocidad de los ultimos 100 ms, en tarjetas por segundo
            const primera = fin.muestras[0];
            const ultima = fin.muestras[fin.muestras.length - 1];
            const segundos = primera && ultima ? (ultima.t - primera.t) / 1000 : 0;
            const vel = segundos > 0 ? (ultima.pos - primera.pos) / segundos : 0;
            // Con impulso llega mas lejos, como al lanzar una tarjeta
            let elegido = limitar(Math.round(pos + vel * 0.18));
            // Un gesto corto pero claro tambien cambia de tarjeta
            if (elegido === Math.round(fin.inicio) && Math.abs(fin.dx) > 30) elegido = limitar(Math.round(fin.inicio) + (fin.dx < 0 ? 1 : -1));
            destino = elegido;
            marcarActiva(destino, true);
            // La animacion arranca a la velocidad que traia el dedo (la curva
            // empieza 4 veces mas rapido que su promedio)
            const falta = destino - pos;
            let duracion;
            if (Math.abs(vel) > 0.5 && Math.sign(vel) === Math.sign(falta)) {
                duracion = Math.min(800, Math.max(260, 4 * Math.abs(falta) / Math.abs(vel) * 1000));
            }
            viajar(destino, duracion);
        }
        pista.addEventListener('pointerup', soltar);
        pista.addEventListener('pointercancel', soltar);

        // Gesto horizontal de dos dedos en el touchpad (el vertical mueve la pagina)
        pista.addEventListener('wheel', function (e) {
            if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
            e.preventDefault();
            const ahora = performance.now();
            if (ahora < ruedaBloqueada) return;
            ruedaAcumulada += e.deltaX;
            if (Math.abs(ruedaAcumulada) > 50) {
                ir(destino + Math.sign(ruedaAcumulada));
                ruedaAcumulada = 0;
                ruedaBloqueada = ahora + 380;
            }
        }, { passive: false });

        // ---- Tamano ----
        let espera = 0;
        function reacomodar() { detener(); pos = destino; medir(); pintar(pos); }
        function alCambiarTamano() { clearTimeout(espera); espera = setTimeout(reacomodar, 120); }
        window.addEventListener('resize', alCambiarTamano);
        CARRUSEL_CELULAR.addEventListener('change', reacomodar);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(medir);

        medir();
        pintar(pos);
        tarjetas.forEach(function (t, i) { estadoTarjeta(i, false); });
        marcarActiva(0, false);

        return {
            ir: ir,
            actual: function () { return activa; },
            // Al volver a pintar los resultados: suelta lo que quedo escuchando
            destruir: function () {
                detener();
                clearTimeout(espera);
                window.removeEventListener('resize', alCambiarTamano);
                CARRUSEL_CELULAR.removeEventListener('change', reacomodar);
            }
        };
    };

    /* ---------- 19. Cuenta: ventanas, contrasena y mensajes sin leer ---------- */

    /** Ventana de la marca creada desde JS. Se cierra con la X, con Escape o
     *  con un clic afuera (seccion 6), y al cerrarse se quita de la pagina y el
     *  foco vuelve a donde estaba. Devuelve { raiz, cuerpo, cerrar }. */
    UI.ventana = function (opciones) {
        const previa = document.getElementById(opciones.id);
        if (previa) previa.remove();
        const raiz = document.createElement('div');
        raiz.id = opciones.id;
        raiz.className = 'modal active' + (opciones.ancha ? ' modal-lg' : '');
        raiz.setAttribute('role', 'dialog');
        raiz.setAttribute('aria-modal', 'true');
        raiz.setAttribute('aria-labelledby', opciones.id + '-titulo');
        raiz.innerHTML =
            '<div class="modal-content">' +
              '<div class="modal-header">' +
                '<h2 id="' + opciones.id + '-titulo">' + (opciones.icono ? svgIcon(opciones.icono) + ' ' : '') + escaparHtml(opciones.titulo) + '</h2>' +
                '<button type="button" class="btn-close-modal" aria-label="Cerrar">' + svgIcon('close') + '</button>' +
              '</div>' +
              '<div class="modal-body">' + opciones.cuerpo + '</div>' +
            '</div>';
        const volverA = document.activeElement;
        function cerrar() { raiz.classList.remove('active', 'is-open'); }
        raiz.querySelector('.btn-close-modal').addEventListener('click', cerrar);
        new MutationObserver(function (cambios, observador) {
            if (raiz.classList.contains('active')) return;
            observador.disconnect();
            raiz.remove();
            if (volverA && volverA.focus) volverA.focus();
            if (opciones.alCerrar) opciones.alCerrar();
        }).observe(raiz, { attributes: true, attributeFilter: ['class'] });
        document.body.appendChild(raiz);
        const primero = raiz.querySelector('.modal-body input, .modal-body textarea, .modal-body select');
        if (primero) primero.focus();
        return { raiz: raiz, cuerpo: raiz.querySelector('.modal-body'), cerrar: cerrar };
    };

    /** Pregunta de la marca en lugar de confirm() del navegador. Devuelve una
     *  promesa: true si la persona acepta. Escape o un clic afuera cuentan como
     *  "no", y en lo que borra el foco empieza en "Cancelar" (lo seguro). */
    UI.confirmar = function (opciones) {
        return new Promise(function (resolver) {
            let respuesta = false;
            const v = UI.ventana({
                id: 'ventanaConfirmar',
                titulo: opciones.titulo,
                icono: opciones.peligro ? 'trash' : 'alert',
                alCerrar: function () { resolver(respuesta); },
                cuerpo:
                    '<p class="confirmar-texto">' + escaparHtml(opciones.texto) + '</p>' +
                    '<div class="modal-actions">' +
                      '<button type="button" class="btn-secondary-modal" data-no>' + escaparHtml(opciones.cancelar || 'Cancelar') + '</button>' +
                      '<button type="button" class="btn-primary-modal' + (opciones.peligro ? ' btn-peligro' : '') + '" data-si>' + escaparHtml(opciones.aceptar || 'Aceptar') + '</button>' +
                    '</div>'
            });
            v.cuerpo.querySelector('[data-si]').addEventListener('click', function () { respuesta = true; v.cerrar(); });
            v.cuerpo.querySelector('[data-no]').addEventListener('click', function () { v.cerrar(); });
            v.cuerpo.querySelector(opciones.peligro ? '[data-no]' : '[data-si]').focus();
        });
    };

    function datosSesion() {
        try { return localStorage.getItem('token') ? JSON.parse(localStorage.getItem('userData') || 'null') : null; } catch (e) { return null; }
    }

    /** Cambiar la contrasena (personas y empresas). Antes no habia como:
     *  la unica salida era pedirle a alguien que la cambiara en la base. */
    UI.cambiarContrasena = function () {
        const datos = datosSesion();
        if (!datos || !datos.id || typeof fetchWithAuth !== 'function') return;
        const v = UI.ventana({
            id: 'ventanaContrasena',
            titulo: 'Cambiar contraseña',
            icono: 'lock',
            cuerpo:
                '<form class="form-contrasena" novalidate>' +
                  '<div class="form-group"><label for="claveActual">Contraseña actual</label>' +
                    '<input type="password" id="claveActual" autocomplete="current-password" required></div>' +
                  '<div class="form-group"><label for="claveNueva">Contraseña nueva</label>' +
                    '<input type="password" id="claveNueva" autocomplete="new-password" minlength="8" required>' +
                    '<small class="input-help">Mínimo 8 caracteres.</small></div>' +
                  '<div class="form-group"><label for="claveNueva2">Repite la contraseña nueva</label>' +
                    '<input type="password" id="claveNueva2" autocomplete="new-password" minlength="8" required></div>' +
                  '<p class="error-text" role="alert" hidden></p>' +
                  '<div class="modal-actions">' +
                    '<button type="button" class="btn-secondary-modal" data-cancelar>Cancelar</button>' +
                    '<button type="submit" class="btn-primary-modal">Cambiar contraseña</button>' +
                  '</div>' +
                '</form>'
        });
        const form = v.cuerpo.querySelector('form');
        const error = form.querySelector('.error-text');
        const boton = form.querySelector('[type="submit"]');
        function problema(texto) { error.textContent = texto || ''; error.hidden = !texto; }
        function listo() { boton.disabled = false; boton.textContent = 'Cambiar contraseña'; }
        form.querySelector('[data-cancelar]').addEventListener('click', v.cerrar);
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            const actual = form.querySelector('#claveActual').value;
            const nueva = form.querySelector('#claveNueva').value;
            if (!actual) return problema('Escribe tu contraseña actual.');
            if (nueva.length < 8) return problema('La contraseña nueva debe tener al menos 8 caracteres.');
            if (nueva !== form.querySelector('#claveNueva2').value) return problema('Las contraseñas nuevas no coinciden.');
            if (nueva === actual) return problema('La contraseña nueva debe ser distinta de la actual.');
            problema('');
            boton.disabled = true;
            boton.textContent = 'Guardando…';
            fetchWithAuth('/users/' + encodeURIComponent(datos.id) + '/password', {
                method: 'PUT',
                body: JSON.stringify({ currentPassword: actual, newPassword: nueva })
            }).then(function (r) {
                if (r.ok) {
                    v.cerrar();
                    UI.aviso('Listo: tu contraseña quedó cambiada.', 'ok');
                    return;
                }
                return r.json().catch(function () { return {}; }).then(function (cuerpo) {
                    problema(/actual es incorrecta/i.test(cuerpo.message || '')
                        ? 'La contraseña actual no es correcta.'
                        : (cuerpo.message || 'No se pudo cambiar la contraseña. Intenta de nuevo.'));
                    listo();
                });
            }).catch(function () {
                problema('No pudimos conectar con SkillMatch. Revisa tu conexión e intenta de nuevo.');
                listo();
            });
        });
    };

    /** Mensajes sin leer: un numero junto a "Mensajes" en la barra de arriba y
     *  en la de abajo del celular. Se revisa al abrir la pagina, cada minuto
     *  con la pestana a la vista y cuando mensajes.js lee una conversacion. */
    let noLeidosEspera = 0;
    function actualizarNoLeidos() {
        clearTimeout(noLeidosEspera);
        if (!datosSesion() || typeof fetchWithAuth !== 'function') return;
        fetchWithAuth('/messages/unread-count')
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (d) { if (d) pintarNoLeidos(Number(d.count) || 0); })
            .catch(function () { /* sin conexion: se queda como estaba */ });
        noLeidosEspera = setTimeout(function () { if (!document.hidden) actualizarNoLeidos(); }, 60000);
    }

    function pintarNoLeidos(n) {
        document.querySelectorAll('header a[href="mensajes.html"], .tabbar a[href="mensajes.html"]').forEach(function (a) {
            let globo = a.querySelector('.nav-no-leidos');
            if (!n) {
                if (globo) globo.remove();
                a.removeAttribute('aria-label');
                return;
            }
            if (!globo) {
                globo = document.createElement('span');
                globo.className = 'nav-no-leidos';
                globo.setAttribute('aria-hidden', 'true');
                a.appendChild(globo);
            }
            globo.textContent = n > 99 ? '99+' : String(n);
            a.setAttribute('aria-label', 'Mensajes, ' + n + ' sin leer');
        });
    }

    UI.actualizarNoLeidos = actualizarNoLeidos;

    /* ---------- 20. Llegar desde una notificacion ---------- */

    /** Lleva la vista a lo que anuncio una notificacion (una solicitud, una
     *  postulacion) y lo marca con un borde naranja para encontrarlo de un
     *  vistazo. El foco tambien va ahi: un lector de pantalla lo lee. */
    UI.resaltar = function (el) {
        if (!el) return;
        el.classList.add('resaltado');
        if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
        el.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
        el.focus({ preventScroll: true });
    };

    /* ---------- 21. Instalar como app (PWA) ---------- */

    // sw.js vive en la raiz del sitio (junto a pages/), asi controla todas las
    // paginas: aqui y en Render. Solo funciona en https o en este equipo
    // (localhost); por la IP de la red local el navegador no lo permite.
    function registrarApp() {
        if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
        window.addEventListener('load', function () {
            navigator.serviceWorker.register(RUTA_JS + '../../sw.js').catch(function () { /* sin app: el sitio sigue igual */ });
        });
    }

    // Chrome y Edge avisan cuando se puede instalar (beforeinstallprompt). No se
    // bloquea su propio aviso: el boton del pie es una segunda forma de hacerlo.
    let pedidoDeInstalar = null;
    function botonInstalar() {
        window.addEventListener('beforeinstallprompt', function (e) {
            pedidoDeInstalar = e;
            document.querySelectorAll('.pie-instalar').forEach(function (b) { b.hidden = false; });
        });
        document.addEventListener('click', function (e) {
            const boton = e.target.closest('.pie-instalar');
            if (!boton || !pedidoDeInstalar) return;
            pedidoDeInstalar.prompt();
            pedidoDeInstalar.userChoice.finally(function () {
                pedidoDeInstalar = null;
                boton.hidden = true;
            });
        });
        window.addEventListener('appinstalled', function () {
            document.querySelectorAll('.pie-instalar').forEach(function (b) { b.hidden = true; });
            UI.aviso('Listo: SkillMatch quedó instalada en tu dispositivo.', 'ok');
        });
    }

    /* ---------- 22. Tamano de letra ---------- */

    // Todo el texto usa rem: cambiar el tamano de la raiz lo agranda todo (los
    // espacios quedan igual). Se recuerda en este navegador y lo aplica el guion
    // del <head> de cada pagina antes de pintar, para que no salte.
    const LETRA_KEY = 'skillmatch_letra';
    const TAMANOS_LETRA = [
        { id: 'normal', nombre: 'Normal' },
        { id: 'grande', nombre: 'Grande' },
        { id: 'muy-grande', nombre: 'Muy grande' }
    ];

    function tamanoLetraActual() {
        return document.documentElement.getAttribute('data-letra') || 'normal';
    }

    function ponerTamanoLetra(id) {
        if (id === 'normal') document.documentElement.removeAttribute('data-letra');
        else document.documentElement.setAttribute('data-letra', id);
        try {
            if (id === 'normal') localStorage.removeItem(LETRA_KEY); else localStorage.setItem(LETRA_KEY, id);
        } catch (e) { /* sin almacenamiento: vale solo para esta pagina */ }
        marcarTamanoLetra();
        const t = TAMANOS_LETRA.find(function (x) { return x.id === id; });
        if (t) UI.aviso('Tamaño de letra: ' + t.nombre.toLowerCase() + '.', 'ok', 2200);
    }

    function marcarTamanoLetra() {
        const actual = tamanoLetraActual();
        document.querySelectorAll('.pie-letra-btn').forEach(function (b) {
            b.setAttribute('aria-pressed', String(b.dataset.letra === actual));
        });
    }

    /* ---------- 23. Recorrido guiado ---------- */

    // La primera vez que alguien entra a una pagina con recorrido, la pantalla se
    // oscurece menos la parte que se explica y una tarjeta cuenta para que sirve.
    // Una sola vez por navegador (se puede volver a ver desde la paleta Ctrl+K).
    // Teclado: flechas para moverse, Escape para salir; el foco queda en la tarjeta.
    // Solo se animan transform y opacity; con movimiento reducido, sin animar.
    //   SkillMatchUI.recorrido({ clave: 'inicio-persona', pasos: [{ objetivo, titulo, texto }] })
    // objetivo: selector o elemento. Los pasos cuyo objetivo no existe o no se ve se saltan.
    const RECORRIDO_KEY = 'skillmatch_recorrido_';
    let recorridoDePagina = null;
    let recorridoAbierto = null;

    function recorridoVisto(clave) {
        try { return localStorage.getItem(RECORRIDO_KEY + clave) === 'visto'; } catch (e) { return true; }
    }

    UI.recorrido = function (opciones) {
        recorridoDePagina = { clave: opciones.clave, pasos: opciones.pasos };
        if (recorridoAbierto) return;
        if (!opciones.forzar && recorridoVisto(opciones.clave)) return;
        // Con una ventana abierta (por ejemplo "Nueva oferta") no se interrumpe
        if (document.querySelector('.modal.active, .modal.is-open')) return;
        const visible = function (el) { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
        const pasos = opciones.pasos.map(function (p) {
            const el = typeof p.objetivo === 'string' ? document.querySelector(p.objetivo) : p.objetivo;
            return el && visible(el) ? Object.assign({}, p, { el: el }) : null;
        }).filter(Boolean);
        if (!pasos.length) return;

        const volverA = document.activeElement;
        const raiz = document.createElement('div');
        raiz.className = 'recorrido';
        raiz.setAttribute('role', 'dialog');
        raiz.setAttribute('aria-modal', 'true');
        raiz.setAttribute('aria-labelledby', 'recorridoTitulo');
        raiz.innerHTML =
            '<div class="recorrido-foco" aria-hidden="true"></div>' +
            '<div class="recorrido-tarjeta">' +
                '<p class="recorrido-paso" id="recorridoPaso"></p>' +
                '<h2 class="recorrido-titulo" id="recorridoTitulo" tabindex="-1"></h2>' +
                '<p class="recorrido-texto" id="recorridoTexto"></p>' +
                '<div class="recorrido-acciones">' +
                    '<button type="button" class="recorrido-saltar" data-saltar>Saltar recorrido</button>' +
                    '<span class="recorrido-espacio"></span>' +
                    '<button type="button" class="btn btn-secondary btn-small" data-anterior>Anterior</button>' +
                    '<button type="button" class="btn btn-primary btn-small" data-siguiente>Siguiente</button>' +
                '</div>' +
            '</div>';
        document.body.appendChild(raiz);
        const foco = raiz.querySelector('.recorrido-foco');
        const tarjeta = raiz.querySelector('.recorrido-tarjeta');
        let actual = -1, cuadro = 0;

        // Foco y tarjeta en su sitio (tambien al hacer scroll o cambiar el tamano)
        function ubicar() {
            const paso = pasos[actual];
            if (!paso) return;
            const r = paso.el.getBoundingClientRect();
            const margen = 8;
            foco.style.width = (r.width + margen * 2) + 'px';
            foco.style.height = (r.height + margen * 2) + 'px';
            foco.style.transform = 'translate(' + (r.left - margen) + 'px,' + (r.top - margen) + 'px)';
            const celular = window.innerWidth < 640;
            tarjeta.classList.toggle('abajo-fija', celular);
            if (celular) { tarjeta.style.transform = ''; return; }
            const ancho = tarjeta.offsetWidth, alto = tarjeta.offsetHeight;
            const debajo = r.bottom + margen + 14;
            const y = debajo + alto < window.innerHeight - 16 ? debajo : Math.max(16, r.top - margen - 14 - alto);
            const x = Math.min(Math.max(16, r.left), window.innerWidth - ancho - 16);
            tarjeta.style.transform = 'translate(' + x + 'px,' + y + 'px)';
        }
        function alMover() { cancelAnimationFrame(cuadro); cuadro = requestAnimationFrame(ubicar); }

        function ir(n) {
            if (n < 0 || n >= pasos.length) return;
            actual = n;
            const paso = pasos[n];
            raiz.querySelector('#recorridoPaso').textContent = 'Paso ' + (n + 1) + ' de ' + pasos.length;
            raiz.querySelector('#recorridoTitulo').textContent = paso.titulo;
            raiz.querySelector('#recorridoTexto').textContent = paso.texto;
            raiz.querySelector('[data-anterior]').hidden = n === 0;
            raiz.querySelector('[data-siguiente]').textContent = n === pasos.length - 1 ? 'Terminar' : 'Siguiente';
            paso.el.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
            ubicar();
            // Despues del scroll suave, otra vez en su sitio
            setTimeout(ubicar, reduceMotion ? 0 : 420);
            raiz.querySelector('#recorridoTitulo').focus({ preventScroll: true });
        }

        function cerrar() {
            try { localStorage.setItem(RECORRIDO_KEY + opciones.clave, 'visto'); } catch (e) { /* sin almacenamiento */ }
            window.removeEventListener('resize', alMover);
            window.removeEventListener('scroll', alMover, true);
            document.removeEventListener('keydown', teclas, true);
            raiz.remove();
            recorridoAbierto = null;
            if (volverA && volverA.focus) volverA.focus({ preventScroll: true });
        }

        function teclas(e) {
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrar(); }
            else if (e.key === 'ArrowRight') { e.preventDefault(); if (actual < pasos.length - 1) ir(actual + 1); }
            else if (e.key === 'ArrowLeft') { e.preventDefault(); ir(actual - 1); }
            else if (e.key === 'Tab') {
                // El foco no se sale de la tarjeta
                const botones = Array.from(tarjeta.querySelectorAll('button:not([hidden])'));
                const primero = botones[0], ultimo = botones[botones.length - 1];
                if (e.shiftKey && (document.activeElement === primero || !tarjeta.contains(document.activeElement))) { e.preventDefault(); ultimo.focus(); }
                else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
            }
        }

        raiz.querySelector('[data-saltar]').addEventListener('click', cerrar);
        raiz.querySelector('[data-anterior]').addEventListener('click', function () { ir(actual - 1); });
        raiz.querySelector('[data-siguiente]').addEventListener('click', function () {
            if (actual === pasos.length - 1) cerrar(); else ir(actual + 1);
        });
        window.addEventListener('resize', alMover);
        window.addEventListener('scroll', alMover, true);
        document.addEventListener('keydown', teclas, true);
        recorridoAbierto = raiz;
        ir(0);
        requestAnimationFrame(function () { raiz.classList.add('visible'); });
    };

    /* ---------- 9. Arranque ---------- */

    function iniciar() {
        construirPie();
        registrarApp();
        botonInstalar();
        hydrateIcons(document);
        iconObserver.observe(document.body, { childList: true, subtree: true });
        // Primero la barra segun la sesion: para un visitante cambia enlaces (por
        // ejemplo "Mensajes" pasa a "Empresas") y despues se marca el actual
        sesionEnBarra();
        marcarNavegacionActiva();
        construirTabbar();
        actualizarNoLeidos();
        document.addEventListener('visibilitychange', function () { if (!document.hidden) actualizarNoLeidos(); });
        construirInterruptorTema();
        paletaDeComandos();
        tooltips();
        avisosPendientes();
        logoSegunTema(document.documentElement.getAttribute('data-theme'));
        barraAlHacerScroll();
        progresoDeNavegacion();
        movimientoDeEntrada();
        movimientoConMouse();
        hidratarLottie(document.body);
        observadorNuevos.observe(document.body, { childList: true, subtree: true });
        modalesAccesibles();
        validacionVisible();
        listas(document);
        anillos(document);
        setInterval(function () { anillos(document); }, 1200);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciar);
    } else {
        iniciar();
    }

    window.SkillMatchUI = UI;
    window.toast = UI.aviso;
})();
