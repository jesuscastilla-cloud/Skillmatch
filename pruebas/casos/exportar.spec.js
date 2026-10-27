// Mi empresa: descargar las postulaciones en Excel (.xlsx). Antes era un CSV
// con punto y coma y en un Windows que separa con coma salía todo en una columna.
const { test, expect, entrarComo } = require('../apoyo/prueba');
const { leerXlsx } = require('../apoyo/xlsx');
const { readFile } = require('node:fs/promises');

// El número con el que Excel guarda un día (desde el 30 de diciembre de 1899)
const diaDeExcel = d => (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(1899, 11, 30)) / 86400000;

async function descargar(page) {
    const [descarga] = await Promise.all([page.waitForEvent('download'), page.locator('#exportarPostulaciones').click()]);
    return { nombre: descarga.suggestedFilename(), libro: leerXlsx(await readFile(await descarga.path())) };
}

test('descarga un Excel de verdad (.xlsx) con todas las postulaciones, en columnas', async ({ page, context, api }) => {
    await entrarComo(context, 'empresa');
    await page.goto('perfil-empresa.html');
    await expect(page.locator('#exportarPostulaciones')).toBeVisible();
    const { nombre, libro } = await descargar(page);
    expect(nombre).toMatch(/^postulaciones-hotel-puerta-del-mar-\d{4}-\d{2}-\d{2}\.xlsx$/);
    expect(Object.keys(libro.archivos)).toEqual(expect.arrayContaining(
        ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml']));
    expect(libro.archivos['xl/workbook.xml']).toContain('<sheet name="Postulaciones"');

    const [titulos, ...filas] = libro.valores;
    expect(titulos).toEqual(['Vacante', 'Nombre', 'Correo', 'Teléfono', 'Ciudad', 'Titular', 'Estado', 'Fecha de postulación', 'Mensaje']);
    expect(filas).toHaveLength(4); // las 4 postulaciones a vacantes del hotel
    const valentina = filas.find(f => f[1] === 'Valentina Herrera');
    expect(valentina.slice(0, 3)).toEqual(['Mesero o mesera', 'Valentina Herrera', 'valentina@prueba.test']);
    expect(valentina[8]).toBe('Me interesa mucho.');
    expect(filas.map(f => f[6])).toContain('Aceptada');

    // La fecha es una fecha de Excel (para ordenar y filtrar), no un texto: Valentina se postuló ayer
    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);
    expect(valentina[7]).toBe(diaDeExcel(ayer));
    libro.filas.slice(1).forEach(f => expect(f[7]).toMatchObject({ tipo: undefined, estilo: 2 }));

    // Títulos con su estilo, fijos al bajar y con filtros
    expect(libro.filas[0].every(c => c.estilo === 1)).toBe(true);
    expect(libro.hoja).toContain('state="frozen"');
    expect(libro.hoja).toContain('<autoFilter ref="A1:I5"/>');
    await expect(page.locator('.toast').last()).toContainText('Descargaste 4 postulaciones');
});

test('un nombre que empieza con "=" queda como texto, no como fórmula', async ({ page, context, api }) => {
    const d = api.estado.datos;
    d.usuarios.push({ id: 'u-malo', email: 'malo@prueba.test', firstName: '=HYPERLINK("http://ejemplo.test","clic")', lastName: '', role: 'USER', skills: [], experiences: [], educations: [], certifications: [] });
    d.postulaciones.push({ id: 'a-malo', userId: 'u-malo', jobId: 'j-cocina', status: 'pendiente', coverLetter: '+57 llama ya', appliedDate: '2026-01-01T09:00:00' });
    await entrarComo(context, 'empresa');
    await page.goto('perfil-empresa.html');
    const { libro } = await descargar(page);
    const fila = libro.filas.find(f => f[1] && String(f[1].valor).startsWith('=HYPERLINK'));
    expect(fila[1]).toMatchObject({ tipo: 'inlineStr', valor: '=HYPERLINK("http://ejemplo.test","clic")', formula: false });
    expect(fila[8]).toMatchObject({ tipo: 'inlineStr', valor: '+57 llama ya' });
    expect(libro.hoja, 'ninguna celda es fórmula').not.toMatch(/<f\b/);
});

test('sin postulaciones no aparece el botón', async ({ page, context, api }) => {
    api.estado.datos.postulaciones = [];
    await entrarComo(context, 'empresa');
    await page.goto('perfil-empresa.html');
    await expect(page.locator('#applications-list')).toContainText('Aún no has recibido postulaciones');
    await expect(page.locator('#exportarPostulaciones')).toBeHidden();
});
