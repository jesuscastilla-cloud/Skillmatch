// La tarjeta del inicio ahora es una escena isometrica animada (assets/js/escenas.js):
// las habilidades viajan de tu casa al hotel de la vacante. Se mueve sola, sin controles.
const { test, expect, entrarComo } = require('../apoyo/prueba');

const ESCENARIO = '.hero-demo .escenario';

// Animaciones de la linea de tiempo de escenas.js: una corta por pieza, todas con el mismo reloj
// (no cuenta la vida de fondo en CSS: autos, arboles, particulas)
const lineaDeTiempo = page => page.locator(ESCENARIO).evaluate(el =>
    el.getAnimations({ subtree: true })
        .filter(a => !(a instanceof CSSAnimation) && a.effect)
        .map(a => a.playState));

test.describe('escena del inicio', () => {
    test('se dibuja y se mueve sola, sin tarjeta ni controles', async ({ page, context, api }) => {
        await entrarComo(context, 'visitante');
        await page.goto('index.html');
        const escenario = page.locator(ESCENARIO);
        await escenario.scrollIntoViewIfNeeded();
        expect(await escenario.locator('polygon').count()).toBeGreaterThan(50);
        await expect.poll(async () => (await lineaDeTiempo(page)).filter(e => e === 'running').length).toBeGreaterThan(20);
        // Ni el panel de "Pruebalo" ni la barra con Pausar y Repetir
        await expect(page.locator('.hero .demo-skill')).toHaveCount(0);
        await expect(page.locator('.hero').getByRole('button', { name: /Pausar|Repetir/ })).toHaveCount(0);
        // El porcentaje termina en 80
        await page.evaluate(() => window.SkillMatchEscenas.verCuadro(document.querySelector('.hero-demo .escenario'), 7600));
        await expect(escenario.locator('[data-contar]')).toHaveText('80 %');
    });

    test('con "reducir movimiento" queda quieta en su cuadro final', async ({ page, context, api }) => {
        await entrarComo(context, 'visitante');
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto('index.html');
        await page.locator(ESCENARIO).scrollIntoViewIfNeeded();
        await expect(page.locator(ESCENARIO + ' [data-contar]')).toHaveText('80 %');
        expect((await lineaDeTiempo(page)).every(e => e === 'paused')).toBe(true);
    });

    test('se detiene cuando sale de la pantalla y sigue al volver', async ({ page, context, api }) => {
        await entrarComo(context, 'visitante');
        await page.goto('index.html');
        await page.locator(ESCENARIO).scrollIntoViewIfNeeded();
        await expect.poll(async () => (await lineaDeTiempo(page)).some(e => e === 'running')).toBe(true);
        await page.locator('footer.pie').scrollIntoViewIfNeeded();
        await expect.poll(async () => (await lineaDeTiempo(page)).every(e => e === 'paused')).toBe(true);
        await page.locator(ESCENARIO).scrollIntoViewIfNeeded();
        await expect.poll(async () => (await lineaDeTiempo(page)).some(e => e === 'running')).toBe(true);
    });

    test('la escena va sin recuadro: una isla que flota sobre la portada', async ({ page, context, api, errores }) => {
        await entrarComo(context, 'visitante');
        await page.goto('index.html');
        const estilo = await page.locator(ESCENARIO).evaluate(e => { const c = getComputedStyle(e); return { fondo: c.backgroundImage, sombra: c.boxShadow, recorte: c.overflow }; });
        expect(estilo).toEqual({ fondo: 'none', sombra: 'none', recorte: 'visible' });
        // La isla flota: se mueve el dibujo completo (una capa), no sus piezas, y la sombra va en una caja aparte
        expect(await page.locator(ESCENARIO + ' > svg').evaluate(g => getComputedStyle(g).animationName)).toBe('e-isla');
        expect(await page.locator(ESCENARIO).evaluate(e => getComputedStyle(e, '::after').animationName)).toBe('e-isla-sombra');
        expect(await page.locator(ESCENARIO + ' .e-isla').evaluate(g => getComputedStyle(g).animationName)).toBe('none');
        // Al llegar al 80 % saltan chispas alrededor del anillo
        await expect(page.locator(ESCENARIO + ' .e-chispa')).toHaveCount(8);
        expect(errores).toEqual([]);
    });

    test('al bajar, la portada tiene profundidad y la línea de la barra avanza', async ({ page, context, api }, info) => {
        test.skip(info.project.name !== 'escritorio', 'el menú de arriba solo se ve en el computador');
        await entrarComo(context, 'visitante');
        await page.goto('index.html');
        // La línea de avance va en el borde de abajo de la isla (su ::after): al principio, sin estirar
        const avance = () => page.locator('body > header').evaluate(h => new DOMMatrix(getComputedStyle(h, '::after').transform).a);
        expect(await avance()).toBe(0);
        await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'instant' }));
        await expect.poll(avance).toBeGreaterThan(0);
        // El texto baja más despacio que la página (se corre hacia abajo dentro de la portada) y la escena sube
        await expect.poll(() => page.locator('.hero-copy').evaluate(c => parseFloat(getComputedStyle(c).translate.split(' ')[1]) || 0)).toBeGreaterThan(10);
        expect(await page.locator('.hero-demo').evaluate(c => parseFloat(getComputedStyle(c).translate.split(' ')[1]) || 0)).toBeLessThan(-5);
    });

    test('con "reducir movimiento" la portada no se mueve al bajar', async ({ page, context, api }) => {
        await entrarComo(context, 'visitante');
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto('index.html');
        await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'instant' }));
        await page.waitForTimeout(200);
        expect(await page.locator('.hero-copy').evaluate(c => getComputedStyle(c).translate)).toBe('none');
        expect(await page.locator(ESCENARIO + ' > svg').evaluate(g => getComputedStyle(g).animationName)).toBe('none');
    });
});
