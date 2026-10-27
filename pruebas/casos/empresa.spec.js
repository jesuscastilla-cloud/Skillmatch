// Mi empresa: "Cerrar sin guardar" en sus ventanas y la ventana de candidatos.
const { test, expect, entrarComo } = require('../apoyo/prueba');

const ventana = page => page.locator('#genericModal');

test.beforeEach(async ({ context }) => { await entrarComo(context, 'empresa'); });

test('"Nueva oferta" sin datos se cierra sin preguntar', async ({ page, api }) => {
    await page.goto('perfil-empresa.html');
    await page.locator('.btn-new-offer').click();
    await expect(ventana(page)).toBeVisible();
    await ventana(page).locator('.btn-secondary-modal').click();
    await expect(ventana(page)).toHaveCount(0);
    await expect(page.locator('#ventanaConfirmar')).toHaveCount(0);
});

test('"Nueva oferta" con algo escrito pregunta antes de cerrarse', async ({ page, api }) => {
    await page.goto('perfil-empresa.html');
    await page.locator('.btn-new-offer').click();
    await page.locator('#offerTitle').fill('Recepcionista de prueba');
    // Tocar afuera de la ventana
    await ventana(page).click({ position: { x: 5, y: 5 } });
    await expect(page.locator('#ventanaConfirmar')).toBeVisible();
    // Escape cierra la pregunta (la de arriba), no la oferta
    await page.keyboard.press('Escape');
    await expect(page.locator('#ventanaConfirmar')).toHaveCount(0);
    await expect(page.locator('#offerTitle')).toHaveValue('Recepcionista de prueba');
    // La X y "Cerrar sin guardar"
    await ventana(page).locator('.modal-close').click();
    await page.locator('#ventanaConfirmar [data-si]').click();
    await expect(ventana(page)).toHaveCount(0);
});

test('"Acerca de nosotros" sin cambios se cierra sin preguntar', async ({ page, api }) => {
    await page.goto('perfil-empresa.html');
    await page.locator('#btnEditAbout').click();
    await expect(ventana(page)).toBeVisible();
    await ventana(page).locator('.btn-secondary-modal').click();
    await expect(ventana(page)).toHaveCount(0);
});

test('?candidatos= abre los candidatos de esa vacante', async ({ page, api }) => {
    await page.goto('perfil-empresa.html?candidatos=j-mesero');
    await expect(ventana(page)).toContainText('Mesero o mesera');
    await expect(ventana(page)).toContainText('Valentina Herrera');
    await expect(ventana(page)).toContainText('Andrés Julio');
});
