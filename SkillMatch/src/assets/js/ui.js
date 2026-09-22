/* =====================================================================
 *  SkillMatch — capa de interfaz
 *
 *  Se encarga de cuatro cosas, y de nada mas:
 *    1. Iconos SVG (reemplazan a los emojis, se ven igual en todos lados)
 *    2. Orientacion: pagina activa, barra inferior en movil, progreso
 *    3. Estados de carga: esqueletos y botones ocupados
 *    4. Avisos al usuario (toast) y modales accesibles
 *
 *  Se carga en todas las paginas y funciona sin configuracion.
 * ===================================================================== */

(function () {
    'use strict';

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
        filter:    '<path d="M4 6h16M7 12h10M10 18h4"/>',
        logout:    '<path d="M14 7V5.5A1.5 1.5 0 0 0 12.5 4h-6A1.5 1.5 0 0 0 5 5.5v13A1.5 1.5 0 0 0 6.5 20h6a1.5 1.5 0 0 0 1.5-1.5V17"/><path d="M10 12h10M17 8.5l3.5 3.5L17 15.5"/>',
        plus:      '<path d="M12 5v14M5 12h14"/>',
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
        return '<svg class="ico ' + (extraClass || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + body + '</svg>';
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
    function marcarNavegacionActiva() {
        const actual = paginaActual();
        document.querySelectorAll('header .nav-links a').forEach(function (a) {
            const destino = (a.getAttribute('href') || '').split('/').pop();
            if (destino && destino === actual && !a.classList.contains('btn-login')) {
                a.classList.add('active-nav');
                a.setAttribute('aria-current', 'page');
            }
        });
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
            aplicarTema(nuevo);
            pintar();
        });

        const li = document.createElement('li');
        li.appendChild(boton);
        lista.insertBefore(li, lista.firstChild);
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

    /** Una sola secuencia al cargar, y revelado por scroll en secciones largas. */
    function movimientoDeEntrada() {
        document.body.classList.add('page-enter');
        if (reduceMotion || !('IntersectionObserver' in window)) {
            document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('is-visible'); });
            return;
        }
        const io = new IntersectionObserver(function (entradas) {
            entradas.forEach(function (entrada, i) {
                if (!entrada.isIntersecting) return;
                entrada.target.style.setProperty('--reveal-delay', (i * 70) + 'ms');
                entrada.target.classList.add('is-visible');
                io.unobserve(entrada.target);
            });
        }, { rootMargin: '0px 0px -8% 0px', threshold: .08 });

        document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
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

    /* ---------- 9. Arranque ---------- */

    function iniciar() {
        hydrateIcons(document);
        iconObserver.observe(document.body, { childList: true, subtree: true });
        marcarNavegacionActiva();
        construirTabbar();
        construirInterruptorTema();
        barraAlHacerScroll();
        progresoDeNavegacion();
        movimientoDeEntrada();
        modalesAccesibles();
        validacionVisible();
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
