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
- **Cómo se verificó la animación:** el panel del navegador de Claude limita los cuadros por
  segundo, así que se probó con un reloj controlado (una copia de la página en un iframe donde
  el tiempo avanza cuadro a cuadro) y fotos en cada momento clave.

### Fase 2 (sección 2 del plan) — portada
- Titular palabra por palabra con "El trabajo / La práctica / El proyecto" en bucle.
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

## Pendiente

- **Personajes del login (en curso, orden acordado con Luis el 2026-10-05):**
  ~~accesorios con física y versión corporativa~~ (hecho) → ~~entrada con saltitos~~ (hecho)
  → asentir con correo válido y aviso de Bloq Mayús → profundidad, sueño y ladeo de cabeza
  → pasarlos a `login.html`. Detalle en `docs/PLAN-UI.md`, sección 1.
- **Fase 2:** asistente Skilly (siguiente paso; necesita `/api/assistant` en el backend:
  hablarlo con Jesús).
- **En pausa por contenido real:** historias de éxito y cinta de logos (no se inventan).
- **Lottie:** faltan los JSON de Lottieflow (`exito`, `cargando`, `bajar`, `vacio`, `guardar`)
  en `assets/lottie/`.
- `confirm()` sigue siendo el del navegador (cambiarlo exige un modal asíncrono). Además,
  el `confirm()` de "Aplicar" en `oportunidades.js` muestra el texto `<i data-ico="...">`
  literal (un `confirm()` no dibuja HTML): se arregla al cambiarlo por el modal.
- Pie de página grande en todas las páginas (hoy solo la portada tiene la llamada final).
- Hablar con Jesús: este avance, la contraseña de Atlas y cuándo abrir el PR hacia
  `fase-1-identidad`.

## Cómo se verificó

Auditoría automática en el navegador (contraste WCAG AA, texto < 12 px, tamaño táctil,
desbordes y errores de JS) en todas las páginas, en claro y oscuro, a 375 px y 1280 px;
`node --check` en cada JS modificado y revisión de etiquetas HTML sin cerrar.
