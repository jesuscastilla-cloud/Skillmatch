/* ===============================================================
 * SkillMatch — Inicio: mapa de "Vacantes cerca de ti"
 * ---------------------------------------------------------------
 * Un globo terraqueo en 3D, dibujado aqui mismo en un <canvas> (sin librerias),
 * que flota sobre la pagina sin recuadro y se puede mover:
 *  - Al llegar a la seccion se ve el planeta entero. Luego gira y se acerca hasta
 *    tu zona: asi se entiende en que parte del mundo estas. Siempre se ve redondo:
 *    de cerca es como mirar el planeta con una lupa.
 *  - Se arrastra para girarlo (con el mouse o con el dedo; sigue un momento solo
 *    al soltarlo), tiene botones para acercar, alejar y volver a tu zona, y al
 *    tocar un pin se elige su tarjeta.
 *  - Sirve para cualquier lugar del mundo: los paises salen de assets/data/mundo.json
 *    (Natural Earth, dominio publico; lo genera herramientas/hacer-mundo.mjs).
 *    Tu pais se pinta mas claro y con el borde turquesa.
 *  - De tu punto sale UNA ruta curva hacia cada ciudad con vacantes (no una por
 *    vacante: 4 lineas casi iguales no se entendian). En la ciudad, cada vacante
 *    tiene su pin con el mismo numero de su tarjeta, y la ruta dice cuantos km hay.
 *  - Pasar el mouse por una tarjeta ilumina su pin y su ruta en naranja, y al reves.
 *  - Municipios (2026-11-12): al acercarse aparecen los limites de los municipios de Colombia
 *    (assets/data/municipios-col.json: DANE, Marco Geoestadistico Nacional, via geoBoundaries,
 *    CC BY 4.0; lo genera herramientas/hacer-municipios.mjs). Los que tienen vacantes dentro de
 *    tu alcance se pintan en turquesa (mas fuerte cuantas mas tienen) y el de la tarjeta
 *    señalada, en naranja. El archivo se pide en un rato libre, despues del mundo.
 *  - Tu alcance (2026-11-12): si vacantes-cerca.js manda un radio (25, 50 o 100 km), se dibuja
 *    el anillo de ese radio sobre la esfera (un circulo de verdad, medido en km), crece desde ti
 *    al llegar, y la camara lo encuadra. Cada ciudad dice cuantas vacantes tiene.
 *
 * Como se dibuja un globo sin WebGL: cada punto (latitud, longitud) se convierte una
 * sola vez en un punto de una esfera de radio 1 (x, y, z). En cada cuadro, la camara
 * son tres flechas (este, norte y "hacia ti"): la sombra del punto sobre "este" y
 * "norte" da su lugar en la pantalla, y la sombra sobre "hacia ti" dice si esta del
 * lado visible. Eso es una proyeccion ortografica: el planeta visto desde muy lejos.
 *
 * El dibujo es decorativo (aria-hidden): lo mismo ya lo dicen la frase de la seccion
 * y las tarjetas; los botones si son botones de verdad. Las coordenadas salen de
 * ciudades.js y no se envian a ningun lado. El canvas solo se redibuja mientras la
 * camara se mueve; pines y luces animan transform y opacity. Fuera de pantalla no
 * se mueve, y con "reducir movimiento" aparece ya en su sitio.
 *
 * vacantes-cerca.js lo usa con SkillMatchMapaCerca.cargando(origen),
 * .mostrar(origen, encontradas), .vacio(origen) y .error(origen).
 * =============================================================== */
(function () {
    'use strict';

    const C = window.SkillMatchCiudades;
    const panel = document.getElementById('cercaMapa');
    if (!C || !panel) return;
    const lienzo = panel.querySelector('.cerca-mapa-lienzo');
    const sub = panel.querySelector('.cerca-mapa-sub');
    const lista = document.getElementById('cercaLista');
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // El archivo del mundo esta junto a los scripts: ../data/mundo.json
    const URL_MUNDO = new URL('../data/mundo.json', (document.currentScript && document.currentScript.src) || location.href).href;
    const URL_MUNICIPIOS = new URL('../data/municipios-col.json', (document.currentScript && document.currentScript.src) || location.href).href;

    // El mar, el resplandor de la atmosfera y la sombra que lo hace ver redondo son cajas con degradados
    // de CSS (.cm-halo, el fondo de .cm-globo y .cm-brillo): el navegador las compone sin repintarlas.
    // En el canvas solo se dibujan los paises: es lo unico que cambia cuando la camara se mueve.
    lienzo.innerHTML = `<div class="cm-halo" aria-hidden="true"></div>
        <canvas class="cm-globo" aria-hidden="true"></canvas>
        <div class="cm-brillo" aria-hidden="true"></div>
        <svg class="cm-rutas-svg" focusable="false" aria-hidden="true"><defs class="cm-recortes"></defs><g class="cm-rutas"></g></svg>
        <div class="cm-pines" aria-hidden="true"></div>
        <span class="cm-pin cm-pin-tu es-activo" aria-hidden="true"><i></i><b></b></span>
        <canvas class="cm-mini" aria-hidden="true"></canvas>
        <div class="cm-controles" role="group" aria-label="Mover el mapa">
            <button type="button" class="cm-control" data-mapa="acercar" aria-label="Acercar el mapa"><i data-ico="plus"></i></button>
            <button type="button" class="cm-control" data-mapa="alejar" aria-label="Alejar el mapa"><i data-ico="minus"></i></button>
            <button type="button" class="cm-control" data-mapa="volver" aria-label="Volver a mi zona"><i data-ico="target"></i></button>
        </div>`;
    const lona = lienzo.querySelector('.cm-globo');
    const ctx = lona.getContext('2d');
    const lonaMini = lienzo.querySelector('.cm-mini');
    const svgRutas = lienzo.querySelector('.cm-rutas-svg');
    const recortes = svgRutas.querySelector('.cm-recortes');
    const capaRutas = svgRutas.querySelector('.cm-rutas');
    const capaPines = lienzo.querySelector('.cm-pines');
    const pinTu = lienzo.querySelector('.cm-pin-tu');
    const controles = lienzo.querySelector('.cm-controles');
    pinTu.style.opacity = '0';
    if (window.SkillMatchUI && window.SkillMatchUI.hidratarIconos) window.SkillMatchUI.hidratarIconos(controles);

    const f = n => n.toFixed(2);
    const escapar = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const entre = (n, a, b) => Math.max(a, Math.min(b, n));

    /* ---------- 1. Geometria de la esfera ---------- */
    const RAD = Math.PI / 180;
    const RADIO_TIERRA = 6371;   // km
    /** Latitud y longitud -> punto de la esfera de radio 1. */
    const vec = (lat, lon) => { const c = Math.cos(lat * RAD); return [c * Math.cos(lon * RAD), c * Math.sin(lon * RAD), Math.sin(lat * RAD)]; };
    const punto = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const normal = v => { const n = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / n, v[1] / n, v[2] / n]; };
    const angulo = (a, b) => Math.acos(entre(punto(a, b), -1, 1));
    /** Punto intermedio entre a y b por el camino mas corto sobre la esfera (t de 0 a 1). */
    function entreDos(a, b, t) {
        const w = angulo(a, b), s = Math.sin(w);
        if (s < 1e-4) return b;
        const p = Math.sin((1 - t) * w) / s, q = Math.sin(t * w) / s;
        return [a[0] * p + b[0] * q, a[1] * p + b[1] * q, a[2] * p + b[2] * q];
    }
    /** Los puntos que estan a "km" de o, alrededor de el (n puntos): un circulo dibujado sobre la esfera. */
    function circulo(o, km, n) {
        const a = km / RADIO_TIERRA, b = base(o), ca = Math.cos(a), sa = Math.sin(a), lista = [];
        for (let i = 0; i < n; i++) {
            const t = i / n * 2 * Math.PI, ct = Math.cos(t) * sa, st = Math.sin(t) * sa;
            lista.push([o[0] * ca + b.e[0] * ct + b.n[0] * st, o[1] * ca + b.e[1] * ct + b.n[1] * st, o[2] * ca + b.e[2] * ct + b.n[2] * st]);
        }
        return lista;
    }
    /** Las tres flechas de la camara que mira al punto c: este, norte y hacia el que mira. */
    function base(c) {
        const l = Math.atan2(c[1], c[0]), sf = entre(c[2], -1, 1), cf = Math.sqrt(1 - sf * sf), sl = Math.sin(l), cl = Math.cos(l);
        return { c: c, e: [-sl, cl, 0], n: [-sf * cl, -sf * sl, cf] };
    }
    /** Punto de la esfera -> [x, y, z] en pantalla (z > 0: del lado visible). */
    const enPantalla = (v, cam, m) => [m.cx + cam.k * punto(v, cam.b.e), m.cy - cam.k * punto(v, cam.b.n), punto(v, cam.b.c)];
    /** Se ve: esta del lado de aca y cae dentro del disco del planeta. */
    const enDisco = (q, m) => q[2] > 0.05 && Math.hypot(q[0] - m.cx, q[1] - m.cy) < m.R - 4;

    /* ---------- 2. El mundo (se pide solo cuando la seccion se acerca a la pantalla) ---------- */
    let mundo = null;          // { arcos: [{ n, v, p, ll, corte, sello }], paises: [{ anillos, cv, r, s, n }] }
    let mundoPedido = false, mundoFallo = false;

    function leerMundo(json) {
        const escala = json.escala || 100;
        const arcos = json.arcos.map(plano => {
            const n = plano.length / 2, v = new Float32Array(n * 3), ll = new Float32Array(n * 2);
            let x = 0, y = 0;
            for (let i = 0; i < n; i++) {
                x += plano[2 * i]; y += plano[2 * i + 1];
                const lon = x / escala, lat = y / escala, q = vec(lat, lon);
                v[3 * i] = q[0]; v[3 * i + 1] = q[1]; v[3 * i + 2] = q[2];
                ll[2 * i] = lon; ll[2 * i + 1] = lat;
            }
            return { n: n, v: v, ll: ll, p: new Float32Array(n * 3), sello: 0 };
        });
        const paises = json.paises.map(p => ({ anillos: p.a, cv: vec(p.c[1], p.c[0]), r: p.r * RAD, s: p.s, n: p.n || '' }));
        return { arcos: arcos, paises: paises };
    }

    function pedirMundo() {
        if (mundoPedido) return;
        mundoPedido = true;
        fetch(URL_MUNDO).then(r => { if (!r.ok) throw new Error('sin mundo'); return r.json(); }).then(json => {
            mundo = leerMundo(json);
            buscarPais();
            if (esperaMundo) { lanzar(); return; }         // la entrada estaba esperando a los continentes
            if (visible && !reducido) pedirCuadro();       // aparecen con un fundido
            else { alfaTierra = 1; pintar(); }
            if (capa) dibujarMini();
            // Los municipios (384 KB) en el proximo rato libre: nunca mientras la persona baja por la pagina
            if ('requestIdleCallback' in window) requestIdleCallback(pedirMunicipios, { timeout: 6000 });
            else setTimeout(pedirMunicipios, 1500);
        }).catch(() => { mundoFallo = true; if (esperaMundo) lanzar(); });   // sin continentes el mapa igual funciona
    }

    /**
     * Recorre los puntos de un contorno (una lista de arcos; negativo = arco al reves).
     * s: de cada cuantos puntos se toma uno. De lejos sobra detalle: con el planeta entero un pixel
     * son 35 km y el archivo trae un punto cada kilometro. Los extremos de cada arco se toman siempre
     * y en los dos sentidos se usan los mismos puntos: asi dos paises vecinos calzan sin huecos.
     */
    function recorrer(anillo, hacer, s, datos) {
        s = s || 1;
        const arcos = (datos || mundo).arcos;
        for (let k = 0; k < anillo.length; k++) {
            const i = anillo[k], a = arcos[i >= 0 ? i : ~i], fin = a.n - 1;
            // Los arcos se tocan en sus extremos: el primer punto de cada arco siguiente ya se dio
            if (i >= 0) {
                for (let j = k ? s : 0; j < fin; j += s) hacer(a, j);
                hacer(a, fin);
            } else {
                if (!k) hacer(a, fin);
                for (let j = Math.floor((fin - 1) / s) * s; j > 0; j -= s) hacer(a, j);
                hacer(a, 0);
            }
        }
    }

    /** En que pais (o municipio, con datos = municipios) cae un punto (-1: en ninguno, por ejemplo en el mar). */
    function paisDe(lat, lon, datos) {
        const d = datos || mundo;
        if (!d) return -1;
        const v = vec(lat, lon);
        for (let k = 0; k < d.paises.length; k++) {
            const p = d.paises[k];
            if (angulo(p.cv, v) > p.r + 0.01) continue;
            for (const anillo of p.anillos) {
                // Regla par-impar: una linea hacia el este cruza el borde un numero impar de veces si esta adentro
                let dentro = false, ax = null, ay = 0;
                const probar = (bx, by) => {
                    if (ax !== null && (ay > lat) !== (by > lat) && lon < ax + (lat - ay) * (bx - ax) / (by - ay)) dentro = !dentro;
                    ax = bx; ay = by;
                };
                let x0 = null, y0 = 0;
                recorrer(anillo, (a, j) => { if (x0 === null) { x0 = a.ll[2 * j]; y0 = a.ll[2 * j + 1]; } probar(a.ll[2 * j], a.ll[2 * j + 1]); }, 1, d);
                probar(x0, y0);
                if (dentro) return k;
            }
        }
        return -1;
    }

    /* ---------- 2b. Los municipios de Colombia: se piden en un rato libre, despues del mundo ---------- */
    let municipios = null, municipiosPedidos = false;
    const municipioDe = {};       // clave de una ciudad (ciudades.js) -> indice del municipio que la contiene
    let municipioResaltado = -1;  // el municipio de la tarjeta senalada (se pinta en naranja)
    function pedirMunicipios() {
        if (municipiosPedidos) return;
        municipiosPedidos = true;
        fetch(URL_MUNICIPIOS).then(r => { if (!r.ok) throw new Error('sin municipios'); return r.json(); }).then(json => {
            municipios = leerMundo(json);
            // Los arcos que usa un solo municipio son el borde de afuera de Colombia (costa o frontera)
            const usos = new Uint8Array(municipios.arcos.length);
            municipios.paises.forEach(mu => mu.anillos.forEach(an => an.forEach(i => { usos[i >= 0 ? i : ~i]++; })));
            municipios.afuera = usos;
            // Cada ciudad de la tabla, en el municipio que la contiene (por su punto, no por su nombre:
            // hay varios "San Rafael" y el DANE escribe "Cartagena de Indias")
            C.lista.forEach(c => { const i = paisDe(c.lat, c.lon, municipios); if (i >= 0) municipioDe[c.clave] = i; });
            if (cam && m) pintar();
        }).catch(() => { /* sin municipios el mapa funciona igual */ });
    }

    let miPais = -1;        // indice del pais donde estas (-1: ninguno o todavia no se sabe)
    let paisBuscado = '';   // para no repetir la busqueda si no cambiaste de lugar
    function buscarPais() {
        if (!mundo || !actual) return;
        const clave = actual.origen.lat + ',' + actual.origen.lon;
        if (clave === paisBuscado) return;
        paisBuscado = clave;
        miPais = paisDe(actual.origen.lat, actual.origen.lon);
    }

    /* ---------- 3. Dibujar el globo ---------- */
    let sello = 0;   // numero del dibujo: cada arco se proyecta una sola vez por dibujo aunque lo usen dos paises
    let salto = 1;   // de cada cuantos puntos se toma uno en este dibujo (segun que tan cerca esta la camara)

    function proyectarArco(a, cam, m) {
        if (a.sello === sello) return;
        a.sello = sello;
        const v = a.v, p = a.p, e = cam.b.e, n = cam.b.n, c = cam.b.c, k = cam.k, fin = a.n - 1;
        // Solo los puntos que se van a usar: uno de cada "salto", y siempre el ultimo
        for (let i = 0; i <= fin; i = (i < fin && i + salto > fin) ? fin : i + salto) {
            const j = 3 * i, x = v[j], y = v[j + 1], z = v[j + 2];
            const px = x * e[0] + y * e[1], py = x * n[0] + y * n[1] + z * n[2], pz = x * c[0] + y * c[1] + z * c[2];
            if (pz >= 0) { p[j] = m.cx + k * px; p[j + 1] = m.cy - k * py; }
            else {
                // Del otro lado del planeta: se lleva al borde del disco. Asi un pais que asoma por
                // el horizonte se rellena bien sin calcular donde lo corta el borde
                const h = Math.hypot(px, py) || 1;
                p[j] = m.cx + k * px / h; p[j + 1] = m.cy - k * py / h;
            }
            p[j + 2] = pz;
        }
    }

    function trazarPais(lapiz, pais, cam, m, datos) {
        const arcos = (datos || mundo).arcos;
        for (const anillo of pais.anillos) {
            for (const i of anillo) proyectarArco(arcos[i >= 0 ? i : ~i], cam, m);
            let primero = true;
            recorrer(anillo, (a, j) => {
                if (primero) { lapiz.moveTo(a.p[3 * j], a.p[3 * j + 1]); primero = false; }
                else lapiz.lineTo(a.p[3 * j], a.p[3 * j + 1]);
            }, salto, datos);
            lapiz.closePath();
        }
    }

    // Paralelos y meridianos cada 20 grados
    const CUADRICULA = (function () {
        const lineas = [];
        for (let lon = -180; lon < 180; lon += 20) { const l = []; for (let lat = -80; lat <= 80; lat += 4) l.push(vec(lat, lon)); lineas.push(l); }
        for (let lat = -60; lat <= 60; lat += 20) { const l = []; for (let lon = -180; lon <= 180; lon += 4) l.push(vec(lat, lon)); lineas.push(l); }
        return lineas;
    })();
    // Las ciudades principales de la tabla (ciudades.js), de mayor a menor: sirven para ubicarse en el mapa
    const REFERENCIAS = ['bogota', 'medellin', 'cali', 'barranquilla', 'cartagena', 'cucuta', 'bucaramanga', 'pereira', 'santa_marta',
        'ibague', 'pasto', 'manizales', 'monteria', 'villavicencio', 'valledupar', 'sincelejo', 'neiva', 'armenia', 'popayan',
        'riohacha', 'tunja', 'quibdo', 'yopal', 'florencia', 'leticia']
        .map(clave => C.porClave(clave)).filter(Boolean).map(c => ({ corto: c.corto, clave: c.clave, v: vec(c.lat, c.lon) }));

    let alfaTierra = 0;     // los continentes aparecen con un fundido cuando llega el archivo
    let alfaRotulos = 0;    // los nombres aparecen al terminar el vuelo
    let evitar = [];        // puntos de la pantalla que los nombres no deben tapar: [x, y, radio]

    /**
     * Dibuja el planeta visto por la camara dentro de un disco de radio m.R. Si la camara esta
     * mas cerca que eso (cam.k > m.R), el mapa se recorta con el disco: se sigue viendo una bola.
     * opciones.mini: version sencilla (sin fronteras ni nombres) para el recuadro del pais.
     */
    function dibujarGlobo(lapiz, cam, m, opciones) {
        const mini = !!(opciones && opciones.mini);
        sello++;
        const k = cam.k, cx = m.cx, cy = m.cy, R = m.R;
        // Detalle segun la distancia: que entre punto y punto haya unos 2 pixeles, no mas fino
        salto = Math.max(1, Math.min(24, Math.floor(RADIO_TIERRA / k / 2.2)));
        const entero = k < R * 1.05;         // se ve el planeta completo
        if (mini) {
            // El recuadro pequeno se dibuja una sola vez: lleva su mar y su recorte redondo en el canvas
            lapiz.clearRect(0, 0, m.w, m.h);
            const mar = lapiz.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.05, cx, cy, R);
            mar.addColorStop(0, '#173B60');
            mar.addColorStop(1, '#0A1C33');
            lapiz.fillStyle = mar;
            lapiz.beginPath(); lapiz.arc(cx, cy, R, 0, 2 * Math.PI); lapiz.fill();
            lapiz.save();
            lapiz.beginPath(); lapiz.arc(cx, cy, R, 0, 2 * Math.PI); lapiz.clip();
        } else {
            // El planeta grande: el canvas mide lo que el disco y el CSS lo recorta redondo (.cm-globo)
            lapiz.clearRect(cx - R - 1, cy - R - 1, 2 * R + 2, 2 * R + 2);
        }

        // La cuadricula se nota en el planeta entero y se apaga al acercarse
        const alfaCuadricula = mini ? 0 : 0.12 * entre((R * 4 - k) / (R * 3), 0, 1);
        if (alfaCuadricula > 0.004) {
            lapiz.strokeStyle = 'rgba(150, 200, 240, ' + alfaCuadricula.toFixed(3) + ')';
            lapiz.lineWidth = 1;
            lapiz.beginPath();
            for (const linea of CUADRICULA) {
                let levantado = true;
                for (const v of linea) {
                    const q = enPantalla(v, cam, m);
                    if (q[2] <= 0) { levantado = true; continue; }
                    if (levantado) { lapiz.moveTo(q[0], q[1]); levantado = false; } else lapiz.lineTo(q[0], q[1]);
                }
            }
            lapiz.stroke();
        }

        if (mundo && alfaTierra > 0) {
            const vista = k > R ? Math.asin(R / k) + 0.02 : Math.PI;   // hasta que angulo llega el disco
            const visibles = [];
            mundo.paises.forEach((p, i) => {
                const t = angulo(p.cv, cam.b.c) - p.r;
                if (t < Math.PI / 2 && t < vista) visibles.push(i);
            });
            const conMiPais = miPais >= 0 && visibles.indexOf(miPais) >= 0;
            // Los municipios: aparecen al acercarse (con el disco abarcando menos de unos 450 km). Cuando se ven,
            // la tierra de Colombia se dibuja con ellos (la costa precisa del DANE) y la del mapa del mundo
            // (1:50 millones, en lineas rectas) se desvanece: antes se veian dos costas
            const alfaMunicipios = !mini && municipios ? entre((k - R * 14) / (R * 10), 0, 1) : 0;
            const colombiaFina = conMiPais && alfaMunicipios > 0 && mundo.paises[miPais].n === 'Colombia';
            // Con los municipios ya del todo, la Colombia del mapa del mundo ni se dibuja (invisible, igual costaba)
            const colombiaGruesa = conMiPais && !(colombiaFina && alfaMunicipios > 0.99);
            lapiz.globalAlpha = alfaTierra;
            // Todos los paises en un solo trazo (un solo relleno); el tuyo aparte, mas claro
            lapiz.fillStyle = '#1C3D61';
            lapiz.beginPath();
            visibles.forEach(i => { if (i !== miPais) trazarPais(lapiz, mundo.paises[i], cam, m); });
            lapiz.fill();
            if (colombiaGruesa) {
                lapiz.globalAlpha = alfaTierra * (colombiaFina ? 1 - alfaMunicipios : 1);
                lapiz.fillStyle = '#27587F';
                lapiz.beginPath();
                trazarPais(lapiz, mundo.paises[miPais], cam, m);
                lapiz.fill();
                lapiz.globalAlpha = alfaTierra;
            }
            if (!mini) {
                // Costas y fronteras: cada arco una sola vez, y solo lo que esta del lado visible
                lapiz.strokeStyle = 'rgba(165, 205, 240, ' + ((entero ? 0.2 : 0.3) * (colombiaFina ? 1 - 0.85 * alfaMunicipios : 1)).toFixed(3) + ')';
                lapiz.lineWidth = entero ? 0.6 : 0.9;
                lapiz.lineJoin = 'round';
                lapiz.beginPath();
                for (const a of mundo.arcos) {
                    if (a.sello !== sello) continue;
                    const p = a.p, ll = a.ll, fin = a.n - 1;
                    let levantado = true, antes = -1;
                    for (let i = 0; i <= fin; i = (i < fin && i + salto > fin) ? fin : i + salto) {
                        const j = 3 * i;
                        if (p[j + 2] <= 0) { levantado = true; antes = i; continue; }       // del otro lado: se levanta el lapiz
                        // El archivo corta los paises que cruzan el meridiano 180 (Rusia, Fiyi): ese corte no es una frontera
                        const enCorte = antes >= 0 && Math.abs(ll[2 * i]) > 179.9 && Math.abs(ll[2 * antes]) > 179.9;
                        if (levantado || enCorte) { lapiz.moveTo(p[j], p[j + 1]); levantado = false; }
                        else lapiz.lineTo(p[j], p[j + 1]);
                        antes = i;
                    }
                }
                lapiz.stroke();
            }
            if (alfaMunicipios > 0.01) dibujarMunicipios(lapiz, cam, m, vista, alfaMunicipios, colombiaFina);
            // El borde de tu pais, en turquesa (con los municipios a la vista lo dibujan ellos, mas preciso)
            if (colombiaGruesa) {
                lapiz.globalAlpha = alfaTierra * (colombiaFina ? 1 - alfaMunicipios : 1);
                lapiz.strokeStyle = mini ? 'rgba(95, 208, 220, .9)' : 'rgba(95, 208, 220, .75)';
                lapiz.lineWidth = mini ? 1 : 1.3;
                lapiz.beginPath();
                trazarPais(lapiz, mundo.paises[miPais], cam, m);
                lapiz.stroke();
                lapiz.globalAlpha = alfaTierra;
            }
            if (!mini && alfaRotulos > 0.01 && k > R * 2) rotular(lapiz, cam, m, visibles);
            lapiz.globalAlpha = 1;
        }
        if (mini) {
            lapiz.restore();
            const sombra = lapiz.createRadialGradient(cx, cy, R * 0.7, cx, cy, R);
            sombra.addColorStop(0, 'rgba(2, 8, 20, 0)');
            sombra.addColorStop(1, 'rgba(2, 8, 20, .55)');
            lapiz.fillStyle = sombra;
            lapiz.beginPath(); lapiz.arc(cx, cy, R, 0, 2 * Math.PI); lapiz.fill();
        }
    }

    /**
     * Los municipios a la vista: rellenos para los que tienen vacantes dentro de tu alcance (turquesa, mas
     * fuerte cuantas mas tienen; naranja el de la tarjeta senalada), bordes finos para todos y, muy de
     * cerca, el nombre de los vecinos (los que tienen vacantes ya llevan su etiqueta en el mapa).
     */
    function dibujarMunicipios(lapiz, cam, m, vista, alfa, comoTierra) {
        const visibles = [];
        municipios.paises.forEach((p, i) => { if (angulo(p.cv, cam.b.c) - p.r < vista) visibles.push(i); });
        if (!visibles.length) return;
        const base = lapiz.globalAlpha;
        lapiz.globalAlpha = base * alfa;
        // La tierra de Colombia, con la costa precisa (reemplaza la del mapa del mundo, que se desvanece)
        if (comoTierra) {
            lapiz.fillStyle = '#27587F';
            lapiz.beginPath();
            visibles.forEach(i => trazarPais(lapiz, municipios.paises[i], cam, m, municipios));
            lapiz.fill();
        }
        const totales = actual && actual.totales;
        const conVacantes = new Set();
        if (totales) {
            Object.keys(totales).forEach(clave => {
                const i = municipioDe[clave];
                if (i === undefined || !totales[clave] || visibles.indexOf(i) < 0) return;
                conVacantes.add(i);
                const fuerza = Math.min(1, Math.log10(totales[clave] + 1) / 2.5);   // 1 vacante: tenue; 300: lleno
                lapiz.fillStyle = i === municipioResaltado ? 'rgba(255, 118, 24, .4)' : 'rgba(95, 208, 220, ' + (0.12 + 0.26 * fuerza).toFixed(3) + ')';
                lapiz.beginPath();
                trazarPais(lapiz, municipios.paises[i], cam, m, municipios);
                lapiz.fill();
            });
        }
        // Bordes: cada arco una sola vez, solo los de los municipios a la vista
        visibles.forEach(i => {
            for (const anillo of municipios.paises[i].anillos) for (const j of anillo) proyectarArco(municipios.arcos[j >= 0 ? j : ~j], cam, m);
        });
        // Los bordes: los de adentro (entre municipios) finos y tenues; el de afuera (costa y frontera), en
        // turquesa como el borde de tu pais
        const trazar = (deAfuera) => {
            lapiz.beginPath();
            municipios.arcos.forEach((a, n) => {
                if (a.sello !== sello || (municipios.afuera[n] === 1) !== deAfuera) return;
                const p = a.p, fin = a.n - 1;
                let levantado = true;
                for (let i = 0; i <= fin; i = (i < fin && i + salto > fin) ? fin : i + salto) {
                    const j = 3 * i;
                    if (p[j + 2] <= 0) { levantado = true; continue; }
                    if (levantado) { lapiz.moveTo(p[j], p[j + 1]); levantado = false; } else lapiz.lineTo(p[j], p[j + 1]);
                }
            });
            lapiz.stroke();
        };
        lapiz.lineJoin = 'round';
        // Mientras el planeta se mueve (arrastre, vuelo, inercia) solo lo esencial: los bordes de adentro y los
        // nombres vuelven apenas se detiene. Asi arrastrar sigue fluido (con todo, algunos cuadros pasaban de 20 ms)
        const quieto = !vuelo && !moviendo && !arrastre && !inercia;
        lapiz.strokeStyle = 'rgba(165, 205, 240, .26)';
        lapiz.lineWidth = 0.7;
        if (quieto) trazar(false);
        if (comoTierra) {
            lapiz.strokeStyle = 'rgba(95, 208, 220, .75)';
            lapiz.lineWidth = 1.3;
            trazar(true);
        }
        // Nombres de los municipios vecinos, muy tenues, solo si caben y no tapan pines ni etiquetas
        if (quieto && alfaRotulos > 0.01 && cam.k > m.R * 60) {
            lapiz.font = '500 11px "Instrument Sans", system-ui, sans-serif';
            lapiz.textAlign = 'center';
            lapiz.textBaseline = 'middle';
            lapiz.fillStyle = 'rgba(210, 232, 250, ' + (0.42 * alfaRotulos).toFixed(3) + ')';
            const puestos = [];
            visibles.forEach(i => {
                const mu = municipios.paises[i];
                if (conVacantes.has(i) || !mu.n || Math.sqrt(mu.s) * RAD * cam.k < 70) return;
                const q = enPantalla(mu.cv, cam, m);
                if (q[2] < 0.3 || Math.hypot(q[0] - m.cx, q[1] - m.cy) > m.R - 30) return;
                const medio = lapiz.measureText(mu.n).width / 2 + 6;
                if (evitar.some(o => Math.abs(o[0] - q[0]) < medio + o[2] && Math.abs(o[1] - q[1]) < 10 + o[2])) return;
                if (puestos.some(o => Math.abs(o[0] - q[0]) < medio + o[2] && Math.abs(o[1] - q[1]) < 18)) return;
                puestos.push([q[0], q[1], medio]);
                lapiz.fillText(mu.n, q[0], q[1]);
            });
        }
        lapiz.globalAlpha = base;
    }

    /** Nombres de paises y ciudades de referencia; se corren o se omiten si tapan tu punto o un pin. */
    function rotular(lapiz, cam, m, visibles) {
        const cabe = (x, y, medio) => Math.hypot(x - m.cx, y - m.cy) + medio < m.R - 8;
        lapiz.font = '600 12px "Instrument Sans", system-ui, sans-serif';
        lapiz.textAlign = 'center';
        lapiz.textBaseline = 'middle';
        if ('letterSpacing' in lapiz) lapiz.letterSpacing = '2px';
        for (const i of visibles) {
            const p = mundo.paises[i];
            if (!p.n || Math.sqrt(p.s) * RAD * cam.k < 80) continue;      // el nombre no cabe en el pais
            const q = enPantalla(p.cv, cam, m);
            if (q[2] < 0.3) continue;
            const texto = p.n.toUpperCase(), medio = lapiz.measureText(texto).width / 2 + 10;
            let y = null;
            for (const dy of [0, 46, -46, 86, -86, 126, -126]) {
                const yy = q[1] + dy;
                if (!cabe(q[0], yy, medio)) continue;
                if (evitar.some(o => Math.abs(o[0] - q[0]) < medio + o[2] && Math.abs(o[1] - yy) < 16 + o[2])) continue;
                y = yy; break;
            }
            if (y === null) continue;
            lapiz.fillStyle = 'rgba(210, 232, 250, ' + ((i === miPais ? 0.6 : 0.34) * alfaRotulos).toFixed(3) + ')';
            lapiz.fillText(texto, q[0], y);
        }
        if ('letterSpacing' in lapiz) lapiz.letterSpacing = '0px';

        // Ciudades de referencia (las principales que caben sin estorbar): un punto tenue y su nombre
        if (cam.k < m.R * 5) return;
        lapiz.font = '500 12px "Instrument Sans", system-ui, sans-serif';
        lapiz.textAlign = 'left';
        const puestas = [];
        for (const ciudad of REFERENCIAS) {
            if (puestas.length >= 6) break;
            const q = enPantalla(ciudad.v, cam, m);
            if (q[2] < 0.3) continue;
            const ancho = lapiz.measureText(ciudad.corto).width, medio = q[0] + 8 + ancho / 2;
            if (!cabe(medio, q[1], ancho / 2 + 10)) continue;
            if (evitar.some(o => Math.abs(o[0] - medio) < ancho / 2 + 12 + o[2] && Math.abs(o[1] - q[1]) < 14 + o[2])) continue;
            if (puestas.some(o => Math.abs(o[0] - medio) < (ancho + o[2]) / 2 + 24 && Math.abs(o[1] - q[1]) < 24)) continue;
            puestas.push([medio, q[1], ancho]);
            lapiz.fillStyle = 'rgba(210, 232, 250, ' + (0.55 * alfaRotulos).toFixed(3) + ')';
            lapiz.beginPath(); lapiz.arc(q[0], q[1], 2, 0, 2 * Math.PI); lapiz.fill();
            lapiz.fillStyle = 'rgba(210, 232, 250, ' + (0.5 * alfaRotulos).toFixed(3) + ')';
            lapiz.fillText(ciudad.corto, q[0] + 8, q[1]);
        }
    }

    /* ---------- 4. Camara y medidas ---------- */
    let m = null;            // medidas del lienzo: { w, h, cx, cy, R: radio del disco, dpr }
    let cam = null;          // camara de ahora: { b: las tres flechas, k: radio del planeta en pixeles }
    let vOrigen = null;      // tu punto en la esfera
    let actual = null;       // lo que se muestra: { tipo, origen, encontradas }

    function medir() {
        const w = lienzo.clientWidth, h = lienzo.clientHeight;
        if (!w || !h) return null;
        const dpr = Math.min(2, window.devicePixelRatio || 1);   // nitido en pantallas densas, sin pintar de mas
        // El planeta ocupa casi todo el alto del lienzo (que mide lo mismo que el bloque de tarjetas);
        // si el lienzo es cuadrado (celular), deja sitio en las esquinas para los botones
        const R = Math.round(Math.min(h * 0.48, w * 0.42)), cx = w / 2, cy = h / 2;
        // El canvas mide justo lo que el disco (app.css lo centra con --cm-r); las medidas del dibujo
        // siguen contando desde la esquina del lienzo
        const lado = Math.round(2 * R * dpr);
        if (lona.width !== lado || lona.height !== lado) { lona.width = lado; lona.height = lado; }
        ctx.setTransform(dpr, 0, 0, dpr, -(cx - R) * dpr, -(cy - R) * dpr);
        lienzo.style.setProperty('--cm-r', R + 'px');
        m = { w: w, h: h, cx: cx, cy: cy, R: R, dpr: dpr };
        return m;
    }
    // Lo primero que se ve: el Atlantico al centro, con America a un lado y Europa y Africa al otro
    const camaraInicial = () => ({ b: base(vec(16, -38)), k: m.R });
    const kMaximo = () => m.R * RADIO_TIERRA / 30;      // lo mas cerca: el disco abarca unos 60 km

    /**
     * La camara que deja a la vista tu punto y todas las ciudades con vacantes, con aire alrededor
     * para los pines. Si todo queda en tu ciudad se ve tu zona (con la costa o las ciudades vecinas
     * para ubicarse); si las ciudades estan muy lejos unas de otras, el planeta entero.
     */
    function camaraPara(origen, encontradas, radio) {
        const puntos = [vec(origen.lat, origen.lon)], vistas = new Set();
        // Con un alcance, el anillo entero entra en la vista (8 puntos de su borde bastan)
        if (radio) circulo(puntos[0], radio, 8).forEach(v => puntos.push(v));
        (encontradas || []).forEach(e => {
            if (vistas.has(e.ciudad.clave)) return;
            vistas.add(e.ciudad.clave);
            puntos.push(vec(e.ciudad.lat, e.ciudad.lon));
        });
        // Con un alcance la vista se centra en ti y el anillo ocupa casi todo el planeta (con aire para los
        // pines del borde): asi cada ciudad queda separada de tu punto, con su ruta y sus km
        if (radio) {
            const yo = puntos[0];
            const abreAnillo = Math.max(radio * 1.12, 12) / RADIO_TIERRA;
            const lejos = Math.max.apply(null, puntos.slice(9).map(v => angulo(yo, v)).concat([abreAnillo]));
            return { b: base(yo), k: Math.max(m.R, m.R * 0.86 / Math.sin(Math.min(Math.PI / 2, lejos))) };
        }
        const centro = normal(puntos.reduce((s, v) => [s[0] + v[0], s[1] + v[1], s[2] + v[2]], [0, 0, 0]));
        const minimo = puntos.length > 1 ? 95 : 240;      // km; sin vacantes que mostrar, una vista mas amplia de la region
        const abre = Math.max(minimo / RADIO_TIERRA, Math.max.apply(null, puntos.map(v => angulo(centro, v))));
        const k = Math.max(m.R, m.R * 0.5 / Math.sin(Math.min(Math.PI / 2, abre)));
        return { b: base(centro), k: k };
    }

    /* ---------- 5. El cuadro de animacion ---------- */
    let vuelo = null;          // { desde, hasta, t0, dura, gira, espera, salto, alTerminar }
    let giroLibre = false;     // el planeta gira despacio mientras espera
    let arrastre = null;       // el dedo o el mouse que lo esta moviendo
    let inercia = null;        // al soltarlo sigue girando un momento: { vx, vy } en pixeles por milisegundo
    let moviendo = false;      // la persona lo esta moviendo (arrastre, inercia o un boton)
    let metaRotulos = 0;
    let cuadroPedido = 0, antes = 0;
    let visible = false;

    const suave = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);   // acelera y frena

    function pintar() {
        if (!m || !cam) return;
        colocar();                 // primero pines y rutas: los nombres del mapa saben que puntos no tapar
        dibujarGlobo(ctx, cam, m);
        if (vOrigen) {
            const q = enPantalla(vOrigen, cam, m);
            pinTu.style.transform = 'translate(' + f(q[0]) + 'px, ' + f(q[1]) + 'px)';
            pinTu.style.opacity = enDisco(q, m) ? '1' : '0';      // del otro lado del planeta no se ve
        }
    }
    function pedirCuadro() { if (!cuadroPedido) cuadroPedido = requestAnimationFrame(cuadro); }

    /** Gira el planeta lo que se movio el puntero (dx, dy en pixeles), con el norte siempre arriba. */
    function girar(dx, dy) {
        const c = cam.b.c, lat = Math.asin(entre(c[2], -1, 1)), lon = Math.atan2(c[1], c[0]);
        const nuevaLat = entre(lat + dy / cam.k, -1.4, 1.4);
        const nuevaLon = lon - dx / (cam.k * Math.max(0.35, Math.cos(lat)));
        cam = { b: base(vec(nuevaLat / RAD, nuevaLon / RAD)), k: cam.k };
    }

    function cuadro(ahora) {
        cuadroPedido = 0;
        const dt = antes ? Math.min(64, ahora - antes) : 16;
        antes = ahora;
        let sigue = false;
        if (vuelo) {
            if (vuelo.t0 === null) vuelo.t0 = ahora;
            const t = entre((ahora - vuelo.t0) / vuelo.dura, 0, 1);
            // Primero gira hacia tu zona y despues se acerca: se alcanza a ver hacia donde va
            const tGiro = suave(Math.min(1, t / vuelo.gira));
            const tZoom = suave(entre((t - vuelo.espera) / (1 - vuelo.espera), 0, 1));
            const lnK = Math.log(vuelo.desde.k) + (Math.log(vuelo.hasta.k) - Math.log(vuelo.desde.k)) * tZoom - vuelo.salto * Math.sin(Math.PI * t);
            cam = { b: base(normal(entreDos(vuelo.desde.b.c, vuelo.hasta.b.c, tGiro))), k: Math.max(m.R, Math.exp(lnK)) };
            if (t >= 1) { const fin = vuelo.alTerminar; cam = vuelo.hasta; vuelo = null; if (fin) fin(); }
            sigue = true;
        } else if (inercia && !arrastre) {
            girar(inercia.vx * dt, inercia.vy * dt);
            const freno = Math.exp(-dt / 280);
            inercia.vx *= freno; inercia.vy *= freno;
            if (Math.hypot(inercia.vx, inercia.vy) < 0.012) inercia = null;
            sigue = true;
        } else if (giroLibre && visible) {
            // La Tierra gira hacia el este: 5 grados por segundo
            const c = cam.b.c, a = -dt * 0.005 * RAD, s = Math.sin(a), co = Math.cos(a);
            cam = { b: base([c[0] * co - c[1] * s, c[0] * s + c[1] * co, c[2]]), k: cam.k };
            sigue = true;
        }
        if (mundo && alfaTierra < 1) { alfaTierra = Math.min(1, alfaTierra + dt / 500); sigue = true; }
        if (alfaRotulos !== metaRotulos) {
            const paso = dt / 450;
            alfaRotulos = metaRotulos > alfaRotulos ? Math.min(metaRotulos, alfaRotulos + paso) : Math.max(metaRotulos, alfaRotulos - paso);
            sigue = true;
        }
        pintar();
        if (sigue || arrastre) { if (sigue) pedirCuadro(); else antes = 0; }
        else { antes = 0; if (moviendo) asentar(); }
    }

    /* ---------- 6. Rutas y pines (encima del globo, en pixeles; siguen a la camara cuadro a cuadro) ---------- */
    let luces = [];            // luces que viajan por las rutas
    let entradas = [];         // animaciones de entrada de las rutas
    let capa = null;           // lo armado: { aqui, lejos, k } con sus elementos
    let fijado = null;         // la vacante elegida con un clic en su pin

    // Ruta curva: sube por encima de la recta, como el vuelo de un avion
    function control(a, b) {
        const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
        return [(a[0] + b[0]) / 2, Math.min(a[1], b[1]) - (10 + d * 0.22)];
    }
    const esconder = (el, si) => { if (el) el.classList.toggle('cm-fuera', !!si); };
    const mover = (el, p, extra) => { el.style.transform = 'translate(' + f(p[0]) + 'px, ' + f(p[1]) + 'px)' + (extra || ''); };

    function apagarLuces() { luces.forEach(a => a.cancel()); luces = []; }
    function quitarRecortes() {
        entradas.forEach(a => a.cancel());
        entradas = [];
        capaRutas.querySelectorAll('[clip-path]').forEach(g => g.removeAttribute('clip-path'));
        recortes.innerHTML = '';
    }
    function limpiarEncima() {
        apagarLuces(); quitarRecortes();
        capa = null; fijado = null;
        capaRutas.innerHTML = ''; capaPines.innerHTML = '';
        lienzo.classList.remove('cm-listo', 'cm-entra', 'cm-hay-resaltado');
        lonaMini.classList.remove('se-ve');
        if (lista) lista.querySelectorAll('.cerca-tarjeta.es-resaltada').forEach(t => t.classList.remove('es-resaltada'));
        evitar = [];
    }

    /**
     * Reparte las vacantes: las de tu ciudad (o pegadas a ti en la pantalla) van a tu alrededor;
     * las demas, por ciudad. Dos ciudades que en la pantalla quedan casi encima comparten grupo.
     */
    function agrupar(encontradas, yo) {
        const porCiudad = new Map();
        encontradas.forEach((e, i) => {
            let g = porCiudad.get(e.ciudad.clave);
            if (!g) {
                const v = vec(e.ciudad.lat, e.ciudad.lon), q = enPantalla(v, cam, m);
                g = { ciudades: [e.ciudad], indices: [], v: v, p: [q[0], q[1]] };
                porCiudad.set(e.ciudad.clave, g);
            }
            g.indices.push(i);
        });
        const aqui = { ciudades: [], indices: [], aqui: true }, lejos = [];
        porCiudad.forEach(g => {
            const juntar = (a, b) => { a.indices = a.indices.concat(b.indices).sort((x, y) => x - y); a.ciudades = a.ciudades.concat(b.ciudades); };
            if (Math.hypot(g.p[0] - yo[0], g.p[1] - yo[1]) < 22) { juntar(aqui, g); return; }
            const vecino = lejos.find(x => Math.hypot(x.p[0] - g.p[0], x.p[1] - g.p[1]) < 30);
            if (vecino) juntar(vecino, g); else lejos.push(g);
        });
        return { aqui: aqui, lejos: lejos };
    }

    /** Crea los elementos de rutas y pines para la camara de ahora. colocar() les da su lugar. */
    function armar(entrar) {
        const elegido = fijado;
        limpiarEncima();
        if (!actual || !m || !cam || !vOrigen) return;
        const origen = actual.origen, encontradas = actual.encontradas || [];
        const q0 = enPantalla(vOrigen, cam, m), yo = [q0[0], q0[1]];
        const partes = agrupar(encontradas, yo);
        svgRutas.setAttribute('viewBox', '0 0 ' + m.w + ' ' + m.h);
        let defs = '', rutas = '', rayos = '', pines = '', k = 0;

        const pinDe = (i, grupo) => {
            const e = encontradas[i], nombre = (e.vacante.title || 'Vacante') + ' · ' + e.ciudad.corto;
            return '<span class="cm-pin cm-pin-vacante" data-i="' + i + '" style="--k:' + (k++) + ';--r:' + (grupo.aqui ? 0 : 1) + '"><i>' + (i + 1) + '</i><b>' + escapar(nombre) + '</b></span>';
        };
        partes.aqui.indices.forEach((i, j) => {
            rayos += '<line class="cm-rayo" data-i="' + i + '" style="--k:' + j + '"/>';
            pines += pinDe(i, partes.aqui);
        });
        partes.lejos.forEach((g, numero) => {
            const n = g.indices.length;
            g.numero = numero;
            // El nombre del grupo: primero la ciudad con mas vacantes
            const cuantas = c => g.indices.filter(i => encontradas[i].ciudad.clave === c.clave).length;
            g.ciudades.sort((x, y) => cuantas(y) - cuantas(x));
            const nombre0 = g.ciudades[0].corto + (g.ciudades.length === 2 ? ' y ' + g.ciudades[1].corto : (g.ciudades.length > 2 ? ' y ' + (g.ciudades.length - 1) + ' más' : ''));
            // Con el total de cada ciudad (tu alcance): "Turbaco · 3"
            const suma = actual.totales ? g.ciudades.reduce((t, c) => t + (actual.totales[c.clave] || 0), 0) : 0;
            const nombre = suma ? nombre0 + ' · ' + suma.toLocaleString('es-CO') : nombre0;
            const km = Math.max(1, Math.round(C.distanciaKm(origen.lat, origen.lon, g.ciudades[0].lat, g.ciudades[0].lon)));
            if (entrar && !reducido) {
                // La ruta se "dibuja" destapandola: un rectangulo acostado sobre ella que se estira desde tu punto
                const b = g.p, largo = Math.hypot(b[0] - yo[0], b[1] - yo[1]), alto = 24 + largo * 0.3;
                const quieto = 'translate(' + f(yo[0]) + 'px, ' + f(yo[1]) + 'px) rotate(' + f(Math.atan2(b[1] - yo[1], b[0] - yo[0]) / RAD) + 'deg)';
                defs += '<clipPath id="cmRuta' + numero + '"><rect class="cm-revela" data-quieto="' + quieto + '" style="transform:' + quieto + '" x="-6" y="' + f(-alto) + '" width="' + f(largo + 12) + '" height="' + f(alto * 2) + '"/></clipPath>';
            }
            rutas += '<g class="cm-ruta-grupo" data-g="' + numero + '"' + (entrar && !reducido ? ' clip-path="url(#cmRuta' + numero + ')"' : '') + '>' +
                     '<path class="cm-ruta-halo" data-g="' + numero + '"/><path class="cm-ruta" data-g="' + numero + '"/></g>' +
                     '<circle class="cm-luz" data-g="' + numero + '" r="2.6"/>';
            g.indices.forEach((i, j) => {
                if (n > 1) rayos += '<line class="cm-rayo" data-i="' + i + '" style="--k:' + (k + j) + ';--r:1"/>';
            });
            if (n > 1) pines += '<span class="cm-nodo" data-g="' + numero + '" style="--k:' + numero + '"></span>';
            pines += '<span class="cm-ciudad" data-g="' + numero + '" style="--k:' + numero + '">' + escapar(nombre) + '</span>' +
                     '<span class="cm-km" data-g="' + numero + '" style="--k:' + numero + '">' + km.toLocaleString('es-CO') + ' km</span>';
            g.indices.forEach(i => { pines += pinDe(i, g); });
        });

        // El anillo de tu alcance (debajo de las rutas) y su etiqueta con los km
        const radio = actual.radio || 0;
        const anillo = radio ? '<g class="cm-alcance"><path class="cm-alcance-area"/><path class="cm-alcance-borde"/></g>' : '';
        if (radio) pines += '<span class="cm-alcance-km">' + radio + ' km</span>';
        recortes.innerHTML = defs;
        capaRutas.innerHTML = anillo + rayos + rutas;
        capaPines.innerHTML = pines;
        // Cada grupo guarda sus elementos: colocar() solo les cambia el lugar
        const delGrupo = g => {
            g.pines = g.indices.map(i => capaPines.querySelector('.cm-pin-vacante[data-i="' + i + '"]'));
            g.rayos = g.indices.map(i => capaRutas.querySelector('.cm-rayo[data-i="' + i + '"]'));
        };
        delGrupo(partes.aqui);
        partes.lejos.forEach(g => {
            delGrupo(g);
            const de = (capaDe, clase) => capaDe.querySelector(clase + '[data-g="' + g.numero + '"]');
            g.grupoRuta = de(capaRutas, '.cm-ruta-grupo'); g.ruta = de(capaRutas, '.cm-ruta'); g.halo = de(capaRutas, '.cm-ruta-halo');
            g.luz = de(capaRutas, '.cm-luz'); g.nodo = de(capaPines, '.cm-nodo'); g.nombre = de(capaPines, '.cm-ciudad'); g.km = de(capaPines, '.cm-km');
        });
        capa = { aqui: partes.aqui, lejos: partes.lejos, k: cam.k };
        // El tamano de cada etiqueta, medido una vez: colocar() decide en cada cuadro si choca con algo
        // haciendo cuentas, sin volver a medir (medir en cada cuadro obligaria a recalcular la pagina)
        const tam = el => el ? [el.offsetWidth, el.offsetHeight] : [0, 0];
        partes.lejos.forEach(g => { g.tamNombre = tam(g.nombre); g.tamKm = tam(g.km); });
        // La caja del nombre de tu punto, contada desde el centro del punto (que es donde cae "yo" en colocar)
        const rPunto = pinTu.querySelector('i').getBoundingClientRect(), rNombre = pinTu.querySelector('b').getBoundingClientRect();
        const pcx = rPunto.left + rPunto.width / 2, pcy = rPunto.top + rPunto.height / 2;
        capa.cajaTu = [rNombre.left - pcx, rNombre.top - pcy, rNombre.right - pcx, rNombre.bottom - pcy];
        if (radio) capa.alcance = {
            g: capaRutas.querySelector('.cm-alcance'), area: capaRutas.querySelector('.cm-alcance-area'),
            borde: capaRutas.querySelector('.cm-alcance-borde'), km: capaPines.querySelector('.cm-alcance-km'),
            puntos: circulo(vOrigen, radio, 96)
        };
        if (capa.alcance) capa.alcance.tam = tam(capa.alcance.km);
        lienzo.classList.toggle('cm-entra', !!entrar && !reducido);
        lienzo.classList.add('cm-listo');
        colocar();

        if (entrar && !reducido) {
            // Cada ruta se destapa desde tu punto hacia su ciudad; al terminar, el recorte sobra
            const todas = Array.from(recortes.querySelectorAll('.cm-revela')).map((r, i) => r.animate(
                [{ transform: r.dataset.quieto + ' scaleX(0)' }, { transform: r.dataset.quieto + ' scaleX(1)' }],
                { duration: 1100, delay: 150 + i * 160, easing: 'cubic-bezier(.16, 1, .3, 1)', fill: 'backwards' }));
            entradas = todas;
            if (todas.length) todas[todas.length - 1].finished.then(() => { if (entradas === todas) quitarRecortes(); }).catch(() => {});
            // El anillo crece desde tu punto, antes que las rutas: primero el alcance, despues lo que hay en el
            if (capa.alcance) {
                capa.alcance.g.animate([{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }],
                    { duration: 1100, easing: 'cubic-bezier(.16, 1, .3, 1)', fill: 'backwards' });
                capa.alcance.km.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 800, easing: 'ease-out', fill: 'backwards' });
            }
        }
        encenderLuces(entrar ? 1300 : 200);
        dibujarMini();
        actualizarControles();
        if (elegido !== null && encontradas[elegido]) { fijado = elegido; resaltar(null); }
    }

    /** Pone cada ruta, pin y nombre en su lugar para la camara de ahora (se llama en cada cuadro). */
    function colocar() {
        if (!capa || !vOrigen) return;
        const q0 = enPantalla(vOrigen, cam, m), yo = [q0[0], q0[1]], yoSeVe = enDisco(q0, m);
        const dentro = p => [entre(p[0], 14, m.w - 14), entre(p[1], 14, m.h - 14)];
        const nuevos = yoSeVe ? [[yo[0], yo[1] - 22, 26]] : [];
        capa.lejos.forEach(g => { const q = enPantalla(g.v, cam, m); g.p = [q[0], q[1]]; g.seVe = enDisco(q, m); });

        // El anillo de tu alcance: sus 96 puntos en la pantalla. Crece desde tu punto (transform-origin)
        if (capa.alcance) {
            const A0 = capa.alcance, q = A0.puntos.map(v => enPantalla(v, cam, m));
            // Se ve si tu punto se ve, todo el anillo queda de este lado y no es un puntito (desde Madrid,
            // con el planeta entero, 25 km miden 2 pixeles: ahi el anillo y su etiqueta sobran)
            const seVe = yoSeVe && q.every(p => p[2] > 0.02) && Math.hypot(q[0][0] - yo[0], q[0][1] - yo[1]) > 14;
            esconder(A0.g, !seVe); esconder(A0.km, !seVe);
            if (seVe) {
                const d = 'M' + q.map(p => f(p[0]) + ' ' + f(p[1])).join('L') + 'Z';
                A0.area.setAttribute('d', d); A0.borde.setAttribute('d', d);
                A0.g.style.transformOrigin = f(yo[0]) + 'px ' + f(yo[1]) + 'px';
            }
            A0.q = seVe ? q : null;      // su etiqueta se pone al final, cuando ya se sabe que hay alrededor
        }
        const pinesPuestos = [];         // donde quedo cada pin en este cuadro (para que las etiquetas no los tapen)

        // Las de tu ciudad: en abanico debajo de ti (arriba va tu nombre), de izquierda a derecha.
        // Si hay rutas hacia otras ciudades, el abanico se abre hacia el lado contrario para no cruzarlas
        const A = capa.aqui, n0 = A.indices.length;
        if (n0) {
            const paso = Math.min(50, 150 / Math.max(1, n0 - 1));
            let frente = 90;                          // grados en pantalla: 90 = hacia abajo
            if (capa.lejos.length) {
                const suma = capa.lejos.reduce((t, g) => { const d = Math.hypot(g.p[0] - yo[0], g.p[1] - yo[1]) || 1; return [t[0] + (g.p[0] - yo[0]) / d, t[1] + (g.p[1] - yo[1]) / d]; }, [0, 0]);
                if (Math.hypot(suma[0], suma[1]) > 0.2) {
                    frente = Math.atan2(-suma[1], -suma[0]) / RAD;
                    // Arriba esta tu nombre: si el lado contrario apunta hacia arriba, el abanico baja a ese
                    // costado (abajo a la derecha o abajo a la izquierda). Antes solo se corria 65 grados y el
                    // primer pin quedaba debajo de "Tu · Cartagena"
                    if (Math.sin(frente * RAD) < 0.25) frente = Math.cos(frente * RAD) >= 0 ? 25 : 155;
                }
            }
            A.indices.forEach((i, j) => {
                const a = (frente - (j - (n0 - 1) / 2) * paso) * RAD;
                const p = dentro([yo[0] + 46 * Math.cos(a), yo[1] + 46 * Math.sin(a)]), rayo = A.rayos[j];
                mover(A.pines[j], p); esconder(A.pines[j], !yoSeVe); esconder(rayo, !yoSeVe);
                if (yoSeVe) pinesPuestos.push(p);
                rayo.setAttribute('x1', f(yo[0])); rayo.setAttribute('y1', f(yo[1])); rayo.setAttribute('x2', f(p[0])); rayo.setAttribute('y2', f(p[1]));
            });
            if (yoSeVe) nuevos.push([yo[0] + 30 * Math.cos(frente * RAD), yo[1] + 30 * Math.sin(frente * RAD), 40]);
        }

        // Las de otras ciudades: una ruta por ciudad y un abanico de pines que se abre lejos de ti
        capa.lejos.forEach(g => {
            const b = g.p, n = g.indices.length, c = control(yo, b);
            const rumbo = Math.atan2(b[1] - yo[1], b[0] - yo[0]), largo = Math.hypot(b[0] - yo[0], b[1] - yo[1]);
            const conRuta = g.seVe && yoSeVe;
            g.conRuta = conRuta;
            esconder(g.grupoRuta, !conRuta);
            if (conRuta) {
                const d = 'M' + f(yo[0]) + ' ' + f(yo[1]) + 'Q' + f(c[0]) + ' ' + f(c[1]) + ' ' + f(b[0]) + ' ' + f(b[1]);
                g.ruta.setAttribute('d', d); g.halo.setAttribute('d', d);
            }
            g.indices.forEach((i, j) => {
                const a = rumbo + (j - (n - 1) / 2) * 46 * RAD;
                const p = n === 1 ? b : dentro([b[0] + 36 * Math.cos(a), b[1] + 36 * Math.sin(a)]), rayo = g.rayos[j];
                mover(g.pines[j], p); esconder(g.pines[j], !g.seVe);
                if (g.seVe) pinesPuestos.push(p);
                if (rayo) {
                    esconder(rayo, !g.seVe);
                    rayo.setAttribute('x1', f(b[0])); rayo.setAttribute('y1', f(b[1])); rayo.setAttribute('x2', f(p[0])); rayo.setAttribute('y2', f(p[1]));
                }
            });
            if (g.nodo) { mover(g.nodo, b); esconder(g.nodo, !g.seVe); }
            // El nombre de la ciudad, del lado contrario al abanico (o del otro si asi tapara tu punto)
            const abreArriba = Math.sin(rumbo) < 0, salto = n === 1 ? 18 : 12;
            let arriba = n > 1 && !abreArriba;
            if (yoSeVe && Math.abs(b[0] - yo[0]) < 70 && Math.abs((arriba ? b[1] - salto - 12 : b[1] + salto + 12) - (yo[1] - 14)) < 34) arriba = !arriba;
            const tn = g.tamNombre || [0, 0], w = tn[0], h = tn[1], x = b[0], y = b[1];
            // Lugares posibles para el nombre: el de siempre (del lado contrario al abanico), el otro lado,
            // a la derecha y a la izquierda del pin. colocar() se queda con el primero que no choque
            const abajo = { p: [x, y + salto], tf: ' translate(-50%, 0)', r: [x - w / 2, y + salto, x + w / 2, y + salto + h] };
            const encima = { p: [x, y - salto], tf: ' translate(-50%, -100%)', r: [x - w / 2, y - salto - h, x + w / 2, y - salto] };
            const derecha = { p: [x + 16, y], tf: ' translate(0, -50%)', r: [x + 16, y - h / 2, x + 16 + w, y + h / 2] };
            const izquierda = { p: [x - 16, y], tf: ' translate(-100%, -50%)', r: [x - 16 - w, y - h / 2, x - 16, y + h / 2] };
            g.lugaresNombre = g.seVe ? (arriba ? [encima, abajo] : [abajo, encima]).concat(Math.cos(rumbo) >= 0 ? [derecha, izquierda] : [izquierda, derecha]) : null;
            esconder(g.nombre, !g.seVe);
            // Los kilometros, en la mitad de la ruta (si la ruta es larga y cabe)
            const conKm = conRuta && largo > 60;
            esconder(g.km, !conKm);
            const mx = 0.25 * yo[0] + 0.5 * c[0] + 0.25 * b[0], my = Math.max(14, 0.25 * yo[1] + 0.5 * c[1] + 0.25 * b[1]);
            const tk = g.tamKm || [0, 0];
            // Lugares posibles para los km: la mitad de la ruta, o un poco antes o despues
            g.lugaresKm = conKm ? [0.5, 0.36, 0.64].map(t => {
                const u = 1 - t, px = u * u * yo[0] + 2 * u * t * c[0] + t * t * b[0], py = Math.max(14, u * u * yo[1] + 2 * u * t * c[1] + t * t * b[1]);
                return { p: [px, py], tf: ' translate(-50%, -50%)', r: [px - tk[0] / 2, py - tk[1] / 2, px + tk[0] / 2, py + tk[1] / 2] };
            }) : null;
            if (conKm) nuevos.push([mx, my, 22]);
            if (g.seVe) nuevos.push([b[0], b[1], 44]);
        });

        // Etiquetas que no se pisan. Los pines numerados y tu punto (con su nombre) siempre se ven; despues,
        // por orden de importancia, los nombres de las ciudades, los km de cada ruta y los km del anillo: cada
        // uno se esconde si su caja choca con algo ya puesto. Con el planeta a medio acercar (al arrastrarlo en
        // plena entrada) las etiquetas se montaban sobre los pines y no se leia nada
        const ocupado = pinesPuestos.map(p => [p[0] - 14, p[1] - 14, p[0] + 14, p[1] + 14]);
        if (yoSeVe) {
            ocupado.push([yo[0] - 9, yo[1] - 9, yo[0] + 9, yo[1] + 9]);
            if (capa.cajaTu) ocupado.push([yo[0] + capa.cajaTu[0], yo[1] + capa.cajaTu[1], yo[0] + capa.cajaTu[2], yo[1] + capa.cajaTu[3]]);
        }
        const choca = r => ocupado.some(o => r[0] < o[2] - 1 && r[2] > o[0] + 1 && r[1] < o[3] - 1 && r[3] > o[1] + 1);
        const cabe = r => r[0] >= 2 && r[1] >= 2 && r[2] <= m.w - 2 && r[3] <= m.h - 2;
        const poner = (el, lugares) => {
            if (!el || !lugares) return;
            const libre = lugares.find(l => cabe(l.r) && !choca(l.r));
            if (!libre) { esconder(el, true); return; }
            mover(el, libre.p, libre.tf);
            ocupado.push(libre.r);
        };
        capa.lejos.forEach(g => poner(g.nombre, g.lugaresNombre));
        capa.lejos.forEach(g => poner(g.km, g.lugaresKm));
        // Los km del anillo: en el primer punto del borde (de 8, empezando por el noreste) donde no choquen con nada
        if (capa.alcance) {
            const A0 = capa.alcance, t = A0.tam || [0, 0];
            let lugar = null;
            if (A0.q) {
                for (let j = 1; j < 9 && !lugar; j++) {
                    const c = dentro(A0.q[Math.round(((j % 8) / 8) * A0.q.length) % A0.q.length]);
                    const r = [c[0] - t[0] / 2, c[1] - t[1] / 2, c[0] + t[0] / 2, c[1] + t[1] / 2];
                    if (!choca(r)) lugar = { c: c, r: r };
                }
            }
            esconder(A0.km, !lugar);
            if (lugar) { mover(A0.km, lugar.c, ' translate(-50%, -50%)'); ocupado.push(lugar.r); nuevos.push([lugar.c[0], lugar.c[1], 24]); }
        }
        evitar = nuevos;
    }

    /** Por cada ruta viaja una luz: sale de ti, llega a la ciudad, se apaga y vuelve a salir. */
    function encenderLuces(espera) {
        apagarLuces();
        if (!capa || reducido || !vOrigen) return;
        const q0 = enPantalla(vOrigen, cam, m), yo = [q0[0], q0[1]];
        capa.lejos.forEach(g => {
            esconder(g.luz, !g.conRuta);
            if (!g.conRuta) return;
            const b = g.p, c = control(yo, b), cuadros = [], N = 20;
            g.luz.setAttribute('cx', f(yo[0])); g.luz.setAttribute('cy', f(yo[1]));
            for (let j = 0; j <= N; j++) {
                const t = j / N, u = 1 - t;
                const x = u * u * yo[0] + 2 * u * t * c[0] + t * t * b[0] - yo[0];
                const y = u * u * yo[1] + 2 * u * t * c[1] + t * t * b[1] - yo[1];
                cuadros.push({ offset: t * 0.7, transform: 'translate(' + f(x) + 'px, ' + f(y) + 'px)', opacity: t < 0.1 ? t * 10 : (t > 0.9 ? (1 - t) * 10 : 1) });
            }
            cuadros.push({ offset: 1, transform: cuadros[cuadros.length - 1].transform, opacity: 0 });
            const luz = g.luz.animate(cuadros, { duration: 2600, delay: espera + g.numero * 450, iterations: Infinity, easing: 'cubic-bezier(.45, 0, .55, 1)', fill: 'backwards' });
            if (!visible) luz.pause();
            luces.push(luz);
        });
    }

    /**
     * El recuadro redondo de la esquina: tu pais completo, resaltado, con tu punto. El mapa grande
     * muestra tu zona de cerca; este dice en que parte del pais queda (como el recuadro de un atlas).
     */
    function dibujarMini() {
        lonaMini.classList.remove('se-ve');
        if (!mundo || !vOrigen || !cam) return;
        const lado = lonaMini.clientWidth || 84, dpr = m.dpr;
        const pais = miPais >= 0 ? mundo.paises[miPais] : null;
        const mm = { w: lado, h: lado, cx: lado / 2, cy: lado / 2, R: lado / 2 - 1 };
        // Que el pais ocupe casi todo el recuadro (con un minimo de 8 grados para que se vean los vecinos)
        const abre = pais ? Math.min(1.2, Math.max(pais.r, 8 * RAD)) : 1.2;
        const camMini = { b: base(pais ? normal([pais.cv[0] + vOrigen[0] * 0.25, pais.cv[1] + vOrigen[1] * 0.25, pais.cv[2] + vOrigen[2] * 0.25]) : vOrigen),
                          k: Math.max(mm.R, mm.R * 0.84 / Math.sin(abre)) };
        // Si el mapa grande ya abarca casi lo mismo, el recuadro sobra
        if (m.R / cam.k > (mm.R / camMini.k) / 1.6) return;
        lonaMini.width = Math.round(lado * dpr); lonaMini.height = Math.round(lado * dpr);
        const lapiz = lonaMini.getContext('2d');
        lapiz.setTransform(dpr, 0, 0, dpr, 0, 0);
        dibujarGlobo(lapiz, camMini, mm, { mini: true });
        const q = enPantalla(vOrigen, camMini, mm);
        lapiz.fillStyle = '#5FD0DC';
        lapiz.strokeStyle = '#FFFFFF';
        lapiz.lineWidth = 1.5;
        lapiz.beginPath(); lapiz.arc(q[0], q[1], 3.4, 0, 2 * Math.PI); lapiz.fill(); lapiz.stroke();
        lonaMini.classList.add('se-ve');
    }

    /* ---------- 7. Mostrar un estado: la camara vuela y despues salen rutas y pines ---------- */
    let pendiente = false;      // hay algo por mostrar, pero el mapa todavia no se ve
    let entro = false;          // ya se hizo la entrada (del planeta entero a tu zona)
    let esperaMundo = 0;        // la entrada espera un momento a que lleguen los continentes

    /** Un vuelo de la camara de donde esta hasta "destino". */
    function volarA(destino, alTerminar) {
        const giro = angulo(cam.b.c, destino.b.c), zoom = Math.abs(Math.log(destino.k / cam.k));
        const largo = zoom > 1;     // del planeta entero a tu zona (o al reves)
        inercia = null;
        vuelo = {
            desde: cam, hasta: destino, t0: null,
            dura: entre(900 + 500 * zoom + 1400 * Math.min(1, giro), 900, 2800),
            gira: largo ? 0.8 : 1, espera: largo ? 0.12 : 0,
            salto: largo ? 0 : Math.min(0.9, giro * 2.2),     // entre dos ciudades lejanas se aleja un poco a mitad de camino
            alTerminar: alTerminar
        };
        pedirCuadro();
    }

    function mostrarEstado(animar) {
        if (!actual || !medir()) return;
        if (!cam) cam = camaraInicial();
        const origen = actual.origen;
        vOrigen = vec(origen.lat, origen.lon);
        buscarPais();
        const destino = camaraPara(origen, actual.encontradas, actual.radio);
        limpiarEncima();
        giroLibre = false; moviendo = false; inercia = null;
        lienzo.classList.remove('cm-moviendo');
        if (!animar || reducido) {
            vuelo = null;
            cam = destino;
            if (mundo) alfaTierra = 1;
            alfaRotulos = metaRotulos = 1;
            armar(false);
            pintar();
            return;
        }
        metaRotulos = 0;
        volarA(destino, () => { metaRotulos = 1; armar(true); });
    }

    /** Arranca cuando el mapa esta a la vista (y, la primera vez, cuando ya hay continentes). */
    function lanzar() {
        clearTimeout(esperaMundo); esperaMundo = 0;
        if (!actual) return;
        // El nombre de tu punto se pone de una vez, aunque el vuelo espere a que el mapa se vea
        pinTu.querySelector('b').textContent = actual.origen.porUbicacion ? 'Tu ubicación' : 'Tú · ' + actual.origen.ciudad.corto;
        if (reducido) { pendiente = false; mostrarEstado(false); return; }
        if (!visible) { pendiente = true; return; }
        if (!entro && !mundo && !mundoFallo) {
            // Sin continentes el planeta seria una bola azul: se espera un poco, girando
            pedirMundo();
            if (!medir()) return;
            if (!cam) cam = camaraInicial();
            giroLibre = true;
            pedirCuadro();
            esperaMundo = setTimeout(() => { esperaMundo = 0; mundoFallo = mundoFallo || !mundo; lanzar(); }, 2500);
            return;
        }
        pendiente = false;
        entro = true;
        mostrarEstado(true);
    }

    function texto(t) { if (sub) sub.textContent = t; }
    const mismoOrigen = o => actual && actual.origen.lat === o.lat && actual.origen.lon === o.lon;

    /* ---------- 8. Moverlo: arrastrar, botones y clic en los pines ---------- */
    /** La persona toma el control: se corta el vuelo, se apagan las luces y los pines siguen al planeta. */
    function empezarMovimiento() {
        if (vuelo) {
            const sinPines = !capa;
            vuelo = null;
            metaRotulos = 1;
            if (sinPines) armar(false);        // iba en plena entrada: los pines salen ya, sin esperar el final
        }
        giroLibre = false;
        moviendo = true;
        apagarLuces(); quitarRecortes();
        lienzo.classList.remove('cm-entra');
        lienzo.classList.add('cm-moviendo');
    }
    /** El planeta quedo quieto: si cambio el acercamiento, las vacantes se reparten de nuevo. */
    function asentar() {
        moviendo = false;
        lienzo.classList.remove('cm-moviendo');
        if (capa && Math.abs(Math.log(cam.k / capa.k)) > 0.03) { armar(false); pintar(); }
        // Quieto otra vez: se dibuja completo (mientras se movia, los municipios iban sin bordes de adentro)
        else { encenderLuces(200); dibujarMini(); pintar(); }
        actualizarControles();
    }
    function actualizarControles() {
        if (!cam || !m) return;
        controles.querySelector('[data-mapa="alejar"]').disabled = cam.k <= m.R * 1.01;
        controles.querySelector('[data-mapa="acercar"]').disabled = cam.k >= kMaximo() * 0.99;
    }
    function acercar(factor) {
        if (!cam || !m || !entro && !reducido) return;
        const k = entre(cam.k * factor, m.R, kMaximo());
        if (Math.abs(k - cam.k) < 0.5) return;
        empezarMovimiento();
        const destino = { b: cam.b, k: k };
        if (reducido) { cam = destino; pintar(); asentar(); return; }
        inercia = null;
        vuelo = { desde: cam, hasta: destino, t0: null, dura: 420, gira: 1, espera: 0, salto: 0, alTerminar: null };
        pedirCuadro();
    }
    function volver() {
        if (!cam || !m || !actual || !entro && !reducido) return;
        empezarMovimiento();
        const destino = camaraPara(actual.origen, actual.encontradas, actual.radio);
        if (reducido) { cam = destino; pintar(); asentar(); return; }
        volarA(destino, null);
    }
    controles.addEventListener('click', e => {
        const boton = e.target.closest('[data-mapa]');
        if (!boton || boton.disabled) return;
        if (boton.dataset.mapa === 'acercar') acercar(1.8);
        else if (boton.dataset.mapa === 'alejar') acercar(1 / 1.8);
        else volver();
    });

    lienzo.addEventListener('pointerdown', e => {
        if ((e.pointerType === 'mouse' && e.button !== 0) || e.target.closest('.cm-controles') || !cam || !m) return;
        if (!entro && !reducido) return;             // antes de la entrada todavia no hay nada que mover
        arrastre = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t: performance.now(), vx: 0, vy: 0,
                     movido: false, pin: e.target.closest('.cm-pin-vacante') };
    });
    lienzo.addEventListener('pointermove', e => {
        if (!arrastre || e.pointerId !== arrastre.id) return;
        if (!arrastre.movido) {
            if (Math.hypot(e.clientX - arrastre.x0, e.clientY - arrastre.y0) < 5) return;    // todavia puede ser un clic
            arrastre.movido = true;
            empezarMovimiento();
            inercia = null;
            try { lienzo.setPointerCapture(e.pointerId); } catch (error) { /* el puntero ya no existe */ }
            lienzo.classList.add('cm-agarrado');
        }
        const dx = e.clientX - arrastre.x, dy = e.clientY - arrastre.y, ahora = performance.now(), dt = Math.max(1, ahora - arrastre.t);
        girar(dx, dy);
        // La velocidad se promedia un poco: asi el empujon final no depende de un solo movimiento
        arrastre.vx = arrastre.vx * 0.6 + (dx / dt) * 0.4; arrastre.vy = arrastre.vy * 0.6 + (dy / dt) * 0.4;
        arrastre.x = e.clientX; arrastre.y = e.clientY; arrastre.t = ahora;
        pedirCuadro();
    });
    function soltar(e) {
        if (!arrastre || e.pointerId !== arrastre.id) return;
        const a = arrastre;
        arrastre = null;
        lienzo.classList.remove('cm-agarrado');
        if (!a.movido) {                               // fue un clic: en un pin lo elige; en el mapa, suelta la eleccion
            if (e.type === 'pointerup') fijar(a.pin ? +a.pin.dataset.i : null);
            return;
        }
        const quieto = performance.now() - a.t > 90;   // se detuvo antes de soltar: sin empujon
        if (!reducido && !quieto && Math.hypot(a.vx, a.vy) > 0.05) inercia = { vx: entre(a.vx, -2.5, 2.5), vy: entre(a.vy, -2.5, 2.5) };
        pedirCuadro();
    }
    lienzo.addEventListener('pointerup', soltar);
    lienzo.addEventListener('pointercancel', soltar);

    // ---- Lo que usa vacantes-cerca.js ----
    window.SkillMatchMapaCerca = {
        cargando(origen) {
            texto('Buscando vacantes cerca…');
            if (mismoOrigen(origen)) return;
            actual = { tipo: 'cargando', origen: origen, encontradas: [] };
            lanzar();
        },
        mostrar(origen, encontradas, extra) {
            extra = extra || {};
            const ciudades = new Map();
            encontradas.forEach(e => ciudades.set(e.ciudad.clave, e.ciudad));
            const unicas = Array.from(ciudades.values());
            const n = encontradas.length, vac = n === 1 ? '1 vacante' : n + ' vacantes';
            const km = Math.max(1, Math.round(Math.max.apply(null, unicas.map(c => C.distanciaKm(origen.lat, origen.lon, c.lat, c.lon)))));
            const totales = extra.totales || null;
            const total = totales ? Object.keys(totales).reduce((t, c) => t + totales[c], 0) : 0;
            if (extra.radio && total) texto(total.toLocaleString('es-CO') + (total === 1 ? ' vacante' : ' vacantes') + ' a ' + extra.radio + ' km o menos');
            else if (unicas.length === 1 && unicas[0].clave === origen.ciudad.clave) texto(vac + ' en ' + origen.ciudad.corto);
            else if (unicas.length === 1) texto(vac + ' en ' + unicas[0].corto + ' · a ' + km + ' km');
            else texto(vac + ' en ' + unicas.length + ' ciudades · la más lejos a ' + km + ' km');
            actual = { tipo: 'vacantes', origen: origen, encontradas: encontradas, radio: extra.radio || 0, totales: totales };
            lanzar();
        },
        vacio(origen) { texto('Nada cerca por ahora'); actual = { tipo: 'vacio', origen: origen, encontradas: [] }; lanzar(); },
        error(origen) { texto('No pudimos cargar las vacantes'); actual = { tipo: 'error', origen: origen, encontradas: [] }; lanzar(); },
        /** Ilumina la vacante i (su pin, su ruta y su tarjeta); null apaga. */
        resaltar(i) { resaltar(i); },
        /** Para las pruebas: como quedo la camara y en que pais te encontro. */
        estado() {
            if (!cam || !m) return null;
            const c = cam.b.c;
            return {
                listo: !!capa, volando: !!vuelo, moviendo: moviendo || !!arrastre || !!inercia, conMundo: !!mundo,
                lat: Math.asin(entre(c[2], -1, 1)) / RAD, lon: Math.atan2(c[1], c[0]) / RAD,
                zoom: cam.k / m.R, pais: mundo && miPais >= 0 ? mundo.paises[miPais].n : '', elegida: fijado,
                municipios: municipios ? municipios.paises.length : 0,
                municipioDeCartagena: municipios && municipioDe.cartagena !== undefined ? municipios.paises[municipioDe.cartagena].n : ''
            };
        }
    };

    // ---- Tarjeta <-> pin con el mismo numero, y la ruta de su ciudad ----
    /** Ilumina la vacante i; sin i, la que este elegida con un clic (o ninguna). */
    function resaltar(i) {
        if (i === null || i === undefined) i = fijado;
        const clave = i === null || i === undefined ? null : String(i);
        const grupo = clave === null || !capa ? null : [capa.aqui].concat(capa.lejos).find(g => g.indices.indexOf(+clave) >= 0);
        const ruta = grupo && !grupo.aqui ? String(grupo.numero) : null;
        lienzo.classList.toggle('cm-hay-resaltado', clave !== null);
        capaPines.querySelectorAll('.cm-pin-vacante').forEach(p => p.classList.toggle('es-resaltado', p.dataset.i === clave));
        capaPines.querySelectorAll('.cm-km').forEach(p => p.classList.toggle('es-resaltado', p.dataset.g === ruta));
        capaRutas.querySelectorAll('.cm-ruta, .cm-ruta-halo').forEach(r => r.classList.toggle('es-resaltada', r.dataset.g === ruta));
        capaRutas.querySelectorAll('.cm-rayo').forEach(r => r.classList.toggle('es-resaltado', r.dataset.i === clave));
        if (lista) lista.querySelectorAll('.cerca-tarjeta').forEach(t => t.classList.toggle('es-resaltada', t.dataset.i === clave));
        document.querySelectorAll('#cercaCiudades .cerca-ciudad-fila').forEach(t => t.classList.toggle('es-resaltada', t.dataset.i === clave));
        // Su municipio, en naranja (se redibuja solo si cambio y el planeta esta quieto: si se mueve, ya se redibuja)
        const e = clave !== null && actual && actual.encontradas ? actual.encontradas[+clave] : null;
        const nuevo = e && municipioDe[e.ciudad.clave] !== undefined ? municipioDe[e.ciudad.clave] : -1;
        if (nuevo !== municipioResaltado) {
            municipioResaltado = nuevo;
            if (municipios && cam && m && !vuelo && !moviendo) dibujarGlobo(ctx, cam, m);
        }
    }
    /** Clic en un pin: su vacante queda elegida y su tarjeta se acerca a la vista. */
    function fijar(i) {
        fijado = i;
        resaltar(null);
        const tarjeta = i !== null && lista ? lista.querySelector('.cerca-tarjeta[data-i="' + i + '"]') : null;
        if (tarjeta && tarjeta.scrollIntoView) tarjeta.scrollIntoView({ block: 'nearest', behavior: reducido ? 'auto' : 'smooth' });
    }
    const indiceDe = el => { const t = el && el.closest && el.closest('.cerca-tarjeta'); return t && t.dataset.i !== undefined ? +t.dataset.i : null; };
    if (lista) {
        lista.addEventListener('pointerover', e => { const i = indiceDe(e.target); if (i !== null) resaltar(i); });
        lista.addEventListener('pointerleave', () => resaltar(null));
        lista.addEventListener('focusin', e => resaltar(indiceDe(e.target)));
        lista.addEventListener('focusout', () => resaltar(null));
    }
    capaPines.addEventListener('pointerover', e => { const p = e.target.closest('.cm-pin-vacante'); if (p && !arrastre) resaltar(+p.dataset.i); });
    capaPines.addEventListener('pointerout', e => { const p = e.target.closest('.cm-pin-vacante'); if (p && !p.contains(e.relatedTarget)) resaltar(null); });

    // ---- Primer dibujo: el planeta entero, quieto, esperando a que lo vean ----
    if (medir()) { cam = camaraInicial(); pintar(); }

    // ---- Solo se mueve a la vista ----
    if ('IntersectionObserver' in window) {
        // Los continentes se piden un poco antes de que la seccion llegue a la pantalla
        const cerca = new IntersectionObserver(entradasIO => {
            if (entradasIO[0].isIntersecting) { cerca.disconnect(); pedirMundo(); }
        }, { rootMargin: '900px 0px' });
        cerca.observe(panel);
        // Y si la pagina queda libre antes (lo normal), se preparan en ese rato: procesar el mundo (300 KB)
        // justo al acercarse trababa el scroll 77 ms. En un momento libre no lo nota nadie
        if ('requestIdleCallback' in window) {
            const preparar = () => requestIdleCallback(() => { cerca.disconnect(); pedirMundo(); }, { timeout: 4000 });
            if (document.readyState === 'complete') preparar(); else addEventListener('load', preparar, { once: true });
        }
        new IntersectionObserver(entradasIO => {
            visible = entradasIO[0].isIntersecting;
            panel.classList.toggle('cm-quieto', !visible);
            luces.forEach(a => { if (visible) a.play(); else a.pause(); });
            if (visible && (pendiente || (actual && !entro))) lanzar();
        }, { threshold: 0.3 }).observe(panel);
    } else {
        visible = true;
        pedirMundo();
    }
    // Si el lienzo cambia de tamano (otro ancho de pantalla, o las tarjetas cambian de alto), el planeta
    // se reajusta en su sitio: misma vista, otro radio. Un vuelo en curso sigue, sin cortarse
    function reajustar() {
        const radio = m ? m.R : 0;
        if (!medir()) return;
        if (!cam) { cam = camaraInicial(); pintar(); return; }
        const escala = radio ? m.R / radio : 1;
        cam = { b: cam.b, k: cam.k * escala };
        if (vuelo) {
            vuelo.desde = { b: vuelo.desde.b, k: vuelo.desde.k * escala };
            vuelo.hasta = { b: vuelo.hasta.b, k: vuelo.hasta.k * escala };
            pedirCuadro();
            return;
        }
        if (capa) armar(false);
        pintar();
    }
    if ('ResizeObserver' in window) {
        let ancho = lienzo.clientWidth, alto = lienzo.clientHeight, turno = 0;
        new ResizeObserver(() => {
            const w = lienzo.clientWidth, h = lienzo.clientHeight;
            if (Math.abs(w - ancho) < 2 && Math.abs(h - alto) < 2) return;
            ancho = w; alto = h;
            clearTimeout(turno);
            turno = setTimeout(reajustar, 60);
        }).observe(lienzo);
    }
})();
