// Los dos caminos del cierre de la portada son contratos (2026-11-15, app.css seccion 90 e index.js DIPLOMAS):
// una hoja blanca que se desenrolla al llegar a la pantalla (un rollo de papel baja y luego desaparece), una firma que
// se escribe sola y el sello de caucho de SkillMatch que se estampa en la esquina. (Las clases siguen llamandose .diploma: primero fueron diplomas.)
const { test, expect, entrarComo } = require('../apoyo/prueba');

const DIPLOMAS = '.cta-final .pathway-card.diploma';

// Todas las animaciones de un diploma (las del diploma y las de sus piezas)
const animaciones = (page, i) => page.locator(DIPLOMAS).nth(i).evaluate(t =>
    t.getAnimations().concat(Array.from(t.querySelectorAll('*')).flatMap(e => e.getAnimations())).length);

test('cada camino es un contrato con su firma, su sello y los mismos enlaces de siempre', async ({ page, context, api, errores }) => {
    await entrarComo(context, 'visitante');
    await page.goto('index.html');
    await expect(page.locator(DIPLOMAS)).toHaveCount(2);
    for (let i = 0; i < 2; i++) {
        const d = page.locator(DIPLOMAS).nth(i);
        // Un rollo de papel, que solo se ve mientras se desenrolla
        await expect(d.locator('.diploma-rollo')).toHaveCount(1);
        await expect(d.locator('.diploma-sello svg')).toHaveCount(1);
        // La firma: 15 trazos (14 letras de un solo trazo y el rasgo de abajo), cada uno con las 5 copias de la punta
        await expect(d.locator('.diploma-firma path')).toHaveCount(75);
        // El adorno no lo lee el lector de pantalla
        await expect(d.locator('.diploma-pie')).toHaveAttribute('aria-hidden', 'true');
        await expect(d.locator('.diploma-sello')).toHaveAttribute('aria-hidden', 'true');
    }
    // Los enlaces siguen siendo los mismos
    await expect(page.locator(DIPLOMAS).nth(0).getByRole('link', { name: 'Crear mi perfil' })).toHaveAttribute('href', 'registro-usuario.html');
    await expect(page.locator(DIPLOMAS).nth(1).getByRole('link', { name: 'Publicar mis vacantes' })).toHaveAttribute('href', 'login.html?tipo=empresa');
    expect(errores).toEqual([]);
});

test('esperan sin verse hasta llegar a la pantalla; ahí se abren y quedan abiertos, firmados y sellados', async ({ page, context, api, errores }) => {
    await entrarComo(context, 'visitante');
    await page.goto('index.html');
    const primero = page.locator(DIPLOMAS).nth(0);
    // Lejos: no se ve, no se puede tocar, y nada se mueve todavía
    await expect(primero).toHaveClass(/cons-espera/);
    await expect(primero).toHaveCSS('pointer-events', 'none');
    expect(parseFloat(await primero.evaluate(e => getComputedStyle(e).opacity))).toBeLessThan(.01);
    expect(await animaciones(page, 0)).toBe(0);
    // Llega a la pantalla: se abre
    await primero.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await expect(primero).not.toHaveClass(/cons-espera/);
    await expect.poll(() => animaciones(page, 0)).toBeGreaterThan(20);
    // A mitad de la salida, la hoja está corrida hacia arriba y el texto queda quieto en su sitio
    // (la ventana baja y su contenido sube lo mismo)
    const mitad = await primero.evaluate(t => {
        const papel = t.querySelector('.diploma-papel'), hoja = t.querySelector('.diploma-hoja');
        const todas = t.getAnimations().concat(Array.from(t.querySelectorAll('*')).flatMap(e => e.getAnimations()));
        todas.forEach(a => { a.pause(); a.currentTime = 300; });
        const p = new DOMMatrix(getComputedStyle(papel).transform).m42, h = new DOMMatrix(getComputedStyle(hoja).transform).m42;
        todas.forEach(a => a.play());
        return { papel: p, suma: p + h };
    });
    expect(mitad.papel).toBeLessThan(-20);
    expect(Math.abs(mitad.suma)).toBeLessThan(1);
    // Al terminar: abierto, firmado y sellado, y sin las capas extra
    await primero.evaluate(t => t.getAnimations().concat(Array.from(t.querySelectorAll('*')).flatMap(e => e.getAnimations())).forEach(a => a.finish()));
    await expect(primero).not.toHaveClass(/diploma-capas/);
    await expect(primero).toHaveCSS('opacity', '1');
    await expect(primero.locator('.diploma-papel')).toHaveCSS('transform', 'none');
    await expect(primero.locator('.diploma-sello')).toHaveCSS('opacity', '1');
    // El rollo ya se aplanó y no se ve: queda la hoja lisa
    await expect(primero.locator('.diploma-rollo')).toHaveCSS('opacity', '0');
    expect(await primero.locator('.diploma-firma path').first().evaluate(p => getComputedStyle(p).strokeDashoffset)).toBe('0px');
    expect(errores).toEqual([]);
});

test('con "reducir movimiento" los contratos ya están firmados y sellados, sin animación', async ({ page, context, api, errores }) => {
    await entrarComo(context, 'visitante');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('index.html');
    const primero = page.locator(DIPLOMAS).nth(0);
    await primero.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(400);
    await expect(primero).not.toHaveClass(/cons-espera/);
    await expect(primero).toHaveCSS('opacity', '1');
    expect(await animaciones(page, 0)).toBe(0);
    await expect(primero.locator('.diploma-sello')).toBeVisible();
    await expect(primero.locator('.diploma-rollo')).toHaveCSS('opacity', '0');
    // La firma completa (sin el guion que la va dibujando)
    expect(await primero.locator('.diploma-firma path').first().evaluate(p => getComputedStyle(p).strokeDasharray)).toBe('none');
    expect(errores).toEqual([]);
});
