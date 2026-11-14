// Modelo predictivo: la página «Cómo aprende SkillMatch», el recuadro en «Mis postulaciones»
// y «Correos que recibo».
const { test, expect, entrarComo } = require('../apoyo/prueba');

// Un modelo que sí aprendió: el mismo del sitio, pero ganándole al modelo flojo
function modeloQueGana(api) {
    const m = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '../../SkillMatch/src/assets/data/modelo-predictivo.json'), 'utf8'));
    m.dar_consejos = true;
    m.examen.le_gana_al_flojo = true;
    m.examen.ganador = 'arbol';
    m.demostracion = false;
    api.estado.modelo = m;
    return m;
}

test.describe('Cómo aprende SkillMatch', () => {
    test('con los datos de prueba dice «Demostración» y que no le gana al modelo flojo', async ({ page, context, api, errores }) => {
        await entrarComo(context, 'visitante');
        await page.goto('como-aprende.html');
        await expect(page.locator('#mpEstado')).toContainText('151');
        await expect(page.locator('#mpDemo')).toBeVisible();
        await expect(page.locator('#mpVeredicto')).not.toHaveClass(/gana/);
        // Lo que mira: la variable nueva, solo con los que se postularon antes
        await expect(page.locator('#mpVariables')).toContainText('Cuántos se postularon antes');
        await expect(page.locator('#mpVariables')).not.toContainText('Cuánta gente se postuló');
        expect(errores).toEqual([]);
    });

    test('«Pruébalo» cambia al mover un control y nunca muestra un porcentaje', async ({ page, context, api, errores }) => {
        await entrarComo(context, 'visitante');
        await page.goto('como-aprende.html');
        const resultado = page.locator('#mpResultado');
        await expect(resultado).toContainText('Tus posibilidades son');
        await page.locator('input[name="postulantes_previos"]').fill('0');
        await page.locator('input[name="pct_habilidades"]').fill('100');
        await expect(page.locator('#oPost')).toHaveText('0');
        await expect(resultado).toContainText('Tus posibilidades son');
        // Nunca un porcentaje de posibilidades: el titulo solo dice buenas, regulares o bajas
        await expect(resultado.locator('.mp-recuadro-titulo')).not.toContainText('%');
        expect(errores).toEqual([]);
    });

    test('sin servidor usa el modelo guardado en el sitio', async ({ page, context, api }) => {
        await entrarComo(context, 'visitante');
        await context.route('http://localhost:8080/api/public/modelo', r => r.fulfill({ status: 503, body: '' }));
        await page.goto('como-aprende.html');
        await expect(page.locator('#mpEstado')).toContainText('151');
    });

    test('se llega desde Indicadores del mercado', async ({ page, context, api }) => {
        await entrarComo(context, 'visitante');
        await page.goto('dashboard.html');
        await expect(page.locator('.indicadores-enlace-modelo a')).toHaveAttribute('href', 'como-aprende.html');
    });
});

test.describe('el recuadro en «Mis postulaciones»', () => {
    const abrirPostulaciones = async page => {
        await page.goto('perfil-usuario.html');
        await page.locator('#interestedCompanies .btn-view-all').click();
    };

    test('mientras el modelo no le gana al flojo, no estima posibilidades', async ({ page, context, api }) => {
        await entrarComo(context, 'persona');
        await abrirPostulaciones(page);
        const recuadro = page.locator('.postulacion-fila .mp-recuadro').first();
        await expect(recuadro).toContainText('Todavía no podemos estimar tus posibilidades');
        expect(api.estado.llamadas).toContain('GET /modelo/mis-postulaciones');
    });

    test('cuando el modelo aprendió, dice buenas, regulares o bajas, sin porcentaje', async ({ page, context, api }) => {
        modeloQueGana(api);
        await entrarComo(context, 'persona');
        await abrirPostulaciones(page);
        const recuadro = page.locator('.postulacion-fila .mp-recuadro').first();
        await expect(recuadro).toContainText(/Tus posibilidades son (buenas|regulares|bajas)/);
        await expect(recuadro).toContainText('La empresa decide y no ve esto');
        await expect(recuadro.locator('.mp-recuadro-titulo')).not.toContainText('%');
        // El consejo nunca pide tener MENOS de algo
        await expect(recuadro).not.toContainText(/menos del|menos de \d/);
    });
});

test('«Correos que recibo» guarda lo que la persona elige', async ({ page, context, api, errores }) => {
    await entrarComo(context, 'persona');
    await page.goto('perfil-usuario.html');
    await page.locator('#perfilMasBtn').click();
    await page.locator('#correosBtn').click();
    const ventana = page.locator('#ventanaCorreos');
    await expect(ventana).toBeVisible();
    await expect(ventana).toContainText('Vacantes nuevas para mí');
    await ventana.locator('input[name="vacantes"]').check();
    await ventana.locator('button[type="submit"]').click();
    await expect.poll(() => api.estado.llamadas.filter(l => l === 'PUT /correos/preferencias').length).toBe(1);
    expect(errores).toEqual([]);
});
