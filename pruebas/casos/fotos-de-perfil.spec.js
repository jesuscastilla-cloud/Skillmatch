// Fotos de perfil de las personas (2026-11-15, pedido de Luis): si la persona tiene foto, se ve su foto (no su
// inicial) en Mensajes (la lista, la cabecera del chat y "Nuevo mensaje") y en Conexiones. ui.js las trae una vez por
// persona (data-logo-cuenta) y, si la pagina ya la tiene en sus datos, la usa sin pedirla (data-foto).
const { test, expect, entrarComo } = require('../apoyo/prueba');

const FOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

test('en Mensajes se ve la foto de perfil de la persona, en la lista y en la cabecera del chat', async ({ page, context, api, errores }) => {
    api.usuario('u-andres').profileImageUrl = FOTO;
    await entrarComo(context, 'persona');
    await page.goto('mensajes.html');
    const enLista = page.locator('.conversation-item[data-user-id="u-andres"] .conversation-avatar');
    await expect(enLista.locator('img')).toHaveAttribute('src', FOTO);
    await expect(enLista).toHaveClass(/con-logo/);
    // Quien no tiene foto sigue con su inicial
    const otro = page.locator('.conversation-item:not([data-user-id="u-andres"]) .conversation-avatar').first();
    await expect(otro.locator('img')).toHaveCount(0);
    // La cabecera del chat: su foto; y al pasar a otra conversación, la inicial de la otra persona (sin foto colada)
    await page.locator('.conversation-item[data-user-id="u-andres"]').click();
    await expect(page.locator('#chatAvatar img')).toHaveAttribute('src', FOTO);
    // (en el celular el chat tapa la lista: primero se vuelve)
    if (await page.locator('#backToListBtn').isVisible()) await page.locator('#backToListBtn').click();
    await page.locator('.conversation-item:not([data-user-id="u-andres"])').first().click();
    await expect(page.locator('#chatAvatar img')).toHaveCount(0);
    await expect(page.locator('#chatAvatar')).not.toHaveClass(/con-logo/);
    expect(errores).toEqual([]);
});

test('en Conexiones se ve la foto de perfil de cada conexión', async ({ page, context, api, errores }) => {
    api.usuario('u-andres').profileImageUrl = FOTO;
    await entrarComo(context, 'persona');
    await page.goto('conexiones.html');
    const tarjeta = page.locator('.connection-card', { hasText: 'Andrés Julio' }).first();
    await expect(tarjeta.locator('.connection-avatar-circle img')).toHaveAttribute('src', FOTO);
    expect(errores).toEqual([]);
});
