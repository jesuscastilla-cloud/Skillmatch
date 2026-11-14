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

// El lente (2026-11-13, video «Lente»): una cápsula de cristal sobre la página actual, centrada en su opción y
// un poco más ancha y alta que ella. Pasar el mouse no la mueve
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
    expect(parseFloat(await lente.evaluate(l => getComputedStyle(l).borderTopLeftRadius))).toBeGreaterThanOrEqual(28);
    await enlace(page, 'Vacantes').hover();
    await page.waitForTimeout(400);
    expect(await sobre('Inicio')).toBe(true);
    // Con él, el enlace activo no lleva su subrayado ni su fondo fijo (no salen dos marcas)
    expect(await enlace(page, 'Inicio').evaluate(a => getComputedStyle(a).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
    expect(await enlace(page, 'Inicio').evaluate(a => getComputedStyle(a).boxShadow)).toBe('none');
});

// La barra es una isla flotante (app.css, sección 48): una cápsula azul noche separada de los bordes,
// igual en el tema claro y en el oscuro, arriba y al bajar, y en todas las páginas
const aspecto = page => page.locator('body > header').evaluate(h => {
    const c = getComputedStyle(h), r = h.getBoundingClientRect();
    return { fondo: c.backgroundColor, radio: parseFloat(c.borderTopLeftRadius), alto: Math.round(r.height), arriba: Math.round(r.top), izquierda: Math.round(r.left) };
});

test('la barra es una isla flotante de vidrio: compacta, centrada, con buscador visible y cada opción con su icono encima del texto', async ({ page, context, api }, info) => {
    test.skip(info.project.name !== 'escritorio', 'en celular el menú va en la barra de abajo');
    await entrarComo(context, 'visitante');
    await page.goto('empresas.html');
    const isla = await aspecto(page);
    // Tema claro: vidrio claro que deja pasar el color de atras (2026-11-13, seccion 87)
    await expect(page.locator('body > header')).not.toHaveClass(/vidrio-oscuro/);
    expect(isla.fondo).toBe('rgba(255, 255, 255, 0.5)');
    // Desenfoca: con blur() o, con la refraccion (2026-11-13), dentro de su filtro SVG (url(#...))
    expect(await page.locator('body > header').evaluate(h => getComputedStyle(h).backdropFilter)).toMatch(/blur|url\(/);
    expect(isla.radio).toBeGreaterThanOrEqual(20);            // puntas redondas
    expect(isla.arriba).toBeGreaterThanOrEqual(6);            // separada del borde de arriba...
    expect(isla.izquierda).toBeGreaterThanOrEqual(10);        // ...y de los lados
    expect(isla.alto).toBe(64);                                // 64 px: el logo alineado con el menu y sus cabezas con aire
    // Compacta (mide lo que su contenido, no 1280 px) y centrada en la ventana
    const caja = await page.locator('body > header').boundingBox();
    expect(caja.width).toBeLessThan(1100);
    expect(Math.abs((caja.x + caja.width / 2) - page.viewportSize().width / 2)).toBeLessThan(2);
    // Cada opción con su icono encima del texto (como torre.ai, con nuestro estilo; 2026-11-12)
    await expect(page.locator('header .nav-principales a')).toHaveCount(3);   // Inicio, Vacantes, Empresas
    await expect(page.locator('header .nav-principales a .ico')).toHaveCount(3);
    const encima = await page.locator('header .nav-principales a').evaluateAll(as => as.every(a => {
        const ico = a.querySelector('.ico').getBoundingClientRect(), r = document.createRange();
        r.selectNodeContents(a); const texto = [...r.getClientRects()].pop();
        return ico.bottom <= texto.top + 1 && Math.abs((ico.left + ico.right) / 2 - (texto.left + texto.right) / 2) < 2;
    }));
    expect(encima).toBe(true);
    // El buscador, visible y al lado del logo (antes del menú)
    const [logo, buscar, menu] = await Promise.all([page.locator('header .logo').boundingBox(), page.locator('header .nav-buscar .cmdk-boton').boundingBox(), page.locator('header .nav-principales').boundingBox()]);
    expect(buscar.x).toBeGreaterThan(logo.x + logo.width);
    expect(buscar.x + buscar.width).toBeLessThan(menu.x);
    await expect(page.locator('header .nav-buscar .cmdk-texto')).toHaveText('Buscar vacantes');
    // "Tema" es solo la palabra de abajo: el lector de pantalla oye el nombre del botón, una vez
    await expect(page.getByRole('button', { name: /^Cambiar a modo (claro|oscuro)$/ })).toHaveCount(1);
    // Sobre vidrio claro: el logo normal, la opción activa en azul marino sobre su cápsula clara, y
    // "Iniciar sesión" como enlace de texto (sin borde ni fondo) junto al botón turquesa con letra blanca
    await expect(page.locator('header .logo img')).toHaveAttribute('src', /logo\.png$/);
    expect(await enlace(page, 'Empresas').evaluate(a => getComputedStyle(a).color)).toBe('rgb(8, 32, 60)');
    const entrar = await page.locator('.btn-login').evaluate(a => { const c = getComputedStyle(a); return { color: c.color, fondo: c.backgroundColor, borde: c.borderTopWidth }; });
    expect(entrar).toEqual({ color: 'rgb(8, 32, 60)', fondo: 'rgba(0, 0, 0, 0)', borde: '0px' });
    expect(await page.locator('header a.btn-register').evaluate(a => getComputedStyle(a).color)).toBe('rgb(255, 255, 255)');
    // El lente de la opción activa la cubre entera (icono y palabra), con aire alrededor
    const [lente, opcion] = await Promise.all([page.locator('.lente-menu').boundingBox(), enlace(page, 'Empresas').boundingBox()]);
    expect(lente.x).toBeLessThan(opcion.x);
    expect(lente.x + lente.width).toBeGreaterThan(opcion.x + opcion.width);
    expect(lente.y).toBeLessThan(opcion.y);
    expect(lente.y + lente.height).toBeGreaterThan(opcion.y + opcion.height);
    expect(await page.locator('header .nav-principales').evaluate(u => getComputedStyle(u).backgroundImage)).toBe('none');
    // En tema oscuro, el vidrio oscuro de siempre con letras claras y el logo claro
    await page.evaluate(() => localStorage.setItem('skillmatch_theme', 'dark'));
    await page.reload();
    expect((await aspecto(page)).fondo).toBe('rgba(9, 24, 44, 0.34)');
    await expect(page.locator('header .logo img')).toHaveAttribute('src', /logo-oscuro\.png$/);
    // (espera a que termine el fundido del color)
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
    expect(await enlace(page, 'Inicio').evaluate(a => getComputedStyle(a).color)).toBe('rgb(255, 255, 255)');
    await expect(page.locator('header .logo img')).toHaveAttribute('src', /logo-oscuro\.png$/);
    // Ya fuera de la portada, sobre las secciones claras: la misma isla, en el mismo sitio
    await page.evaluate(() => window.scrollTo(0, document.querySelector('.hero').offsetHeight + 400));
    await expect(page.locator('body > header')).not.toHaveClass(/sobre-hero/);
    // Al bajar la isla se esconde (seccion 78) y al subir un poco vuelve: se compara ya de vuelta
    await page.mouse.wheel(0, -60);
    await expect(page.locator('html')).not.toHaveClass(/barras-escondidas/);
    await page.waitForTimeout(400);
    // Solo cambia el vidrio: sobre la ciudad de noche, oscuro y casi transparente; sobre lo claro, vidrio claro
    // con letras oscuras (seccion 87). Ni la forma ni el lugar
    const abajo = await aspecto(page);
    expect(arriba.fondo).toBe('rgba(9, 24, 44, 0.08)');
    await expect(page.locator('body > header')).not.toHaveClass(/vidrio-oscuro/);
    expect(abajo.fondo).toBe('rgba(255, 255, 255, 0.5)');
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
