// Pruebas del frontend de SkillMatch. Uso (desde la carpeta pruebas/):
//   npm install        (la primera vez)
//   npm test           (todas, sin ventana)
//   npm run test:ver   (con la ventana del navegador, una a la vez)
//   npm run informe    (abre el informe de la ultima corrida)
// Usan el Edge instalado (no descargan navegadores) y una API falsa en memoria
// (apoyo/api-falsa.js): no necesitan el backend ni la base de datos.
const { defineConfig, devices } = require('@playwright/test');

const PUERTO = 5510;

module.exports = defineConfig({
    testDir: './casos',
    timeout: 45_000,
    // Pocas a la vez: cada una abre un Edge y un computador normal se satura
    workers: process.env.CI ? 2 : 3,
    expect: { timeout: 6_000 },
    fullyParallel: true,
    retries: 0,
    reporter: [['list'], ['html', { open: 'never' }]],
    use: {
        baseURL: `http://localhost:${PUERTO}/pages/`,
        channel: 'msedge',
        // Sin GPU: con la aceleración gráfica, Edge sin ventana dibujaba unos 3 cuadros por
        // segundo en algunos equipos y cada clic esperaba para siempre a que el botón
        // "quedara quieto" (Playwright compara dos cuadros seguidos). Así dibuja 60.
        launchOptions: { args: ['--disable-gpu'] },
        locale: 'es-CO',
        timezoneId: 'America/Bogota',
        // El service worker guarda copias de las paginas: en pruebas se bloquea
        serviceWorkers: 'block',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure'
    },
    projects: [
        { name: 'escritorio', use: { viewport: { width: 1280, height: 800 } } },
        { name: 'celular', use: { ...devices['Pixel 7'], channel: 'msedge' } }
    ],
    webServer: {
        command: `node servidor.mjs`,
        url: `http://localhost:${PUERTO}/pages/index.html`,
        reuseExistingServer: true,
        env: { PUERTO: String(PUERTO) }
    }
});
