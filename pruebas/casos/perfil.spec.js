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
    await expect(menu.getByRole('menuitem')).toHaveText(['Cambiar contraseña', 'Llenar con mi hoja de vida', 'Descargar mis datos', 'Eliminar mi cuenta']);
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

// Vidrio (Liquid Glass): docs/PLAN-PERFIL-GLASS.md y app.css, seccion 30
test.describe('vidrio', () => {
    const visibles = '[...document.querySelectorAll(".fondo-vivo > span")].filter(m => getComputedStyle(m).display !== "none")';

    test('el fondo vivo: manchas de la marca que se mueven solo con transform y arrancan donde las deja la hora', async ({ page, context, api }, info) => {
        await entrarComo(context, 'persona');
        await page.goto('perfil-usuario.html');
        await expect(page.locator('body')).toHaveClass(/pagina-vidrio/);
        const fondo = await page.evaluate(visibles => {
            const f = document.querySelector('.fondo-vivo'), cs = getComputedStyle(f);
            const manchas = eval(visibles);
            const reloj = parseFloat(document.documentElement.style.getPropertyValue('--reloj'));
            const animadas = manchas.map(m => m.getAnimations()[0]).filter(Boolean);
            return {
                fijo: cs.position, detras: cs.zIndex, manchas: manchas.length,
                andando: animadas.length === manchas.length && animadas.every(a => a.playState === 'running'),
                soloTransform: animadas.every(a => a.effect.getKeyframes().every(k =>
                    Object.keys(k).filter(p => !['offset', 'computedOffset', 'easing', 'composite'].includes(p)).join() === 'transform')),
                // El retraso negativo es la hora: al cambiar de pagina siguen donde iban
                conLaHora: reloj > 0 && manchas.every(m => Math.abs(parseFloat(getComputedStyle(m).animationDelay) * 1000 + reloj) < 100)
            };
        }, visibles);
        expect(fondo).toEqual({ fijo: 'fixed', detras: '-1', manchas: info.project.name === 'celular' ? 3 : 5, andando: true, soloTransform: true, conLaHora: true });
    });

    test('tarjetas de vidrio de tinte (sin desenfoque, sobre las manchas no se nota) y vidrio real en la barra y el menú "Más"', async ({ page, context, api }) => {
        await entrarComo(context, 'persona');
        await page.goto('perfil-usuario.html');
        await expect(page.locator('#cifraHabilidades')).toHaveText('3');
        const filtro = s => page.locator(s).first().evaluate(el => getComputedStyle(el).backdropFilter);
        for (const s of ['.profile-header-card', '.perfil-cifra', '.profile-section', '#applicationsCard']) expect(await filtro(s), s).toBe('none');
        expect(await filtro('body > header')).toContain('blur');
        await page.locator('#perfilMasBtn').click();
        await expect(page.locator('#perfilMasMenu')).toBeVisible();
        expect(await filtro('#perfilMasMenu')).toContain('blur');
    });

    // Sin pausa con una ventana abierta: la regla :has() que lo hacia frenaba Inicio en celulares lentos
    test('el fondo queda quieto con movimiento reducido y se va con alto contraste o menos transparencia', async ({ page, context, api }) => {
        await entrarComo(context, 'persona');
        await page.goto('perfil-usuario.html');
        const estados = () => page.evaluate(visibles => [...new Set(eval(visibles).map(m => (m.getAnimations()[0] || {}).playState || 'quieta'))], visibles);
        await expect.poll(estados).toEqual(['running']);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await expect.poll(estados).toEqual(['quieta']);
        await page.emulateMedia({ reducedMotion: null, forcedColors: 'active' });
        await expect(page.locator('.fondo-vivo')).toBeHidden();
        await page.emulateMedia({ forcedColors: null });
        const cdp = await context.newCDPSession(page);
        await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] });
        await expect(page.locator('.fondo-vivo')).toBeHidden();
        expect(await page.locator('.perfil-cifra').first().evaluate(el => getComputedStyle(el).backgroundImage)).toBe('none');
    });

    test('la foto con iniciales usa colores de la marca con letra blanca legible (antes podía salir morada, fucsia o rosada)', async ({ page, context, api }) => {
        await entrarComo(context, 'persona');
        await page.goto('perfil-usuario.html');
        await expect(page.locator('#profileInitials')).toBeVisible();
        const colores = await page.evaluate(() => AVATAR_COLORS.map(hex => {
            const [r, g, b] = hex.match(/\w\w/g).map(x => parseInt(x, 16) / 255);
            const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
            const tono = d === 0 ? 0 : max === r ? 60 * (((g - b) / d) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
            const lin = c => c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4);
            const lum = .2126 * lin(r) + .7152 * lin(g) + .0722 * lin(b);
            return { hex, tono: (tono + 360) % 360, contraste: 1.05 / (lum + .05) };
        }));
        for (const c of colores) {
            expect(c.tono >= 255 && c.tono <= 345, c.hex + ' no es morado, fucsia ni rosado').toBe(false);
            expect(c.contraste, c.hex + ' con letra blanca').toBeGreaterThanOrEqual(4.5);
        }
        const fondo = await page.locator('#profileInitials').evaluate(el => getComputedStyle(el).backgroundColor);
        const hex = '#' + fondo.match(/\d+/g).slice(0, 3).map(n => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase();
        expect(colores.map(c => c.hex)).toContain(hex);
    });

    test('Experiencia y Educación vacías dicen por qué sirven y su botón abre el formulario; en el perfil de otra persona no', async ({ page, context, api }) => {
        await entrarComo(context, 'persona');
        await page.goto('perfil-usuario.html');
        const experiencia = page.locator('#experienceContainer .estado-vacio');
        await expect(experiencia).toContainText('Aún no has agregado experiencia laboral');
        await expect(experiencia).toContainText('Las empresas ven primero');
        await experiencia.getByRole('button', { name: 'Agregar experiencia' }).click();
        await expect(page.locator('#addExperienceModal')).toBeVisible();
        await page.locator('#addExperienceModal .btn-close-modal').click();
        await expect(page.locator('#addExperienceModal')).toBeHidden();
        await page.locator('#educationContainer .estado-vacio').getByRole('button', { name: 'Agregar educación' }).click();
        await expect(page.locator('#addEducationModal')).toBeVisible();
        await page.goto('perfil-usuario.html?id=u-andres');
        await expect(page.locator('#userName')).toContainText('Andrés');
        await expect(page.locator('.estado-vacio')).toHaveCount(0);
    });

    test('postulaciones y guardadas con la misma letra y alineadas con el título de su tarjeta', async ({ page, context, api }) => {
        await entrarComo(context, 'persona');
        await page.goto('perfil-usuario.html');
        await expect(page.locator('#interestedCompanies .company-item-compact').first()).toBeVisible();
        await expect(page.locator('#savedJobsList .guardada-item').first()).toBeVisible();
        const m = await page.evaluate(() => {
            const letra = s => getComputedStyle(document.querySelector(s)).fontSize;
            const izq = s => Math.round(document.querySelector(s).getBoundingClientRect().left);
            return {
                letraPostulacion: letra('#interestedCompanies .company-info-compact p:not(.status-badge)'),
                letraGuardada: letra('#savedJobsList .company-info-compact p'),
                tituloPostulaciones: izq('#applicationsCard .card-title'), filaPostulacion: izq('#interestedCompanies .company-item-compact'),
                tituloGuardadas: izq('#savedJobsCard .card-title'), filaGuardada: izq('#savedJobsList .guardada-item')
            };
        });
        expect(m.letraPostulacion).toBe(m.letraGuardada);
        expect(m.filaPostulacion).toBe(m.tituloPostulaciones);
        expect(m.filaGuardada).toBe(m.tituloGuardadas);
    });
});
