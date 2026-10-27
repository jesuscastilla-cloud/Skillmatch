// Panel de inicio de la persona.
const { test, expect, entrarComo } = require('../apoyo/prueba');

test('"Vacantes para ti" dice qué se comparó y cuántas coinciden', async ({ page, context, api }) => {
    await entrarComo(context, 'persona');
    await page.goto('index.html');
    // 9 abiertas menos la que ya se postulo (Mesero) = 8; de esas, 2 piden alguna habilidad suya
    await expect(page.locator('#panelVacNota')).toHaveText('Comparamos tus 3 habilidades con las 8 vacantes más recientes: 2 piden alguna. Estas son las que más coinciden.');
});
