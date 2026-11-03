// index.js
// Portada: busqueda del hero, cifras, demo del match, selector de publicos y
// "Como funciona". Todo lo que se mueve lo controla la persona: nada avanza solo.

document.addEventListener('DOMContentLoaded', () => {
    const formulario = document.querySelector('.hero-buscar');
    const searchInput = document.querySelector('.search-input');
    const locationSelect = document.getElementById('location-select');
    if (!formulario || !searchInput) return;

    const criterios = () => ({ q: searchInput.value.trim(), location: locationSelect ? locationSelect.value : '' });

    // Si ya hay resultados en pantalla, cambiar el lugar los actualiza al instante
    function actualizarSiHayResultados() {
        const resultados = document.getElementById('results-container');
        if (resultados && !resultados.classList.contains('hidden') && typeof performSearch === 'function') {
            performSearch(criterios());
        }
    }
    if (locationSelect) locationSelect.addEventListener('change', actualizarSiHayResultados);

    // Buscar (boton o Enter). Sin search-handler.js el formulario sigue a Vacantes con ?q=
    formulario.addEventListener('submit', (e) => {
        if (typeof performSearch !== 'function') return;
        e.preventDefault();
        const resultsContainer = document.getElementById('results-container');
        const bajar = () => { if (resultsContainer) resultsContainer.scrollIntoView({ behavior: 'smooth' }); };
        const c = criterios();
        // Sin nada escrito ni lugar elegido, lleva a todas las vacantes
        if (!c.q && !c.location) { window.location.href = 'oportunidades.html'; return; }
        const busqueda = performSearch(c);
        bajar();
        Promise.resolve(busqueda).then(bajar);
    });
});

/* ---------------------------------------------------------------
 * Cifras reales en la portada: una sola fuente (/public/stats) y una
 * sola vez, en el hero. Si la API no responde, los guiones se quedan:
 * la pagina nunca muestra un cero falso ni un error al visitante.
 * --------------------------------------------------------------- */
(function () {
    const destinos = document.querySelectorAll('[data-stat]');
    if (!destinos.length || typeof API_BASE_URL === 'undefined') return;

    // Cuenta hasta el valor real en vez de aparecer de golpe.
    function contarHasta(el, valor) {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            el.textContent = valor.toLocaleString('es-CO');
            return;
        }
        const inicio = performance.now();
        const duracion = 900;
        const paso = function (ahora) {
            const avance = Math.min(1, (ahora - inicio) / duracion);
            const suave = 1 - Math.pow(1 - avance, 3);
            el.textContent = Math.round(valor * suave).toLocaleString('es-CO');
            if (avance < 1) requestAnimationFrame(paso);
        };
        requestAnimationFrame(paso);
    }

    fetch(`${API_BASE_URL}/public/stats`)
        .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function (datos) {
            destinos.forEach(function (el) {
                const valor = datos[el.dataset.stat];
                if (typeof valor === 'number') contarHasta(el, valor);
            });
        })
        .catch(function () { /* sin conexion: se quedan los guiones */ });
})();

/* ---------------------------------------------------------------
 * Hero
 *  1. Gradiente que reacciona al mouse (solo con mouse)
 *  2. Demo del match en vivo en la tarjeta del hero
 * (La palabra del titular que cambiaba sola se quito: nada se mueve sin
 * que la persona lo pida.)
 * --------------------------------------------------------------- */
(function () {
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 1. Gradiente que sigue al mouse, un cuadro por fotograma (solo con mouse)
    const hero = document.querySelector('.hero');
    if (hero && !reducido && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
        let pendiente = 0, x = 0, y = 0;
        hero.addEventListener('pointermove', function (e) {
            const r = hero.getBoundingClientRect();
            x = ((e.clientX - r.left) / r.width - 0.5) * 2;
            y = ((e.clientY - r.top) / r.height - 0.5) * 2;
            if (pendiente) return;
            pendiente = requestAnimationFrame(function () {
                pendiente = 0;
                hero.style.setProperty('--hx', x.toFixed(3));
                hero.style.setProperty('--hy', y.toFixed(3));
            });
        });
        hero.addEventListener('pointerleave', function () {
            hero.style.setProperty('--hx', 0);
            hero.style.setProperty('--hy', 0);
        });
    }

    // 2. Demo del match: cada habilidad pesa en el %, el anillo se recalcula
    const demo = document.querySelector('.match-demo');
    if (!demo) return;
    const botones = Array.from(demo.querySelectorAll('.demo-skill'));
    const anillo = demo.querySelector('.match-ring');
    const razon = demo.querySelector('.demo-razon');
    let pctMostrado = parseInt(anillo.dataset.pct, 10) || 0;

    function nombre(boton) { return boton.textContent.trim(); }

    function listaConY(nombres) {
        return nombres.length > 1 ? nombres.slice(0, -1).join(', ') + ' y ' + nombres[nombres.length - 1] : nombres[0];
    }

    function pintarAnillo(pct) {
        anillo.dataset.pct = pct;
        anillo.setAttribute('data-level', pct >= 80 ? 'alto' : (pct >= 55 ? 'medio' : 'bajo'));
        anillo.setAttribute('aria-label', pct + ' por ciento de coincidencia con esta vacante');
        const texto = anillo.querySelector('span');
        const desde = pctMostrado;
        pctMostrado = pct;
        if (reducido) {
            anillo.style.setProperty('--pct', pct);
            if (texto) texto.textContent = pct + '%';
            return;
        }
        // Un pulso breve al cambiar (app.css, .match-ring.cambia)
        anillo.classList.remove('cambia');
        void anillo.offsetWidth;
        anillo.classList.add('cambia');
        const inicio = performance.now();
        const paso = function (ahora) {
            const t = Math.min(1, (ahora - inicio) / 500);
            const suave = 1 - Math.pow(1 - t, 3);
            const valor = Math.round(desde + (pct - desde) * suave);
            anillo.style.setProperty('--pct', valor);
            if (texto) texto.textContent = valor + '%';
            if (t < 1) requestAnimationFrame(paso);
        };
        requestAnimationFrame(paso);
    }

    function recalcular() {
        const tiene = botones.filter(function (b) { return b.getAttribute('aria-pressed') === 'true'; });
        const faltan = botones.filter(function (b) { return b.getAttribute('aria-pressed') !== 'true'; }).map(nombre);
        const pct = tiene.reduce(function (s, b) { return s + (parseInt(b.dataset.peso, 10) || 0); }, 0);
        pintarAnillo(pct);
        if (!tiene.length) razon.textContent = 'Marca las habilidades que tienes para ver tu compatibilidad.';
        else if (!faltan.length) razon.textContent = '¡Cumples todos los requisitos! Esta vacante es para ti.';
        else razon.textContent = 'Coincides en ' + tiene.length + ' de ' + botones.length + ' requisitos. ' +
                                 (faltan.length > 1 ? 'Te faltan ' : 'Te falta ') + listaConY(faltan) + '.';
    }

    botones.forEach(function (boton) {
        boton.addEventListener('click', function () {
            boton.setAttribute('aria-pressed', String(boton.getAttribute('aria-pressed') !== 'true'));
            recalcular();
        });
    });
})();

/* ---------------------------------------------------------------
 * Pestanas de la portada (las controla la persona; nada cambia solo)
 *  3. "Busco trabajo | Soy empresa": el contenido cambia con una transicion
 *  4. "Como funciona": cada paso muestra su escena al lado
 * Teclado: flechas, Inicio y Fin, como cualquier lista de pestanas.
 * --------------------------------------------------------------- */
(function () {
    function pestanas(lista, alElegir) {
        if (!lista) return;
        const tabs = Array.from(lista.querySelectorAll('[role="tab"]'));
        function elegir(tab, enfocar) {
            tabs.forEach(function (t) {
                const si = t === tab;
                t.setAttribute('aria-selected', String(si));
                t.tabIndex = si ? 0 : -1;
                t.classList.toggle('is-activo', si);
                const panel = document.getElementById(t.getAttribute('aria-controls'));
                if (panel) panel.hidden = !si;
            });
            if (enfocar) tab.focus();
            if (alElegir) alElegir(tab);
        }
        tabs.forEach(function (t) {
            t.addEventListener('click', function () { elegir(t, false); });
            t.addEventListener('keydown', function (e) {
                const i = tabs.indexOf(t);
                const destino = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
                if (destino === undefined) return;
                e.preventDefault();
                elegir(tabs[(destino + tabs.length) % tabs.length], true);
            });
        });
    }

    // 3. Publicos
    pestanas(document.querySelector('.publicos-selector'), function (tab) {
        const caja = document.querySelector('.publicos');
        if (caja) caja.dataset.publico = tab.id === 'tabEmpresa' ? 'empresa' : 'persona';
    });

    // 4. Como funciona
    const layout = document.querySelector('.cf-layout');
    pestanas(layout && layout.querySelector('.cf-pasos'), function (tab) {
        layout.dataset.escena = tab.dataset.paso;
    });
})();
