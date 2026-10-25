// Mensajes: lista, fechas y estado, ver perfil de empresa, archivar, eliminar y copiar.
const { test, expect, entrarComo } = require('../apoyo/prueba');

const lista = page => page.locator('#conversationsList .conversation-item h2');
const abrirConversacion = async (page, userId) => {
    await page.locator(`.conversation-item[data-user-id="${userId}"]`).click();
    await expect(page.locator('#chatActive')).toBeVisible();
    await expect(page.locator('#chatMessages .message').first()).toBeVisible();
};
// El menu de un mensaje: con su boton en escritorio; manteniendolo presionado en el celular
const abrirMenuDeMensaje = async (page, mensaje, info) => {
    if (info.project.name === 'celular') {
        await mensaje.locator('.message-content').evaluate(b => {
            const r = b.getBoundingClientRect();
            b.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', clientX: r.left + 10, clientY: r.top + 10, bubbles: true }));
        });
    } else {
        await mensaje.locator('.mensaje-menu').click();
    }
    await expect(page.locator('.menu-acciones')).toBeVisible();
};
const responderPregunta = async (page, si) => page.locator(`#ventanaConfirmar [data-${si ? 'si' : 'no'}]`).click();

test.beforeEach(async ({ context }) => { await entrarComo(context, 'persona'); });

test('la lista muestra a las empresas sin "Empresa" pegado al nombre', async ({ page, api }) => {
    await page.goto('mensajes.html');
    await expect(lista(page)).toHaveText(['Caribe Digital Estudio', 'Andrés Julio']);
});

test('separadores de fecha y palomitas de enviado o leído', async ({ page, api }) => {
    await page.goto('mensajes.html');
    await abrirConversacion(page, 'u-digital');
    const dias = await page.locator('.chat-dia').allTextContents();
    expect(dias.slice(-2)).toEqual(['Ayer', 'Hoy']);
    expect(dias[0]).not.toMatch(/^(Hoy|Ayer)$/);
    await expect(page.locator('.message-estado.es-leido')).toHaveCount(2);
    await expect(page.locator('.message-estado:not(.es-leido)')).toHaveCount(1);
});

test('"Ver perfil" de una empresa lleva a su perfil público', async ({ page, api }) => {
    await page.goto('mensajes.html?userId=u-digital');
    await expect(page.locator('#chatUserStatus')).toHaveText('Empresa');
    await expect.poll(() => page.evaluate(() => perfilConversacion)).toBe('empresa.html?id=c-digital');
    await page.locator('#viewProfileBtn').click();
    await expect(page).toHaveURL(/empresa\.html\?id=c-digital/);
});

test('archivar, ver archivadas y desarchivar', async ({ page, api }) => {
    await page.goto('mensajes.html');
    await abrirConversacion(page, 'u-digital');
    await page.locator('#chatMenuBtn').click();
    await page.locator('.menu-acciones button', { hasText: 'Archivar' }).click();
    await expect(page.locator('#chatActive')).toBeHidden();
    await expect(lista(page)).toHaveText(['Andrés Julio']);
    await expect(page.locator('.conv-archivadas')).toContainText('Archivadas');

    await page.locator('[data-ver-archivadas="1"]').click();
    await expect(lista(page)).toHaveText(['Caribe Digital Estudio']);
    await page.locator('.conversation-item .conv-menu').click();
    await page.locator('.menu-acciones button', { hasText: 'Desarchivar' }).click();
    await expect(lista(page)).toHaveText(['Caribe Digital Estudio', 'Andrés Julio']);
});

test('una archivada vuelve sola cuando llega un mensaje nuevo', async ({ page, api }) => {
    await page.goto('mensajes.html');
    await page.locator('.conversation-item[data-user-id="u-digital"] .conv-menu').click();
    await page.locator('.menu-acciones button', { hasText: 'Archivar' }).click();
    await expect(lista(page)).toHaveText(['Andrés Julio']);
    api.estado.datos.mensajes.push({ id: 'm-nuevo', senderId: 'u-digital', receiverId: 'u-valentina', content: 'Te escribimos para la entrevista.', isRead: false, sentAt: '2999-01-01T09:00:00' });
    await page.evaluate(() => refrescarLista());
    await expect(lista(page)).toHaveText(['Caribe Digital Estudio', 'Andrés Julio']);
});

test('eliminar un mensaje lo borra solo para ti', async ({ page, api }, info) => {
    await page.goto('mensajes.html');
    await abrirConversacion(page, 'u-digital');
    const ultimo = page.locator('#chatMessages .message').last();
    await expect(ultimo).toContainText('¿Cómo va mi proceso?');
    await abrirMenuDeMensaje(page, ultimo, info);
    await page.locator('.menu-acciones button', { hasText: 'Eliminar para mí' }).click();
    await responderPregunta(page, true);
    await expect(page.locator('#chatMessages')).not.toContainText('¿Cómo va mi proceso?');
    const m4 = api.estado.datos.mensajes.find(m => m.id === 'm-4');
    expect(m4 && m4.deletedBySender).toBe(true);
});

test('eliminar una conversación la quita de tu lista y la otra persona la sigue viendo', async ({ page, api }) => {
    await page.goto('mensajes.html');
    await page.locator('.conversation-item[data-user-id="u-andres"] .conv-menu').click();
    await page.locator('.menu-acciones button', { hasText: 'Eliminar conversación' }).click();
    await expect(page.locator('#ventanaConfirmar')).toContainText('Andrés Julio la seguirá viendo');
    await responderPregunta(page, true);
    await expect(lista(page)).toHaveText(['Caribe Digital Estudio']);
    const m5 = api.estado.datos.mensajes.find(m => m.id === 'm-5');
    expect(m5.deletedByReceiver).toBe(true);
    expect(m5.deletedBySender).toBeFalsy();
});

test('copiar un mensaje lo deja en el portapapeles', async ({ page, context, api, browserName }, info) => {
    test.skip(info.project.name !== 'escritorio', 'el portapapeles se prueba en escritorio');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('mensajes.html');
    await abrirConversacion(page, 'u-digital');
    await page.locator('#chatMessages .message').first().locator('.mensaje-menu').click();
    await page.locator('.menu-acciones button', { hasText: 'Copiar' }).click();
    await expect(page.locator('.toast').last()).toContainText('Mensaje copiado.');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('Hola, vi la vacante de desarrollador web.');
});

test('una conversación se abre con el teclado y dice cuántos mensajes hay sin leer', async ({ page, api }) => {
    await page.goto('mensajes.html');
    const andres = page.locator('.conversation-item[data-user-id="u-andres"] .conv-abrir');
    // El lector de pantalla oye "Andrés Julio" y "1 sin leer", no un número suelto
    await expect(andres).toHaveAccessibleName('Andrés Julio');
    await expect(andres).toHaveAccessibleDescription('1 sin leer');
    await andres.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#chatActive')).toBeVisible();
    await expect(andres).toHaveAttribute('aria-current', 'true');
});

test('el menú se maneja con el teclado', async ({ page, api }) => {
    await page.goto('mensajes.html');
    await page.locator('.conversation-item[data-user-id="u-digital"] .conv-menu').click();
    await expect(page.locator('.menu-acciones button').first()).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('.menu-acciones button').nth(1)).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('.menu-acciones')).toHaveCount(0);
    await expect(page.locator('.conversation-item[data-user-id="u-digital"] .conv-menu')).toBeFocused();
});

test('en el celular, mantener presionado un mensaje abre su menú', async ({ page, api }, info) => {
    test.skip(info.project.name !== 'celular', 'solo en pantallas tactiles');
    await page.goto('mensajes.html');
    await abrirConversacion(page, 'u-digital');
    await expect(page.locator('.mensaje-menu').first()).toBeHidden();
    await page.locator('.message-received .message-content').first().evaluate(b => {
        const r = b.getBoundingClientRect();
        b.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', clientX: r.left + 10, clientY: r.top + 10, bubbles: true }));
    });
    await expect(page.locator('.menu-acciones button')).toHaveText(['Copiar', 'Eliminar para mí']);
});
