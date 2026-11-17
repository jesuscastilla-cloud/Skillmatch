// El menú marca la sección en la que se está con un lente de cristal (2026-11-13).
// En el celular el menú de arriba se esconde (va la barra de pestañas).
const { test, expect, entrarComo } = require('../apoyo/prueba');

test.beforeEach(async ({}, info) => {
    test.skip(info.project.name !== 'escritorio', 'el menú de arriba solo se ve en el computador');
});

const enlace = (page, texto) => page.locator('header .nav-left .nav-links a', { hasText: texto });
const irA = (page, id) => page.evaluate(i => document.getElementById(i).scrollIntoView({ block: 'start', behavior: 'instant' }), id);

// "Cómo funciona" salió del menú (2026-11-12): la sección se ve al bajar por la portada
test('la portada no lleva "Cómo funciona" en el menú e "Inicio" sigue marcado al bajar', async ({ page, context, api }) => {
    await entrarComo(context, 'visitante');
    await page.goto('index.html');
    await expect(enlace(page, 'Cómo funciona')).toHaveCount(0);
    await expect(enlace(page, 'Inicio')).toHaveClass(/active-nav/);
    await irA(page, 'como-funciona');
    await expect(enlace(page, 'Inicio')).toHaveClass(/active-nav/);
    await expect(enlace(page, 'Inicio')).toHaveAttribute('aria-current', 'page');
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

// El lente (2026-11-13, video «Lente»): una cápsula sobre la página actual, centrada en su opción y un poco más
// ancha y alta que ella. Pasar el mouse no la mueve. Desde 2026-11-14, como la burbuja de Apple: quieta es
// un tinte casi transparente detrás de la palabra, y la gota de cristal solo se ve al tocarla o cuando viaja
test('el lente de cristal queda sobre la página actual y el mouse no lo mueve', async ({ page, context, api }) => {
    await entrarComo(context, 'visitante');
    await page.goto('index.html');
    const lente = page.locator('.lente-menu');
    const sobre = async texto => {
        const [p, a] = await Promise.all([lente.boundingBox(), enlace(page, texto).boundingBox()]);
        return !!(p && a && Math.abs((p.x + p.width / 2) - (a.x + a.width / 2)) < 1.5 && Math.abs((p.y + p.height / 2) - (a.y + a.height / 2)) < 1.5 && p.width > a.width && p.height > a.height);
    };
    await expect.poll(() => sobre('Inicio')).toBe(true);
    await expect(lente).toHaveCSS('opacity', '1');
    // Lleva su filo de luz y su brillo, y es redondo del todo
    await expect(lente.locator('.lente-filo')).toHaveCount(1);
    await expect(lente.locator('.lente-brillo')).toHaveCount(1);
    // Quieto: se ve el tinte y no la gota; no lleva filtro (no tuerce las letras) y va detrás de la palabra
    await expect(lente).not.toHaveClass(/levantado/);
    await expect(lente.locator('.lente-reposo')).toHaveCSS('opacity', '1');
    expect(parseFloat(await lente.locator('.lente-cristal').evaluate(c => getComputedStyle(c).opacity))).toBeLessThan(0.01);
    expect(await lente.locator('.lente-cristal').evaluate(c => getComputedStyle(c).backdropFilter)).toBe('none');
    expect(await lente.evaluate(l => getComputedStyle(l).backdropFilter)).toBe('none');
    expect(Number(await lente.evaluate(l => getComputedStyle(l).zIndex))).toBeLessThan(Number(await enlace(page, 'Inicio').evaluate(a => getComputedStyle(a).zIndex)));
    expect(parseFloat(await lente.evaluate(l => getComputedStyle(l).borderTopLeftRadius))).toBeGreaterThanOrEqual(28);
    await enlace(page, 'Vacantes').hover();
    await page.waitForTimeout(400);
    expect(await sobre('Inicio')).toBe(true);
    // Con él, el enlace activo no lleva su subrayado ni su fondo fijo (no salen dos marcas)
    expect(await enlace(page, 'Inicio').evaluate(a => getComputedStyle(a).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
    expect(await enlace(page, 'Inicio').evaluate(a => getComputedStyle(a).boxShadow)).toBe('none');
});

// La barra es una isla flotante y ligera (app.css, sección 94, 2026-11-16): delgada, de vidrio suave que toma el
// color de lo que tiene detrás, las opciones solo con su palabra y la página actual marcada con la chispa naranja
const aspecto = page => page.locator('body > header').evaluate(h => {
    const c = getComputedStyle(h), r = h.getBoundingClientRect();
    return { fondo: c.backgroundColor, radio: parseFloat(c.borderTopLeftRadius), alto: Math.round(r.height), arriba: Math.round(r.top), izquierda: Math.round(r.left) };
});
const chispa = (page, texto) => enlace(page, texto).evaluate(a => {
    const d = getComputedStyle(a, '::after');
    return { display: d.display, fondo: d.backgroundColor, ancho: d.width };
});

test('la barra es una isla flotante ligera: compacta, centrada, con buscador visible y la página actual marcada con la chispa', async ({ page, context, api }, info) => {
    test.skip(info.project.name !== 'escritorio', 'en celular el menú va en la barra de abajo');
    await entrarComo(context, 'visitante');
    await page.goto('empresas.html');
    const isla = await aspecto(page);
    // Tema claro: vidrio claro y suave que deja pasar el color de atrás, sin refracción
    await expect(page.locator('body > header')).not.toHaveClass(/vidrio-oscuro/);
    expect(isla.fondo).toBe('rgba(255, 255, 255, 0.74)');
    expect(await page.locator('body > header').evaluate(h => getComputedStyle(h).backdropFilter)).toMatch(/blur/);
    expect(isla.radio).toBeGreaterThanOrEqual(20);            // puntas redondas
    expect(isla.arriba).toBeGreaterThanOrEqual(6);            // separada del borde de arriba...
    expect(isla.izquierda).toBeGreaterThanOrEqual(10);        // ...y de los lados
    expect(isla.alto).toBe(56);                                // delgada: 56 px
    // Compacta (mide lo que su contenido) y centrada en la ventana
    const caja = await page.locator('body > header').boundingBox();
    expect(caja.width).toBeLessThan(1100);
    expect(Math.abs((caja.x + caja.width / 2) - page.viewportSize().width / 2)).toBeLessThan(2);
    // Las opciones son solo la palabra, en una línea (el icono queda para la barra del celular)
    await expect(page.locator('header .nav-principales a')).toHaveCount(3);   // Inicio, Vacantes, Empresas
    for (const ico of await page.locator('header .nav-principales a .ico').all()) await expect(ico).toBeHidden();
    const altos = await page.locator('header .nav-principales a').evaluateAll(as => as.map(a => a.getBoundingClientRect().height));
    expect(Math.max(...altos)).toBeLessThanOrEqual(40);
    // El buscador, visible y al lado del logo (antes del menú)
    const [logo, buscar, menu] = await Promise.all([page.locator('header .logo').boundingBox(), page.locator('header .nav-buscar .cmdk-boton').boundingBox(), page.locator('header .nav-principales').boundingBox()]);
    expect(buscar.x).toBeGreaterThan(logo.x + logo.width);
    expect(buscar.x + buscar.width).toBeLessThan(menu.x);
    await expect(page.locator('header .nav-buscar .cmdk-texto')).toHaveText('Buscar vacantes');
    // "Tema" es solo su icono; el lector de pantalla oye el nombre del botón
    await expect(page.getByRole('button', { name: /^Cambiar a modo (claro|oscuro)$/ })).toHaveCount(1);
    // La página actual en el azul de la marca, con la chispa naranja debajo; las demás sin chispa
    await expect(page.locator('header .logo img')).toHaveAttribute('src', /logo\.png$/);
    await expect(enlace(page, 'Empresas')).toHaveCSS('color', 'rgb(8, 32, 60)');
    await expect(enlace(page, 'Vacantes')).toHaveCSS('color', 'rgb(58, 85, 115)');
    expect(await chispa(page, 'Empresas')).toEqual({ display: 'block', fondo: 'rgb(255, 118, 24)', ancho: '5px' });
    expect((await chispa(page, 'Vacantes')).fondo).not.toBe('rgb(255, 118, 24)');
    // "Iniciar sesión" como enlace de texto junto al botón turquesa con letra blanca
    const entrar = await page.locator('.btn-login').evaluate(a => { const c = getComputedStyle(a); return { color: c.color, fondo: c.backgroundColor, borde: c.borderTopWidth }; });
    expect(entrar).toEqual({ color: 'rgb(8, 32, 60)', fondo: 'rgba(0, 0, 0, 0)', borde: '0px' });
    expect(await page.locator('header a.btn-register').evaluate(a => getComputedStyle(a).color)).toBe('rgb(255, 255, 255)');
    // El lente sigue debajo de la opción activa, como un tinte casi invisible
    const [lente, opcion] = await Promise.all([page.locator('.lente-menu').boundingBox(), enlace(page, 'Empresas').boundingBox()]);
    expect(lente.x).toBeLessThan(opcion.x);
    expect(lente.x + lente.width).toBeGreaterThan(opcion.x + opcion.width);
    expect(await page.locator('header .nav-principales').evaluate(u => getComputedStyle(u).backgroundImage)).toBe('none');
    // En tema oscuro, el vidrio oscuro con letras claras y el logo claro
    await page.evaluate(() => localStorage.setItem('skillmatch_theme', 'dark'));
    await page.reload();
    expect((await aspecto(page)).fondo).toBe('rgba(10, 26, 46, 0.5)');
    await expect(page.locator('header .logo img')).toHaveAttribute('src', /logo-oscuro\.png$/);
    await expect(enlace(page, 'Empresas')).toHaveCSS('color', 'rgb(255, 255, 255)');
});

test('la isla no cambia de forma ni de lugar al bajar; su vidrio toma el color de lo que tiene detrás', async ({ page, context, api }, info) => {
    test.skip(info.project.name !== 'escritorio', 'en celular el menú va en la barra de abajo');
    await entrarComo(context, 'visitante');
    await page.goto('index.html');
    await expect(page.locator('html')).not.toHaveClass(/isla-(intro|abriendo)/);
    // El azul de la portada llega hasta arriba, detrás de la isla
    expect(await page.locator('.hero').evaluate(h => Math.round(h.getBoundingClientRect().top))).toBeLessThanOrEqual(1);
    const arriba = await aspecto(page);
    // Sobre la ciudad de noche: la opción actual en blanco con su chispa; las demás, claras y más tenues
    await expect(enlace(page, 'Inicio')).toHaveCSS('color', 'rgb(255, 255, 255)');
    await expect(enlace(page, 'Vacantes')).toHaveCSS('color', 'rgba(238, 243, 250, 0.74)');
    expect((await chispa(page, 'Inicio')).display).toBe('block');
    await expect(page.locator('header .logo img')).toHaveAttribute('src', /logo-oscuro\.png$/);
    // Ya fuera de la portada, sobre las secciones claras: la misma isla, en el mismo sitio
    await page.evaluate(() => window.scrollTo(0, document.querySelector('.hero').offsetHeight + 400));
    await expect(page.locator('body > header')).not.toHaveClass(/sobre-hero/);
    // Al bajar la isla se esconde (seccion 78) y al subir un poco vuelve: se compara ya de vuelta
    await page.mouse.wheel(0, -60);
    await expect(page.locator('html')).not.toHaveClass(/barras-escondidas/);
    await page.waitForTimeout(400);
    // Solo cambia el vidrio: oscuro sobre la ciudad, claro sobre lo claro. Ni la forma ni el lugar
    const abajo = await aspecto(page);
    expect(arriba.fondo).toBe('rgba(10, 26, 46, 0.5)');
    await expect(page.locator('body > header')).not.toHaveClass(/vidrio-oscuro/);
    expect(abajo.fondo).toBe('rgba(255, 255, 255, 0.74)');
    delete arriba.fondo; delete abajo.fondo;
    expect(abajo).toEqual(arriba);
    await expect(page.locator('header .logo img')).toHaveAttribute('src', /logo\.png$/);
    expect(await page.locator('.btn-login').evaluate(a => getComputedStyle(a).color)).toBe('rgb(8, 32, 60)');
    // Al volver arriba, sobre la portada oscura, vuelve el vidrio oscuro
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await expect(page.locator('body > header')).toHaveClass(/vidrio-oscuro/);
    await expect(page.locator('header .logo img')).toHaveAttribute('src', /logo-oscuro\.png$/);
    // Y en otra página, igual
    await page.goto('oportunidades.html');
    const otra = await aspecto(page); delete otra.fondo;
    // La isla mide lo que su contenido: entre paginas el borde puede caer 1 pixel corrido al redondear
    expect(Math.abs(otra.izquierda - arriba.izquierda)).toBeLessThanOrEqual(1);
    delete otra.izquierda; delete arriba.izquierda;
    expect(otra).toEqual(arriba);
});

test('con movimiento reducido no hay lente que viaje: el enlace activo lleva su subrayado fijo', async ({ page, context, api }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await entrarComo(context, 'visitante');
    await page.goto('empresas.html');
    await expect(enlace(page, 'Empresas')).toHaveClass(/active-nav/);
    await expect(page.locator('.lente-menu')).toHaveCount(0);
    expect(await enlace(page, 'Empresas').evaluate(a => getComputedStyle(a).boxShadow)).not.toBe('none');
});

// Al pasar por el menu: cada icono hace su gesto (el edificio enciende sus ventanas) y crece un poco; el lente
// no se mueve (2026-11-13, video «Lente»: se mueve con el clic o arrastrándolo)
test('al pasar el mouse cada icono hace su gesto y el lente se queda en la página actual', async ({ page, context, api }, info) => {
    test.skip(info.project.name !== 'escritorio', 'el mouse se prueba en el computador');
    await entrarComo(context, 'visitante');
    await page.goto('oportunidades.html');
    const lenteEn = () => page.locator('.lente-menu').evaluate(l => l.style.transform);
    await expect(page.locator('.lente-menu')).toHaveCSS('opacity', '1');
    const antes = await lenteEn();
    // Los iconos del menu traen sus piezas: el edificio, sus 5 ventanas que se encienden
    await expect(enlace(page, 'Empresas').locator('.nv-luz')).toHaveCount(5);
    await enlace(page, 'Empresas').hover();
    await expect(page.locator('header .nav-principales')).toHaveClass(/con-sobre/);
    await expect.poll(() => enlace(page, 'Empresas').locator('.nv-luz').last().evaluate(v => +getComputedStyle(v).opacity)).toBe(1);
    expect(await lenteEn()).toBe(antes);
    await page.mouse.move(5, 400);
    await expect(page.locator('header .nav-principales')).not.toHaveClass(/con-sobre/);
    expect(await lenteEn()).toBe(antes);
});

test('con "reducir movimiento" los iconos del menú no hacen gestos', async ({ page, context, api }, info) => {
    test.skip(info.project.name !== 'escritorio', 'el mouse se prueba en el computador');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await entrarComo(context, 'visitante');
    await page.goto('oportunidades.html');
    await enlace(page, 'Inicio').hover();
    expect(await enlace(page, 'Inicio').locator('.nv-techo').evaluate(t => getComputedStyle(t).animationName)).toBe('none');
});

// 2026-11-15 (Luis): en la portada, al pasar a tema claro la barra quedaba de vidrio claro (letras oscuras) sobre la
// ciudad de noche. El tema cambia con un efecto (View Transition) y, mientras dura, elementsFromPoint no ve la página
test('en la portada, al pasar a tema claro la barra sigue de vidrio oscuro sobre la ciudad', async ({ page, context, api }) => {
    await entrarComo(context, 'visitante');
    await page.addInitScript(() => { try { localStorage.setItem('skillmatch_theme', 'dark'); } catch (e) { /* sin almacenamiento */ } });
    await page.goto('index.html');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('html')).not.toHaveClass(/isla-(intro|abriendo)/);
    // Como lo hace el botón de tema; se mira a mitad del efecto (la "foto" del tema nuevo) y al final
    // (El cambio empieza un cuadro despues del toque, para que el boton responda al instante: con la maquina
    // ocupada eso puede tardar mas de 150 ms. Se espera a que el tema cambie de verdad y se mira ahi mismo)
    const aMitad = await page.evaluate(async () => {
        const html = document.documentElement;
        const cambio = new Promise(listo => {
            const vigia = new MutationObserver(() => { if (html.dataset.theme === 'light') { vigia.disconnect(); listo(); } });
            vigia.observe(html, { attributes: true, attributeFilter: ['data-theme'] });
            setTimeout(listo, 3000);
        });
        document.querySelector('.theme-toggle').click();
        await cambio;
        await new Promise(listo => setTimeout(listo, 60));
        return { tema: html.dataset.theme, oscuro: document.querySelector('body > header').classList.contains('vidrio-oscuro') };
    });
    expect(aMitad).toEqual({ tema: 'light', oscuro: true });
    await expect(page.locator('html')).not.toHaveClass(/tema-cambiando/);
    await expect(page.locator('body > header')).toHaveClass(/vidrio-oscuro/);
    await expect(page.locator('header .logo img')).toHaveAttribute('src', /logo-oscuro\.png$/);
    // Y de vuelta a tema oscuro: el vidrio oscuro de siempre, sin la marca
    await page.evaluate(() => document.querySelector('.theme-toggle').click());
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('html')).not.toHaveClass(/tema-cambiando/);
    await expect(page.locator('body > header')).not.toHaveClass(/vidrio-oscuro/);
});
