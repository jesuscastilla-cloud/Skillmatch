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

// Datos de prueba: de las 9 vacantes abiertas, 6 se publicaron en los últimos 7
// días y 2 en los 7 anteriores. Empleo: 5 nuevas y ninguna antes (+5); práctica:
// ninguna nueva y 2 antes (−2); independiente: 1 nueva (+1).
test('"Ver detalle" crece desde la tarjeta y compara esta semana con la anterior', async ({ page, context, api }) => {
    await entrarComo(context, 'visitante');
    await page.goto('dashboard.html');
    const boton = page.getByRole('button', { name: 'Ver detalle: Tipo de trabajo' });
    await boton.click();
    const ventana = page.locator('#ventanaIndicador');
    await expect(ventana).toBeVisible();
    // Crece desde la tarjeta: la caja arranca escalada (solo transform y opacity)
    const escalada = await ventana.locator('.modal-content').evaluate(el =>
        el.getAnimations().some(a => a.effect.getKeyframes().some(k => /scale/.test(k.transform || ''))));
    expect(escalada).toBe(true);
    await expect(ventana.locator('.detalle-resumen')).toHaveText(
        'En los últimos 7 días se publicaron 6 vacantes que siguen abiertas: 4 más que en los 7 días anteriores (2). Lo que más creció: Empleo (+5).');
    const empleo = ventana.locator('tbody tr', { hasText: 'Empleo' });
    await expect(empleo.locator('td').first()).toHaveText(/^6\s*67 %$/);
    await expect(empleo.locator('td').nth(1)).toContainText('5 más que la semana anterior');
    await expect(empleo.getByRole('link', { name: 'Empleo' })).toHaveAttribute('href', 'oportunidades.html?tipo=empleo');
    await expect(ventana.locator('tbody tr', { hasText: 'Práctica' }).locator('td').nth(1)).toContainText('2 menos que la semana anterior');
    // Escape la cierra y el foco vuelve al botón
    await page.keyboard.press('Escape');
    await expect(ventana).toHaveCount(0);
    await expect(boton).toBeFocused();
});

test('con movimiento reducido el detalle aparece sin animarse', async ({ page, context, api }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await entrarComo(context, 'visitante');
    await page.goto('dashboard.html');
    await page.getByRole('button', { name: 'Ver detalle: Dónde se trabaja' }).click();
    const caja = page.locator('#ventanaIndicador .modal-content');
    await expect(caja).toBeVisible();
    expect(await caja.evaluate(el => el.getAnimations().length)).toBe(0);
});

test('las habilidades cuentan sobre las vacantes recientes y llevan a buscarlas', async ({ page, context, api }) => {
    await entrarComo(context, 'visitante');
    await page.goto('dashboard.html');
    await page.getByRole('button', { name: 'Ver detalle: Habilidades más pedidas' }).click();
    const ventana = page.locator('#ventanaIndicador');
    await expect(ventana.locator('thead')).toContainText('En las 200 recientes');
    await expect(ventana.getByRole('link', { name: 'Atención al cliente' })).toHaveAttribute('href', 'oportunidades.html?q=Atenci%C3%B3n%20al%20cliente');
});

test('si la muestra no llega a la semana anterior, no inventa la comparación', async ({ page, context, api }) => {
    // 200 vacantes de los últimos 10 días: la muestra no alcanza 14 días atrás
    const { haceDias } = require('../apoyo/datos');
    const base = api.estado.datos.vacantes.find(j => j.id === 'j-mesero');
    for (let i = 0; i < 200; i++) {
        api.estado.datos.vacantes.push({ ...base, id: 'j-extra-' + i, postedDate: haceDias(i % 10), createdAt: haceDias(i % 10) });
    }
    await entrarComo(context, 'visitante');
    await page.goto('dashboard.html');
    await page.getByRole('button', { name: 'Ver detalle: Tipo de trabajo' }).click();
    const ventana = page.locator('#ventanaIndicador');
    await expect(ventana.locator('.detalle-resumen')).toContainText('Todavía no hay datos de la semana anterior para comparar.');
    await expect(ventana.locator('.cambio')).toHaveCount(0);
    await expect(ventana.locator('thead')).toContainText('Nuevas en 7 días');
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
