// Perfil de persona: la cabecera (foto, nombre, botones y portada)
const { test, expect, entrarComo } = require('../apoyo/prueba');

test('la foto va montada justo a la mitad de la portada y, en el computador, los botones quedan al lado del nombre', async ({ page, context, api }, info) => {
    await entrarComo(context, 'persona');
    await page.goto('perfil-usuario.html');
    await expect(page.locator('#userName')).not.toHaveText('Cargando...');
    const [portada, foto, nombre, botones] = await Promise.all(
        ['.profile-cover', '.profile-avatar', '.profile-name-section', '.perfil-acciones'].map(s => page.locator(s).boundingBox()));
    const escritorio = info.project.name === 'escritorio';
    expect(foto.width).toBe(escritorio ? 152 : 112);
    expect(Math.abs((portada.y + portada.height - foto.y) - foto.height / 2), 'la mitad sobre la portada').toBeLessThan(1.5);
    if (escritorio) {
        // Con cuatro botones bajaban debajo del nombre y la foto parecía más alta que todo:
        // ahora van "Editar perfil", "Hoja de vida en PDF" y "Más", en una fila
        expect(botones.x, 'a la derecha del nombre').toBeGreaterThanOrEqual(nombre.x + nombre.width - 1);
        expect(botones.y).toBeLessThan(nombre.y + nombre.height);
        const alto = (await page.locator('#editProfileBtn').boundingBox()).height;
        expect(botones.height, 'una sola fila').toBeLessThan(alto * 1.5);
    }
});

test('"Más" abre un menú con las otras opciones, que se usa con el teclado', async ({ page, context, api }) => {
    await entrarComo(context, 'persona');
    await page.goto('perfil-usuario.html');
    const mas = page.locator('#perfilMasBtn');
    const menu = page.locator('#perfilMasMenu');
    await expect(menu).toBeHidden();
    await mas.click();
    await expect(menu).toBeVisible();
    await expect(mas).toHaveAttribute('aria-expanded', 'true');
    await expect(menu.getByRole('menuitem')).toHaveText(['Cambiar contraseña', 'Llenar con mi hoja de vida']);
    await expect(page.locator('#changePasswordBtn')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('#importarCvBtn')).toBeFocused();
    // Escape cierra y vuelve a "Más"
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(mas).toBeFocused();
    await expect(mas).toHaveAttribute('aria-expanded', 'false');
    // Elegir una opción hace lo suyo y cierra el menú
    await mas.click();
    await page.locator('#changePasswordBtn').click();
    await expect(page.locator('#ventanaContrasena')).toBeVisible();
    await expect(menu).toBeHidden();
});

test('un clic afuera cierra el menú, y en el perfil de otra persona no aparece "Más"', async ({ page, context, api }) => {
    await entrarComo(context, 'persona');
    await page.goto('perfil-usuario.html');
    await page.locator('#perfilMasBtn').click();
    await expect(page.locator('#perfilMasMenu')).toBeVisible();
    await page.locator('#userName').click();
    await expect(page.locator('#perfilMasMenu')).toBeHidden();
    await page.goto('perfil-usuario.html?id=u-andres');
    await expect(page.locator('#userName')).toContainText('Andrés');
    await expect(page.locator('#perfilMasBtn')).toBeHidden();
});

test.describe('panel del perfil', () => {
    test('las cifras de arriba resumen el perfil: progreso, postulaciones, guardadas y habilidades', async ({ page, context, api }) => {
        await entrarComo(context, 'persona');
        await page.goto('perfil-usuario.html');
        await expect(page.locator('#cifraHabilidades')).toHaveText('3');
        await expect(page.locator('#cifraGuardadas')).toHaveText('1');
        // Las postulaciones se cuentan igual que en la tarjeta "Tus postulaciones"
        const enviadas = page.locator('#interestedCompanies .apps-summary strong').first();
        await expect(enviadas).toBeVisible();
        await expect(page.locator('#cifraPostulaciones')).toHaveText(await enviadas.textContent());
        await expect(page.locator('#cifraPostulacionesNota')).toContainText('en proceso');
        // Sin experiencia ni estudios: 60 %, y lo que falta como acciones
        await expect(page.locator('#progressPercentage')).toHaveText('60');
        await expect(page.locator('#profileProgress')).toHaveAttribute('stroke-dasharray', '60 100');
        await expect(page.locator('#profileChecklist .progress-step')).toHaveText(['Agregar experiencia', 'Agregar educación']);
        await page.locator('#profileChecklist .progress-step', { hasText: 'Agregar educación' }).click();
        await expect(page.locator('#addEducationModal')).toBeVisible();
        await page.locator('#addEducationModal .btn-close-modal').click();
        await expect(page.locator('#addEducationModal')).toBeHidden();
        await page.locator('#cifraAgregarHabilidad').click();
        await expect(page.locator('#addSkillModal')).toBeVisible();
    });

    test('dos columnas en el computador, y las listas largas muestran 3 y "Ver todas"', async ({ page, context, api }, info) => {
        api.estado.datos.usuarios.find(u => u.id === 'u-valentina').educations = [1, 2, 3, 4, 5].map(n => ({
            id: 'ed-' + n, school: 'Institución ' + n, degree: 'Técnico', fieldOfStudy: 'Cocina ' + n,
            startDate: `201${n}-01-15`, endDate: `201${n + 1}-11-30`, isCurrent: false, description: ''
        }));
        await entrarComo(context, 'persona');
        await page.goto('perfil-usuario.html');
        if (info.project.name === 'escritorio') {
            const [ancha, lateral] = await Promise.all(['.profile-main', '.profile-right-sidebar'].map(s => page.locator(s).boundingBox()));
            expect(lateral.x, 'la lateral a la derecha').toBeGreaterThan(ancha.x + ancha.width - 1);
            await expect(page.locator('.profile-main #recommendedJobs')).toHaveCount(1);
            await expect(page.locator('.profile-right-sidebar #userSkills')).toHaveCount(1);
        }
        const estudios = page.locator('#educationContainer > .education-item');
        await expect(estudios).toHaveCount(5);
        await expect(estudios.nth(2)).toBeVisible();
        await expect(estudios.nth(3)).toBeHidden();
        const ver = page.locator('#educationContainer + .ver-todas');
        await expect(ver).toHaveText('Ver todas (5)');
        await ver.click();
        await expect(estudios.nth(4)).toBeVisible();
        await expect(ver).toHaveText('Ver menos');
        await expect(ver).toHaveAttribute('aria-expanded', 'true');
        // Con 3 o menos no hay botón
        await expect(page.locator('#experienceContainer + .ver-todas')).toBeHidden();
    });

    test('las tarjetas de las dos columnas tienen el mismo aire entre ellas (Habilidades no queda pegada)', async ({ page, context, api }) => {
        await entrarComo(context, 'persona');
        await page.goto('perfil-usuario.html');
        await expect(page.locator('#savedJobsCard')).toBeVisible();
        const huecos = selector => page.locator(selector).evaluate(columna => {
            const tarjetas = [...columna.children].filter(t => t.offsetParent !== null).map(t => t.getBoundingClientRect());
            return tarjetas.slice(1).map((t, i) => Math.round(t.top - tarjetas[i].bottom));
        });
        const [ancha, lateral] = [await huecos('.profile-main'), await huecos('.profile-right-sidebar')];
        expect(lateral.length, 'Habilidades, Postulaciones y Guardadas').toBe(2);
        for (const hueco of [...ancha, ...lateral]) expect(hueco).toBe(ancha[0]);
        expect(ancha[0]).toBeGreaterThanOrEqual(16);
    });

    test('en el perfil de otra persona no aparecen las cifras (son de quien inició sesión)', async ({ page, context, api }) => {
        await entrarComo(context, 'persona');
        await page.goto('perfil-usuario.html?id=u-andres');
        await expect(page.locator('#userName')).toContainText('Andrés');
        await expect(page.locator('#perfilCifras')).toBeHidden();
        await expect(page.locator('#userSkills')).toBeVisible();
    });
});
