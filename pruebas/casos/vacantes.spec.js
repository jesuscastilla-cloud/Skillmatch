// Vacantes: orden, "Por que este match?", detalle en el historial, filtros en la
// direccion, busqueda y "Cerrar sin guardar" en la carta de postulacion.
const { test, expect, entrarComo } = require('../apoyo/prueba');

const detalle = page => page.locator('#jobDetailModal');
const postular = page => page.locator('#applyModal');
// En el celular los filtros estan en una hoja que se abre con "Filtros" (revision 2026-11-13):
// se abre, se marca y se cierra; en escritorio se marca directo
const conLaHoja = async (page, accion) => {
    const abrir = page.locator('#filtrosAbrir');
    const enHoja = await abrir.isVisible();
    if (enHoja) await abrir.click();
    await accion();
    if (enHoja) await page.locator('.filtros-ver').click();
};
const marcarFiltro = (page, selector) => conLaHoja(page, () => page.locator(selector).first().check());
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
        await marcarFiltro(page, 'input[name="type"][value="empleo"]');
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
        await marcarFiltro(page, 'input[name="type"][value="empleo"]');
        await marcarFiltro(page, 'input[name="modality"][value="presencial"]');
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

        await conLaHoja(page, () => page.locator('.btn-clear-filters').click());
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

// «Pastilla» (2026-11-13): los botones dicen lo que pasa
test.describe('botones que responden («Pastilla»)', () => {
    test('al guardar, solo esa vacante da su salto, suelta chispitas y su corazón late', async ({ page, context, api }, info) => {
        await entrarComo(context, 'persona');
        await page.goto('oportunidades.html');
        const tarjeta = page.locator('.opportunity-card', { has: page.locator('.btn-save:not(.saved)') }).first();
        const id = await tarjeta.getAttribute('data-job-id');
        await tarjeta.locator('.btn-save').click();
        const boton = page.locator(`.opportunity-card[data-job-id="${id}"] .btn-save`);
        await expect(boton).toHaveClass(/recien-guardada/);
        await expect(page.locator('.chispitas')).toHaveCount(1);
        // Las que ya estaban guardadas no vuelven a latir al pintarse la lista
        expect(await page.locator('.btn-save.saved:not(.recien-guardada) .ico-heart').evaluateAll(hs => hs.filter(h => getComputedStyle(h).animationName !== 'none').length)).toBe(0);
        // Al terminar, la clase se va y las chispitas tambien
        await expect(boton).not.toHaveClass(/recien-guardada/);
        await expect(page.locator('.chispitas')).toHaveCount(0);
    });

    test('enviar una postulación muestra "Enviando…" y "Enviada" en el mismo botón antes de cerrar', async ({ page, context, api }) => {
        await entrarComo(context, 'persona');
        await page.goto('oportunidades.html');
        // El servidor tarda un poco: se alcanza a ver el estado de envio
        await page.route('**/applications', async r => { if (r.request().method() === 'POST') await new Promise(x => setTimeout(x, 400)); await r.fallback(); });
        await page.locator('.opportunity-card', { has: page.locator('.btn-apply:not(.applied)') }).first().locator('.btn-apply').click();
        await expect(postular(page)).toHaveClass(/active/);
        const enviar = page.locator('#sendApplicationBtn');
        const ancho = await enviar.evaluate(b => b.offsetWidth);
        await enviar.click();
        await expect(enviar).toHaveClass(/enviando/);
        await expect(enviar).toHaveText('Enviando…');
        expect(await enviar.evaluate(b => b.offsetWidth), 'el botón no cambia de tamaño').toBe(ancho);
        await expect(enviar).toHaveClass(/listo/);
        await expect(enviar).toHaveText('Enviada');
        await expect(postular(page)).not.toHaveClass(/active/);
        // Queda listo para la próxima
        await expect(enviar).toHaveText('Enviar postulación');
        await expect(enviar).toBeEnabled();
    });
});

test.describe('el trabajo del match: tu perfil frente a las vacantes («Vacante», 2026-11-13)', () => {
    test('a una persona le muestra sus habilidades, en cuántas vacantes aparece cada una y cuántas piden alguna', async ({ page, context, api }) => {
        await entrarComo(context, 'persona');
        await page.goto('oportunidades.html');
        const panel = page.locator('.perfil-frente');
        await expect(panel).toContainText('De las 9 que ves, 3 piden alguna de tus habilidades. Las que más encajan van primero.');
        const tuyas = panel.locator('.chip-habilidad.es-tuya');
        await expect(tuyas).toHaveCount(3);
        // De la más pedida a la menos, con su cuenta
        await expect(tuyas.first()).toContainText('Atención al cliente');
        await expect(tuyas.first().locator('.chip-cuenta')).toHaveText('3');
        // Las que te faltan, para probar
        await expect(panel.locator('.chip-habilidad.es-prueba').first()).toContainText('JavaScript');
    });

    test('con un filtro, las cifras siguen a lo que se ve', async ({ page, context, api }) => {
        await entrarComo(context, 'persona');
        await page.goto('oportunidades.html');
        await marcarFiltro(page, 'input[name="type"][value="práctica"], input[name="type"][value="practica"]');
        await expect(page.locator('.perfil-frente')).toContainText('De las 2 que ves, 1 pide alguna de tus habilidades.');
    });

    test('a un visitante no se le muestra (no hay habilidades con qué comparar)', async ({ page, context, api }) => {
        await entrarComo(context, 'visitante');
        await page.goto('oportunidades.html');
        await page.locator('.btn-ver-detalle').first().waitFor();
        await expect(page.locator('.perfil-frente')).toHaveCount(0);
    });

    test('tocar una habilidad la resalta en las ofertas que la piden (y otra vez, la suelta)', async ({ page, context, api }) => {
        await entrarComo(context, 'persona');
        await page.goto('oportunidades.html');
        const chip = page.locator('.chip-habilidad.es-tuya', { hasText: 'Atención al cliente' });
        await chip.click();
        await expect(chip).toHaveAttribute('aria-pressed', 'true');
        await expect(page.locator('.opportunities-list')).toHaveClass(/con-resalte/);
        await expect(page.locator('.opportunity-card.la-pide')).toHaveCount(3);
        await expect(page.locator('.opportunity-card.la-pide .skill.resaltada')).toHaveCount(3);
        await chip.click();
        await expect(chip).toHaveAttribute('aria-pressed', 'false');
        await expect(page.locator('.opportunities-list')).not.toHaveClass(/con-resalte/);
        await expect(page.locator('.opportunity-card.la-pide')).toHaveCount(0);
    });

    test('probar una habilidad que te falta recalcula y reordena, sin tocar tu perfil ni el detalle', async ({ page, context, api }) => {
        await entrarComo(context, 'persona');
        await page.goto('oportunidades.html');
        const tarjeta = page.locator('.opportunity-card', { hasText: 'Práctica en desarrollo' });
        await expect(tarjeta.locator('.match-ring')).toHaveAttribute('data-pct', '0');
        const probar = page.locator('.chip-habilidad.es-prueba', { hasText: 'JavaScript' });
        await probar.click();
        await expect(page.locator('.chip-habilidad.es-prueba', { hasText: 'JavaScript' })).toHaveAttribute('aria-pressed', 'true');
        await expect(tarjeta.locator('.match-ring')).toHaveAttribute('data-pct', '50');
        await expect(tarjeta.locator('.skill.is-prueba')).toContainText('JavaScript');
        await expect(page.locator('.perfil-frente-nota')).toContainText('no se guardan');
        // Sube en la lista: ahora va antes de una de 33 %
        const titulos = await page.locator('.opportunity-card .job-title').allTextContents();
        expect(titulos.findIndex(t => t.includes('Práctica en desarrollo'))).toBeLessThan(titulos.findIndex(t => t.includes('Recepcionista')));
        // El detalle habla solo de tu perfil de verdad
        await tarjeta.locator('.btn-ver-detalle').click();
        await expect(detalle(page)).toContainText('Tienes 0 de 2');
        await page.keyboard.press('Escape');
        // Quitarla deja todo como estaba
        await page.locator('.chip-habilidad.es-prueba', { hasText: 'JavaScript' }).click();
        await expect(tarjeta.locator('.match-ring')).toHaveAttribute('data-pct', '0');
        await expect(page.locator('.perfil-frente-nota')).toHaveCount(0);
    });

    test('cambiar el orden mueve las mismas tarjetas (no las construye de nuevo)', async ({ page, context, api }) => {
        await entrarComo(context, 'persona');
        await page.goto('oportunidades.html');
        await page.locator('.opportunity-card').first().waitFor();
        await page.evaluate(() => document.querySelectorAll('.opportunity-card').forEach(c => { c.__original = true; }));
        await page.locator('#sortSelect').selectOption('recent');
        await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('.opportunity-card')].every(c => c.__original))).toBe(true);
    });
});

test('cada tarjeta muestra el nombre de su empresa con enlace a su perfil', async ({ page, context, api }) => {
    await entrarComo(context, 'visitante');
    await page.goto('oportunidades.html');
    const tarjeta = page.locator('.opportunity-card', { hasText: 'Mesero o mesera' });
    await expect(tarjeta.locator('.enlace-empresa')).toHaveText('Hotel Puerta del Mar');
    await expect(tarjeta.locator('.enlace-empresa')).toHaveAttribute('href', 'empresa.html?id=c-hotel');
});

test.describe('etiquetas y conteos', () => {
    const cuenta = (page, grupo, valor) => page.locator(`.filter-card input[name="${grupo}"][value="${valor}"]`).locator('xpath=ancestor::label').locator('.opcion-cuenta');

    test('cada opción del filtro dice cuántas vacantes quedarían', async ({ page, context, api }) => {
        await entrarComo(context, 'visitante');
        await page.goto('oportunidades.html');
        await page.locator('.btn-ver-detalle').first().waitFor();
        await expect(cuenta(page, 'type', 'empleo')).toHaveText('6');
        await expect(cuenta(page, 'type', 'practica')).toHaveText('2');
        await expect(cuenta(page, 'type', 'freelance')).toHaveText('1');
        // Con "Empleo" marcado, las modalidades cuentan solo entre los empleos
        await marcarFiltro(page, 'input[name="type"][value="empleo"]');
        await expect(cuenta(page, 'modality', 'presencial')).toHaveText('3');
        await expect(cuenta(page, 'modality', 'remoto')).toHaveText('2');
        await expect(cuenta(page, 'modality', 'hibrido')).toHaveText('1');
    });

    test('las opciones que darían 0 se ven atenuadas', async ({ page, context, api }) => {
        await entrarComo(context, 'visitante');
        await page.goto('oportunidades.html');
        await marcarFiltro(page, 'input[name="type"][value="freelance"]');
        // El unico independiente es presencial: remoto e hibrido quedan en 0
        await expect(cuenta(page, 'modality', 'remoto')).toHaveText('0');
        await expect(page.locator('input[name="modality"][value="remoto"]').locator('xpath=ancestor::label')).toHaveClass(/sin-resultados/);
    });

    test('las tarjetas dicen "Nueva" y "Cierra en N días"', async ({ page, context, api }) => {
        await entrarComo(context, 'visitante');
        await page.goto('oportunidades.html');
        await page.locator('.btn-ver-detalle').first().waitFor();
        const tarjeta = titulo => page.locator('.opportunity-card', { hasText: titulo });
        await expect(tarjeta('Recepcionista bilingüe').locator('.etiqueta-vacante')).toHaveText(['Nueva', 'Cierra en 3 días']);
        await expect(tarjeta('Mesero o mesera').locator('.etiqueta-vacante')).toHaveText(['Nueva']);
        await expect(tarjeta('Práctica en desarrollo de software').locator('.etiqueta-vacante')).toHaveText(['Cierra en 5 días']);
        await expect(tarjeta('Auxiliar de cocina').locator('.etiqueta-vacante')).toHaveCount(0);
        await expect(page.locator('.etiqueta-vacante.es-nueva')).toHaveCount(3);
    });
});

test.describe('logo de la empresa', () => {
    // Un logo de prueba como los que guarda el editor (imagen dentro del texto, data:)
    const LOGO = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#0B7E8C"/></svg>').toString('base64');
    const consultas = page => {
        const lista = [];
        page.on('request', r => { const ruta = new URL(r.url()).pathname; if (/\/(companies|users)\/[^/]+$/.test(ruta)) lista.push(ruta.replace(/^.*?\/(companies|users)\//, '/$1/')); });
        return lista;
    };

    test('con sesión, la tarjeta muestra el logo que la empresa subió, con una consulta por empresa', async ({ page, context, api }) => {
        api.estado.datos.usuarios.find(u => u.id === 'u-hotel').profileImageUrl = LOGO;
        await entrarComo(context, 'persona');
        const lista = consultas(page);
        await page.goto('oportunidades.html');
        const delHotel = page.locator('.opportunity-card', { hasText: 'Hotel Puerta del Mar' });
        await expect(delHotel.first().locator('.company-logo-opp img')).toHaveAttribute('src', LOGO);
        // Las que no subieron logo siguen con la inicial
        await expect(page.locator('.opportunity-card').filter({ hasNotText: 'Hotel Puerta del Mar' }).first().locator('.company-logo-opp img')).toHaveCount(0);
        // El hotel tiene varias vacantes, pero se consulta una sola vez
        expect(await delHotel.count()).toBeGreaterThan(1);
        await expect.poll(() => lista.filter(r => r === '/companies/c-hotel' || r === '/users/u-hotel').sort()).toEqual(['/companies/c-hotel', '/users/u-hotel']);
    });

    test('en el perfil público el logo va grande y montado justo a la mitad de la portada', async ({ page, context, api }) => {
        api.estado.datos.usuarios.find(u => u.id === 'u-hotel').profileImageUrl = LOGO;
        await entrarComo(context, 'persona');
        await page.goto('empresa.html?id=c-hotel');
        await expect(page.locator('#empresaLogo img')).toHaveAttribute('src', LOGO);
        const [portada, logo] = await Promise.all([page.locator('#empresaPortada').boundingBox(), page.locator('#empresaLogo').boundingBox()]);
        expect(logo.width).toBeGreaterThanOrEqual(88);
        expect(Math.abs((portada.y + portada.height - logo.y) - logo.height / 2), 'la mitad sobre la portada').toBeLessThan(1.5);
    });

    test('un visitante ve la inicial y no se consulta nada (el backend pide sesión para ver la cuenta)', async ({ page, context, api }) => {
        api.estado.datos.usuarios.find(u => u.id === 'u-hotel').profileImageUrl = LOGO;
        await entrarComo(context, 'visitante');
        const lista = consultas(page);
        await page.goto('oportunidades.html');
        await expect(page.locator('.opportunity-card').first()).toBeVisible();
        await page.waitForTimeout(500);
        await expect(page.locator('.company-logo-opp img')).toHaveCount(0);
        expect(lista).toEqual([]);
    });
});

test.describe('filtros en el celular (revisión 2026-11-13)', () => {
    test.beforeEach(async ({}, info) => {
        test.skip(info.project.name !== 'celular', 'la hoja de filtros es del celular');
    });

    test('las vacantes van primero y los filtros se abren en una hoja que se cierra con Escape', async ({ page, context, api }) => {
        await entrarComo(context, 'visitante');
        await page.goto('oportunidades.html');
        await page.locator('.btn-ver-detalle').first().waitFor();
        // La primera vacante se ve antes de bajar mucho (antes estaba ~700 px mas abajo, detras de los filtros)
        const arriba = await page.locator('.opportunity-card').first().evaluate(c => c.getBoundingClientRect().top + scrollY);
        expect(arriba).toBeLessThan(1000);
        const abrir = page.locator('#filtrosAbrir');
        await expect(page.locator('#panelFiltros')).toBeHidden();
        await abrir.click();
        await expect(page.locator('#panelFiltros')).toBeVisible();
        await expect(page.locator('#panelFiltros')).toHaveAttribute('role', 'dialog');
        await expect(abrir).toHaveAttribute('aria-expanded', 'true');
        await expect(page.locator('.filtros-cerrar')).toBeFocused();
        await page.locator('input[name="type"][value="empleo"]').check();
        await expect(page.locator('.filtros-ver')).toHaveText('Ver 6 vacantes');
        await page.keyboard.press('Escape');
        await expect(page.locator('#panelFiltros')).toBeHidden();
        await expect(abrir).toBeFocused();
        await expect(abrir).toHaveText('Filtros (1)');
    });
});

test.describe('la chispa del match al postularse (revisión 2026-11-13)', () => {
    const postularseA = async (page, titulo) => {
        await page.locator('.opportunity-card', { hasText: titulo }).locator('.btn-apply').click();
        await page.locator('#sendApplicationBtn').click();
    };

    test('sale una vez desde "Ya te postulaste" y no deja nada en la página', async ({ page, context, api }) => {
        await entrarComo(context, 'persona');
        await page.goto('oportunidades.html');
        await postularseA(page, 'Recepcionista bilingüe');
        await expect(page.locator('.chispa-match')).toHaveCount(1);
        await expect(page.locator('.chispa-match i')).toHaveCount(14);
        await expect(page.locator('.opportunity-card', { hasText: 'Recepcionista bilingüe' }).locator('.btn-apply.applied')).toBeVisible();
        await expect(page.locator('.chispa-match')).toHaveCount(0, { timeout: 4000 });
    });

    test('con "reducir movimiento" no sale', async ({ page, context, api }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await entrarComo(context, 'persona');
        await page.goto('oportunidades.html');
        await postularseA(page, 'Recepcionista bilingüe');
        await expect(page.locator('.opportunity-card', { hasText: 'Recepcionista bilingüe' }).locator('.btn-apply.applied')).toBeVisible();
        await page.waitForTimeout(300);
        await expect(page.locator('.chispa-match')).toHaveCount(0);
    });
});
