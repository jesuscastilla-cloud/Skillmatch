// Al cambiar de página: la marca del menú (la línea en el computador, la
// pastilla de la barra de pestañas en el celular) viaja hasta el destino, la
// página cambia cuando llega y las cosas de la nueva entran en fila desde el
// lado de la opción tocada.
const fs = require('fs');
const path = require('path');
const { test, expect, entrarComo } = require('../apoyo/prueba');

const enlace =(page, texto) => page.locator('header .nav-left .nav-links a', { hasText: texto });

// Detiene el cambio de página justo después de que la página reaccionó al
// clic: así queda a la vista la página anterior "mientras carga" la
// siguiente. Si la marca tiene camino por recorrer, ui.js espera a que llegue
// y cambia con SkillMatchUI.irA: se reemplaza para anotar a dónde y cuánto
// después del clic iba a ir. Si no, el enlace sigue solo y lo frena un oyente
// en window (corre después de los de la página). Retener la respuesta no
// sirve: con una navegación pendiente, Playwright espera a que termine antes
// de medir.
const sinCambiarDePagina = page => page.evaluate(() => {
    window.__clic = 0;
    window.__ida = null;
    SkillMatchUI.irA = url => { window.__ida = { url, ms: performance.now() - window.__clic }; };
    document.addEventListener('click', () => { window.__clic = performance.now(); }, true);
    window.addEventListener('click', e => {
        if (e.target instanceof Element && e.target.closest('a[href]')) e.preventDefault();
    });
});
const ida = page => page.evaluate(() => window.__ida);
// Lo que queda anotado para que la página nueva se deslice de ese lado
const direccion = page => page.evaluate(() => JSON.parse(sessionStorage.getItem('skillmatch_deslizar') || 'null'));

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

    test('un enlace del contenido lleva la línea hasta "Vacantes" y la página cambia cuando llega', async ({ page, api }) => {
        await page.goto('index.html');
        await sinCambiarDePagina(page);
        await expect.poll(() => lineaDebajoDe(page, 'Inicio')).toBe(true);
        await page.locator('.hero-actions a[href="oportunidades.html"]').click();
        // Todavía en la portada: la línea ya se fue a "Vacantes"
        await expect.poll(() => lineaDebajoDe(page, 'Vacantes')).toBe(true);
        // La página cambia cuando la línea terminó el recorrido, no antes
        await expect.poll(() => ida(page)).not.toBeNull();
        const viaje = await ida(page);
        expect(viaje.url).toMatch(/oportunidades\.html$/);
        expect(viaje.ms, 'espera a que la línea llegue').toBeGreaterThanOrEqual(300);
        expect(await direccion(page)).toMatchObject({ dir: 'derecha' });
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
        // Con el mouse encima la línea ya había llegado: el enlace sigue enseguida
        expect(await ida(page), 'no espera').toBeNull();
        expect(await direccion(page)).toMatchObject({ dir: 'derecha' });
    });

    // Si la página nueva tarda en pintarse (el computador ocupado con otras
    // pruebas), el navegador se salta la transición: por eso se revisa lo que
    // llega a la página nueva y, aparte, lo que el guion del <head> hace con eso.
    test('la página nueva recibe hacia qué lado deslizarse y lo borra al leerlo', async ({ page, api }) => {
        // Lo anotado, justo antes de que el guion del <head> lo lea
        await page.addInitScript(() => addEventListener('pagereveal', () => {
            window.__anotado = JSON.parse(sessionStorage.getItem('skillmatch_deslizar') || 'null');
        }));
        await page.goto('index.html');
        await page.locator('.hero-actions a[href="oportunidades.html"]').click();
        await expect(page).toHaveURL(/oportunidades\.html$/);
        await expect.poll(() => page.evaluate(() => window.__anotado)).toMatchObject({ dir: 'derecha' });
        expect((await page.evaluate(() => window.__anotado)).a).toMatch(/oportunidades\.html$/);
        expect(await direccion(page), 'se usa una sola vez').toBeNull();
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

    test('la pastilla viaja hasta la pestaña tocada, la página cambia cuando llega y la nueva la trae en su sitio', async ({ page, api }) => {
        await page.goto('index.html');
        await sinCambiarDePagina(page);
        await expect.poll(() => pastillaEn(page, 'Inicio')).toBe(true);
        const vacantes = page.locator('.tabbar a', { hasText: 'Vacantes' });
        await vacantes.click();
        await expect.poll(() => pastillaEn(page, 'Vacantes')).toBe(true);
        await expect(vacantes).toHaveClass(/es-destino/);
        // Solo es visual: la página actual sigue siendo la portada
        await expect(page.locator('.tabbar a[aria-current="page"]')).toHaveText('Inicio');
        // La página cambia cuando la pastilla terminó el recorrido, no antes
        await expect.poll(() => ida(page)).not.toBeNull();
        const viaje = await ida(page);
        expect(viaje.url).toMatch(/oportunidades\.html$/);
        expect(viaje.ms, 'espera a que la pastilla llegue').toBeGreaterThanOrEqual(300);
        expect(await direccion(page)).toMatchObject({ dir: 'derecha' });
        await page.goto('oportunidades.html');
        await expect.poll(() => pastillaEn(page, 'Vacantes')).toBe(true);
        // Llega quieta: no cruza la barra otra vez
        expect(await page.locator('.tabbar-marca').evaluate(m => m.getAnimations().length)).toBe(0);
        // Hacia una pestaña de la izquierda, la dirección es la otra
        await sinCambiarDePagina(page);
        await page.locator('.tabbar a', { hasText: 'Inicio' }).click();
        await expect.poll(() => direccion(page)).toMatchObject({ dir: 'izquierda' });
    });

    test('en una página fuera de la barra no hay pastilla hasta tocar una', async ({ page, api }) => {
        await page.goto('empresas.html');
        await sinCambiarDePagina(page);
        await expect(page.locator('.tabbar-marca')).toHaveCSS('opacity', '0');
        await page.locator('.tabbar a', { hasText: 'Vacantes' }).click();
        await expect(page.locator('.tabbar-marca')).toHaveCSS('opacity', '1');
        await expect.poll(() => pastillaEn(page, 'Vacantes')).toBe(true);
        // Aparece sin cruzar la barra: no hay viaje que esperar
        await page.waitForTimeout(500);
        expect(await ida(page)).toBeNull();
    });

    test('con movimiento reducido la pastilla no viaja y la página cambia enseguida', async ({ page, api }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto('index.html');
        await sinCambiarDePagina(page);
        await page.locator('.tabbar a', { hasText: 'Vacantes' }).click();
        await expect.poll(() => pastillaEn(page, 'Vacantes')).toBe(true);
        await page.waitForTimeout(500);
        expect(await ida(page), 'el enlace siguió solo, sin esperar').toBeNull();
    });
});

// Lo que se ve al cambiar de página lo decide el CSS de la transición; se
// revisa con una transición en la misma página, que usa las mismas reglas.
async function animacionesDeTransicion(page, tipos) {
    return page.evaluate(async tipos => {
        const t = document.startViewTransition(tipos ? { update: () => {}, types: tipos } : () => {});
        await t.ready;
        const lista = document.getAnimations()
            .filter(a => a.effect && /^::view-transition/.test(a.effect.pseudoElement || ''))
            .map(a => ({ de: a.effect.pseudoElement, nombre: a.animationName || '' }));
        await t.finished;
        return lista;
    }, tipos);
}

// Lo mismo que hace el navegador al mostrar una página nueva: "pagereveal"
// con la transición que va a correr. Devuelve lo que pasó en la página y
// espera a que se quite la clase de entrada (se quita sola a los 1,4 s).
const mostrarConDireccion = (page, anotado) => page.evaluate(async anotado => {
    sessionStorage.setItem('skillmatch_deslizar', JSON.stringify(Object.assign({ a: location.pathname, t: Date.now() }, anotado)));
    const t = document.startViewTransition(() => {});
    dispatchEvent(new PageRevealEvent('pagereveal', { viewTransition: t }));
    const raiz = document.documentElement;
    const clase = [...raiz.classList].filter(c => c.startsWith('entra-'));
    const desde = getComputedStyle(raiz).getPropertyValue('--desde').trim();
    await t.ready;
    const nombres = document.getAnimations()
        .filter(a => a.effect && /^::view-transition-(old|new)\(root\)$/.test(a.effect.pseudoElement || ''))
        .map(a => a.animationName).sort();
    // Los bloques que entran en fila: cuántos y con cuántos retrasos distintos
    const bloques = document.getAnimations().filter(a => a.animationName === 'bloque-entra');
    const retrasos = new Set(bloques.map(a => a.effect.getTiming().delay)).size;
    // La barra de abajo nueva (ui.js la arma en plena transición) no viaja con la página
    const barra = getComputedStyle(document.querySelector('.tabbar')).visibility;
    await t.finished;
    await new Promise(r => setTimeout(r, 1500));
    return {
        tipos: [...t.types], nombres, clase, desde, bloques: bloques.length, retrasos, barra,
        quedo: sessionStorage.getItem('skillmatch_deslizar'),
        quitada: ![...raiz.classList].some(c => c.startsWith('entra-'))
    };
}, anotado);

test('hacia la derecha la página vieja se corre a la izquierda y se apaga, y la nueva entra por la derecha (y al revés)', async ({ page, context, api }, info) => {
    test.skip(info.project.name !== 'escritorio');
    await entrarComo(context, 'visitante');
    await page.goto('index.html');
    const derecha = await animacionesDeTransicion(page, ['ir-derecha']);
    expect(derecha).toContainEqual({ de: '::view-transition-old(root)', nombre: 'vt-sale-izquierda' });
    expect(derecha).toContainEqual({ de: '::view-transition-new(root)', nombre: 'vt-entra-derecha' });
    const izquierda = await animacionesDeTransicion(page, ['ir-izquierda']);
    expect(izquierda).toContainEqual({ de: '::view-transition-old(root)', nombre: 'vt-sale-derecha' });
    expect(izquierda).toContainEqual({ de: '::view-transition-new(root)', nombre: 'vt-entra-izquierda' });
});

// Si el guion va antes, el navegador puede pintar un primer cuadro sin
// app.css (donde está @view-transition) y se salta la transición: "opt-in
// disabled". Pasaba en 10 de las 18 páginas.
test('en cada página el guion del <head> va después de las hojas de estilo', async ({}, info) => {
    test.skip(info.project.name !== 'escritorio', 'basta con revisarlo una vez');
    const carpeta = path.join(__dirname, '../../SkillMatch/src/pages');
    for (const f of fs.readdirSync(carpeta).filter(f => f.endsWith('.html'))) {
        const head = fs.readFileSync(path.join(carpeta, f), 'utf8').split('</head>')[0];
        const guion = head.indexOf('<script>(function(){var t=');
        expect(guion, f + ' tiene el guion del tema').toBeGreaterThan(0);
        expect(guion, f).toBeGreaterThan(head.lastIndexOf('<link rel="stylesheet"'));
    }
});

test('el guion del <head> vuelve lo anotado el lado por el que entran las cosas, y los bloques llegan en fila', async ({ page, context, api }, info) => {
    test.skip(info.project.name !== 'escritorio');
    await entrarComo(context, 'visitante');
    await page.goto('index.html');

    const izquierda = await mostrarConDireccion(page, { dir: 'izquierda' });
    expect(izquierda).toMatchObject({
        tipos: ['ir-izquierda'], nombres: ['vt-entra-izquierda', 'vt-sale-derecha'], clase: ['entra-izquierda'],
        desde: '-48px', barra: 'hidden', quedo: null, quitada: true
    });
    expect(izquierda.bloques).toBeGreaterThan(2);
    expect(izquierda.retrasos, 'entran uno tras otro, no todos a la vez').toBeGreaterThan(2);

    const derecha = await mostrarConDireccion(page, { dir: 'derecha' });
    expect(derecha).toMatchObject({
        tipos: ['ir-derecha'], nombres: ['vt-entra-derecha', 'vt-sale-izquierda'], clase: ['entra-derecha'],
        desde: '', barra: 'hidden', quedo: null, quitada: true
    });
    expect(derecha.retrasos).toBeGreaterThan(2);

    // Anotado para otra página o hace rato: el fundido de siempre, sin fila
    expect(await mostrarConDireccion(page, { dir: 'derecha', a: '/otra.html' }))
        .toMatchObject({ tipos: [], nombres: ['vt-entrada', 'vt-salida'], clase: [], bloques: 0, barra: 'visible' });
    expect(await mostrarConDireccion(page, { dir: 'derecha', t: Date.now() - 60000 }))
        .toMatchObject({ tipos: [], nombres: ['vt-entrada', 'vt-salida'], clase: [], bloques: 0 });
});

test('la página nueva entra con un fundido que sube', async ({ page, context, api }, info) => {
    test.skip(info.project.name !== 'escritorio');
    await entrarComo(context, 'visitante');
    await page.goto('index.html');
    const anims = await animacionesDeTransicion(page);
    expect(anims).toContainEqual({ de: '::view-transition-new(root)', nombre: 'vt-entrada' });
    expect(anims).toContainEqual({ de: '::view-transition-old(root)', nombre: 'vt-salida' });
    // La barra de arriba no se funde: se ve la de la página anterior, quieta
    // (la nueva sale de visitante hasta que ui.js pone la sesión)
    expect(anims.filter(a => /^::view-transition-(old|new)\(barra-superior\)$/.test(a.de))).toEqual([]);
    expect(await page.evaluate(async () => {
        const t = document.startViewTransition(() => {});
        await t.ready;
        const opacidad = getComputedStyle(document.documentElement, '::view-transition-new(barra-superior)').opacity;
        await t.finished;
        return opacidad;
    })).toBe('0');
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
    // Ni siquiera hacia un lado del menú: también se funde
    const haciaUnLado = await animacionesDeTransicion(page, ['ir-derecha']);
    expect(haciaUnLado).toContainEqual({ de: '::view-transition-new(root)', nombre: 'vt-aparecer' });
    expect(haciaUnLado).toContainEqual({ de: '::view-transition-old(root)', nombre: 'vt-desvanecer' });
    // Y los bloques no entran en fila: llega la clase, pero sin animación
    expect(await mostrarConDireccion(page, { dir: 'derecha' })).toMatchObject({ clase: ['entra-derecha'], bloques: 0 });
});
