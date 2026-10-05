// login-personajes.js
// Personajes del login: las dos figuras del logo (azul y turquesa) y la
// chispa naranja que las une, dibujadas en SVG propio (sin librerias).
//  - Caen desde arriba uno tras otro: se estiran al caer, se aplastan al
//    tocar el piso, rebotan y se acomodan (la cabeza sigue de largo y vuelve).
//  - Siguen al mouse con las pupilas, la cara, la cabeza y el cuerpo; cada
//    parte llega a su ritmo, por eso el movimiento se ve fluido y no rigido.
//  - Miran el correo mientras se escribe; cierran los ojos en la contrasena
//    y con "mostrar contrasena" la chispa naranja se acerca a espiar.
//  - Miran el boton mientras carga, niegan si hay error y saltan si entra.
//  - En el login de empresas (data-variante="empresa") van de oficina:
//    corbata, corbatin, carnet y lentes. La corbata y el carnet son
//    pendulos: cuelgan, el aire los levanta al caer y se mecen al frenar.
// El movimiento sale de un motor de fisica pequeno: resortes (lo mismo que
// usan Framer Motion o React Spring) y gravedad, calculados en cada cuadro.
// No toca auth.js: solo observa el boton y los mensajes que auth.js ya usa.
// Reglas del proyecto: solo se anima transform y opacity. Con pantallas
// tactiles no se sigue al mouse; con prefers-reduced-motion tampoco hay
// caida, saltos ni respiracion: solo cambios de cara cortos y suaves.

(function () {
    'use strict';

    const contenedor = document.querySelector('.login-personajes');
    const email = document.getElementById('email');
    const clave = document.getElementById('password');
    if (!contenedor || !email || !clave) return;

    // Modo demo: con ?animar en la direccion (login-usuario.html?animar) se ve
    // todo el movimiento aunque el equipo pida movimiento reducido, y queda
    // recordado en este navegador (igual que ?api= en api-config.js).
    // ?animar=0 lo apaga. Sin modo demo se respeta el ajuste de cada visitante.
    function modoDemo() {
        const valor = new URLSearchParams(location.search).get('animar');
        try {
            if (valor === '0') localStorage.removeItem('skillmatch_animar');
            else if (valor !== null) localStorage.setItem('skillmatch_animar', '1');
            return localStorage.getItem('skillmatch_animar') === '1';
        } catch (e) {
            return valor !== null && valor !== '0';
        }
    }
    const demo = modoDemo();
    const reducido = !demo && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const conMouse = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const empresa = contenedor.dataset.variante === 'empresa';
    function ahora() { return performance.now() / 1000; }

    /* ---------- 1. Dibujo ---------- */

    // Lienzo de 360 x 280 con el piso en y = 262. "pie" es el punto de apoyo
    // (desde ahi se inclinan y se aplastan), "ancho" la mitad del cuerpo,
    // "salida" la altura desde la que caen y "retraso" cuanto esperan.
    const PISO = 262;
    const PERSONAJES = [
        { id: 'azul', pie: 118, ancho: 48, salida: -470, retraso: 0, fase: 0,
          cuerpo: 'M70,262 V168 A48,48 0 0 1 166,168 V262 Z',
          cabeza: [118, 72, 38], ojos: [[104, 70, 9], [132, 70, 9]], boca: [118, 92, 16] },
        { id: 'turquesa', pie: 244, ancho: 44, salida: -430, retraso: 0.16, fase: 2.1,
          cuerpo: 'M200,262 V190 A44,44 0 0 1 288,190 V262 Z',
          cabeza: [244, 98, 35], ojos: [[231, 96, 8.5], [257, 96, 8.5]], boca: [244, 117, 15] },
        // La chispa no tiene cabeza aparte: su cara se mueve sobre la cupula
        { id: 'naranja', pie: 180, ancho: 72, salida: -400, retraso: 0.34, fase: 4.2,
          cuerpo: 'M108,262 A72,72 0 0 1 252,262 Z',
          cabeza: null, ojos: [[162, 224, 10], [198, 224, 10]], boca: [180, 245, 18] }
    ];

    function origen(x, y) { return `transform-origin:${x}px ${y}px`; }

    // Un ojo: el blanco y la pupila se aplastan juntos para parpadear; las dos
    // lineas de ojo cerrado (tranquilo y feliz) aparecen cuando se cierra
    function ojo(x, y, r) {
        const p = r * 0.46, l = r * 0.75;
        return `<g class="lp-ojo-caja">
            <g class="lp-ojo" style="${origen(x, y)}">
                <circle class="lp-blanco" cx="${x}" cy="${y}" r="${r}"/>
                <g class="lp-pupila"><circle cx="${x}" cy="${y}" r="${p}"/><circle class="lp-brillo" cx="${x + p * 0.35}" cy="${y - p * 0.35}" r="${p * 0.32}"/></g>
            </g>
            <path class="lp-linea lp-linea-calma" d="M${x - l},${y} Q${x},${y + r * 0.7} ${x + l},${y}"/>
            <path class="lp-linea lp-linea-feliz" d="M${x - l},${y + 2} Q${x},${y - r * 0.7} ${x + l},${y + 2}"/>
        </g>`;
    }

    // Tres bocas que crecen o se encogen (scale): la sonrisa (volteada queda
    // triste), la "o" de sorpresa y la risa abierta
    function boca(x, y, w) {
        const m = w / 2;
        return `<path class="lp-boca lp-boca-sonrisa" style="${origen(x, y + w * 0.125)}" d="M${x - m},${y} Q${x},${y + w * 0.5} ${x + m},${y}"/>
            <ellipse class="lp-boca lp-boca-o" style="${origen(x, y + w * 0.15)}" cx="${x}" cy="${y + w * 0.15}" rx="${w * 0.2}" ry="${w * 0.26}"/>
            <path class="lp-boca lp-boca-risa" style="${origen(x, y + w * 0.2)}" d="M${x - m},${y - 1} Q${x},${y + w * 0.8} ${x + m},${y - 1}Z"/>`;
    }

    // Ropa de oficina, solo en el login de empresas. "cuerpo" va sobre el
    // cuerpo y "cara" se mueve con la cara (los lentes siguen a los ojos).
    // Lo que cuelga es un pendulo: "pivote" es el punto del que cuelga,
    // "largo" la distancia hasta su centro (mas largo = se mece mas lento),
    // "aire" cuanto lo levanta el viento al caer, "sesgo" hacia que hombro
    // se va, "amort" cuanto tarda en quedarse quieto y "pecho" cuanto lo
    // sujeta el cuerpo (la corbata va pegada; el carnet cuelga libre).
    // Las cintas del carnet van de [x, y] en el cuello a [x, y] en la tarjeta.
    const ROPA = {
        azul: {
            cuerpo: `<path class="lp-cuello" d="M104,123 L118,142 L132,123 Q118,129 104,123 Z"/>
                <g class="lp-corbata">
                    <g class="lp-colgante" style="${origen(118, 131)}">
                        <path class="lp-traje" d="M115,131 L121,131 L126,184 L118,195 L110,184 Z"/>
                        <path class="lp-raya" d="M115.5,147 L121.5,153 M114.5,163 L123,171.5"/>
                    </g>
                    <path class="lp-traje" d="M112,123 L124,123 L121,133 L115,133 Z"/>
                </g>`,
            colgante: { pivote: [118, 131], largo: 32, aire: 0.005, sesgo: -0.35, amort: 6, pecho: 40 }
        },
        turquesa: {
            cuerpo: `<line class="lp-cinta" x1="0" y1="0" x2="0" y2="1" style="${origen(0, 0)}"/>
                <line class="lp-cinta" x1="0" y1="0" x2="0" y2="1" style="${origen(0, 0)}"/>
                <g class="lp-colgante" style="${origen(244, 151)}">
                    <rect class="lp-carnet" x="235" y="190" width="18" height="23" rx="2.5"/>
                    <rect class="lp-carnet-banda" x="238" y="194" width="12" height="4" rx="1"/>
                    <path class="lp-carnet-texto" d="M238,203 H250 M238,207 H246"/>
                </g>
                <path class="lp-traje" d="M232,147 L244,153 L232,159 Z M256,147 L244,153 L256,159 Z"/>
                <circle class="lp-nudo" cx="244" cy="153" r="3.6"/>`,
            colgante: { pivote: [244, 151], largo: 50, aire: 0.006, sesgo: 0.3, amort: 4.5, pecho: 0,
                        cintas: [[236, 152, 240, 192], [252, 152, 248, 192]] }
        },
        naranja: {
            cara: `<g class="lp-lentes"><circle cx="162" cy="224" r="14"/><circle cx="198" cy="224" r="14"/><path d="M176,222 Q180,219 184,222"/></g>`
        }
    };

    function personaje(d) {
        const ropa = (empresa && ROPA[d.id]) || {};
        const craneo = d.cabeza ? `<circle class="lp-color" cx="${d.cabeza[0]}" cy="${d.cabeza[1]}" r="${d.cabeza[2]}"/>` : '';
        const cara = d.ojos.map(function (o) { return ojo(o[0], o[1], o[2]); }).join('') + boca(d.boca[0], d.boca[1], d.boca[2]) + (ropa.cara || '');
        return `<g class="lp-pj" data-pj="${d.id}" style="${origen(d.pie, PISO)}">
            <path class="lp-color" d="${d.cuerpo}"/>
            ${ropa.cuerpo || ''}
            <g class="lp-cabeza">${craneo}<g class="lp-cara">${cara}</g></g>
        </g>`;
    }

    // Sombra de cada uno: chica y tenue en el aire, completa en el piso
    function sombra(d) {
        return `<ellipse class="lp-sombra" data-pj="${d.id}" cx="${d.pie}" cy="${PISO + 2}" rx="${d.ancho * 0.95}" ry="7" style="${origen(d.pie, PISO + 2)}"/>`;
    }

    // Polvo al caer: a cada lado, tres particulas de distinto tamano que salen
    // hacia afuera (d), suben un poco (s) y arrancan con un leve retraso (t0)
    const NUBES = [{ d: 16, s: 10, r: 5, t0: 0 }, { d: 27, s: 5, r: 4, t0: 0.03 }, { d: 34, s: 14, r: 3, t0: 0.06 }];
    function polvo(d) {
        return [-1, 1].map(function (lado) {
            const x = d.pie + lado * (d.ancho - 4), y = PISO - 3;
            return NUBES.map(function (n) {
                return `<circle class="lp-polvo" data-pj="${d.id}" cx="${x}" cy="${y}" r="${n.r}" style="${origen(x, y)}"/>`;
            }).join('');
        }).join('');
    }

    contenedor.innerHTML = `<svg class="lp" viewBox="0 0 360 280" focusable="false">
        ${PERSONAJES.map(sombra).join('')}
        ${PERSONAJES.map(personaje).join('')}
        ${PERSONAJES.map(polvo).join('')}
    </svg>`;
    const svg = contenedor.querySelector('.lp');

    /* ---------- 2. Boton para mostrar la contrasena ---------- */

    // El campo se envuelve para poner el boton encima; su id no cambia,
    // asi que auth.js lo sigue encontrando igual.
    const envoltura = document.createElement('div');
    envoltura.className = 'campo-clave';
    clave.parentNode.insertBefore(envoltura, clave);
    envoltura.appendChild(clave);

    const ver = document.createElement('button');
    ver.type = 'button';
    ver.className = 'campo-clave-ver';
    ver.setAttribute('aria-label', 'Mostrar contraseña');
    ver.setAttribute('aria-pressed', 'false');
    ver.setAttribute('aria-controls', clave.id);
    ver.dataset.tooltip = 'Mostrar contraseña';
    ver.innerHTML = '<i data-ico="eye"></i><i data-ico="eye-off"></i>';
    envoltura.appendChild(ver);

    function mostrarClave(si) {
        clave.type = si ? 'text' : 'password';
        ver.setAttribute('aria-pressed', String(si));
        ver.dataset.tooltip = si ? 'Ocultar contraseña' : 'Mostrar contraseña';
    }

    // Con el mouse, el foco no sale del campo al tocar el boton
    ver.addEventListener('mousedown', function (e) { e.preventDefault(); });
    ver.addEventListener('click', function () {
        mostrarClave(clave.type === 'password');
        clave.focus();
        const fin = clave.value.length;
        clave.setSelectionRange(fin, fin);
        actualizar();
    });
    // Al enviar se vuelve a ocultar, para que el navegador la trate como contrasena
    if (clave.form) clave.form.addEventListener('submit', function () { mostrarClave(false); actualizar(); });

    /* ---------- 3. Motor de movimiento: resortes y gravedad ---------- */

    // Un resorte lleva un valor hacia su meta con velocidad propia. Si la meta
    // cambia a mitad de camino, sigue de forma continua: nunca salta.
    // [rigidez, amortiguacion]: mas rigidez = mas rapido; menos amortiguacion =
    // mas rebote. Con movimiento reducido todos son rapidos y sin rebote.
    const TIPOS = reducido
        ? { pupila: [320, 36], cara: [320, 36], cabeza: [320, 36], cuerpo: [320, 36],
            ojo: [500, 45], gesto: [400, 40], aplaste: [400, 40], hundir: [400, 40], estira: [900, 60] }
        : { pupila: [240, 21], cara: [150, 19], cabeza: [95, 15], cuerpo: [55, 11],
            ojo: [520, 40], gesto: [300, 19], aplaste: [430, 15], hundir: [260, 11], estira: [1600, 75] };

    function resorte(tipo, valor) {
        return { k: TIPOS[tipo][0], c: TIPOS[tipo][1], x: valor, v: 0, meta: valor };
    }

    // Se avanza en pasos cortos (1/240 s): asi es estable aunque sea muy rigido
    function avanzar(r, dt) {
        for (let t = dt; t > 1e-6; t -= 1 / 240) {
            const h = Math.min(t, 1 / 240);
            r.v += (-r.k * (r.x - r.meta) - r.c * r.v) * h;
            r.x += r.v * h;
        }
    }
    function quieto(r) { return Math.abs(r.x - r.meta) < 0.001 && Math.abs(r.v) < 0.01; }

    const GRAVEDAD = 2300; // unidades del dibujo por segundo, al cuadrado
    const REBOTE = 0.3;    // al tocar el piso conserva el 30 % de la velocidad

    const pjs = PERSONAJES.map(function (d) {
        const g = svg.querySelector(`.lp-pj[data-pj="${d.id}"]`);
        const p = {
            d: d,
            g: g,
            cabeza: g.querySelector('.lp-cabeza'),
            cara: g.querySelector('.lp-cara'),
            sombra: svg.querySelector(`.lp-sombra[data-pj="${d.id}"]`),
            polvo: svg.querySelectorAll(`.lp-polvo[data-pj="${d.id}"]`),
            sonrisa: g.querySelector('.lp-boca-sonrisa'),
            bocaO: g.querySelector('.lp-boca-o'),
            risa: g.querySelector('.lp-boca-risa'),
            ojos: Array.from(g.querySelectorAll('.lp-ojo-caja')).map(function (caja) {
                return {
                    g: caja.querySelector('.lp-ojo'),
                    pupila: caja.querySelector('.lp-pupila'),
                    calma: caja.querySelector('.lp-linea-calma'),
                    feliz: caja.querySelector('.lp-linea-feliz'),
                    cierre: resorte('ojo', 0) // 0 abierto, 1 cerrado, negativo = muy abierto
                };
            }),
            // La mirada va por capas, cada una con su resorte: las pupilas
            // llegan primero, luego la cara, la cabeza y al final el cuerpo
            px: resorte('pupila', 0), py: resorte('pupila', 0),
            fx: resorte('cara', 0), fy: resorte('cara', 0),
            hx: resorte('cabeza', 0), hy: resorte('cabeza', 0),
            cuerpo: resorte('cuerpo', 0),
            aplaste: resorte('aplaste', 1), // 1 normal; menos = aplastado, mas = estirado
            estira: resorte('estira', 0),   // estiramiento por la velocidad de caida
            hundir: resorte('hundir', 0),   // la cabeza se hunde al caer y vuelve
            alegre: resorte('ojo', 0),      // ojos cerrados: 0 tranquilos, 1 felices
            bSonrisa: resorte('gesto', 1), bGiro: resorte('gesto', 1),
            bO: resorte('gesto', 0), bRisa: resorte('gesto', 0),
            y: 0, vy: 0, enAire: false, cayendo: false, inicio: 0, // caida y saltos
            apoyo: -1, rebote: 0,                                   // instante en el piso tras un golpe
            cx: 0, cy: 0,                                           // centro de la cara en pantalla
            parpadeo: -1, sacudida: -1, salto: -1, polvoDesde: -1,  // momentos de cada reaccion
            corbata: g.querySelector('.lp-corbata'),                // solo en el login de empresas
            colgante: null, cintas: [], ajuste: -1, ajustando: ''
        };
        p.resortes = [p.px, p.py, p.fx, p.fy, p.hx, p.hy, p.cuerpo, p.aplaste, p.estira, p.hundir,
                      p.alegre, p.bSonrisa, p.bGiro, p.bO, p.bRisa]
            .concat(p.ojos.map(function (o) { return o.cierre; }));
        // Pendulo de la corbata o del carnet: angulo (th, 0 = colgando derecho)
        // y velocidad de giro (w), mas lo que hace falta para medir su apoyo
        const ropa = empresa && ROPA[d.id];
        if (ropa && ropa.colgante) {
            p.colgante = Object.assign({ el: g.querySelector('.lp-colgante'), th: 0, w: 0, antes: null, vel: null }, ropa.colgante);
            p.cintas = Array.from(g.querySelectorAll('.lp-cinta'));
        }
        return p;
    });

    // Antes de caer esperan arriba, fuera de la vista: el panel recorta lo que sobresale
    if (!reducido) {
        pjs.forEach(function (p) {
            p.y = p.d.salida;
            p.enAire = true;
            p.cayendo = true;
            p.inicio = Infinity;
        });
    }

    function iniciarCaida() {
        const t = ahora() + 0.25;
        pjs.forEach(function (p) { if (p.cayendo) p.inicio = t + p.d.retraso; });
        despertar();
    }

    // Gravedad, choque con el piso y rebote
    function fisica(p, t, dt) {
        // Recien caido se queda apoyado un instante mientras se aplasta;
        // despues se impulsa (estirandose) y rebota, o se queda quieto
        if (p.apoyo >= 0) {
            if (t < p.apoyo) return;
            p.apoyo = -1;
            if (p.rebote > 90) {
                p.vy = -p.rebote;
                p.enAire = true;
                p.aplaste.v += p.rebote * 0.004;
            }
            return;
        }
        if (!p.enAire || t < p.inicio) return;
        p.vy += GRAVEDAD * dt;
        p.y += p.vy * dt;
        if (p.y < 0) return;
        // Toca el piso: el cuerpo se aplasta, la cabeza sigue de largo y los ojos tiemblan
        const golpe = p.vy;
        const blando = p.d.cabeza ? 1 : 1.3; // la chispa se aplasta mas
        p.y = 0;
        p.vy = 0;
        p.enAire = false;
        p.aplaste.v -= golpe * 0.003 * blando;
        p.hundir.v += golpe * 0.1;
        p.py.v += golpe * 0.004;
        if (golpe > 700) p.polvoDesde = t;
        p.rebote = golpe * REBOTE;
        p.apoyo = t + Math.min(0.09, golpe * 0.00006); // mas fuerte el golpe, mas tiempo apoyado
        if (p.cayendo) {
            // Primer contacto: deja de estar asustado, parpadea y sonrie
            p.cayendo = false;
            p.parpadeo = t + 0.12;
            if (p.corbata) arreglarCorbata(p);
            actualizar();
        }
    }

    // Al aterrizar, el de corbata se la arregla: la mira, le da un tiron
    // hacia arriba y queda satisfecho (con los ojos felices)
    function arreglarCorbata(p) {
        setTimeout(function () { p.ajustando = 'mirar'; actualizar(); }, 650);
        setTimeout(function () { p.ajuste = ahora(); p.colgante.w += 2; despertar(); }, 900);
        setTimeout(function () { p.ajustando = 'orgullo'; actualizar(); }, 1250);
        setTimeout(function () { p.ajustando = ''; actualizar(); }, 1900);
    }

    // Pasa un punto del dibujo del personaje al lienzo, con la caida, la
    // inclinacion y el aplaste que tiene el cuerpo en este cuadro
    function aMundo(tf, ox, oy, x, y) {
        const ax = (x - ox) * tf.sx, ay = (y - oy) * tf.sy;
        const c = Math.cos(tf.giro), s = Math.sin(tf.giro);
        return { x: ox + tf.dx + ax * c - ay * s, y: oy + tf.y + ax * s + ay * c };
    }

    // Pendulo: se mide cuanto cambio la velocidad del punto del que cuelga.
    // Si ese punto frena o arranca, lo que cuelga sigue de largo (inercia);
    // en caida libre flota y el aire lo empuja hacia arriba; la gravedad lo
    // devuelve abajo y la amortiguacion lo va calmando.
    function mecer(c, tf, d, dt) {
        const apoyo = aMundo(tf, d.pie, PISO, c.pivote[0], c.pivote[1]);
        if (!c.antes) { c.antes = apoyo; c.vel = { x: 0, y: 0 }; }
        const vx = (apoyo.x - c.antes.x) / dt, vy = (apoyo.y - c.antes.y) / dt;
        const dvx = vx - c.vel.x, dvy = vy - c.vel.y;
        c.antes = apoyo;
        c.vel = { x: vx, y: vy };
        const rapidez = Math.hypot(vx, vy);
        const viento = Math.atan2(vx, -vy) + c.sesgo; // el aire lo lleva al lado contrario del movimiento
        const pasos = 8, h = dt / pasos;
        for (let i = 0; i < pasos; i++) {
            c.w += (dvx * Math.cos(c.th) + dvy * Math.sin(c.th)) / c.largo / pasos;
            const giro = -GRAVEDAD * Math.sin(c.th) / c.largo
                + c.aire * rapidez * rapidez / c.largo * Math.sin(viento - c.th)
                - (c.amort + 0.004 * rapidez) * c.w
                - c.pecho * (c.th - tf.giro);
            c.w = limitar(c.w + giro * h, -14, 14);
            c.th += c.w * h;
        }
    }

    // Dibuja la corbata o el carnet en su angulo. El pendulo se calcula
    // respecto al piso, pero el cuerpo ya esta girado: se descuenta su giro.
    function colgar(p, tf, t, dt) {
        const c = p.colgante;
        if (!reducido && dt > 0) mecer(c, tf, p.d, dt);
        const local = reducido ? 0 : c.th - tf.giro;
        poner(c.el, `rotate(${n2(local * 180 / Math.PI)}deg)`);
        // Cada cinta va de su punto en el cuello a la esquina de la tarjeta
        // ya girada: se calcula su angulo y su largo, asi nunca se despegan
        const cos = Math.cos(local), sen = Math.sin(local);
        p.cintas.forEach(function (cinta, i) {
            const k = c.cintas[i];
            const ex = k[2] - c.pivote[0], ey = k[3] - c.pivote[1];
            const dx = c.pivote[0] + ex * cos - ey * sen - k[0];
            const dy = c.pivote[1] + ex * sen + ey * cos - k[1];
            poner(cinta, `translate(${n2(k[0])}px,${n2(k[1])}px) rotate(${n2(Math.atan2(-dx, dy) * 180 / Math.PI)}deg) scale(1,${n2(Math.hypot(dx, dy), 3)})`);
        });
        // Tiron de la corbata hacia arriba al arreglarsela
        if (p.corbata) {
            const s = p.ajuste >= 0 ? t - p.ajuste : -1;
            if (s >= 0.36) p.ajuste = -1;
            const tiron = s > 0 && s < 0.36 ? Math.sin(Math.PI * s / 0.36) : 0;
            poner(p.corbata, `translate(0px,${n2(-3 * tiron)}px)`);
        }
    }

    // Salto de alegria: se agacha un instante y sale disparado hacia arriba
    function reacciones(p, t) {
        if (p.salto < 0 || p.enAire || p.apoyo >= 0) return;
        if (t >= p.salto) {
            p.salto = -1;
            p.aplaste.meta = 1;
            p.aplaste.v += 3; // se estira al despegar
            p.vy = -680;
            p.enAire = true;
            p.inicio = 0;
        } else if (t >= p.salto - 0.1) {
            p.aplaste.meta = 0.86; // se agacha para tomar impulso
        }
    }

    function limitar(n, a, b) { return Math.min(b, Math.max(a, n)); }
    function suave(x) { return x * x * (3 - 2 * x); }
    function tramo(a, b, x) { return suave(limitar((x - a) / (b - a), 0, 1)); }

    // Parpadeo: cierra rapido (60 ms) y abre un poco mas lento (120 ms)
    function parpadeo(p, t) {
        if (p.parpadeo < 0) return 0;
        const s = t - p.parpadeo;
        if (s < 0) return 0;
        if (s < 0.06) return suave(s / 0.06);
        if (s < 0.18) return 1 - suave((s - 0.06) / 0.12);
        p.parpadeo = -1;
        return 0;
    }

    // "No" con la cabeza: un vaiven que se apaga solo en un segundo
    function sacudida(p, t) {
        if (p.sacudida < 0) return 0;
        const s = t - p.sacudida;
        if (s < 0) return 0;
        if (s > 1.1) { p.sacudida = -1; return 0; }
        return Math.exp(-s / 0.24) * Math.sin(s * 2 * Math.PI * 4.2);
    }

    // Se escribe en el DOM solo si el valor cambio (el navegador no repinta de mas)
    function n2(n, d) { return n.toFixed(d === undefined ? 2 : d); }
    function poner(el, valor) {
        if (el._lp !== valor) { el.style.transform = valor; el._lp = valor; }
    }
    function opacidad(el, valor) {
        const v = n2(valor);
        if (el._lpo !== v) { el.style.opacity = v; el._lpo = v; }
    }

    // Convierte los valores de la fisica en transform y opacity
    function pintar(p, t, dt) {
        const sinCabeza = !p.d.cabeza;
        // Respiracion: el cuerpo se estira y encoge apenas; la cabeza va un poco detras
        const fase = t * 1.85 + p.d.fase;
        const resp = reducido ? 0 : Math.sin(fase) * 0.016;
        const vaiven = reducido ? 0 : Math.sin(fase - 0.8) * -1.1;
        // Cayendo rapido se estira; al chocar, el resorte "aplaste" lo achata y lo ensancha
        const estira = limitar(p.estira.x, -0.05, 0.12);
        const ap = limitar(p.aplaste.x, 0.72, 1.25);
        const sy = ap * (1 + estira) * (1 + resp);
        const sx = (1 + (1 - ap) * 0.75) * (1 - estira * 0.45) * (1 - resp * 0.4);
        const no = sacudida(p, t);
        // Las figuras se inclinan; la chispa se desliza (girada hundiria una esquina)
        const giro = (sinCabeza ? p.cuerpo.x * 1.5 : p.cuerpo.x * 4) + no * 3;
        const dx = sinCabeza ? p.cuerpo.x * 6 : 0;
        poner(p.g, `translate(${n2(dx)}px,${n2(p.y)}px) rotate(${n2(giro)}deg) scale(${n2(sx, 3)},${n2(sy, 3)})`);
        if (p.colgante) colgar(p, { dx: dx, y: p.y, giro: giro * Math.PI / 180, sx: sx, sy: sy }, t, dt || 0);

        const hundir = limitar(p.hundir.x, -9, 9);
        poner(p.cabeza, `translate(${n2(p.hx.x * 4 + no * 5)}px,${n2(p.hy.x * 3 + hundir + vaiven)}px)`);
        poner(p.cara, `translate(${n2(p.fx.x * 6 + no * 2.5)}px,${n2(p.fy.x * 4 + hundir * 0.35)}px)`);

        // Las pupilas nunca se salen del ojo, aunque tiemblen al caer
        const largo = Math.hypot(p.px.x, p.py.x);
        const tope = largo > 1.05 ? 1.05 / largo : 1;
        const pupila = `translate(${n2(p.px.x * tope * 4)}px,${n2(p.py.x * tope * 4)}px)`;
        const parpado = parpadeo(p, t);
        const alegre = limitar(p.alegre.x, 0, 1);
        p.ojos.forEach(function (o) {
            const c = Math.max(limitar(o.cierre.x, -0.15, 1), parpado);
            poner(o.g, `scale(1,${n2(1 - c * 0.92, 3)})`);
            opacidad(o.g, 1 - tramo(0.8, 1, c));
            const linea = tramo(0.6, 1, c);
            opacidad(o.calma, linea * (1 - alegre));
            opacidad(o.feliz, linea * alegre);
            poner(o.pupila, pupila);
        });

        const tam = Math.max(0, p.bSonrisa.x);
        poner(p.sonrisa, `scale(${n2(tam, 3)},${n2(tam * limitar(p.bGiro.x, -1.1, 1.1), 3)})`);
        poner(p.bocaO, `scale(${n2(Math.max(0, p.bO.x), 3)})`);
        poner(p.risa, `scale(${n2(Math.max(0, p.bRisa.x), 3)})`);

        const cerca = 1 / (1 + Math.max(0, -p.y) / 150);
        poner(p.sombra, `scale(${n2(cerca * sx, 3)},${n2(cerca, 3)})`);
        opacidad(p.sombra, cerca);

        // Polvo: cada particula sale, frena y se desvanece en poco mas de medio segundo
        if (p.polvoDesde >= 0 && t - p.polvoDesde > 0.62) p.polvoDesde = -1;
        p.polvo.forEach(function (nube, i) {
            const n = NUBES[i % NUBES.length];
            const lado = i < NUBES.length ? -1 : 1;
            const a = p.polvoDesde >= 0 ? (t - p.polvoDesde - n.t0) / 0.55 : 0;
            if (a <= 0 || a >= 1) { poner(nube, 'scale(0)'); opacidad(nube, 0); return; }
            const e = 1 - Math.pow(1 - a, 3);
            poner(nube, `translate(${n2(lado * n.d * e)}px,${n2(-n.s * e)}px) scale(${n2(0.4 + 0.9 * e, 3)})`);
            opacidad(nube, Math.pow(1 - a, 1.6) * 0.5);
        });
    }

    // Un solo bucle para todo: corre mientras algo se mueve (o respiran en pantalla)
    let enMarcha = 0;
    let ultimo = 0;
    let enPantalla = true;

    function despertar() {
        if (enMarcha) return;
        ultimo = performance.now();
        enMarcha = requestAnimationFrame(cuadro);
    }

    function cuadro(marca) {
        // dt con tope: si la pestana estuvo oculta, nada da un salto al volver
        const dt = Math.min(Math.max(marca - ultimo, 0) / 1000, 1 / 30);
        ultimo = marca;
        const t = marca / 1000;
        let sigue = !reducido && enPantalla;
        pjs.forEach(function (p) {
            fisica(p, t, dt);
            reacciones(p, t);
            // Cuanto mas rapido cae, mas se estira (hasta un 10 %)
            p.estira.meta = Math.min(Math.abs(p.vy) * 0.00007, 0.1);
            p.resortes.forEach(function (r) { avanzar(r, dt); });
            pintar(p, t, dt);
            if ((p.enAire && p.inicio < Infinity) || p.apoyo >= 0 || p.salto >= 0 || p.sacudida >= 0 ||
                p.parpadeo >= 0 || p.polvoDesde >= 0 || p.ajuste >= 0 || !p.resortes.every(quieto) ||
                (p.colgante && Math.abs(p.colgante.w) > 0.01)) sigue = true;
        });
        enMarcha = sigue ? requestAnimationFrame(cuadro) : 0;
    }

    /* ---------- 4. Hacia donde mira cada personaje y que cara pone ---------- */

    const panel = email.closest('.auth-panel') || document.body;
    const boton = document.getElementById('login-btn') || (clave.form && clave.form.querySelector('[type="submit"]'));
    const msgError = document.getElementById('error-message');
    const msgExito = document.getElementById('success-message');

    let mouse = null;             // ultimo punto del mouse en la pantalla
    let mirada = { x: 0, y: 0 };  // mirada al azar cuando no hay mouse
    let enError = false;
    let estadoActual = '';
    let centrosViejos = true;

    function visible(el) {
        return !!el && el.style.display === 'block' && el.textContent.trim() !== '';
    }

    // Lo que pasa en la pagina decide el estado, de lo mas importante a lo menos
    function calcularEstado() {
        if (visible(msgExito)) return 'exito';
        if (enError) return 'error';
        if (boton && boton.disabled) return 'cargando';
        const activo = document.activeElement;
        if (activo === clave || activo === ver) return clave.type === 'password' ? 'cerrados' : 'espia';
        if (activo === email) return 'correo';
        if (activo && activo !== document.body && panel.contains(activo)) return 'foco';
        return 'libre';
    }

    function centro(el) {
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }

    // Centro de cada cara en la pantalla, calculado con el dibujo en reposo
    // (asi no importa si en ese momento estan cayendo o saltando)
    function medirCentros() {
        const r = svg.getBoundingClientRect();
        const ex = r.width / 360, ey = r.height / 280;
        pjs.forEach(function (p) {
            const o = p.d.ojos;
            p.cx = r.left + (o[0][0] + o[1][0]) / 2 * ex;
            p.cy = r.top + o[0][1] * ey;
        });
        centrosViejos = false;
    }

    // Punto donde termina lo escrito en un campo (se mide el texto con un canvas)
    const medidor = document.createElement('canvas').getContext('2d');
    function finDelTexto(input) {
        const r = input.getBoundingClientRect();
        const cs = getComputedStyle(input);
        medidor.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
        const texto = input.type === 'password' ? '•'.repeat(input.value.length) : input.value;
        const inicio = r.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft);
        const limite = r.right - parseFloat(cs.paddingRight);
        return { x: Math.min(inicio + medidor.measureText(texto).width - input.scrollLeft, limite), y: r.top + r.height / 2 };
    }

    // Direccion de -1 a 1 desde la cara hacia un punto; de cerca mira poco
    function hacia(p, punto) {
        const dx = punto.x - p.cx, dy = punto.y - p.cy;
        const d = Math.hypot(dx, dy);
        if (d < 1) return { x: 0, y: 0 };
        const fuerza = Math.min(1, d / 260);
        return { x: dx / d * fuerza, y: dy / d * fuerza };
    }

    // "No estoy mirando": al lado contrario de la contrasena, hacia arriba
    function aOtroLado(p) {
        return { x: hacia(p, centro(clave)).x > 0 ? -0.9 : 0.9, y: -0.45 };
    }

    function objetivo(p, estado) {
        if (p.cayendo) return { x: 0, y: -0.9 }; // miran hacia arriba mientras caen
        // Arreglandose la corbata (solo si nadie esta escribiendo): la mira y luego al frente
        if (p.ajustando && estado === 'libre') return p.ajustando === 'mirar' ? { x: 0, y: 1 } : { x: 0, y: -0.2 };
        switch (estado) {
            case 'correo':   return hacia(p, finDelTexto(email));
            case 'cerrados': return aOtroLado(p);
            case 'espia':
                if (p.d.cabeza) return aOtroLado(p);
                // La chispa se acerca de mas (k) para espiar lo escrito
                return Object.assign(hacia(p, finDelTexto(clave)), { k: 2.6 });
            case 'cargando': return hacia(p, centro(boton));
            case 'foco':     return hacia(p, centro(document.activeElement));
            case 'error':    return { x: 0, y: 0.8 };
            case 'exito':    return { x: 0, y: -0.5 };
            default:         return mouse ? hacia(p, mouse) : mirada;
        }
    }

    // La cara de cada estado: cierre de cada ojo, ojos felices y bocas
    function gesto(p, estado) {
        const g = { ojos: [0, 0], alegre: 0, sonrisa: 1, giro: 1, o: 0, risa: 0 };
        if (p.cayendo) {
            // Asustados en el aire: ojos muy abiertos y boca de "¡oh!"
            g.ojos = [-0.15, -0.15]; g.sonrisa = 0; g.o = 1;
            return g;
        }
        if (p.ajustando === 'orgullo' && estado === 'libre') {
            g.ojos = [1, 1]; g.alegre = 1; // corbata arreglada: ojos felices
            return g;
        }
        switch (estado) {
            case 'cerrados':
                g.ojos = [1, 1];
                break;
            case 'espia':
                if (p.d.cabeza) { g.ojos = [1, 1]; break; }
                g.ojos = [0, 1]; g.sonrisa = 0; g.o = 1; // un ojo abierto para espiar
                break;
            case 'cargando':
                g.ojos = [-0.12, -0.12]; g.sonrisa = 0; g.o = 1;
                break;
            case 'error':
                g.ojos = [0.3, 0.3]; g.giro = -1; // ojos caidos y boca triste
                break;
            case 'exito':
                g.ojos = [1, 1]; g.alegre = 1; g.sonrisa = 0; g.risa = 1;
                break;
        }
        return g;
    }

    function saltar() {
        if (reducido) return;
        const t = ahora();
        pjs.forEach(function (p, i) { p.salto = t + 0.12 + i * 0.11; });
    }

    function negar() {
        if (reducido) return;
        const t = ahora();
        pjs.forEach(function (p, i) { p.sacudida = t + i * 0.07; });
    }

    // Se llama con cada evento: decide el estado y las metas de los resortes
    function actualizar() {
        const estado = calcularEstado();
        if (estado === 'exito' && estadoActual !== 'exito') saltar();
        estadoActual = estado;
        svg.dataset.estado = estado;
        if (centrosViejos) medirCentros();
        pjs.forEach(function (p) {
            const m = objetivo(p, estado);
            p.px.meta = p.fx.meta = p.hx.meta = m.x;
            p.py.meta = p.fy.meta = p.hy.meta = m.y;
            p.cuerpo.meta = m.x * (m.k || 1);
            const g = gesto(p, estado);
            p.ojos.forEach(function (o, i) { o.cierre.meta = g.ojos[i]; });
            p.alegre.meta = g.alegre;
            p.bSonrisa.meta = g.sonrisa;
            p.bGiro.meta = g.giro;
            p.bO.meta = g.o;
            p.bRisa.meta = g.risa;
        });
        despertar();
    }

    /* ---------- 5. Eventos ---------- */

    document.addEventListener('focusin', actualizar);
    // Al perder el foco, document.activeElement se actualiza un instante despues
    document.addEventListener('focusout', function () { setTimeout(actualizar, 0); });
    email.addEventListener('input', actualizar);
    clave.addEventListener('input', actualizar);
    window.addEventListener('resize', function () { centrosViejos = true; actualizar(); });
    window.addEventListener('scroll', function () { centrosViejos = true; actualizar(); }, { passive: true });

    if (conMouse && !reducido) {
        window.addEventListener('pointermove', function (e) {
            if (e.pointerType !== 'mouse') return;
            mouse = { x: e.clientX, y: e.clientY };
            actualizar();
        }, { passive: true });
        document.documentElement.addEventListener('mouseleave', function () { mouse = null; actualizar(); });
    }

    /* ---------- 6. Carga, error y exito (lo que auth.js muestra) ---------- */

    const CAMBIOS = { attributes: true, attributeFilter: ['style'], childList: true, characterData: true, subtree: true };
    let errorVisto = visible(msgError);
    let finError = 0;

    if (msgError) new MutationObserver(function (cambios) {
        const ya = visible(msgError);
        // auth.js oculta y vuelve a mostrar el mensaje en cada intento, todo
        // en el mismo instante: un error repetido tambien cuenta como nuevo
        const reaparece = cambios.some(function (c) {
            return c.attributeName === 'style' && /display:\s*none/.test(c.oldValue || '');
        });
        if (ya && (!errorVisto || reaparece)) {
            enError = true;
            negar();
            clearTimeout(finError);
            finError = setTimeout(function () { enError = false; actualizar(); }, 1600);
        }
        errorVisto = ya;
        actualizar();
    }).observe(msgError, Object.assign({ attributeOldValue: true }, CAMBIOS));

    if (msgExito) new MutationObserver(actualizar).observe(msgExito, CAMBIOS);
    if (boton) new MutationObserver(actualizar).observe(boton, { attributes: true, attributeFilter: ['disabled'] });

    /* ---------- 7. Vida cuando nadie escribe: parpadeo y miradas ---------- */

    if (!reducido) {
        // Cada uno parpadea a su ritmo (cada 2,6 a 6,6 s); a veces dos veces seguidas
        pjs.forEach(function (p) {
            (function programar() {
                setTimeout(function () {
                    const abiertos = p.ojos.every(function (o) { return o.cierre.meta < 0.5; });
                    if (enPantalla && !document.hidden && abiertos && !p.cayendo) {
                        p.parpadeo = ahora();
                        if (Math.random() < 0.2) {
                            setTimeout(function () { p.parpadeo = ahora(); despertar(); }, 260);
                        }
                        despertar();
                    }
                    programar();
                }, 2600 + Math.random() * 4000);
            })();
        });

        // Sin mouse (celular, o el mouse fuera de la ventana) miran a un lado y al otro
        setInterval(function () {
            if (mouse || estadoActual !== 'libre' || document.hidden) return;
            mirada = Math.random() < 0.35
                ? { x: 0, y: 0 }
                : { x: (Math.random() * 2 - 1) * 0.8, y: (Math.random() * 2 - 1) * 0.35 };
            actualizar();
        }, 2600);
    }

    /* ---------- 8. Arranque ---------- */

    // Primera pose antes de que el navegador pinte: nada aparece de golpe
    pjs.forEach(function (p) { pintar(p, ahora()); });

    // Caen cuando el dibujo entra en pantalla; el bucle descansa si no se ve
    if ('IntersectionObserver' in window) {
        let primeraVez = true;
        new IntersectionObserver(function (entradas) {
            enPantalla = entradas[0].isIntersecting;
            if (!enPantalla) return;
            if (primeraVez) { primeraVez = false; iniciarCaida(); }
            despertar();
        }).observe(contenedor);
    } else {
        iniciarCaida();
    }

    actualizar();
})();
