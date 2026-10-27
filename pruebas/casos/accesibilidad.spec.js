// Accesibilidad: lo que encontró la auditoría de diseño (auditoria.js, con la
// lista de chequeo de la skill ui-ux-pro-max) y no debe volver a pasar.
const { test, expect, entrarComo } = require('../apoyo/prueba');

test('iniciar sesión sin contraseña dice qué falta y lleva el foco ahí', async ({ page, api }) => {
    await page.goto('login-usuario.html');
    await page.locator('#email').fill('valentina@prueba.test');
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('#error-message')).toHaveText('Escribe tu contraseña.');
    await expect(page.locator('#password')).toBeFocused();
});

test('los buscadores muestran dónde está el foco', async ({ page, api }) => {
    for (const [pagina, campo, capsula] of [['index.html', '.search-input', '.search-box'], ['oportunidades.html', '#searchInput', '.search-bar-main']]) {
        await page.goto(pagina);
        const sombra = () => page.locator(capsula).evaluate(el => getComputedStyle(el).boxShadow);
        const antes = await sombra();
        await page.locator(campo).focus();
        await expect.poll(sombra, pagina).not.toBe(antes);
    }
});

test('los contadores naranjas de no leídos usan texto azul marino', async ({ page, context, api }) => {
    await entrarComo(context, 'persona');
    await page.goto('mensajes.html');
    const insignia = page.locator('.conversation-item[data-user-id="u-andres"] .unread-badge');
    await expect(insignia).toHaveCSS('color', 'rgb(8, 32, 60)');
    await expect(insignia).toHaveCSS('font-size', '12px');
});

test('en Conexiones cada persona es un h2 bajo el h1', async ({ page, context, api }) => {
    await entrarComo(context, 'persona');
    await page.goto('conexiones.html');
    await expect(page.locator('#mis-conexiones .connection-info h2').first()).toHaveText('Andrés Julio');
    await expect(page.locator('#mis-conexiones .connection-info h3')).toHaveCount(0);
});

test('en el celular, un chat abierto conserva su h1', async ({ page, context, api }, info) => {
    test.skip(info.project.name !== 'celular', 'solo en el celular se oculta la lista');
    await entrarComo(context, 'persona');
    await page.goto('mensajes.html?userId=u-digital');
    await expect(page.locator('#chatActive')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mensajes');
    await expect(page.getByRole('heading', { level: 2, name: 'Caribe Digital Estudio' })).toBeAttached();
});

test('en el celular, la barra de pestañas no tapa lo que tiene el foco', async ({ page, context, api }, info) => {
    test.skip(info.project.name !== 'celular', 'la barra de pestañas solo está en el celular');
    await entrarComo(context, 'persona');
    await page.goto('perfil-usuario.html');
    const barra = page.locator('.tabbar');
    await expect(barra).toBeVisible();
    // Dos botones seguidos a media página: el primero con el foco y el segundo
    // justo debajo de lo que se ve. Con Tab, el navegador sube el segundo solo
    // hasta el borde de abajo, que es donde está la barra.
    const listo = await page.evaluate(() => {
        const enfocables = [...document.querySelectorAll('main button, main a[href]')]
            .filter(e => e.getBoundingClientRect().height > 0 && !e.closest('[hidden], [inert]'));
        const i = enfocables.findIndex((e, n) => n > 0 && e.getBoundingClientRect().top + scrollY > innerHeight * 1.5 &&
            e.getBoundingClientRect().top - enfocables[n - 1].getBoundingClientRect().top > 60);
        if (i < 1) return false;
        const destino = enfocables[i];
        document.documentElement.style.scrollBehavior = 'auto';
        window.scrollTo(0, destino.getBoundingClientRect().top + scrollY - innerHeight + 4);
        destino.setAttribute('data-prueba-foco', '');
        enfocables[i - 1].focus({ preventScroll: true });
        return true;
    });
    expect(listo).toBe(true);
    await page.keyboard.press('Tab');
    const boton = page.locator('[data-prueba-foco]');
    await expect(boton).toBeFocused();
    await expect.poll(async () => {
        const [r, b] = await Promise.all([boton.boundingBox(), barra.boundingBox()]);
        return Math.round(r.y + r.height) <= Math.round(b.y);
    }).toBe(true);
});
