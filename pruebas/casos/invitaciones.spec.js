// Invitaciones a la siguiente etapa: la empresa elige candidatos y los invita; el candidato responde.
const { test, expect, entrarComo } = require('../apoyo/prueba');

const enDias = (n, hora) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(hora, 0, 0, 0); return d; };
const java = d => { const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return x.toISOString().slice(0, 19); };

async function invitar(page) {
    await page.goto('perfil-empresa.html');
    await page.locator('#invitarModo').click();
    await page.locator('[data-invitar="a-1"]').check();
    await page.locator('[data-invitar="a-4"]').check();
    await expect(page.locator('#invitarCuenta')).toContainText('2 elegidos');
    await page.locator('#invitarAbrir').click();
    await page.locator('#invitarLugar').fill('Cra. 3 # 10-20, Bocagrande');
    await page.locator('#ventanaInvitar [data-siguiente]').click();
    await page.locator('#ventanaInvitar [data-siguiente]').click();
}

test.describe('la empresa', () => {
    test.beforeEach(async ({ context }) => { await entrarComo(context, 'empresa'); });

    test('sin procesos, "Invitaciones" explica para qué sirve y lleva a elegir candidatos', async ({ page, api, errores }) => {
        await page.goto('perfil-empresa.html');
        await expect(page.locator('.invitaciones-vacio')).toContainText('Invita a varios candidatos a la siguiente etapa');
        await expect(page.locator('#invitacionesPlan')).toContainText('0 de 20 invitaciones este mes');
        await page.locator('#invitacionesEmpezar').click();
        await expect(page.locator('#candidatos')).toHaveClass(/modo-invitar/);
        await expect(page.locator('[data-invitar]').first()).toBeVisible();
        expect(errores).toEqual([]);
    });

    test('elige a varios, propone horarios, revisa y envía; el panel muestra las respuestas', async ({ page, api, errores }) => {
        await invitar(page);
        await expect(page.locator('.invitar-vista')).toContainText('Hotel Puerta del Mar te invita a la siguiente etapa');
        await expect(page.locator('.invitar-uso')).toContainText('Usarás 2 de las 20 invitaciones');
        await page.locator('[data-enviar]').click();
        await expect(page.locator('.invitar-listo')).toContainText('Invitaste a 2 candidatos');
        expect(api.estado.datos.invitados.map(i => i.applicationId).sort()).toEqual(['a-1', 'a-4']);
        await page.locator('[data-ver]').click();
        await expect(page.locator('.proceso-cifras')).toContainText('2Sin responder');
        await expect(page.locator('.proceso-personas')).toContainText('Valentina Herrera');
        await expect(page.locator('#planLateral')).toContainText('2 de 20');
        expect(errores).toEqual([]);
    });

    test('una postulación rechazada no se puede elegir', async ({ page, api }) => {
        api.estado.datos.postulaciones.find(a => a.id === 'a-4').status = 'rechazada';
        await page.goto('perfil-empresa.html');
        await page.locator('#invitarModo').click();
        await expect(page.locator('[data-invitar="a-1"]')).toBeVisible();
        await expect(page.locator('[data-invitar="a-4"]')).toHaveCount(0);
    });

    test('candidatos de dos vacantes distintas: pide elegir una sola', async ({ page, api }) => {
        await page.goto('perfil-empresa.html');
        await page.locator('#invitarModo').click();
        await page.locator('[data-invitar="a-1"]').check();
        await page.locator('[data-invitar="a-2"]').check();
        await expect(page.locator('#invitarCuenta')).toContainText('elige candidatos de una sola vacante');
        await expect(page.locator('#invitarAbrir')).toBeDisabled();
    });

    test('sin cupo en el mes, lo dice y ofrece los planes', async ({ page, api }) => {
        for (let i = 0; i < 19; i++) api.estado.datos.invitados.push({ id: 'x' + i, companyId: 'c-hotel', createdAt: java(new Date()), estado: 'PENDIENTE', invitacionId: 'nada' });
        await invitar(page);
        await page.locator('[data-enviar]').click();
        await expect(page.locator('#invitarCupo')).toContainText('Te quedan 1 invitaciones este mes');
        await expect(page.locator('#invitarCupo a')).toHaveAttribute('href', 'planes.html#planes');
    });

    test('los horarios en el pasado no se pueden enviar', async ({ page, api }) => {
        await page.goto('perfil-empresa.html');
        await page.locator('#invitarModo').click();
        await page.locator('[data-invitar="a-1"]').check();
        await page.locator('#invitarAbrir').click();
        await page.locator('#invitarLugar').fill('Bocagrande');
        await page.locator('#ventanaInvitar [data-siguiente]').click();
        await page.locator('[data-dia="0"]').fill('2020-01-01');
        await page.locator('[data-dia="0"]').dispatchEvent('change');
        await page.locator('#ventanaInvitar [data-siguiente]').click();
        await expect(page.locator('#invitarError')).toContainText('al menos 2 horas después');
    });
});

test.describe('el candidato', () => {
    function procesoCon(api, cuposPrimero = 2) {
        const d = api.estado.datos;
        const h1 = java(enDias(3, 9)), h2 = java(enDias(3, 10));
        d.invitaciones.push({ id: 'inv-1', companyId: 'c-hotel', companyUserId: 'u-hotel', jobId: 'j-mesero', jobTitle: 'Mesero o mesera', tipo: 'ENTREVISTA',
            modalidad: 'PRESENCIAL', lugar: 'Cra. 3 # 10-20', enlace: null, indicaciones: 'Trae tu documento.', duracionMinutos: 30,
            horarios: [{ id: 'h1', inicio: h1, cupos: cuposPrimero }, { id: 'h2', inicio: h2, cupos: 2 }], respondeAntesDe: java(enDias(2, 18)), estado: 'ACTIVA', createdAt: java(new Date()) });
        d.invitados.push({ id: 'ic-1', invitacionId: 'inv-1', applicationId: 'a-1', userId: 'u-valentina', companyId: 'c-hotel', jobId: 'j-mesero', estado: 'PENDIENTE', createdAt: java(new Date()) });
    }

    test.beforeEach(async ({ context }) => { await entrarComo(context, 'persona'); });

    test('ve la invitación, elige un horario, confirma y ve el lugar y las indicaciones', async ({ page, api, errores }) => {
        procesoCon(api);
        await page.goto('perfil-usuario.html');
        await expect(page.locator('#invitacionesCard')).toContainText('1 por responder');
        await page.locator('[data-mia="ic-1"]').click();
        // Antes de decidir ya ve dónde es y qué debe llevar
        await expect(page.locator('.mia-antes')).toContainText('Cra. 3 # 10-20');
        await expect(page.locator('.mia-antes')).toContainText('Trae tu documento.');
        await page.locator('.mia-horario').first().click();
        await page.locator('[data-confirmar]').click();
        await expect(page.locator('.mia-confirmada')).toContainText('Tu asistencia está confirmada');
        await expect(page.locator('.mia-confirmada')).toContainText('Cra. 3 # 10-20');
        expect(api.estado.datos.invitados[0]).toMatchObject({ estado: 'CONFIRMADA', horarioId: 'h1' });
        expect(errores).toEqual([]);
    });

    test('en una reunión virtual, el enlace privado espera a la confirmación', async ({ page, api }) => {
        procesoCon(api);
        Object.assign(api.estado.datos.invitaciones[0], { modalidad: 'VIRTUAL', lugar: null, enlace: 'https://meet.example.com/abc' });
        await page.goto('perfil-usuario.html');
        await page.locator('[data-mia="ic-1"]').click();
        await expect(page.locator('.mia-antes')).toContainText('en línea');
        await expect(page.locator('.mia-antes')).not.toContainText('meet.example.com');
        await page.locator('.mia-horario').first().click();
        await page.locator('[data-confirmar]').click();
        await expect(page.locator('.mia-confirmada a')).toHaveAttribute('href', 'https://meet.example.com/abc');
    });

    test('un horario lleno no se puede elegir', async ({ page, api }) => {
        procesoCon(api, 1);
        api.estado.datos.invitados.push({ id: 'ic-2', invitacionId: 'inv-1', userId: 'u-sara', companyId: 'c-hotel', estado: 'CONFIRMADA', horarioId: 'h1', createdAt: java(new Date()) });
        await page.goto('perfil-usuario.html');
        await page.locator('[data-mia="ic-1"]').click();
        await expect(page.locator('.mia-horario').first()).toHaveClass(/is-lleno/);
        await expect(page.locator('.mia-horario input').first()).toBeDisabled();
    });

    test('puede avisar que no puede asistir', async ({ page, api }) => {
        procesoCon(api);
        await page.goto('perfil-usuario.html');
        await page.locator('[data-mia="ic-1"]').click();
        await page.locator('#miaComentario').fill('Estoy de viaje esa semana.');
        await page.locator('[data-no-puedo]').click();
        await page.locator('#ventanaConfirmar [data-si]').click();
        await expect.poll(() => api.estado.datos.invitados[0].estado).toBe('RECHAZADA');
        expect(api.estado.datos.invitados[0].comentario).toBe('Estoy de viaje esa semana.');
    });

    test('vencido el plazo, ya no deja responder', async ({ page, api }) => {
        procesoCon(api);
        api.estado.datos.invitaciones[0].respondeAntesDe = java(enDias(-1, 9));
        await page.goto('perfil-usuario.html');
        await page.locator('[data-mia="ic-1"]').click();
        await expect(page.locator('.mia-cerrada')).toContainText('ya no recibe respuestas');
        await expect(page.locator('[data-confirmar]')).toHaveCount(0);
    });
});
