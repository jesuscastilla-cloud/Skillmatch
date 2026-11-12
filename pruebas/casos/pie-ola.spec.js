// La ola del pie en las paginas de vidrio: antes pintaba el color liso de la pagina sobre el pie y
// dejaba una franja clara de borde recto entre el vidrio y la ola. Ahora el pie mismo termina en curva
// (mascara) y encima se ve el vidrio; donde lo ultimo es una repisa de vidrio, la repisa sigue debajo.
const { test, expect, entrarComo } = require('../apoyo/prueba');

const leerPie = page => page.locator('body > footer.pie').evaluate(f => {
    const cs = getComputedStyle(f);
    return {
        mascara: cs.maskImage && cs.maskImage !== 'none' ? cs.maskImage : (cs.webkitMaskImage || 'none'),
        ola: getComputedStyle(f.querySelector('.pie-ola')).display
    };
});

test('en las páginas de vidrio el pie termina en curva y no pinta la franja lisa', async ({ page, context, api }) => {
    await entrarComo(context, 'visitante');
    for (const pagina of ['dashboard.html', 'empresas.html', 'oportunidades.html', 'registro-usuario.html']) {
        await page.goto(pagina);
        await expect(page.locator('body > footer.pie')).toHaveCount(1);
        const pie = await leerPie(page);
        expect(pie.mascara, pagina).toContain('svg');
        expect(pie.ola, pagina).toBe('none');
    }
});

test('en los registros la repisa de vidrio sigue 48 px debajo de la ola, sin tapar el texto', async ({ page, context, api }) => {
    await entrarComo(context, 'visitante');
    await page.goto('registro-usuario.html');
    await expect(page.locator('body > footer.pie')).toHaveCount(1);
    const r = await page.evaluate(() => {
        const repisa = document.querySelector('.registro-section').getBoundingClientRect();
        const pie = document.querySelector('body > footer.pie').getBoundingClientRect();
        const ultimo = [...document.querySelectorAll('.registro-section .auth-switch')].pop().getBoundingClientRect();
        return { solape: repisa.bottom - pie.top, aire: pie.top - ultimo.bottom };
    });
    expect(Math.round(r.solape)).toBe(48);
    // La ola ocupa los primeros 48 px del pie: el ultimo texto queda por encima, con espacio
    expect(r.aire).toBeGreaterThan(40);
});

test('la portada y el login de computador siguen con el pie recto', async ({ page, context, api }) => {
    await entrarComo(context, 'visitante');
    await page.goto('index.html');
    await expect(page.locator('body > footer.pie')).toHaveCount(1);
    expect((await leerPie(page)).mascara).toBe('none');
    if (page.viewportSize().width > 1080) {
        await page.goto('login.html');
        await expect(page.locator('body > footer.pie')).toHaveCount(1);
        expect((await leerPie(page)).mascara).toBe('none');
    }
});
