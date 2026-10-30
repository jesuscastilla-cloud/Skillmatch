// Auditoría de diseño: recorre las páginas con la API falsa y mide lo que se
// puede medir sin mirar: contraste del texto, tamaño de lo que se toca, botones
// sin nombre, letra muy pequeña, páginas más anchas que la pantalla, títulos,
// campos de formulario y el foco del teclado (se recorre cada página con Tab).
// Sigue la lista de chequeo de la skill ui-ux-pro-max (WCAG 2.2 AA): teléfono de
// 375 px, celular de lado, letra "muy grande", claro y oscuro.
// Uso (desde pruebas/):  node auditoria.js            (todas las páginas)
//                        node auditoria.js mensajes   (solo las que contienen "mensajes")
// Deja el detalle en capturas/auditoria.json y un resumen en la consola.
const { chromium } = require('@playwright/test');
const { spawn } = require('node:child_process');
const { mkdirSync, writeFileSync } = require('node:fs');
const { crearApi, tokenPara, cookieDeSesion } = require('./apoyo/api-falsa');
const { CUENTAS } = require('./apoyo/prueba');

const PUERTO = 5510;
const PAGINAS = {
    visitante: ['index.html', 'oportunidades.html', 'empresas.html', 'empresa.html?id=c-hotel', 'dashboard.html', 'politica-datos.html',
        'login.html', 'login-usuario.html', 'login-empresa.html', 'seleccionar-registro.html', 'registro-usuario.html', 'registro-empresa.html'],
    persona: ['index.html', 'oportunidades.html', 'perfil-usuario.html', 'perfil-usuario.html?id=u-andres', 'conexiones.html',
        'mensajes.html', 'mensajes.html?userId=u-digital', 'hoja-de-vida.html'],
    empresa: ['index.html', 'perfil-empresa.html', 'mensajes.html']
};
// teclado: recorre la página con Tab (es lento, solo en dos vistas)
const VISTAS = [
    { ancho: 375, tema: 'light', teclado: true }, { ancho: 375, tema: 'dark' },
    { ancho: 1280, tema: 'light', teclado: true }, { ancho: 1280, tema: 'dark' },
    { ancho: 844, alto: 390, tema: 'light', nombre: 'de lado' },
    { ancho: 375, tema: 'light', letra: 'muy-grande', nombre: 'letra muy grande' }
];
const filtro = process.argv[2] || '';

async function servidorListo() {
    try { return (await fetch(`http://localhost:${PUERTO}/pages/index.html`)).ok; } catch (e) { return false; }
}

// Corre dentro de la página
function medir(celular) {
    const problemas = [];
    const firma = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') +
        [...el.classList].slice(0, 2).map(c => '.' + c).join('');
    const texto = el => (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    const visible = el => {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return false;
        for (let e = el; e; e = e.parentElement) {
            const s = getComputedStyle(e);
            if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
            if (e.hasAttribute('inert')) return false;
        }
        return true;
    };
    const rgba = c => { const m = c.match(/[\d.]+/g) || [0, 0, 0, 0]; return [+m[0], +m[1], +m[2], m[3] === undefined ? 1 : +m[3]]; };
    const encima = (arriba, abajo) => { const a = arriba[3]; return [0, 1, 2].map(i => arriba[i] * a + abajo[i] * (1 - a)).concat(1); };
    const luz = c => { const v = c.slice(0, 3).map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
    const contraste = (a, b) => { const [x, y] = [luz(a), luz(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    // Fondo real: se suman las capas hasta la primera opaca; con imagen o degradado no se sabe
    const fondo = el => {
        const capas = [];
        for (let e = el; e; e = e.parentElement) {
            const s = getComputedStyle(e);
            if (s.backgroundImage !== 'none') return null;
            // Un fondo pintado con ::before o ::after tampoco se puede calcular
            for (const pseudo of ['::before', '::after']) {
                const ps = getComputedStyle(e, pseudo);
                if (ps.content !== 'none' && ps.position === 'absolute' && Number(ps.opacity) > 0 &&
                    (rgba(ps.backgroundColor)[3] > 0 || ps.backgroundImage !== 'none')) return null;
            }
            const c = rgba(s.backgroundColor);
            if (c[3] > 0) capas.push(c);
            if (c[3] >= 1) break;
        }
        let base = [255, 255, 255, 1];
        if (!capas.length || capas[capas.length - 1][3] < 1) base = rgba(getComputedStyle(document.body).backgroundColor);
        return capas.reverse().reduce((abajo, arriba) => encima(arriba, abajo), base);
    };

    // 1. Contraste y letra pequeña: elementos con texto propio
    const vistos = new Set();
    document.querySelectorAll('body *').forEach(el => {
        if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'OPTION', 'svg', 'path'].includes(el.tagName)) return;
        const propio = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
        if (!propio || !visible(el) || el.closest('[disabled], .skip-link, [aria-hidden="true"]')) return;
        const s = getComputedStyle(el);
        const tam = parseFloat(s.fontSize);
        const grueso = parseInt(s.fontWeight, 10) >= 700;
        const clave = firma(el);
        if (tam < 12 && !vistos.has('letra' + clave)) {
            vistos.add('letra' + clave);
            problemas.push({ tipo: 'letra-pequena', donde: clave, texto: texto(el), valor: tam });
        }
        const bg = fondo(el);
        if (!bg) return;
        let fg = rgba(s.color);
        // La opacidad del elemento y de sus padres aclara el texto
        let op = 1;
        for (let e = el; e; e = e.parentElement) op *= Number(getComputedStyle(e).opacity);
        fg = encima([fg[0], fg[1], fg[2], fg[3] * op], bg);
        const ratio = contraste(fg, bg);
        const grande = tam >= 24 || (tam >= 18.66 && grueso);
        const minimo = grande ? 3 : 4.5;
        if (ratio < minimo && !vistos.has('contraste' + clave)) {
            vistos.add('contraste' + clave);
            problemas.push({ tipo: 'contraste', donde: clave, texto: texto(el), valor: Math.round(ratio * 100) / 100, minimo });
        }
    });

    // Zona que de verdad responde al toque: un ::after puede agrandarla. Se prueba
    // tocando a cierta distancia del centro, como un dedo (hasta 22 px a cada lado).
    const alcance = el => {
        el.scrollIntoView({ block: 'center', inline: 'center' });
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const toca = (x, y) => { const e = document.elementFromPoint(x, y); return !!e && (e === el || el.contains(e)); };
        let lado = 0;
        for (const d of [2, 6, 10, 12, 14, 16, 18, 20, 22]) {
            if (toca(cx, cy - d) && toca(cx, cy + d) && toca(cx - d, cy) && toca(cx + d, cy)) lado = d * 2; else break;
        }
        return Math.max(lado, Math.min(r.width, r.height) * (toca(cx, cy) ? 1 : 0));
    };

    // 2. Lo que se toca: tamaño, nombre y, en los campos, el teclado del celular
    const tocables = 'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])';
    const campos = 'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]):not([type="submit"]):not([type="button"]), textarea, select';
    document.querySelectorAll(tocables).forEach(el => {
        if (!visible(el) || el.disabled) return;
        const clave = firma(el);
        const nombre = (el.innerText || '').trim() || el.getAttribute('aria-label') || el.getAttribute('title') ||
            el.getAttribute('aria-labelledby') || el.querySelector('img[alt]:not([alt=""])') ||
            (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) || el.closest('label') ||
            (el.type === 'submit' && el.value);
        if (!nombre && !vistos.has('nombre' + clave)) {
            vistos.add('nombre' + clave);
            // Un campo con solo el texto de ejemplo: al escribir se pierde qué era
            const ejemplo = el.getAttribute('placeholder');
            problemas.push({ tipo: ejemplo ? 'solo-ejemplo' : 'sin-nombre', donde: clave, texto: ejemplo || '' });
        }
        if (el.matches(campos)) {
            const pista = `${el.id} ${el.name || ''} ${el.getAttribute('autocomplete') || ''}`.toLowerCase();
            if (/email|correo/.test(pista) && el.type !== 'email' && el.tagName === 'INPUT' && !vistos.has('teclado' + clave)) {
                vistos.add('teclado' + clave);
                problemas.push({ tipo: 'teclado', donde: clave, valor: `${el.type} (debería ser email)` });
            }
            if (/(^|[^a-z])(tel|phone|telefono|celular)/.test(pista) && el.type !== 'tel' && el.tagName === 'INPUT' && !vistos.has('teclado' + clave)) {
                vistos.add('teclado' + clave);
                problemas.push({ tipo: 'teclado', donde: clave, valor: `${el.type} (debería ser tel)` });
            }
            if (el.type === 'password' && !el.getAttribute('autocomplete') && !vistos.has('auto' + clave)) {
                vistos.add('auto' + clave);
                problemas.push({ tipo: 'autocompletar', donde: clave });
            }
            // En iPhone, un campo con letra de menos de 16 px agranda la página al tocarlo
            const letra = parseFloat(getComputedStyle(el).fontSize);
            if (celular && letra < 16 && !vistos.has('zoom' + clave)) {
                vistos.add('zoom' + clave);
                problemas.push({ tipo: 'zoom-iphone', donde: clave, valor: letra });
            }
        }
        // Un enlace dentro de un párrafo no cuenta (excepción de WCAG)
        const s = getComputedStyle(el);
        if (s.display === 'inline' && el.parentElement && /^(P|LI|SPAN|SMALL|TD|LABEL)$/.test(el.parentElement.tagName)) return;
        const destino = el.closest('label') || el;
        const r = destino.getBoundingClientRect();
        const lado = Math.min(r.width, r.height) < 44 ? alcance(destino) : 44;
        if (lado < 24 && !vistos.has('tamano' + clave)) {
            vistos.add('tamano' + clave);
            problemas.push({ tipo: 'muy-pequeno', donde: clave, texto: texto(el), valor: `${Math.round(r.width)}×${Math.round(r.height)} (responde ${Math.round(lado)})` });
        } else if (celular && lado < 40 && !vistos.has('dedo' + clave)) {
            vistos.add('dedo' + clave);
            problemas.push({ tipo: 'pequeno-para-dedo', donde: clave, texto: texto(el), valor: `${Math.round(r.width)}×${Math.round(r.height)} (responde ${Math.round(lado)})` });
        }
    });

    // 2b. Lo que responde al clic (cursor de mano) también debe alcanzarse con el
    // teclado: se toca su centro y se busca algo enfocable ahí (un botón, un
    // enlace, la casilla de una etiqueta). Si no hay, solo funciona con el mouse.
    const enfocable = 'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';
    document.querySelectorAll('body *').forEach(el => {
        if (getComputedStyle(el).cursor !== 'pointer') return;
        if (el.parentElement && getComputedStyle(el.parentElement).cursor === 'pointer') return;
        if (el.matches(enfocable) || el.closest(enfocable) || !visible(el)) return;
        // Dentro de una imagen (role="img", como el anillo de compatibilidad) lo que se toca
        // repite controles que están fuera de ella
        if (el.closest('[role="img"]')) return;
        const clave = firma(el);
        if (vistos.has('teclado-alcance' + clave)) return;
        el.scrollIntoView({ block: 'center', inline: 'center' });
        const r = el.getBoundingClientRect();
        const golpe = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        if (!golpe || !el.contains(golpe)) return;
        const etiqueta = golpe.closest('label');
        if (golpe.closest(enfocable) || (etiqueta && etiqueta.control)) return;
        vistos.add('teclado-alcance' + clave);
        problemas.push({ tipo: 'sin-teclado', donde: clave, texto: texto(el) });
    });

    // 3. Imágenes: texto alternativo y tamaño reservado (sin él, la página salta al cargar)
    document.querySelectorAll('img:not([alt])').forEach(img => problemas.push({ tipo: 'imagen-sin-alt', donde: firma(img) }));
    document.querySelectorAll('img').forEach(img => {
        if (!visible(img) || img.getBoundingClientRect().height < 60) return;
        if (img.getAttribute('width') && img.getAttribute('height')) return;
        if (getComputedStyle(img).aspectRatio !== 'auto') return;
        problemas.push({ tipo: 'imagen-sin-tamano', donde: firma(img) });
    });

    // 4. Más ancha que la pantalla
    window.scrollTo(0, 0);
    const ancho = document.documentElement.scrollWidth;
    if (ancho > innerWidth + 1) {
        const culpables = [...document.querySelectorAll('body *')].filter(el => {
            const r = el.getBoundingClientRect();
            return r.right > innerWidth + 1 && visible(el);
        }).slice(0, 4).map(firma);
        problemas.push({ tipo: 'desborde', donde: culpables.join(' | '), valor: ancho });
    }

    // 5. Títulos: un solo h1 y sin saltar niveles (h2 -> h4)
    const titulos = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')].filter(visible);
    const h1 = titulos.filter(t => t.tagName === 'H1').length;
    if (h1 !== 1) problemas.push({ tipo: 'titulos', donde: `${h1} h1` });
    titulos.reduce((nivel, t) => {
        const n = Number(t.tagName[1]);
        if (nivel && n > nivel + 1) problemas.push({ tipo: 'titulo-salta', donde: `h${nivel} → ${firma(t)}`, texto: texto(t) });
        return n;
    }, 0);

    // 6. Zoom permitido y enlace para saltar al contenido
    const meta = document.querySelector('meta[name="viewport"]');
    if (meta && /user-scalable\s*=\s*no|maximum-scale\s*=\s*1(\.0)?\b/.test(meta.content)) problemas.push({ tipo: 'zoom-bloqueado', donde: meta.content });
    const salto = document.querySelector('a.skip-link');
    if (!salto || !document.querySelector(salto.getAttribute('href'))) problemas.push({ tipo: 'sin-salto', donde: salto ? salto.getAttribute('href') : 'no hay' });

    // 7. Con "reducir movimiento" nada debería quedar moviéndose sin parar
    document.getAnimations().forEach(a => {
        const t = a.effect && a.effect.getTiming();
        const el = a.effect && a.effect.target;
        if (!t || !el || a.playState !== 'running' || !visible(el)) return;
        if (t.iterations === Infinity || t.duration > 1000) problemas.push({ tipo: 'movimiento', donde: firma(el), texto: a.animationName || '' });
    });
    return problemas;
}

// Foco del teclado: se toma el estilo del elemento (y de sus ::before, ::after
// y 5 padres) con foco y sin foco; si nada cambia, el foco no se ve. También se
// revisa que no quede tapado (por la barra de arriba, por ejemplo) ni escondido.
function estiloDelFoco(enfocado) {
    const el = enfocado ? document.activeElement : window.__foco;
    if (!el || el === document.body) return null;
    if (enfocado) window.__foco = el;
    const props = ['outlineStyle', 'outlineWidth', 'outlineColor', 'boxShadow', 'borderColor', 'backgroundColor', 'textDecorationLine', 'color'];
    const foto = [];
    for (const pseudo of [null, '::before', '::after']) {
        const s = getComputedStyle(el, pseudo);
        foto.push(props.map(p => s[p]).join('|'));
    }
    for (let e = el.parentElement, i = 0; e && i < 5; e = e.parentElement, i++) {
        const s = getComputedStyle(e);
        foto.push(props.map(p => s[p]).join('|'));
    }
    const firmaDe = e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + [...e.classList].slice(0, 2).map(c => '.' + c).join('');
    const r = el.getBoundingClientRect();
    let tapado = '';
    let escondido = false;
    if (enfocado) {
        escondido = r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth;
        if (!escondido) {
            const x = Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1);
            const y = Math.min(Math.max(r.top + r.height / 2, 1), innerHeight - 1);
            const arriba = document.elementFromPoint(x, y);
            if (arriba && arriba !== el && !el.contains(arriba) && !arriba.contains(el)) tapado = firmaDe(arriba);
        }
    }
    return { firma: firmaDe(el), texto: (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40), foto: foto.join('§'), tapado, escondido };
}

async function recorrerConTeclado(page) {
    const problemas = [];
    const vistos = new Set();
    await page.evaluate(() => { window.scrollTo(0, 0); if (document.activeElement) document.activeElement.blur(); });
    for (let i = 0; i < 30; i++) {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(160);
        const con = await page.evaluate(estiloDelFoco, true);
        if (!con) break;
        if (vistos.has(con.firma)) continue;
        vistos.add(con.firma);
        if (con.escondido) problemas.push({ tipo: 'foco-escondido', donde: con.firma, texto: con.texto });
        if (con.tapado) problemas.push({ tipo: 'foco-tapado', donde: con.firma, texto: con.texto, valor: 'lo tapa ' + con.tapado });
        await page.evaluate(() => window.__foco.blur());
        await page.waitForTimeout(220);
        const sin = await page.evaluate(estiloDelFoco, false);
        if (sin && sin.foto === con.foto && !con.escondido) problemas.push({ tipo: 'foco-invisible', donde: con.firma, texto: con.texto });
        // Se vuelve a poner el foco para que el siguiente Tab siga desde ahí
        await page.evaluate(() => window.__foco.focus());
    }
    return problemas;
}

(async () => {
    let servidor = null;
    if (!(await servidorListo())) {
        servidor = spawn(process.execPath, ['servidor.mjs'], { cwd: __dirname, stdio: 'ignore', env: { ...process.env, PUERTO: String(PUERTO) } });
        for (let i = 0; i < 40 && !(await servidorListo()); i++) await new Promise(r => setTimeout(r, 150));
    }
    const navegador = await chromium.launch({ channel: 'msedge' });
    const resultados = [];
    const trabajos = [];
    for (const [quien, paginas] of Object.entries(PAGINAS)) {
        for (const pagina of paginas.filter(p => p.includes(filtro))) {
            for (const vista of VISTAS) trabajos.push({ quien, pagina, ...vista });
        }
    }
    async function correr({ quien, pagina, ancho, alto, tema, teclado, letra, nombre }) {
        const celular = ancho < 700 || !!alto;
        const contexto = await navegador.newContext({
            viewport: { width: ancho, height: alto || (celular ? 812 : 800) }, isMobile: celular, hasTouch: celular,
            locale: 'es-CO', timezoneId: 'America/Bogota', serviceWorkers: 'block', colorScheme: tema, reducedMotion: 'reduce'
        });
        const api = crearApi();
        await api.conectar(contexto);
        const datos = CUENTAS[quien] || null;
        if (datos) await cookieDeSesion(contexto, datos.id); // la sesión va en la cookie (F4)
        await contexto.addInitScript(({ token, datos, tema, letra }) => {
            if (token) { localStorage.setItem('token', token); localStorage.setItem('userData', JSON.stringify(datos)); }
            localStorage.setItem('skillmatch_theme', tema);
            if (letra) localStorage.setItem('skillmatch_letra', letra);
            ['inicio-persona', 'inicio-empresa', 'mi-empresa'].forEach(c => localStorage.setItem('skillmatch_recorrido_' + c, 'visto'));
        }, { token: datos ? tokenPara(datos.id) : null, datos, tema, letra: letra || null });
        const page = await contexto.newPage();
        const vista = nombre || `${ancho}${tema === 'dark' ? ' oscuro' : ''}`;
        try {
            await page.goto(`http://localhost:${PUERTO}/pages/${pagina}`, { waitUntil: 'load', timeout: 60000 });
            await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
            await page.waitForTimeout(500);
            const problemas = await page.evaluate(medir, celular);
            if (teclado) problemas.push(...await recorrerConTeclado(page));
            problemas.forEach(p => resultados.push({ ...p, quien, pagina, vista }));
        } catch (e) {
            resultados.push({ tipo: 'error', quien, pagina, vista, texto: e.message.slice(0, 120) });
        }
        await contexto.close();
    }
    const cola = [...trabajos];
    await Promise.all([1, 2, 3].map(async () => { while (cola.length) await correr(cola.shift()); }));
    await navegador.close();
    if (servidor) servidor.kill();

    mkdirSync(`${__dirname}/capturas`, { recursive: true });
    writeFileSync(`${__dirname}/capturas/auditoria.json`, JSON.stringify(resultados, null, 1));
    // Resumen: cada problema una vez, con dónde aparece
    const grupos = new Map();
    resultados.forEach(r => {
        const clave = `${r.tipo} ${r.donde}`;
        if (!grupos.has(clave)) grupos.set(clave, { ...r, vistas: new Set(), valores: new Set() });
        const g = grupos.get(clave);
        g.vistas.add(`${r.pagina.replace('.html', '')} ${r.vista}`);
        if (r.valor !== undefined) g.valores.add(r.valor);
    });
    const orden = ['error', 'desborde', 'zoom-bloqueado', 'sin-salto', 'sin-teclado', 'sin-nombre', 'solo-ejemplo', 'imagen-sin-alt', 'foco-invisible',
        'foco-tapado', 'foco-escondido', 'contraste', 'muy-pequeno', 'titulos', 'titulo-salta', 'teclado', 'autocompletar',
        'movimiento', 'imagen-sin-tamano', 'zoom-iphone', 'letra-pequena', 'pequeno-para-dedo'];
    [...grupos.values()].sort((a, b) => orden.indexOf(a.tipo) - orden.indexOf(b.tipo)).forEach(g => {
        const vistas = [...g.vistas];
        console.log(`[${g.tipo}] ${g.donde}${g.texto ? ` "${g.texto}"` : ''}${g.valores.size ? ` → ${[...g.valores].slice(0, 4).join(', ')}` : ''}${g.minimo ? ` (mínimo ${g.minimo})` : ''}`);
        console.log(`    ${vistas.slice(0, 4).join('; ')}${vistas.length > 4 ? ` y ${vistas.length - 4} más` : ''}`);
    });
    console.log(`\n${trabajos.length} vistas revisadas, ${grupos.size} problemas distintos.`);
})();
