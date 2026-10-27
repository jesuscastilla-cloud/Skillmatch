// Inicio: "Vacantes cerca de ti" (vacantes-cerca.js y ciudades.js). La ubicacion se simula con Playwright.
// Datos de prueba: en Turbaco hay 1 vacante (Auxiliar de cocina), en Arjona 1 (redes sociales), en
// Cartagena varias, en Barranquilla 1; en Bogota y sus alrededores, ninguna.
const { test, expect, entrarComo } = require('../apoyo/prueba');

const TURBACO = { latitude: 10.335, longitude: -75.41 };
const BOGOTA = { latitude: 4.65, longitude: -74.08 };
const distancias = page => page.locator('#cercaLista .cerca-tarjeta .cerca-distancia');
const cargos = page => page.locator('#cercaLista .cerca-tarjeta .cerca-cargo');

// Elegir ciudad como lo hace la lista de la marca: cambia el valor del <select> y avisa "change"
const elegirCiudad = (page, clave) => page.locator('#cercaCiudad').evaluate((select, clave) => {
    select.value = clave;
    select.dispatchEvent(new Event('change', { bubbles: true }));
}, clave);

test('sin permiso ni sesión salen las más cercanas a Cartagena, y la ubicación no se pide al entrar', async ({ page, context, api }) => {
    // Se cuenta cada vez que la pagina pide la ubicacion: al entrar debe ser 0
    await context.addInitScript(() => {
        window.__pedidasUbicacion = 0;
        const original = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
        navigator.geolocation.getCurrentPosition = (...args) => { window.__pedidasUbicacion++; return original(...args); };
    });
    await entrarComo(context, 'visitante');
    await page.goto('index.html');
    await expect(page.locator('#cercaFrase')).toHaveText('Las 6 vacantes abiertas más cercanas a Cartagena, de la más cerca a la más lejos.');
    await expect(cargos(page)).toHaveCount(6);
    await expect(distancias(page).first()).toHaveText('En Cartagena');
    await expect(page.locator('#cercaUbicacion')).toBeVisible();
    expect(await page.evaluate(() => window.__pedidasUbicacion)).toBe(0);
    // Cada tarjeta lleva a su vacante en Vacantes
    await expect(page.locator('#cercaLista .cerca-enlace').first()).toHaveAttribute('href', /^oportunidades\.html\?jobId=j-/);
});

test('con la ubicación en Turbaco: primero Turbaco y después Cartagena a 10 km, sin guardar las coordenadas', async ({ page, context, api }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation(TURBACO);
    await entrarComo(context, 'visitante');
    await page.goto('index.html');
    await expect(cargos(page)).toHaveCount(6);
    await page.locator('#cercaUbicacion').click();
    await expect(page.locator('#cercaFrase')).toHaveText('Las 6 vacantes abiertas más cercanas a tu ubicación (cerca de Turbaco), de la más cerca a la más lejos.');
    await expect(distancias(page).first()).toHaveText('En Turbaco');
    await expect(cargos(page).first()).toHaveText('Auxiliar de cocina');
    await expect(distancias(page).nth(1)).toHaveText('Cartagena · a 10 km');
    await expect(page.locator('#cercaCiudad')).toHaveValue('turbaco');
    // Se recuerda que uso su ubicacion, pero no donde esta
    const guardado = await page.evaluate(() => JSON.stringify(localStorage));
    expect(guardado).not.toContain('10.3');
    expect(guardado).not.toContain('-75.4');
});

test('si no da permiso, avisa con amabilidad y se queda con su ciudad', async ({ page, context, api }) => {
    await context.addInitScript(() => {
        navigator.geolocation.getCurrentPosition = (bien, mal) => setTimeout(() => mal({ code: 1, message: 'denegado' }), 50);
    });
    await entrarComo(context, 'visitante');
    await page.goto('index.html');
    await expect(cargos(page)).toHaveCount(6);
    await page.locator('#cercaUbicacion').click();
    await expect(page.locator('.toast', { hasText: 'No diste permiso para usar tu ubicación. Elige tu ciudad en la lista.' })).toBeVisible();
    await expect(page.locator('#cercaUbicacion')).toBeEnabled();
    await expect(page.locator('#cercaFrase')).toContainText('más cercanas a Cartagena');
});

test('en Bogotá dice que todavía no hay vacantes cerca y ofrece verlas todas', async ({ page, context, api }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation(BOGOTA);
    await entrarComo(context, 'visitante');
    await page.goto('index.html');
    await expect(cargos(page)).toHaveCount(6);
    await page.locator('#cercaUbicacion').click();
    await expect(page.locator('#cercaFrase')).toHaveText('Todavía no hay vacantes abiertas cerca de tu ubicación (cerca de Bogotá).');
    await expect(page.locator('#cercaVacio')).toBeVisible();
    await expect(page.locator('#cercaLista .cerca-tarjeta')).toHaveCount(0);
    await expect(page.locator('#cerca .cerca-pie a')).toHaveAttribute('href', 'oportunidades.html');
});

test('con sesión parte de la ciudad del perfil; otra ciudad elegida cambia la lista y se recuerda', async ({ page, context, api }) => {
    await entrarComo(context, 'otra');   // Andres vive en Turbaco
    await page.goto('index.html');
    await expect(page.locator('#cercaFrase')).toContainText('más cercanas a Turbaco');
    await expect(distancias(page).first()).toHaveText('En Turbaco');
    await elegirCiudad(page, 'arjona');
    await expect(page.locator('#cercaFrase')).toContainText('más cercanas a Arjona');
    await expect(cargos(page).first()).toHaveText('Persona para manejar redes sociales');
    await expect(distancias(page).nth(1)).toHaveText('Turbaco · a 11 km');
    await page.reload();
    await expect(page.locator('#cercaFrase')).toContainText('más cercanas a Arjona');
});

test('las empresas no ven la sección (no buscan empleo)', async ({ page, context, api }) => {
    await entrarComo(context, 'empresa');
    await page.goto('index.html');
    await expect(page.locator('#panelSaludo')).toBeVisible();
    await expect(page.locator('#cerca')).toBeHidden();
});

test('la tabla de ciudades: distancias conocidas, palabra completa y todas las ciudades del filtro de Inicio', async ({ page, context, api }) => {
    await entrarComo(context, 'visitante');
    await page.goto('index.html');
    const r = await page.evaluate(() => {
        const C = window.SkillMatchCiudades;
        const filtro = [...document.querySelectorAll('#location-select option')].map(o => o.value).filter(Boolean);
        return {
            cartagenaBarranquilla: Math.round(C.distanciaKm(10.3910, -75.4794, 10.9685, -74.7813)),
            bogotaMedellin: Math.round(C.distanciaKm(4.7110, -74.0721, 6.2442, -75.5812)),
            filtro: filtro.length, faltan: filtro.filter(k => !C.porClave(k)),
            bogota: (C.desdeTexto('BOGOTA D.C.') || {}).clave,
            itagui: (C.desdeTexto('Itagui, Antioquia') || {}).clave,
            buga: C.desdeTexto('Bugalagrande'),
            patron: C.patron(C.porClave('bogota'))
        };
    });
    expect(r.cartagenaBarranquilla).toBe(100);   // en linea recta
    expect(r.bogotaMedellin).toBe(239);
    expect(r.filtro).toBe(47);
    expect(r.faltan).toEqual([]);
    expect([r.bogota, r.itagui, r.buga]).toEqual(['bogota', 'itagui', null]);
    expect(r.patron).toBe('Bogot.');   // encuentra "Bogotá" y "Bogota" en el servidor
});
