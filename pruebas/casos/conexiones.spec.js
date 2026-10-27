// Conexiones: las tarjetas no se enciman en el celular.
const { test, expect, entrarComo } = require('../apoyo/prueba');

test('la tarjeta de una conexión deja espacio al nombre y pone los botones abajo en el celular', async ({ page, context, api }, info) => {
    await entrarComo(context, 'persona');
    await page.goto('conexiones.html');
    const tarjeta = page.locator('.connection-card').first();
    await expect(tarjeta).toContainText('Andrés Julio');
    const datos = await tarjeta.locator('.connection-info').boundingBox();
    const botones = await tarjeta.locator('.connection-actions').boundingBox();
    expect(datos.width).toBeGreaterThan(150);
    if (info.project.name === 'celular') {
        expect(botones.y).toBeGreaterThanOrEqual(datos.y + datos.height - 1);
    } else {
        expect(Math.abs(botones.y + botones.height / 2 - (datos.y + datos.height / 2))).toBeLessThan(40);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
});
