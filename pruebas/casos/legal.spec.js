// Privacidad, politica de datos, declaracion de datos, cookies y terminos
const { test, expect, entrarComo } = require('../apoyo/prueba');

const PAGINAS = [
    ['privacidad.html', 'Tus datos son tuyos'],
    ['politica-datos.html', 'Política de tratamiento de datos personales'],
    ['declaracion-datos.html', 'Declaración de datos'],
    ['cookies.html', 'Política de cookies'],
    ['terminos.html', 'Términos de uso']
];

for (const [archivo, titulo] of PAGINAS) {
    test(`${archivo}: carga completa, navega entre documentos y no deja nada a medias`, async ({ page, context, api, errores }) => {
        await entrarComo(context, 'visitante');
        await page.goto(archivo);
        await expect(page.locator('h1')).toHaveText(titulo);
        // Pastillas para pasar de un documento a otro, con la actual marcada
        await expect(page.locator('.legal-nav a')).toHaveCount(5);
        await expect(page.locator('.legal-nav a[aria-current="page"]')).toHaveAttribute('href', archivo);
        // Nada que parezca un borrador ni datos sin completar
        const texto = await page.locator('main').innerText();
        expect(texto).not.toMatch(/borrador|por completar|demostraci|simulaci|pr[oó]ximamente|lorem/i);
        // Cada enlace del indice lleva a una seccion que existe
        const destinos = await page.locator('.politica-indice a').evaluateAll(as => as.map(a => a.getAttribute('href').slice(1)));
        for (const id of destinos) await expect(page.locator('#' + id)).toHaveCount(1);
        expect(errores).toEqual([]);
    });

    test(`${archivo}: no se desborda en el celular`, async ({ page, context, api }) => {
        await entrarComo(context, 'visitante');
        await page.goto(archivo);
        const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(desborde).toBeLessThanOrEqual(1);
    });
}

test('la ficha del responsable solo muestra los datos que existen', async ({ page, context, api }) => {
    await entrarComo(context, 'visitante');
    await page.goto('politica-datos.html');
    const ficha = page.locator('[data-ficha-responsable]');
    await expect(ficha).toContainText('SkillMatch Cartagena');
    await expect(ficha).toContainText('skillmatchproject@gmail.com');
    await expect(ficha).not.toContainText('NIT');
    // Al escribir el NIT en legal.js, aparece en todas las paginas
    await page.evaluate(() => { window.SkillMatchLegal.datos.nit = '900.000.000-0'; window.SkillMatchLegal.pintar(); });
    await expect(page.locator('[data-ficha-responsable]')).toContainText('NIT o documento');
});

test('las tablas de la declaración de datos dicen qué es cada dato', async ({ page, context, api }) => {
    await entrarComo(context, 'visitante');
    await page.goto('declaracion-datos.html');
    await expect(page.locator('#personas .legal-tabla tbody tr').first()).toContainText('Nombre, apellidos, correo y teléfono');
    await expect(page.locator('#empresas')).toContainText('Datos de pago');
    await expect(page.locator('#terceros')).toContainText('MongoDB Atlas');
    // Cada celda lleva su etiqueta para apilarse en el celular
    const sinEtiqueta = await page.locator('.legal-tabla td:not([data-label])').count();
    expect(sinEtiqueta).toBe(0);
});

test('la política de cookies lista la cookie de sesión y dice que no hay seguimiento', async ({ page, context, api }) => {
    await entrarComo(context, 'visitante');
    await page.goto('cookies.html');
    await expect(page.locator('#que-usamos')).toContainText('auth_token');
    await expect(page.locator('#no-usamos')).toContainText('Google Analytics');
});

test('el pie de la portada lleva los documentos legales y la franja de privacidad', async ({ page, context, api }) => {
    await entrarComo(context, 'visitante');
    await page.goto('index.html');
    await expect(page.locator('.pie-legal a')).toHaveCount(5);
    await expect(page.locator('.pie-legal a[href="terminos.html"]')).toBeVisible();
    await expect(page.locator('.privacidad-banda')).toContainText('Tus datos son tuyos');
    await expect(page.locator('.privacidad-banda a')).toHaveAttribute('href', 'privacidad.html');
});

test('el pie de una empresa con sesión también trae lo legal', async ({ page, context, api }) => {
    await entrarComo(context, 'empresa');
    await page.goto('planes.html');
    await expect(page.locator('.pie-legal a[href="privacidad.html"]')).toBeVisible();
});

test('el registro enlaza los términos de uso junto a la política de datos', async ({ page, context, api }) => {
    await entrarComo(context, 'visitante');
    await page.goto('registro-usuario.html');
    await expect(page.locator('a[href="terminos.html"]').first()).toBeAttached();
    await page.goto('registro-empresa.html');
    await expect(page.locator('a[href="terminos.html"]').first()).toBeAttached();
});
