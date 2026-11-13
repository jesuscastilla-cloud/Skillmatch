/**
 * rueda-pasos.js — la rueda de "Como funciona" (index.html)
 *
 * Convierte la lista de pasos (.cf-paso) en una rueda: un aro con una pieza por paso.
 * Al elegir una pieza, la rueda gira por el camino mas corto hasta dejarla en el "ancla"
 * (a la derecha, junto al texto; en pantallas angostas, abajo) y se muestra ese paso.
 *
 * Como esta hecho:
 *  - El aro es un SVG que se dibuja aqui con trigonometria (una pieza = un <path>).
 *  - Solo se animan transform y opacity: el giro es un rotate() y el color de la pieza
 *    activa es una capa turquesa que aparece con opacity.
 *  - Cada icono gira al reves que la rueda, con la misma duracion: por eso queda derecho.
 *  - Para el teclado y el lector de pantalla son pestanas (tablist / tab / tabpanel).
 *  - Al verse por primera vez da un paseo por los pasos, una sola vez, y se detiene en
 *    cuanto la persona toca algo. Con "reducir movimiento" no se mueve nada solo.
 *
 * Sin este archivo la pagina sigue funcionando: los pasos se leen en lista.
 */
(function () {
    'use strict';

    const layout = document.querySelector('.cf-layout');
    const rueda = document.getElementById('cfRueda');
    const pasos = layout ? Array.from(layout.querySelectorAll('.cf-paso')) : [];
    if (!layout || !rueda || pasos.length < 2) return;

    const N = pasos.length;
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)');
    const angosto = window.matchMedia('(max-width: 900px)');

    /* ---------- 1. Geometria (en unidades del dibujo: 440 x 440) ---------- */
    const LADO = 440, CENTRO = 220;
    const R_FUERA = 196, R_DENTRO = 116;   // radios del aro (el trazo de 8 lo engrosa 4 por lado)
    const HUECO = 16;                      // separacion entre piezas, del mismo ancho de adentro a afuera
    const R_MARCA = 156;                   // donde va el icono: la mitad del grosor del aro
    const SALTO = 8;                       // cuanto se separa del aro la pieza elegida
    const ANGULO = 360 / N;                // lo que ocupa cada pieza

    const rad = function (grados) { return grados * Math.PI / 180; };
    const num = function (n) { return n.toFixed(2); };
    // Angulos como en un reloj: 0 arriba, creciendo hacia la derecha
    const punto = function (angulo, radio) {
        return [CENTRO + radio * Math.sin(rad(angulo)), CENTRO - radio * Math.cos(rad(angulo))];
    };

    /** El contorno de la pieza i: arco de afuera, borde, arco de adentro y cierre. */
    function contorno(i) {
        const medio = i * ANGULO, mitad = ANGULO / 2;
        // Para que el hueco mida lo mismo afuera y adentro, se recorta mas angulo adentro
        const recorteFuera = Math.asin(HUECO / 2 / R_FUERA) * 180 / Math.PI;
        const recorteDentro = Math.asin(HUECO / 2 / R_DENTRO) * 180 / Math.PI;
        const a = punto(medio - mitad + recorteFuera, R_FUERA);
        const b = punto(medio + mitad - recorteFuera, R_FUERA);
        const c = punto(medio + mitad - recorteDentro, R_DENTRO);
        const d = punto(medio - mitad + recorteDentro, R_DENTRO);
        return 'M' + num(a[0]) + ' ' + num(a[1]) +
               'A' + R_FUERA + ' ' + R_FUERA + ' 0 0 1 ' + num(b[0]) + ' ' + num(b[1]) +
               'L' + num(c[0]) + ' ' + num(c[1]) +
               'A' + R_DENTRO + ' ' + R_DENTRO + ' 0 0 0 ' + num(d[0]) + ' ' + num(d[1]) + 'Z';
    }

    /* ---------- 2. Armar la rueda ---------- */
    const titulos = pasos.map(function (p) { const h = p.querySelector('h3'); return h ? h.textContent.trim() : ''; });
    const dosCifras = function (n) { return (n < 10 ? '0' : '') + n; };

    let piezas = '', marcasHtml = '', numerosHtml = '';
    pasos.forEach(function (paso, i) {
        const d = contorno(i), angulo = i * ANGULO;
        const lugar = punto(angulo, R_MARCA);
        piezas += '<g class="cf-seg" data-i="' + i + '" style="--dx:' + num(SALTO * Math.sin(rad(angulo))) + 'px;--dy:' +
                  num(-SALTO * Math.cos(rad(angulo))) + 'px"><path class="cf-seg-aura" d="' + d + '"/><path class="cf-seg-base" d="' + d + '"/><path class="cf-seg-luz" d="' + d + '"/></g>';
        marcasHtml += '<button type="button" class="cf-marca" role="tab" id="cf-pieza-' + (i + 1) + '" data-i="' + i + '"' +
                      ' aria-controls="' + paso.id + '" aria-label="Paso ' + (i + 1) + ': ' + titulos[i] + '"' +
                      ' style="--x:' + num(lugar[0] / LADO * 100) + '%;--y:' + num(lugar[1] / LADO * 100) + '%">' +
                      '<i data-ico="' + (paso.dataset.ruedaIco || 'circle') + '"></i></button>';
        numerosHtml += '<b>' + dosCifras(i + 1) + '</b>';
    });

    rueda.innerHTML =
        '<svg class="cf-rueda-orbita" viewBox="0 0 440 440" aria-hidden="true" focusable="false"><circle cx="220" cy="220" r="214"/></svg>' +
        '<div class="cf-rueda-giro" role="tablist" aria-label="Los ' + N + ' pasos">' +
            '<svg viewBox="0 0 440 440" aria-hidden="true" focusable="false">' +
                // Degradado redondo desde el centro: se ve igual por mas que la rueda gire
                '<defs><radialGradient id="cfRuedaLuz" gradientUnits="userSpaceOnUse" cx="220" cy="220" r="204">' +
                '<stop offset=".54" stop-color="#0B7E8C"/><stop offset="1" stop-color="#16A9BA"/></radialGradient></defs>' +
                piezas +
            '</svg>' + marcasHtml +
        '</div>' +
        '<button type="button" class="cf-rueda-centro" aria-label="Ir al paso siguiente">' +
            '<span class="cf-centro-rotulo" aria-hidden="true">Paso</span>' +
            '<span class="cf-centro-numeros" aria-hidden="true">' + numerosHtml + '</span>' +
            '<span class="cf-centro-sigue" aria-hidden="true"><i data-ico="arrow"></i></span>' +
        '</button>' +
        '<span class="cf-rueda-chispa" aria-hidden="true"></span>';

    const lado = layout.querySelector('.cf-lado') || layout;
    const controles = document.createElement('div');
    controles.className = 'cf-controles';
    controles.innerHTML =
        '<button type="button" class="cf-flecha" data-ir="-1" aria-label="Paso anterior"><i data-ico="arrow"></i></button>' +
        '<span class="cf-cuenta"></span>' +
        '<button type="button" class="cf-flecha" data-ir="1" aria-label="Paso siguiente"><i data-ico="arrow"></i></button>';
    lado.appendChild(controles);

    const elGiro = rueda.querySelector('.cf-rueda-giro');
    const segmentos = Array.from(rueda.querySelectorAll('.cf-seg'));
    const marcas = Array.from(rueda.querySelectorAll('.cf-marca'));
    const numeros = Array.from(rueda.querySelectorAll('.cf-centro-numeros b'));
    const centro = rueda.querySelector('.cf-rueda-centro');
    const cuenta = controles.querySelector('.cf-cuenta');

    // Para el lector de pantalla: la lista pasa a ser paneles de pestanas
    const lista = layout.querySelector('.cf-pasos');
    if (lista) lista.setAttribute('role', 'presentation');
    pasos.forEach(function (paso, i) {
        paso.setAttribute('role', 'tabpanel');
        paso.setAttribute('aria-labelledby', 'cf-pieza-' + (i + 1));
    });

    // Si ui.js ya cargo, que dibuje los iconos ahora; si no, los dibuja el al iniciar
    if (window.SkillMatchUI && window.SkillMatchUI.hidratarIconos) window.SkillMatchUI.hidratarIconos(layout);
    layout.classList.add('con-rueda');

    /* ---------- 3. Estado y giro ---------- */
    let actual = 0;      // paso elegido (0..N-1)
    let giro = 0;        // grados que lleva girada la rueda (se acumulan: asi siempre va por el lado corto)

    const ancla = function () { return angosto.matches ? 180 : 90; };

    /** Escribe el giro de la rueda y endereza cada icono. */
    function colocar() {
        const px = rueda.clientWidth / LADO;   // cuanto mide una unidad del dibujo en la pantalla
        elGiro.style.transform = 'rotate(' + giro + 'deg)';
        marcas.forEach(function (marca, i) {
            const angulo = i * ANGULO, elegido = i === actual;
            const salto = elegido ? SALTO * px : 0;
            marca.style.transform = 'translate(-50%, -50%) translate(' + num(salto * Math.sin(rad(angulo))) + 'px, ' +
                num(-salto * Math.cos(rad(angulo))) + 'px) rotate(' + (-giro) + 'deg) scale(' + (elegido ? 1.14 : 1) + ')';
        });
    }

    /** Hace algo sin transiciones (primer dibujo, cambio de tamano de pantalla). */
    function sinAnimar(hacer) {
        rueda.classList.add('quieta');
        hacer();
        void rueda.offsetWidth;                // obliga a aplicar el estilo antes de devolver las transiciones
        rueda.classList.remove('quieta');
    }

    /** Elige el paso i: gira la rueda y muestra su texto y su escena. */
    function ir(i) {
        i = ((i % N) + N) % N;
        const destino = ancla() - i * ANGULO;
        giro += ((destino - giro) % 360 + 540) % 360 - 180;   // la diferencia, llevada a -180..180
        actual = i;

        segmentos.forEach(function (s, k) { s.classList.toggle('is-activo', k === i); });
        marcas.forEach(function (m, k) {
            m.classList.toggle('is-activo', k === i);
            m.setAttribute('aria-selected', String(k === i));
            m.tabIndex = k === i ? 0 : -1;     // con Tab se entra a la rueda una vez; adentro se usan las flechas
        });
        numeros.forEach(function (n, k) {
            n.classList.toggle('is-activo', k === i);
            n.classList.toggle('es-pasado', k < i);
        });
        pasos.forEach(function (p, k) { p.classList.toggle('is-activo', k === i); });
        layout.dataset.escena = String(i + 1);
        cuenta.textContent = 'Paso ' + (i + 1) + ' de ' + N;
        colocar();
        contarAnillo(pasos[i]);
    }

    /** El anillo de compatibilidad del paso vuelve a llenarse cada vez que se muestra. */
    function contarAnillo(paso) {
        const anillo = paso.querySelector('.match-ring[data-pct]');
        if (!anillo || !anillo.dataset.dibujado || reducido.matches) return;   // dibujado: ya paso ui.js por el
        const meta = parseInt(anillo.dataset.pct, 10) || 0;
        const texto = anillo.querySelector('span');
        const turno = String(Date.now());
        anillo.dataset.turno = turno;
        anillo.style.setProperty('--pct', 0);
        if (texto) texto.textContent = '0%';
        let inicio = 0;
        const cuadro = function (ahora) {
            if (anillo.dataset.turno !== turno) return;        // se eligio otro paso y se volvio: manda el ultimo
            if (!inicio) inicio = ahora + 450;                  // espera a que la escena termine de entrar
            const t = Math.max(0, Math.min(1, (ahora - inicio) / 800));
            const valor = Math.round(meta * (1 - Math.pow(1 - t, 3)));
            anillo.style.setProperty('--pct', valor);
            if (texto) texto.textContent = valor + '%';
            if (t < 1) requestAnimationFrame(cuadro);
        };
        requestAnimationFrame(cuadro);
    }

    sinAnimar(function () { ir(0); });

    /* ---------- 4. El paseo de presentacion (una sola vuelta) ---------- */
    const ESPERA = 5200;
    let reloj = null, paseados = 0, tocado = false, encima = false, visible = false;

    function programar() {
        clearTimeout(reloj);
        if (tocado || encima || !visible || paseados >= N || reducido.matches) return;
        reloj = setTimeout(function () {
            paseados++;
            ir(actual + 1);
            programar();
        }, ESPERA);
    }
    /** La persona tomo el control: el paseo no vuelve. */
    function soltar() { tocado = true; clearTimeout(reloj); }

    /* ---------- 5. Entrada: las piezas llegan una tras otra mientras la rueda da media vuelta ---------- */
    function entrada() {
        if (reducido.matches || !elGiro.animate) return;
        const suave = 'cubic-bezier(.16, 1, .3, 1)', dura = 1300, desde = giro - 150;
        // Solo se escribe el cuadro de salida: la llegada es "donde este la rueda en ese momento".
        // Asi, si alguien elige otro paso en plena entrada, la rueda va hacia alla sin saltos
        elGiro.animate([{ transform: 'rotate(' + desde + 'deg)', offset: 0 }], { duration: dura, easing: suave });
        marcas.forEach(function (marca, i) {
            // Mismo tiempo y misma curva que la rueda: el icono no se tuerce en ningun momento
            marca.animate([{ transform: marca.style.transform.replace(/rotate\([^)]*\)/, 'rotate(' + (-desde) + 'deg)'), offset: 0 }],
                          { duration: dura, easing: suave });
            marca.animate([{ opacity: 0, offset: 0 }], { duration: 500, delay: 200 + i * 110, easing: 'ease-out', fill: 'backwards' });
        });
        // Cada pieza llega desde su propio lado (la de arriba desde arriba, la de la derecha desde la
        // derecha...), se pasa un poco hacia el centro y vuelve: encaja con un pequeno golpe. Como la rueda
        // da media vuelta mientras tanto, las cuatro llegan en espiral y se arman en el aro
        segmentos.forEach(function (s, i) {
            const a = rad(i * ANGULO), lejos = 120, golpe = 3;
            s.animate([
                { offset: 0, opacity: 0, transform: 'translate(' + num(lejos * Math.sin(a)) + 'px, ' + num(-lejos * Math.cos(a)) + 'px)' },
                { offset: .35, opacity: 1 },
                { offset: .8, transform: 'translate(' + num(-golpe * Math.sin(a)) + 'px, ' + num(golpe * Math.cos(a)) + 'px)', easing: 'cubic-bezier(.3, 0, .3, 1)' }
            ], { duration: 1000, delay: 80 + i * 130, easing: suave, fill: 'backwards' });
        });
        centro.animate([{ opacity: 0, transform: 'translate(-50%, -50%) scale(.6)', offset: 0 }], { duration: 900, delay: 300, easing: suave, fill: 'backwards' });
    }

    if ('IntersectionObserver' in window) {
        let entro = false;
        if (!reducido.matches) rueda.classList.add('por-entrar');   // oculta hasta su entrada (sin parpadeo)
        new IntersectionObserver(function (entradas) {
            visible = entradas[0].isIntersecting;
            rueda.classList.toggle('en-vista', visible);            // la orbita y la chispa solo se mueven a la vista
            if (visible && !entro) {
                entro = true;
                entrada();
                rueda.classList.remove('por-entrar');
            }
            programar();
        }, { threshold: 0.35 }).observe(rueda);
    }

    /* ---------- 6. Mouse, toque y teclado ---------- */
    elGiro.addEventListener('click', function (e) {
        const pieza = e.target.closest('.cf-seg, .cf-marca');
        if (!pieza) return;
        soltar();
        ir(Number(pieza.dataset.i));
    });
    centro.addEventListener('click', function () { soltar(); ir(actual + 1); });
    controles.addEventListener('click', function (e) {
        const flecha = e.target.closest('.cf-flecha');
        if (!flecha) return;
        soltar();
        ir(actual + Number(flecha.dataset.ir));
    });
    // Flechas del teclado dentro de la rueda, como en cualquier grupo de pestanas
    elGiro.addEventListener('keydown', function (e) {
        const a = { ArrowRight: actual + 1, ArrowDown: actual + 1, ArrowLeft: actual - 1, ArrowUp: actual - 1, Home: 0, End: N - 1 }[e.key];
        if (a === undefined) return;
        e.preventDefault();
        soltar();
        ir(a);
        marcas[actual].focus({ preventScroll: true });
    });
    // Tocar o enfocar cualquier parte de la seccion detiene el paseo; el mouse encima lo pausa
    layout.addEventListener('pointerdown', soltar);
    layout.addEventListener('focusin', soltar);
    layout.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') { encima = true; clearTimeout(reloj); } });
    layout.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') { encima = false; programar(); } });

    // Al cambiar de ancho, el ancla pasa de la derecha a abajo (o al reves) y el salto cambia de tamano
    const reacomodar = function () { sinAnimar(function () { ir(actual); }); };
    if (angosto.addEventListener) angosto.addEventListener('change', reacomodar);
    if ('ResizeObserver' in window) new ResizeObserver(function () { sinAnimar(colocar); }).observe(rueda);

    // Para las pruebas y para quien quiera moverla desde fuera
    window.SkillMatchRueda = { ir: function (i) { soltar(); ir(i); }, actual: function () { return actual; } };
})();
