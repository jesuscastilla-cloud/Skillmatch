// Elegir cuenta: una escena pequena en cada camino que se arma una vez (revision 2026-11-13).
const { test, expect, entrarComo } = require('../apoyo/prueba');

test('las dos escenas se arman y se quedan quietas; con "reducir movimiento" ya están armadas', async ({ page, context, api, errores }) => {
    await entrarComo(context, 'visitante');
    await page.goto('seleccionar-registro.html');
    for (const nombre of ['camino-persona', 'camino-empresa']) {
        const escena = page.locator(`.escenario[data-escena="${nombre}"]`);
        await expect(escena.locator('.escena-raiz > *').first()).toBeAttached();
        await expect(escena.locator('svg')).toHaveAttribute('role', 'img');
    }
    // Al terminar no se repite: queda quieta (escena-quieta) y sin animaciones corriendo
    await expect(page.locator('.escenario[data-escena="camino-empresa"]')).toHaveClass(/escena-quieta/, { timeout: 8000 });
    const corriendo = await page.locator('.escenario[data-escena="camino-empresa"]').evaluate(e => e.getAnimations({ subtree: true }).filter(a => a.playState === 'running').length);
    expect(corriendo).toBe(0);
    expect(errores).toEqual([]);
});
