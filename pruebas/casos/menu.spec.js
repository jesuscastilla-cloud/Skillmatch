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

test('la pastilla se desliza hasta el enlace bajo el mouse y vuelve a la página', async ({ page, context, api }) => {
    await entrarComo(context, 'visitante');
    await page.goto('index.html');
    const pastilla = page.locator('.nav-pastilla');
    // La pastilla cubre justo el enlace (mismo inicio y mismo ancho)
    const sobre = async texto => {
        const [p, a] = await Promise.all([pastilla.boundingBox(), enlace(page, texto).boundingBox()]);
        return !!(p && a && Math.abs(p.x - a.x) < 1.5 && Math.abs(p.width - a.width) < 1.5 && Math.abs(p.y - a.y) < 1.5);
    };
    await expect.poll(() => sobre('Inicio')).toBe(true);
    await enlace(page, 'Vacantes').hover();
    await expect.poll(() => sobre('Vacantes')).toBe(true);
    await page.mouse.move(900, 500);
    await expect.poll(() => sobre('Inicio')).toBe(true);
    // Con ella, el enlace activo no lleva su pastilla fija (no salen dos)
    expect(await enlace(page, 'Inicio').evaluate(a => getComputedStyle(a).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
});

// La barra es una isla flotante (app.css, sección 48): una cápsula azul noche separada de los bordes,
// igual en el tema claro y en el oscuro, arriba y al bajar, y en todas las páginas
const aspecto = page => page.locator('body > header').evaluate(h => {
    const c = getComputedStyle(h), r = h.getBoundingClientRect();
    return { fondo: c.backgroundColor, radio: parseFloat(c.borderTopLeftRadius), alto: Math.round(r.height), arriba: Math.round(r.top), izquierda: Math.round(r.left) };
});

test('la barra es una isla flotante de vidrio: cápsula que no toca los bordes, con el menú centrado y sin iconos', async ({ page, context, api }, info) => {
    test.skip(info.project.name !== 'escritorio', 'en celular el menú va en la barra de abajo');
    await entrarComo(context, 'visitante');
    await page.goto('empresas.html');
    const isla = await aspecto(page);
    expect(isla.fondo).toBe('rgba(9, 24, 44, 0.78)');          // vidrio ahumado azul noche, aunque la página sea clara
    expect(await page.locator('body > header').evaluate(h => getComputedStyle(h).backdropFilter)).toContain('blur');
    expect(isla.radio).toBeGreaterThanOrEqual(20);            // puntas redondas
    expect(isla.arriba).toBeGreaterThanOrEqual(6);            // separada del borde de arriba...
    expect(isla.izquierda).toBeGreaterThanOrEqual(10);        // ...y de los lados
    expect(isla.alto).toBe(56);
    const [menu, barra] = await Promise.all([page.locator('header .nav-principales').boundingBox(), page.locator('header > nav').boundingBox()]);
    expect(Math.abs((menu.x + menu.width / 2) - (barra.x + barra.width / 2))).toBeLessThan(8);
    // Las opciones son solo texto, sin icono
    await expect(page.locator('header .nav-principales a')).toHaveCount(4);
    await expect(page.locator('header .nav-principales a .ico')).toHaveCount(0);
    // Adentro, todo va en claro: el logo, la opción activa en blanco con su línea turquesa debajo, y
    // "Iniciar sesión" como enlace de texto (sin borde ni fondo) junto al botón turquesa
    await expect(page.locator('header .logo img')).toHaveAttribute('src', /logo-oscuro\.png$/);
    expect(await enlace(page, 'Empresas').evaluate(a => getComputedStyle(a).color)).toBe('rgb(255, 255, 255)');
    const entrar = await page.locator('.btn-login').evaluate(a => { const c = getComputedStyle(a); return { color: c.color, fondo: c.backgroundColor, borde: c.borderTopColor }; });
    expect(entrar).toEqual({ color: 'rgb(255, 255, 255)', fondo: 'rgba(0, 0, 0, 0)', borde: 'rgba(0, 0, 0, 0)' });
    // La línea de la opción activa queda debajo de la palabra, separada de ella
    const [linea, palabra] = await Promise.all([
        page.locator('.nav-pastilla').evaluate(p => { const r = p.getBoundingClientRect(), d = getComputedStyle(p, '::after'); return r.bottom - parseFloat(d.bottom) - parseFloat(d.height); }),
        enlace(page, 'Empresas').evaluate(a => { const r = document.createRange(); r.selectNodeContents(a); return r.getBoundingClientRect().bottom; })
    ]);
    expect(linea - palabra).toBeGreaterThanOrEqual(3);
    expect(await page.locator('header .nav-principales').evaluate(u => getComputedStyle(u).backgroundImage)).toBe('none');
});

test('la isla no cambia al bajar por el inicio ni al pasar a otra página', async ({ page, context, api }, info) => {
    test.skip(info.project.name !== 'escritorio', 'en celular el menú va en la barra de abajo');
    await entrarComo(context, 'visitante');
    await page.goto('index.html');
    // El azul de la portada llega hasta arriba, detrás de la isla
    expect(await page.locator('.hero').evaluate(h => Math.round(h.getBoundingClientRect().top))).toBeLessThanOrEqual(1);
    const arriba = await aspecto(page);
    expect(await enlace(page, 'Inicio').evaluate(a => getComputedStyle(a).color)).toBe('rgb(255, 255, 255)');
    await expect(page.locator('header .logo img')).toHaveAttribute('src', /logo-oscuro\.png$/);
    // Ya fuera de la portada, sobre las secciones claras: la misma isla, en el mismo sitio
    await page.evaluate(() => window.scrollTo(0, document.querySelector('.hero').offsetHeight + 400));
    await expect(page.locator('body > header')).not.toHaveClass(/sobre-hero/);
    expect(await aspecto(page)).toEqual(arriba);
    await expect(page.locator('header .logo img')).toHaveAttribute('src', /logo-oscuro\.png$/);
    expect(await page.locator('.btn-login').evaluate(a => getComputedStyle(a).color)).toBe('rgb(255, 255, 255)');
    // Y en otra página, igual
    await page.goto('oportunidades.html');
    expect(await aspecto(page)).toEqual(arriba);
});

test('con movimiento reducido no hay pastilla que se deslice: el enlace activo lleva su subrayado fijo', async ({ page, context, api }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await entrarComo(context, 'visitante');
    await page.goto('empresas.html');
    await expect(enlace(page, 'Empresas')).toHaveClass(/active-nav/);
    await expect(page.locator('.nav-pastilla')).toHaveCount(0);
    expect(await enlace(page, 'Empresas').evaluate(a => getComputedStyle(a).boxShadow)).not.toBe('none');
});
