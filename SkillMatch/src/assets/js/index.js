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

/* ---------- Los dos caminos son contratos (pedidos de Luis 2026-11-15; app.css seccion 90) ----------
   Cada tarjeta del cierre se vuelve un contrato de hoy: hoja blanca, la firma a pluma y el sello de caucho de
   SkillMatch. Aqui se arman sus piezas (siempre) y abrir() hace la animacion, una sola vez, cuando la tarjeta llega a
   la pantalla:
   1. se desenrolla de arriba a abajo: un rollo de papel baja y descubre la hoja (una ventana que baja mientras su
      contenido sube lo mismo: el texto queda quieto y solo se mueven transform); al llegar, el rollo se aplana y
      desaparece;
   2. la firma se escribe sola, trazo por trazo, a velocidad de pluma;
   3. el sello de SkillMatch se estampa en la esquina, con un golpe.
   Con "reducir movimiento" (o sin animaciones) no se llama a abrir(): ya esta firmado y sellado. */
const DIPLOMAS = (function () {
    const tarjetas = Array.from(document.querySelectorAll('.cta-final .pathway-card'));
    if (!tarjetas.length) return null;
    const SVG = 'http://www.w3.org/2000/svg';

    // La firma: "SkillMatch" en EMS Allure, una fuente de un solo trazo (licencia OFL; assets/fonts/LEEME.md),
    // suavizada y con un rasgo debajo. Cada trazo con su largo, para que la pluma vaya a velocidad pareja
    const FIRMA = {
        caja: '-42 -788 4977 1236',
        trazos: [
            ['M693 -580C698 -587 716 -606 721 -621C726 -636 730 -653 721 -668C712 -683 699 -705 665 -709C632 -713 573 -702 520 -690C468 -678 392 -658 350 -636C308 -614 282 -583 268 -558C254 -533 249 -505 265 -485C281 -465 320 -454 362 -438C404 -422 475 -408 517 -391C560 -374 594 -356 617 -337C641 -318 652 -296 658 -277C664 -258 659 -242 652 -224C645 -206 639 -191 617 -170C596 -149 564 -120 523 -98C482 -75 431 -52 372 -35C313 -17 219 2 167 6C116 11 86 0 63 -9C40 -18 36 -27 28 -47C21 -67 15 -103 19 -129C23 -155 37 -181 54 -202C70 -223 94 -240 117 -255C140 -270 160 -281 189 -293C218 -304 276 -319 293 -324', 2334],
            ['M675 -183C685 -194 716 -226 738 -252C759 -278 793 -323 804 -337', 201],
            ['M779 -356C793 -356 831 -344 864 -356C897 -368 940 -397 977 -428C1014 -459 1059 -509 1087 -542C1115 -575 1133 -601 1144 -627C1156 -653 1161 -679 1156 -696C1151 -713 1134 -728 1112 -728C1090 -728 1050 -714 1024 -696C998 -677 978 -650 955 -617C933 -584 910 -535 889 -498C869 -461 859 -454 832 -394C805 -334 749 -203 725 -139C701 -75 686 -27 687 -13C688 2 709 -27 731 -54C753 -80 788 -135 819 -173C851 -211 891 -256 920 -284C950 -312 975 -333 996 -343C1017 -353 1038 -345 1046 -346', 1971],
            ['M845 -249C853 -215 872 -100 892 -44C912 12 935 53 964 85C993 117 1040 138 1068 148C1096 159 1118 153 1134 148C1150 143 1158 128 1163 120C1168 112 1166 110 1166 101C1166 92 1164 72 1163 66', 640],
            ['M1031 -183C1042 -192 1085 -212 1100 -236C1115 -260 1135 -353 1122 -328C1109 -303 1037 -136 1024 -85C1011 -34 1028 -35 1043 -22C1058 -9 1090 2 1116 -6C1141 -14 1172 -49 1194 -69C1216 -90 1231 -110 1245 -129C1259 -148 1273 -174 1279 -183', 827],
            ['M1185 -476L1157 -438', 48],
            ['M1286 -176C1305 -191 1358 -223 1402 -265C1446 -307 1508 -374 1550 -428C1592 -482 1631 -550 1657 -589C1683 -628 1699 -642 1705 -662C1711 -682 1706 -700 1692 -709C1678 -718 1646 -724 1623 -718C1600 -712 1581 -705 1554 -674C1527 -643 1493 -588 1459 -532C1425 -476 1381 -396 1352 -340C1323 -284 1298 -240 1283 -198C1267 -155 1260 -114 1261 -85C1262 -56 1273 -36 1289 -25C1305 -14 1331 -14 1355 -19C1379 -24 1406 -35 1431 -54C1456 -72 1488 -110 1506 -132C1524 -154 1535 -174 1541 -183', 1898],
            ['M1547 -176C1566 -191 1619 -223 1663 -265C1707 -307 1769 -374 1811 -428C1853 -482 1892 -550 1918 -589C1944 -628 1960 -642 1966 -662C1972 -682 1967 -700 1953 -709C1939 -718 1907 -724 1884 -718C1861 -712 1842 -705 1815 -674C1788 -643 1754 -588 1720 -532C1686 -476 1642 -396 1613 -340C1584 -284 1559 -240 1544 -198C1528 -155 1521 -114 1522 -85C1523 -56 1534 -36 1550 -25C1566 -14 1592 -14 1616 -19C1640 -24 1667 -35 1692 -54C1717 -72 1749 -110 1767 -132C1785 -154 1796 -174 1802 -183', 1898],
            ['M2057 -536C2070 -542 2115 -558 2135 -570C2155 -581 2163 -592 2176 -605C2189 -618 2201 -631 2211 -646C2222 -661 2231 -684 2239 -693C2247 -702 2268 -726 2261 -699C2254 -672 2222 -593 2198 -529C2175 -465 2147 -378 2120 -315C2093 -251 2064 -197 2038 -148C2012 -99 1986 -50 1962 -19C1938 13 1918 28 1896 41C1875 54 1850 64 1833 60C1816 56 1798 34 1795 16C1792 -2 1792 -14 1814 -47C1836 -81 1883 -134 1928 -186C1972 -237 2023 -297 2082 -356C2141 -415 2227 -499 2280 -542C2334 -585 2369 -599 2403 -614C2437 -629 2457 -634 2482 -633C2507 -631 2536 -625 2554 -605C2572 -585 2586 -561 2589 -513C2592 -465 2579 -369 2573 -315C2567 -261 2563 -229 2554 -189C2545 -149 2522 -93 2520 -76C2519 -58 2529 -61 2545 -82C2561 -102 2576 -134 2617 -198C2659 -261 2752 -401 2794 -463C2836 -525 2845 -544 2869 -570C2893 -596 2919 -614 2939 -621C2959 -628 2978 -619 2989 -614C3001 -609 3003 -601 3008 -589C3013 -576 3025 -566 3021 -539C3016 -512 2995 -459 2983 -428C2970 -396 2959 -379 2945 -350C2931 -321 2912 -283 2901 -255C2890 -227 2883 -206 2879 -180C2875 -154 2873 -127 2879 -101C2885 -75 2894 -32 2917 -22C2939 -11 2981 -20 3014 -38C3048 -56 3095 -105 3118 -129C3141 -153 3147 -174 3153 -183', 4505],
            ['M3679 -183C3673 -174 3656 -149 3641 -132C3627 -115 3611 -95 3590 -79C3569 -62 3538 -41 3515 -31C3493 -21 3470 -14 3455 -19C3441 -24 3430 -42 3427 -63C3425 -83 3431 -107 3439 -142C3448 -177 3477 -257 3480 -274C3484 -291 3481 -264 3461 -243C3441 -221 3395 -176 3360 -145C3326 -114 3286 -78 3254 -57C3221 -36 3188 -17 3165 -19C3143 -20 3128 -44 3121 -66C3115 -89 3111 -121 3128 -154C3144 -186 3185 -231 3219 -261C3253 -290 3300 -315 3332 -331C3365 -347 3387 -352 3414 -356C3442 -360 3481 -358 3496 -356C3512 -354 3506 -345 3508 -343', 1581],
            ['M3679 -183C3687 -190 3715 -211 3729 -224C3743 -237 3749 -242 3764 -261C3779 -280 3799 -304 3820 -337C3842 -370 3876 -428 3893 -457C3911 -486 3927 -500 3927 -510C3927 -520 3928 -577 3893 -517C3859 -457 3751 -226 3720 -151C3688 -76 3702 -88 3704 -66C3706 -45 3712 -28 3729 -22C3747 -16 3779 -14 3808 -28C3837 -43 3876 -84 3902 -110C3929 -136 3957 -171 3968 -183', 1293],
            ['M3764 -346L3968 -356', 205],
            ['M4243 -306C4243 -313 4247 -340 4239 -350C4232 -360 4221 -369 4198 -365C4175 -361 4137 -354 4101 -328C4066 -302 4009 -234 3985 -208C3960 -182 3963 -186 3953 -170C3944 -154 3931 -127 3928 -110C3925 -93 3930 -80 3934 -66C3938 -52 3933 -34 3953 -25C3974 -17 4018 -10 4057 -16C4096 -21 4151 -39 4186 -57C4222 -75 4247 -102 4268 -123C4290 -144 4308 -173 4315 -183', 984],
            ['M4315 -183C4339 -205 4397 -265 4459 -315C4522 -365 4634 -434 4689 -482C4745 -530 4772 -568 4793 -605C4814 -642 4824 -683 4815 -702C4807 -721 4765 -725 4740 -718C4716 -711 4694 -684 4670 -662C4647 -640 4625 -620 4601 -586C4577 -552 4552 -503 4526 -457C4501 -411 4475 -380 4447 -309C4419 -238 4357 -58 4359 -31C4360 -5 4426 -111 4456 -148C4486 -185 4509 -224 4538 -252C4568 -280 4611 -301 4633 -315C4656 -329 4664 -334 4674 -334C4685 -333 4694 -324 4696 -312C4698 -300 4696 -282 4686 -261C4676 -239 4650 -214 4636 -183C4623 -152 4608 -103 4607 -76C4606 -48 4616 -28 4630 -19C4645 -9 4675 -11 4696 -19C4718 -26 4737 -45 4759 -63C4781 -81 4809 -109 4828 -129C4848 -149 4868 -174 4875 -183', 2719],
            ['M 4620 110 C 3900 290 2100 300 980 215 C 700 195 600 165 700 140', 4022]
        ]
    };
    // La punta ancha de la pluma: 5 copias del trazo corridas en diagonal (45 grados). Donde el trazo va en
    // la direccion de la punta queda fino y donde va de traves queda grueso, como la tinta de antes
    const PUNTA = [-28, -14, 0, 14, 28];
    function firma() {
        const svg = document.createElementNS(SVG, 'svg');
        svg.setAttribute('viewBox', FIRMA.caja);
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');
        PUNTA.forEach(function (p) {
            const g = document.createElementNS(SVG, 'g');
            g.setAttribute('transform', 'translate(' + p + ' ' + (-p) + ')');
            FIRMA.trazos.forEach(function (t, i) {
                const path = document.createElementNS(SVG, 'path');
                path.setAttribute('d', t[0]);
                path.setAttribute('pathLength', '1');
                path.dataset.trazo = i;
                g.appendChild(path);
            });
            svg.appendChild(g);
        });
        return svg;
    }

    // El sello: de caucho, entintado en turquesa (como el de una notaria o una empresa): doble aro, el nombre
    // alrededor y las dos personas del logo en el centro. La tinta no queda pareja: una mascara le quita puntitos y
    // rayitas aqui y alla, como un sello de verdad. Son figuras fijas (siempre las mismas): con un filtro de ruido
    // el primer cuadro de la animacion tardaba ~90 ms (medido). Cada contrato necesita sus propios id
    function sello(n) {
        const tinta = '#0A6F7B';
        let huecos = '', s = 7 + n * 13;
        const azar = function () { s = (s * 9301 + 49297) % 233280; return s / 233280; };
        for (let i = 0; i < 70; i++) {
            const a = azar() * Math.PI * 2, r = 8 + azar() * 40;
            huecos += '<circle cx="' + (50 + r * Math.cos(a)).toFixed(1) + '" cy="' + (50 + r * Math.sin(a)).toFixed(1) + '" r="' + (.35 + azar() * .9).toFixed(2) + '"/>';
        }
        for (let i = 0; i < 6; i++) {
            const x = 12 + azar() * 70, y = 12 + azar() * 70;
            huecos += '<path d="M' + x.toFixed(1) + ' ' + y.toFixed(1) + 'l' + (4 + azar() * 6).toFixed(1) + ' ' + (azar() * 2 - 1).toFixed(1) + '" stroke="#000000" stroke-width=".7" stroke-linecap="round"/>';
        }
        return '<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">' +
            '<defs>' +
                '<mask id="selloTinta' + n + '"><rect width="100" height="100" fill="#FFFFFF"/><g fill="#000000">' + huecos + '</g></mask>' +
                '<path id="selloAro' + n + '" d="M50 50m-34.5 0a34.5 34.5 0 1 1 69 0a34.5 34.5 0 1 1 -69 0"/>' +
            '</defs>' +
            '<g mask="url(#selloTinta' + n + ')" fill="none" stroke="' + tinta + '">' +
                '<circle cx="50" cy="50" r="46" stroke-width="3"/>' +
                '<circle cx="50" cy="50" r="41.5" stroke-width="1"/>' +
                '<circle cx="50" cy="50" r="26" stroke-width="1.2"/>' +
                '<text font-size="8" font-weight="700" fill="' + tinta + '" stroke="none" font-family="Instrument Sans, sans-serif"><textPath href="#selloAro' + n + '" textLength="212" lengthAdjust="spacing">SKILLMATCH · CARTAGENA DE INDIAS ·</textPath></text>' +
                // Las dos personas del logo y el gancho del match
                '<g fill="' + tinta + '" stroke="none">' +
                    '<circle cx="44" cy="41" r="5"/>' +
                    '<path d="M34.5 62v-7a9.5 9.5 0 0 1 9.5-9.5h.6a8.2 8.2 0 0 1 8.2 8.2V62z"/>' +
                    '<circle cx="57" cy="41" r="5"/>' +
                    '<path d="M48.8 62v-7a9.5 9.5 0 0 1 9.5-9.5a9.5 9.5 0 0 1 9.5 9.5V62z"/>' +
                '</g>' +
                '<path d="M51.5 51.5c-4 2-5.5 5.8-2.8 8.3" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round"/>' +
            '</g>' +
        '</svg>';
    }

    function armarDiploma(tarjeta, n) {
        tarjeta.classList.add('diploma');
        const papel = document.createElement('div'), hoja = document.createElement('div');
        papel.className = 'diploma-papel';
        hoja.className = 'diploma-hoja';
        while (tarjeta.firstChild) hoja.appendChild(tarjeta.firstChild);
        // El pie: la firma sobre su linea y quien firma. Es adorno: el lector de pantalla no lo lee
        const pie = document.createElement('div');
        pie.className = 'diploma-pie';
        pie.setAttribute('aria-hidden', 'true');
        const bloque = document.createElement('div');
        bloque.className = 'diploma-firma';
        bloque.appendChild(firma());
        bloque.insertAdjacentHTML('beforeend', '<span class="diploma-linea"></span><span class="diploma-lugar">SkillMatch, Cartagena de Indias</span>');
        pie.appendChild(bloque);
        hoja.appendChild(pie);
        papel.appendChild(hoja);
        const sombra = document.createElement('span');
        sombra.className = 'diploma-sombra';
        sombra.setAttribute('aria-hidden', 'true');
        tarjeta.appendChild(sombra);
        tarjeta.appendChild(papel);
        // El rollo de papel: solo se ve mientras el contrato se desenrolla (quieto, opacidad 0)
        tarjeta.insertAdjacentHTML('beforeend',
            '<span class="diploma-rollo" aria-hidden="true"></span>' +
            '<span class="diploma-sello" aria-hidden="true"><span class="diploma-sello-onda"></span>' + sello(n) + '</span>');
    }
    tarjetas.forEach(armarDiploma);

    // Curvas: la del cajon de iOS para la hoja que sale (arranca con impulso y se posa largo), la fuerte de
    // salida para lo que entra
    const SALE = 'cubic-bezier(.32, .72, 0, 1)';
    const SALIDA = 'cubic-bezier(.23, 1, .32, 1)';
    const total = FIRMA.trazos.reduce(function (s, t) { return s + t[1]; }, 0);

    /** El contrato llega: la hoja sale de arriba a abajo (como de la impresora), se firma y se sella. "espera" en ms */
    function abrir(tarjeta, espera) {
        const papel = tarjeta.querySelector('.diploma-papel'), hoja = tarjeta.querySelector('.diploma-hoja');
        const sombra = tarjeta.querySelector('.diploma-sombra'), selloEl = tarjeta.querySelector('.diploma-sello');
        const rollo = tarjeta.querySelector('.diploma-rollo');
        if (!papel || !hoja) return;
        const t0 = espera || 0;
        const todas = [];
        const vez = function (el, cuadros, o) {
            const a = el && el.animate(cuadros, Object.assign({ fill: 'backwards' }, o));
            if (a) todas.push(a);
            return a;
        };

        // 1. El contrato se desenrolla (pedido de Luis): aparece enrollado arriba; el rollo baja (y se adelgaza: le
        //    queda menos papel) y la hoja se descubre detras de el (una ventana que baja mientras su contenido sube lo
        //    mismo: el texto queda quieto; solo transform). Al llegar abajo, el rollo se aplana y desaparece: queda
        //    la hoja lisa, como un contrato
        const dura = 1050, t1 = t0 + 220;
        const sube = rollo ? -(tarjeta.offsetHeight - rollo.offsetHeight / 2) : 0;
        vez(tarjeta, [{ transform: 'translateY(14px)' }, { transform: 'none' }], { duration: 620, delay: t0, easing: SALIDA });
        if (rollo) {
            // Sus tiempos van en una sola animacion: aparece (220 ms), baja junto con la hoja (1050 ms) y se aplana (200 ms)
            const largo = 220 + dura + 200;
            todas.push(rollo.animate([
                { opacity: 0, transform: 'translateY(' + sube + 'px) scaleY(1.35)' },
                { opacity: 1, transform: 'translateY(' + sube + 'px) scaleY(1.35)', offset: 220 / largo, easing: SALE },
                { opacity: 1, transform: 'translateY(0) scaleY(1)', offset: (220 + dura) / largo, easing: SALIDA },
                { opacity: 0, transform: 'translateY(3px) scaleY(.35)' }
            ], { duration: largo, delay: t0, fill: 'none' }));
        }
        vez(papel, [{ transform: 'translateY(calc(-100% - 6px))' }, { transform: 'none' }], { duration: dura, delay: t1, easing: SALE });
        vez(hoja, [{ transform: 'translateY(calc(100% + 6px))' }, { transform: 'none' }], { duration: dura, delay: t1, easing: SALE });
        vez(sombra, [{ opacity: 0, transform: 'scaleY(0)' }, { opacity: 1, transform: 'none' }], { duration: dura, delay: t1, easing: SALE });

        // 2. La firma: cada trazo empieza cuando termina el anterior (con un instante de pluma levantada);
        //    las 5 copias de la punta van juntas. Velocidad pareja: cada trazo dura segun su largo
        const t2 = t1 + dura * .8, escribir = 1400, levanta = 40;
        let reloj = t2;
        const momentos = FIRMA.trazos.map(function (t) {
            const d = Math.max(60, Math.round(t[1] / total * escribir));
            const m = { delay: reloj, duration: d };
            reloj += d + levanta;
            return m;
        });
        tarjeta.querySelectorAll('.diploma-firma path').forEach(function (p) {
            const m = momentos[+p.dataset.trazo];
            // Escondido del todo antes de su turno (opacity), para que la punta redonda no deje un punto
            todas.push(p.animate([
                { strokeDasharray: '1 1.2', strokeDashoffset: 1, opacity: 0 },
                { strokeDasharray: '1 1.2', strokeDashoffset: .985, opacity: 1, offset: .015 },
                { strokeDasharray: '1 1.2', strokeDashoffset: 0, opacity: 1 }
            ], { duration: m.duration, delay: m.delay, easing: 'linear', fill: 'backwards' }));
        });

        // 3. El sello: baja, golpea el papel (se aplasta un poco) y se asienta; la onda del golpe
        const t3 = reloj + 120, golpe = t3 + 260;
        vez(selloEl, [
            { opacity: 0, transform: 'translateY(-14px) scale(1.35)' },
            { opacity: 1, transform: 'translateY(0) scale(.95)', offset: .55 },
            { opacity: 1, transform: 'scale(1.02)', offset: .78 },
            { opacity: 1, transform: 'none' }
        ], { duration: 460, delay: t3, easing: SALIDA });
        const onda = selloEl && selloEl.querySelector('.diploma-sello-onda');
        if (onda) todas.push(onda.animate([{ opacity: .8, transform: 'scale(.85)' }, { opacity: 0, transform: 'scale(1.6)' }], { duration: 520, delay: golpe, easing: SALIDA, fill: 'both' }));
        // El papel acusa el golpe: baja 1 px y vuelve
        vez(hoja, [{ transform: 'none' }, { transform: 'translateY(1px)', offset: .3 }, { transform: 'none' }], { duration: 240, delay: golpe, easing: SALIDA, fill: 'none' });
        // Terminado: las piezas dejan sus capas propias (app.css, .diploma-capas), ya no se mueven
        Promise.all(todas.map(function (a) { return a.finished; }))
            .then(function () { tarjeta.classList.remove('diploma-capas'); })
            .catch(function () { /* cancelada: se queda como esta */ });
    }

    return { tarjetas: tarjetas, abrir: abrir };
})();

/* ---------- La portada se construye al bajar (app.css, seccion 52) ----------
   Cada grupo de piezas se arma UNA vez, cuando llega a la pantalla (no es parallax: al seguir bajando
   nada se mueve). Cada pieza llega de donde tiene sentido:
   - los titulos se arman palabra por palabra, como el de la portada;
   - los filtros salen de debajo de la barra de busqueda;
   - el globo sube como un planeta y las vacantes salen volando DEL globo hasta su lugar;
   - el panel del paso entra desde la rueda (la rueda arma sus piezas en rueda-pasos.js);
   - en el cierre, cada camino es un diploma que se desenrolla, se firma y se sella (DIPLOMAS, arriba).
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
        // Los diplomas: cada uno se abre cuando ya se ve casi la mitad (asi se ve desenrollarse, firmarse y
        // sellarse; en el celular, uno debajo del otro, cada uno a su turno). Esperan invisibles, sin moverse
        // de su lugar (no cambia el alto de la pagina). Si llegan juntos (en el computador), el segundo va
        // un poco despues
        if (DIPLOMAS) {
            let ultima = -1e9, seguidas = 0;
            const verlos = new IntersectionObserver(function (entradas) {
                entradas.forEach(function (e) {
                    // Casi la mitad a la vista, o (si el contrato es mas alto que la pantalla, como en un celular
                    // acostado) que ya ocupe el 60 % de ella: si no, podria no abrirse nunca y quedarse invisible
                    if (!e.isIntersecting || (e.intersectionRatio < .42 && e.intersectionRect.height < innerHeight * .6)) return;
                    verlos.unobserve(e.target);
                    const ahora = performance.now();
                    seguidas = ahora - ultima < 150 ? seguidas + 1 : 0;
                    ultima = ahora;
                    DIPLOMAS.abrir(e.target, seguidas * 170);
                    e.target.classList.remove('cons-espera');    // en el mismo cuadro: las animaciones ya lo ocultan
                });
            }, { threshold: [.1, .2, .3, .42] });
            // Mientras esperan, cada pieza que se va a mover ya tiene su capa dibujada (.diploma-capas, app.css
            // seccion 90): sin esto, el primer cuadro del desenrollado tardaba ~62 ms dibujando el papel
            DIPLOMAS.tarjetas.forEach(function (t) { t.classList.add('cons-pieza', 'cons-espera', 'diploma-capas'); verlos.observe(t); });
        }
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
