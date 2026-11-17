// Planes para empresas: la pagina publica, "Plan y uso", la solicitud de activacion y la administracion.
const { test, expect, entrarComo } = require('../apoyo/prueba');

test('un visitante ve los dos planes, la comparación y botones para empezar', async ({ page, context, api, errores }) => {
    await entrarComo(context, 'visitante');
    await page.goto('planes.html');
    await expect(page.locator('.plan-tarjeta')).toHaveCount(2);
    await expect(page.locator('.plan-tarjeta.is-pro')).toContainText('$49.900');
    await expect(page.locator('.plan-tarjeta.is-pro')).toContainText('300 invitaciones al mes');
    await expect(page.locator('#planesTabla')).toContainText('Recordatorio a quienes no responden');
    await expect(page.locator('.plan-tarjeta').first().locator('a')).toHaveAttribute('href', 'registro-empresa.html');
    await expect(page.locator('.plan-tarjeta.is-pro a')).toHaveAttribute('href', /login\.html\?tipo=empresa&volver=planes\.html/);
    await expect(page.locator('#plan-y-uso')).toBeHidden();
    expect(errores).toEqual([]);
});

test('una persona ve que los planes son para empresas', async ({ page, context, api }) => {
    await entrarComo(context, 'persona');
    await page.goto('planes.html');
    await expect(page.locator('.plan-solo-empresas').first()).toContainText('Disponible para cuentas de empresa');
});

test('la empresa ve su plan y su uso, elige el Profesional y solicita la activación', async ({ page, context, api, errores }) => {
    await entrarComo(context, 'empresa');
    await page.goto('planes.html');
    await expect(page.locator('#planUso')).toContainText('Básico');
    await expect(page.locator('#planUso')).toContainText('0 de 20');
    await page.locator('.plan-tarjeta.is-pro [data-elegir]').click();
    await page.locator('.contratar-mes', { hasText: '3 meses' }).click();
    await page.locator('#ventanaContratar [data-siguiente]').click();
    await expect(page.locator('.contratar-total')).toContainText('$149.700');
    await page.locator('[data-solicitar]').click();
    await expect(page.locator('#ventanaContratar')).toContainText('Recibimos tu solicitud');
    await expect(page.locator('#ventanaContratar')).toContainText('Pendiente de verificación');
    expect(api.estado.datos.solicitudes[0]).toMatchObject({ plan: 'PROFESIONAL', meses: 3, valor: 149700, estado: 'PENDIENTE' });
    await page.locator('[data-ver-uso]').click();
    await expect(page.locator('.uso-solicitudes')).toContainText('Pendiente de verificación');
    // Sin datos de transferencia configurados: no se inventan, se explica que el equipo contacta
    await expect(page.locator('.uso-pago')).toContainText('te contactará al correo de tu cuenta');
    await expect(page.locator('.plan-tarjeta.is-pro')).toContainText('Pendiente de verificación');
    expect(errores).toEqual([]);
});

test('con los datos de transferencia configurados, la empresa los ve al tener la solicitud pendiente', async ({ page, context, api }) => {
    api.estado.datos.comercial = { titular: 'SkillMatch SAS', banco: 'Banco de Prueba', tipoCuenta: 'Ahorros', numeroCuenta: '000-111', correoPagos: 'pagos@prueba.test' };
    api.estado.datos.solicitudes.push({ id: 'sol-1', companyId: 'c-hotel', plan: 'PROFESIONAL', meses: 1, valor: 49900, estado: 'PENDIENTE', createdAt: '2026-11-10T10:00:00' });
    await entrarComo(context, 'empresa');
    await page.goto('planes.html');
    await expect(page.locator('.uso-pago')).toContainText('Banco de Prueba');
    await expect(page.locator('.uso-pago')).toContainText('pagos@prueba.test');
});

test('la administración no se abre para quien no es administrador', async ({ page, context, api }) => {
    await entrarComo(context, 'empresa');
    await page.goto('admin.html');
    await expect(page.locator('#adminSinPermiso')).toBeVisible();
    await expect(page.locator('#adminContenido')).toBeHidden();
});

test('el administrador aprueba una solicitud y la empresa queda con el plan activo', async ({ page, context, api, errores }) => {
    api.estado.datos.solicitudes.push({ id: 'sol-1', companyId: 'c-hotel', companyName: 'Hotel Puerta del Mar', plan: 'PROFESIONAL', meses: 1, valor: 49900,
        contactoNombre: 'Laura', contactoCorreo: 'hotel@prueba.test', estado: 'PENDIENTE', createdAt: '2026-11-10T10:00:00' });
    await entrarComo(context, 'admin');
    await page.goto('admin.html');
    await expect(page.locator('.admin-solicitud')).toContainText('Hotel Puerta del Mar');
    await page.locator('[data-aprobar="sol-1"]').click();
    await page.locator('#ventanaDecision [data-si]').click();
    await expect(page.locator('.admin-vacio')).toBeVisible();
    expect(api.estado.datos.solicitudes[0].estado).toBe('APROBADA');
    expect(api.estado.datos.planes['c-hotel'].plan).toBe('PROFESIONAL');
    await page.locator('#btnEmpresas').click();
    await expect(page.locator('#adminEmpresas')).toContainText('Hotel Puerta del Mar');
    expect(errores).toEqual([]);
});

test('rechazar pide el motivo', async ({ page, context, api }) => {
    api.estado.datos.solicitudes.push({ id: 'sol-1', companyId: 'c-hotel', companyName: 'Hotel Puerta del Mar', plan: 'PROFESIONAL', meses: 1, valor: 49900, estado: 'PENDIENTE', createdAt: '2026-11-10T10:00:00' });
    await entrarComo(context, 'admin');
    await page.goto('admin.html');
    await page.locator('[data-rechazar="sol-1"]').click();
    await page.locator('#ventanaDecision [data-si]').click();
    await expect(page.locator('#decError')).toContainText('Escribe el motivo');
    await page.locator('#decNota').fill('No recibimos el pago.');
    await page.locator('#ventanaDecision [data-si]').click();
    await expect.poll(() => api.estado.datos.solicitudes[0].estado).toBe('RECHAZADA');
});

test('el administrador guarda los datos para cobrar', async ({ page, context, api }) => {
    await entrarComo(context, 'admin');
    await page.goto('admin.html');
    await page.locator('#btnComercial').click();
    await expect(page.locator('#adminComercialEstado')).toContainText('Faltan datos');
    await page.locator('#cBanco').fill('Banco de Prueba');
    await page.locator('#cTipo').selectOption('Ahorros');
    await page.locator('#cNumero').fill('000111222');
    await page.locator('#cTitular').fill('SkillMatch SAS');
    await page.locator('#cCorreo').fill('pagos@prueba.test');
    await page.locator('#adminComercial [type="submit"]').click();
    await expect(page.locator('#adminComercialEstado')).toContainText('Las empresas ven estos datos');
    expect(api.estado.datos.comercial.banco).toBe('Banco de Prueba');
});
