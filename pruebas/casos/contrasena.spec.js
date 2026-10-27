// Contraseña nueva (registros y "Cambiar contraseña"): verla, lo que se pide,
// la fuerza en palabras y si coinciden. Solo los 8 caracteres son obligatorios.
const { test, expect, entrarComo } = require('../apoyo/prueba');

const medidor = page => page.locator('.form-group:has(#usuario-pass) .clave-medidor');

test('mientras se escribe, dice cuánto falta, qué se cumple y qué tan fuerte es', async ({ page, api }) => {
    await page.goto('registro-usuario.html');
    await page.locator('#usuario-nombre').fill('Valentina');
    await page.locator('#usuario-email').fill('valentina@prueba.test');
    const clave = page.locator('#usuario-pass');
    await expect(clave).toHaveAttribute('aria-describedby', /usuario-pass-reglas/);

    await clave.fill('abc');
    await expect(medidor(page).locator('.clave-fuerza')).toHaveText('Faltan 5 caracteres');
    await expect(medidor(page).locator('[data-regla="largo"]')).not.toHaveClass(/cumple/);

    await clave.fill('Valentina2026!');
    await expect(medidor(page).locator('.clave-fuerza')).toHaveText('Fuerza: Débil, porque incluye tu nombre o tu correo');

    await clave.fill('Admin@1234');
    await expect(medidor(page).locator('.clave-fuerza')).toHaveText('Fuerza: Débil, porque es muy fácil de adivinar');

    await clave.fill('MiPerro#Toby9');
    await expect(medidor(page).locator('.clave-fuerza')).toHaveText('Fuerza: Fuerte');
    await expect(medidor(page).locator('li.cumple')).toHaveCount(4);
    await expect(medidor(page).locator('[data-regla="simbolo"] [data-estado]')).toHaveText(': cumplido');
    // El lector de pantalla lo oye cuando se deja de escribir
    await expect(medidor(page).locator('[data-anuncio]')).toHaveText('Fuerza: Fuerte');
});

test('el ojo muestra y oculta la contraseña', async ({ page, api }) => {
    await page.goto('registro-usuario.html');
    const clave = page.locator('#usuario-pass');
    await clave.fill('MiPerro#Toby9');
    const ojo = page.locator('.campo-clave-ver[aria-controls="usuario-pass"]');
    await expect(ojo).toHaveAccessibleName('Mostrar contraseña');
    await ojo.click();
    await expect(clave).toHaveAttribute('type', 'text');
    await expect(ojo).toHaveAttribute('aria-pressed', 'true');
    await expect(ojo).toHaveAccessibleName('Ocultar contraseña');
    await expect(clave).toBeFocused();
    await ojo.click();
    await expect(clave).toHaveAttribute('type', 'password');
});

test('al repetirla dice si coinciden; que no, solo al salir del campo', async ({ page, api }) => {
    await page.goto('registro-usuario.html');
    await page.locator('#usuario-pass').fill('MiPerro#Toby9');
    const repetir = page.locator('#usuario-pass2');
    const aviso = page.locator('.clave-coinciden');
    await repetir.fill('MiPerro');
    await expect(aviso).toHaveText(''); // todavía está escribiendo
    await repetir.blur();
    await expect(aviso).toHaveText('Las contraseñas no coinciden');
    await repetir.fill('MiPerro#Toby9');
    await expect(aviso).toHaveText('Las contraseñas coinciden');
});

test('una contraseña débil de 8 o más no bloquea el registro', async ({ page, api }) => {
    await page.goto('registro-usuario.html');
    await page.locator('#usuario-nombre').fill('Ana');
    await page.locator('#usuario-apellidos').fill('Pérez');
    await page.locator('#usuario-email').fill('ana@prueba.test');
    await page.locator('#usuario-telefono').fill('3001234567');
    await page.locator('#usuario-pass').fill('holamundo');
    await page.locator('#usuario-pass2').fill('holamundo');
    await expect(medidor(page).locator('.clave-fuerza')).toHaveText('Fuerza: Débil');
    await page.locator('#next-step-1').click();
    await expect(page.locator('.form-step[data-step="2"]')).toHaveClass(/active/);
});

test('en "Cambiar contraseña" también: ojo en los tres campos y medidor en la nueva', async ({ page, context, api }) => {
    await entrarComo(context, 'persona');
    await page.goto('perfil-usuario.html');
    await page.evaluate(() => SkillMatchUI.cambiarContrasena());
    const ventana = page.locator('#ventanaContrasena');
    await expect(ventana.locator('.campo-clave-ver')).toHaveCount(3);
    await ventana.locator('#claveNueva').fill('Herrera2026#');
    await expect(ventana.locator('.clave-fuerza')).toHaveText('Fuerza: Débil, porque incluye tu nombre o tu correo');
});

test('"Cambiar contraseña" abre lista para escribir: sin error en el primer campo y con los botones de borde a borde', async ({ page, context, api }) => {
    await entrarComo(context, 'persona');
    await page.goto('perfil-usuario.html');
    await page.evaluate(() => SkillMatchUI.cambiarContrasena());
    const actual = page.locator('#claveActual');
    // Antes, el ojo movía el campo, le quitaba el foco y lo marcaba como error sin haber escrito nada
    await expect(actual).toBeFocused();
    await expect(actual).not.toHaveClass(/is-invalid/);
    // La franja de los botones es el pie de la ventana (antes, una caja suelta con margen).
    // Se mide cuando la ventana termino de subir y las dos cajas en el mismo instante:
    // con la suite cargando el equipo, dos consultas separadas caian en momentos distintos de la subida
    const { caja, pie } = await page.locator('#ventanaContrasena').evaluate(async ventana => {
        await Promise.all(ventana.getAnimations({ subtree: true }).map(a => a.finished));
        const caja = ventana.querySelector('.modal-content').getBoundingClientRect();
        const pie = ventana.querySelector('.modal-actions').getBoundingClientRect();
        return { caja: caja.toJSON(), pie: pie.toJSON() };
    });
    expect(Math.abs(pie.x - caja.x)).toBeLessThan(1.5);
    expect(Math.abs(pie.width - caja.width)).toBeLessThan(1.5);
    expect(Math.abs((pie.y + pie.height) - (caja.y + caja.height))).toBeLessThan(1.5);
});
