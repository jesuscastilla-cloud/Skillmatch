// "¿Cómo funciona?" es una rueda de 4 piezas (assets/js/rueda-pasos.js): al elegir una,
// la rueda gira hasta dejarla junto al texto y se muestra ese paso con su mini escena.
const { test, expect, entrarComo } = require('../apoyo/prueba');

const pieza = (page, n) => page.locator('#cf-pieza-' + n);
const paso = (page, n) => page.locator('#cf-paso-' + n);

async function abrir(page, context) {
    await entrarComo(context, 'visitante');
    await page.goto('index.html');
    await page.locator('#cfRueda').scrollIntoViewIfNeeded();
    await expect(page.locator('#cfRueda')).toHaveClass(/en-vista/);
}

// Dónde quedó la pieza respecto al centro de la rueda: 'derecha', 'abajo', 'izquierda' o 'arriba'
const ladoDe = (page, n) => page.evaluate(n => {
    const r = document.getElementById('cfRueda').getBoundingClientRect();
    const m = document.getElementById('cf-pieza-' + n).getBoundingClientRect();
    const dx = (m.x + m.width / 2) - (r.x + r.width / 2), dy = (m.y + m.height / 2) - (r.y + r.height / 2);
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'derecha' : 'izquierda';
    return dy > 0 ? 'abajo' : 'arriba';
}, n);

// Giro total del icono (el de la rueda más el suyo), en grados: 0 = derecho
const inclinacionDe = (page, n) => page.evaluate(n => {
    const angulo = el => { const m = new DOMMatrix(getComputedStyle(el).transform); return Math.atan2(m.b, m.a) * 180 / Math.PI; };
    const total = angulo(document.querySelector('.cf-rueda-giro')) + angulo(document.getElementById('cf-pieza-' + n));
    return Math.round(Math.abs(((total % 360) + 540) % 360 - 180));
}, n);

test.describe('la rueda de "¿Cómo funciona?"', () => {
    test('tiene una pieza por paso y empieza en el primero, junto al texto', async ({ page, context, api, errores }, info) => {
        await abrir(page, context);
        await expect(page.locator('#cfRueda .cf-seg')).toHaveCount(4);
        await expect(page.getByRole('tab')).toHaveCount(4);
        await expect(pieza(page, 1)).toHaveAttribute('aria-selected', 'true');
        await expect(pieza(page, 1).locator('svg.ico')).toHaveCount(1);
        await expect(paso(page, 1)).toBeVisible();
        for (const n of [2, 3, 4]) await expect(paso(page, n)).toBeHidden();
        await expect(page.locator('.cf-cuenta')).toHaveText('Paso 1 de 4');
        // En el computador la pieza elegida queda a la derecha (el texto va al lado); en el celular, abajo
        const ancla = info.project.name === 'celular' ? 'abajo' : 'derecha';
        await expect.poll(() => ladoDe(page, 1)).toBe(ancla);
        // La rueda no saca la página de su ancho
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        expect(errores).toEqual([]);
    });

    test('al elegir otra pieza la rueda gira, la deja junto al texto y muestra ese paso', async ({ page, context, api }, info) => {
        await abrir(page, context);
        const ancla = info.project.name === 'celular' ? 'abajo' : 'derecha';
        await pieza(page, 3).click();
        await expect(pieza(page, 3)).toHaveAttribute('aria-selected', 'true');
        await expect(pieza(page, 1)).toHaveAttribute('aria-selected', 'false');
        await expect(paso(page, 3)).toBeVisible();
        await expect(paso(page, 3).locator('h3')).toHaveText('Ves tu compatibilidad');
        await expect(paso(page, 1)).toBeHidden();
        await expect(page.locator('.cf-cuenta')).toHaveText('Paso 3 de 4');
        await expect(page.locator('.cf-centro-numeros b.is-activo')).toHaveText('03');
        await expect.poll(() => ladoDe(page, 3)).toBe(ancla);
        // Los iconos quedan derechos aunque la rueda haya girado
        for (const n of [1, 2, 3, 4]) await expect.poll(() => inclinacionDe(page, n)).toBeLessThanOrEqual(1);
        // La pieza elegida se pinta (capa turquesa) y el anillo de la escena llega a 80 %
        await expect.poll(() => page.locator('.cf-seg.is-activo .cf-seg-luz').evaluate(p => getComputedStyle(p).opacity)).toBe('1');
        await expect(paso(page, 3).locator('.match-ring span')).toHaveText('80%');
        // También se puede elegir tocando la pieza misma, no solo su icono
        await page.locator('.cf-seg[data-i="1"]').dispatchEvent('click');
        await expect(pieza(page, 2)).toHaveAttribute('aria-selected', 'true');
        await expect.poll(() => ladoDe(page, 2)).toBe(ancla);
    });

    test('el centro pasa al siguiente y las flechas van y vuelven, dando la vuelta', async ({ page, context, api }) => {
        await abrir(page, context);
        await page.getByRole('button', { name: 'Ir al paso siguiente' }).click();
        await expect(paso(page, 2)).toBeVisible();
        await page.getByRole('button', { name: 'Paso anterior', exact: true }).click();
        await expect(paso(page, 1)).toBeVisible();
        await page.getByRole('button', { name: 'Paso anterior', exact: true }).click();
        await expect(paso(page, 4)).toBeVisible();
        await expect(page.locator('.cf-cuenta')).toHaveText('Paso 4 de 4');
        await page.getByRole('button', { name: 'Paso siguiente', exact: true }).click();
        await expect(paso(page, 1)).toBeVisible();
    });

    test('con el teclado se recorre con las flechas, como un grupo de pestañas', async ({ page, context, api }, info) => {
        test.skip(info.project.name !== 'escritorio', 'el teclado se prueba en el computador');
        await abrir(page, context);
        await pieza(page, 1).focus();
        await page.keyboard.press('ArrowRight');
        await expect(pieza(page, 2)).toBeFocused();
        await expect(paso(page, 2)).toBeVisible();
        await page.keyboard.press('End');
        await expect(pieza(page, 4)).toBeFocused();
        await page.keyboard.press('ArrowRight');
        await expect(pieza(page, 1)).toBeFocused();
        await expect(paso(page, 1)).toBeVisible();
        // Solo la pieza elegida entra en el orden del tabulador
        expect(await page.locator('.cf-marca[tabindex="0"]').count()).toBe(1);
    });

    test('da un paseo por los pasos una sola vez y se detiene cuando la persona elige', async ({ page, context, api }) => {
        await page.clock.install();
        await abrir(page, context);
        await page.clock.fastForward(5300);
        await expect(pieza(page, 2)).toHaveAttribute('aria-selected', 'true');
        // Quien elige un paso se queda en él: el paseo no vuelve
        await pieza(page, 4).click();
        await page.clock.fastForward(5300);
        await page.clock.fastForward(5300);
        await expect(pieza(page, 4)).toHaveAttribute('aria-selected', 'true');
    });

    test('si nadie toca nada, el paseo termina donde empezó', async ({ page, context, api }) => {
        await page.clock.install();
        await abrir(page, context);
        for (const n of [2, 3, 4, 1]) {
            await page.clock.fastForward(5300);
            await expect(pieza(page, n)).toHaveAttribute('aria-selected', 'true');
        }
        await page.clock.fastForward(5300);
        await page.clock.fastForward(5300);
        await expect(pieza(page, 1)).toHaveAttribute('aria-selected', 'true');
    });

    test('con "reducir movimiento" no se mueve sola y cambia de golpe', async ({ page, context, api }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.clock.install();
        await abrir(page, context);
        await page.clock.fastForward(5300);
        await page.clock.fastForward(5300);
        await expect(pieza(page, 1)).toHaveAttribute('aria-selected', 'true');
        expect(await page.locator('.cf-rueda-giro').evaluate(g => parseFloat(getComputedStyle(g).transitionDuration))).toBeLessThan(0.01);
        expect(await page.locator('.cf-rueda-orbita').evaluate(o => getComputedStyle(o).animationName)).toBe('none');
        await pieza(page, 2).click();
        await expect(paso(page, 2)).toBeVisible();
    });

    test('sin JavaScript de la rueda, los cuatro pasos se leen en lista', async ({ page, context, api }) => {
        await context.route('**/rueda-pasos.js', ruta => ruta.abort());
        await entrarComo(context, 'visitante');
        await page.goto('index.html');
        for (const n of [1, 2, 3, 4]) await expect(paso(page, n).locator('h3')).toBeVisible();
        await expect(page.locator('.cf-rueda-zona')).toBeHidden();
    });
});
