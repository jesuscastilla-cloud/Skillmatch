// Los errores de los formularios quedan unidos a su campo (revision 2026-11-13, hallazgo 7):
// aria-invalid y aria-describedby apuntando al texto del error (WCAG 3.3.1 y 1.3.1).
const { test, expect, entrarComo } = require('../apoyo/prueba');

test('login: el campo que falta queda marcado y se desmarca al escribir', async ({ page, context, api }) => {
    await entrarComo(context, 'visitante');
    await page.goto('login.html');
    await page.locator('#email').fill('valentina@prueba.test');
    await page.locator('#login-btn').click();
    const clave = page.locator('#password');
    await expect(clave).toBeFocused();
    await expect(clave).toHaveAttribute('aria-invalid', 'true');
    await expect(clave).toHaveAttribute('aria-describedby', /error-message/);
    await expect(page.locator('#email')).not.toHaveAttribute('aria-invalid', 'true');
    await clave.fill('x');
    await expect(clave).not.toHaveAttribute('aria-invalid', 'true');
});

test('registro de persona: el correo mal escrito queda marcado, con el foco y su error como descripción', async ({ page, context, api }) => {
    await entrarComo(context, 'visitante');
    await page.goto('registro-usuario.html');
    await page.locator('#usuario-nombre').fill('Ana');
    await page.locator('#usuario-apellidos').fill('Pérez');
    await page.locator('#usuario-email').fill('ana-sin-arroba');
    await page.locator('#usuario-telefono').fill('3001234567');
    await page.locator('#next-step-1').click();
    const correo = page.locator('#usuario-email');
    await expect(correo).toBeFocused();
    await expect(correo).toHaveAttribute('aria-invalid', 'true');
    const id = (await correo.getAttribute('aria-describedby')).split(/\s+/).pop();
    await expect(page.locator('#' + id)).toContainText('Escribe un correo válido');
    await correo.fill('ana@prueba.test');
    await expect(correo).not.toHaveAttribute('aria-invalid', 'true');
});
