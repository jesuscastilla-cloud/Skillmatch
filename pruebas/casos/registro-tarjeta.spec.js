// Registro de persona: la tarjeta se arma mientras escribes (revision 2026-11-13).
const { test, expect, entrarComo } = require('../apoyo/prueba');

test('la tarjeta muestra el nombre, las iniciales y cada habilidad al escribirlas', async ({ page, context, api, errores }, info) => {
    test.skip(info.project.name !== 'escritorio', 'en el celular la tarjeta no se muestra: el formulario va completo');
    await entrarComo(context, 'visitante');
    await page.goto('registro-usuario.html');
    const tarjeta = page.locator('.registro-vista-previa');
    await expect(tarjeta).toBeVisible();
    await expect(tarjeta).toHaveAttribute('aria-hidden', 'true');
    await expect(tarjeta.locator('.vp-nombre')).toHaveText('Tu nombre');
    await page.locator('#usuario-nombre').fill('Ana');
    await page.locator('#usuario-apellidos').fill('Pérez');
    await expect(tarjeta.locator('.vp-nombre')).toHaveText('Ana Pérez');
    await expect(tarjeta.locator('.vp-avatar')).toHaveText('AP');
    // Paso 2: habilidades y ciudad
    await page.locator('#usuario-email').fill('ana@prueba.test');
    await page.locator('#usuario-telefono').fill('3001234567');
    await page.locator('#usuario-pass').fill('una-clave-larga-9');
    await page.locator('#usuario-pass2').fill('una-clave-larga-9');
    await page.locator('#next-step-1').click();
    await page.locator('#usuario-habilidad').fill('Atención al cliente');
    await page.locator('#usuario-habilidad').press('Enter');
    await expect(tarjeta.locator('.vp-habilidad')).toHaveText(['Atención al cliente']);
    await expect(tarjeta.locator('.vp-ciudad')).toContainText('Cartagena de Indias');
    expect(errores).toEqual([]);
});

test('registro de empresa: la tarjeta muestra el nombre, las iniciales y a qué se dedica', async ({ page, context, api, errores }, info) => {
    test.skip(info.project.name !== 'escritorio', 'en el celular la tarjeta no se muestra');
    await entrarComo(context, 'visitante');
    await page.goto('registro-empresa.html');
    const tarjeta = page.locator('.registro-vista-previa');
    await expect(tarjeta.locator('.vp-nombre')).toHaveText('Tu empresa');
    await page.locator('#empresa-email').fill('nueva@prueba.test');
    await page.locator('#empresa-pass').fill('una-clave-larga-9');
    await page.locator('#empresa-pass2').fill('una-clave-larga-9');
    await page.locator('#next-step-emp-1').click();
    await page.locator('#empresa-nombre').fill('Panadería La Esquina');
    await page.locator('#empresa-descripcion').fill('Panadería de barrio en Manga. Buscamos auxiliar de horno.');
    await expect(tarjeta.locator('.vp-nombre')).toHaveText('Panadería La Esquina');
    await expect(tarjeta.locator('.vp-logo')).toHaveText('PL');
    await expect(tarjeta.locator('.vp-descripcion')).toContainText('auxiliar de horno');
    expect(errores).toEqual([]);
});

test('Inicio de la empresa: sus postulaciones nuevas y sus vacantes, sin el buscador de empleo', async ({ page, context, api, errores }) => {
    await entrarComo(context, 'empresa');
    await page.goto('index.html');
    await expect(page.locator('#panelNuevas .panel-postulacion')).toHaveCount(4);
    await expect(page.locator('#panelNuevas')).toContainText('Valentina Herrera');
    await expect(page.locator('#panelTusVacantes .panel-vacante', { hasText: 'Mesero o mesera' })).toContainText('3 personas');
    await expect(page.locator('.search-section')).toBeHidden();
    await expect(page.locator('.cerca-section')).toBeHidden();
    expect(errores).toEqual([]);
});
