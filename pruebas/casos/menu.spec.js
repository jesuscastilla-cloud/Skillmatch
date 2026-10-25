// El menú marca la sección en la que se está y su línea se desliza con el mouse.
// En el celular el menú de arriba se esconde (va la barra de pestañas).
const { test, expect, entrarComo } = require('../apoyo/prueba');

test.beforeEach(async ({}, info) => {
    test.skip(info.project.name !== 'escritorio', 'el menú de arriba solo se ve en el computador');
});

const enlace = (page, texto) => page.locator('header .nav-left .nav-links a', { hasText: texto });
const irA = (page, id) => page.evaluate(i => document.getElementById(i).scrollIntoView({ block: 'start', behavior: 'instant' }), id);

test('la portada marca "Cómo funciona" al llegar y vuelve a "Inicio" arriba', async ({ page, context, api }) => {
    await entrarComo(context, 'visitante');
    await page.goto('index.html');
    await expect(enlace(page, 'Inicio')).toHaveClass(/active-nav/);
    await irA(page, 'como-funciona');
    await expect(enlace(page, 'Cómo funciona')).toHaveClass(/active-nav/);
    await expect(enlace(page, 'Inicio')).not.toHaveClass(/active-nav/);
    // Para el lector de pantalla la página sigue siendo la actual
    await expect(enlace(page, 'Inicio')).toHaveAttribute('aria-current', 'page');
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await expect(enlace(page, 'Inicio')).toHaveClass(/active-nav/);
    await expect(enlace(page, 'Cómo funciona')).not.toHaveClass(/active-nav/);
});

test('en Mi empresa se marcan "Mis ofertas" y "Candidatos" al llegar', async ({ page, context, api }) => {
    await entrarComo(context, 'empresa');
    await page.goto('perfil-empresa.html');
    await expect(page.locator('#applications-list .application-card').first()).toBeVisible();
    await irA(page, 'ofertas');
    await expect(enlace(page, 'Mis ofertas')).toHaveClass(/active-nav/);
    await irA(page, 'candidatos');
    await expect(enlace(page, 'Candidatos')).toHaveClass(/active-nav/);
    await expect(enlace(page, 'Mis ofertas')).not.toHaveClass(/active-nav/);
});

test('la línea se desliza hasta el enlace bajo el mouse y vuelve a la página', async ({ page, context, api }) => {
    await entrarComo(context, 'visitante');
    await page.goto('index.html');
    const linea = page.locator('.nav-linea');
    const debajoDe = async texto => {
        const [l, a] = await Promise.all([linea.boundingBox(), enlace(page, texto).boundingBox()]);
        // Empieza donde empieza el texto del enlace (sin su relleno) y queda debajo
        return l && a && Math.abs(l.x - (a.x + 12)) < 3 && l.y > a.y + a.height;
    };
    await expect.poll(() => debajoDe('Inicio')).toBe(true);
    await enlace(page, 'Vacantes').hover();
    await expect.poll(() => debajoDe('Vacantes')).toBe(true);
    await page.mouse.move(900, 500);
    await expect.poll(() => debajoDe('Inicio')).toBe(true);
    // Con ella, la línea fija de cada enlace no se dibuja (no salen dos)
    expect(await enlace(page, 'Inicio').evaluate(a => getComputedStyle(a, '::after').display)).toBe('none');
});

test('con movimiento reducido no hay línea que se deslice: queda la fija', async ({ page, context, api }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await entrarComo(context, 'visitante');
    await page.goto('index.html');
    await expect(enlace(page, 'Inicio')).toHaveClass(/active-nav/);
    await expect(page.locator('.nav-linea')).toHaveCount(0);
    expect(await enlace(page, 'Inicio').evaluate(a => getComputedStyle(a, '::after').display)).not.toBe('none');
});
