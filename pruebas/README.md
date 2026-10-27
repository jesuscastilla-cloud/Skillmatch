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
| `casos/vacantes.spec.js` | Orden, "¿Por qué este match?", el trabajo del match, etiquetas "Nueva" y "Cierra pronto", conteos en los filtros, el detalle en el historial ("atrás" lo cierra), filtros en la dirección, postularse, "¿Cerrar sin guardar?" y el logo de cada empresa (con sesión, una consulta por empresa; el visitante ve la inicial) |
| `casos/mensajes.spec.js` | Lista, fechas y palomitas, "Ver perfil" de empresas, archivar, eliminar, copiar, abrir una conversación con el teclado y celular |
| `casos/empresa.spec.js` | "Nueva oferta" y "Acerca de nosotros" (preguntar antes de perder lo escrito), ventana de candidatos |
| `casos/avisos.spec.js` | "SkillMatch se está despertando" y la negrita de los avisos |
| `casos/indicadores.spec.js` | Cartagena una sola vez, "Ver detalle" (crece desde la tarjeta, esta semana contra la anterior, sin inventar si faltan datos) y los mensajes con el sitio vacío |
| `casos/conexiones.spec.js` | Las tarjetas no se enciman en el celular |
| `casos/inicio.spec.js` | Panel de inicio de la persona |
| `casos/perfil.spec.js` | Cabecera del perfil de persona: la foto (152 px, 112 en el celular) montada justo a la mitad de la portada, los botones en una fila al lado del nombre y el menú "Más" (teclado, clic afuera, no aparece en el perfil de otra persona); el panel: cifras de arriba, dos columnas, "Ver todas (N)" y sin cifras en el perfil de otra persona; el vidrio: manchas que se mueven solo con `transform` y arrancan según la hora, tarjetas sin desenfoque y barra y menú con desenfoque, pausa con una ventana abierta, quietas con movimiento reducido, sólido con alto contraste o menos transparencia, iniciales con colores de la marca, secciones vacías con su botón y listas parejas |
| `casos/exportar.spec.js` | "Descargar en Excel" en Mi empresa: un `.xlsx` de verdad con sus columnas, tildes, la fecha como fecha, títulos fijos con filtros y nada se vuelve fórmula |
| `casos/cerrar-vacante.spec.js` | Cerrar una vacante (qué pasa, responder a quienes esperan) y reabrirla (fecha vencida) |
| `casos/contrasena.spec.js` | Contraseña nueva: el ojo, lo que se pide, la fuerza en palabras y si coinciden (registros y "Cambiar contraseña"); la ventana abre sin error en el primer campo y con los botones de borde a borde |
| `casos/menu.spec.js` | El menú marca la sección al hacer scroll y su línea se desliza con el mouse (no con movimiento reducido) |
| `casos/cambio-de-pagina.spec.js` | Al cambiar de página, la línea del menú y la pastilla de la barra de pestañas viajan al destino y la página cambia cuando llegan; las cosas de la nueva entran en fila desde el lado de la opción (sin viaje ni espera con movimiento reducido: solo se funde); el guion del `<head>` va después de las hojas de estilo |
| `casos/hoja-de-vida-pdf.spec.js` | Llenar el perfil con la hoja de vida en PDF: lo que propone, lo dudoso sin marcar, dos columnas y nada se guarda sin confirmar |
| `casos/vidrio.spec.js` | La capa de vidrio de todo el sitio: la barra de arriba (y las pestañas en el celular) en varias páginas, las ventanas nuevas y viejas con los campos sólidos y la franja de botones que desenfoca, la paleta, el menú "Más", la campana, los avisos, el recorrido y las listas desplegables; con "reducir transparencia", todo sólido; Mi empresa y el perfil público de empresa como páginas de vidrio ("Primeros pasos" con su filo turquesa, el tablero con su borde punteado oculto, el logo con aro de vidrio); Vacantes, Empresas, Conexiones y Mensajes de vidrio (las pestañas y la cuenta sobre vidrio, las burbujas del chat sólidas); Inicio e Indicadores de vidrio (la portada oscura y el carrusel 3D sólidos); entrar y registrarse (la columna del formulario de vidrio, los personajes y los campos sólidos) |
| `casos/accesibilidad.spec.js` | Lo que encontró la auditoría y no debe volver: foco en buscadores y login, contadores legibles, títulos en orden, la barra de pestañas no tapa el foco |

| Apoyo | Para qué |
|---|---|
| `apoyo/datos.js` | Personas, empresas, vacantes, postulaciones, conexiones y mensajes inventados (fechas relativas a hoy) |
| `apoyo/api-falsa.js` | La API falsa. Si el frontend llama a una dirección que no tiene, la prueba de humo falla y la nombra |
| `apoyo/prueba.js` | `entrarComo(context, 'persona' \| 'empresa' \| 'visitante')` y la conexión de la API falsa |
| `apoyo/pdf.js` | Arma PDFs pequeños con texto para las pruebas de la hoja de vida (sin guardar archivos en el repositorio) |
| `apoyo/xlsx.js` | Lee un `.xlsx` sin librerías (revisa la huella de cada archivo del zip) para las pruebas de "Descargar en Excel" |
| `servidor.mjs` | Sirve `SkillMatch/src` en http://localhost:5510 (Playwright lo enciende solo) |
| `captura.js` | Foto de una página con la API falsa: `node captura.js oportunidades.html persona 390 oscuro` (queda en `capturas/`) |
| `contraste-vidrio.js` | Contraste de verdad sobre el vidrio: esconde el texto, detiene las manchas del fondo en 8 momentos y, con la foto, busca bajo cada texto el fondo más desfavorable (claro y oscuro, computador y celular). `node contraste-vidrio.js` (Mi perfil) o `node contraste-vidrio.js "perfil-usuario.html?id=u-andres" persona`. Con algo abierto: `CONTRASTE_ANTES` lo abre y `CONTRASTE_DENTRO` mide solo lo de adentro (por ejemplo `CONTRASTE_ANTES="SkillMatchUI.cambiarContrasena()" CONTRASTE_DENTRO=".modal.active .modal-content"`). Baja toda la página, no mide lo tapado por algo con fondo y cuenta aparte lo atenuado a propósito. Sale con error si algún texto queda bajo AA |
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
