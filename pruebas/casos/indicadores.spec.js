// Indicadores y paginas con el sitio vacio.
const { test, expect, entrarComo } = require('../apoyo/prueba');

test('Cartagena sale una sola vez y suma "Cartagena" y "Cartagena de Indias"', async ({ page, context, api }) => {
    await entrarComo(context, 'visitante');
    const esperadas = api.estado.datos.vacantes.filter(j => j.active && /cartagena/i.test(j.location)).length;
    await page.goto('dashboard.html');
    const filas = page.locator('#indCiudades > *');
    await expect(filas.first()).toContainText(/\d/, { timeout: 15_000 });
    const textos = await filas.allInnerTexts();
    const deCartagena = textos.filter(t => /^Cartagena/.test(t.trim()));
    expect(deCartagena).toHaveLength(1);
    expect(deCartagena[0]).toContain(String(esperadas));
});

test.describe('sitio sin vacantes', () => {
    test.beforeEach(async ({ api }) => {
        api.estado.datos.vacantes = [];
        api.estado.datos.empresas = [];
    });

    test('Indicadores muestra un solo aviso; el botón depende de quién mira', async ({ page, context, api }) => {
        await entrarComo(context, 'empresa');
        await page.goto('dashboard.html');
        await expect(page.locator('#indicadoresVacio')).toBeVisible();
        await expect(page.locator('.indicadores-grid')).toBeHidden();
        await expect(page.locator('#indicadoresVacioAccion')).toHaveText('Publicar una vacante');
        await expect(page.locator('#indicadoresVacioAccion')).toHaveAttribute('href', 'perfil-empresa.html?nueva=1');
    });

    test('a una persona con sesión no le ofrece publicar', async ({ page, context, api }) => {
        await entrarComo(context, 'persona');
        await page.goto('dashboard.html');
        await expect(page.locator('#indicadoresVacio')).toBeVisible();
        await expect(page.locator('#indicadoresVacioAccion')).toBeHidden();
    });

    test('Vacantes dice que aparecerán cuando las empresas publiquen', async ({ page, context, api }) => {
        await entrarComo(context, 'visitante');
        await page.goto('oportunidades.html');
        await expect(page.locator('.no-results-message')).toContainText('Cuando las empresas publiquen vacantes, aparecerán aquí.');
        await expect(page.locator('.no-results-message a')).toHaveAttribute('href', 'registro-empresa.html');
    });

    test('Empresas explica que todavía no hay empresas', async ({ page, context, api }) => {
        await entrarComo(context, 'visitante');
        await page.goto('empresas.html');
        await expect(page.locator('#empresasLista')).toContainText('Todavía no hay empresas registradas');
    });
});
