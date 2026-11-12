/* ===============================================================
 * escenas.js — escenas isometricas animadas de SkillMatch
 *
 * Que hace:
 *  - Dibuja escenas SVG en estilo isometrico (casas, edificios, calles)
 *    dentro de cada <div class="escenario" data-escena="nombre">.
 *  - Las anima con la herramienta que ya trae el navegador (Web Animations),
 *    sin librerias. Cada escena tiene UNA linea de tiempo que se repite:
 *    todas sus piezas comparten reloj, asi que se detienen y siguen juntas.
 *    Cada pieza tiene una animacion corta que dura solo lo que tarda en entrar
 *    (y otra al salir): mientras espera su turno o ya llego, el navegador no
 *    gasta nada en ella. Asi en cada cuadro solo trabajan las 2 o 3 que se mueven.
 *  - Solo mueve transform y opacity (rendimiento a 60 cuadros por segundo).
 *  - Se detiene sola fuera de pantalla o con la pestana oculta, y con
 *    "reducir movimiento" se queda quieta en su cuadro final.
 *  - Con mouse real se inclina unos grados cuando el cursor pasa por encima
 *    (nunca en pantallas tactiles).
 *
 * Para agregar otra escena: una receta nueva en CONSTRUCTORES (ciclo y dibujar)
 * y en el HTML <div class="escenario" data-escena="..."><svg viewBox="0 0 480 360"
 * role="img" aria-label="..."><g class="escena-raiz"></g></svg></div>.
 * =============================================================== */
(function () {
    'use strict';

    var rm = window.matchMedia('(prefers-reduced-motion: reduce)');
    var conMouse = window.matchMedia('(hover: hover) and (pointer: fine)');
    var reducido = rm.matches;
    if (!('animate' in Element.prototype) || typeof KeyframeEffect === 'undefined') return;

    /* Curvas de aceleracion compartidas: todo el movimiento sale de esta lista */
    var CURVA = {
        salida: 'cubic-bezier(.22, 1, .36, 1)',     // arranca rapido y llega despacio
        viaje: 'cubic-bezier(.65, 0, .35, 1)',      // acelera y frena: para trayectos
        suave: 'cubic-bezier(.4, 0, .2, 1)'
    };

    /* ================= Piezas isometricas (las mismas para todas las escenas) ================= */
    // Colores de cada cara (arriba, izquierda, derecha): turquesa y naranja del logo, azul marino
    var C = {
        suelo: { arriba: '#E4EEF6', izq: '#AFC6D8', der: '#8FADC4' },
        pared: { arriba: '#F4F8FB', izq: '#FFFFFF', der: '#D6E3EE' },
        hotel: { arriba: '#EEF4F9', izq: '#FFFFFF', der: '#D2E0EB' },
        cian: { arriba: '#5FD0DC', izq: '#2BB6C6', der: '#1B8F9C' },
        naranja: { arriba: '#FFA05C', izq: '#FF7618', der: '#D45F10' },
        navy: { arriba: '#1A3A5E', izq: '#12365E', der: '#0B2440' },
        vidrioAuto: { arriba: '#CFEFF5', izq: '#9DD6E2', der: '#78BCCB' },
        ventana: ['#B7C9D8', '#A6BDCF'],
        ventanaLuz: ['#5FD0DC', '#2BB6C6'],
        acera: '#CBD9E5', calle: '#2B4766', navyTexto: '#08203C'
    };
    function f1(n) { return n.toFixed(1); }

    // Proyeccion isometrica: un punto (x, y, z) del mundo pasa a la pantalla
    function Iso(OX, OY) {
        var iso = function (x, y, z) { return [OX + (x - y) * 0.866, OY + (x + y) * 0.5 - z]; };
        var P = function (l) { return l.map(function (q) { var s = iso(q[0], q[1], q[2]); return f1(s[0]) + ',' + f1(s[1]); }).join(' '); };
        var poli = function (l, c) { return '<polygon points="' + P(l) + '" fill="' + c + '"/>'; };
        // Caja: solo se ven tres caras (izquierda, derecha y arriba)
        var caja = function (x, y, z, w, d, h, c) {
            return poli([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]], c.izq) +
                   poli([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]], c.der) +
                   poli([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]], c.arriba);
        };
        // Techo de cuatro aguas sobre una caja (solo se ven las dos caras de adelante)
        var techo = function (x, y, z, w, d, h, c1, c2) {
            var a = [x + w / 2, y + d / 2, z + h];
            return poli([[x, y + d, z], [x + w, y + d, z], a], c1) + poli([[x + w, y, z], [x + w, y + d, z], a], c2);
        };
        // Ventanas de un piso en las dos caras de adelante de un edificio
        var ventanas = function (x, y, w, d, z1, alto, colores, n1, n2) {
            var v = '', paso1 = w / n1, paso2 = d / n2, an = Math.min(7, paso1 * .55), an2 = Math.min(7, paso2 * .55);
            for (var i = 0; i < n1; i++) { var wx = x + paso1 * i + (paso1 - an) / 2; v += poli([[wx, y + d + .1, z1], [wx + an, y + d + .1, z1], [wx + an, y + d + .1, z1 + alto], [wx, y + d + .1, z1 + alto]], colores[0]); }
            for (var j = 0; j < n2; j++) { var wy = y + paso2 * j + (paso2 - an2) / 2; v += poli([[x + w + .1, wy, z1], [x + w + .1, wy + an2, z1], [x + w + .1, wy + an2, z1 + alto], [x + w + .1, wy, z1 + alto]], colores[1]); }
            return v;
        };
        // Arbol de copa redonda (sirve para cualquier ciudad); se mece desde la base del tronco
        var arbol = function (x, y, k) {
            k = k || 1;
            var b = iso(x, y, 0), h = 13 * k, r = 9.5 * k, cy = b[1] - h - r * .55;
            return '<ellipse cx="' + f1(b[0]) + '" cy="' + f1(b[1]) + '" rx="' + f1(9 * k) + '" ry="' + f1(4.5 * k) + '" fill="#0B2440" fill-opacity=".16"/>' +
                '<g class="e-mece" style="animation-delay:-' + (((x * 13 + y * 7) % 40) / 10).toFixed(1) + 's">' +
                '<line x1="' + f1(b[0]) + '" y1="' + f1(b[1]) + '" x2="' + f1(b[0]) + '" y2="' + f1(b[1] - h) + '" stroke="#8A6A45" stroke-width="' + f1(3 * k) + '" stroke-linecap="round"/>' +
                '<circle cx="' + f1(b[0]) + '" cy="' + f1(cy) + '" r="' + f1(r) + '" fill="#2A9D84"/>' +
                '<circle cx="' + f1(b[0] + r * .25) + '" cy="' + f1(cy + r * .22) + '" r="' + f1(r * .72) + '" fill="#23866F"/>' +
                '<circle cx="' + f1(b[0] - r * .3) + '" cy="' + f1(cy - r * .3) + '" r="' + f1(r * .45) + '" fill="#57C4A6"/></g>';
        };
        // Manzana: el suelo de la escena, con acera y calle al frente
        var manzana = function (w, d, acera, calle) {
            var s = caja(0, 0, -14, w, d, 14, C.suelo);
            if (acera) s += poli([[0, acera[0], .1], [w, acera[0], .1], [w, acera[1], .1], [0, acera[1], .1]], C.acera);
            if (calle !== null && calle !== undefined) {
                s += poli([[0, calle, .2], [w, calle, .2], [w, d, .2], [0, d, .2]], C.calle);
                var ym = calle + (d - calle) / 2;
                for (var x = 6; x + 12 < w; x += 24) s += poli([[x, ym - .9, .3], [x + 12, ym - .9, .3], [x + 12, ym + .9, .3], [x, ym + .9, .3]], 'rgba(255,255,255,.55)');
            }
            return s;
        };
        var auto = function (x, y, c) {
            return caja(x + 1.5, y + .8, 0, 13, 6.4, 1.6, C.navy) + caja(x, y, 1.6, 16, 8, 4.6, c) + caja(x + 4, y + 1, 6.2, 8, 6, 3.6, C.vidrioAuto);
        };
        return { iso: iso, poli: poli, caja: caja, techo: techo, ventanas: ventanas, arbol: arbol, manzana: manzana, auto: auto };
    }

    // Piezas planas (en la pantalla, no en el suelo)
    function pastilla(cx, cy, texto, o) {
        o = o || {};
        var tam = o.tam || 13, ancho = Math.round(texto.length * tam * .56 + 26), alto = o.alto || 24;
        var x = cx - ancho / 2, y = cy - alto / 2;
        return '<rect x="' + x + '" y="' + y + '" width="' + ancho + '" height="' + alto + '" rx="' + (alto / 2) + '" fill="' + (o.fondo || '#FFFFFF') + '"/>' +
            '<text class="e-letra" x="' + cx + '" y="' + f1(cy + tam * .36) + '" text-anchor="middle" font-size="' + tam + '" fill="' + (o.color || C.navyTexto) + '">' + texto + '</text>';
    }
    // Texto de abajo que cuenta lo que pasa; cambia con un fundido
    function leyenda(texto, t, hasta, color) {
        return '<text class="e-letra e-leyenda" x="240" y="344" text-anchor="middle" font-size="14" fill="' + (color || '#EEF3FA') + '" data-t="' + t + '"' + (hasta ? ' data-hasta="' + hasta + '"' : '') + '>' + texto + '</text>';
    }
    // Algo que pasa de lado a lado sin parar (autos); aparece y se desvanece en los bordes
    function transita(contenido, largo, seg, retraso) {
        return '<g class="e-transita" style="--dx:' + f1(largo * .866) + 'px;--dy:' + f1(largo * .5) + 'px;animation-duration:' + seg + 's;animation-delay:-' + retraso + 's">' + contenido + '</g>';
    }
    // Particulas turquesa que suben despacio detras de la escena (dan profundidad)
    function motas(n, semilla) {
        var r = semilla, s = '';
        var azar = function () { r = (r * 9301 + 49297) % 233280; return r / 233280; };
        for (var i = 0; i < n; i++) {
            var dur = 7 + azar() * 6;
            s += '<circle class="e-mota" cx="' + Math.round(30 + azar() * 420) + '" cy="' + Math.round(150 + azar() * 160) + '" r="' + (1 + azar() * 1.3).toFixed(1) + '" fill="#5FD0DC" style="animation-duration:' + dur.toFixed(1) + 's;animation-delay:-' + (azar() * dur).toFixed(1) + 's"/>';
        }
        return s;
    }
    // Chispas que salen disparadas de un punto (la "chispa del match")
    function chispas(t, cx, cy, radio, n) {
        var s = '';
        for (var q = 0; q < n; q++) {
            var a = q * 2 * Math.PI / n + .3, d = 26 + (q % 3) * 10;
            s += '<circle class="e-chispa" data-t="' + t + '" data-dur="' + (620 + (q % 3) * 110) + '" data-dx="' + f1(Math.cos(a) * d) + '" data-dy="' + f1(Math.sin(a) * d) +
                 '" cx="' + f1(cx + Math.cos(a) * radio) + '" cy="' + f1(cy + Math.sin(a) * radio) + '" r="' + (q % 2 ? 2.2 : 3) + '" fill="' + (q % 2 ? '#5FD0DC' : '#FFA05C') + '"/>';
        }
        return s;
    }
    // Onda que se expande: marca un momento importante (llego, encaja, listo)
    function onda(t, cx, cy, r, color) {
        return '<circle class="e-onda" data-t="' + t + '" cx="' + f1(cx) + '" cy="' + f1(cy) + '" r="' + r + '" fill="none" stroke="' + (color || '#FFA05C') + '" stroke-width="2.5"/>';
    }

    /* ================= Escenas ================= */
    var CONSTRUCTORES = {};

    /* ---- Tarjeta del inicio: las habilidades viajan de tu casa a la vacante ----
       Cada habilidad sale como un cubo, salta por el camino y enciende un piso del hotel.
       La quinta (Ingles) se queda a mitad de camino y el resultado es 80 %. */
    CONSTRUCTORES.tarjeta = {
        ciclo: 11000,
        dibujar: function () {
            var I = Iso(222, 112), s = '';
            // Sin marco: la manzana es una isla que flota sobre la portada. La luz de atras, la sombra de
            // abajo y el vaiven van en CSS sobre la caja de la escena (app.css), no dentro del dibujo: todo
            // lo que se mueve DENTRO de un SVG obliga al navegador a repintarlo entero en cada cuadro
            s += '<g class="e-isla">';
            s += motas(5, 3);
            s += I.manzana(200, 160, [114, 128], 128);
            s += I.arbol(16, 120, .85) + I.arbol(194, 4, .9);
            s += transita(I.auto(2, 132, C.cian), 176, 13, 2) + transita(I.auto(182, 148, C.naranja), -176, 10, 6);
            s += '<g class="e-capa">';
            // Camino de la casa al hotel
            var c1 = I.iso(66, 82, .4), c2 = I.iso(150, 82, .4);
            s += '<g data-t="800">' + I.poli([[60, 76, .3], [160, 76, .3], [160, 88, .3], [60, 88, .3]], '#C9D8E4') + I.poli([[148, 58, .3], [160, 58, .3], [160, 76, .3], [148, 76, .3]], '#C9D8E4') +
                 '<line x1="' + f1(c1[0]) + '" y1="' + f1(c1[1]) + '" x2="' + f1(c2[0]) + '" y2="' + f1(c2[1]) + '" stroke="#FFFFFF" stroke-width="1.6" stroke-dasharray="5 6"/></g>';
            // Tu casa y el hotel de la vacante brotan del suelo
            s += '<g class="e-brota" data-t="250">' + I.caja(18, 60, 0, 42, 40, 38, C.pared) + I.techo(18, 60, 38, 42, 40, 22, '#2BB6C6', '#1B8F9C') +
                 I.poli([[34, 100.1, 0], [44, 100.1, 0], [44, 100.1, 18], [34, 100.1, 18]], '#0B2440') +
                 I.poli([[60.1, 70, 16], [60.1, 82, 16], [60.1, 82, 28], [60.1, 70, 28]], '#5FD0DC') + '</g>';
            var hotel = I.caja(128, 12, 0, 52, 48, 128, C.hotel) + I.poli([[146, 60.1, 0], [162, 60.1, 0], [162, 60.1, 16], [146, 60.1, 16]], '#0B2440');
            for (var k = 0; k < 5; k++) hotel += I.ventanas(128, 12, 52, 48, 24 + k * 20, 11, C.ventana, 4, 3);
            s += '<g class="e-brota" data-t="420" data-dur="1100">' + hotel + '</g>';
            s += '<g class="e-crece" data-t="900">' + pastilla(186, 92, 'Tu perfil') + '</g>';
            s += '<g class="e-crece" data-t="1150">' + pastilla(318, 34, 'Recepcionista bilingüe') + '</g>';
            // Cuatro habilidades: cada cubo salta en dos tramos, enciende su piso y deja una onda al llegar
            for (var c = 0; c < 4; c++) {
                var t0 = 1300 + c * 950;
                s += '<g data-t="' + t0 + '" data-dur="300" data-hasta="' + (t0 + 900) + '"><g class="e-viaja" data-t="' + (t0 + 120) + '" data-dur="420" data-dx="64.1" data-dy="37" data-salto="7">' +
                     '<g class="e-viaja" data-t="' + (t0 + 540) + '" data-dur="360" data-dx="20.8" data-dy="-12" data-salto="5">' + I.caja(68, 77, 0, 10, 10, 10, C.cian) + '</g></g></g>';
                s += '<g data-t="' + (t0 + 860) + '" data-dur="500">' + I.ventanas(128, 12, 52, 48, 24 + c * 20, 11, C.ventanaLuz, 4, 3) + '</g>';
                s += onda(t0 + 860, 299, 206, 8, '#5FD0DC');
            }
            // Ingles: sale, pero se queda a mitad de camino
            s += '<g data-t="5200" data-dur="400"><g class="e-viaja" data-t="5320" data-dur="560" data-dx="32" data-dy="18.5" data-salto="6">' + I.caja(68, 77, 0, 10, 10, 10, C.naranja) + '</g></g>';
            s += '<g class="e-crece" data-t="5900"><path d="M240 226l6-8 6 8z" fill="#FF7618"/>' + pastilla(246, 239, 'Te falta Inglés', { fondo: '#FF7618', color: '#FFFFFF', alto: 26 }) + '</g>';
            // Resultado: el porcentaje cuenta hasta 80; lo rodea un aro punteado y al llegar saltan chispas
            s += '<g class="e-crece" data-t="6100"><g class="e-flota"><circle cx="420" cy="96" r="39" fill="none" stroke="#FFA05C" stroke-opacity=".6" stroke-width="1.5" stroke-dasharray="3 8" stroke-linecap="round"/>' +
                 '<circle cx="420" cy="96" r="31" fill="#061A31" stroke="#FF7618" stroke-width="4"/>' +
                 '<text class="e-letra-titulo" x="420" y="102" text-anchor="middle" font-size="18" fill="#FFFFFF" data-contar data-valor="80" data-desde="6150" data-fin="7000">0 %</text></g></g>';
            s += onda(6250, 420, 96, 31) + chispas(6950, 420, 96, 33, 8);
            s += '</g></g>';
            // Las frases de abajo no flotan con la isla: quedan quietas para leerse
            s += '<g class="e-capa">' + leyenda('Tus habilidades viajan hacia la vacante', 1300, 5200) + leyenda('Inglés todavía no está en tu perfil', 5200, 6400, '#FFA05C') +
                 '<text class="e-letra e-leyenda" x="240" y="344" text-anchor="middle" font-size="14" fill="#EEF3FA" data-t="6400">Coincides en 4 de 5. Te falta <tspan fill="#FFA05C">Inglés</tspan>.</text></g>';
            return s;
        }
    };

    /* ================= Motor: una linea de tiempo por escena =================
       Cada pieza con data-t entra en ese milisegundo con el efecto de su clase
       (e-sube, e-crece, e-viaja...); data-hasta la hace salir; data-dur cambia lo que tarda.
       Al final del ciclo la capa (e-capa) se apaga despacio y la historia vuelve a empezar. */
    function efViaje(d) {
        var dx = +(d.dx || 0), dy = +(d.dy || 0), salto = +(d.salto || 0);
        var tf = function (x, y) { return 'translate(' + x.toFixed(2) + 'px, ' + y.toFixed(2) + 'px)'; };
        if (!salto) return { dur: 520, k: [{ o: 0, op: 1, tf: tf(0, 0), e: CURVA.viaje }, { o: 1, op: 1, tf: tf(dx, dy) }] };
        // Trayecto con salto: se muestrea en 18 puntos, con aceleracion y frenado
        var k = [], N = 18;
        for (var i = 0; i <= N; i++) {
            var u = i / N, s = u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
            k.push({ o: u, op: 1, tf: tf(dx * s, dy * s - salto * Math.sin(Math.PI * s)) });
        }
        return { dur: 520, k: k };
    }
    function efectoDe(p) {
        var c = p.classList, d = p.dataset, op = d.op !== undefined ? +d.op : 1;
        if (c.contains('e-viaja')) return efViaje(d);
        // Brota del suelo: crece hacia arriba desde su base y se asienta con un rebote pequeno
        if (c.contains('e-brota')) return { dur: 900, k: [{ o: 0, op: 0, tf: 'scale(1, 0)', e: CURVA.salida }, { o: .12, op: op }, { o: .7, op: op, tf: 'scale(1, 1.04)', e: CURVA.viaje }, { o: 1, op: op, tf: 'scale(1, 1)' }], sale: 'scale(1, 1)' };
        // Chispa: sale disparada hacia (dx, dy), se achica y se apaga
        if (c.contains('e-chispa')) return { dur: 700, k: [{ o: 0, op: 0, tf: 'translate(0px, 0px) scale(1)', e: CURVA.salida }, { o: .08, op: 1 }, { o: 1, op: 0, tf: 'translate(' + (+d.dx || 0).toFixed(1) + 'px, ' + (+d.dy || 0).toFixed(1) + 'px) scale(0.3)' }] };
        if (c.contains('e-sube')) return { dur: 950, k: [{ o: 0, op: 0, tf: 'translate(0px, 18px)', e: CURVA.salida }, { o: 1, op: op, tf: 'translate(0px, 0px)' }], sale: 'translate(0px, -6px)' };
        if (c.contains('e-leyenda')) return { dur: 820, k: [{ o: 0, op: 0, tf: 'translate(0px, 9px)' }, { o: .22, op: 0, tf: 'translate(0px, 9px)', e: CURVA.salida }, { o: 1, op: op, tf: 'translate(0px, 0px)' }], sale: 'translate(0px, -9px)', durSale: 360 };
        if (c.contains('e-crece')) return { dur: 850, k: [{ o: 0, op: 0, tf: 'scale(0.5)', e: CURVA.salida }, { o: .6, op: op, tf: 'scale(1.05)', e: CURVA.viaje }, { o: 1, op: op, tf: 'scale(1)' }], sale: 'scale(0.9)' };
        if (c.contains('e-onda')) return { dur: 1300, k: [{ o: 0, op: 0, tf: 'scale(0.4)', e: CURVA.salida }, { o: .1, op: .9 }, { o: 1, op: 0, tf: 'scale(2)' }] };
        // Por defecto: un fundido, sin tocar la posicion
        return { dur: 700, k: [{ o: 0, op: 0, e: CURVA.suave }, { o: 1, op: op }] };
    }
    // Las animaciones de una pieza. La de entrada espera su momento (delay), dura lo suyo y se queda
    // en su ultimo cuadro; si la pieza sale (data-hasta), otra animacion la apaga a esa hora.
    // Antes cada pieza tenia UNA animacion del largo de todo el ciclo: las 60 "corrian" siempre y el
    // navegador recalculaba las 60 en cada cuadro, aunque solo 2 o 3 se estuvieran moviendo.
    function animacionesDe(p) {
        var ef = efectoDe(p), d = p.dataset, t = +d.t, dur = d.dur ? +d.dur : ef.dur, hasta = d.hasta !== undefined ? +d.hasta : null;
        var k = ef.k, z = k[k.length - 1], lista = [];
        var entrada = k.map(function (q) {
            var c = { offset: q.o };
            if (q.op !== undefined) c.opacity = q.op;
            if (q.tf !== undefined) c.transform = q.tf;
            if (q.e) c.easing = q.e;
            return c;
        });
        lista.push(p.animate(entrada, { delay: t, duration: dur, fill: 'both' }));
        if (hasta !== null) {
            var desde = { opacity: z.op, easing: CURVA.suave }, fuera = { opacity: 0 };
            var tfFuera = ef.sale !== undefined ? ef.sale : z.tf;
            if (z.tf !== undefined) desde.transform = z.tf;
            if (tfFuera !== undefined) fuera.transform = tfFuera;
            lista.push(p.animate([desde, fuera], { delay: Math.max(hasta, t + dur), duration: ef.durSale || 420, fill: 'forwards' }));
        }
        return lista;
    }
    // Al final del ciclo la capa entera se apaga despacio, y la historia vuelve a empezar
    function animacionCapa(c, L) {
        return c.animate([{ opacity: 1, easing: CURVA.suave }, { opacity: 0 }], { delay: L - 900, duration: 640, fill: 'forwards' });
    }

    var escenas = [];

    function Escena(el, receta) {
        var self = this;
        var L = this.L = +el.dataset.ciclo || receta.ciclo;
        this.el = el; this.final = L - 1000;
        this.visible = false; this.congelada = false; this.corriendo = false;
        el.querySelector('.escena-raiz').innerHTML = receta.dibujar();
        this.anims = [];
        Array.prototype.forEach.call(el.querySelectorAll('[data-t]'), function (p) { self.anims = self.anims.concat(animacionesDe(p)); });
        Array.prototype.forEach.call(el.querySelectorAll('.e-capa'), function (c) { self.anims.push(animacionCapa(c, L)); });
        // Reloj sin dibujo: marca el tiempo de la escena (para los porcentajes que cuentan y para saber
        // cuando termino el ciclo y hay que volver a empezar)
        this.reloj = new Animation(new KeyframeEffect(null, [], { duration: L, fill: 'forwards' }), document.timeline);
        this.anims.push(this.reloj);
        this.contadores = Array.prototype.map.call(el.querySelectorAll('[data-contar]'), function (c) {
            return { el: c, v: +c.dataset.valor, a: +c.dataset.desde, b: +c.dataset.fin };
        });
        inclinable(el);
        this.ir(reducido ? this.final : 0);
    }
    Escena.prototype.tiempo = function () {
        var t = this.reloj.currentTime;
        return t === null ? 0 : Math.min(this.L, Math.max(0, +t));
    };
    // Termino el ciclo: todas las piezas vuelven a cero y la historia arranca otra vez
    Escena.prototype.reiniciar = function () {
        this.ir(0);
        this.reproducir();
    };
    // Salta a un momento exacto y deja todo quieto ahi
    Escena.prototype.ir = function (ms) {
        this.anims.forEach(function (a) { a.pause(); a.currentTime = ms; });
        this.contar(ms);
    };
    // Sigue desde donde esta: todas las piezas arrancan con el mismo reloj
    Escena.prototype.reproducir = function () {
        var inicio = document.timeline.currentTime - this.tiempo();
        this.anims.forEach(function (a) { a.startTime = inicio; });
        programarBucle();
    };
    // Decide si la escena debe moverse: visible, pestana activa y sin "reducir movimiento"
    Escena.prototype.actualizar = function () {
        var debe = !reducido && !this.congelada && this.visible && document.visibilityState !== 'hidden';
        if (debe !== this.corriendo) { this.corriendo = debe; if (debe) this.reproducir(); else this.ir(this.tiempo()); }
        this.el.classList.toggle('escena-quieta', !debe);
    };
    Escena.prototype.contar = function (ms) {
        this.contadores.forEach(function (c) {
            var u = Math.min(1, Math.max(0, (ms - c.a) / (c.b - c.a)));
            var txt = Math.round(c.v * (1 - Math.pow(1 - u, 3))) + ' %';
            if (c.el.textContent !== txt) c.el.textContent = txt;
        });
    };

    // Inclinacion 3D con el mouse: hasta 5 grados arriba/abajo y 7 a los lados, solo mientras el cursor
    // esta encima de la escena
    function inclinable(esc) {
        var zona = esc;
        var meta = { x: 0, y: 0 }, ahora = { x: 0, y: 0 }, vivo = false;
        var paso = function () {
            ahora.x += (meta.x - ahora.x) * .08; ahora.y += (meta.y - ahora.y) * .08;
            esc.style.transform = 'perspective(1100px) rotateX(' + (-ahora.y * 10).toFixed(2) + 'deg) rotateY(' + (ahora.x * 14).toFixed(2) + 'deg)';
            if (Math.abs(meta.x - ahora.x) + Math.abs(meta.y - ahora.y) > .002) requestAnimationFrame(paso);
            else { vivo = false; if (!meta.x && !meta.y) esc.style.transform = ''; }
        };
        var pedir = function () { if (!vivo) { vivo = true; requestAnimationFrame(paso); } };
        zona.addEventListener('pointermove', function (ev) {
            if (!conMouse.matches || reducido || ev.pointerType !== 'mouse') return;
            var r = zona.getBoundingClientRect();
            meta.x = (ev.clientX - r.left) / r.width - .5; meta.y = (ev.clientY - r.top) / r.height - .5;
            pedir();
        });
        zona.addEventListener('pointerleave', function () { meta.x = 0; meta.y = 0; pedir(); });
    }

    // Mientras alguna escena corre: los porcentajes cuentan cuadro a cuadro y, al acabar el ciclo, se reinicia
    var bucleActivo = false;
    function programarBucle() {
        if (bucleActivo) return;
        bucleActivo = true;
        requestAnimationFrame(function bucle() {
            var alguna = false;
            escenas.forEach(function (e) {
                if (!e.corriendo) return;
                alguna = true;
                if (e.tiempo() >= e.L) e.reiniciar(); else e.contar(e.tiempo());
            });
            if (alguna) requestAnimationFrame(bucle); else bucleActivo = false;
        });
    }

    /* ---- Arranque: cada <div class="escenario" data-escena="..."> de la pagina ---- */
    Array.prototype.forEach.call(document.querySelectorAll('.escenario[data-escena]'), function (el) {
        var receta = CONSTRUCTORES[el.dataset.escena];
        if (receta && el.querySelector('.escena-raiz')) escenas.push(new Escena(el, receta));
    });
    if (!escenas.length) return;

    // Solo se mueve la escena que esta a la vista
    if ('IntersectionObserver' in window) {
        var obs = new IntersectionObserver(function (entradas) {
            entradas.forEach(function (en) {
                escenas.forEach(function (e) { if (e.el === en.target) { e.visible = en.isIntersecting; e.actualizar(); } });
            });
        }, { threshold: .2 });
        escenas.forEach(function (e) { obs.observe(e.el); });
    } else {
        escenas.forEach(function (e) { e.visible = true; e.actualizar(); });
    }
    document.addEventListener('visibilitychange', function () { escenas.forEach(function (e) { e.actualizar(); }); });

    // "Reducir movimiento" puede cambiar con la pagina abierta: las escenas se adaptan al momento
    var alCambiar = function () {
        reducido = rm.matches;
        escenas.forEach(function (e) { e.corriendo = false; e.ir(reducido ? e.final : 0); e.actualizar(); });
    };
    if (rm.addEventListener) rm.addEventListener('change', alCambiar); else if (rm.addListener) rm.addListener(alCambiar);

    // Para las pruebas automaticas: buscar una escena o dejarla quieta en un momento exacto
    window.SkillMatchEscenas = {
        de: function (el) { return escenas.filter(function (e) { return e.el === el; })[0] || null; },
        verCuadro: function (el, ms) { var e = this.de(el); if (!e) return; e.congelada = true; e.actualizar(); e.ir(ms); }
    };
})();
