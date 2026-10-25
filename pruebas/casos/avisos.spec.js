// Avisos: "SkillMatch se esta despertando" y la negrita dentro de los avisos.
const { test, expect, entrarComo } = require('../apoyo/prueba');

test('si el servidor tarda, avisa que se está despertando y el aviso se va solo', async ({ page, context, api }) => {
    test.setTimeout(60_000);
    await entrarComo(context, 'visitante');
    api.estado.demora = 6000;
    await page.goto('oportunidades.html', { waitUntil: 'domcontentloaded' });
    const aviso = page.locator('.toast', { hasText: 'SkillMatch se está despertando' });
    await expect(aviso).toBeVisible({ timeout: 8000 });
    api.estado.demora = 0;
    await expect(aviso).toHaveCount(0, { timeout: 30_000 });
});

test('con el servidor rápido no aparece', async ({ page, context, api }) => {
    await entrarComo(context, 'visitante');
    await page.goto('oportunidades.html');
    await page.locator('.btn-ver-detalle').first().waitFor();
    await page.waitForTimeout(4500);
    await expect(page.locator('.toast', { hasText: 'despertando' })).toHaveCount(0);
});

test('la negrita de un aviso tiene el color del aviso', async ({ page, context, api }) => {
    await entrarComo(context, 'visitante');
    await page.goto('index.html');
    await page.evaluate(() => SkillMatchUI.aviso('Postulación enviada a <strong>Hotel Puerta del Mar</strong>.', 'ok'));
    const toast = page.locator('.toast').last();
    const [color, negrita] = await toast.evaluate(t => [getComputedStyle(t).color, getComputedStyle(t.querySelector('strong')).color]);
    expect(negrita).toBe(color);
});
