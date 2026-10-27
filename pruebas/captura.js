// Foto de una pagina con la API falsa, para revisar como se ve un cambio.
// Uso (desde pruebas/):
//   node captura.js <pagina> [quien] [ancho] [tema] [nombre]
//   node captura.js oportunidades.html persona 1280 claro
//   node captura.js mensajes.html?userId=u-digital persona 390 oscuro
// quien: visitante | persona | otra | empresa | digital. Deja la foto en capturas/.
// Antes de la foto puede correr un guion: CAPTURA_ANTES="document.querySelector('...').click()"
const { chromium } = require('@playwright/test');
const { spawn } = require('node:child_process');
const { mkdirSync } = require('node:fs');
const { crearApi, tokenPara } = require('./apoyo/api-falsa');
const { CUENTAS } = require('./apoyo/prueba');

const [pagina = 'index.html', quien = 'visitante', ancho = '1280', tema = 'claro', nombre] = process.argv.slice(2);
const PUERTO = 5510;

async function servidorListo() {
    try { return (await fetch(`http://localhost:${PUERTO}/pages/index.html`)).ok; } catch (e) { return false; }
}

(async () => {
    let servidor = null;
    if (!(await servidorListo())) {
        servidor = spawn(process.execPath, ['servidor.mjs'], { cwd: __dirname, stdio: 'ignore', env: { ...process.env, PUERTO: String(PUERTO) } });
        for (let i = 0; i < 40 && !(await servidorListo()); i++) await new Promise(r => setTimeout(r, 150));
    }
    const navegador = await chromium.launch({ channel: 'msedge' });
    const celular = Number(ancho) < 700;
    const contexto = await navegador.newContext({
        viewport: { width: Number(ancho), height: celular ? 844 : 800 },
        isMobile: celular, hasTouch: celular, deviceScaleFactor: 1,
        locale: 'es-CO', timezoneId: 'America/Bogota', serviceWorkers: 'block',
        colorScheme: tema === 'oscuro' ? 'dark' : 'light'
    });
    const api = crearApi();
    await api.conectar(contexto);
    const datos = CUENTAS[quien] || null;
    await contexto.addInitScript(({ token, datos, tema }) => {
        if (token) { localStorage.setItem('token', token); localStorage.setItem('userData', JSON.stringify(datos)); }
        localStorage.setItem('skillmatch_theme', tema === 'oscuro' ? 'dark' : 'light');
        ['inicio-persona', 'inicio-empresa', 'mi-empresa'].forEach(c => localStorage.setItem('skillmatch_recorrido_' + c, 'visto'));
    }, { token: datos ? tokenPara(datos.id) : null, datos, tema });
    const page = await contexto.newPage();
    const errores = [];
    page.on('pageerror', e => errores.push(e.message));
    await page.goto(`http://localhost:${PUERTO}/pages/${pagina}`);
    await page.waitForLoadState('networkidle');
    if (process.env.CAPTURA_ANTES) { await page.evaluate(process.env.CAPTURA_ANTES); await page.waitForTimeout(600); }
    await page.waitForTimeout(700);
    mkdirSync(`${__dirname}/capturas`, { recursive: true });
    const archivo = `${__dirname}/capturas/${nombre || `${pagina.replace(/[^a-z0-9]+/gi, '-')}-${quien}-${ancho}-${tema}`}.png`;
    await page.screenshot({ path: archivo, fullPage: process.env.CAPTURA_COMPLETA === '1' });
    console.log(archivo);
    if (errores.length) console.log('ERRORES:', errores.join(' | '));
    if (api.estado.desconocidas.length) console.log('DESCONOCIDAS:', api.estado.desconocidas.join(', '));
    await navegador.close();
    if (servidor) servidor.kill();
})();
