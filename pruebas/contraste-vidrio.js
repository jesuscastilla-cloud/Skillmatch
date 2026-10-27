// Contraste de verdad sobre el vidrio (docs/PLAN-PERFIL-GLASS.md, secciones 7 y 15).
// auditoria.js calcula el contraste con los colores del CSS, pero no sabe lo que hay detras de un
// vidrio translucido ni por donde pasan las manchas del fondo. Este guion lo mide con pixeles:
// esconde el texto, detiene las manchas en 8 momentos de su recorrido, toma la foto en 3 alturas de
// la pagina y, bajo cada texto, busca el fondo mas desfavorable (percentil 2). AA: 4.5 (3 si la
// letra es grande). Con la tarjeta de video real (Edge sin ventana + Direct3D 11).
// Uso (desde pruebas/):
//   node contraste-vidrio.js                          (Mi perfil, persona: claro/oscuro, computador/celular)
//   node contraste-vidrio.js "perfil-usuario.html?id=u-andres" persona
// Con algo abierto (ventana, menu, aviso...): CONTRASTE_ANTES abre la pieza y CONTRASTE_DENTRO mide
// solo el texto de adentro (lo de atras esta oscurecido a proposito); se mide donde quedo la pagina:
//   CONTRASTE_ANTES="SkillMatchUI.cambiarContrasena()" CONTRASTE_DENTRO=".modal.active .modal-content" node contraste-vidrio.js
// Sale con error si algun texto queda bajo AA.
const { chromium } = require('@playwright/test');
const { spawn } = require('node:child_process');
const { crearApi, tokenPara } = require('./apoyo/api-falsa');
const { CUENTAS } = require('./apoyo/prueba');

const [pagina = 'perfil-usuario.html', quien = 'persona'] = process.argv.slice(2);
const ANTES = process.env.CONTRASTE_ANTES || '';
const DENTRO = process.env.CONTRASTE_DENTRO || '';
const PUERTO = 5510;
const MOMENTOS = 8;
const DISPOSITIVOS = {
    computador: { viewport: { width: 1440, height: 900 } },
    celular: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
};

async function servidorListo() {
    try { return (await fetch(`http://localhost:${PUERTO}/pages/index.html`)).ok; } catch (e) { return false; }
}

// Corre dentro de la pagina: textos visibles con su color, antes de esconderlos
function anotarTextos(dentro) {
    window.__textos = [];
    const caminante = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = caminante.nextNode());) {
        const el = n.parentElement;
        if (!n.textContent.trim() || !el || el.closest('script, style, .fondo-vivo, [hidden], [aria-hidden="true"]')) continue;
        if (dentro && !el.closest(dentro)) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0 || !el.getClientRects().length) continue;
        // Solo para lectores de pantalla (.sr-only: recortado a 1x1 px), no se ve
        const caja = el.getBoundingClientRect();
        if (cs.clip === 'rect(0px, 0px, 0px, 0px)' || caja.width <= 1 || caja.height <= 1) continue;
        const tam = parseFloat(cs.fontSize), peso = Number(cs.fontWeight);
        window.__textos.push({ nodo: n, texto: n.textContent.trim().replace(/\s+/g, ' ').slice(0, 40), color: cs.color, grande: tam >= 24 || (tam >= 18.66 && peso >= 700) });
    }
    const s = document.createElement('style');
    // Sin transiciones: los botones y enlaces con "transition: all" tardaban en esconder su texto y
    // la primera foto lo medía contra sí mismo (salía 1.5 en "En tus conexiones"). Y las líneas que
    // tachan o subrayan con su propio color (los pasos hechos de "Primeros pasos") tambien se esconden
    s.textContent = '* { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; caret-color: transparent !important; text-decoration-color: transparent !important; transition: none !important; }';
    document.head.appendChild(s);
}

// Corre dentro de la pagina: contraste de cada texto contra la foto sin texto
async function medirFoto(b64) {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const lienzo = document.createElement('canvas'); lienzo.width = img.width; lienzo.height = img.height;
    const ctx = lienzo.getContext('2d'); ctx.drawImage(img, 0, 0);
    const lum = (r, g, b) => { const f = c => { c /= 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
    const barra = document.querySelector('body > header'), pestanas = document.querySelector('.tabbar');
    const techo = barra ? barra.getBoundingClientRect().bottom : 0;
    const piso = pestanas && getComputedStyle(pestanas).display !== 'none' ? pestanas.getBoundingClientRect().top : innerHeight;
    const salida = [];
    for (const tx of window.__textos) {
        const dentroDeBarra = tx.nodo.parentElement.closest('body > header, .tabbar');
        // Lo que se ve del texto: lo recortan los que tienen overflow (el "..." de una vista previa,
        // una lista con scroll). Sin esto se median letras escondidas contra lo que hay al lado
        let vx0 = 0, vy0 = 0, vx1 = img.width, vy1 = img.height;
        for (let a = tx.nodo.parentElement; a && a !== document.body; a = a.parentElement) {
            const ca = getComputedStyle(a);
            if (ca.overflowX !== 'visible' || ca.overflowY !== 'visible') {
                const ra = a.getBoundingClientRect();
                vx0 = Math.max(vx0, ra.left); vy0 = Math.max(vy0, ra.top); vx1 = Math.min(vx1, ra.right); vy1 = Math.min(vy1, ra.bottom);
            }
        }
        const rango = document.createRange(); rango.selectNodeContents(tx.nodo);
        for (const r of rango.getClientRects()) {
            const x0 = Math.max(0, Math.floor(Math.max(r.left, vx0))), y0 = Math.max(0, Math.floor(Math.max(r.top, vy0)));
            const x1 = Math.min(img.width, Math.ceil(Math.min(r.right, vx1))), y1 = Math.min(img.height, Math.ceil(Math.min(r.bottom, vy1)));
            if (x1 - x0 < 2 || y1 - y0 < 2) continue;
            // Tapado por la barra o las pestanas, o bajo su sombra (al bajar, la barra echa una sombra
            // suave sobre lo que pasa justo debajo: un instante del scroll, no un texto que se lea mal)
            if (!dentroDeBarra && (r.top < techo + 12 || r.bottom > piso - 12)) continue;
            const d = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
            const [cr, cg, cb] = tx.color.match(/\d+(\.\d+)?/g).map(Number);
            const lt = lum(cr, cg, cb), valores = [];
            for (let i = 0; i < d.length; i += 4) { const lf = lum(d[i], d[i + 1], d[i + 2]); valores.push((Math.max(lt, lf) + .05) / (Math.min(lt, lf) + .05)); }
            valores.sort((a, b) => a - b);
            salida.push({ texto: tx.texto, contraste: valores[Math.floor(valores.length * .02)], grande: tx.grande });
        }
    }
    return salida;
}

(async () => {
    let servidor = null;
    if (!(await servidorListo())) {
        servidor = spawn(process.execPath, ['servidor.mjs'], { cwd: __dirname, stdio: 'ignore', env: { ...process.env, PUERTO: String(PUERTO) } });
        for (let i = 0; i < 40 && !(await servidorListo()); i++) await new Promise(r => setTimeout(r, 150));
    }
    const navegador = await chromium.launch({ channel: 'msedge', args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
    let fallas = 0;
    for (const tema of ['claro', 'oscuro']) {
        for (const [nombre, disp] of Object.entries(DISPOSITIVOS)) {
            const contexto = await navegador.newContext({ ...disp, deviceScaleFactor: 1, locale: 'es-CO', timezoneId: 'America/Bogota', serviceWorkers: 'block', colorScheme: tema === 'oscuro' ? 'dark' : 'light' });
            const api = crearApi();
            await api.conectar(contexto);
            const datos = CUENTAS[quien] || null;
            await contexto.addInitScript(({ token, datos, tema }) => {
                if (token) { localStorage.setItem('token', token); localStorage.setItem('userData', JSON.stringify(datos)); }
                localStorage.setItem('skillmatch_theme', tema === 'oscuro' ? 'dark' : 'light');
                ['inicio-persona', 'inicio-empresa', 'mi-empresa'].forEach(c => localStorage.setItem('skillmatch_recorrido_' + c, 'visto'));
            }, { token: datos ? tokenPara(datos.id) : null, datos, tema });
            const page = await contexto.newPage();
            await page.goto(`http://localhost:${PUERTO}/pages/${pagina}`);
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(1200);
            if (ANTES) {
                try { await page.evaluate(ANTES); } catch (e) {
                    console.log(`${tema.padEnd(6)} ${nombre.padEnd(10)} no se pudo abrir: ${e.message.split(/\r?\n/)[0]}`);
                    await contexto.close();
                    continue;
                }
                await page.waitForTimeout(700);
            }
            await page.evaluate(anotarTextos, DENTRO);
            const peores = new Map();
            const alto = await page.evaluate(() => document.documentElement.scrollHeight);
            const vista = disp.viewport.height;
            const momentos = await page.evaluate(() => !!document.querySelector('.pagina-vidrio .fondo-vivo')) ? MOMENTOS : 1;
            const alturas = DENTRO ? [await page.evaluate(() => scrollY)] : [0, Math.max(0, Math.round((alto - vista) / 2)), Math.max(0, alto - vista)];
            for (const y of [...new Set(alturas)]) {
                if (!DENTRO) await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), y);
                for (let k = 0; k < momentos; k++) {
                    await page.evaluate(ms => { const f = document.querySelector('.fondo-vivo'); if (f) f.getAnimations({ subtree: true }).forEach(a => { a.pause(); a.currentTime = ms; }); }, k * 11000);
                    await page.waitForTimeout(120);
                    const foto = (await page.screenshot()).toString('base64');
                    for (const r of await page.evaluate(medirFoto, foto)) {
                        const antes = peores.get(r.texto);
                        if (!antes || r.contraste < antes.contraste) peores.set(r.texto, r);
                    }
                }
            }
            const todos = [...peores.values()];
            const bajos = todos.filter(r => r.contraste < (r.grande ? 3 : 4.5)).sort((a, b) => a.contraste - b.contraste);
            const minimo = todos.reduce((m, r) => (!m || r.contraste < m.contraste ? r : m), null);
            fallas += bajos.length;
            console.log(`${tema.padEnd(6)} ${nombre.padEnd(10)} textos: ${todos.length}, el mas bajo: ${minimo ? minimo.contraste.toFixed(2) + ` ("${minimo.texto}")` : '-'}, bajo AA: ${bajos.length}`);
            bajos.slice(0, 10).forEach(r => console.log(`        ${r.contraste.toFixed(2)}  ${r.grande ? '(grande) ' : ''}${r.texto}`));
            await contexto.close();
        }
    }
    await navegador.close();
    if (servidor) servidor.kill();
    process.exit(fallas ? 1 : 0);
})();
