// La ola del pie en las paginas de vidrio. Primero pintaba el color liso de la pagina sobre el pie (franja
// clara de borde recto); despues el pie terminaba en curva con una mascara, pero quieta. Ahora (2026-11-15,
// Luis: "ya tampoco se mueve") el pie no pinta sus primeros 47 px y la ola es el azul del pie con forma de
// ola, que se desliza como la del inicio. Donde lo ultimo es una repisa de vidrio, la repisa sigue debajo.
const { test, expect, entrarComo } = require('../apoyo/prueba');

const leerPie = page => page.locator('body > footer.pie').evaluate(f => {
    const cs = getComputedStyle(f);
    const ola = f.querySelector('.pie-ola');
    const co = getComputedStyle(ola);
    return {
        mascara: cs.maskImage && cs.maskImage !== 'none' ? cs.maskImage : (cs.webkitMaskImage || 'none'),
        ola: co.display,
        formaOla: co.maskImage && co.maskImage !== 'none' ? co.maskImage : (co.webkitMaskImage || 'none'),
        animacion: co.animationName,
        colorDesde: getComputedStyle(f, '::after').top
    };
});

test('en las páginas de vidrio el pie termina en una ola que se desliza, sin franja lisa', async ({ page, context, api }) => {
    await entrarComo(context, 'visitante');
    for (const pagina of ['dashboard.html', 'empresas.html', 'oportunidades.html', 'registro-usuario.html']) {
        await page.goto(pagina);
        await expect(page.locator('body > footer.pie')).toHaveCount(1);
        const pie = await leerPie(page);
        // El pie no se recorta (una mascara no se puede deslizar solo con transform): la ola va encima
        expect(pie.mascara, pagina).toBe('none');
        expect(pie.ola, pagina).toBe('block');
        expect(pie.formaOla, pagina).toContain('svg');
        expect(pie.animacion, pagina).toBe('ola-desliza');
        // El azul del pie empieza debajo de la ola: sobre la curva se ve el fondo de la pagina
        expect(pie.colorDesde, pagina).toBe('47px');
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
