// Volver a donde ibas despues de entrar (revision del 2026-11-13, hallazgo 1).
// Antes: "Postularme" sin sesion mandaba solo al login a los 1,2 s y, al entrar,
// la persona terminaba en su perfil y tenia que buscar la vacante otra vez.
const { test, expect, entrarComo } = require('../apoyo/prueba');

test('sin sesión, "Postularme" pregunta y al entrar vuelve a la vacante con la postulación abierta', async ({ page, context, api, errores }) => {
    await entrarComo(context, 'visitante');
    await page.goto('oportunidades.html');
    const tarjeta = page.locator('.opportunity-card', { hasText: 'Recepcionista bilingüe' });
    await tarjeta.locator('.btn-apply').click();

    // Una ventana con dos caminos, no un salto automatico
    const ventana = page.locator('#ventanaPedirCuenta');
    await expect(ventana).toBeVisible();
    await expect(ventana.getByRole('heading')).toContainText('Inicia sesión para postularte');
    const entrar = ventana.getByRole('link', { name: 'Entrar' });
    await expect(entrar).toBeFocused();
    await expect(entrar).toHaveAttribute('href', /^login\.html\?volver=oportunidades\.html%3FjobId%3Dj-recepcion%26accion%3Dpostular$/);
    await expect(ventana.getByRole('link', { name: 'Crear mi perfil' })).toHaveAttribute('href', /^registro-usuario\.html\?volver=/);
    await page.waitForTimeout(1500);
    await expect(page).toHaveURL(/oportunidades\.html/); // ya no se va solo

    // Entrar: "Crear mi perfil" del login tambien conserva la vuelta
    await entrar.click();
    await expect(page).toHaveURL(/login\.html\?volver=/);
    await expect(page.locator('#loginCrear')).toHaveAttribute('href', /^registro-usuario\.html\?volver=oportunidades\.html/);
    await page.locator('#email').fill('valentina@prueba.test');
    await page.locator('#password').fill('una-clave-de-prueba');
    await page.locator('#login-btn').click();

    // De vuelta en la vacante, con la ventana de postulacion abierta y sin ?accion en la direccion
    await expect(page).toHaveURL(/oportunidades\.html\?jobId=j-recepcion$/);
    await expect(page.locator('#applyModal')).toHaveClass(/active/);
    await expect(page.locator('#applyJobName')).toHaveText('Recepcionista bilingüe');
    expect(errores).toEqual([]);
});

test('el ?volver= solo acepta páginas del propio sitio', async ({ page, api }) => {
    await page.goto('login.html');
    const revisar = valor => page.evaluate(v => destinoSeguro(v), valor);
    expect(await revisar('oportunidades.html?jobId=7')).toBe('oportunidades.html?jobId=7');
    expect(await revisar('https://otro-sitio.com/robar.html')).toBe('');
    expect(await revisar('//otro-sitio.com/x.html')).toBe('');
    expect(await revisar('javascript:alert(1)')).toBe('');
    expect(await revisar('../../otro.html')).toBe('');
    expect(await revisar('login.html')).toBe('');
    expect(await revisar('perfil-usuario.html?id="><script>')).toBe('');
});

test('una página con sesión obligatoria manda al login recordando a dónde volver', async ({ page, context, api }) => {
    await entrarComo(context, 'visitante');
    await page.goto('conexiones.html');
    await expect(page).toHaveURL(/login\.html\?volver=conexiones\.html$/);
});
