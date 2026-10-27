# Plan: efecto Liquid Glass (claro y oscuro): "Mi perfil" primero y después todo el sitio

Versión 2, del 26 de octubre de 2026. Incluye la revisión a fondo que pidió Luis: modo oscuro, fallos que
hay que evitar y mejoras de UX/UI. Se trabaja en la rama `fase-1-visual` con las reglas de `CLAUDE.md`:

- Explicar cada paso antes de hacerlo y esperar el visto bueno de Luis.
- Commits solo con su permiso.

Referencias:

- **Liquid Glass de Apple** (iOS 26, WWDC de junio de 2025, sesión 219).
- El reel **"Glassy Dashboard V2"** (code.xr).
- Las decisiones que Luis ya tomó en este proyecto (sección 2).

---

## 0. Lo que se vio al revisar la página (claro, oscuro, computador y celular)

Se tomaron fotos de "Mi perfil" con datos de prueba en los cuatro modos. Esto encontré:

| # | Hallazgo | Dónde | Arreglo | Fase |
|---|---|---|---|---|
| 1 | Las experiencias no cargan ("No se pudieron cargar las experiencias") | Backend: `ExperienceController.java:23` tiene `= null` (desde el 14 de septiembre, también en `main`). Ya estaba para Jesús en `PENDIENTES-BACKEND.md` 1.4 | Quitar `= null`. Decide Luis quién lo hace (sección 12) | 0 |
| 2 | Habilidades y Postulaciones salen pegadas (en claro y en oscuro) | La columna angosta separa con el margen de cada tarjeta; Habilidades (`.profile-card`) no lo tiene | **Hecho (sin commit):** la columna separa con `gap: var(--s5)` (24 px), igual que la ancha. Prueba nueva en `perfil.spec.js` | 0 |
| 3 | El fondo de colores **empieza de golpe** debajo de la cabecera: se ve un corte a la izquierda | `.perfil-panel::before` solo cubre el panel | El fondo vivo cubre toda la pantalla y es fijo | 2 |
| 4 | **En modo oscuro el vidrio casi no se nota**: las tarjetas parecen azul plano | Las manchas oscuras son muy tenues (14 a 26 %) y el vidrio es casi opaco | Receta propia para oscuro (sección 3) | 1 a 3 |
| 5 | **En oscuro, la mancha naranja se ve café** (sucia) detrás de las cifras | Naranja con poca opacidad sobre azul marino da café | En oscuro, naranja más pequeño, más saturado y solo como chispa | 1 a 3 |
| 6 | La cabecera (portada, foto, nombre) es una tarjeta sólida y rompe la unidad con el resto | `.profile-hero-new` no es de vidrio | Vidrio grueso | 3 |
| 7 | **La foto con iniciales sale morada**: no es un color de la marca | `profile.js`: `AVATAR_COLORS` tiene morado, fucsia y rosado (4 de 9) | Solo tonos de la marca: azul marino, turquesas, azul y naranja oscuro (con texto blanco legible) | 3 |
| 8 | En "Tus postulaciones", la vacante tiene letra más grande que el resto y un "·" que queda colgando al final de la línea | Estilos de esa lista | Misma escala que "Vacantes guardadas": título 15 px seminegrita, datos 13 px gris | 3 |
| 9 | En "Vacantes guardadas", la X queda suelta a media altura y la vacante tiene otra sangría que el título de la tarjeta | Estilos de esa lista | Alinear con el borde del contenido; X arriba a la derecha | 3 |
| 10 | Experiencia y Educación vacías solo dicen "Aún no has agregado...": no invitan a hacer nada | Texto plano | Estado vacío con icono, el porqué ("las empresas ven primero los perfiles con experiencia") y el botón de agregar | 3 |

---

## 1. Qué es Liquid Glass (desde cero)

Lo que tenemos hoy es **vidrio esmerilado**: la tarjeta es semitransparente y lo de atrás se ve
desenfocado (`backdrop-filter: blur`). Liquid Glass agrega más capas:

| Rasgo | Qué es | Cómo se hace en la web |
|---|---|---|
| **Desenfoque y tinte** | Lo de atrás se ve borroso, con un tinte suave | `backdrop-filter: blur() saturate()` + fondo translúcido |
| **Borde de luz** | Un filo brillante arriba y más tenue abajo, como vidrio grueso que recibe luz | Borde con degradado en un `::before` recortado con `mask` + `box-shadow: inset` |
| **Reflejo** | Un brillo suave sobre la superficie | Un degradado diagonal muy tenue en un `::after`, **quieto** (sección 2) |
| **Lente** | En los bordes, lo de atrás se dobla como a través de una lupa | Filtro SVG `feDisplacementMap` en `backdrop-filter: url(#lente)`. **Solo funciona en Chrome y Edge** |
| **Se adapta** | Más tinte cuando hace falta para que el texto se lea; lo grande lleva sombra más honda | Tres grosores (sección 4) y un tinte mínimo garantizado (sección 7) |

**Dos cosas que se aprendieron al analizar:**

- **La lente solo se nota si atrás hay detalle.** Detrás de las tarjetas solo hay manchas ya
  borrosas, y doblar algo borroso no se ve. Donde sí se nota es donde **pasa contenido por detrás**: la
  barra de arriba (las tarjetas pasan por debajo al bajar), la barra de pestañas del celular y el menú
  "Más". Ahí, y solo ahí, se usa.
- **Una superficie de vidrio dentro de otra no suma nada y cuesta.** El vidrio de adentro solo puede
  ver el de afuera (en Chrome, un `backdrop-filter` corta lo que ven los de adentro). Por eso lo de
  adentro (chips, vacantes, resumen de postulaciones) lleva solo un tinte translúcido, **sin**
  `backdrop-filter`. Se ve igual y la página va más liviana.

---

## 2. Reglas que no se rompen

**Decisiones que Luis ya tomó y se respetan:**

- **Nada de luz que siga al cursor** dentro de las tarjetas: Luis pidió quitarla el 7 de octubre
  (commit `4cb0613`). Por eso el reflejo es **quieto**, con la luz siempre arriba a la izquierda, como
  una lámpara fija.
  - El prototipo trae un interruptor para verla de nuevo, apagado de entrada. Solo se usa si Luis
    cambia de opinión.
- **Los botones no se mueven** al pasar el mouse (8 de octubre): conservan su destello actual.
- **Las tarjetas sí pueden subir un poco** al pasar el mouse (7 de octubre: "solo suben un poco").
- La foto del perfil sigue **montada** a la mitad de la portada (152 px; 112 en el celular).

**Reglas técnicas:**

1. **Que todo se lea:** contraste AA (4.5 a 1 en texto) en claro y en oscuro, **medido con píxeles en el
   peor momento** de las manchas, no adivinado (sección 7).
2. **60 cuadros por segundo:** solo se animan `transform` y `opacity`. Se mide con la tarjeta de video
   real (sección 8).
3. **Movimiento reducido:** el fondo queda quieto y no hay elevaciones. La página se sigue viendo bonita.
4. **Pantallas táctiles** (`hover: none`): no hay nada de mouse.
5. **Reducir transparencia** y **alto contraste de Windows** (`forced-colors`): tarjetas sólidas, sin
   manchas.
6. **Imprimir:** sin fondo ni vidrio.
7. **Nada de librerías nuevas ni CDN:** CSS, un filtro SVG escrito a mano y unas líneas en `ui.js`.
8. **No se cambian ids ni clases** que usan los módulos JS; solo se agregan.
9. **Todo bajo una clase en el `<body>`** (`pagina-vidrio`). Primero "Mi perfil" como piloto; después el
   resto del sitio, fase por fase (sección 15).
10. **Colores de la marca:** azul marino, turquesa y naranja; el naranja solo como chispa.

---

## 3. Modo claro y modo oscuro: dos recetas, no una

Lo que funciona en claro no sirve tal cual en oscuro.

- **En claro**, el vidrio se separa del fondo con **sombra** y con un tinte blanco.
- **En oscuro**, la sombra casi no se ve. El vidrio se separa con **luz**: un borde que brilla arriba, el
  tinte un poco **más claro** que el fondo y manchas que **brillan** en vez de teñir.

| Pieza | Modo claro | Modo oscuro |
|---|---|---|
| Fondo base | Gris azulado muy claro (`#EEF3F7`) | Azul marino profundo (`#0A1522`) |
| Manchas | Tiñen: turquesa 30 a 38 %, azul 20 %, naranja 18 % | Brillan: turquesa luminoso 28 a 34 %, azul eléctrico 24 %, naranja **pequeño y saturado** 12 % (para que no se vea café) |
| Tinte del vidrio | Blanco al 55 a 62 % | Azul marino claro al 50 a 58 % (más claro que el fondo) |
| Borde de luz | Blanco al 85 % arriba y 30 % abajo | Blanco al 16 % arriba y 4 % abajo |
| Separación | Sombra azul marino suave (12 a 22 %) | Brillo interior + sombra negra profunda (50 a 60 %), apenas visible |
| Reflejo quieto | Blanco al 35 % | Blanco al 6 % (más es "plástico") |
| Grano fino | 3 % | 4 % (en oscuro el *banding* se nota más) |
| Texto | Los tokens de hoy (`--ink`, `--muted`) | Los tokens de hoy en oscuro; el gris se revisa aparte |
| Turquesa como texto | `--sea-deep` | `--sea-luz` (ya pasa 4.9 a 1) |

**Cómo se comprueba:**

- Cada pieza tiene su variable con un valor para claro y otro para oscuro. No se escribe un color suelto
  dos veces.
- Se revisa el **cambio de tema** (el círculo que se abre): con el fondo moviéndose no debe parpadear.
- Se revisan los **esqueletos de carga** (`SkillMatchUI.skeletons`) sobre vidrio en los dos modos: el
  brillo que pasa debe verse en oscuro y no deslumbrar en claro.

---

## 4. El fondo vivo (la idea de Luis)

- **Qué es:** un `<div class="fondo-vivo" aria-hidden="true">` al inicio del `<body>`, fijo a la pantalla
  (`position: fixed; inset: 0`), detrás de todo y sin recibir clics. Como es fijo, acompaña toda la
  página al bajar.
- **Manchas:** 5 en el computador y 3 en el celular.
  - Son círculos grandes (40 a 60 % de la pantalla) con un degradado que **ya nace difuminado**.
  - **Nunca** se usa `filter: blur` en algo que se mueve: el navegador tendría que redibujarlo en cada
    cuadro.
- **Movimiento:** cada mancha recorre su propia ruta (`translate`) y crece un poco (`scale` de 1 a
  1.15).
  - Cada vuelta dura de 45 a 70 s, con duraciones distintas para que no se repita la misma figura.
  - Curva suave de ida y vuelta (`ease-in-out`, `alternate`): nada brusco ni que rebote.
- **Grano fino:** ruido casi invisible (un SVG quieto) para que los degradados no se vean en escalones.
- **Se pausa solo:**
  - Con movimiento reducido, las manchas quedan quietas en un lugar bonito.
  - Mientras hay una ventana abierta (Editar perfil, etc.): ahí el fondo no se ve y se ahorra trabajo.
  - En una pestaña que no se ve, lo frena el navegador.
- **Reemplaza** el fondo de hoy (`.perfil-panel::before`) y arregla el corte del hallazgo 3.
- **Cambio de página:** al entrar o salir del perfil, el fondo se funde en vez de deslizarse con la
  página (se revisa con `cambio-de-pagina.spec.js`).

---

## 5. La receta del vidrio

**Tres grosores**, como en Apple: lo grande pesa más.

| Grosor | Dónde | `backdrop-filter` | Sombra |
|---|---|---|---|
| `vidrio-fino` | Chips, vacantes de adentro, resumen de postulaciones, "+ Agregar" | **Ninguno** (solo tinte, porque va dentro de otro vidrio) | Ninguna |
| `vidrio` | Tarjetas y cifras | `blur(20px) saturate(170%)` | Suave |
| `vidrio-grueso` | Cabecera del perfil, menú "Más" y ventanas (fase 6) | `blur(28px) saturate(180%)` | Más honda |

**Cada superficie se arma así:**

1. **Cuerpo:** tinte translúcido y `backdrop-filter`.
2. **Borde de luz** (`::before`): un anillo de 1 px con degradado, más claro arriba a la izquierda,
   recortado con `mask` para que solo se vea el filo.
3. **Grosor:** `box-shadow: inset` con una línea clara arriba y una oscura casi invisible abajo.
4. **Reflejo quieto** (`::after`): un degradado diagonal muy tenue en la mitad de arriba.
5. **Esquinas concéntricas:** lo de adentro usa el radio de afuera menos el relleno. Por ejemplo, una
   tarjeta de 24 px con 16 px de relleno tiene cosas de adentro con 8 px.
6. **Lente** (opcional, sección 12):
   - Solo en la barra de arriba, la barra de pestañas y el menú "Más".
   - Solo en Chrome y Edge, que se detectan por la marca del navegador
     (`navigator.userAgentData.brands`).
   - No se detecta con `CSS.supports`: Safari diría que sí y perdería todo el desenfoque.

Todo con variables nuevas en `app.css`, cada una con su valor en claro y en oscuro:

- `--vidrio-tinte`, `--vidrio-borde-luz`, `--vidrio-reflejo`, `--vidrio-sombra`
- `--fondo-mancha-1` a `-5`

Van junto a los tokens `--*` que ya existen.

---

## 6. Movimiento e interacción

- **Una sola familia de movimiento:** la curva del sitio (`--ease-viaje`) y pocas duraciones (180 ms
  para tocar, 240 ms para aparecer).
- **Al entrar a la página:** las tarjetas llegan en fila. Ya existe (`bloque-entra`); se revisa con el
  vidrio.
- **Mouse sobre una tarjeta:** sube 2 px (`translateY`) y su borde de luz se aviva (`opacity`).
  - La sombra más honda es una capa aparte que cambia su `opacity`, porque animar `box-shadow` cuesta.
  - Con movimiento reducido no sube.
- **Botones:** no se mueven; conservan el destello de hoy, ahora sobre vidrio fino.
- **Menú "Más":** vidrio grueso que nace desde el botón (`scale` de .96 a 1 + `opacity`, con
  `transform-origin` en la esquina del botón).
- **Foco con teclado:** anillo turquesa con un filo claro (oscuro en modo oscuro), visible sobre
  cualquier vidrio.
- **Nada rebota, nada parpadea.**

---

## 7. Que se lea bien (lo que se le criticó a Apple)

- **Tinte mínimo:** cada vidrio tiene una opacidad mínima para que el texto pase AA aunque detrás pase
  la mancha más fuerte.
- **Medición con píxeles:**
  1. Se esconde el texto.
  2. Se detienen las manchas en 8 momentos de su recorrido.
  3. En cada momento se toma una foto y se busca, bajo cada texto, el fondo **más desfavorable**.
  4. Contra ese fondo se calcula el contraste.
  - Se hace en claro y en oscuro.
  - Es más estricto que la auditoría normal, que no sabe lo que hay detrás de un vidrio.
- **Los grises van primero:** los textos secundarios son los primeros en perder contraste, así que se
  revisan aparte.
- **Las manchas siempre van detrás:** nunca encima de un texto.

---

## 8. Rendimiento: medir, no adivinar

- **Cómo se mide:** un guion con Playwright y las herramientas de Edge (CDP).
  - Cuenta los cuadros por segundo con la página quieta (solo el fondo moviéndose) y al bajar con el
    scroll.
  - Se mide en computador y en celular simulado, también con el procesador frenado 4 veces.
  - Antes de medir se comprueba que el navegador **usa la tarjeta de video de verdad** (el nombre que
    da WebGL). Sin ella los números salen peores de lo real y no sirven.
- **Meta:** 55 fps o más en promedio, y que ningún cuadro tarde más de 50 ms.
- **Si no se llega**, se recorta en este orden:
  1. Quitar la lente.
  2. Bajar el desenfoque.
  3. Usar menos manchas.
  4. Clase `vidrio-liviano` para equipos con pocos núcleos.
- **Ahorro desde el diseño:**
  - Sin `backdrop-filter` en lo de adentro (sección 1).
  - `will-change` solo en las manchas.
  - Fondo en pausa con una ventana abierta.
  - En el celular, 3 manchas, desenfoque de 12 px y sin efectos de mouse.

---

## 9. Qué partes de la página cambian

| Parte | Qué recibe |
|---|---|
| Fondo de toda la página | Fondo vivo (sección 4) |
| Barra superior | Ya es de vidrio. Se afina el tinte en esta página; si la lente se aprueba, va aquí |
| Cabecera (portada, foto, nombre, botones, "Más") | Vidrio grueso. Iniciales con colores de la marca (hallazgo 7). "Editar perfil" y "Hoja de vida" en vidrio fino |
| Fila de cifras | Vidrio con borde de luz y reflejo. El anillo de progreso con resplandor turquesa |
| Experiencia, Educación, Vacantes para ti | Vidrio. Estados vacíos que invitan (hallazgo 10); vacantes de adentro en vidrio fino |
| Habilidades | Vidrio. Chips en vidrio fino |
| Postulaciones y Guardadas | Vidrio. Listas con la misma escala y alineación (hallazgos 8 y 9) |
| Barra de pestañas (celular) | Ya es de vidrio. Se afina el tinte; si la lente se aprueba, va aquí |
| Ventanas (Editar perfil, Agregar experiencia...) | **Fase 6, opcional:** son las mismas de todo el sitio |

---

## 10. Pruebas

En `pruebas/casos/perfil.spec.js`:

- [ ] Las dos columnas tienen la misma separación entre tarjetas (hallazgo 2).
- [ ] El fondo vivo existe, tiene 5 manchas en el computador y 3 en el celular, y se mueve con
      `transform`.
- [ ] Con movimiento reducido, nada se mueve.
- [ ] Con una ventana abierta, el fondo queda en pausa.
- [ ] Sin luz que siga al cursor (decisión de Luis), y nada de mouse en táctil.
- [ ] Con "reducir transparencia" y con `forced-colors`, todo es sólido.
- [ ] Lo de adentro **no** tiene `backdrop-filter`; las tarjetas sí.
- [ ] Las iniciales nunca salen moradas, fucsias ni rosadas.
- [ ] El menú "Más", las cifras, "Ver todas (N)" y el perfil de otra persona siguen igual.

Además:

- [ ] Contraste con píxeles (sección 7), en claro y oscuro.
- [ ] `node auditoria.js perfil-usuario` con 0 problemas.
- [ ] Medición de fps (sección 8).
- [ ] Suite completa antes de cada commit.

---

## 11. Fases (cada una: explicar, hacer, probar, Luis mira en Live Server, commit con permiso)

| Fase | Qué | Cómo lo ve Luis |
|---|---|---|
| **0** | Hallazgo 2 (separación); hallazgo 1 (backend, según decida Luis); los 5 commits pendientes | Columnas con el mismo aire; experiencias que cargan |
| **1** | **Prototipo aparte** con el fondo vivo y tres vidrios: **A** esmerilado mejorado, **B** líquido (borde de luz, grosor y reflejo), **C** = B + lente. Botones para claro/oscuro y velocidad del fondo. Medición de fps y contraste de cada uno | Lo abre él en Live Server y elige |
| **2** | Fondo vivo en el perfil real (hallazgo 3) | Las manchas moviéndose lento por toda la página |
| **3** | Vidrio elegido en todas las superficies, en claro y oscuro (hallazgos 4 a 10) | Toda la página de vidrio |
| **4** | Interacción: tarjetas que suben, menú "Más", foco con teclado | Mouse y teclado |
| **5** | Celular, rendimiento y accesibilidad: medición, contraste con píxeles, auditoría y ajustes | Ventana angosta; movimiento reducido |
| **6** | *(opcional)* Ventanas de vidrio en esta página | "Editar perfil" y "Agregar experiencia" |
| **7** | Pruebas, notas en `ANALISIS-FRONTEND.md` y `pruebas/README.md`, commits y PR #9 | Lista de commits |

---

## 11b. Lo que midió el prototipo (fase 1, 26 de octubre)

Prototipo: `SkillMatch/src/pages/prototipo-vidrio.html`. Sale del proyecto cuando Luis elija.

**Fluidez**, con la tarjeta de video real (AMD Radeon, Direct3D 11). Edge sin ventana no se limita a
60, así que los números muestran cuánto margen queda:

| Variante | Página quieta (fondo moviéndose) | Bajando | Cuadros de más de 50 ms |
|---|---|---|---|
| A | 136 a 139 fps | 257 a 276 fps | 0 |
| B | 140 a 141 fps | 268 a 272 fps | 0 |
| C (lente) | 81 a 92 fps | 148 a 155 fps | 0 |
| B con el fondo quieto | 144 fps | 275 fps | 0 |
| Celular con el procesador frenado 4 veces (A, B y C) | 144 fps | 284 a 287 fps | 0 |

- **B cuesta lo mismo que A:** el borde de luz y el reflejo son gratis.
- **La lente cuesta cerca de 40 % más**, pero sigue por encima de 60.
- **El fondo vivo casi no cuesta:** 140 contra 144 fps.

**Contraste medido con píxeles** (8 momentos de las manchas, 3 alturas de la página):

- **Primera medición:**
  - En claro, solo la "H" de Postulaciones quedó en 4.47.
  - En oscuro, **11 textos bajaron de 4.5** (3.85 a 4.07): grises, enlaces "Ver" e insignias "1 de 2".
    Cuando pasa una mancha turquesa, el vidrio se aclara.
- **Arreglos:**
  - Tinte oscuro de .50 a .62 (grueso .68).
  - Gris oscuro `#B2C3D6`.
  - Enlaces en oscuro con `--sea-luz`.
  - Insignias en oscuro `#A3ECF3`.
  - Insignias en claro `#075A63`.
- **Después:** **0 textos bajo AA**, en computador y celular, en las tres variantes. El mínimo quedó en
  4.68 en claro y 5.11 en oscuro.
- **Ojo:** la auditoría normal (`auditoria.js`) no ve esto, porque no sabe lo que hay detrás del vidrio.
  En la fase 5 se usa esta medición.

**Lecciones para la fase 3:**

- La lente en la barra ancha es sutil: el contenido se asoma como un fantasma (con poco desenfoque),
  como en iOS. Donde más se nota es en el menú "Más" y en el panel flotante.
- **El menú "Más" vive dentro de la cabecera de vidrio**, y un `backdrop-filter` dentro de otro solo
  ve lo de adentro. Cuando el menú se sale por debajo de la cabecera, no desenfoca las cifras.
  - Opciones para la fase 4: pintarlo al final del `<body>` mientras está abierto (mismos ids y el
    mismo `ui.js`), o darle un tinte más opaco.
- **"Cambiar portada"** va sobre la foto con su propio desenfoque. Ahí sí sirve, porque atrás hay
  detalle; con el vidrio fino se veía gris en claro.
- El panel de opciones arranca plegado en el celular.

**Ajustes tras volver a mirar el reel "Glassy Dashboard V2"** (mismo 26 de octubre):

- **Lo que hace que el reel se vea así:** el vidrio va **sobre una foto real** (una sala con madera y luz
  cálida). La foto tiene textura, así que el desenfoque se ve como material y no como un tinte. Además
  usa un solo acento: anillos de progreso naranjas.
- **Nuevo selector "Fondo"** en el prototipo: Manchas, **Getsemaní** y **Muralla**. Son fotos que ya
  están en el proyecto (`cartagena-getsemani.webp` y `cartagena-muralla.webp`).
  - La foto se acerca y se desliza muy lento (90 s por vuelta, solo `transform`).
  - Lleva un velo claro u oscuro según el tema.
  - Con foto, el vidrio va más lechoso y desenfocado (32 px; 40 px el grueso).
- **Contraste con foto:**
  - En claro, la piedra y las sombras oscurecían el vidrio y **17 textos bajaban de 4.5**.
  - Arreglo, solo en claro y con foto:
    - Tinte `.64` (grueso `.70`).
    - Velo un poco más claro.
    - Gris `#3F5671`.
    - Enlaces `#075A63`.
  - Quedan **0 textos bajo AA** en las tres opciones de fondo, en claro y oscuro, en computador y
    celular. El mínimo es 4.65.
- **Fluidez con foto:** con un `blur(3px)` en la foto, el navegador la redibujaba en cada cuadro y
  bajaba a unos 100 fps. Sin ese filtro vuelve a unos 139 fps, igual que con las manchas; el vidrio ya
  la desenfoca.
- **Anillo de progreso naranja** con degradado (completar el perfil es un logro, según `CLAUDE.md`).
- **Logo claro en modo oscuro**, como hace `ui.js` en el sitio.

---

## 12. Decisiones

**Ya tomadas por Luis (26 de octubre):**

- **Vidrio B** (líquido, sin lente).
- **Fondo de manchas** con movimiento **lento**.
- **Sin luz del cursor.**
- Claro y oscuro.
- **Llevarlo a todo el sitio** sin romper nada (sección 15).

**Siguen pendientes:**

1. **Backend de las experiencias:** ¿lo arreglamos nosotros o lo deja Jesús (`PENDIENTES-BACKEND.md`
   1.4)?
   - **Recomendado:** hacerlo nosotros en una rama y PR pequeñas aparte; Jesús solo la revisa y la pasa
     a `main`.
2. **Lente:** ¿se queda la variante C? (Solo barra de arriba, pestañas y menú "Más"; solo Chrome y
   Edge.) Se decide viendo el prototipo.
3. **Fondo:** manchas de colores, foto de Getsemaní o foto de la muralla. Y su velocidad: "muy lento"
   (casi ni se nota) o "lento" (se nota que respira). Se decide viendo el prototipo.
4. ~~Ventanas (fase 6)~~: entran, porque Luis quiere todo el sitio (sección 15, fase 2).

---

## 13. Riesgos y cómo se evitan

| Riesgo | Cómo se evita |
|---|---|
| Texto que no se lee sobre el vidrio | Tinte mínimo y contraste con píxeles en el peor momento, en claro y oscuro |
| En oscuro, vidrio que no se nota o mancha naranja café | Receta propia para oscuro (sección 3) |
| La página se pone lenta | Manchas sin `filter`, sin vidrio dentro de vidrio, pausa con ventanas abiertas, medición con la tarjeta de video real |
| Romper lo que ya funciona | Solo clases nuevas, mismos ids, todo bajo `.pagina-vidrio`, suite completa en cada fase |
| Safari o Firefox se ven distinto | La lente es un extra y se detecta por la marca del navegador: sin ella queda el vidrio normal |
| Que maree | Movimiento lento y suave; con movimiento reducido, quieto |
| Choque con el cambio de página o el cambio de tema | El fondo se funde al cambiar de página; el círculo del tema se prueba con el fondo moviéndose |
| Esqueletos de carga feos sobre vidrio | Se revisan en los dos modos |
| Volver a algo que Luis ya quitó | Sin luz que siga al cursor y botones quietos (sección 2) |

---

## 14. Prompt para Claude (para retomar en otra sesión)

> Lee `CLAUDE.md`, `.claude/estado-sesion.md` y `docs/PLAN-PERFIL-GLASS.md`. Vamos a darle a "Mi perfil"
> (`perfil-usuario.html`) el efecto Liquid Glass del plan, fase por fase y sin saltarte ninguna, en modo
> claro y oscuro.
>
> - **Antes de empezar cada fase:** explícala en español, paso a paso, y espera mi visto bueno.
> - **Respeta las decisiones de la sección 2:**
>   - Nada de luz que siga al cursor.
>   - Botones quietos.
>   - Foto montada.
> - **Y las reglas técnicas:**
>   - Contraste AA medido con píxeles.
>   - Solo `transform` y `opacity`.
>   - Nada de mouse en táctil ni con movimiento reducido.
>   - Sin librerías ni CDN.
>   - Sin cambiar ids ni clases.
>   - Todo bajo `.pagina-vidrio`.
>   - Colores de la marca.
> - **Reutiliza** `ui.js` y los tokens de `app.css`.
> - **Al terminar cada fase:**
>   - Mide fps con la tarjeta de video real.
>   - Corre la auditoría y la suite completa (sola, desde `pruebas/`).
>   - Dame el enlace de Live Server para mirarla yo mismo (sin fotos ni GIF).
>   - Detente y espera mi visto bueno.
> - **Commits:** pequeños, en español y solo con mi permiso. Nunca en `main`; la PR va hacia
>   `fase-1-identidad`.

---

## 15. Llevarlo a todo el sitio (pedido de Luis, 26 de octubre)

**Respuesta corta:** sí. Se hace como un **sistema** (una sola pieza que todas las páginas reutilizan) y
no copiando estilos página por página. Así no se rompe lo que ya funciona y el sitio queda parejo.

### El descubrimiento que lo hace posible (medido)

Sobre el fondo de manchas, si a las tarjetas se les **quita el desenfoque** y se deja solo el tinte, la
imagen cambia en promedio **1,5 a 2 de 255 por píxel** y **0 % de los píxeles cambia de forma visible**
(en claro y en oscuro). Las manchas ya son borrosas, así que desenfocarlas otra vez no se nota.
Por eso hay dos clases de vidrio:

| Clase | Qué lleva | Dónde | Costo |
|---|---|---|---|
| **Vidrio de tinte** | Tinte translúcido, borde de luz, grosor y reflejo; **sin** `backdrop-filter` | Tarjetas, listas, chips, cifras, cabeceras de perfil, vacantes, conversaciones... | Casi nada, aunque haya 50 tarjetas |
| **Vidrio real** | Lo mismo + `backdrop-filter` | Solo donde pasa **contenido con detalle** por detrás: barra de arriba, barra de pestañas, menús, ventanas, avisos, paleta Ctrl+K, recorrido guiado, filtros pegados al bajar | El que ya se midió (unos 140 fps) |

**Bonus:** el menú "Más" deja de tener el problema del vidrio dentro de vidrio (lección de 11b), porque la
cabecera ya no tiene `backdrop-filter`.

### Las piezas del sistema

1. **Tokens** en `app.css`, con los valores del prototipo ya medidos (claro y oscuro):
   - Tinte oscuro `.62`, gris `#B2C3D6`, enlaces `--sea-luz`, insignias `#A3ECF3`.
   - Insignias en claro `#075A63`.
2. **Clases nuevas:**
   - `pagina-vidrio` en el `<body>`.
   - Reglas que visten de vidrio los componentes que ya existen (`.card`, `.sidebar-card`,
     `.profile-card`, `.modal-content`...) **sin cambiarles el nombre**.
   - Tres grosores (fino, normal y grueso).
3. **Fondo vivo como pieza de `ui.js`**, que lo pone solo en cada página con `pagina-vidrio`.
   - Su movimiento va **sincronizado con el reloj**: al cambiar de página, las manchas siguen en el mismo
     lugar en vez de volver a empezar.
   - Con eso, el cambio de página que ya existe (las cosas entran deslizándose) se ve sobre un fondo que
     no salta.
4. **Lo que se apaga solo:**
   - Fondo en pausa con una ventana abierta.
   - Quieto con movimiento reducido.
   - Sólido con "reducir transparencia" y con alto contraste.
   - Sin vidrio al imprimir.
5. **Medición de contraste en todo el sitio:** el guion del prototipo pasa a `pruebas/contraste-vidrio.js`.
   - Recorre todas las páginas con la API falsa, en claro y oscuro, computador y celular.
   - Meta: 0 textos bajo AA.
   - Completa a `auditoria.js`, que no sabe lo que hay detrás de un vidrio.

### Fases para todo el sitio

En cada fase: explicar, hacer, contraste con píxeles en claro y oscuro, fps, auditoría, suite completa,
Luis mira en Live Server y commit con su permiso.

| Fase | Qué | Cuidado especial |
|---|---|---|
| **0** | Los 5 commits pendientes (15 a 19) y la decisión del backend. **Commits hechos** (`253dbe0` a `be05c0f`); falta la decisión del backend | Que quede una base guardada a la cual volver |
| **1** | El sistema y "Mi perfil" como piloto (fases 2 a 5 de este plan). **Hecho el 26 de octubre**, aprobado por Luis | Es la prueba de fuego del sistema |
| **2** | Piezas que están en todas las páginas: barra de arriba, pestañas, menús, ventanas (las de `UI.ventana` y las viejas), avisos, paleta Ctrl+K, recorrido guiado, esqueletos de carga. **Hecho el 26 de octubre** | Se prueban en todas las páginas, no solo en una |
| **3** | Mi empresa y perfil público de empresa. **Hecho el 26 de octubre** | Tablero de postulaciones (columnas), vista previa de la oferta, Excel |
| **4** | Vacantes, Empresas, Conexiones y Mensajes | Listas largas: solo vidrio de tinte. En el chat, burbujas que se lean bien |
| **5** | Inicio (portada del visitante y panel de la persona) e Indicadores | El carrusel 3D va sin `backdrop-filter` (en 3D se rompe); el mapa de Cartagena y las barras de las gráficas sobre vidrio |
| **6** | Entrar, registrarse y elegir registro | Ya tienen diseño propio (personajes, columna oscura): el vidrio va solo en la tarjeta del formulario |
| **Fuera** | Hoja de vida (es un documento para imprimir) y "Sin conexión" | Se quedan sólidas |

### Riesgos de hacerlo en todo el sitio

| Riesgo | Cómo se evita |
|---|---|
| Algún texto que no se lea en alguna página | `contraste-vidrio.js` en todas las páginas, claro y oscuro, en cada fase |
| Pruebas que miran colores de fondo | Se ajustan explicando por qué; nunca se borran |
| Celulares lentos | Medición con el procesador frenado 6 veces; vidrio real solo donde hace falta |
| El pie y las superficies oscuras de marca (portada, columna del login) | Se quedan como están: ya son oscuras a propósito |
| Romper algo de una página que no se probó | Fases pequeñas, una página o grupo a la vez, suite completa en cada una |

### Lo que se aprendió en la fase 1 (para las siguientes)

- **No fijar el fondo durante el cambio de página.** En una transición, la captura de la página nueva
  incluye el color de fondo, que es opaco: el fondo vivo quedaría tapado o taparía las tarjetas. Se desliza
  con la página y, como va con la hora, llega al mismo lugar.
- **Las ventanas viejas** se abren con `style.display = 'flex'`, sin clase. La pausa del fondo las reconoce
  por eso (`[style*="flex"]`).
- **`:is()` toma la fuerza de su selector más fuerte.** Una regla con un `#id` dentro de `:is()` les quitaba
  su color al pasar el mouse a todos los demás. Para lo de adentro de las tarjetas se usa `:where()`, que no
  suma fuerza.
- **Mi regla de oscuro pintaba de turquesa las insignias naranjas** ("3 de 3"). Ahora cada insignia
  conserva su color, con un tono más claro sobre vidrio.
- **La medición con píxeles necesita apagar las transiciones** (si no, mide el texto contra sí mismo) y
  saltar la sombra de la barra.
- **Barra y pestañas en claro:** tinte `.74` y `.86`. Con `.62` y `.80`, la portada oscura pasando por
  detrás dejaba "Inicio" en 4.0.

### Lo que se aprendió en la fase 2

- **Barra y pestañas: el tinte depende del peor caso de lo que pasa por detrás**, no del promedio. En
  SkillMatch el peor caso es la portada azul de Inicio (para la barra clara) y el papel blanco de la hoja
  de vida (para la barra oscura). Se calcula el tinte mínimo con el color del texto y se deja margen:
  quedó en 84 %.
  - Apple lo resuelve cambiando el tinte según lo que hay detrás; aquí un tinte fijo que aguanta todo es
    más simple y no falla.
- **Si el tinte tendría que ser casi sólido, se cambia el color del texto.** Las etiquetas de las
  pestañas pasaron a `--ink-3` y el vidrio se quedó en 86 % en lugar de 94 %.
- **La medición con píxeles necesita saber lo que se ve:**
  - Saltar lo que es solo para lectores de pantalla (`.sr-only`).
  - Recortar el texto a lo que deja ver su caja (el "…" de una vista previa, una lista con scroll).
  - Esconder también las líneas de tachado o subrayado que tienen su propio color.
  - Sin esto, cuatro "fallas" eran falsas.
- **Medir con las piezas abiertas** (`CONTRASTE_ANTES` y `CONTRASTE_DENTRO`). Las ventanas, los menús y
  los avisos solo existen cuando se abren.
- **La medición también encontró problemas de antes del vidrio:** el número naranja del anillo y el pie
  de la foto de Getsemaní. Se arreglaron en su propio commit.

### Lo que se aprendió en la fase 3

- **Ningún texto suelto sobre las manchas.** Lo que va directo sobre el fondo vivo (como "Todas las
  empresas") cambia de contraste según la mancha que pasa: quedaba entre 3.9 y 4.5. Se le da una
  pastilla de vidrio fino, igual que todo lo demás va sobre una tarjeta. En las fases 4 a 6 hay que
  buscar estos textos sueltos desde el principio.
- **En oscuro, las insignias turquesa** ("4", "2 de 5", la inicial de la empresa) necesitan el
  turquesa claro `#A3ECF3`, como en la fase 1. La regla ya las agrupa: a cada página nueva se le
  suman las suyas.
- **La vista previa de la oferta**, dentro de la ventana de Nueva oferta, ya se ve de vidrio porque la
  tarjeta de vacante lo es en las páginas de vidrio. Va a coincidir con Vacantes en la fase 4.
