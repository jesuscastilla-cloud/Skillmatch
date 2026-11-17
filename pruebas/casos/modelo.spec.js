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
    test('con los datos de ejemplo lo avisa y dice que no supera a la línea base', async ({ page, context, api, errores }) => {
        await entrarComo(context, 'visitante');
        await page.goto('como-aprende.html');
        await expect(page.locator('#mpEstado')).toContainText('151');
        await expect(page.locator('#mpDemo')).toBeVisible();
        await expect(page.locator('#mpDemo')).toContainText('Datos de ejemplo');
        await expect(page.locator('#mpVeredicto')).not.toHaveClass(/gana/);
        await expect(page.locator('#mpVeredicto')).toContainText('no supera a la línea base');
        // Las variables de entrada: la nueva, solo con los que se postularon antes
        await expect(page.locator('#mpVariables')).toContainText('Cuántos se postularon antes');
        await expect(page.locator('#mpVariables')).not.toContainText('Cuánta gente se postuló');
        expect(errores).toEqual([]);
    });

    // 2026-11-16: la pagina se lee como un informe, con los nombres tecnicos correctos y en el orden del proceso
    test('se lee como un informe: ficha técnica, pasos en orden y métricas con sus nombres correctos', async ({ page, context, api, errores }) => {
        await entrarComo(context, 'visitante');
        await page.goto('como-aprende.html');
        const ficha = page.locator('#mpFicha');
        await expect(ficha).toContainText('Clasificación binaria supervisada');
        await expect(ficha).toContainText('Árbol de decisión CART, criterio de Gini, profundidad máxima 4');
        await expect(ficha).toContainText('Validación cruzada estratificada de 5 pliegues, agrupada por vacante');
        // Los pasos, en el orden del proceso
        const titulos = await page.locator('.mp-parte h2').allTextContents();
        expect(titulos).toEqual(['Ficha técnica', 'Planteamiento del problema', 'Conjunto de datos', 'Variables de entrada', 'El modelo: árbol de decisión',
            'Evaluación del modelo', 'Interpretación: importancia de las variables', 'De la probabilidad al mensaje', 'Simulador',
            'Reentrenamiento', 'Análisis complementario: reglas de asociación']);
        // La matriz de confusión con sus ejes y sus cuatro casos
        const matriz = page.locator('.mp-confusion');
        await expect(matriz).toContainText('Predicción del modelo');
        await expect(matriz).toContainText('Real:');
        for (const sigla of ['VP', 'FN', 'FP', 'VN']) await expect(matriz).toContainText(sigla);
        // Las métricas de los tres modelos
        await expect(page.locator('.mp-metricas').first().locator('tbody tr')).toHaveCount(3);
        await expect(page.locator('.mp-metricas').first()).toContainText('Línea base');
        await expect(page.locator('.mp-metricas').first()).toContainText('ROC-AUC');
        // Los umbrales y las reglas de asociación con soporte, confianza y lift
        await expect(page.locator('#mpUmbrales')).toContainText('60 % o más');
        await expect(page.locator('#mpJuntas li').first()).toContainText('Lift');
        // Ni el lenguaje de antes ni el árbol perdido: el árbol sigue
        await expect(page.locator('main')).not.toContainText(/modelo flojo|nota del examen/i);
        await expect(page.locator('#mpArbol .mp-nodo').first()).toBeVisible();
        expect(errores).toEqual([]);
    });

    test('el simulador cambia al mover un control y nunca muestra un porcentaje', async ({ page, context, api, errores }) => {
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

test('«Mis postulaciones» avisa cuando la vacante ya cerró', async ({ page, context, api }) => {
    await entrarComo(context, 'persona');
    // La vacante de eventos esta cerrada: una postulacion en proceso a ella debe decirlo
    api.estado.datos.postulaciones.push({ id: 'a-cerrada', userId: 'u-valentina', jobId: 'j-eventos', status: 'pendiente', coverLetter: '', appliedDate: new Date().toISOString() });
    await page.goto('perfil-usuario.html');
    await page.locator('#interestedCompanies .btn-view-all').click();
    const fila = page.locator('.postulacion-fila[data-id="a-cerrada"]');
    await expect(fila).toContainText('Vacante cerrada');
});
