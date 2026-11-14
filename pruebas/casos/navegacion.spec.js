// Navegacion: menu segun quien mira, botones de entrar/registrarse y cerrar sesion.
const { test, expect, entrarComo } = require('../apoyo/prueba');

// (sin el numero de no leidos que va pegado a "Mensajes")
const enlacesDelMenu = page => page.locator('header nav a').evaluateAll(as => as.map(a => a.textContent.trim().replace(/\d+$/, '')).filter(Boolean));

test('el HTML de las páginas públicas trae escrito el menú de visitante', async ({ request }) => {
    for (const pagina of ['oportunidades.html', 'empresas.html', 'empresa.html', 'dashboard.html', 'index.html']) {
        const html = await (await request.get(pagina)).text();
        const cabecera = html.match(/<header[^>]*>[\s\S]*?<\/header>/)[0];   // la portada trae class="vidrio-oscuro"
        expect(cabecera, pagina).toContain('login.html');
        expect(cabecera, pagina).not.toContain('data-cerrar-sesion');
    }
});

test('un visitante ve Iniciar sesión y Unirse ahora', async ({ page, context, api }) => {
    await entrarComo(context, 'visitante');
    await page.goto('oportunidades.html');
    const menu = await enlacesDelMenu(page);
    expect(menu).toEqual(expect.arrayContaining(['Inicio', 'Vacantes', 'Empresas', 'Iniciar sesión', 'Unirse ahora']));
    // "Cómo funciona" salió del menú: la sección se ve al bajar por la portada
    expect(menu).not.toContain('Cómo funciona');
});

// Con sesion, Tema + Mi perfil + Cerrar sesion van dentro del menu "Tu cuenta" («Titular», 2026-11-13)
const opcionesDeCuenta = page => page.locator('#menuCuenta a, #menuCuenta button:not([role="radio"])')
    .evaluateAll(as => as.map(a => a.textContent.trim()));

test('una persona ve Conexiones y Mensajes; Mi perfil y Cerrar sesión van en "Tu cuenta"', async ({ page, context, api }) => {
    await entrarComo(context, 'persona');
    await page.goto('oportunidades.html');
    const menu = await enlacesDelMenu(page);
    expect(menu).toEqual(expect.arrayContaining(['Conexiones', 'Mensajes']));
    expect(menu).not.toContain('Iniciar sesión');
    // En la barra ya no se ven sueltos: los reemplaza el botón de la cuenta
    await expect(page.locator('header .nav-links a[href="perfil-usuario.html"]')).toBeHidden();
    await expect(page.locator('header .nav-links a[data-cerrar-sesion]')).toBeHidden();
    await expect(page.locator('.cuenta-boton')).toBeVisible();
    expect(await opcionesDeCuenta(page)).toEqual(['Mi perfil', 'Hoja de vida', 'Mis postulaciones', 'Vacantes guardadas', 'Cambiar contraseña', 'Cerrar sesión']);
});

test('una empresa ve Mensajes, sin Conexiones; su cuenta lleva Mi empresa', async ({ page, context, api }) => {
    await entrarComo(context, 'empresa');
    await page.goto('empresas.html');
    const menu = await enlacesDelMenu(page);
    expect(menu).toContain('Mensajes');
    expect(menu).not.toContain('Conexiones');
    expect(await opcionesDeCuenta(page)).toEqual(['Mi empresa', 'Candidatos', 'Publicar una vacante', 'Cambiar contraseña', 'Cerrar sesión']);
});

test('el menú "Tu cuenta": se abre desde su botón, se maneja con el teclado y trae tu perfil, tus postulaciones y el tema', async ({ page, context, api }) => {
    await entrarComo(context, 'persona', { skillmatch_theme: 'light' });
    await page.goto('oportunidades.html');
    const boton = page.locator('.cuenta-boton');
    const menu = page.locator('#menuCuenta');
    await expect(menu).toBeHidden();
    await boton.click();
    await expect(menu).toBeVisible();
    await expect(boton).toHaveAttribute('aria-expanded', 'true');
    // El foco entra a la primera opción; Escape cierra y lo devuelve al botón
    await expect(menu.locator('.cuenta-opciones a').first()).toBeFocused();
    // Datos reales: lo completo del perfil (los 5 puntos de Mi perfil) y las postulaciones con respuesta
    await expect(menu.locator('.cuenta-nombre')).toHaveText('Valentina Herrera');
    await expect(menu.locator('.cuenta-tipo')).toContainText(/Perfil al \d+ %/);
    await expect(menu.locator('.cuenta-uso-cifra')).toHaveText(/te respondieron \d+ de \d+|aún no te postulas/);
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(boton).toBeFocused();
    // El tema: Claro / Oscuro / Auto (Auto no guarda nada y sigue al sistema)
    await boton.click();
    await expect(menu.locator('[role="radio"][aria-checked="true"]')).toHaveText('Claro');
    await menu.locator('[data-tema="dark"]').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await page.evaluate(() => localStorage.getItem('skillmatch_theme'))).toBe('dark');
    await menu.locator('[data-tema="auto"]').click();
    await expect(menu.locator('[role="radio"][aria-checked="true"]')).toHaveText('Auto');
    expect(await page.evaluate(() => localStorage.getItem('skillmatch_theme'))).toBeNull();
    // Mientras está abierto, la isla no se esconde al bajar
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(400);
    await expect(page.locator('html')).not.toHaveClass(/barras-escondidas/);
    // Un clic afuera lo cierra (x = 3: en el celular el menu ocupa todo el ancho menos 8 px a cada lado)
    await page.mouse.click(3, 400);
    await expect(menu).toBeHidden();
});

test('"Tu cuenta" muestra tu foto de perfil si tienes una (y si no, tu inicial)', async ({ page, context, api }) => {
    await entrarComo(context, 'persona');
    await page.goto('empresas.html');
    // Sin foto: la inicial
    await expect(page.locator('.cuenta-boton .cuenta-inicial')).toHaveText('V');
    // Con foto (una imagen de 1 px): dentro del anillo, en el botón y en el menú
    const foto = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
    await page.evaluate(async url => {
        const d = JSON.parse(localStorage.getItem('userData'));
        await fetchWithAuth(`${API_BASE_URL}/users/${d.id}/profile-image`, { method: 'PUT', body: JSON.stringify({ imageUrl: url }) });
    }, foto);
    await page.reload();
    await expect(page.locator('.cuenta-boton .cuenta-inicial img')).toHaveAttribute('src', foto);
    await page.locator('.cuenta-boton').click();
    await expect(page.locator('#menuCuenta .cuenta-inicial img')).toHaveAttribute('src', foto);
    // Al cambiarla en Mi perfil, el botón la toma en el momento (profile.js avisa con este evento)
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('skillmatch:foto', { detail: { url: null } })));
    await expect(page.locator('.cuenta-boton .cuenta-inicial')).toHaveText('V');
    // Una dirección que no es una imagen de verdad no se usa
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('skillmatch:foto', { detail: { url: 'javascript:alert(1)' } })));
    await expect(page.locator('.cuenta-boton .cuenta-inicial img')).toHaveCount(0);
});

test('"Cerrar sesión" desde el menú "Tu cuenta" cierra la sesión de verdad', async ({ page, context, api }) => {
    await entrarComo(context, 'persona');
    await page.goto('empresas.html');
    await page.locator('.cuenta-boton').click();
    await page.locator('#menuCuenta .cuenta-salir').click();
    await expect(page).toHaveURL(/index\.html/);
    expect(await page.evaluate(() => localStorage.getItem('userData'))).toBeNull();
});

test('en los logins no sale "Iniciar sesión" y en los registros no sale "Unirse ahora"', async ({ page, context, api }) => {
    await entrarComo(context, 'visitante');
    for (const pagina of ['login.html', 'login.html?tipo=empresa']) {
        await page.goto(pagina);
        await expect(page.locator('header .nav-links a.btn-login').locator('xpath=..'), pagina).toBeHidden();
    }
    for (const pagina of ['seleccionar-registro.html', 'registro-usuario.html', 'registro-empresa.html']) {
        await page.goto(pagina);
        await expect(page.locator('header .nav-links a.btn-register').locator('xpath=..'), pagina).toBeHidden();
    }
});

test('los registros tienen cómo entrar o cambiar de tipo de cuenta', async ({ page, context, api }) => {
    await entrarComo(context, 'visitante');
    const esperado = {
        'registro-usuario.html': ['login.html', 'registro-empresa.html'],
        'registro-empresa.html': ['login.html?tipo=empresa', 'registro-usuario.html'],
        'seleccionar-registro.html': ['login.html']
    };
    for (const [pagina, enlaces] of Object.entries(esperado)) {
        await page.goto(pagina);
        const hrefs = await page.locator('.auth-switch a').evaluateAll(as => as.map(a => a.getAttribute('href')));
        expect(hrefs, pagina).toEqual(enlaces);
    }
});

test('Cerrar sesión borra la sesión y lleva a la portada', async ({ page, context, api }) => {
    await entrarComo(context, 'persona');
    await page.goto('conexiones.html');
    await page.locator('[data-cerrar-sesion]').first().evaluate(a => a.click());
    await expect(page).toHaveURL(/index\.html/);
    expect(await page.evaluate(() => [localStorage.getItem('skillmatch_sesion_vence'), localStorage.getItem('userData')])).toEqual([null, null]);
    // El servidor borró la cookie de la sesión (F4: el token solo vive ahí)
    expect((await context.cookies()).some(c => c.name === 'auth_token' && c.value)).toBe(false);
});
