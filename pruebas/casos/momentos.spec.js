// Momentos con movimiento (revision 2026-11-13): cada mensaje nuevo llega desde su lado
// y aceptar una conexion enciende la chispa del match.
const { test, expect, entrarComo } = require('../apoyo/prueba');

test('mensajes: solo el mensaje nuevo llega animado, y desde su lado', async ({ page, context, api, errores }) => {
    await entrarComo(context, 'persona');
    await page.goto('mensajes.html?userId=u-digital');
    await expect(page.locator('#chatMessages .message').first()).toBeVisible();
    // Al abrir la conversacion no se anima nada
    await expect(page.locator('#chatMessages .message.llega')).toHaveCount(0);
    await page.locator('#messageInput').fill('¿Puedo llevar mi portafolio impreso?');
    await page.locator('#sendMessageBtn').click();
    const nuevo = page.locator('#chatMessages .message.llega');
    await expect(nuevo).toHaveCount(1);
    await expect(nuevo).toHaveClass(/message-sent/);
    await expect(nuevo).toContainText('portafolio impreso');
    expect(errores).toEqual([]);
});

test('conexiones: aceptar una solicitud enciende la chispa', async ({ page, context, api, errores }) => {
    await entrarComo(context, 'persona');
    await page.goto('conexiones.html?tab=solicitudes');
    const aceptar = page.getByRole('button', { name: 'Aceptar' }).first();
    await aceptar.click();
    await expect(page.locator('.chispa-match')).toHaveCount(1);
    await expect(page.locator('.chispa-match')).toHaveCount(0, { timeout: 4000 });
    expect(errores).toEqual([]);
});
