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
    await expect(page.locator('#cercaFrase')).toHaveText('Las 4 vacantes abiertas más cercanas a Cartagena, de la más cerca a la más lejos.');
    await expect(cargos(page)).toHaveCount(4);
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
    await expect(cargos(page)).toHaveCount(4);
    await page.locator('#cercaUbicacion').click();
    await expect(page.locator('#cercaFrase')).toHaveText('Las 4 vacantes abiertas más cercanas a tu ubicación (cerca de Turbaco), de la más cerca a la más lejos.');
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
    await expect(cargos(page)).toHaveCount(4);
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
    await expect(cargos(page)).toHaveCount(4);
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

// El mapa (mapa-cerca.js) es un globo dibujado en un canvas. Espera a estar a la vista para volar del
// planeta entero a tu zona: aquí se baja hasta él y se espera a que la cámara quede quieta.
const estadoMapa = page => page.evaluate(() => window.SkillMatchMapaCerca.estado());
const mapaListo = async page => {
    await page.locator('#cercaMapa').scrollIntoViewIfNeeded();
    await expect.poll(async () => { const e = await estadoMapa(page); return !!(e && e.listo && !e.volando && !e.moviendo); }, { timeout: 15000 }).toBe(true);
};

test('el mapa es un globo: vuela del planeta entero a tu zona y pone un pin numerado por tarjeta', async ({ page, context, api, errores }, info) => {
    await entrarComo(context, 'visitante');
    await page.goto('index.html');
    await expect(distancias(page)).toHaveCount(4);
    // 4 tarjetas en 2x2 (en computador), cada una con el numero de su punto en el mapa
    await expect(page.locator('#cercaLista .cerca-numero')).toHaveText(['1', '2', '3', '4']);
    await expect(page.locator('#cercaMapa .cerca-mapa-sub')).toHaveText('4 vacantes en Cartagena');
    // Mientras nadie lo ve, el planeta entero espera quieto: sin pines todavia
    const antes = await estadoMapa(page);
    expect(antes.listo).toBe(false);
    expect(antes.zoom).toBeCloseTo(1, 1);
    await mapaListo(page);
    // Llego a Cartagena, muy de cerca, y sabe que eso es Colombia (la pinta mas clara)
    const e = await estadoMapa(page);
    expect(e.conMundo).toBe(true);
    expect(e.pais).toBe('Colombia');
    expect(e.zoom).toBeGreaterThan(10);
    expect(Math.abs(e.lat - 10.39)).toBeLessThan(0.1);
    expect(Math.abs(e.lon + 75.48)).toBeLessThan(0.1);
    await expect(page.locator('#cercaMapa .cm-pin-tu b')).toHaveText('Tú · Cartagena');
    // Las 4 son de tu ciudad: van a tu alrededor, unidas a ti, sin rutas
    await expect(page.locator('#cercaMapa .cm-pin-vacante i')).toHaveText(['1', '2', '3', '4']);
    await expect(page.locator('#cercaMapa .cm-rayo')).toHaveCount(4);
    await expect(page.locator('#cercaMapa .cm-ruta')).toHaveCount(0);
    // El recuadro de la esquina muestra el pais completo
    await expect(page.locator('#cercaMapa .cm-mini.se-ve')).toHaveCount(1);
    // El globo si se pinto (no es un canvas vacio)
    const pintado = await page.locator('#cercaMapa .cm-globo').evaluate(c => {
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        const colores = new Set();
        for (let i = 0; i < d.length; i += 4 * 97) colores.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]);
        return colores.size;
    });
    expect(pintado).toBeGreaterThan(3);
    if (info.project.name === 'escritorio') {
        const columnas = await page.locator('#cercaLista').evaluate(l => getComputedStyle(l).gridTemplateColumns.split(' ').length);
        expect(columnas).toBe(2);
    }
    // Desde Barranquilla: una vacante contigo y UNA ruta hacia Cartagena y Turbaco (quedan pegadas en el mapa)
    await elegirCiudad(page, 'barranquilla');
    await expect(page.locator('#cercaMapa .cerca-mapa-sub')).toHaveText('4 vacantes en 3 ciudades · la más lejos a 100 km');
    await mapaListo(page);
    await expect(page.locator('#cercaMapa .cm-ruta')).toHaveCount(1);
    await expect(page.locator('#cercaMapa .cm-ciudad')).toHaveText('Cartagena y Turbaco');
    await expect(page.locator('#cercaMapa .cm-km')).toHaveText('100 km');
    await expect(page.locator('#cercaMapa .cm-pin-vacante i')).toHaveText(['1', '2', '3', '4']);
    // Ningun pin queda fuera del mapa
    const fuera = await page.evaluate(() => {
        const m = document.querySelector('#cercaMapa .cerca-mapa-lienzo').getBoundingClientRect();
        return [...document.querySelectorAll('#cercaMapa .cm-pin-vacante i')].filter(p => {
            const r = p.getBoundingClientRect();
            return r.left < m.left || r.right > m.right || r.top < m.top || r.bottom > m.bottom;
        }).length;
    });
    expect(fuera).toBe(0);
    if (info.project.name === 'escritorio') {
        // La tarjeta 2 (en Turbaco) ilumina su punto y la ruta de su ciudad; la 1 (en tu ciudad), solo su punto
        await page.locator('#cercaLista .cerca-tarjeta').nth(1).hover();
        await expect(page.locator('#cercaMapa .cm-pin-vacante.es-resaltado i')).toHaveText('2');
        await expect(page.locator('#cercaMapa .cm-ruta.es-resaltada')).toHaveCount(1);
        await page.locator('#cercaLista .cerca-tarjeta').first().hover();
        await expect(page.locator('#cercaMapa .cm-pin-vacante.es-resaltado i')).toHaveText('1');
        await expect(page.locator('#cercaMapa .cm-ruta.es-resaltada')).toHaveCount(0);
    }
    expect(errores).toEqual([]);
});

test('el mapa sirve para cualquier lugar del mundo: desde Madrid se ve el planeta y la ruta cruza el océano', async ({ page, context, api, errores }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 40.4168, longitude: -3.7038 });
    await entrarComo(context, 'visitante');
    await page.goto('index.html');
    await expect(cargos(page)).toHaveCount(4);
    await page.locator('#cercaUbicacion').click();
    await expect(page.locator('#cercaMapa .cm-pin-tu b')).toHaveText('Tu ubicación');
    await mapaListo(page);
    const e = await estadoMapa(page);
    expect(e.pais).toBe('España');
    expect(e.zoom).toBeLessThan(2);                 // el planeta entero, no un acercamiento
    await expect(page.locator('#cercaMapa .cm-ruta').first()).toBeVisible();
    await expect(page.locator('#cercaMapa .cm-km').first()).toHaveText(/^\d\.\d{3} km$/);
    await expect(page.locator('#cercaMapa .cm-mini.se-ve')).toHaveCount(0);   // el recuadro sobra: ya se ve todo
    expect(errores).toEqual([]);
});

test('con "reducir movimiento" el mapa aparece ya en su sitio, sin vuelo ni luces', async ({ page, context, api }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await entrarComo(context, 'visitante');
    await page.goto('index.html');
    await expect(cargos(page)).toHaveCount(4);
    // Sin bajar hasta el: ya esta dibujado y quieto
    await expect.poll(async () => { const e = await estadoMapa(page); return !!(e && e.listo && !e.volando && e.zoom > 10); }).toBe(true);
    await expect(page.locator('#cercaMapa .cm-pin-vacante')).toHaveCount(4);
    await page.locator('#cercaMapa').scrollIntoViewIfNeeded();
    const moviendose = await page.locator('#cercaMapa').evaluate(m => m.getAnimations({ subtree: true }).filter(a => a.playState === 'running').length);
    expect(moviendose).toBe(0);
});

test('si el archivo del mundo no carga, el mapa igual muestra tu punto y los pines', async ({ page, context, api, errores }) => {
    await context.route('**/assets/data/mundo.json', ruta => ruta.abort());
    await entrarComo(context, 'visitante');
    await page.goto('index.html');
    await expect(cargos(page)).toHaveCount(4);
    await mapaListo(page);
    expect((await estadoMapa(page)).conMundo).toBe(false);
    await expect(page.locator('#cercaMapa .cm-pin-vacante i')).toHaveText(['1', '2', '3', '4']);
    await expect(page.locator('#cercaMapa .cm-pin-tu b')).toHaveText('Tú · Cartagena');
    expect(errores).toEqual([]);
});

test('el planeta flota sin recuadro y se arrastra para girarlo; el botón vuelve a tu zona', async ({ page, context, api, errores }, info) => {
    test.skip(info.project.name !== 'escritorio', 'el arrastre con mouse se prueba en el computador');
    await entrarComo(context, 'visitante');
    await page.goto('index.html');
    await expect(cargos(page)).toHaveCount(4);
    await mapaListo(page);
    // Sin panel: ni fondo ni borde
    const panel = await page.locator('#cercaMapa').evaluate(p => { const c = getComputedStyle(p); return { fondo: c.backgroundImage, color: c.backgroundColor, borde: c.borderTopWidth }; });
    expect(panel).toEqual({ fondo: 'none', color: 'rgba(0, 0, 0, 0)', borde: '0px' });
    // Alineado con las tarjetas: el mapa empieza y termina a la misma altura que ellas
    const [mapa, tarjetas] = await Promise.all([page.locator('#cercaMapa').boundingBox(), page.locator('#cercaLista').boundingBox()]);
    expect(Math.abs(mapa.y - tarjetas.y)).toBeLessThan(3);
    expect(Math.abs((mapa.y + mapa.height) - (tarjetas.y + tarjetas.height))).toBeLessThan(3);
    const caja = await page.locator('#cercaMapa .cerca-mapa-lienzo').boundingBox();
    // Arrastrar hacia la derecha: el planeta gira y tu punto se va con él
    const antes = await estadoMapa(page);
    const tuAntes = await page.locator('#cercaMapa .cm-pin-tu i').boundingBox();
    const cx = caja.x + caja.width / 2, cy = caja.y + caja.height / 2;
    await page.mouse.move(cx + 60, cy - 90);
    await page.mouse.down();
    await page.mouse.move(cx + 100, cy - 90, { steps: 4 });
    await page.mouse.move(cx + 150, cy - 90, { steps: 4 });
    await page.waitForTimeout(150);          // se detiene antes de soltar: sin empujón
    await page.mouse.up();
    await mapaListo(page);
    const despues = await estadoMapa(page);
    expect(despues.lon).toBeLessThan(antes.lon - 0.05);
    const tuDespues = await page.locator('#cercaMapa .cm-pin-tu i').boundingBox();
    expect(tuDespues.x).toBeGreaterThan(tuAntes.x + 60);
    // Los pines siguen ahí, pegados a tu punto
    await expect(page.locator('#cercaMapa .cm-pin-vacante i')).toHaveText(['1', '2', '3', '4']);
    // "Volver a mi zona" lo trae de vuelta
    await page.getByRole('button', { name: 'Volver a mi zona' }).click();
    await mapaListo(page);
    const vuelta = await estadoMapa(page);
    expect(Math.abs(vuelta.lon - antes.lon)).toBeLessThan(0.01);
    expect(Math.abs(vuelta.zoom - antes.zoom)).toBeLessThan(0.05);
    expect(errores).toEqual([]);
});

test('los botones acercan y alejan el mapa hasta ver el planeta entero', async ({ page, context, api }) => {
    await entrarComo(context, 'visitante');
    await page.goto('index.html');
    await expect(cargos(page)).toHaveCount(4);
    await mapaListo(page);
    const zona = (await estadoMapa(page)).zoom;
    await page.getByRole('button', { name: 'Acercar el mapa' }).click();
    await mapaListo(page);
    expect((await estadoMapa(page)).zoom).toBeGreaterThan(zona * 1.5);
    // Alejar hasta el tope: el planeta entero; ahí el botón se apaga y el recuadro del país sobra
    const alejar = page.getByRole('button', { name: 'Alejar el mapa' });
    for (let i = 0; i < 12 && await alejar.isEnabled(); i++) { await alejar.click(); await mapaListo(page); }
    await expect(alejar).toBeDisabled();
    expect((await estadoMapa(page)).zoom).toBeCloseTo(1, 1);
    await expect(page.locator('#cercaMapa .cm-mini.se-ve')).toHaveCount(0);
    // De lejos las 4 vacantes siguen con su pin
    await expect(page.locator('#cercaMapa .cm-pin-vacante')).toHaveCount(4);
});

test('tocar un pin elige su tarjeta; tocar el mapa la suelta', async ({ page, context, api }) => {
    await entrarComo(context, 'visitante');
    await page.goto('index.html');
    await expect(cargos(page)).toHaveCount(4);
    await mapaListo(page);
    await page.waitForTimeout(1400);         // los pines terminan de caer
    await page.locator('#cercaMapa .cm-pin-vacante[data-i="2"] i').click();
    await expect(page.locator('#cercaLista .cerca-tarjeta.es-resaltada .cerca-numero')).toHaveText('3');
    await expect(page.locator('#cercaMapa .cm-pin-vacante.es-resaltado i')).toHaveText('3');
    expect((await estadoMapa(page)).elegida).toBe(2);
    // Un clic en el mar (arriba del planeta) la suelta. En el celular la página bajó hasta la tarjeta: se vuelve al mapa
    await page.waitForTimeout(700);
    await page.locator('#cercaMapa .cerca-mapa-lienzo').evaluate(l => l.scrollIntoView({ block: 'center', behavior: 'instant' }));
    const caja = await page.locator('#cercaMapa .cerca-mapa-lienzo').boundingBox();
    await page.mouse.click(caja.x + caja.width / 2, caja.y + caja.height * 0.2);
    await expect(page.locator('#cercaLista .cerca-tarjeta.es-resaltada')).toHaveCount(0);
});
