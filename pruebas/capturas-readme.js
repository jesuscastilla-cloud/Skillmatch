// Genera las imagenes del README (docs/img) con el diseno actual y la API falsa de las pruebas.
// Uso (desde pruebas/):  node capturas-readme.js
// Deja JPG de 1440x900 (computador) y 750x1624 (celular, 375x812 a doble resolucion) en ../docs/img/.
const { chromium } = require('@playwright/test');
const { spawn } = require('node:child_process');
const { crearApi, tokenPara, cookieDeSesion } = require('./apoyo/api-falsa');
const { CUENTAS } = require('./apoyo/prueba');

const PUERTO = 5510;
const SALIDA = `${__dirname}/../docs/img`;

// [archivo, pagina, quien, ancho, tema, esperaExtra (ms), guion opcional]
const FOTOS = [
    ['portada-claro', 'index.html', 'visitante', 1440, 'claro', 1800],
    ['portada-oscuro', 'index.html', 'visitante', 1440, 'oscuro', 1800],
    ['vacantes-claro', 'oportunidades.html', 'persona', 1440, 'claro', 800],
    ['vacantes-oscuro', 'oportunidades.html', 'persona', 1440, 'oscuro', 800],
    ['empresas-claro', 'empresas.html', 'visitante', 1440, 'claro', 800],
    ['empresas-oscuro', 'empresas.html', 'visitante', 1440, 'oscuro', 800],
    ['login-claro', 'login.html', 'visitante', 1440, 'claro', 1200],
    ['login-oscuro', 'login.html', 'visitante', 1440, 'oscuro', 1200],
    ['indicadores-claro', 'dashboard.html', 'visitante', 1440, 'claro', 1500],
    ['indicadores-oscuro', 'dashboard.html', 'visitante', 1440, 'oscuro', 1500],
    ['como-aprende-claro', 'como-aprende.html', 'visitante', 1440, 'claro', 1200],
    ['como-aprende-oscuro', 'como-aprende.html', 'visitante', 1440, 'oscuro', 1200],
    ['mi-empresa-claro', 'perfil-empresa.html', 'empresa', 1440, 'claro', 1200],
    ['mi-empresa-oscuro', 'perfil-empresa.html', 'empresa', 1440, 'oscuro', 1200],
    ['celular-vacantes', 'oportunidades.html', 'persona', 375, 'claro', 800],
    ['celular-indicadores', 'dashboard.html', 'visitante', 375, 'claro', 1500],
    ['celular-portada', 'index.html', 'visitante', 375, 'oscuro', 1800]
];

async function servidorListo() {
    try { return (await fetch(`http://localhost:${PUERTO}/pages/index.html`)).ok; } catch (e) { return false; }
}

(async () => {
    let servidor = null;
    if (!(await servidorListo())) {
        servidor = spawn(process.execPath, ['servidor.mjs'], { cwd: __dirname, stdio: 'ignore', env: { ...process.env, PUERTO: String(PUERTO) } });
        for (let i = 0; i < 40 && !(await servidorListo()); i++) await new Promise(r => setTimeout(r, 150));
    }
    const navegador = await chromium.launch({ channel: 'msedge', args: ['--disable-gpu'] });
    for (const [nombre, pagina, quien, ancho, tema, espera] of FOTOS) {
        const celular = ancho < 700;
        const contexto = await navegador.newContext({
            viewport: celular ? { width: 375, height: 812 } : { width: 1440, height: 900 },
            deviceScaleFactor: celular ? 2 : 1, isMobile: celular, hasTouch: celular,
            locale: 'es-CO', timezoneId: 'America/Bogota', serviceWorkers: 'block',
            colorScheme: tema === 'oscuro' ? 'dark' : 'light'
        });
        const api = crearApi();
        await api.conectar(contexto);
        const datos = CUENTAS[quien] || null;
        if (datos) await cookieDeSesion(contexto, datos.id);
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
        await page.waitForTimeout(espera);
        await page.screenshot({ path: `${SALIDA}/${nombre}.jpg`, type: 'jpeg', quality: 82 });
        console.log('OK ' + nombre + (errores.length ? '  ERRORES: ' + errores.join(' | ') : ''));
        await contexto.close();
    }
    await navegador.close();
    if (servidor) servidor.kill();
})();
