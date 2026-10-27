// Mi empresa: cerrar una vacante sabiendo qué pasa, y reabrirla.
const { test, expect, entrarComo } = require('../apoyo/prueba');
const { haceDias } = require('../apoyo/datos');

const oferta = (page, titulo) => page.locator('.offer-card', { hasText: titulo });
const ventana = page => page.locator('#ventanaCerrarVacante');

test.beforeEach(async ({ context }) => { await entrarComo(context, 'empresa'); });

test('antes de cerrar dice qué pasa, y "Cancelar" no cambia nada', async ({ page, api }) => {
    await page.goto('perfil-empresa.html');
    await expect(page.locator('#applications-list .application-card').first()).toBeVisible();
    await oferta(page, 'Mesero o mesera').getByRole('button', { name: 'Cerrar' }).click();
    await expect(ventana(page)).toBeVisible();
    await expect(ventana(page)).toContainText('Deja de aparecer en Vacantes');
    await expect(ventana(page)).toContainText('Se postularon 3 personas: 1 aceptada, 2 esperan respuesta.');
    await expect(ventana(page).locator('.cierre-esperan')).toContainText('Valentina Herrera');
    await expect(ventana(page).locator('.cierre-esperan')).toContainText('Sara Villalba');
    // Lo seguro tiene el foco
    await expect(ventana(page).locator('[data-cancelar]')).toBeFocused();
    await ventana(page).locator('[data-cancelar]').click();
    await expect(ventana(page)).toHaveCount(0);
    expect(api.estado.llamadas.filter(l => l.startsWith('PATCH'))).toEqual([]);
    expect(api.estado.datos.vacantes.find(j => j.id === 'j-mesero').status).toBe('abierta');
});

test('cerrar sin responder deja las postulaciones como estaban', async ({ page, api }) => {
    await page.goto('perfil-empresa.html');
    await expect(page.locator('#applications-list .application-card').first()).toBeVisible();
    await oferta(page, 'Mesero o mesera').getByRole('button', { name: 'Cerrar' }).click();
    await ventana(page).getByRole('button', { name: 'Cerrar vacante' }).click();
    await expect(ventana(page)).toHaveCount(0);
    await expect(page.locator('.toast').last()).toContainText('Cerraste Mesero o mesera.');
    await expect(oferta(page, 'Mesero o mesera').locator('.status-badge')).toHaveText('Cerrada');
    await expect(oferta(page, 'Mesero o mesera').getByRole('button', { name: 'Reabrir' })).toBeVisible();
    const d = api.estado.datos;
    expect(d.vacantes.find(j => j.id === 'j-mesero').status).toBe('cerrada');
    expect(d.postulaciones.find(a => a.id === 'a-1').status).toBe('pendiente');
});

test('cerrar y responder: quienes esperan pasan a "Rechazada", la aceptada no cambia', async ({ page, api }) => {
    await page.goto('perfil-empresa.html');
    await expect(page.locator('#applications-list .application-card').first()).toBeVisible();
    await oferta(page, 'Mesero o mesera').getByRole('button', { name: 'Cerrar' }).click();
    await ventana(page).locator('#cierreResponder').check();
    await ventana(page).getByRole('button', { name: 'Cerrar vacante' }).click();
    await expect(page.locator('.toast').last()).toContainText('Respondiste a 2 personas.');
    const d = api.estado.datos;
    expect(d.postulaciones.find(a => a.id === 'a-1').status).toBe('rechazada');
    expect(d.postulaciones.find(a => a.id === 'a-4').status).toBe('rechazada');
    expect(d.postulaciones.find(a => a.id === 'a-3').status).toBe('aceptada');
    // Las cifras de arriba ya cuentan las rechazadas
    await expect(page.locator('#applications-list .apps-summary div', { hasText: 'Rechazadas' }).locator('strong')).toHaveText('2');
});

test('una vacante sin postulaciones no pregunta por respuestas', async ({ page, api }) => {
    await page.goto('perfil-empresa.html');
    await expect(page.locator('#applications-list .application-card').first()).toBeVisible();
    await oferta(page, 'Auxiliar de cocina').getByRole('button', { name: 'Cerrar' }).click();
    await expect(ventana(page)).toContainText('Nadie se había postulado todavía.');
    await expect(ventana(page).locator('#cierreResponder')).toHaveCount(0);
});

test('reabrir con la fecha vencida pide cambiarla primero', async ({ page, api }) => {
    api.estado.datos.vacantes.find(j => j.id === 'j-eventos').expirationDate = haceDias(3);
    await page.goto('perfil-empresa.html');
    await oferta(page, 'Coordinador o coordinadora de eventos').getByRole('button', { name: 'Reabrir' }).click();
    const pregunta = page.locator('#ventanaConfirmar');
    await expect(pregunta).toContainText('esta misma noche se vuelve a cerrar sola');
    await pregunta.getByRole('button', { name: 'Cambiar la fecha' }).click();
    await expect(page.locator('#genericModal #offerDeadline')).toBeVisible();
    expect(api.estado.datos.vacantes.find(j => j.id === 'j-eventos').status).toBe('cerrada');
});

test('reabrir con la fecha vigente la vuelve a publicar', async ({ page, api }) => {
    await page.goto('perfil-empresa.html');
    await oferta(page, 'Coordinador o coordinadora de eventos').getByRole('button', { name: 'Reabrir' }).click();
    await expect(page.locator('.toast').last()).toContainText('vuelve a aparecer en Vacantes');
    await expect(oferta(page, 'Coordinador o coordinadora de eventos').locator('.status-badge')).toHaveText('Activa');
    expect(api.estado.datos.vacantes.find(j => j.id === 'j-eventos').status).toBe('abierta');
});
