# Pruebas del frontend de SkillMatch

Pruebas automáticas con [Playwright](https://playwright.dev) (gratis, de Microsoft). Abren las páginas en
**Edge**, hacen lo que haría una persona (entrar, buscar, filtrar, abrir una vacante, escribir un mensaje...) y
revisan que el resultado sea el correcto, en **computador y celular**.

**No necesitan el backend ni la base de datos:** usan una API falsa en memoria (`apoyo/api-falsa.js`) que
responde como el backend de verdad (mismas formas de respuesta y mismas reglas). Cada prueba empieza con datos
nuevos, así que siempre dan el mismo resultado y no tocan datos reales.

## Cómo correrlas

Desde esta carpeta (`pruebas/`), con Node instalado:

```
npm install        (solo la primera vez)
npm test           (todas, sin ventana: unos 5 minutos)
npm run test:ver   (con la ventana de Edge, una a la vez, para mirar)
npm run informe    (abre el informe de la última corrida, con capturas de lo que falló)
```

Para correr solo un archivo o una prueba:

```
npx playwright test casos/mensajes.spec.js
npx playwright test -g "archivar"
npx playwright test --project=celular
```

**Antes de unir una solicitud (PR), corre `npm test`.** Si algo falla, el informe muestra la captura y los pasos.

## Qué hay

| Archivo | Qué prueba |
|---|---|
| `casos/humo.spec.js` | Que cada página abra sin errores para visitante, persona y empresa, y que el frontend solo llame a direcciones que existen en el backend |
| `casos/navegacion.spec.js` | Menú según quién mira, botones de entrar y registrarse, enlaces del registro, cerrar sesión |
| `casos/vacantes.spec.js` | Orden, "¿Por qué este match?", el trabajo del match, etiquetas "Nueva" y "Cierra pronto", conteos en los filtros, el detalle en el historial ("atrás" lo cierra), filtros en la dirección, postularse y "¿Cerrar sin guardar?" |
| `casos/mensajes.spec.js` | Lista, fechas y palomitas, "Ver perfil" de empresas, archivar, eliminar, copiar, abrir una conversación con el teclado y celular |
| `casos/empresa.spec.js` | "Nueva oferta" y "Acerca de nosotros" (preguntar antes de perder lo escrito), ventana de candidatos |
| `casos/avisos.spec.js` | "SkillMatch se está despertando" y la negrita de los avisos |
| `casos/indicadores.spec.js` | Cartagena una sola vez, "Ver detalle" (crece desde la tarjeta, esta semana contra la anterior, sin inventar si faltan datos) y los mensajes con el sitio vacío |
| `casos/conexiones.spec.js` | Las tarjetas no se enciman en el celular |
| `casos/inicio.spec.js` | Panel de inicio de la persona |
| `casos/exportar.spec.js` | "Descargar en Excel" en Mi empresa: columnas, tildes, nada se vuelve fórmula |
| `casos/cerrar-vacante.spec.js` | Cerrar una vacante (qué pasa, responder a quienes esperan) y reabrirla (fecha vencida) |
| `casos/contrasena.spec.js` | Contraseña nueva: el ojo, lo que se pide, la fuerza en palabras y si coinciden (registros y "Cambiar contraseña") |
| `casos/menu.spec.js` | El menú marca la sección al hacer scroll y su línea se desliza con el mouse (no con movimiento reducido) |
| `casos/cambio-de-pagina.spec.js` | Al cambiar de página, la línea del menú y la pastilla de la barra de pestañas se van al destino mientras carga; la página se funde (sin desplazarse con movimiento reducido) |
| `casos/hoja-de-vida-pdf.spec.js` | Llenar el perfil con la hoja de vida en PDF: lo que propone, lo dudoso sin marcar, dos columnas y nada se guarda sin confirmar |
| `casos/accesibilidad.spec.js` | Lo que encontró la auditoría y no debe volver: foco en buscadores y login, contadores legibles, títulos en orden, la barra de pestañas no tapa el foco |

| Apoyo | Para qué |
|---|---|
| `apoyo/datos.js` | Personas, empresas, vacantes, postulaciones, conexiones y mensajes inventados (fechas relativas a hoy) |
| `apoyo/api-falsa.js` | La API falsa. Si el frontend llama a una dirección que no tiene, la prueba de humo falla y la nombra |
| `apoyo/prueba.js` | `entrarComo(context, 'persona' \| 'empresa' \| 'visitante')` y la conexión de la API falsa |
| `apoyo/pdf.js` | Arma PDFs pequeños con texto para las pruebas de la hoja de vida (sin guardar archivos en el repositorio) |
| `servidor.mjs` | Sirve `SkillMatch/src` en http://localhost:5510 (Playwright lo enciende solo) |
| `captura.js` | Foto de una página con la API falsa: `node captura.js oportunidades.html persona 390 oscuro` (queda en `capturas/`) |
| `auditoria.js` | Revisa todas las páginas (celular, de lado, letra muy grande, escritorio; claro y oscuro): contraste, tamaño de lo que se toca, foco con Tab, títulos, campos. `node auditoria.js` (unos 6 minutos) o `node auditoria.js mensajes` |

## Agregar una prueba

```js
const { test, expect, entrarComo } = require('../apoyo/prueba');

test('lo que debe pasar, dicho en español', async ({ page, context, api }) => {
    await entrarComo(context, 'persona');
    await page.goto('oportunidades.html');
    await expect(page.locator('.btn-ver-detalle').first()).toBeVisible();
    // api.estado.datos tiene los datos de la API falsa: se pueden cambiar antes o revisar después
});
```

Esta carpeta no entra al sitio publicado: el `Dockerfile` solo copia `backend/` y `SkillMatch/src`.
