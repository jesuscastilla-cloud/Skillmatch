// Llenar el perfil con la hoja de vida en PDF: se lee en el navegador, se
// revisa y solo se guarda lo que la persona marca.
const { test, expect, entrarComo } = require('../apoyo/prueba');
const { hacerPdf, columna, titulo } = require('../apoyo/pdf');

// La hoja de vida de Valentina. Su perfil ya tiene teléfono, ciudad, titular,
// "acerca de" y la habilidad "Atención al cliente".
const hojaDeValentina = () => hacerPdf(columna([
    { texto: 'Valentina Herrera', tam: 20, negrita: true },
    { texto: 'Técnica en Gastronomía', tam: 12 },
    'valentina@prueba.test | 300 555 1234 | Turbaco, Bolívar',
    titulo('PERFIL'),
    'Mesera y auxiliar de cocina con tres años de experiencia en restaurantes de Cartagena.',
    titulo('EXPERIENCIA LABORAL'),
    'Mesera',
    'Restaurante La Cevichería',
    'Ene 2021 - Actualmente',
    'Atención de mesas y manejo de caja.',
    'Auxiliar de cocina | Hotel Caribe | Mar 2019 - Dic 2020',
    titulo('EDUCACIÓN'),
    'Técnico en Cocina | SENA | 2018 - 2019',
    'Bachiller Académico',
    'Colegio Santa María, 2017',
    titulo('HABILIDADES'),
    'Atención al cliente, Manejo de caja, Excel básico',
    '• Trabajo en equipo',
    titulo('IDIOMAS'),
    'Inglés - B1',
    titulo('REFERENCIAS'),
    'Carlos Pérez | 311 222 3344'
]));

async function subir(page, pdf, nombre = 'hoja-de-vida.pdf', tipo = 'application/pdf') {
    await page.locator('#importarCvBtn').click();
    await page.locator('#ventanaLector [data-archivo]').setInputFiles({ name: nombre, mimeType: tipo, buffer: pdf });
}
const ventana = page => page.locator('#ventanaLector');
const escrituras = api => api.estado.llamadas.filter(l => /^(POST|PUT|PATCH|DELETE) \/users/.test(l));

test.beforeEach(async ({ context }) => { await entrarComo(context, 'persona'); });

test('lee la hoja de vida, propone y no guarda nada sin confirmar', async ({ page, api }) => {
    await page.goto('perfil-usuario.html');
    await subir(page, hojaDeValentina());
    const v = ventana(page);
    await expect(v.locator('.lector-intro')).toContainText('encontramos tu teléfono, tu ciudad, tu titular, tu presentación, 5 habilidades, 2 estudios y 2 experiencias');
    await expect(v).toContainText('Las referencias no se traen');

    // Lo que el perfil ya tiene distinto queda sin marcar y dice qué hay ahora
    const telefono = v.locator('[data-dato="phone"]');
    await expect(telefono.locator('[data-valor]')).toHaveValue('300 555 1234');
    await expect(telefono.locator('[data-elegible]')).not.toBeChecked();
    await expect(telefono).toContainText('Ahora en tu perfil: «3000000001»');
    await expect(v.locator('[data-dato="location"] [data-valor]')).toHaveValue('Turbaco');

    // Las habilidades nuevas, marcadas; la que ya tiene no se repite
    const chips = v.locator('[data-habilidad]');
    await expect(chips).toHaveCount(4);
    for (const nombre of ['Manejo de caja', 'Excel básico', 'Trabajo en equipo', 'Inglés B1']) {
        await expect(v.locator(`[data-habilidad="${nombre}"]`)).toBeChecked();
    }
    await expect(v).toContainText('Ya tienes Atención al cliente: no se repiten.');

    // Estudios completos, marcados
    const estudios = v.locator('[data-estudio]');
    await expect(estudios).toHaveCount(2);
    await expect(estudios.first().locator('[data-campo="school"]')).toHaveValue('SENA');
    await expect(estudios.first().locator('[data-campo="degree"]')).toHaveValue('Técnico en Cocina');
    await expect(estudios.nth(1).locator('[data-campo="school"]')).toHaveValue('Colegio Santa María');

    // Experiencias: siempre por revisar, sin marcar
    const mesera = v.locator('[data-experiencia]').first();
    await expect(mesera.locator('[data-campo="position"]')).toHaveValue('Mesera');
    await expect(mesera.locator('[data-campo="company"]')).toHaveValue('Restaurante La Cevichería');
    await expect(mesera.locator('[data-campo="desde"]')).toHaveValue('2021-01');
    await expect(mesera.locator('[data-campo="actual"]')).toBeChecked();
    await expect(mesera.locator('[data-elegible]')).not.toBeChecked();

    await expect(v.locator('[data-agregar]')).toHaveText('Agregar a mi perfil (6)');
    expect(escrituras(api), 'nada se guarda antes de confirmar').toEqual([]);

    // La persona marca la experiencia y confirma
    await mesera.locator('[data-elegible]').check();
    await v.locator('[data-agregar]').click();
    await expect(page.locator('.toast').last()).toContainText('Listo: agregamos 4 habilidades, 2 estudios y 1 experiencia a tu perfil.');
    const yo = api.estado.datos.usuarios.find(u => u.id === 'u-valentina');
    expect(yo.skills.map(s => s.name)).toEqual(expect.arrayContaining(['Manejo de caja', 'Excel básico', 'Trabajo en equipo', 'Inglés B1']));
    expect(yo.skills.find(s => s.name === 'Excel básico').level).toBe('INTERMEDIO');
    expect(yo.educations.map(e => e.school)).toEqual(['SENA', 'Colegio Santa María']);
    expect(yo.experiences).toEqual([expect.objectContaining({ position: 'Mesera', startDate: '2021-01-01', isCurrent: true, endDate: null })]);
    expect(yo.phone, 'el teléfono no se marcó: no cambia').toBe('3000000001');
});

test('un estudio incompleto no se puede marcar hasta completarlo', async ({ page, api }) => {
    await page.goto('perfil-usuario.html');
    await subir(page, hacerPdf(columna([
        { texto: 'Valentina Herrera', tam: 20, negrita: true },
        titulo('ESTUDIOS'),
        'Universidad de Cartagena | 2015 - 2019'
    ])));
    const estudio = ventana(page).locator('[data-estudio]');
    await expect(estudio).toHaveClass(/revisa/);
    await expect(estudio.locator('[data-elegible]')).toBeDisabled();
    await estudio.locator('[data-campo="degree"]').fill('Administración de Empresas');
    await expect(estudio.locator('[data-elegible]')).toBeEnabled();
    await expect(estudio.locator('[data-elegible]')).not.toBeChecked(); // revisarlo es marcarlo
});

test('en dos columnas lee la barra lateral aparte', async ({ page, api }) => {
    await page.goto('perfil-usuario.html');
    const izquierda = columna(['CONTACTO', '300 555 1234', 'Cartagena', 'HABILIDADES', 'Photoshop', 'Illustrator', 'Canva'], { x: 40, y: 660 });
    const derecha = columna([titulo('PERFIL'), 'Diseñadora gráfica con experiencia en redes sociales.', 'Me gusta crear piezas claras.',
        titulo('EXPERIENCIA'), 'Diseñadora | Agencia Mar', '2022 - 2024', 'Piezas para redes.'], { x: 260, y: 660 });
    const nombre = { texto: 'Valentina Herrera', tam: 20, negrita: true, x: 40, y: 730 };
    await subir(page, hacerPdf([nombre, ...izquierda, ...derecha]));
    const v = ventana(page);
    for (const s of ['Photoshop', 'Illustrator', 'Canva']) await expect(v.locator(`[data-habilidad="${s}"]`)).toHaveCount(1);
    await expect(v.locator('[data-dato="bio"] [data-valor]')).toHaveValue('Diseñadora gráfica con experiencia en redes sociales. Me gusta crear piezas claras.');
});

test('una columna con las fechas a la derecha no se confunde con dos columnas', async ({ page, api }) => {
    await page.goto('perfil-usuario.html');
    const r = (texto, x, y) => ({ texto, x, y, tam: 11 });
    await subir(page, hacerPdf([
        { texto: 'Valentina Herrera', x: 50, y: 740, tam: 20, negrita: true },
        { texto: 'EXPERIENCIA', x: 50, y: 700, tam: 13, negrita: true },
        r('Mesera', 50, 680), r('Ene 2021 - Dic 2022', 450, 680),
        r('Restaurante La Cevichería', 50, 662),
        r('Atención de mesas, manejo de caja y apoyo en cocina durante la temporada alta en Cartagena.', 50, 644),
        r('Cajera', 50, 620), r('Feb 2019 - Dic 2020', 450, 620),
        r('Supermercado Olímpica', 50, 602),
        r('Manejo de caja registradora y cuadre diario con reportes al supervisor del turno de la tarde.', 50, 584)
    ]));
    const empleos = ventana(page).locator('[data-experiencia]');
    await expect(empleos).toHaveCount(2);
    await expect(empleos.first().locator('[data-campo="company"]')).toHaveValue('Restaurante La Cevichería');
    await expect(empleos.first().locator('[data-campo="hasta"]')).toHaveValue('2022-12');
    await expect(empleos.nth(1).locator('[data-campo="position"]')).toHaveValue('Cajera');
    await expect(empleos.nth(1).locator('[data-campo="company"]')).toHaveValue('Supermercado Olímpica');
    await expect(empleos.nth(1).locator('[data-campo="description"]')).toHaveValue(/^Manejo de caja registradora/);
});

test('si el PDF parece de otra persona, lo dice', async ({ page, api }) => {
    await page.goto('perfil-usuario.html');
    await subir(page, hacerPdf(columna([{ texto: 'Carlos Pérez', tam: 20, negrita: true }, titulo('HABILIDADES'), 'Soldadura, Electricidad'])));
    await expect(ventana(page).locator('.lector-aviso')).toContainText('Esta hoja de vida dice «Carlos Pérez». ¿Seguro que es la tuya?');
});

test('si el servidor no atiende las experiencias, las muestra pero no deja agregarlas', async ({ page, api }) => {
    await page.route('http://localhost:8080/api/users/*/experiences', r => r.fulfill({
        status: 400, contentType: 'application/json', body: '{"message":"experienceService is null"}', headers: { 'Access-Control-Allow-Origin': '*' }
    }));
    await page.goto('perfil-usuario.html');
    await subir(page, hojaDeValentina());
    const v = ventana(page);
    await expect(v.locator('.lector-aviso')).toContainText('Por ahora no se pueden agregar experiencias');
    await expect(v.locator('[data-experiencia] [data-elegible]').first()).toBeDisabled();
});

test('explica cuando el archivo no sirve', async ({ page, api }) => {
    await page.goto('perfil-usuario.html');
    await subir(page, Buffer.from('hola'), 'notas.txt', 'text/plain');
    await expect(ventana(page).locator('.error-text')).toHaveText('Ese archivo no es un PDF. Elige tu hoja de vida en PDF.');
    // Un PDF sin texto (una imagen escaneada)
    await page.locator('#ventanaLector [data-archivo]').setInputFiles({ name: 'escaneada.pdf', mimeType: 'application/pdf', buffer: hacerPdf([]) });
    await expect(ventana(page).locator('.error-text')).toContainText('Este PDF es una imagen escaneada');
});

test('en el perfil de otra persona no aparece el botón', async ({ page, api }) => {
    await page.goto('perfil-usuario.html?id=u-andres');
    await expect(page.locator('#userName')).toContainText('Andrés');
    await expect(page.locator('#importarCvBtn')).toBeHidden();
});
