// index.js
// Maneja selección de filtros en la página principal

document.addEventListener('DOMContentLoaded', () => {
    const searchBtn = document.querySelector('.search-btn');
    const searchInput = document.querySelector('.search-input');
    const locationSelect = document.getElementById('location-select');
    const modalitySelect = document.getElementById('modality-select');
    const experienceSelect = document.getElementById('experience-select');
    const salarySelect = document.getElementById('salary-select');

    const filters = {
        q: '',
        location: '',
        modality: '',
        experience: '',
        salary: ''
    };

    // Actualiza valor cuando se escribe en search
    searchInput.addEventListener('input', (e) => {
        filters.q = e.target.value;
    });

    // Enter en el buscador busca, como en cualquier buscador (antes no hacia nada)
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchBtn.click();
        }
    });

    // Si ya hay resultados en pantalla, cambiar un filtro los actualiza al instante
    function actualizarSiHayResultados() {
        const resultados = document.getElementById('results-container');
        if (resultados && !resultados.classList.contains('hidden') && typeof performSearch === 'function') {
            performSearch({ ...filters });
        }
    }

    // Cuando cambia la ubicación
    if (locationSelect) {
        locationSelect.addEventListener('change', (e) => {
            filters.location = e.target.value;
            actualizarSiHayResultados();
        });
    }

    // Cuando cambia la modalidad
    if (modalitySelect) {
        modalitySelect.addEventListener('change', (e) => {
            filters.modality = e.target.value;
            actualizarSiHayResultados();
        });
    }

    // Cuando cambia la experiencia
    if (experienceSelect) {
        experienceSelect.addEventListener('change', (e) => {
            filters.experience = e.target.value;
            actualizarSiHayResultados();
        });
    }

    // Cuando cambia el salario
    if (salarySelect) {
        salarySelect.addEventListener('change', (e) => {
            filters.salary = e.target.value;
            actualizarSiHayResultados();
        });
    }

    // Al hacer click en Buscar - conectar con search-handler
    searchBtn.addEventListener('click', () => {
        const criteria = {
            q: filters.q,
            location: filters.location,
            modality: filters.modality,
            experience: filters.experience,
            salary: filters.salary
        };
        // Llamar a función del search-handler (espera las vacantes si aun no llegan)
        if (typeof performSearch === 'function') {
            const resultsContainer = document.getElementById('results-container');
            const bajar = () => { if (resultsContainer) resultsContainer.scrollIntoView({ behavior: 'smooth' }); };
            const busqueda = performSearch(criteria);
            bajar();
            Promise.resolve(busqueda).then(bajar);
        }
    });
});

/* ---------------------------------------------------------------
 * Cifras reales en la portada.
 * Si la API no responde, los guiones se quedan como estan: la
 * pagina nunca muestra un cero falso ni un error al visitante.
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
 * Fase 2 — portada premium (solo esta pagina; lo global vive en ui.js)
 *  1. Palabra clave del titular en bucle: trabajo / practica / proyecto
 *  2. Gradiente del hero que reacciona al mouse
 *  3. Demo del match en vivo en la tarjeta del hero
 * Todo es opcional: si un elemento no existe, esa parte no hace nada.
 * --------------------------------------------------------------- */
(function () {
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 1. Palabra clave en bucle (con movimiento reducido se queda "El trabajo").
    //    La que sale se deshace en esporas que el viento se lleva y la nueva
    //    aparece letra por letra (idea de Luis).
    const rotador = document.querySelector('.hero-rotador');
    const claves = rotador ? Array.from(rotador.querySelectorAll('.hero-clave')) : [];

    // Cada letra en su propio span, con su posicion en --i para el CSS
    function partirEnLetras(palabra) {
        const texto = palabra.textContent;
        palabra.textContent = '';
        Array.from(texto).forEach(function (letra, i) {
            const span = document.createElement('span');
            span.className = 'letra';
            span.style.setProperty('--i', i);
            span.textContent = letra;
            palabra.appendChild(span);
        });
    }

    // Donde hay "tinta": se dibuja la palabra en un lienzo invisible con la
    // misma fuente y se toman puntos de los pixeles pintados
    function puntosDeTinta(palabra, cuantos) {
        const r = palabra.getBoundingClientRect();
        const cs = getComputedStyle(palabra);
        const ancho = Math.ceil(r.width), alto = Math.ceil(r.height);
        if (!ancho || !alto) return [];
        const lienzo = document.createElement('canvas');
        lienzo.width = ancho;
        lienzo.height = alto;
        const ctx = lienzo.getContext('2d', { willReadFrequently: true });
        ctx.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
        if ('letterSpacing' in ctx) ctx.letterSpacing = cs.letterSpacing;
        ctx.textBaseline = 'middle';
        ctx.fillText(palabra.textContent, 0, alto / 2);
        const datos = ctx.getImageData(0, 0, ancho, alto).data;
        const puntos = [];
        for (let y = 0; y < alto; y += 3) {
            for (let x = 0; x < ancho; x += 3) {
                if (datos[(y * ancho + x) * 4 + 3] > 140) puntos.push([x, y]);
            }
        }
        // Se mezclan y se toman solo los necesarios
        for (let i = puntos.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const t = puntos[i]; puntos[i] = puntos[j]; puntos[j] = t;
        }
        return puntos.slice(0, cuantos).map(function (p) { return [p[0], p[1], ancho]; });
    }

    // Las esporas salen de la tinta al ritmo en que se borran las letras
    // (de izquierda a derecha), suben con el viento, se encogen y se apagan
    function soltarEsporas(palabra) {
        const caja = rotador.getBoundingClientRect();
        const r = palabra.getBoundingClientRect();
        const barrido = palabra.children.length * 32; // lo que tardan las letras en irse
        puntosDeTinta(palabra, 110).forEach(function (p) {
            const espora = document.createElement('span');
            espora.className = 'espora';
            const tam = 2 + Math.random() * 3;
            espora.style.width = espora.style.height = tam.toFixed(1) + 'px';
            espora.style.left = (r.left - caja.left + p[0] - tam / 2).toFixed(1) + 'px';
            espora.style.top = (r.top - caja.top + p[1] - tam / 2).toFixed(1) + 'px';
            rotador.appendChild(espora);
            const dx = 40 + Math.random() * 120;
            const dy = -(25 + Math.random() * 85);
            const vaiven = (Math.random() - 0.5) * 30;
            const animacion = espora.animate([
                { transform: 'translate(0, 0) scale(.6)', opacity: 0 },
                { transform: 'translate(' + (dx * 0.08).toFixed(1) + 'px, ' + (dy * 0.05).toFixed(1) + 'px) scale(1)', opacity: 1, offset: 0.1 },
                { transform: 'translate(' + (dx * 0.5 + vaiven).toFixed(1) + 'px, ' + (dy * 0.55).toFixed(1) + 'px) scale(.8)', opacity: 0.75, offset: 0.55 },
                { transform: 'translate(' + dx.toFixed(1) + 'px, ' + dy.toFixed(1) + 'px) scale(.3)', opacity: 0 }
            ], {
                duration: 900 + Math.random() * 700,
                delay: p[0] / p[2] * barrido + Math.random() * 80,
                easing: 'cubic-bezier(.2, .6, .3, 1)',
                fill: 'both'
            });
            animacion.onfinish = function () { espora.remove(); };
        });
    }

    if (claves.length > 1 && !reducido) {
        claves.forEach(partirEnLetras);
        let actual = 0;
        setInterval(function () {
            // Con sesion el heroe queda escondido detras del panel de inicio
            if (document.hidden || rotador.closest('[hidden]')) return;
            const saliente = claves[actual];
            actual = (actual + 1) % claves.length;
            soltarEsporas(saliente);
            saliente.classList.remove('is-activa');
            saliente.classList.add('is-saliendo');
            claves[actual].classList.remove('is-saliendo');
            claves[actual].classList.add('is-activa');
            setTimeout(function () { saliente.classList.remove('is-saliendo'); }, 1200);
        }, 3200);
    }

    // 2. Gradiente que sigue al mouse, un cuadro por fotograma (solo con mouse)
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

    // 3. Demo del match: cada habilidad pesa en el %, el anillo se recalcula
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
 * Fase 2 — scroll-telling "Como funciona" y cifras de impacto
 *  4. El paso que cruza el centro de la pantalla enciende su escena
 *  5. Las cifras de impacto cuentan cuando la seccion entra en pantalla
 * --------------------------------------------------------------- */
(function () {
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 4. Scroll-telling
    const layout = document.querySelector('.cf-layout');
    const pasos = layout ? Array.from(layout.querySelectorAll('.cf-paso')) : [];
    if (layout && pasos.length && 'IntersectionObserver' in window) {
        layout.classList.add('js-scroll');
        const activar = function (paso) {
            pasos.forEach(function (p) { p.classList.toggle('is-activo', p === paso); });
            layout.dataset.escena = paso.dataset.paso;
        };
        activar(pasos[0]);
        // Una franja en el centro de la pantalla: el paso que la cruza es el activo
        const observador = new IntersectionObserver(function (entradas) {
            entradas.forEach(function (e) { if (e.isIntersecting) activar(e.target); });
        }, { rootMargin: '-45% 0px -45% 0px' });
        pasos.forEach(function (p) { observador.observe(p); });
    }

    // 5. Cifras de impacto: search-handler.js las escribe ("3,0K+"); aqui
    //    solo se animan desde 0 cuando la seccion se ve, conservando el formato.
    const impacto = document.querySelector('.impact-stats');
    if (!impacto || reducido || !('IntersectionObserver' in window)) return;
    let visto = false;

    function contar(el) {
        const m = el.textContent.trim().match(/^([\d.,]+)(.*)$/);
        if (!m || el.dataset.contado) return;
        el.dataset.contado = '1';
        const decimales = (m[1].split(',')[1] || '').length;
        const valor = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
        const sufijo = m[2];
        const inicio = performance.now();
        const paso = function (ahora) {
            const t = Math.min(1, (ahora - inicio) / 1100);
            const suave = 1 - Math.pow(1 - t, 3);
            el.textContent = (valor * suave).toFixed(decimales).replace('.', ',') + sufijo;
            if (t < 1) requestAnimationFrame(paso);
        };
        requestAnimationFrame(paso);
    }
    function contarTodas() { impacto.querySelectorAll('.stat-value').forEach(contar); }

    new IntersectionObserver(function (entradas, obs) {
        if (!entradas[0].isIntersecting) return;
        visto = true;
        contarTodas();
        obs.disconnect();
    }, { threshold: 0.4 }).observe(impacto);
    // Si las cifras llegan de la API cuando la seccion ya esta en pantalla
    new MutationObserver(function () { if (visto) contarTodas(); })
        .observe(impacto, { childList: true, subtree: true, characterData: true });
})();
