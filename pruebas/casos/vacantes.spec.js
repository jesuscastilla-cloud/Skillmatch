// Vacantes: orden, "Por que este match?", detalle en el historial, filtros en la
// direccion, busqueda y "Cerrar sin guardar" en la carta de postulacion.
const { test, expect, entrarComo } = require('../apoyo/prueba');

const detalle = page => page.locator('#jobDetailModal');
const postular = page => page.locator('#applyModal');
// "Ver detalle" de la tarjeta (.opportunity-card) que tiene ese titulo
const abrirDetalleDe = async (page, titulo) => {
    await page.locator('.opportunity-card', { hasText: titulo }).locator('.btn-ver-detalle').click();
    await expect(detalle(page)).toHaveClass(/active/);
};

test.describe('orden', () => {
    test('un visitante ve "Más reciente" y no "Mayor compatibilidad"', async ({ page, context, api }) => {
        await entrarComo(context, 'visitante');
        await page.goto('oportunidades.html');
        await page.locator('.btn-ver-detalle').first().waitFor();
        await expect(page.locator('#sortSelect')).toHaveValue('recent');
        await expect(page.locator('#sortSelect option[value="match"]')).toHaveCount(0);
    });

    test('una persona con habilidades empieza por "Mayor compatibilidad"', async ({ page, context, api }) => {
        await entrarComo(context, 'persona');
        await page.goto('oportunidades.html');
        await page.locator('.btn-ver-detalle').first().waitFor();
        await expect(page.locator('#sortSelect')).toHaveValue('match');
    });

    test('una persona sin habilidades ve "Más reciente"', async ({ page, context, api }) => {
        api.estado.datos.usuarios.find(u => u.id === 'u-valentina').skills = [];
        await entrarComo(context, 'persona');
        await page.goto('oportunidades.html');
        await page.locator('.btn-ver-detalle').first().waitFor();
        await expect(page.locator('#sortSelect')).toHaveValue('recent');
        await expect(page.locator('#sortSelect option[value="match"]')).toHaveCount(0);
    });
});

test.describe('¿Por qué este match?', () => {
    test('muestra las habilidades que tienes y las que te faltan', async ({ page, context, api }) => {
        await entrarComo(context, 'persona');
        await page.goto('oportunidades.html?jobId=j-recepcion');
        await expect(detalle(page)).toHaveClass(/active/);
        const cuerpo = page.locator('#jobDetailBody');
        await expect(cuerpo.getByRole('heading', { name: '¿Por qué este match?' })).toBeVisible();
        await expect(cuerpo.locator('.skill.is-common')).toHaveText(['Atención al cliente']);
        await expect(cuerpo.locator('.skill.skill-falta')).toHaveText(['Inglés conversacional', 'Manejo de reservas']);
        await expect(cuerpo.locator('.match-consejo a')).toHaveAttribute('href', 'perfil-usuario.html');
    });

    test('si las tienes todas, lo dice', async ({ page, context, api }) => {
        await entrarComo(context, 'persona');
        await page.goto('oportunidades.html?jobId=j-mesero');
        await expect(page.locator('#jobDetailBody .match-consejo')).toHaveText('Tienes todas las habilidades que pide esta vacante.');
    });

    test('un visitante ve "Habilidades que pide"', async ({ page, context, api }) => {
        await entrarComo(context, 'visitante');
        await page.goto('oportunidades.html?jobId=j-recepcion');
        await expect(page.locator('#jobDetailBody').getByRole('heading', { name: 'Habilidades que pide' })).toBeVisible();
    });
});

test.describe('el detalle en el historial', () => {
    test('"atrás" cierra el detalle y deja la lista como estaba; "adelante" lo reabre', async ({ page, context, api }) => {
        await entrarComo(context, 'persona');
        await page.goto('empresas.html');
        await page.goto('oportunidades.html');
        await page.locator('input[name="type"][value="empleo"]').check();
        await abrirDetalleDe(page, 'Mesero o mesera');
        await expect(page).toHaveURL(/jobId=j-mesero/);

        await page.goBack();
        await expect(detalle(page)).not.toHaveClass(/active/);
        await expect(page).toHaveURL(/oportunidades\.html/);
        await expect(page).not.toHaveURL(/jobId=/);
        await expect(page.locator('input[name="type"][value="empleo"]')).toBeChecked();

        await page.goForward();
        await expect(detalle(page)).toHaveClass(/active/);

        // Cerrar con la X limpia la direccion; "atras" ya sale de Vacantes
        await page.locator('#jobDetailModal .btn-close-modal').click();
        await expect(page).not.toHaveURL(/jobId=/);
        await page.goBack();
        await expect(page).toHaveURL(/empresas\.html/);
    });

    test('con Escape tambien se cierra y limpia la dirección', async ({ page, context, api }) => {
        await entrarComo(context, 'persona');
        await page.goto('oportunidades.html');
        await abrirDetalleDe(page, 'Mesero o mesera');
        await page.keyboard.press('Escape');
        await expect(detalle(page)).not.toHaveClass(/active/);
        await expect(page).not.toHaveURL(/jobId=/);
    });

    test('con un enlace directo, "atrás" lleva a la lista', async ({ page, context, api }) => {
        await entrarComo(context, 'persona');
        await page.goto('oportunidades.html?jobId=j-web');
        await expect(detalle(page)).toHaveClass(/active/);
        await page.goBack();
        await expect(detalle(page)).not.toHaveClass(/active/);
        await expect(page).toHaveURL(/oportunidades\.html$/);
    });
});

test.describe('filtros en la dirección', () => {
    test('se guardan, se recuperan al recargar y "Limpiar todo" los quita', async ({ page, context, api }) => {
        await entrarComo(context, 'persona');
        await page.goto('oportunidades.html');
        await page.locator('.btn-ver-detalle').first().waitFor();
        await page.locator('input[name="type"][value="empleo"]').check();
        await page.locator('input[name="modality"][value="presencial"]').check();
        await page.locator('#sortSelect').selectOption('salary');
        await expect(page).toHaveURL(/tipo=empleo/);
        await expect(page).toHaveURL(/modalidad=presencial/);
        await expect(page).toHaveURL(/orden=salary/);
        const cuantas = await page.locator('.btn-ver-detalle').count();

        await page.reload();
        await page.locator('.btn-ver-detalle').first().waitFor();
        await expect(page.locator('input[name="type"][value="empleo"]')).toBeChecked();
        await expect(page.locator('input[name="modality"][value="presencial"]')).toBeChecked();
        await expect(page.locator('#sortSelect')).toHaveValue('salary');
        await expect(page.locator('.btn-ver-detalle')).toHaveCount(cuantas);

        await page.locator('.btn-clear-filters').click();
        await expect(page).not.toHaveURL(/tipo=/);
        await expect(page).not.toHaveURL(/modalidad=/);
    });

    test('la búsqueda queda en la dirección', async ({ page, context, api }) => {
        await entrarComo(context, 'visitante');
        await page.goto('oportunidades.html?q=mesero');
        await expect(page.locator('#searchInput')).toHaveValue('mesero');
        await expect(page.locator('.btn-ver-detalle')).toHaveCount(1);
    });
});

test.describe('postularse', () => {
    test('con la carta escrita, Escape pregunta antes de cerrar', async ({ page, context, api }) => {
        await entrarComo(context, 'persona');
        await page.goto('oportunidades.html?jobId=j-recepcion');
        await page.locator('#jobDetailActions button[onclick*="postularme"]').click();
        await expect(postular(page)).toHaveClass(/active/);
        await page.locator('#coverLetter').fill('Hola, me interesa.');
        await page.keyboard.press('Escape');
        await expect(page.locator('#ventanaConfirmar')).toBeVisible();
        await page.locator('#ventanaConfirmar [data-no]').click();
        await expect(postular(page)).toHaveClass(/active/);
        await expect(page.locator('#coverLetter')).toHaveValue('Hola, me interesa.');

        await page.locator('#applyModal .btn-close-modal').click();
        await page.locator('#ventanaConfirmar [data-si]').click();
        await expect(postular(page)).not.toHaveClass(/active/);
        await expect(page).not.toHaveURL(/jobId=/);
    });

    test('sin escribir nada, se cierra sin preguntar', async ({ page, context, api }) => {
        await entrarComo(context, 'persona');
        await page.goto('oportunidades.html?jobId=j-recepcion');
        await page.locator('#jobDetailActions button[onclick*="postularme"]').click();
        await page.keyboard.press('Escape');
        await expect(postular(page)).not.toHaveClass(/active/);
        await expect(page.locator('#ventanaConfirmar')).toHaveCount(0);
    });

    test('enviar la postulación la registra y marca "Ya te postulaste"', async ({ page, context, api }) => {
        await entrarComo(context, 'persona');
        await page.goto('oportunidades.html?jobId=j-recepcion');
        await page.locator('#jobDetailActions button[onclick*="postularme"]').click();
        await page.locator('#coverLetter').fill('Tengo experiencia en recepción.');
        await page.locator('#sendApplicationBtn').click();
        await expect(postular(page)).not.toHaveClass(/active/);
        await expect(page.locator('#ventanaConfirmar')).toHaveCount(0);
        expect(api.estado.datos.postulaciones.some(a => a.userId === 'u-valentina' && a.jobId === 'j-recepcion')).toBe(true);
    });
});

test('las tarjetas entran en baraja sin rebote', async ({ page, context, api }, info) => {
    test.skip(info.project.name !== 'escritorio', 'en el celular las tarjetas no entran en baraja');
    await entrarComo(context, 'visitante');
    // is-visible dura menos de un segundo y medio (ui.js la quita al terminar):
    // con el equipo cargado, esperarla con un locator a veces no la alcanza a
    // ver. Por eso se anota la curva en el momento en que la tarjeta la recibe.
    await page.addInitScript(() => {
        new MutationObserver(cambios => {
            for (const { target: el } of cambios) {
                if (!window.curvaBaraja && el.classList.contains('baraja') && el.classList.contains('is-visible')) {
                    window.curvaBaraja = getComputedStyle(el).transitionTimingFunction;
                }
            }
        }).observe(document, { subtree: true, attributes: true, attributeFilter: ['class'] });
    });
    await page.goto('oportunidades.html');
    const curva = await (await page.waitForFunction(() => window.curvaBaraja)).jsonValue();
    // --ease-out (.16, 1, .3, 1): sin pasar de 1 (antes .2, 1.15, .35, 1 se pasaba y rebotaba)
    expect(curva).toContain('cubic-bezier');
    expect(curva).not.toContain('1.15');
});
