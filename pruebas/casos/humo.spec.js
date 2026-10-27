// Prueba de humo: cada pagina abre sin errores de JavaScript para cada tipo de
// cuenta, y el frontend solo llama a direcciones que existen en el backend.
const { test, expect, entrarComo } = require('../apoyo/prueba');

const PAGINAS = {
    visitante: ['index.html', 'oportunidades.html', 'empresas.html', 'empresa.html?id=c-hotel', 'dashboard.html', 'politica-datos.html',
        'login.html', 'login-usuario.html', 'login-empresa.html', 'seleccionar-registro.html', 'registro-usuario.html', 'registro-empresa.html'],
    persona: ['index.html', 'oportunidades.html', 'empresas.html', 'empresa.html?id=c-hotel', 'dashboard.html',
        'perfil-usuario.html', 'perfil-usuario.html?id=u-andres', 'conexiones.html', 'mensajes.html', 'hoja-de-vida.html'],
    empresa: ['index.html', 'oportunidades.html', 'empresas.html', 'perfil-empresa.html', 'mensajes.html', 'dashboard.html']
};

for (const [quien, paginas] of Object.entries(PAGINAS)) {
    for (const pagina of paginas) {
        test(`${quien}: ${pagina} abre sin errores`, async ({ page, context, api, errores }) => {
            await entrarComo(context, quien);
            await page.goto(pagina);
            await expect(page.locator('header nav')).toBeVisible();
            await page.waitForLoadState('networkidle');
            expect(errores, 'errores de JavaScript').toEqual([]);
            expect(api.estado.desconocidas, 'llamadas que el backend no tiene').toEqual([]);
        });
    }
}
