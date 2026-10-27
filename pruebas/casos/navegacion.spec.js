// Navegacion: menu segun quien mira, botones de entrar/registrarse y cerrar sesion.
const { test, expect, entrarComo } = require('../apoyo/prueba');

// (sin el numero de no leidos que va pegado a "Mensajes")
const enlacesDelMenu = page => page.locator('header nav a').evaluateAll(as => as.map(a => a.textContent.trim().replace(/\d+$/, '')).filter(Boolean));

test('el HTML de las páginas públicas trae escrito el menú de visitante', async ({ request }) => {
    for (const pagina of ['oportunidades.html', 'empresas.html', 'empresa.html', 'dashboard.html', 'index.html']) {
        const html = await (await request.get(pagina)).text();
        const cabecera = html.match(/<header>[\s\S]*?<\/header>/)[0];
        expect(cabecera, pagina).toContain('login.html');
        expect(cabecera, pagina).not.toContain('data-cerrar-sesion');
    }
});

test('un visitante ve Iniciar sesión y Unirse ahora', async ({ page, context, api }) => {
    await entrarComo(context, 'visitante');
    await page.goto('oportunidades.html');
    expect(await enlacesDelMenu(page)).toEqual(expect.arrayContaining(['Inicio', 'Vacantes', 'Cómo funciona', 'Empresas', 'Iniciar sesión', 'Unirse ahora']));
});

test('una persona ve Conexiones, Mensajes, Mi perfil y Cerrar sesión', async ({ page, context, api }) => {
    await entrarComo(context, 'persona');
    await page.goto('oportunidades.html');
    const menu = await enlacesDelMenu(page);
    expect(menu).toEqual(expect.arrayContaining(['Conexiones', 'Mensajes', 'Mi perfil', 'Cerrar sesión']));
    expect(menu).not.toContain('Iniciar sesión');
});

test('una empresa ve Mensajes y Mi empresa, sin Conexiones', async ({ page, context, api }) => {
    await entrarComo(context, 'empresa');
    await page.goto('empresas.html');
    const menu = await enlacesDelMenu(page);
    expect(menu).toEqual(expect.arrayContaining(['Mensajes', 'Mi empresa', 'Cerrar sesión']));
    expect(menu).not.toContain('Conexiones');
});

test('en los logins no sale "Iniciar sesión" y en los registros no sale "Unirse ahora"', async ({ page, context, api }) => {
    await entrarComo(context, 'visitante');
    for (const pagina of ['login.html', 'login-usuario.html', 'login-empresa.html']) {
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
        'registro-usuario.html': ['login-usuario.html', 'registro-empresa.html'],
        'registro-empresa.html': ['login-empresa.html', 'registro-usuario.html'],
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
    expect(await page.evaluate(() => [localStorage.getItem('token'), localStorage.getItem('userData')])).toEqual([null, null]);
});
