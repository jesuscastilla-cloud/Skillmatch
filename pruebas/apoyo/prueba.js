// Base de todas las pruebas: cada una trae su API falsa (datos nuevos), junta los
// errores de la pagina y puede entrar como persona, empresa o visitante.
const base = require('@playwright/test');
const { crearApi, tokenPara } = require('./api-falsa');

const CUENTAS = {
    persona: { id: 'u-valentina', firstName: 'Valentina', lastName: 'Herrera', email: 'valentina@prueba.test', role: 'USER', userType: 'usuario', companyId: null },
    otra: { id: 'u-andres', firstName: 'Andrés', lastName: 'Julio', email: 'andres@prueba.test', role: 'USER', userType: 'usuario', companyId: null },
    empresa: { id: 'u-hotel', firstName: 'Hotel Puerta del Mar', lastName: 'Empresa', email: 'hotel@prueba.test', role: 'EMPRESA', userType: 'empresa', companyId: 'c-hotel' },
    digital: { id: 'u-digital', firstName: 'Caribe Digital Estudio', lastName: 'Empresa', email: 'digital@prueba.test', role: 'EMPRESA', userType: 'empresa', companyId: 'c-digital' }
};

const test = base.test.extend({
    api: async ({ context }, use) => {
        const api = crearApi();
        await api.conectar(context);
        await use(api);
    },
    // Errores de JavaScript de la pagina (las pruebas revisan que no haya)
    errores: async ({ page }, use) => {
        const lista = [];
        page.on('pageerror', e => lista.push(e.message));
        await use(lista);
    }
});

/**
 * Entra como 'persona', 'otra', 'empresa', 'digital' o 'visitante' (sin sesion).
 * La sesion se pone una sola vez por pestana: cerrar sesion en la prueba funciona.
 * Los recorridos guiados quedan como vistos (no tapan la pantalla).
 */
async function entrarComo(context, quien, extra = {}) {
    const datos = CUENTAS[quien] || null;
    await context.addInitScript(({ token, datos, extra }) => {
        if (sessionStorage.getItem('__sesionDePrueba')) return;
        sessionStorage.setItem('__sesionDePrueba', '1');
        try {
            if (token) {
                localStorage.setItem('token', token);
                localStorage.setItem('userData', JSON.stringify(datos));
            } else {
                localStorage.removeItem('token');
                localStorage.removeItem('userData');
            }
            ['inicio-persona', 'inicio-empresa', 'mi-empresa'].forEach(c => localStorage.setItem('skillmatch_recorrido_' + c, 'visto'));
            Object.entries(extra).forEach(([k, v]) => localStorage.setItem(k, v));
        } catch (e) { /* sin almacenamiento */ }
    }, { token: datos ? tokenPara(datos.id) : null, datos, extra });
}

module.exports = { test, expect: base.expect, entrarComo, CUENTAS };
