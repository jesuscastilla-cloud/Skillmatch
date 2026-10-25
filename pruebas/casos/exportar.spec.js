// Mi empresa: descargar las postulaciones en un archivo para Excel.
const { test, expect, entrarComo } = require('../apoyo/prueba');
const { readFile } = require('node:fs/promises');

test('descarga un CSV con todas las postulaciones, para Excel en español', async ({ page, context, api }) => {
    await entrarComo(context, 'empresa');
    await page.goto('perfil-empresa.html');
    const boton = page.locator('#exportarPostulaciones');
    await expect(boton).toBeVisible();
    const [descarga] = await Promise.all([page.waitForEvent('download'), boton.click()]);
    expect(descarga.suggestedFilename()).toMatch(/^postulaciones-hotel-puerta-del-mar-\d{4}-\d{2}-\d{2}\.csv$/);
    const texto = await readFile(await descarga.path(), 'utf8');
    expect(texto.charCodeAt(0)).toBe(0xFEFF); // BOM: Excel lee bien las tildes
    const filas = texto.slice(1).split('\r\n');
    expect(filas[0]).toBe('"Vacante";"Nombre";"Correo";"Teléfono";"Ciudad";"Titular";"Estado";"Fecha de postulación";"Mensaje"');
    expect(filas).toHaveLength(1 + 4); // las 4 postulaciones a vacantes del hotel
    expect(texto).toContain('"Mesero o mesera";"Valentina Herrera";"valentina@prueba.test"');
    expect(texto).toContain('"Aceptada"');
    await expect(page.locator('.toast').last()).toContainText('Descargaste 4 postulaciones');
});

test('un nombre que empieza con "=" no se convierte en fórmula', async ({ page, context, api }) => {
    const d = api.estado.datos;
    d.usuarios.push({ id: 'u-malo', email: 'malo@prueba.test', firstName: '=HYPERLINK("http://ejemplo.test","clic")', lastName: '', role: 'USER', skills: [], experiences: [], educations: [], certifications: [] });
    d.postulaciones.push({ id: 'a-malo', userId: 'u-malo', jobId: 'j-cocina', status: 'pendiente', coverLetter: '+57 llama ya', appliedDate: '2026-01-01T09:00:00' });
    await entrarComo(context, 'empresa');
    await page.goto('perfil-empresa.html');
    const [descarga] = await Promise.all([page.waitForEvent('download'), page.locator('#exportarPostulaciones').click()]);
    const texto = await readFile(await descarga.path(), 'utf8');
    expect(texto).toContain(`"'=HYPERLINK(""http://ejemplo.test"",""clic"")"`);
    expect(texto).toContain(`"'+57 llama ya"`);
});

test('sin postulaciones no aparece el botón', async ({ page, context, api }) => {
    api.estado.datos.postulaciones = [];
    await entrarComo(context, 'empresa');
    await page.goto('perfil-empresa.html');
    await expect(page.locator('#applications-list')).toContainText('Aún no has recibido postulaciones');
    await expect(page.locator('#exportarPostulaciones')).toBeHidden();
});
