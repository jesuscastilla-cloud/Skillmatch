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
        // 36 esporas (eran 110): cada una es un elemento animado mas que el navegador atiende en cada cuadro
        puntosDeTinta(palabra, 36).forEach(function (p) {
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
        // La palabra solo cambia mientras el titular esta en pantalla: antes seguia soltando esporas
        // aunque la persona ya estuviera leyendo otra seccion, y eso le quitaba fluidez a toda la pagina
        let aLaVista = true;
        if ('IntersectionObserver' in window) {
            new IntersectionObserver(function (e) { aLaVista = e[0].isIntersecting; }).observe(rotador);
        }
        setInterval(function () {
            // Con sesion el heroe queda escondido detras del panel de inicio
            if (document.hidden || !aLaVista || rotador.closest('[hidden]')) return;
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
        // --hx y --hy solo los leen las dos manchas de color del fondo (.hero::before y ::after; en app.css
        // estan registradas para que NO las hereden los hijos: cambiar una variable heredada obliga a
        // recalcular toda la portada). No hay nada mas que siga al cursor: la luz que lo perseguia se quito
        hero.addEventListener('pointermove', function (e) {
            if (e.pointerType !== 'mouse') return;
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

/* (Revision 2026-11-13) Aqui estaba "Fase 2 — cifras de impacto": contaba desde 0 las cifras de la seccion
   .impact-stats, que se quito al pasar la portada a 5 bloques: el codigo ya nunca corria. */

/* ---------- La isla de la barra se abre (app.css, seccion 49) ----------
   La primera vez que se abre la portada en la pestana, el guion del <head> pone html.isla-intro:
   la barra sale como una isla pequena con solo el logo. Aqui se abre:
   1. Se espera a que ui.js arme la barra (lupa, tema, sesion) y a que lleguen las letras, para medir
      la isla con su ancho final. Y un minimo de tiempo, para que el logo solo alcance a verse.
   2. La isla se arma con tres piezas: las tapas se deslizan hacia afuera (translateX) y el centro se
      estira (scaleX). Las tres usan la misma curva, asi los bordes siempre coinciden.
   3. El logo viaja del centro a su lugar con la misma curva (va "pegado" a la tapa izquierda).
   4. Cada opcion aparece justo cuando la tapa derecha pasa por encima de ella: de adentro hacia afuera.
   5. Al terminar, las piezas se quitan y la isla vuelve a pintar su propio vidrio (identico).
   Si la persona pone el mouse o el teclado en la barra, todo termina al instante: nunca estorba. */
(function islaQueSeAbre() {
    const raiz = document.documentElement;
    const header = document.querySelector('body > header');
    if (!header || !raiz.classList.contains('isla-intro')) return;

    const PAUSA_MIN = 700;    // ms desde que empezo a cargar la pagina: la isla pequena se alcanza a ver
    const ESPERA_MAX = 1300;  // si las letras tardan (conexion lenta), no se espera mas que esto
    const CURVA = [0.32, 0.72, 0, 1];                 // arranca decidida y se posa suave, sin rebote
    const CURVA_CSS = 'cubic-bezier(' + CURVA.join(', ') + ')';
    const SALIDA = 'cubic-bezier(.23, 1, .32, 1)';    // ease-out fuerte para lo que aparece

    let empezo = false;
    const animaciones = [];

    // Punto de una curva cubic-bezier (x = tiempo, y = avance) para el parametro u
    function bezier(u, a, b) { const v = 1 - u; return 3 * v * v * u * a + 3 * v * u * u * b + u * u * u; }
    // En que momento (0 a 1) del tiempo la curva llega a cierto avance: se busca por mitades
    function momentoDeAvance(avance) {
        if (avance <= 0) return 0;
        if (avance >= 1) return 1;
        let lo = 0, hi = 1;
        for (let i = 0; i < 24; i++) {
            const u = (lo + hi) / 2;
            if (bezier(u, CURVA[1], CURVA[3]) < avance) lo = u; else hi = u;
        }
        return bezier((lo + hi) / 2, CURVA[0], CURVA[2]);
    }

    function terminarYa() { animaciones.forEach(function (a) { a.finish(); }); }

    function abrir() {
        if (empezo) return;
        empezo = true;
        // Si el rescate del <head> ya mostro la barra, no hay nada que abrir
        if (!raiz.classList.contains('isla-intro')) return;

        // Primero: donde esta el logo ahora (en el centro de la isla pequena). Se mide y se mueve la
        // imagen, no su caja: en la barra la imagen sube un poco (app.css, seccion 49) y asi el viaje
        // incluye esa subida, sin salto al empezar
        const logo = header.querySelector('.logo img') || header.querySelector('.logo');
        const antes = logo.getBoundingClientRect();

        // La barra toma su forma final. Todo lo que sigue pasa antes de pintar el siguiente cuadro
        raiz.classList.remove('isla-intro');
        raiz.classList.add('isla-abriendo');
        const caja = header.getBoundingClientRect();
        const despues = logo.getBoundingClientRect();
        const ancho = caja.width;
        const radio = caja.height / 2;
        const anchoInicial = parseFloat(getComputedStyle(header).getPropertyValue('--isla-w0')) || 152;
        const recorrido = Math.max(0, (ancho - anchoInicial) / 2);    // cuanto viaja cada tapa
        // Mas camino, un poco mas de tiempo (en celular la isla crece menos)
        const duracion = Math.round(Math.min(680, Math.max(420, 320 + recorrido * 0.75)));

        // La linea del menu (ui.js) se midio con la barra pequena: se vuelve a poner en su sitio, sin
        // viaje (ui.js salta, en vez de deslizarse, cuando la linea esta oculta)
        const linea = header.querySelector('.nav-pastilla');
        if (linea) {
            linea.style.opacity = '0';
            document.dispatchEvent(new CustomEvent('skillmatch:menu'));
        }

        // Las opciones: cuando aparece cada una (se mide antes de mover nada). Una opcion se ve cuando
        // ya nada la tapa: ni la tapa derecha (aun no llega a ella) ni el logo, que viaja a la izquierda
        // por encima de las del centro
        const centroX = caja.left + ancho / 2;
        const finLogo = despues.right - caja.left + 8;   // del borde izquierdo de la isla al final del logo
        const opciones = Array.from(header.querySelectorAll('.nav-buscar, .nav-principales > li:not(.nav-pastilla), nav > .nav-links > li'))
            .filter(function (li) { return !li.hidden && li.offsetWidth; })
            .map(function (li) {
                const r = li.getBoundingClientRect();
                const lado = r.left + r.width / 2 >= centroX ? 1 : -1;
                // Cuanto debe abrirse cada lado (desde el centro) para dejar ver dos tercios de la opcion
                const porElLogo = finLogo - (r.left - centroX) - r.width / 3;
                // La tapa derecha ya llega a su borde (sale corrida hacia adentro: nunca asoma por fuera)
                const porLaTapa = (r.right - centroX) - 4;
                const avance = recorrido ? (Math.max(porElLogo, porLaTapa) - anchoInicial / 2) / recorrido : 1;
                return { li: li, lado: li.querySelector('.btn-register') ? lado * 1.6 : lado, retraso: momentoDeAvance(avance) * duracion };
            });

        // Las tres piezas, ya con su forma final; las animaciones las llevan a la isla pequena.
        // Debajo, el desenfoque del cristal, que aparece al final
        const piezas = document.createElement('div');
        piezas.className = 'isla-piezas';
        piezas.setAttribute('aria-hidden', 'true');
        piezas.innerHTML = '<span class="isla-vidrio"></span><span class="isla-tapa-izq"></span>' +
            '<span class="isla-centro"></span><span class="isla-tapa-der"></span>';
        header.prepend(piezas);
        const pieza = function (clase) { return piezas.querySelector('.' + clase); };
        const escalaInicial = Math.max(0.001, (anchoInicial - 2 * radio) / Math.max(1, ancho - 2 * radio));
        const forma = { duration: duracion, easing: CURVA_CSS, fill: 'backwards' };
        const isla = [
            pieza('isla-tapa-izq').animate([{ transform: 'translateX(' + recorrido + 'px)' }, { transform: 'none' }], forma),
            pieza('isla-centro').animate([{ transform: 'scaleX(' + escalaInicial + ')' }, { transform: 'none' }], forma),
            pieza('isla-tapa-der').animate([{ transform: 'translateX(' + (-recorrido) + 'px)' }, { transform: 'none' }], forma),
            logo.animate([{ transform: 'translate(' + (antes.left - despues.left) + 'px, ' + (antes.top - despues.top) + 'px)' }, { transform: 'none' }], forma),
            // El cristal se asienta cuando las tapas ya casi llegaron (la curva va al 99 % en el 85 % del tiempo)
            pieza('isla-vidrio').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay: duracion * 0.85, easing: SALIDA, fill: 'both' })
        ];
        animaciones.push.apply(animaciones, isla);

        // Cada opcion entra cuando la tapa pasa: aparece y se corre unos pixeles hacia afuera, con
        // la tapa. "Unirse ahora" (la accion que importa) viaja un poco mas
        opciones.forEach(function (o) {
            animaciones.push(o.li.animate([
                { opacity: 0, transform: 'translateX(' + (-10 * o.lado) + 'px)' },
                { opacity: 1, transform: 'none' }
            ], { duration: 280, delay: o.retraso, easing: SALIDA, fill: 'backwards' }));
        });
        // Decoracion (la linea del menu y la que separa la cuenta): solo aparecen, cuando la isla se posa.
        // Se anima el trazo (::after) y no la linea: ui.js cancela las animaciones de la linea cada vez
        // que la mueve (por ejemplo, cuando cambia la seccion a la vista)
        const posarse = { duration: 260, delay: duracion * 0.75, easing: SALIDA, fill: 'backwards' };
        const decoracion = [[linea, '::after'], [header.querySelector('nav > .nav-links'), '::before']];
        decoracion.forEach(function (d) {
            if (!d[0]) return;
            try {
                animaciones.push(d[0].animate([{ opacity: 0 }, { opacity: 1 }], Object.assign({ pseudoElement: d[1] }, posarse)));
            } catch (e) { /* navegador sin animacion de pseudo-elementos: la linea ya esta */ }
        });

        // Cuando la isla termina de abrirse, vuelve su propio vidrio (sin fundido: es identico)
        Promise.all(isla.map(function (a) { return a.finished; })).catch(function () {}).then(function () {
            header.style.transition = 'none';
            raiz.classList.remove('isla-abriendo');
            piezas.remove();
            getComputedStyle(header).backgroundColor;   // aplica el cambio ya, sin transicion
            requestAnimationFrame(function () { header.style.transition = ''; });
        });
        // Al final, la linea del menu se vuelve a medir: si ui.js la movio mientras las opciones
        // aun se corrian, quedaria unos pixeles fuera de su sitio
        Promise.all(animaciones.map(function (a) { return a.finished; })).catch(function () {}).then(function () {
            document.dispatchEvent(new CustomEvent('skillmatch:menu'));
            header.removeEventListener('pointerenter', yaMismo);
            header.removeEventListener('focusin', yaMismo);
            window.removeEventListener('resize', yaMismo);
        });
    }

    // Mouse, dedo o teclado en la barra: se abre y termina de una vez
    function yaMismo() { abrir(); terminarYa(); }
    header.addEventListener('pointerenter', yaMismo);
    header.addEventListener('focusin', yaMismo);
    window.addEventListener('resize', yaMismo);

    function esperar(ms) { return new Promise(function (listo) { setTimeout(listo, Math.max(0, ms)); }); }
    function cuandoEsteLista() {
        const letras = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
        Promise.race([letras, esperar(ESPERA_MAX - performance.now())]).then(function () {
            return esperar(PAUSA_MIN - performance.now());
        }).then(abrir);
    }
    // index.js corre antes que ui.js: setTimeout deja pasar primero el DOMContentLoaded de ui.js
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { setTimeout(cuandoEsteLista, 0); });
    } else {
        setTimeout(cuandoEsteLista, 0);
    }
})();

/* ---------- La portada se construye al bajar (app.css, seccion 52) ----------
   Cada grupo de piezas se arma UNA vez, cuando llega a la pantalla (no es parallax: al seguir bajando
   nada se mueve). Cada pieza llega de donde tiene sentido:
   - los titulos se arman palabra por palabra, como el de la portada;
   - los filtros salen de debajo de la barra de busqueda;
   - el globo sube como un planeta y las vacantes salen volando DEL globo hasta su lugar;
   - el panel del paso entra desde la rueda (la rueda arma sus piezas en rueda-pasos.js);
   - en el cierre, la persona entra por la izquierda, la empresa por la derecha, y donde se
     encuentran se enciende la chispa del match.
   Antes de su turno, las piezas esperan invisibles (.cons-espera, solo si este archivo corre: sin
   JavaScript se ve todo). Solo transform y opacity. Con "reducir movimiento" no se arma nada: ya esta. */
(function portadaQueSeConstruye() {
    if (!('IntersectionObserver' in window) || !Element.prototype.animate) return;
    let demo = false;
    try { demo = localStorage.getItem('skillmatch_animar') === '1'; } catch (e) { /* sin almacenamiento */ }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches && !demo) return;

    const SALIDA = 'cubic-bezier(.22, 1, .36, 1)';     // llega rapido y se posa despacio
    const k = window.matchMedia('(max-width: 760px)').matches ? .55 : 1;   // en celular, recorridos mas cortos

    // Una animacion de entrada: solo se escribe de donde sale; llega a donde la pieza ya esta
    function entra(el, desde, opciones) {
        if (!el) return null;
        return el.animate([Object.assign({ offset: 0 }, desde)], Object.assign({ duration: 620, easing: SALIDA, fill: 'backwards' }, opciones));
    }
    function sube(px) { return 'translateY(' + Math.round(px * k) + 'px)'; }

    // Parte un titulo en palabras (cada una en su caja). El lector de pantalla lo sigue leyendo entero
    function palabras(titulo) {
        if (!titulo || titulo.dataset.partido) return [];
        titulo.dataset.partido = '1';
        const lista = titulo.textContent.trim().split(/\s+/);
        titulo.textContent = '';
        lista.forEach(function (p, i) {
            if (i) titulo.appendChild(document.createTextNode(' '));
            const caja = document.createElement('span');
            caja.className = 'cons-palabra';
            caja.textContent = p;
            titulo.appendChild(caja);
        });
        return Array.from(titulo.querySelectorAll('.cons-palabra'));
    }

    const grupos = [];
    // Un grupo: lo que se vigila (zona), las piezas que esperan invisibles y como se arma
    function grupo(zona, piezas, armar) {
        if (!zona) return;
        piezas = piezas.filter(Boolean);
        piezas.forEach(function (p) { p.classList.add('cons-pieza'); });
        zona.classList.add('cons-espera');
        grupos.push({ zona: zona, armar: armar });
    }
    // Las secciones que se arman aqui no usan la aparicion general de ui.js (subir y aparecer)
    document.querySelectorAll('.search-section, .cerca-section, .como-funciona, .cta-final').forEach(function (s) { s.dataset.construye = ''; });

    // 1. Titulos: las palabras suben una tras otra y despues llega la frase de abajo
    document.querySelectorAll('.search-section .section-header-center, .cerca-section .section-header-center, .como-funciona .section-header-center').forEach(function (cab) {
        const h = cab.querySelector('h2'), p = cab.querySelector('p');
        const ps = palabras(h);
        grupo(cab, ps.concat(p), function () {
            ps.forEach(function (w, i) { entra(w, { opacity: 0, transform: 'translateY(.55em)' }, { duration: 560, delay: i * 70 }); });
            entra(p, { opacity: 0, transform: sube(10) }, { duration: 560, delay: 120 + ps.length * 70 });
        });
    });

    // 2. Buscador: la barra aparece y los filtros salen de debajo de ella, uno tras otro
    const caja = document.querySelector('.search-section .search-box');
    const filtros = Array.from(document.querySelectorAll('.search-section .filter-group'));
    if (caja) grupo(caja, [caja].concat(filtros), function () {
        entra(caja, { opacity: 0, transform: sube(14) + ' scale(.97)' }, { duration: 600 });
        filtros.forEach(function (f, i) { entra(f, { opacity: 0, transform: 'translateY(' + Math.round(-22 * k) + 'px)' }, { duration: 480, delay: 180 + i * 60 }); });
    });

    // 3. Vacantes cerca: los controles, el globo que sube como un planeta y las vacantes que salen de el
    const controles = document.querySelector('.cerca-controles');
    grupo(controles, [controles], function () { entra(controles, { opacity: 0, transform: sube(12) }, { duration: 520 }); });

    const mapa = document.getElementById('cercaMapa');
    grupo(mapa, [mapa], function () {
        entra(mapa, { opacity: 0, transform: sube(56) + ' scale(.9)' }, { duration: 950 });
    });

    // Las tarjetas salen del centro del globo: pequenas y encima de el, y vuelan hasta su lugar.
    // Pueden llegar despues (las pide vacantes-cerca.js): si el grupo ya se armo, salen al llegar
    const resultados = document.querySelector('.cerca-resultados');
    const lienzo = document.querySelector('.cerca-mapa-lienzo');
    let resultadosArmados = false;
    function tarjetasVisibles() {
        return Array.from(document.querySelectorAll('#cercaLista:not([hidden]) > li, #cercaCargando > *')).filter(function (t) { return t.offsetParent; });
    }
    function lanzarTarjetas(retraso) {
        const origen = (lienzo || mapa) && (lienzo || mapa).getBoundingClientRect();
        tarjetasVisibles().forEach(function (t, i) {
            if (t.dataset.lanzada) return;
            t.dataset.lanzada = '1';
            const r = t.getBoundingClientRect();
            let dx = 0, dy = 0;
            if (origen && origen.width) {
                dx = origen.left + origen.width / 2 - (r.left + r.width / 2);
                dy = origen.top + origen.height / 2 - (r.top + r.height / 2);
                // En celular el globo queda lejos, arriba: se respeta la direccion, pero el viaje es mas corto
                const largo = Math.hypot(dx, dy), tope = 420 * k;
                if (largo > tope) { dx = dx * tope / largo; dy = dy * tope / largo; }
            }
            entra(t, { opacity: 0, transform: 'translate(' + Math.round(dx) + 'px, ' + Math.round(dy) + 'px) scale(.3)' },
                  { duration: 760, delay: retraso + i * 90 });
        });
    }
    if (resultados) {
        grupo(resultados, Array.from(resultados.children), function () {
            resultadosArmados = true;
            lanzarTarjetas(320);
        });
        // Las vacantes que llegan despues: salen del globo en cuanto aparecen (antes de pintarse)
        if ('MutationObserver' in window) {
            new MutationObserver(function () { if (resultadosArmados) lanzarTarjetas(0); })
                .observe(resultados, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
        }
    }
    const pie = document.querySelector('.cerca-pie');
    grupo(pie, [pie], function () { entra(pie, { opacity: 0, transform: sube(8) }, { duration: 500, delay: 200 }); });

    // 4. Como funciona: el panel del paso entra desde la rueda (de lado; en celular, desde arriba)
    const lado = document.querySelector('.cf-lado');
    grupo(lado, [lado], function () {
        const desde = window.matchMedia('(max-width: 900px)').matches ? sube(-24) : 'translateX(-48px)';
        entra(lado, { opacity: 0, transform: desde }, { duration: 820, delay: 260 });
    });

    // 5. Dos caminos: titulo palabra por palabra; la persona entra por la izquierda y la empresa por la
    //    derecha; se encuentran en el centro y ahi se enciende la chispa del match
    const cierre = document.querySelector('.cta-final');
    if (cierre) {
        const h = cierre.querySelector('h2'), p = cierre.querySelector('.container > p');
        const ps = palabras(h);
        grupo(cierre.querySelector('.container'), ps.concat(p), function () {
            ps.forEach(function (w, i) { entra(w, { opacity: 0, transform: 'translateY(.55em)' }, { duration: 560, delay: i * 60 }); });
            entra(p, { opacity: 0, transform: sube(10) }, { duration: 560, delay: 100 + ps.length * 60 });
        });
        const caminos = cierre.querySelector('.pathways');
        const persona = cierre.querySelector('.pathway-card.usuario'), empresa = cierre.querySelector('.pathway-card.empresa');
        const chispa = cierre.querySelector('.caminos-chispa');
        grupo(caminos, [persona, empresa], function () {
            const lejos = Math.round(110 * k), llega = 900, retraso = 150;
            // Se pasan 4 px hacia el centro (el choque) y vuelven: el encuentro se siente
            [[persona, -1], [empresa, 1]].forEach(function (c) {
                if (!c[0]) return;
                c[0].animate([
                    { offset: 0, opacity: 0, transform: 'translateX(' + (c[1] * lejos) + 'px) rotate(' + (c[1] * 3) + 'deg)' },
                    { offset: .72, opacity: 1, transform: 'translateX(' + (-c[1] * 4) + 'px) rotate(0deg)', easing: 'cubic-bezier(.3, 0, .3, 1)' }
                ], { duration: llega, delay: retraso, easing: SALIDA, fill: 'backwards' });
            });
            if (chispa) {
                chispa.animate([
                    { opacity: 0, transform: 'scale(.3)' },
                    { opacity: 1, transform: 'scale(1.5)', offset: .25 },
                    { opacity: .8, transform: 'scale(2.2)', offset: .55 },
                    { opacity: 0, transform: 'scale(3.2)' }
                ], { duration: 1000, delay: retraso + llega * .66, easing: 'cubic-bezier(.2, .8, .3, 1)' });
            }
        });
    }

    // Vigila todos los grupos: cada uno se arma una vez, cuando su borde de arriba pasa el 88 % de la pantalla
    const vigia = new IntersectionObserver(function (entradas) {
        entradas.forEach(function (e) {
            if (!e.isIntersecting) return;
            vigia.unobserve(e.target);
            const g = grupos.filter(function (x) { return x.zona === e.target; })[0];
            if (!g) return;
            g.armar();
            e.target.classList.remove('cons-espera');    // en el mismo cuadro: las animaciones ya las ocultan
        });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0 });
    grupos.forEach(function (g) { vigia.observe(g.zona); });
})();
