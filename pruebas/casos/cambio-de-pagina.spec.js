// Al cambiar de página: la marca del menú (la línea en el computador, la
// pastilla de la barra de pestañas en el celular) se va hasta el destino
// mientras carga la página siguiente, y la página se funde con la nueva.
const { test, expect, entrarComo } = require('../apoyo/prueba');

const enlace = (page, texto) => page.locator('header .nav-left .nav-links a', { hasText: texto });

// Detiene el cambio de página justo después de que la página reaccionó al
// clic (un oyente en window corre después de los de la página): así queda a
// la vista la página anterior "mientras carga" la siguiente. Retener la
// respuesta no sirve: con una navegación pendiente, Playwright espera a que
// termine antes de medir.
const sinCambiarDePagina = page => page.evaluate(() => window.addEventListener('click', e => {
    if (e.target instanceof Element && e.target.closest('a[href]')) e.preventDefault();
}));

// La línea empieza donde empieza el texto del enlace (sin su relleno) y queda debajo
const lineaDebajoDe = async (page, texto) => {
    const [l, a] = await Promise.all([page.locator('.nav-linea').boundingBox(), enlace(page, texto).boundingBox()]);
    return !!(l && a && Math.abs(l.x - (a.x + 12)) < 3 && l.y > a.y + a.height);
};

// La pastilla cubre justo la pestaña
const pastillaEn = async (page, texto) => {
    const [m, a] = await Promise.all([
        page.locator('.tabbar-marca').boundingBox(),
        page.locator('.tabbar a', { hasText: texto }).boundingBox()
    ]);
    return !!(m && a && Math.abs(m.x - a.x) < 1.5 && Math.abs(m.width - a.width) < 1.5);
};

test.describe('en el computador', () => {
    test.beforeEach(async ({ context }, info) => {
        test.skip(info.project.name !== 'escritorio', 'el menú de arriba solo se ve en el computador');
        await entrarComo(context, 'visitante');
    });

    test('un enlace del contenido lleva la línea hasta "Vacantes" mientras carga', async ({ page, api }) => {
        await page.goto('index.html');
        await sinCambiarDePagina(page);
        await expect.poll(() => lineaDebajoDe(page, 'Inicio')).toBe(true);
        await page.locator('.hero-actions a[href="oportunidades.html"]').click();
        // Todavía en la portada: la línea ya se fue a "Vacantes"
        await expect.poll(() => lineaDebajoDe(page, 'Vacantes')).toBe(true);
        // Y en la página nueva está ahí desde el principio
        await page.goto('oportunidades.html');
        await expect.poll(() => lineaDebajoDe(page, 'Vacantes')).toBe(true);
    });

    test('tras el clic, el mouse ya no la devuelve a la página actual', async ({ page, api }) => {
        await page.goto('index.html');
        await sinCambiarDePagina(page);
        await enlace(page, 'Vacantes').hover();
        await expect.poll(() => lineaDebajoDe(page, 'Vacantes')).toBe(true);
        await enlace(page, 'Vacantes').click();
        await page.mouse.move(900, 500);
        await page.waitForTimeout(500);
        expect(await lineaDebajoDe(page, 'Vacantes'), 'sigue en el destino').toBe(true);
    });

    test('un enlace a la misma página no la deja fija (el scroll la sigue moviendo)', async ({ page, api }) => {
        await page.goto('index.html');
        await enlace(page, 'Cómo funciona').click();
        await page.mouse.move(900, 500);
        await expect.poll(() => lineaDebajoDe(page, 'Cómo funciona')).toBe(true);
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
        await expect.poll(() => lineaDebajoDe(page, 'Inicio')).toBe(true);
    });

    test('al volver con "atrás" desde la memoria, la línea vuelve a la página', async ({ page, api }) => {
        await page.goto('index.html');
        await sinCambiarDePagina(page);
        await page.locator('.hero-actions a[href="oportunidades.html"]').click();
        await expect.poll(() => lineaDebajoDe(page, 'Vacantes')).toBe(true);
        // Lo que hace el navegador al sacar la página de la memoria (bfcache)
        await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
        await expect.poll(() => lineaDebajoDe(page, 'Inicio')).toBe(true);
    });
});

test.describe('en el celular', () => {
    test.beforeEach(async ({ context }, info) => {
        test.skip(info.project.name !== 'celular', 'la barra de pestañas es del celular');
        await entrarComo(context, 'persona');
    });

    test('la pastilla se desliza hasta la pestaña tocada y la página nueva la trae en su sitio', async ({ page, api }) => {
        await page.goto('index.html');
        await sinCambiarDePagina(page);
        await expect.poll(() => pastillaEn(page, 'Inicio')).toBe(true);
        const vacantes = page.locator('.tabbar a', { hasText: 'Vacantes' });
        await vacantes.click();
        await expect.poll(() => pastillaEn(page, 'Vacantes')).toBe(true);
        await expect(vacantes).toHaveClass(/es-destino/);
        // Solo es visual: la página actual sigue siendo la portada
        await expect(page.locator('.tabbar a[aria-current="page"]')).toHaveText('Inicio');
        await page.goto('oportunidades.html');
        await expect.poll(() => pastillaEn(page, 'Vacantes')).toBe(true);
        // Llega quieta: no cruza la barra otra vez
        expect(await page.locator('.tabbar-marca').evaluate(m => m.getAnimations().length)).toBe(0);
    });

    test('en una página fuera de la barra no hay pastilla hasta tocar una', async ({ page, api }) => {
        await page.goto('empresas.html');
        await sinCambiarDePagina(page);
        await expect(page.locator('.tabbar-marca')).toHaveCSS('opacity', '0');
        await page.locator('.tabbar a', { hasText: 'Vacantes' }).click();
        await expect(page.locator('.tabbar-marca')).toHaveCSS('opacity', '1');
        await expect.poll(() => pastillaEn(page, 'Vacantes')).toBe(true);
    });
});

// Lo que se ve al cambiar de página lo decide el CSS de la transición; se
// revisa con una transición en la misma página, que usa las mismas reglas.
async function animacionesDeTransicion(page) {
    return page.evaluate(async () => {
        const t = document.startViewTransition(() => {});
        await t.ready;
        const lista = document.getAnimations()
            .filter(a => a.effect && /^::view-transition/.test(a.effect.pseudoElement || ''))
            .map(a => ({ de: a.effect.pseudoElement, nombre: a.animationName || '' }));
        await t.finished;
        return lista;
    });
}

test('la página nueva entra con un fundido que sube', async ({ page, context, api }, info) => {
    test.skip(info.project.name !== 'escritorio');
    await entrarComo(context, 'visitante');
    await page.goto('index.html');
    const anims = await animacionesDeTransicion(page);
    expect(anims).toContainEqual({ de: '::view-transition-new(root)', nombre: 'vt-entrada' });
    expect(anims).toContainEqual({ de: '::view-transition-old(root)', nombre: 'vt-salida' });
});

test('con movimiento reducido no se mueve nada, pero la página igual se funde', async ({ page, context, api }, info) => {
    test.skip(info.project.name !== 'escritorio');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await entrarComo(context, 'visitante');
    await page.goto('index.html');
    const anims = await animacionesDeTransicion(page);
    expect(anims).toContainEqual({ de: '::view-transition-new(root)', nombre: 'vt-aparecer' });
    expect(anims).toContainEqual({ de: '::view-transition-old(root)', nombre: 'vt-desvanecer' });
    expect(anims.filter(a => a.de.startsWith('::view-transition-group')), 'nada se desplaza').toEqual([]);
});
