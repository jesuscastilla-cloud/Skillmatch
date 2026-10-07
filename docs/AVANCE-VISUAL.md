# Avance visual — rama `fase-1-visual`

Bitácora del trabajo visual de Luis sobre `fase-1-identidad`, siguiendo `docs/PLAN-UI.md`
y las reglas de `CLAUDE.md`. Sirve para retomar en otra sesión y para escribir el PR.

- **Rama:** `fase-1-visual`, creada desde `fase-1-identidad`. Solo local (sin subir a GitHub).
- **Archivos tocados:** `assets/css/app.css`, `assets/js/ui.js`, `assets/js/index.js`,
  `assets/js/oportunidades.js` (dos arreglos de una línea), `assets/js/login-personajes.js`,
  `pages/index.html`, `pages/login-usuario.html`, `pages/login-empresa.html`,
  `assets/img/logo.png`, `assets/img/logo-oscuro.png`, `assets/js/vendor/lottie_light.min.js`.
- **No se tocó:** backend, `SecurityConfig.java`, IDs ni clases que usan los módulos JS.

## Cómo probar en este PC

1. Backend con la base **local**: en `backend/`, `.\start.ps1`.
   Con la base de Jesús (`skillmatch-dev`): `.\iniciar-dev.ps1` (pide la URI, no la guarda;
   el archivo está excluido de Git y traduce la URI `mongodb+srv` porque el hotspot del
   celular no responde las consultas DNS TXT). Hoy Atlas rechaza el usuario: hay que
   pedirle a Jesús que lo revise y le ponga contraseña nueva.
2. Frontend: Live Server en `SkillMatch/src/pages/index.html`.
3. **Para ver el movimiento**, activar en Windows: Configuración → Accesibilidad →
   Efectos visuales → Efectos de animación. Con eso apagado el sitio respeta
   `prefers-reduced-motion` y no anima nada (es lo correcto).

## Hecho

### Arreglos (lo que "quedó mal" en el rediseño)
- Texto blanco invisible en la tarjeta del hero (`.hero p` → `.hero-copy p`).
- Tarjetas usuario/empresa rotas: `.usuario/.empresa` chocaban con las etiquetas de vacante.
- Botones-enlace sin borde (`a.btn` le ganaba a las variantes).
- Iconos que saltaban de línea en todo el sitio (`.ico` sin `display`).
- Logo: de 1,8 MB a 50 KB, legible; versión clara en modo oscuro (`ui.js` la cambia).
- Contraste AA en todo el sitio (claro y oscuro): tokens `--ink-muted`, `--naranja-deep`,
  `--sea-deep` (oscuro), botón naranja con texto azul marino, botones turquesa en oscuro.
- Tamaños táctiles de 44 px; barra inferior oscura en modo oscuro.
- Oportunidades: búsqueda aplastada en celular, Guardar/Aplicar sin estilo, buscador que
  no filtraba (`/jobs/search` devuelve `{content}`), texto `<i data-ico>` visible al guardar.
- Estilos perdidos: pasos `.completed`, `.notification-item`, `.match-badge-small`.
- Perfiles de usuario y empresa que se desbordaban en celular.
- Logins de usuario/empresa con el diseño de dos columnas de `login.html`; registros en tarjeta.
- Cifras de impacto de la portada apiladas → en una fila.

### Fase 1 (secciones 1 y 3 del plan)
- Movimiento global en `ui.js` (sección 10) y `app.css` (25b): aparición escalonada 40 ms,
  foco de luz en tarjetas, inclinación 3D, botones magnéticos, onda al clic,
  View Transitions entre páginas.
- Paleta Ctrl+K (sección 12): vacantes reales mientras se escribe, navegación, tema.
- Tooltips animados (sección 13).
- Ilustración SVG propia y animada en los estados vacíos.
- Soporte Lottie (`SkillMatchUI.lottie`, `data-lottie`), librería verificada en `vendor/`.
- `alert()` → avisos de la marca (sección 14), con paso a la página siguiente si redirige.
- **Decisión:** sin cursor personalizado (distrae en una bolsa de empleo y empeora la accesibilidad).
- Login de usuarios con **personajes que caen y miran** (idea de Luis, sección 1 del plan):
  `assets/js/login-personajes.js` dibuja en SVG las figuras del logo y la chispa naranja, y las
  mueve con un motor propio de resortes y gravedad (caída con estiramiento y aplaste, rebote,
  polvo, sombras, mirada por capas). Miran el correo, cierran los ojos en la contraseña, la
  chispa espía con "mostrar contraseña", niegan con el error y saltan con el éxito. No toca
  `auth.js`. En celular, la columna oscura vuelve como franja encima del formulario.
  Modo demo: `?animar` en la dirección fuerza el movimiento aunque Windows tenga las
  animaciones apagadas (queda guardado; `?animar=0` lo quita).
- Login de empresas con los mismos personajes **de oficina** (`data-variante="empresa"`):
  camisa y corbata, corbatín y carnet, lentes. La corbata y el carnet son péndulos de verdad
  (reaccionan a cómo se mueve el punto del que cuelgan) y las cintas del carnet se recalculan
  en cada cuadro para no despegarse nunca. Al llegar, el azul se arregla la corbata.
- **Entrada con saltitos** en los dos logins (idea de Luis, opción B del boceto): cada uno cae
  lejos de su sitio y va saltando hasta acomodarse; saltos encadenados que terminan
  deslizándose, y los tres llegan a la vez.
- **Asienten** cuando el correo ya tiene forma válida y **aviso de Bloq Mayús** en la contraseña
  (pastilla naranja en la fila de "¿Olvidaste tu contraseña?", con `aria-live`; la chispa se
  sorprende y lo mira).
- **Profundidad** con el mouse (la chispa, adelante, se mueve más que el azul, atrás),
  **curiosidad** (ladean la cabeza si el mouse se queda quieto encima) y **sueño** tras 20 s sin
  actividad (ojos que se cierran despacio, respiración lenta, "z"); despiertan con un parpadeo.
- Los personajes también están en `login.html` (el de la portada), que ganó los mensajes de
  error y éxito dentro del formulario. El aviso de Bloq Mayús va en la fila de la etiqueta.
- **Cómo se verificó la animación:** el panel del navegador de Claude limita los cuadros por
  segundo, así que se probó con un reloj controlado (una copia de la página en un iframe donde
  el tiempo avanza cuadro a cuadro) y fotos en cada momento clave.

- **Pie de página grande** en las 13 páginas: `ui.js` lo dibuja dentro del `<footer>` (una sola
  fuente). Logo, frase, botón de búsqueda (Ctrl K), columnas de enlaces reales, año automático,
  "Volver arriba", la ola del hero arriba y "SkillMatch" gigante y tenue al final.

### Fase 2 (sección 2 del plan) — portada
- Titular palabra por palabra con "El trabajo / La práctica / El proyecto" en bucle. La palabra
  clave va en su propia línea (antes "El proyecto" partía el titular en 3 líneas y el hero
  crecía) y la que sale se deshace en **esporas** que el viento se lleva (idea de Luis).
- Gradiente del hero que reacciona al mouse.
- Demo del match en vivo en la tarjeta del hero.
- Scroll-telling "¿Cómo funciona?" con 4 escenas (sin librerías).
- Cifras de impacto que cuentan al entrar en pantalla.
- Ola bajo el hero y llamada final unida al pie.
- Mapa SVG de Cartagena (sección nueva tras las fotos): Centro, Bocagrande, Manga y Mamonal
  con puntos que laten; la lista de zonas y el mapa se resaltan juntos (mouse, toque o
  teclado) y un brillo naranja viaja a la zona activa. **Decisión:** sin cifras por barrio,
  porque las vacantes solo guardan la ciudad (`location`), no el barrio; se describe qué
  trabajo mueve cada zona. Las cifras reales llegarán con la "vista de mapa por barrio"
  de la Fase 3, que necesita ese campo en el backend.

### Pedidos de Luis tras la revisión de calidad (octubre)

- **Vacantes en baraja:** se quitó la inclinación 3D al pasar el mouse. Al bajar, cada vacante
  sale de debajo de la anterior y se acomoda con un rebote suave (`BARAJA` en `ui.js`,
  `.reveal.baraja` en `app.css`).
- **Iconos animados:** cada icono hace su propio gesto al pasar el mouse por su botón, enlace
  o filtro (maletín, birrete, cohete, estrella, campana, corazón, alfiler…). `ui.js` le pone
  la clase `ico-<nombre>`; las animaciones están en la sección 25d de `app.css`.
- **Perfil de usuario:** foto circular centrada en el borde de la portada; fuera las
  "estadísticas" inventadas; progreso arriba con pendientes que abren su formulario;
  recomendadas con "X de Y habilidades" reales; "Tus postulaciones" con conteos reales;
  conexiones reales; ventanas (portada, foto, habilidad, editar) arregladas.
- **Conexiones:** pestaña Mensajes centrada, pestañas sin barra fantasma, franja del título,
  sugerencias en cuadrícula con motivo y "Solicitud enviada"; avisos con `SkillMatchUI.aviso`.
- **Barra superior:** fuera la rayita gris bajo la campana (en todas las páginas).
- **Oportunidades:** % de compatibilidad real (habilidades tuyas sobre las que pide la vacante),
  habilidades tuyas marcadas, orden "Mayor Match" real que respeta los filtros, y filtros que se
  aplican al instante.
- **Perfil:** fuera las secciones de ejemplo (certificaciones, proyectos, recomendaciones).
- Detalle de cada arreglo y lo que queda para Jesús (incluida una fuga de datos urgente en
  `/api/connections/suggestions`): `docs/REVISION-CALIDAD.md`.

## Pendiente

- **Fase 2:** asistente Skilly (siguiente paso; necesita `/api/assistant` en el backend:
  hablarlo con Jesús).
- **En pausa por contenido real:** historias de éxito y cinta de logos (no se inventan).
- **Lottie:** faltan los JSON de Lottieflow (`exito`, `cargando`, `bajar`, `vacio`, `guardar`)
  en `assets/lottie/`.
- `confirm()` sigue siendo el del navegador (cambiarlo exige un modal asíncrono). Además,
  el `confirm()` de "Aplicar" en `oportunidades.js` muestra el texto `<i data-ico="...">`
  literal (un `confirm()` no dibuja HTML): se arregla al cambiarlo por el modal.
- **Barra superior en tableta (768 px):** se aprieta; "Oportunidades" se monta sobre los
  iconos de búsqueda y tema, y en la portada "Inicio / Innovación" se parten en dos líneas.
- Hablar con Jesús: este avance, la contraseña de Atlas y cuándo abrir el PR hacia
  `fase-1-identidad`.

## Cómo se verificó

Auditoría automática en el navegador (contraste WCAG AA, texto < 12 px, tamaño táctil,
desbordes y errores de JS) en todas las páginas, en claro y oscuro, a 375 px y 1280 px;
`node --check` en cada JS modificado y revisión de etiquetas HTML sin cerrar.
