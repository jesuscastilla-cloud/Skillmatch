// Revision de noviembre de 2026: portada en 6 bloques, un solo inicio de sesion,
// menu de la cuenta, pie segun la sesion, datos de ejemplo y edicion del perfil.
const { test, expect, entrarComo } = require('../apoyo/prueba');

test.describe('portada', () => {
    test('las cifras salen una sola vez, en el hero, y dicen las vacantes abiertas del listado', async ({ page, context, api }) => {
        await entrarComo(context, 'visitante');
        await page.goto('index.html');
        await expect(page.locator('[data-stat]')).toHaveCount(3);
        await expect(page.locator('.impact-stats, .innovation-section, .benefits-section')).toHaveCount(0);
        await expect(page.locator('[data-stat="jobs"]')).toHaveText('9');
        // El titular rota: el trabajo, la práctica o el proyecto (el lector de pantalla lee la frase entera)
        await expect(page.locator('h1.hero-titular')).toHaveAttribute('aria-label', 'Encuentra el trabajo, la práctica o el proyecto que encaja con lo que sabes hacer');
        await expect(page.locator('.hero-rotador .hero-clave')).toHaveCount(3);
    });

    test('las destacadas: cargo, empresa, datos y acciones; postularse pide sesión', async ({ page, context, api }) => {
        await entrarComo(context, 'visitante');
        await page.goto('index.html');
        const tarjeta = page.locator('#cercaLista .cerca-tarjeta').first();
        await expect(tarjeta).toBeVisible();
        await expect(tarjeta.locator('.cerca-acciones a')).toHaveText('Ver vacante');
        await expect(tarjeta.locator('.cerca-guardar')).toContainText('Guardar');
        await expect(tarjeta.locator('.cerca-nota')).toHaveText('Para postularte, inicia sesión.');
        // Dos de ellas, junto a la tarjeta del match en el hero
        await expect(page.locator('#heroVacantes .hero-vacante')).toHaveCount(2);
    });

    test('"Busco trabajo | Soy empresa" cambia el contenido y la empresa ve "Crear cuenta de empresa"', async ({ page, context, api }) => {
        await entrarComo(context, 'visitante');
        await page.goto('index.html');
        await expect(page.locator('#panelPersona')).toBeVisible();
        await page.locator('#tabEmpresa').click();
        await expect(page.locator('#panelPersona')).toBeHidden();
        await expect(page.locator('#panelEmpresa a.btn-primary')).toHaveAttribute('href', 'registro-empresa.html');
        await expect(page.locator('#panelEmpresa a.btn-enlace-fuerte')).toHaveAttribute('href', 'login.html?tipo=empresa');
        // Con el teclado: flecha a la izquierda vuelve a "Busco trabajo"
        await page.locator('#tabEmpresa').press('ArrowLeft');
        await expect(page.locator('#tabPersona')).toHaveAttribute('aria-selected', 'true');
        await expect(page.locator('#tabPersona')).toBeFocused();
    });

    test('"Cómo funciona" son 3 pasos que la persona elige', async ({ page, context, api }, info) => {
        await entrarComo(context, 'visitante');
        await page.goto('index.html');
        await expect(page.locator('.cf-paso')).toHaveCount(3);
        test.skip(info.project.name === 'celular', 'en el celular es una lista, sin escenas');
        await page.locator('#cfPaso2').click();
        await expect(page.locator('#cfEscena2')).toBeVisible();
        await expect(page.locator('#cfEscena1')).toBeHidden();
    });
});

test.describe('datos de ejemplo', () => {
    test('las vacantes de una empresa "(ejemplo)" llevan la etiqueta y la página dice "Vista de ejemplo"', async ({ page, context, api }) => {
        api.estado.datos.empresas.find(c => c.id === 'c-hotel').name = 'Hotel Puerta del Mar (ejemplo)';
        await entrarComo(context, 'visitante');
        await page.goto('oportunidades.html');
        const tarjeta = page.locator('.opportunity-card', { hasText: 'Mesero o mesera' });
        await expect(tarjeta.locator('.enlace-empresa')).toHaveText('Hotel Puerta del Mar');
        await expect(tarjeta.locator('.etiqueta-ejemplo')).toHaveText('Ejemplo');
        await expect(page.locator('#vacantesEjemplo')).toBeVisible();
    });

    test('sin datos de ejemplo no sale el aviso', async ({ page, context, api }) => {
        await entrarComo(context, 'visitante');
        await page.goto('oportunidades.html');
        await page.locator('.btn-ver-detalle').first().waitFor();
        await expect(page.locator('#vacantesEjemplo')).toBeHidden();
        await expect(page.locator('.etiqueta-ejemplo')).toHaveCount(0);
    });
});

test.describe('cuenta', () => {
    test('un solo inicio de sesión: el selector cambia los textos y las direcciones viejas llevan ahí', async ({ page, context, api }) => {
        await entrarComo(context, 'visitante');
        await page.goto('login-empresa.html');
        await expect(page).toHaveURL(/login\.html\?tipo=empresa$/);
        await expect(page.locator('.auth-selector [data-tipo="empresa"]')).toHaveAttribute('aria-checked', 'true');
        await expect(page.locator('#loginCrear')).toHaveAttribute('href', 'registro-empresa.html');
        await page.locator('.auth-selector [data-tipo="persona"]').click();
        await expect(page.locator('#loginCrear')).toHaveText('Crear mi perfil');
        await expect(page).toHaveURL(/login\.html$/);
        await page.goto('login-usuario.html');
        await expect(page).toHaveURL(/login\.html$/);
    });

    test('con sesión, "Cerrar sesión" va en el menú de las iniciales y el pie ofrece lo de la cuenta', async ({ page, context, api }, info) => {
        await entrarComo(context, 'persona');
        await page.goto('oportunidades.html');
        // El pie no ofrece crear perfil ni entrar a quien ya entró
        const pie = page.locator('footer.pie');
        await expect(pie.locator('a', { hasText: 'Mis postulaciones' })).toHaveAttribute('href', 'perfil-usuario.html?tab=applications');
        await expect(pie.locator('a', { hasText: 'Crear mi perfil' })).toHaveCount(0);
        await expect(pie.locator('a', { hasText: 'Iniciar sesión' })).toHaveCount(0);
        await expect(page.locator('.pie-gigante')).toHaveCount(0);
        test.skip(info.project.name === 'celular', 'en el celular la barra de arriba solo deja la marca y la búsqueda');
        await expect(page.locator('header nav > .nav-links > li > a[data-cerrar-sesion]')).toHaveCount(0);
        await page.locator('.cuenta-boton').click();
        const menu = page.locator('#menuCuenta');
        await expect(menu).toBeVisible();
        await expect(menu.locator('a', { hasText: 'Mi perfil' })).toHaveAttribute('href', 'perfil-usuario.html');
        await expect(menu.locator('a[data-cerrar-sesion]')).toHaveText('Cerrar sesión');
    });

    test('un visitante ve en el pie cómo crear cuenta o entrar, como persona o empresa', async ({ page, context, api }) => {
        await entrarComo(context, 'visitante');
        await page.goto('index.html');
        const pie = page.locator('footer.pie');
        await expect(pie.locator('a', { hasText: 'Crear cuenta de empresa' })).toHaveAttribute('href', 'registro-empresa.html');
        await expect(pie.locator('a', { hasText: 'Ya tengo cuenta' })).toHaveAttribute('href', 'login.html?tipo=empresa');
        await expect(pie.locator('a', { hasText: 'Lo que viene' })).toHaveCount(0);
    });
});

test.describe('editar el perfil', () => {
    test.beforeEach(async ({ context }) => { await entrarComo(context, 'persona'); });

    test('una habilidad se edita con el lápiz y el botón dice "Guardando…" mientras espera', async ({ page, api }) => {
        await page.goto('perfil-usuario.html');
        await page.locator('[data-editar-habilidad="s-2"]').click();
        await expect(page.locator('#skillModalTitulo')).toHaveText('Editar habilidad');
        await expect(page.locator('#skillName')).toHaveValue('Inglés básico');
        await page.locator('#skillLevel').selectOption('AVANZADO');
        api.estado.demora = 900;
        const guardar = page.locator('#addSkillForm [type="submit"]');
        await guardar.click();
        await expect(guardar).toBeDisabled();
        await expect(guardar).toContainText('Guardando…');
        await expect(page.locator('#addSkillModal')).toBeHidden();
        api.estado.demora = 0;
        expect(api.estado.datos.usuarios.find(u => u.id === 'u-valentina').skills.find(s => s.id === 's-2').level).toBe('AVANZADO');
        expect(api.estado.llamadas).toContain('PUT /users/u-valentina/skills/s-2');
    });

    test('un error del formulario sale debajo, junto al campo, y no en un aviso flotante', async ({ page, api }) => {
        await page.goto('perfil-usuario.html');
        await page.locator('#addSkillBtn').click();
        await page.locator('#skillName').fill('Excel');
        await page.locator('#addSkillForm [type="submit"]').click();
        await expect(page.locator('#addSkillForm .form-error')).toContainText('qué tanto dominas');
        await expect(page.locator('#skillLevel')).toHaveAttribute('aria-invalid', 'true');
        await expect(page.locator('.toast')).toHaveCount(0);
        // Repetida con otras mayusculas: tambien se dice ahi
        await page.locator('#skillName').fill('atención al cliente');
        await page.locator('#skillLevel').selectOption('BASICO');
        await page.locator('#addSkillForm [type="submit"]').click();
        await expect(page.locator('#addSkillForm .form-error')).toContainText('Ya tienes');
    });

    test('una experiencia se guarda con mes y año, y se edita con el formulario ya lleno', async ({ page, api }) => {
        await page.goto('perfil-usuario.html');
        await page.locator('[data-abre="addExperienceBtn"]').click();
        await page.locator('#expCompany').fill('Restaurante La Mulata');
        await page.locator('#expPosition').fill('Mesera');
        await page.locator('#expStartDateMes').selectOption('03');
        await page.locator('#expStartDateAnio').selectOption('2023');
        await page.locator('#expIsCurrent').check();
        await expect(page.locator('#expEndDateMes')).toBeDisabled();
        await page.locator('#addExperienceForm [type="submit"]').click();
        await expect(page.locator('#addExperienceModal')).toBeHidden();
        const guardada = api.estado.datos.usuarios.find(u => u.id === 'u-valentina').experiences[0];
        expect(guardada.startDate).toBe('2023-03-01');

        await page.locator('[data-editar-experiencia]').first().click();
        await expect(page.locator('#expModalTitulo')).toHaveText('Editar experiencia');
        await expect(page.locator('#expCompany')).toHaveValue('Restaurante La Mulata');
        await expect(page.locator('#expStartDateMes')).toHaveValue('03');
        await expect(page.locator('#addExperienceForm [type="submit"]')).toHaveText('Guardar cambios');
        await page.locator('#expPosition').fill('Mesera bilingüe');
        await page.locator('#addExperienceForm [type="submit"]').click();
        await expect(page.locator('.experience-item h3')).toHaveText('Mesera bilingüe');
        expect(api.estado.datos.usuarios.find(u => u.id === 'u-valentina').experiences).toHaveLength(1);
    });

    test('cancelar con algo escrito pregunta "¿Descartar cambios?"', async ({ page, api }) => {
        await page.goto('perfil-usuario.html');
        await page.locator('#editProfileBtn').click();
        await expect(page.locator('#editProfileModal')).toBeVisible();
        await page.locator('#editHeadline').fill('Mesera y bartender');
        await page.locator('#editProfileModal .btn-secondary-modal').click();
        const pregunta = page.locator('#ventanaConfirmar');
        await expect(pregunta).toContainText('¿Descartar cambios?');
        await pregunta.locator('[data-no]').click();
        await expect(page.locator('#editProfileModal')).toBeVisible();
        await expect(page.locator('#editHeadline')).toHaveValue('Mesera y bartender');
        await page.locator('#editProfileModal .btn-secondary-modal').click();
        await page.locator('#ventanaConfirmar [data-si]').click();
        await expect(page.locator('#editProfileModal')).toBeHidden();
    });

    test('sin ciudad ni título el perfil no los inventa: invita a agregarlos', async ({ page, api }) => {
        const yo = api.estado.datos.usuarios.find(u => u.id === 'u-valentina');
        yo.location = '';
        yo.headline = '';
        await page.goto('perfil-usuario.html');
        await expect(page.locator('#userLocation')).toHaveText('Agrega tu ciudad');
        await expect(page.locator('#userHeadline')).toHaveText('Agrega tu título profesional');
        await page.locator('#userHeadline button').click();
        await expect(page.locator('#editProfileModal')).toBeVisible();
        await expect(page.locator('#editHeadline')).toBeFocused();
        await expect(page.locator('#editLocation')).toHaveValue('');
    });
});
