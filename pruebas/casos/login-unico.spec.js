// Un solo inicio de sesion (login.html) con el selector "Busco trabajo / Soy empresa".
// Viene de rediseno.spec.js (PR #24): al deshacer ese PR se conservo el login unico,
// asi que su prueba se conserva aqui.
const { test, expect, entrarComo } = require('../apoyo/prueba');

test.describe('cuenta', () => {
    test('un solo inicio de sesión: el selector cambia los textos y las direcciones viejas llevan ahí', async ({ page, context, api }) => {
        await entrarComo(context, 'visitante');
        await page.goto('login-empresa.html');
        await expect(page).toHaveURL(/login\.html\?tipo=empresa$/);
        await expect(page.locator('.auth-selector [data-tipo="empresa"]')).toHaveAttribute('aria-checked', 'true');
        await expect(page.locator('#loginCrear')).toHaveAttribute('href', 'registro-empresa.html');
        await page.locator('.auth-selector [data-tipo="persona"]').click();
        await expect(page.locator('#loginCrear')).toHaveText('Crear mi perfil');
        await expect(page).toHaveURL(/login\.html$/);
        await page.goto('login-usuario.html');
        await expect(page).toHaveURL(/login\.html$/);
    });

    test('el selector se ve como pastillas: la opción elegida resalta', async ({ page, context, api }) => {
        await entrarComo(context, 'visitante');
        await page.goto('login.html');
        const elegida = page.locator('.auth-selector [data-tipo="persona"]');
        const otra = page.locator('.auth-selector [data-tipo="empresa"]');
        await expect(elegida).toHaveAttribute('aria-checked', 'true');
        // La pastilla blanca es una sola pieza (::before del selector) con sombra, que
        // se desliza hasta la opcion elegida: se compara su posicion con la del boton
        const pastillaSobre = () => page.locator('.auth-selector').evaluate(g => {
            const p = getComputedStyle(g, '::before'), r = g.getBoundingClientRect();
            const m = new DOMMatrixReadOnly(p.transform === 'none' ? undefined : p.transform);
            const izquierda = r.left + g.clientLeft + parseFloat(p.left) + m.m41;
            const sobre = [...g.querySelectorAll('[role="radio"]')].find(b => Math.abs(b.getBoundingClientRect().left - izquierda) < 2);
            return { sombra: p.boxShadow, tipo: sobre ? sobre.dataset.tipo : null };
        });
        await expect.poll(async () => (await pastillaSobre()).tipo).toBe('persona');
        expect((await pastillaSobre()).sombra).not.toBe('none');
        await otra.click();
        await expect.poll(async () => (await pastillaSobre()).tipo).toBe('empresa');
        const alto = await elegida.evaluate(el => el.getBoundingClientRect().height);
        expect(alto).toBeGreaterThanOrEqual(44);
    });

    test('al elegir "Soy empresa" los personajes se ponen la ropa de oficina, y al volver se la quitan', async ({ page, context, api }) => {
        // Los personajes viven en el panel derecho, que en pantallas angostas se esconde
        test.skip(page.viewportSize().width <= 1080, 'el panel de los personajes solo se ve en computador');
        await entrarComo(context, 'visitante');
        await page.goto('login.html');
        const ropa = page.locator('.lp-pj[data-pj="azul"] .lp-ropa');
        const opacidad = () => ropa.evaluate(el => Number(getComputedStyle(el).opacity));
        await expect(page.locator('.lp-pj[data-pj="azul"] .lp-corbata')).toHaveCount(1);
        await expect.poll(opacidad).toBe(0);
        await page.locator('.auth-selector [data-tipo="empresa"]').click();
        await expect(page.locator('.login-personajes')).toHaveAttribute('data-variante', 'empresa');
        await expect.poll(opacidad).toBe(1);
        await page.locator('.auth-selector [data-tipo="persona"]').click();
        await expect(page.locator('.login-personajes')).not.toHaveAttribute('data-variante', 'empresa');
        await expect.poll(opacidad).toBe(0);
    });
});

test.describe('portada e indicadores', () => {
    test('la portada ya no tiene "Lo que viene" ni su enlace en el pie', async ({ page, context, api }) => {
        await entrarComo(context, 'visitante');
        await page.goto('index.html');
        await expect(page.locator('#innovacion')).toHaveCount(0);
        await expect(page.locator('footer a[href*="innovacion"]')).toHaveCount(0);
        await expect(page.getByRole('heading', { name: 'Lo que viene' })).toHaveCount(0);
    });

    test('Indicadores del mercado ya no muestra el informe de Power BI', async ({ page, context, api }) => {
        await entrarComo(context, 'visitante');
        await page.goto('dashboard.html');
        await expect(page.locator('a[href*="powerbi.com"]')).toHaveCount(0);
        await expect(page.getByText('Informe en Power BI')).toHaveCount(0);
    });
});
