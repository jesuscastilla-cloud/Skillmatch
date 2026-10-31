// Los datos de la cuenta: la empresa edita los suyos y el correo se cambia con un código.
const { test, expect, entrarComo } = require('../apoyo/prueba');

const ventana = page => page.locator('#genericModal');

test.describe('Editar datos de la empresa', () => {
    test.beforeEach(async ({ context }) => { await entrarComo(context, 'empresa'); });

    test('guarda nombre, ciudad, tamaño, web y año, y la cabecera los muestra', async ({ page, api }) => {
        await page.goto('perfil-empresa.html');
        await expect(page.locator('#companyName')).toHaveText('Hotel Puerta del Mar');
        await page.locator('#editarDatosEmpresaBtn').click();
        await expect(ventana(page)).toBeVisible();
        await expect(page.locator('#datoNombre')).toHaveValue('Hotel Puerta del Mar');

        await page.locator('#datoNombre').fill('Hotel Puerta del Mar S.A.S.');
        await page.locator('#datoCiudad').fill('Turbaco, Bolívar');
        await page.locator('#datoTamano').selectOption('medium');
        await page.locator('#datoWeb').fill('www.puertadelmar.co');   // sin https: se completa solo
        await page.locator('#datoAnio').fill('1998');
        await page.locator('#modalSaveBtn').click();

        await expect(ventana(page)).toHaveCount(0);
        await expect(page.locator('#companyName')).toHaveText('Hotel Puerta del Mar S.A.S.');
        await expect(page.locator('#companyMeta')).toContainText('Turbaco, Bolívar');
        await expect(page.locator('#companyMeta')).toContainText('51 a 200 personas');
        await expect(page.locator('#companyMeta')).toContainText('Desde 1998');
        const guardada = api.estado.datos.empresas.find(c => c.id === 'c-hotel');
        expect(guardada.website).toBe('https://www.puertadelmar.co');
        expect(guardada.name).toBe('Hotel Puerta del Mar S.A.S.');
    });

    test('un nombre con símbolos no se envía y dice por qué', async ({ page, api }) => {
        await page.goto('perfil-empresa.html');
        await page.locator('#editarDatosEmpresaBtn').click();
        await page.locator('#datoNombre').fill('<b>Hotel</b>');
        await page.locator('#modalSaveBtn').click();
        await expect(page.locator('#datosEmpresaError')).toContainText('solo puede tener letras, números');
        expect(api.estado.llamadas.filter(l => l === 'PATCH /companies/c-hotel')).toEqual([]);
    });
});

test.describe('Cambiar correo', () => {
    test.beforeEach(async ({ context }) => { await entrarComo(context, 'persona'); });

    test('pide un código al correo nuevo y solo cambia al confirmarlo', async ({ page, api }) => {
        await page.goto('perfil-usuario.html');
        await page.locator('#perfilMasBtn').click();
        await page.locator('#cambiarCorreoBtn').click();
        const v = page.locator('#ventanaCorreo');
        await expect(v).toBeVisible();

        await page.locator('#correoNuevo').fill('valentina.nueva@prueba.test');
        await v.locator('[type="submit"]').click();
        await expect(page.locator('#correoCodigo')).toBeVisible();
        // Todavía no cambió
        expect(api.usuario('u-valentina').email).toBe('valentina@prueba.test');

        await page.locator('#correoCodigo').fill('000000');
        await v.locator('[type="submit"]').click();
        await expect(v.locator('.error-text')).toContainText('no es correcto');

        await page.locator('#correoCodigo').fill('123456');
        await v.locator('[type="submit"]').click();
        await expect(v).toHaveCount(0);
        expect(api.usuario('u-valentina').email).toBe('valentina.nueva@prueba.test');
        expect(await page.evaluate(() => JSON.parse(localStorage.getItem('userData')).email)).toBe('valentina.nueva@prueba.test');
    });

    test('en "Editar perfil" el correo no se escribe: se cambia con el código', async ({ page, api }) => {
        await page.goto('perfil-usuario.html');
        await page.locator('#editProfileBtn').click();
        await expect(page.locator('#editProfileModal')).toBeVisible();
        await expect(page.locator('#editEmail')).toHaveAttribute('readonly', '');
        await page.locator('#editCambiarCorreoBtn').click();
        await expect(page.locator('#ventanaCorreo')).toBeVisible();
    });
});
