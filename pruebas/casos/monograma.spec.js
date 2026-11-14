// «Monograma» (2026-11-13): cada nombre tiene su avatar (dos colores y un patron sacados del nombre),
// el mismo en todas las paginas; donde cabe, dos iniciales; si hay logo, se ve el logo.
const { test, expect, entrarComo } = require('../apoyo/prueba');

const monogramaDe = (locator) => locator.evaluate(e => ({
    a: e.style.getPropertyValue('--mono-a'), b: e.style.getPropertyValue('--mono-b'),
    forma: e.dataset.monoForma, texto: e.textContent.trim(), monograma: e.classList.contains('monograma')
}));

test('el mismo nombre tiene el mismo monograma en todas las páginas, y nombres distintos se distinguen', async ({ page, context, api }) => {
    await entrarComo(context, 'persona');
    await page.goto('empresas.html');
    const hotelEnEmpresas = await monogramaDe(page.locator('.empresa-avatar[data-monograma="Hotel Puerta del Mar"]:visible').first());
    const caribe = await monogramaDe(page.locator('.empresa-avatar[data-monograma="Caribe Digital Estudio"]:visible').first());
    expect(hotelEnEmpresas.monograma).toBe(true);
    expect(hotelEnEmpresas.texto).toBe('HP');
    expect(hotelEnEmpresas.a).not.toBe(caribe.a);
    await page.goto('oportunidades.html');
    const hotelEnVacantes = await monogramaDe(page.locator('.company-logo-opp[data-monograma="Hotel Puerta del Mar"]').first());
    expect({ a: hotelEnVacantes.a, b: hotelEnVacantes.b, forma: hotelEnVacantes.forma }).toEqual({ a: hotelEnEmpresas.a, b: hotelEnEmpresas.b, forma: hotelEnEmpresas.forma });
    // Dos iniciales donde cabe (48 px): "HP", no solo "H"
    expect(hotelEnVacantes.texto).toBe('HP');
});

test('la letra va en blanco sobre los colores del monograma (no el turquesa de antes)', async ({ page, context, api }) => {
    await entrarComo(context, 'persona');
    await page.goto('conexiones.html');
    const avatar = page.locator('.connection-avatar-circle.monograma').first();
    await expect(avatar).toHaveCSS('color', 'rgb(255, 255, 255)');
    expect(await avatar.evaluate(e => getComputedStyle(e).backgroundImage)).toContain('linear-gradient');
});

test('si la empresa tiene logo, se ve el logo sin el monograma detrás', async ({ page, context, api }) => {
    await entrarComo(context, 'persona');
    await page.goto('oportunidades.html');
    const cuadro = page.locator('.company-logo-opp').first();
    await expect(cuadro).toHaveClass(/monograma/);
    // Lo mismo que hace ui.js cuando llega el logo (pintarLogos)
    await cuadro.evaluate(e => { const img = new Image(); img.alt = ''; e.replaceChildren(img); e.classList.add('con-logo'); });
    expect(await cuadro.evaluate(e => getComputedStyle(e).backgroundImage)).toBe('none');
});
