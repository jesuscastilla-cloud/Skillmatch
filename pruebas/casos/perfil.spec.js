// Perfil de persona: la cabecera (foto, nombre, botones y portada)
const { test, expect, entrarComo } = require('../apoyo/prueba');

test('la foto va montada justo a la mitad de la portada y, en el computador, los botones quedan al lado del nombre', async ({ page, context, api }, info) => {
    await entrarComo(context, 'persona');
    await page.goto('perfil-usuario.html');
    await expect(page.locator('#userName')).not.toHaveText('Cargando...');
    const [portada, foto, nombre, botones] = await Promise.all(
        ['.profile-cover', '.profile-avatar', '.profile-name-section', '.perfil-acciones'].map(s => page.locator(s).boundingBox()));
    const escritorio = info.project.name === 'escritorio';
    expect(foto.width).toBe(escritorio ? 152 : 112);
    expect(Math.abs((portada.y + portada.height - foto.y) - foto.height / 2), 'la mitad sobre la portada').toBeLessThan(1.5);
    if (escritorio) {
        // Con cuatro botones bajaban debajo del nombre y la foto parecía más alta que todo:
        // ahora van "Editar perfil", "Hoja de vida en PDF" y "Más", en una fila
        expect(botones.x, 'a la derecha del nombre').toBeGreaterThanOrEqual(nombre.x + nombre.width - 1);
        expect(botones.y).toBeLessThan(nombre.y + nombre.height);
        const alto = (await page.locator('#editProfileBtn').boundingBox()).height;
        expect(botones.height, 'una sola fila').toBeLessThan(alto * 1.5);
    }
});

test('"Más" abre un menú con las otras opciones, que se usa con el teclado', async ({ page, context, api }) => {
    await entrarComo(context, 'persona');
    await page.goto('perfil-usuario.html');
    const mas = page.locator('#perfilMasBtn');
    const menu = page.locator('#perfilMasMenu');
    await expect(menu).toBeHidden();
    await mas.click();
    await expect(menu).toBeVisible();
    await expect(mas).toHaveAttribute('aria-expanded', 'true');
    await expect(menu.getByRole('menuitem')).toHaveText(['Cambiar contraseña', 'Llenar con mi hoja de vida']);
    await expect(page.locator('#changePasswordBtn')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('#importarCvBtn')).toBeFocused();
    // Escape cierra y vuelve a "Más"
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(mas).toBeFocused();
    await expect(mas).toHaveAttribute('aria-expanded', 'false');
    // Elegir una opción hace lo suyo y cierra el menú
    await mas.click();
    await page.locator('#changePasswordBtn').click();
    await expect(page.locator('#ventanaContrasena')).toBeVisible();
    await expect(menu).toBeHidden();
});

test('un clic afuera cierra el menú, y en el perfil de otra persona no aparece "Más"', async ({ page, context, api }) => {
    await entrarComo(context, 'persona');
    await page.goto('perfil-usuario.html');
    await page.locator('#perfilMasBtn').click();
    await expect(page.locator('#perfilMasMenu')).toBeVisible();
    await page.locator('#userName').click();
    await expect(page.locator('#perfilMasMenu')).toBeHidden();
    await page.goto('perfil-usuario.html?id=u-andres');
    await expect(page.locator('#userName')).toContainText('Andrés');
    await expect(page.locator('#perfilMasBtn')).toBeHidden();
});
