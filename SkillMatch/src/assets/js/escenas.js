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
 *  - Ya no se inclina con el mouse (2026-11-12): nada de efectos que sigan al cursor.
 *  - Una receta puede traer "halo": la luz de detras de la escena (una caja HTML,
 *    ::before) sube o baja con la historia, con el mismo reloj.
 *
 * Para agregar otra escena: una receta nueva en CONSTRUCTORES (ciclo y dibujar)
 * y en el HTML <div class="escenario" data-escena="..."><svg viewBox="0 0 480 360"
 * role="img" aria-label="..."><g class="escena-raiz"></g></svg></div>.
 * =============================================================== */
(function () {
    'use strict';

    var rm = window.matchMedia('(prefers-reduced-motion: reduce)');
    var reducido = rm.matches;
    if (!('animate' in Element.prototype) || typeof KeyframeEffect === 'undefined') return;

    /* Curvas de aceleracion compartidas: todo el movimiento sale de esta lista */
    var CURVA = {
        salida: 'cubic-bezier(.22, 1, .36, 1)',     // arranca rapido y llega despacio
        viaje: 'cubic-bezier(.65, 0, .35, 1)',      // acelera y frena: para trayectos
        suave: 'cubic-bezier(.4, 0, .2, 1)'
    };

    /* ================= Piezas isometricas (las mismas para todas las escenas) ================= */
    // Colores de cada cara (arriba, izquierda, derecha). Es una ciudad DE NOCHE con los azules de la
    // portada: antes era blanca, de dia, y sobre el azul noche se veia como una foto recortada y pegada.
    // Ahora la luz la ponen las ventanas y las habilidades (turquesa) y la chispa del match (naranja)
    var C = {
        suelo: { arriba: '#173A5C', izq: '#0F2C48', der: '#0B2138' },
        pared: { arriba: '#3A6288', izq: '#2C5378', der: '#21446A' },
        hotel: { arriba: '#355D84', izq: '#2A5176', der: '#1F4266' },
        cian: { arriba: '#7FE3EC', izq: '#2BB6C6', der: '#1B8F9C' },
        naranja: { arriba: '#FFA05C', izq: '#FF7618', der: '#D45F10' },
        navy: { arriba: '#1A3A5E', izq: '#12365E', der: '#0B2440' },
        vidrioAuto: { arriba: '#CFEFF5', izq: '#9DD6E2', der: '#78BCCB' },
        ventana: ['#1B3B5C', '#16324F'],          // apagadas
        ventanaLuz: ['#7FE3EC', '#45C3D1'],       // encendidas por una habilidad
        acera: '#22496E', calle: '#0B1E33', navyTexto: '#08203C',
        borde: '#5FD0DC'                          // filo de luz de la isla (como el de la barra)
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
        // Ventanas de un piso en las dos caras de adelante de un edificio. Devuelve una lista (una por
        // ventana, de izquierda a derecha) para poder encenderlas una por una; unidas, es el piso entero
        var ventanasLista = function (x, y, w, d, z1, alto, colores, n1, n2) {
            var v = [], paso1 = w / n1, paso2 = d / n2, an = Math.min(7, paso1 * .55), an2 = Math.min(7, paso2 * .55);
            for (var i = 0; i < n1; i++) { var wx = x + paso1 * i + (paso1 - an) / 2; v.push(poli([[wx, y + d + .1, z1], [wx + an, y + d + .1, z1], [wx + an, y + d + .1, z1 + alto], [wx, y + d + .1, z1 + alto]], colores[0])); }
            for (var j = n2 - 1; j >= 0; j--) { var wy = y + paso2 * j + (paso2 - an2) / 2; v.push(poli([[x + w + .1, wy, z1], [x + w + .1, wy + an2, z1], [x + w + .1, wy + an2, z1 + alto], [x + w + .1, wy, z1 + alto]], colores[1])); }
            return v;
        };
        var ventanas = function (x, y, w, d, z1, alto, colores, n1, n2) { return ventanasLista(x, y, w, d, z1, alto, colores, n1, n2).join(''); };
        // Arbol de copa redonda (sirve para cualquier ciudad). Quieto: mecerse sin parar obligaba al
        // navegador a redibujar la escena entera en cada cuadro, aunque no pasara nada mas
        var arbol = function (x, y, k) {
            k = k || 1;
            var b = iso(x, y, 0), h = 13 * k, r = 9.5 * k, cy = b[1] - h - r * .55;
            return '<ellipse cx="' + f1(b[0]) + '" cy="' + f1(b[1]) + '" rx="' + f1(9 * k) + '" ry="' + f1(4.5 * k) + '" fill="#020A16" fill-opacity=".35"/>' +
                '<line x1="' + f1(b[0]) + '" y1="' + f1(b[1]) + '" x2="' + f1(b[0]) + '" y2="' + f1(b[1] - h) + '" stroke="#4A3A2A" stroke-width="' + f1(3 * k) + '" stroke-linecap="round"/>' +
                '<circle cx="' + f1(b[0]) + '" cy="' + f1(cy) + '" r="' + f1(r) + '" fill="#1E7466"/>' +
                '<circle cx="' + f1(b[0] + r * .25) + '" cy="' + f1(cy + r * .22) + '" r="' + f1(r * .72) + '" fill="#185F54"/>' +
                '<circle cx="' + f1(b[0] - r * .3) + '" cy="' + f1(cy - r * .3) + '" r="' + f1(r * .45) + '" fill="#2E9A86"/>';
        };
        // Manzana: el suelo de la escena, con acera y calle al frente
        var manzana = function (w, d, acera, calle) {
            var s = caja(0, 0, -14, w, d, 14, C.suelo);
            if (acera) s += poli([[0, acera[0], .1], [w, acera[0], .1], [w, acera[1], .1], [0, acera[1], .1]], C.acera);
            if (calle !== null && calle !== undefined) {
                s += poli([[0, calle, .2], [w, calle, .2], [w, d, .2], [0, d, .2]], C.calle);
                var ym = calle + (d - calle) / 2;
                for (var x = 6; x + 12 < w; x += 24) s += poli([[x, ym - .9, .3], [x + 12, ym - .9, .3], [x + 12, ym + .9, .3], [x, ym + .9, .3]], 'rgba(95,208,220,.4)');
            }
            // Filo de luz en los dos bordes de adelante, como el de la barra: separa la isla del fondo
            // sin recuadro, y la integra a la portada
            s += '<polyline points="' + P([[0, d, 0], [w, d, 0], [w, 0, 0]]) + '" fill="none" stroke="' + C.borde + '" stroke-opacity=".55" stroke-width="1.2" stroke-linejoin="round"/>';
            s += '<polyline points="' + P([[0, d, 0], [0, 0, 0], [w, 0, 0]]) + '" fill="none" stroke="' + C.borde + '" stroke-opacity=".14" stroke-width="1"/>';
            return s;
        };
        var auto = function (x, y, c) {
            return caja(x + 1.5, y + .8, 0, 13, 6.4, 1.6, C.navy) + caja(x, y, 1.6, 16, 8, 4.6, c) + caja(x + 4, y + 1, 6.2, 8, 6, 3.6, C.vidrioAuto);
        };
        return { iso: iso, poli: poli, caja: caja, techo: techo, ventanas: ventanas, ventanasLista: ventanasLista, arbol: arbol, manzana: manzana, auto: auto };
    }

    // Piezas planas (en la pantalla, no en el suelo).
    // o.vidrio: cristal oscuro con filo de luz, como la barra (antes eran calcomanias blancas)
    // o.punto: un punto de color antes del texto
    function pastilla(cx, cy, texto, o) {
        o = o || {};
        var tam = o.tam || 13, punto = o.punto ? 13 : 0, alto = o.alto || 24;
        var ancho = Math.round(texto.length * tam * .56 + 26 + punto);
        var x = cx - ancho / 2, y = cy - alto / 2;
        var caja = o.vidrio
            ? '<rect x="' + f1(x + .5) + '" y="' + f1(y + .5) + '" width="' + (ancho - 1) + '" height="' + (alto - 1) + '" rx="' + ((alto - 1) / 2) + '" fill="#0C2440" fill-opacity=".82" stroke="#FFFFFF" stroke-opacity=".24"/>'
            : '<rect x="' + x + '" y="' + y + '" width="' + ancho + '" height="' + alto + '" rx="' + (alto / 2) + '" fill="' + (o.fondo || '#FFFFFF') + '"/>';
        var marca = punto ? '<circle cx="' + f1(x + 14) + '" cy="' + f1(cy) + '" r="3.5" fill="' + o.punto + '"/>' : '';
        return caja + marca +
            '<text class="e-letra" x="' + f1(cx + punto / 2) + '" y="' + f1(cy + tam * .36) + '" text-anchor="middle" font-size="' + tam + '" fill="' + (o.color || (o.vidrio ? '#EEF3FA' : C.navyTexto)) + '">' + texto + '</text>';
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

    /* ---- Tarjeta del inicio: "la ciudad se enciende" ----
       De noche, tu casa se enciende (tu perfil). Cada habilidad viaja como un cubo de luz con estela y,
       al llegar, enciende un piso del edificio de la vacante ventana por ventana; la luz del suelo y el
       halo de detras crecen con cada una. Ingles se queda a mitad de camino: intenta saltar dos veces y
       no puede, y el ultimo piso queda marcado en naranja (lo que falta). Al final, cuatro luces salen
       de los pisos encendidos y forman el 80 %.
       Linea de tiempo (ms): casa 250-700 · habilidades 1400-5000 · Ingles 5300-6400 · resultado 6900-8300 */
    var T_HAB = [1400, 2350, 3300, 4250];        // salida de cada habilidad (llega 860 ms despues)
    CONSTRUCTORES.tarjeta = {
        ciclo: 12500,
        // El halo de luz detras de la isla (app.css, .hero .escenario::before) crece con cada coincidencia
        halo: [[0, .35]].concat(T_HAB.map(function (t, c) { return [t + 860, .35 + (c + 1) * .14]; }), [[7450, 1], [11600, 1], [12240, .35], [12500, .35]]),
        dibujar: function () {
            var I = Iso(222, 112), s = '';
            s += '<defs><radialGradient id="e-luz-tarjeta"><stop offset="0" stop-color="#5FD0DC" stop-opacity=".6"/><stop offset="1" stop-color="#5FD0DC" stop-opacity="0"/></radialGradient></defs>';
            // Sin marco: la manzana es una isla que flota sobre la portada. La luz de atras, la sombra de
            // abajo y el vaiven van en CSS sobre la caja de la escena (app.css), no dentro del dibujo: todo
            // lo que se mueve DENTRO de un SVG obliga al navegador a repintarlo entero en cada cuadro
            s += '<g class="e-isla">';
            s += I.manzana(200, 160, [114, 128], 128);
            s += I.arbol(16, 120, .85) + I.arbol(194, 4, .9);
            s += transita(I.auto(2, 132, C.cian), 176, 13, 2) + transita(I.auto(182, 148, C.naranja), -176, 10, 6);
            s += '<g class="e-capa">';
            // La luz que cae al suelo frente al edificio: una capa por habilidad, se suman
            var base = I.iso(154, 64, 0);
            T_HAB.forEach(function (t) {
                s += '<ellipse cx="' + f1(base[0]) + '" cy="' + f1(base[1]) + '" rx="74" ry="32" fill="url(#e-luz-tarjeta)" data-t="' + (t + 860) + '" data-dur="700" data-op=".45"/>';
            });
            // Camino de la casa al edificio
            var c1 = I.iso(66, 82, .4), c2 = I.iso(150, 82, .4);
            s += '<g data-t="800">' + I.poli([[60, 76, .3], [160, 76, .3], [160, 88, .3], [60, 88, .3]], '#1E4568') + I.poli([[148, 58, .3], [160, 58, .3], [160, 76, .3], [148, 76, .3]], '#1E4568') +
                 '<line x1="' + f1(c1[0]) + '" y1="' + f1(c1[1]) + '" x2="' + f1(c2[0]) + '" y2="' + f1(c2[1]) + '" stroke="#5FD0DC" stroke-opacity=".5" stroke-width="1.4" stroke-dasharray="4 6"/></g>';
            // Tu casa brota del suelo, apagada...
            var ventanaCasa = [[60.1, 70, 16], [60.1, 82, 16], [60.1, 82, 28], [60.1, 70, 28]];
            s += '<g class="e-brota" data-t="250">' + I.caja(18, 60, 0, 42, 40, 38, C.pared) + I.techo(18, 60, 38, 42, 40, 22, '#2BB6C6', '#1B8F9C') +
                 I.poli([[34, 100.1, 0], [44, 100.1, 0], [44, 100.1, 18], [34, 100.1, 18]], '#081A2E') + I.poli(ventanaCasa, C.ventana[1]) + '</g>';
            // ...y se enciende: tu perfil despierta
            var vc = I.iso(60.1, 76, 22);
            s += '<g data-t="900" data-dur="500"><circle cx="' + f1(vc[0]) + '" cy="' + f1(vc[1]) + '" r="16" fill="url(#e-luz-tarjeta)"/>' + I.poli(ventanaCasa, C.ventanaLuz[0]) +
                 I.poli([[34, 100.2, 0], [44, 100.2, 0], [44, 100.2, 3], [34, 100.2, 3]], '#7FE3EC') + '</g>';
            // El edificio de la vacante brota apagado (las ventanas en azul noche)
            var hotel = I.caja(128, 12, 0, 52, 48, 128, C.hotel) + I.poli([[146, 60.1, 0], [162, 60.1, 0], [162, 60.1, 16], [146, 60.1, 16]], '#081A2E');
            for (var k = 0; k < 5; k++) hotel += I.ventanas(128, 12, 52, 48, 24 + k * 20, 11, C.ventana, 4, 3);
            s += '<g class="e-brota" data-t="420" data-dur="1100">' + hotel + '</g>';
            s += '<g class="e-crece" data-t="1000">' + pastilla(186, 92, 'Tu perfil', { vidrio: true, punto: '#5FD0DC' }) + '</g>';
            s += '<g class="e-crece" data-t="1200">' + pastilla(318, 34, 'Recepcionista bilingüe', { vidrio: true, punto: '#FFA05C' }) + '</g>';
            // Cuatro habilidades: cada cubo de luz salta en dos tramos, con una estela de dos copias que
            // lo siguen un poco despues y mas tenues; al llegar, su piso se enciende ventana por ventana
            var cubo = function (t, op) {
                return '<g data-t="' + t + '" data-dur="300" data-op="' + op + '" data-hasta="' + (t + 900) + '"><g class="e-viaja" data-t="' + (t + 120) + '" data-dur="420" data-dx="64.1" data-dy="37" data-salto="7">' +
                       '<g class="e-viaja" data-t="' + (t + 540) + '" data-dur="360" data-dx="20.8" data-dy="-12" data-salto="5">' + I.caja(68, 77, 0, 10, 10, 10, C.cian) + '</g></g></g>';
            };
            T_HAB.forEach(function (t0, c) {
                s += cubo(t0 + 140, '.18') + cubo(t0 + 70, '.4') + cubo(t0, '1');
                I.ventanasLista(128, 12, 52, 48, 24 + c * 20, 11, C.ventanaLuz, 4, 3).forEach(function (v, i) {
                    s += '<g data-t="' + (t0 + 860 + i * 45) + '" data-dur="260">' + v + '</g>';
                });
                s += onda(t0 + 860, 299, 206, 8, '#5FD0DC');
            });
            // Ingles: sale, llega a mitad de camino e intenta seguir dos veces, pero no puede
            s += '<g data-t="5300" data-dur="400"><g class="e-viaja" data-t="5420" data-dur="560" data-dx="32" data-dy="18.5" data-salto="6">' +
                 '<g class="e-viaja" data-t="6050" data-dur="300" data-salto="7"><g class="e-viaja" data-t="6420" data-dur="260" data-salto="4">' +
                 I.caja(68, 77, 0, 10, 10, 10, C.naranja) + '</g></g></g></g>';
            // El piso que falta: sus ventanas, marcadas en naranja punteado
            var falta = I.ventanasLista(128, 12, 52, 48, 24 + 4 * 20, 11, ['#FF7618', '#FF7618'], 4, 3).join('')
                .replace(/fill="#FF7618"/g, 'fill="#FF7618" fill-opacity=".22" stroke="#FFA05C" stroke-width="1" stroke-dasharray="2 1.6"');
            s += '<g data-t="6250" data-dur="500">' + falta + '</g>';
            s += '<g class="e-crece" data-t="6450"><path d="M240 226l6-8 6 8z" fill="#FF7618"/>' + pastilla(246, 239, 'Te falta Inglés', { fondo: '#FF7618', color: '#FFFFFF', alto: 26 }) + '</g>';
            // Resultado: una luz sale de cada piso encendido y vuela hasta el circulo, que cuenta hasta 80
            T_HAB.forEach(function (t, c) {
                var x = 347, y = 190.5 - 20 * c, ti = 6900 + c * 90;
                s += '<g data-t="' + ti + '" data-dur="150" data-hasta="' + (ti + 700) + '"><circle class="e-viaja" data-t="' + ti + '" data-dur="620" data-dx="' + f1(420 - x) + '" data-dy="' + f1(96 - y) + '" data-salto="18" cx="' + x + '" cy="' + f1(y) + '" r="3.5" fill="#7FE3EC"/></g>';
            });
            s += '<g class="e-crece" data-t="7400"><circle cx="420" cy="96" r="39" fill="none" stroke="#FFA05C" stroke-opacity=".6" stroke-width="1.5" stroke-dasharray="3 8" stroke-linecap="round"/>' +
                 '<circle cx="420" cy="96" r="31" fill="#061A31" stroke="#FF7618" stroke-width="4"/>' +
                 '<text class="e-letra-titulo" x="420" y="102" text-anchor="middle" font-size="18" fill="#FFFFFF" data-contar data-valor="80" data-desde="7500" data-fin="8300">0 %</text></g>';
            s += onda(7550, 420, 96, 31) + chispas(8300, 420, 96, 33, 8);
            s += '</g></g>';
            // Las frases de abajo no flotan con la isla: quedan quietas para leerse. Una sale del todo
            // antes de que entre la siguiente (antes se cruzaban y se leian encimadas)
            s += '<g class="e-capa">' + leyenda('Tus habilidades viajan hacia la vacante', 1400, 5300) + leyenda('Inglés todavía no está en tu perfil', 5700, 7000, '#FFA05C') +
                 '<text class="e-letra e-leyenda" x="240" y="344" text-anchor="middle" font-size="14" fill="#EEF3FA" data-t="7400">Coincides en 4 de 5. Te falta <tspan fill="#FFA05C">Inglés</tspan>.</text></g>';
            return s;
        }
    };

    /* ---- Elegir cuenta: "El recorrido" (elegido por Luis el 2026-11-13 entre 3 direcciones) ----
       Cada escena cuenta lo que dice su tarjeta y se arma UNA vez (unaVez), luego queda quieta.
       - Persona: tu casa se enciende; tres vacantes brotan mas altas mientras mas encajan (92, 74, 51 %);
         tus habilidades saltan a la mejor, cada una enciende su piso, chispa y "Postulacion enviada".
       - Empresa: el edificio publica "Se busca"; llegan tres personas; una se descarta, otra se acepta.
       Coreografia (skills choreograph y review-animations): el suelo ya esta, un protagonista por escena,
       letreros que solo aparecen y suben 6 px, esperas que se acortan, causa y efecto en el mismo
       instante, ~3 s en total y salidas mas cortas que las entradas. */
    var AZUL = { arriba: '#7FA8FF', izq: '#2F6FE4', der: '#2457B8' };
    var NARANJA_PUNTO = '#FFA05C', CIAN_PUNTO = '#5FD0DC';

    // Un desplazamiento del mundo (x, y, z) llevado a la pantalla
    function pant(dx, dy, dz) { return [(dx - dy) * 0.866, (dx + dy) * 0.5 - (dz || 0)]; }
    function viaje(t, dur, d, salto, contenido) {
        return '<g class="e-viaja" data-t="' + t + '" data-dur="' + dur + '" data-dx="' + f1(d[0]) + '" data-dy="' + f1(d[1]) + '" data-salto="' + (salto || 0) + '">' + contenido + '</g>';
    }
    // Aparece (fundido) en t; si trae "hasta", se va a esa hora
    function aparece(t, dur, contenido, hasta) {
        // review-animations: una salida es mas corta que su entrada (260 ms; la persona ya decidio)
        return '<g data-t="' + t + '" data-dur="' + dur + '"' + (hasta ? ' data-hasta="' + hasta + '" data-salida="260"' : '') + '>' + contenido + '</g>';
    }
    // Los letreros son apoyo, no protagonistas: aparecen y suben 6 px
    function etiqueta(t, contenido) { return '<g class="e-etiqueta" data-t="' + t + '">' + contenido + '</g>'; }
    // La onda acompana el impacto: corta (750 ms), no se queda flotando despues de la chispa
    function ondaCorta(t, cx, cy, r, color) { return onda(t, cx, cy, r, color).replace('class="e-onda"', 'class="e-onda" data-dur="750"'); }
    function brota(t, contenido, dur) { return '<g class="e-brota" data-t="' + t + '"' + (dur ? ' data-dur="' + dur + '"' : '') + '>' + contenido + '</g>'; }
    function persona(I, x, y, c) { return I.caja(x, y, 0, 7, 7, 10, c) + I.caja(x + 1, y + 1, 10.5, 5, 5, 5, c); }

    // Persona. Protagonista: la vacante que mas encaja (la torre de atras).
    CONSTRUCTORES['camino-persona'] = {
        ciclo: 3500, unaVez: true,
        dibujar: function () {
            var I = Iso(190, 92), s = '';
            s += I.manzana(230, 110) + I.arbol(214, 96, .8);
            var ventana = [[48.1, 48, 12], [48.1, 58, 12], [48.1, 58, 22], [48.1, 48, 22]];
            s += brota(0, I.caja(14, 40, 0, 34, 34, 28, C.pared) + I.techo(14, 40, 28, 34, 34, 18, '#2BB6C6', '#1B8F9C') +
                I.poli([[26, 74.1, 0], [36, 74.1, 0], [36, 74.1, 16], [26, 74.1, 16]], '#081A2E') + I.poli(ventana, C.ventana[1]), 700);
            // La ventana se enciende cuando la casa se asienta, y su letrero con ella (un solo golpe)
            s += aparece(450, 300, I.poli(ventana, C.ventanaLuz[0]));
            s += etiqueta(480, pastilla(110, 96, 'Tu perfil', { vidrio: true, punto: CIAN_PUNTO }));
            // Las vacantes brotan como una ola (130 y 90 ms) y cada letrero llega cuando su torre se asienta
            [[104, 76, '92 %', NARANJA_PUNTO, 650], [138, 54, '74 %', CIAN_PUNTO, 780], [172, 34, '51 %', CIAN_PUNTO, 870]].forEach(function (b, i) {
                var x = b[0], h = b[1], edificio = I.caja(x, 8, 0, 22, 22, h, C.hotel);
                for (var z = 12; z + 8 < h - 2; z += 16) edificio += I.ventanas(x, 8, 22, 22, z, 8, C.ventana, 2, 2);
                if (i === 0) edificio += I.poli([[x + 7, 30.1, 0], [x + 15, 30.1, 0], [x + 15, 30.1, 14], [x + 7, 30.1, 14]], '#081A2E');
                s += brota(b[4], edificio, 700);
                var arriba = I.iso(x + 11, 19, h);
                s += etiqueta(b[4] + 480, pastilla(arriba[0] + 46 + i * 2, arriba[1], b[2], { vidrio: true, punto: b[3] }));
            });
            // Causa -> efecto: cada habilidad que aterriza enciende un piso de la torre en ese instante
            var pisos = [12, 28, 44];
            [[1500, C.cian], [1640, C.cian], [1740, C.naranja]].forEach(function (q, i) {
                var llega = q[0] + 100 + 560;
                s += aparece(q[0], 200, viaje(q[0] + 100, 560, pant(56, -24), 20, I.caja(54, 56, 0, 9, 9, 9, q[1])), llega + 60);
                s += aparece(llega, 240, I.ventanas(104, 8, 22, 22, pisos[i], 8, C.ventanaLuz, 2, 2));
            });
            // Con la ultima se enciende la cima y sale la chispa, en el mismo instante
            s += aparece(2420, 240, I.ventanas(104, 8, 22, 22, 60, 8, C.ventanaLuz, 2, 2));
            var puerta = I.iso(114, 30, 7);
            s += ondaCorta(2400, puerta[0], puerta[1], 12) + chispas(2420, puerta[0], puerta[1], 10, 8);
            s += etiqueta(2500, pastilla(150, 252, 'Postulación enviada', { vidrio: true, punto: NARANJA_PUNTO, tam: 12 }));
            return s;
        }
    };

    // Empresa. Protagonista: la persona aceptada (la primera de la fila).
    CONSTRUCTORES['camino-empresa'] = {
        ciclo: 3300, unaVez: true,
        dibujar: function () {
            var I = Iso(200, 96), s = '';
            s += I.manzana(210, 110) + I.arbol(20, 20, .8);
            var edificio = I.caja(120, 10, 0, 52, 44, 96, C.hotel) + I.poli([[138, 54.1, 0], [152, 54.1, 0], [152, 54.1, 18], [138, 54.1, 18]], '#081A2E');
            for (var k = 0; k < 4; k++) edificio += I.ventanas(120, 10, 52, 44, 24 + k * 18, 10, C.ventana, 4, 3);
            s += brota(0, edificio, 800);
            // Publicar: el aviso sale del techo cuando el edificio se asienta
            var techo = I.iso(146, 32, 96);
            s += ondaCorta(560, techo[0], techo[1], 14);
            s += etiqueta(600, pastilla(techo[0], 56, 'Se busca: Recepcionista', { vidrio: true, punto: NARANJA_PUNTO, tam: 12 }));
            // Llegan como una ola: 180 y despues 120 ms entre una y otra
            [[120, C.cian, 1000, 0], [134, C.naranja, 1180, 0], [148, AZUL, 1300, 2100]].forEach(function (p) {
                s += aparece(p[2] - 150, 150, viaje(p[2], 600, pant(p[0] - 6, -30), 10, persona(I, 6, 96, p[1])), p[3] || null);
            });
            // Primero se descarta una (2100) y despues se acepta otra: el orden cuenta "acepta o rechaza"
            var cabeza = I.iso(124, 70, 16);
            s += ondaCorta(2350, cabeza[0], cabeza[1], 12) + chispas(2370, cabeza[0], cabeza[1], 10, 8);
            s += etiqueta(2400, pastilla(178, 214, 'Aceptada', { vidrio: true, punto: CIAN_PUNTO, tam: 12 }));
            return s;
        }
    };

    CONSTRUCTORES['camino-mensajes'] = {
        // Mensajes sin conversacion abierta: tu casa y la de la empresa, unidas por un camino; un mensaje
        // (un sobre de luz) viaja de una a la otra y la otra se enciende. Se arma una vez.
        ciclo: 3400, unaVez: true,
        dibujar: function () {
            var I = Iso(226, 92), s = '';
            s += '<g data-t="0" data-dur="500">' + I.manzana(170, 100) + '</g>';
            // El camino punteado entre las dos puertas
            var a = I.iso(46, 74, .4), b = I.iso(124, 30, .4);
            s += '<g data-t="500" data-dur="500"><line x1="' + f1(a[0]) + '" y1="' + f1(a[1]) + '" x2="' + f1(b[0]) + '" y2="' + f1(b[1]) + '" stroke="#5FD0DC" stroke-opacity=".55" stroke-width="1.6" stroke-dasharray="4 6"/></g>';
            // Tu casa (izquierda, adelante) y el edificio de la empresa (derecha, atras)
            s += '<g class="e-brota" data-t="150">' + I.caja(14, 50, 0, 32, 32, 30, C.pared) + I.techo(14, 50, 30, 32, 32, 18, '#2BB6C6', '#1B8F9C') +
                 I.poli([[46.1, 60, 10], [46.1, 70, 10], [46.1, 70, 20], [46.1, 60, 20]], C.ventanaLuz[1]) + '</g>';
            var edificio = I.caja(108, 10, 0, 40, 36, 74, C.hotel);
            for (var k = 0; k < 3; k++) edificio += I.ventanas(108, 10, 40, 36, 16 + k * 18, 10, C.ventana, 3, 3);
            s += '<g class="e-brota" data-t="300" data-dur="900">' + edificio + '</g>';
            s += '<g class="e-brota" data-t="250">' + I.arbol(150, 84, .8) + '</g>';
            // El mensaje: un sobre de luz que salta de tu puerta a la de la empresa
            var sobre = I.caja(48, 70, 0, 9, 9, 6, C.naranja) + I.poli([[48, 79.1, 6], [57, 79.1, 6], [52.5, 79.1, 2.5]], '#FFE2C8');
            s += '<g data-t="1100" data-dur="200"><g class="e-viaja" data-t="1200" data-dur="900" data-dx="' + f1((70 + 33) * .866) + '" data-dy="' + f1((70 - 33) * .5) + '" data-salto="16">' + sobre + '</g></g>';
            // Al llegar, la empresa enciende sus ventanas: te leyeron
            for (var j = 0; j < 3; j++) s += '<g data-t="' + (2150 + j * 140) + '" data-dur="320">' + I.ventanas(108, 10, 40, 36, 16 + j * 18, 10, C.ventanaLuz, 3, 3) + '</g>';
            var p = I.iso(118, 46, 8);
            s += onda(2300, p[0], p[1], 12, '#5FD0DC') + chispas(2400, p[0], p[1], 10, 6);
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
        // Letrero (2026-11-13): aparece y sube 6 px, sin crecer ni rebotar; sale mas rapido de lo que entra
        if (c.contains('e-etiqueta')) return { dur: 420, k: [{ o: 0, op: 0, tf: 'translate(0px, 6px)', e: CURVA.salida }, { o: 1, op: op, tf: 'translate(0px, 0px)' }], sale: 'translate(0px, -4px)', durSale: 240 };
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
            lista.push(p.animate([desde, fuera], { delay: Math.max(hasta, t + dur), duration: +d.salida || ef.durSale || 420, fill: 'forwards' }));
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
        // unaVez: la escena se arma, llega a su final y se queda quieta ahi (no vuelve a empezar)
        this.unaVez = !!receta.unaVez;
        this.el = el; this.final = this.unaVez ? L : L - 1000;
        this.visible = false; this.congelada = false; this.corriendo = false;
        el.querySelector('.escena-raiz').innerHTML = receta.dibujar();
        this.anims = [];
        Array.prototype.forEach.call(el.querySelectorAll('[data-t]'), function (p) { self.anims = self.anims.concat(animacionesDe(p)); });
        Array.prototype.forEach.call(el.querySelectorAll('.e-capa'), function (c) { self.anims.push(animacionCapa(c, L)); });
        // Reloj sin dibujo: marca el tiempo de la escena (para los porcentajes que cuentan y para saber
        // cuando termino el ciclo y hay que volver a empezar)
        this.reloj = new Animation(new KeyframeEffect(null, [], { duration: L, fill: 'forwards' }), document.timeline);
        this.anims.push(this.reloj);
        // El halo de detras (::before de la escena) sigue la historia: [ms, opacidad]. Es una caja HTML, asi
        // que cambiar su opacidad no obliga a redibujar el SVG
        if (receta.halo) {
            try {
                this.anims.push(el.animate(receta.halo.map(function (h) {
                    return { offset: Math.min(1, h[0] / L), opacity: h[1], easing: CURVA.suave };
                }), { duration: L, fill: 'both', pseudoElement: '::before' }));
            } catch (e) { /* navegador sin animacion de pseudo-elementos: el halo queda fijo */ }
        }
        this.contadores = Array.prototype.map.call(el.querySelectorAll('[data-contar]'), function (c) {
            return { el: c, v: +c.dataset.valor, a: +c.dataset.desde, b: +c.dataset.fin };
        });
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
                if (e.tiempo() >= e.L) {
                    if (e.unaVez) { e.congelada = true; e.actualizar(); } else e.reiniciar();
                } else e.contar(e.tiempo());
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
