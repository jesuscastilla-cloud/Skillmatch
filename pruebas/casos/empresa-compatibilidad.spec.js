// Mi empresa: la compatibilidad de cada persona que se postulo (revision 2026-11-13, hallazgo 8).
const { test, expect, entrarComo } = require('../apoyo/prueba');

test('cada postulación trae su anillo y sus habilidades, y "Más compatibles" la ordena', async ({ page, context, api, errores }) => {
    await entrarComo(context, 'empresa');
    await page.goto('perfil-empresa.html');
    // Despues de "Primeros pasos", las postulaciones van antes que las vacantes y que "Acerca de nosotros"
    const orden = await page.locator('.company-main-area > .content-section-card').evaluateAll(s => s.filter(x => !x.hidden && x.id !== 'primerosPasos').map(x => x.id || x.querySelector('h2').textContent.trim()));
    expect(orden.slice(0, 3)).toEqual(['candidatos', 'ofertas', 'Acerca de nosotros']);

    // Valentina tiene las 3 habilidades que pide "Mesero o mesera"
    const valentina = page.locator('.application-card', { hasText: 'Valentina Herrera' });
    await expect(valentina.locator('.match-ring')).toHaveAttribute('data-pct', '100');
    await expect(valentina.locator('.postulacion-habilidades .skill.is-common')).toHaveCount(3);
    // A Andrés le faltan las de "Recepcionista bilingüe"
    const andres = page.locator('.application-card', { hasText: 'Recepcionista bilingüe' });
    await expect(andres.locator('.match-ring')).toHaveAttribute('data-pct', '0');
    await expect(andres.locator('.skill-falta').first()).toBeVisible();

    await page.locator('#ordenPostulaciones').selectOption('compatibilidad');
    await expect(page.locator('#applications-list .application-card').first()).toContainText('Valentina Herrera');
    expect(errores).toEqual([]);
});
