// La capa de controles de vidrio en todo el sitio (fase 2 de docs/PLAN-PERFIL-GLASS.md y app.css,
// seccion 30): barra de arriba, pestanas, menus, ventanas, paleta, avisos y recorrido
const { test, expect, entrarComo } = require('../apoyo/prueba');

// Translucido (alfa del color de fondo menor que 1) y con desenfoque de verdad
async function deVidrio(locator) {
    return locator.evaluate(el => {
        const cs = getComputedStyle(el);
        const partes = cs.backgroundColor.match(/[\d.]+/g).map(Number);
        return { translucido: (partes.length > 3 ? partes[3] : 1) < 1, desenfoca: cs.backdropFilter.includes('blur') };
    });
}

// entrarComo deja la sesion para toda la prueba: cada prueba entra una sola vez
test('en todas las páginas la barra de arriba es de vidrio (y en el celular también las pestañas)', async ({ page, context, api }, info) => {
    await entrarComo(context, 'persona');
    for (const pagina of ['index.html', 'oportunidades.html', 'mensajes.html', 'empresas.html', 'dashboard.html']) {
        await page.goto(pagina);
        expect(await deVidrio(page.locator('body > header')), pagina).toEqual({ translucido: true, desenfoca: true });
        if (info.project.name === 'celular') {
            await expect(page.locator('.tabbar')).toBeVisible();
            expect(await deVidrio(page.locator('.tabbar')), pagina + ' pestañas').toEqual({ translucido: true, desenfoca: true });
        }
    }
});

test('las ventanas nuevas y viejas y la paleta son de vidrio; los campos siguen sólidos y la franja de botones desenfoca', async ({ page, context, api }) => {
    await entrarComo(context, 'persona');
    await page.goto('perfil-usuario.html');
    await expect(page.locator('#cifraHabilidades')).toHaveText('3');
    // Nueva (UI.ventana)
    await page.evaluate(() => SkillMatchUI.cambiarContrasena());
    const nueva = page.locator('#ventanaContrasena .modal-content');
    await expect(nueva).toBeVisible();
    expect(await deVidrio(nueva)).toEqual({ translucido: true, desenfoca: true });
    expect(await deVidrio(page.locator('#claveActual')), 'el campo para escribir').toEqual({ translucido: false, desenfoca: false });
    expect(await deVidrio(page.locator('#ventanaContrasena .modal-actions'))).toEqual({ translucido: true, desenfoca: true });
    await page.keyboard.press('Escape');
    await expect(nueva).toBeHidden();
    // Vieja (las del perfil se abren con style.display)
    await page.locator('#cifraAgregarHabilidad').click();
    const vieja = page.locator('#addSkillModal .modal-content-small');
    await expect(vieja).toBeVisible();
    expect(await deVidrio(vieja)).toEqual({ translucido: true, desenfoca: true });
    await page.locator('#addSkillModal .btn-close-modal').click();
    await expect(vieja).toBeHidden();
    // Paleta Ctrl+K
    await page.evaluate(() => SkillMatchUI.paleta.abrir());
    await expect(page.locator('.cmdk-panel')).toBeVisible();
    expect(await deVidrio(page.locator('.cmdk-panel'))).toEqual({ translucido: true, desenfoca: true });
});

test('los menús, la campana, los avisos y el recorrido son de vidrio', async ({ page, context, api }, info) => {
    await entrarComo(context, 'persona');
    await page.goto('perfil-usuario.html');
    await page.locator('#perfilMasBtn').click();
    await expect(page.locator('#perfilMasMenu')).toBeVisible();
    expect(await deVidrio(page.locator('#perfilMasMenu')), 'menú Más').toEqual({ translucido: true, desenfoca: true });
    await page.keyboard.press('Escape');

    await page.evaluate(() => SkillMatchUI.aviso('Vacante guardada en tus guardadas', 'ok'));
    const aviso = page.locator('.toast').first();
    await expect(aviso).toBeVisible();
    expect(await deVidrio(aviso), 'aviso').toEqual({ translucido: true, desenfoca: true });
    expect(await aviso.evaluate(el => getComputedStyle(el).color)).toBe('rgb(255, 255, 255)');

    const campana = page.locator('#notificationsBtn');
    if (await campana.isVisible()) {
        await campana.click();
        await expect(page.locator('#notificationsDropdown')).toBeVisible();
        expect(await deVidrio(page.locator('#notificationsDropdown')), 'campana').toEqual({ translucido: true, desenfoca: true });
    }

    await page.goto('index.html');
    await page.evaluate(() => SkillMatchUI.recorrido({ clave: 'prueba-vidrio', forzar: true, pasos: [{ objetivo: '#panelSaludo', titulo: 'Este es tu inicio', texto: 'Prueba del vidrio' }] }));
    await expect(page.locator('.recorrido-tarjeta')).toBeVisible();
    expect(await deVidrio(page.locator('.recorrido-tarjeta')), 'recorrido').toEqual({ translucido: true, desenfoca: true });
});

test('las listas desplegables de la marca son de vidrio', async ({ page, context, api }) => {
    await entrarComo(context, 'visitante');
    await page.goto('index.html');
    const lista = page.locator('.lista-boton').first();
    await lista.scrollIntoViewIfNeeded();
    await lista.click();
    const panel = page.locator('.lista-panel:not([hidden])').first();
    await expect(panel).toBeVisible();
    expect(await deVidrio(panel), 'lista desplegable').toEqual({ translucido: true, desenfoca: true });
});

test('con "reducir transparencia" la capa de controles vuelve a ser sólida', async ({ page, context, api }) => {
    await entrarComo(context, 'persona');
    await page.goto('perfil-usuario.html');
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] });
    expect(await deVidrio(page.locator('body > header'))).toEqual({ translucido: false, desenfoca: false });
    await page.evaluate(() => SkillMatchUI.cambiarContrasena());
    await expect(page.locator('#ventanaContrasena .modal-content')).toBeVisible();
    expect(await deVidrio(page.locator('#ventanaContrasena .modal-content'))).toEqual({ translucido: false, desenfoca: false });
    await page.keyboard.press('Escape');
    await page.evaluate(() => SkillMatchUI.aviso('Listo', 'ok'));
    expect(await deVidrio(page.locator('.toast').first())).toEqual({ translucido: false, desenfoca: false });
});

// Fase 3: Mi empresa y el perfil publico de empresa son paginas de vidrio (fondo vivo y tarjetas de tinte)
test('Mi empresa es de vidrio: tarjetas de tinte, "Primeros pasos" con su filo turquesa y el tablero con su borde punteado oculto', async ({ page, context, api }) => {
    await entrarComo(context, 'empresa');
    await page.goto('perfil-empresa.html');
    await expect(page.locator('body')).toHaveClass(/pagina-vidrio/);
    await expect(page.locator('.fondo-vivo')).toBeVisible();
    for (const s of ['.company-header-card', '.content-section-card', '.sidebar-widget']) {
        expect(await deVidrio(page.locator(s).first()), s).toEqual({ translucido: true, desenfoca: false });
    }
    const pasos = page.locator('.primeros-pasos');
    await expect(pasos).toBeVisible();
    const [filo, mar] = await pasos.evaluate(el => [getComputedStyle(el).borderTopColor, getComputedStyle(document.documentElement).getPropertyValue('--sea').trim()]);
    expect(filo).toBe(mar.replace(/^#(..)(..)(..)$/, (_, r, g, b) => `rgb(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)})`));
    const columna = page.locator('.tablero-columna').first();
    if (await columna.count()) {
        expect(await columna.evaluate(el => getComputedStyle(el).borderTopColor)).toBe('rgba(0, 0, 0, 0)');
    }
});

test('el perfil público de empresa es de vidrio, con el logo en un aro de vidrio', async ({ page, context, api }) => {
    await entrarComo(context, 'persona');
    await page.goto('empresa.html?id=c-hotel');
    await expect(page.locator('.empresa-cabeza h1')).toContainText('Hotel');
    await expect(page.locator('.fondo-vivo')).toBeVisible();
    for (const s of ['.empresa-cabeza', '.empresa-bloque']) {
        expect(await deVidrio(page.locator(s).first()), s).toEqual({ translucido: true, desenfoca: false });
    }
    const logo = page.locator('.empresa-cabeza.con-portada .empresa-avatar.grande');
    if (await logo.count()) expect((await deVidrio(logo)).desenfoca, 'aro del logo').toBe(true);
});

// Fase 4: Vacantes, Empresas, Conexiones y Mensajes
test('Vacantes es de vidrio: repisa arriba, filtros y vacantes de tinte, y las pestañas y la cuenta sobre vidrio', async ({ page, context, api }) => {
    await entrarComo(context, 'persona');
    await page.goto('oportunidades.html');
    await expect(page.locator('.opportunity-card').first()).toBeVisible();
    await expect(page.locator('.fondo-vivo')).toBeVisible();
    for (const s of ['.opportunities-header', '.filter-card', '.opportunity-card', '.tab-list', '.results-count']) {
        expect(await deVidrio(page.locator(s).first()), s).toEqual({ translucido: true, desenfoca: false });
    }
});

test('en Vacantes la cuenta de vacantes va a la misma altura que "Ordenar por"', async ({ page, context, api }, info) => {
    // En el celular van en dos filas: ahi no hay altura que comparar
    test.skip(info.project.name === 'celular', 'en el celular la cuenta y el orden van en filas distintas');
    await entrarComo(context, 'persona');
    await page.goto('oportunidades.html');
    await expect(page.locator('#resultsCount')).toContainText('vacantes');
    // Antes iba 12 px mas arriba: le quedaba el margen de abajo de los resultados de Inicio
    const centros = await page.evaluate(() => [document.getElementById('resultsCount'), document.getElementById('sortSelect')]
        .map(el => { const r = el.getBoundingClientRect(); return (r.top + r.bottom) / 2; }));
    expect(Math.abs(centros[0] - centros[1])).toBeLessThan(1);
});

test('el anillo de compatibilidad es un aro hueco: sin el círculo blanco del centro y con la pista translúcida', async ({ page, context, api }) => {
    await entrarComo(context, 'persona');
    await page.goto('oportunidades.html');
    await expect(page.locator('.opportunity-card').first()).toBeVisible();
    // 0 de 3: sobre el recuadro turquesa del detalle se veia un disco blanco con el "0%"
    await page.evaluate(() => abrirDetallePorId('j-web'));
    const anillo = page.locator('.modal.active .detalle-match .match-ring');
    await expect(anillo.locator('span')).toHaveText('0%');
    const estilo = await anillo.evaluate(el => {
        const a = getComputedStyle(el), b = getComputedStyle(el, '::before');
        return { fondo: a.backgroundImage, mascara: b.maskImage || b.webkitMaskImage, aro: b.backgroundImage };
    });
    expect(estilo.fondo, 'el anillo no pinta nada detras del numero').toBe('none');
    expect(estilo.mascara, 'el centro del aro es hueco').toContain('radial-gradient');
    expect(estilo.aro, 'la pista es translucida').toContain('rgba(8, 32, 60, 0.08)');
    // El aro dibuja el porcentaje del anillo: --pct no se hereda solo (@property) y el ::before lo toma a proposito
    await page.evaluate(() => abrirDetallePorId('j-practica-hotel'));
    const otro = page.locator('.modal.active .detalle-match .match-ring');
    await expect(otro.locator('span')).toHaveText('50%');
    await expect.poll(() => otro.evaluate(el => getComputedStyle(el, '::before').backgroundImage)).toContain(' 50%');
});

test('Empresas y Conexiones son de vidrio, con los títulos de sección sobre una repisa', async ({ page, context, api }) => {
    await entrarComo(context, 'persona');
    await page.goto('empresas.html');
    await expect(page.locator('.empresa-tarjeta').first()).toBeVisible();
    for (const s of ['.directorio-cabecera', '.empresa-tarjeta', '.directorio-titulo']) {
        expect(await deVidrio(page.locator(s).first()), s).toEqual({ translucido: true, desenfoca: false });
    }
    await page.goto('conexiones.html');
    await expect(page.locator('.connection-card').first()).toBeVisible();
    for (const s of ['.connections-header', '.connection-card', '.connections-tabs']) {
        expect(await deVidrio(page.locator(s).first()), s).toEqual({ translucido: true, desenfoca: false });
    }
});

test('Mensajes: los paneles son de vidrio y las burbujas siguen sólidas para leerse perfecto', async ({ page, context, api }) => {
    await entrarComo(context, 'persona');
    await page.goto('mensajes.html?userId=u-digital');
    await expect(page.locator('.message').first()).toBeVisible();
    for (const s of ['.conversations-sidebar', '.chat-area']) {
        expect(await deVidrio(page.locator(s).first()), s).toEqual({ translucido: true, desenfoca: false });
    }
    expect(await page.locator('.chat-messages').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
    for (const s of ['.message.sent .message-content', '.message:not(.sent) .message-content']) {
        const burbuja = page.locator(s).first();
        if (await burbuja.count()) expect(await deVidrio(burbuja), s).toEqual({ translucido: false, desenfoca: false });
    }
});

// Fase 5: Inicio e Indicadores
test('Inicio es de vidrio: repisas y tarjetas de tinte, y la portada oscura sigue sólida', async ({ page, context, api }) => {
    await entrarComo(context, 'visitante');
    await page.goto('index.html');
    await expect(page.locator('.fondo-vivo')).toBeVisible();
    await expect(page.locator('.cerca-tarjeta').first()).toBeVisible();
    for (const s of ['.search-section', '.benefits-section', '.como-funciona', '.stat-box', '.cerca-tarjeta']) {
        expect(await deVidrio(page.locator(s).first()), s).toEqual({ translucido: true, desenfoca: false });
    }
    expect(await deVidrio(page.locator('.hero')), 'portada').toEqual({ translucido: false, desenfoca: false });
    // El carrusel 3D sigue solido: en 3D las tarjetas translucidas se verian unas a traves de otras
    const campo = page.locator('.search-section .search-input');
    await campo.fill('mesero');
    await page.locator('.search-section .search-btn').click();
    const tarjeta = page.locator('#results-container .cv-tarjeta').first();
    await expect(tarjeta).toBeVisible();
    expect((await deVidrio(tarjeta)).translucido, 'tarjeta del carrusel').toBe(false);
});

// Con una repisa por seccion (cada una con su brillo y su raya) y la franja de las cifras sin vidrio,
// Inicio se veia en franjas horizontales de bordes duros
test('Inicio es una sola lámina de vidrio: el mismo tinte en todas las secciones, sin rayas entre ellas ni costura bajo la ola', async ({ page, context, api }) => {
    const secciones = ['.search-section', '.impact-stats', '.como-funciona', '.benefits-section',
        '.cerca-section', '.innovation-section'];
    const leer = lista => page.evaluate(lista => lista.map(s => {
        const cs = getComputedStyle(document.querySelector(s));
        return { s, fondo: cs.backgroundColor, bordes: [cs.borderTopWidth, cs.borderBottomWidth] };
    }), lista);

    await entrarComo(context, 'visitante');
    await page.goto('index.html');
    await expect(page.locator('.fondo-vivo')).toBeVisible();
    const visitante = await leer([...secciones, '.usuarios-empresas']);
    expect(visitante[0].fondo, 'tinte translucido').toMatch(/^rgba\(.+, 0\.\d+\)$/);
    for (const e of visitante) {
        expect(e.fondo, e.s).toBe(visitante[0].fondo);
        expect(e.bordes, e.s).toEqual(['0px', '0px']);
    }
    // Bajo la ola de la portada, el vidrio nace del mismo color de la ola y se funde
    const ola = await page.locator('.hero-ola').evaluate(el => getComputedStyle(el).backgroundColor);
    expect(await page.locator('.search-section').evaluate(el => getComputedStyle(el).backgroundImage)).toContain(ola);
});

test('con sesión, el panel de inicio también va sobre la lámina y el buscador la continúa sin costura', async ({ page, context, api }) => {
    await entrarComo(context, 'persona');
    await page.goto('index.html');
    await expect(page.locator('.panel-bloque').first()).toBeVisible();
    const [panel, buscador] = await page.evaluate(() => ['.panel-inicio', '.search-section'].map(s => {
        const cs = getComputedStyle(document.querySelector(s));
        return { fondo: cs.backgroundColor, brillo: cs.backgroundImage };
    }));
    expect(panel.fondo).toMatch(/^rgba\(.+, 0\.\d+\)$/);
    // Sin portada no hay ola: el buscador no empieza blanco (se veia una linea bajo el panel)
    expect(buscador).toEqual({ fondo: panel.fondo, brillo: 'none' });
    // La franja oscura del saludo sigue solida
    expect(await deVidrio(page.locator('.panel-franja')), 'franja del saludo').toEqual({ translucido: false, desenfoca: false });
});

test('el inicio de la persona y los Indicadores son de vidrio', async ({ page, context, api }) => {
    await entrarComo(context, 'persona');
    await page.goto('index.html');
    await expect(page.locator('.panel-bloque').first()).toBeVisible();
    expect(await deVidrio(page.locator('.panel-bloque').first()), 'bloque del panel').toEqual({ translucido: true, desenfoca: false });
    await page.goto('dashboard.html');
    await expect(page.locator('.indicador').first()).toBeVisible();
    for (const s of ['.indicadores-cabecera', '.indicador', '.indicadores-cifras li']) {
        expect(await deVidrio(page.locator(s).first()), s).toEqual({ translucido: true, desenfoca: false });
    }
});

// Fase 6: entrar y registrarse
test('entrar y registrarse: la columna del formulario y las tarjetas son de vidrio; los personajes y los campos siguen sólidos', async ({ page, context, api }) => {
    await entrarComo(context, 'visitante');
    await page.goto('login-usuario.html');
    await expect(page.locator('.fondo-vivo')).toBeVisible();
    expect(await deVidrio(page.locator('.auth-panel')), 'columna del formulario').toEqual({ translucido: true, desenfoca: false });
    expect((await deVidrio(page.locator('.auth-aside'))).translucido, 'columna de los personajes').toBe(false);
    expect(await deVidrio(page.locator('input[type="email"]').first()), 'campo').toEqual({ translucido: false, desenfoca: false });
    await page.goto('registro-usuario.html');
    expect(await deVidrio(page.locator('.registro-section > .container > .registro-form')), 'tarjeta del registro').toEqual({ translucido: true, desenfoca: false });
    await page.goto('seleccionar-registro.html');
    expect(await deVidrio(page.locator('.choice-card').first()), 'tarjeta de elegir').toEqual({ translucido: true, desenfoca: false });
});
