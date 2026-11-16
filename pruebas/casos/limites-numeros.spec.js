// Los numeros que alguien puede escribir mal o con mala intencion: salarios y ano de fundacion.
// Los limites son los del servidor (Montos.java): enteros de $1 a $50.000.000 al mes.
const { test, expect, entrarComo } = require('../apoyo/prueba');

const ventana = page => page.locator('#genericModal');

test.beforeEach(async ({ context }) => { await entrarComo(context, 'empresa'); });

async function abrirOferta(page) {
    await page.goto('perfil-empresa.html');
    await page.locator('.btn-new-offer').click();
    await expect(ventana(page)).toBeVisible();
}

test('los campos de salario no escriben letras, signos ni puntos', async ({ page }) => {
    await abrirOferta(page);
    const campo = page.locator('#offerSalaryMin');
    await campo.click();
    await page.keyboard.type('1e+-.,8abc00');          // solo los digitos se quedan
    await expect(campo).toHaveValue('1800');
});

test('al pegar texto raro se queda solo con los digitos, y nunca pasa de 8 cifras', async ({ page }) => {
    await abrirOferta(page);
    const campo = page.locator('#offerSalaryMax');
    await campo.evaluate(el => {
        el.value = '$ 9.999.999.999.999,50 pesos';
        el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(campo).toHaveValue('99999999');        // 8 cifras
});

test('un salario en 0 avisa al instante y no se envia', async ({ page, api }) => {
    await abrirOferta(page);
    await page.locator('#offerSalaryMin').fill('0');
    await expect(page.locator('#offerSalaryPreview')).toContainText('no puede ser $0');
    await expect(page.locator('#offerSalaryPreview')).toHaveClass(/es-aviso/);
    await page.locator('#offerTitle').fill('Mesero');
    await page.locator('#offerLocation').fill('Cartagena');
    await page.locator('#offerDescription').fill('Atender las mesas del restaurante con amabilidad.');
    await page.locator('#offerSkillInput').fill('Atención al cliente');
    await page.keyboard.press('Enter');
    await page.locator('#modalSaveBtn').click();
    await expect(page.locator('#offerError')).toContainText('no puede ser $0');
    expect(api.estado.llamadas.filter(l => l.startsWith('POST /jobs'))).toEqual([]);
});

test('un salario sobre 50 millones avisa, y uno de 2 pesos pide la cifra completa', async ({ page }) => {
    await abrirOferta(page);
    await page.locator('#offerSalaryMax').fill('50000001');
    await expect(page.locator('#offerSalaryPreview')).toContainText('no puede pasar de $50.000.000');
    await page.locator('#offerSalaryMax').fill('2');
    await expect(page.locator('#offerSalaryPreview')).toContainText('salario completo en pesos');
    await page.locator('#offerSalaryMax').fill('50000000');
    await expect(page.locator('#offerSalaryPreview')).not.toHaveClass(/es-aviso/);
});

test('el minimo mayor que el maximo avisa junto al campo', async ({ page }) => {
    await abrirOferta(page);
    await page.locator('#offerSalaryMin').fill('3000000');
    await page.locator('#offerSalaryMax').fill('2000000');
    await expect(page.locator('#offerSalaryPreview')).toContainText('mínimo no puede ser mayor');
});

test('el ano de fundacion solo recibe 4 digitos y fuera de rango se avisa', async ({ page, api }) => {
    await page.goto('perfil-empresa.html');
    await page.locator('#editarDatosEmpresaBtn').click();
    await page.locator('#datoAnio').click();
    await page.keyboard.type('-1e99999');
    await expect(page.locator('#datoAnio')).toHaveValue('1999');
    await page.locator('#datoAnio').fill('1700');
    await page.locator('#modalSaveBtn').click();
    await expect(page.locator('#datosEmpresaError')).toContainText('entre 1800 y');
    expect(api.estado.llamadas.filter(l => l === 'PATCH /companies/c-hotel')).toEqual([]);
});
