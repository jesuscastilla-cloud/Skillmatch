# Lo que se hizo la noche del 12 al 13 de noviembre de 2026

Luis pidió seguir mejorando la experiencia y el diseño toda la noche **sin dañar nada**.
Todo está en la rama `volver-portada-luis`, **sin commit** (igual que los cambios que ya había).
Cada cambio se probó con sus pruebas de `pruebas/` en Edge (escritorio y celular). No se corrió la suite completa.

Respaldo exacto de cómo estaba todo antes de empezar (los 26 archivos sin commit incluidos):
`C:\Users\amaya\AppData\Local\Claude-Data\claude_pzs8sxrjxfjjc\side-session-notes\local_57a6a0ec-2222-4958-87e1-b5d0088cc151\respaldo-antes-de-la-noche.tar`
(se abre con `tar -xf`; trae `SkillMatch/src` y `pruebas/casos`).

El informe de la revisión que originó este trabajo: https://claude.ai/artifact/WUhUUDKZe8mxhdNNU4ednd

---

## Fase A — Que nadie se tropiece

### 1. Volver a donde ibas después de entrar
**Antes:** un visitante tocaba "Postularme", salía un aviso y a los 1,2 s el sitio lo mandaba solo al login.
Al entrar terminaba en su perfil y tenía que buscar la vacante otra vez.

**Ahora:**
- "Postularme" o "Guardar" sin sesión abren una ventana con dos caminos: **Entrar** y **Crear mi perfil**. Ya no se va sola.
- Los dos caminos llevan en la dirección a dónde volver: `login.html?volver=oportunidades.html?jobId=...&accion=postular`.
- Al entrar (o al terminar el registro) vuelve a esa vacante **con la ventana de postulación abierta**.
- Las páginas que piden sesión (Conexiones, Mensajes, Mi perfil, Mi empresa, Hoja de vida) y la sesión vencida también recuerdan la página.
- Seguridad: solo se acepta volver a una página de este mismo sitio (`nombre.html?...`). Un enlace como `?volver=https://otro-sitio.com` se ignora.

Archivos: `api-config.js` (destinoSeguro, direccionDeEntrada, irAlLogin, destinoPedido), `auth.js`, `ui.js` (UI.pedirCuenta),
`oportunidades.js`, `search-handler.js`, `registro-usuario.js`, `registro-empresa.js`, `conexiones.js`, `mensajes.js`,
`hoja-de-vida.js`, `profile.js`, `perfil-empresa.js`. Prueba nueva: `pruebas/casos/volver-al-entrar.spec.js`.

### 2. Login en el celular
**Antes (375 px):** los personajes ocupaban ~190 px, había dos títulos ("Vuelve a tu búsqueda" e "Iniciar sesión")
y la barra de abajo tapaba "¿Olvidaste tu contraseña?". El botón de entrar quedaba fuera de la pantalla.

**Ahora:** los personajes son una franja más baja, el título repetido queda solo para el lector de pantalla y
**login, recuperar y registro ya no tienen barra de abajo** (son pantallas para terminar una sola tarea).
El botón "Iniciar sesión" y "Crear mi perfil" se ven sin bajar. (`app.css` sección 57, `ui.js` SIN_TABBAR)

### 3. Barra de abajo del celular según quién eres
- **Visitante:** Inicio · Vacantes · Empresas · Entrar (antes "Red", "Mensajes" y "Perfil", que solo llevaban al login).
- **Empresa:** "Red" pasa a **Candidatos** (lleva a sus postulaciones).
- **Persona:** igual que antes. (`ui.js`, DESTINOS_VISITANTE)

### 4. La lupa de la isla ya no queda tapada en el celular
A 375 px, "Cerrar sesión" o "Unirse ahora" se montaban encima de la lupa (el foco del teclado no se veía).
Ahora los espacios son cortos y, con sesión, "Cerrar sesión" es solo su ícono de 44 px (el lector de pantalla
sigue diciendo "Cerrar sesión"). Así deja de ser el botón más grande de la isla. (`app.css` sección 58)

### 5. Vacantes en el celular: filtros en una hoja que sube desde abajo
**Antes:** había que bajar ~700 px de filtros para ver la primera vacante.
**Ahora:** un botón **"Filtros"** (dice "Filtros (2)" cuando hay filtros puestos) abre una hoja desde abajo,
con su agarradera, una X, Escape o tocar afuera para cerrar, y un botón **"Ver 6 vacantes"** que se actualiza solo.
Mientras está abierta, el foco no se sale de ella. En escritorio no cambió nada.
(`oportunidades.html`, `oportunidades.js` prepararHojaDeFiltros, `app.css` sección 59; pruebas de `vacantes.spec.js` ajustadas
para abrir la hoja en el celular + una prueba nueva de la hoja)

### 6. Los errores de los formularios quedan unidos a su campo
En el login y los dos registros, el campo que falla queda con `aria-invalid="true"`, su error como descripción
(`aria-describedby`), el borde de error y el foco. Se desmarca apenas la persona corrige.
También los campos que el navegador marca inválidos al salir de ellos.
(`ui.js` UI.marcarCampo / desmarcarCampo, `auth.js`, `registro-usuario.js`, `registro-empresa.js`; prueba nueva `errores-en-campo.spec.js`)
El error de conexión del login ya no dice "verifica que el servidor esté corriendo" (eso es para programadores):
ahora dice "No pudimos conectar con SkillMatch. Revisa tu internet e intenta de nuevo en un momento."

### 7. Mi empresa: primero la gente
**Antes:** Acerca de nosotros → 5 tarjetas de ofertas → y recién a ~4.000 px, "Postulaciones recibidas".
**Ahora:** Primeros pasos (si falta algo) → **Postulaciones recibidas** → Ofertas publicadas → Acerca de nosotros.
Solo se movieron bloques del HTML: ningún ID ni clase cambió. (`perfil-empresa.html`)

---

## Fase D (adelantada) — La empresa ve la compatibilidad

### 8. Cada postulación trae su compatibilidad
El login le promete a la empresa "las personas, ordenadas por compatibilidad", pero no se mostraba en ningún lado.
Ahora cada postulación trae:
- el **anillo de compatibilidad** (el mismo de Vacantes, que se llena solo);
- las habilidades que pide la vacante: **turquesa con check** las que la persona tiene, **naranja** las que le faltan;
- un selector **"Ordenar: Más recientes / Más compatibles"**.

Mismo cálculo que ve la persona (de las habilidades que pide la vacante, cuántas tiene). Pide las habilidades de cada
persona al backend (`GET /api/users/{id}/skills`, que ya existía y ya pedía sesión), con un tope de 40 por carga.
(`perfil-empresa.js` pintarCompatibilidad, `app.css` sección 62; prueba nueva `empresa-compatibilidad.spec.js`)

---

## Fase B — Más rápido y más limpio, sin cambiar lo que se ve

### 9. Lo que no se ve no se mueve
La portada seguía moviendo sus brillos (portada azul, ola, cierre, pie) aunque estuvieran fuera de la pantalla:
quieta en el pie, gastaba ~0,9 s de trabajo cada 2 s. Ahora cada sección pausa sus animaciones infinitas
mientras no se ve y las sigue donde iban al volver. (`ui.js` pausarFueraDeVista, `app.css` sección 60)
Medido después: con la página abajo, ya no corre ninguna de la portada azul.

### 10. Limpieza de app.css (sin cambiar nada a la vista)
- Se quitaron **96 reglas** que solo usaban clases que no existen en ningún HTML ni JS (`.hero-card`, la demo vieja,
  `.result-card`, `.candidate-mini-*`, el perfil de empresa viejo con certificaciones/proyectos/recomendaciones,
  `.btn-upgrade-plan`, `.nav-toggle`, `.btn-ghost`, `.role-tag`…) y se recortaron **70 listas de selectores** que
  mezclaban clases vivas y muertas. ~14 KB menos.
- Cómo se comprobó que no se dañó nada: fotos de página completa de 22 páginas (visitante, persona y empresa) a 1280 px
  en claro y 375 px en oscuro, **antes y después**, comparadas píxel por píxel. Las únicas diferencias fueron el suavizado
  de las letras y los personajes del login (que se mueven solos), igual que entre dos fotos del "antes".
  Copia del CSS anterior por si acaso: scratchpad de la sesión, `app.css.antes-limpieza`.
- Los 4 `transition: all` ahora dicen qué cambia (borde, color, fondo).
- En pantallas táctiles, las tarjetas ya no se quedan "levantadas" después de tocarlas (`app.css` sección 61).

---

## Fase C — La experiencia de la persona

### 11. El contador de "Mensajes" va sobre su ícono
Con el menú de ícono arriba y texto abajo, el contador quedaba como tercera fila y subía "Mensajes" por encima de las demás
opciones. Ahora va sobre el ícono, igual que el de "Avisos" y que en la barra del celular. (`app.css` sección 63)

### 12. El pie de página según quién eres
Con sesión, el pie ya no ofrece "Crear mi perfil", "Iniciar sesión" ni "Registrar mi empresa":
- **Persona:** Tu cuenta (Mi perfil, Vacantes guardadas, Hoja de vida en PDF, Mensajes) · Explora (Vacantes, Empresas, Tu red).
- **Empresa:** Tu empresa (Mi empresa, Postulaciones recibidas, Tus vacantes, Mensajes) · Explora.
- La columna "SkillMatch" (Cómo funciona, Indicadores, Política de datos) sigue para todos. (`ui.js` columnasDelPie)

### 13. Las 4 cifras de la portada, parejas en el celular
En 375 px la segunda columna no empezaba en el mismo borde (el "4" quedaba 12 px corrido). Ahora es una cuadrícula 2×2. (`app.css` sección 64)

### 14. El naranja, para la acción decisiva
En Vacantes había 9 "Postularme" naranjas a la vez (y 4 "Ver y postularme" en Mi perfil). En las **listas** ahora van en
naranja suave (texto naranja oscuro, 5,4:1) y se llenan de naranja al pasar el mouse; **en el detalle de la vacante, donde
se decide, sigue naranja lleno**. (`app.css` sección 65)

### 15. La chispa del match al postularse
Al enviar una postulación, "Ya te postulaste" llega como un **sello** (se posa desde un poco más grande) y de él sale un
estallido corto de puntos **naranja, turquesa y azul** (los colores del logo) con un aro que se abre como el anillo de
compatibilidad. Dura ~0,7 s, solo usa transform y opacity, sigue al botón si la lista se reacomoda y no aparece con
"reducir movimiento". Queda como herramienta para otros momentos: `SkillMatchUI.chispa(elemento)`.
(`ui.js` UI.chispa, `oportunidades.js`, `app.css` sección 66; 2 pruebas nuevas en `vacantes.spec.js`)

### 16. La empresa también celebra el match
Al **aceptar** a alguien (botón "Aceptar" o moverlo a "Aceptada" en el tablero) sale la misma chispa.
Los avisos de error de Mi empresa ya no muestran el mensaje técnico del servidor
("Error al actualizar el estado…: Error 500"): dicen qué pasó y qué hacer. (`perfil-empresa.js`)

### 17. Registro: tu tarjeta se arma mientras escribes
En pantallas anchas, al lado del formulario aparece **"Así te verán las empresas"**: una tarjeta con portada azul marino
y filo turquesa (la familia de la escena de noche). Tu nombre aparece al escribirlo, tus iniciales en el círculo
turquesa, "a qué te dedicas", la ciudad con su pin naranja, y **cada habilidad llega como una pieza que encaja**.
Abajo, una barra naranja dice qué tan completa va. En el celular no aparece (el formulario va primero y completo).
Es solo una vista (`aria-hidden`): el lector de pantalla ya tiene los campos.
(`registro-usuario.js` tarjetaQueSeArma, `app.css` sección 67; prueba nueva `registro-tarjeta.spec.js`)

> Corrección al informe: **Indicadores ya construía sus barras** al entrar en pantalla (crecen una tras otra). Las fotos
> de página completa solo mostraban el final. Tampoco faltaba "¿Por qué este match?" en el detalle de la vacante: ya
> existía. Y los filtros de Vacantes en escritorio ya seguían al bajar (sticky).

### 18. El Inicio de la empresa es para la empresa
Debajo de su panel, la empresa veía "Encuentra tu vacante" y "Vacantes cerca de ti" (herramientas de quien busca trabajo).
Ahora ve:
- **Postulaciones nuevas**: las 4 más recientes, cada una con los pasos Enviada → Revisada → Respuesta (los mismos que ve
  la persona) y un enlace que abre esa postulación en Mi empresa.
- **Tus vacantes**: sus vacantes abiertas con cuántas personas se postularon a cada una.
La rueda "¿Cómo funciona?" sigue. (`panel-inicio.js` panelEmpresa, `app.css` sección 68)

### 19. Registro de empresa: "Así te verán las personas"
Lo mismo que el registro de persona: al escribir el nombre aparece en la tarjeta con su logo cuadrado (las iniciales llegan
con un pequeño giro) y "¿Qué hace tu empresa?" se ve como la leerán las personas. (`registro-empresa.js` tarjetaDeEmpresa,
`app.css` sección 67; pruebas en `registro-tarjeta.spec.js`)

### 20. Empresas: sin el bloque repetido
Con pocas empresas, "Publicaron vacantes hace poco" mostraba las mismas tarjetas que "Todas las empresas". Ahora solo
aparece cuando hay más empresas de las que caben ahí (más de 6). (`empresas.js`)

### 21. Conexiones: aceptar también es un match
Al aceptar una solicitud sale la chispa desde la tarjeta. Los errores dicen qué hacer. (`conexiones.js`)

### 22. Mensajes: cada mensaje nuevo llega desde su lado
El tuyo sale desde abajo a la derecha (donde escribes) y el de la otra persona entra por la izquierda. Solo los nuevos:
al abrir una conversación nada se mueve. (`mensajes.js`, `app.css` sección 69; prueba nueva `momentos.spec.js`)

### 23. "Cargando…" con la forma de lo que viene
Los 21 "Cargando experiencia…", "Cargando ofertas…" (con una ruedita) ahora son un **esqueleto de tres renglones** con el
brillo que pasa, el mismo de `SkillMatchUI.skeletons`. Cuando llegan los datos, cada módulo lo reemplaza como siempre
(no se tocó ningún JS). El texto sigue ahí para el lector de pantalla. (`app.css` sección 70)

### 24. Elegir cuenta: una escena en cada camino
"Únete a SkillMatch" era solo texto. Ahora cada tarjeta tiene arriba una escena pequeña, de la misma familia que la
ciudad de noche de la portada (mismas piezas isométricas y colores), **sin recuadro**:
- **Busco trabajo:** tu casa brota, su ventana se enciende y brotan tres cubos de luz (tus habilidades; el último,
  naranja), con "Tu perfil" en una pastilla de vidrio.
- **Soy empresa:** el edificio brota apagado, enciende sus pisos de abajo hacia arriba y llegan dos personas
  (cubos de luz) hasta la puerta, con "Tu vacante".
Se arman **una sola vez** cuando se ven y se quedan quietas en su cuadro final (no se repiten ni gastan nada después).
Con "reducir movimiento" ya aparecen armadas.
(`escenas.js`: recetas `camino-persona` y `camino-empresa` + opción `unaVez`; `seleccionar-registro.html`; `app.css`
sección 71; prueba nueva `elegir-cuenta.spec.js`. La escena de la portada no cambió.)

### 25. Login en escritorio: la isla de un solo tono
Sobre las dos columnas del login (clara y azul noche) la isla se veía mitad gris y mitad azul. Solo ahí (y solo con dos
columnas) su tinte sube al 86 % y se lee como una sola pieza azul marino. El resto del sitio queda igual. (`app.css` sección 72)

### 26. Mensajes sin conversación abierta: el mensaje que viaja
El estado vacío de Mensajes ("Selecciona una conversación") tenía un dibujo genérico (una lupa). Ahora es una escena
de la misma familia: tu casa y el edificio de la empresa unidos por un camino punteado; un **sobre de luz naranja salta
de tu puerta a la suya** y el edificio enciende sus ventanas (te leyeron). Una sola vez, sin recuadro, decorativa
(`aria-hidden`: el texto de abajo dice lo mismo). (`escenas.js` receta `camino-mensajes`, `mensajes.html`, `app.css` sección 73)

### 27. Mi perfil en el celular: la tarjeta de arriba más corta
A 375 px había 48 px de relleno a cada lado y los botones (Editar perfil, Hoja de vida en PDF, Más) iban uno debajo del
otro: la tarjeta ocupaba toda la primera pantalla. Con menos relleno van en dos filas y se ve el resumen sin bajar tanto.
(`app.css` sección 74)

### 28. Indicadores: sin el hueco de "Ciudades"
"Ciudades con más vacantes" (4 filas) se estiraba al alto de "Habilidades más pedidas" (10 filas) y quedaba con un hueco
grande. Ahora cada tarjeta mide lo que su contenido. Ojo: había un comentario tuyo para que "Ver detalle" quedara a la misma
altura en cada fila; en las otras filas sigue igual porque tienen el mismo número de filas, pero en esta última ya no.
Si prefieres el hueco, se quita la sección 75 de `app.css`.

### 29. Perfil público de empresa: la portada de su sector
Si la empresa no eligió portada (o quien mira es visitante, que no puede ver la que eligió), ahora sale la ilustración
de su sector que ya existía en la galería de Mi empresa (`assets/img/portadas/empresa-*.svg`): el hotel muestra el
atardecer con palmeras de Turismo, una agencia digital la de Tecnología, etc. Si eligió una, sigue mandando la suya.
(`empresas.js` portadaDelSector)

### 30. Salario sin repetirse
"$1.423.500 - $1.423.500" cuando el mínimo y el máximo son iguales ahora dice "$1.423.500", en Vacantes, la portada y el
perfil de empresa. (`oportunidades.js`, `search-handler.js`, `empresas.js`)

### 31. Limpieza y accesibilidad de cierre
- `index.js`: se quitó el bloque "Fase 2 — cifras de impacto" (42 líneas) que contaba las cifras de `.impact-stats`,
  sección que ya no existe: el código nunca corría.
- Vacantes en el celular: como los filtros (con su título h2) ahora van en una hoja cerrada, la página saltaba de h1 a h3.
  Se agregó un h2 "Resultados" solo para el lector de pantalla.
- "¿Olvidaste tu contraseña?" ahora responde al dedo en 45 px de alto (medía 21) sin moverse de su lugar. (`app.css` sección 76)
- `vidrio.spec.js`: la prueba de Empresas miraba la primera tarjeta de la página, que estaba en el bloque que ahora se oculta
  con pocas empresas (#20); ahora mira las visibles.
- Auditoría de accesibilidad completa repetida al final (138 vistas): el foco tapado de la lupa **ya no aparece**. Quedan
  avisos que ya existían (títulos de vacante de 25 px en el celular, pines del globo sin Tab) y "letra de tamaño 0" en el
  ícono de "Cerrar sesión" del celular, que es la misma técnica que ya usaba el buscador para dejar el texto solo al lector de pantalla.

### 32. Las fuentes viven en el proyecto (con tu permiso, en la mañana)
- Se descargaron de Google Fonts los dos archivos `.woff2` del juego **latino** (cubre todo el español):
  `assets/fonts/bricolage-grotesque-latin.woff2` (75 KB) e `instrument-sans-latin.woff2` (29 KB). Son fuentes variables:
  un archivo trae todos los grosores. Licencia SIL OFL 1.1, anotada en `assets/fonts/LEEME.md`.
- Las 16 páginas ya no piden nada a Google: en su lugar **precargan** los dos archivos. `app.css` sección 77 los declara.
- La CSP del backend ya permitía fuentes del propio sitio (`font-src 'self'`): **no se tocó el backend**.
- `sw.js`: las fuentes se sirven desde la copia guardada, como las imágenes (no cambian con el mismo nombre).
- **Medido** (Edge, misma máquina): el título aparece a los **~0,1–0,7 s** en lugar de ~2,75 s (login, Vacantes, Empresas).
  El "peso" de cada página sube ~115 KB en la tabla solo porque ahora se cuentan las fuentes; antes también se bajaban,
  pero de otro dominio.

### 33. Un problema de rendimiento que yo mismo había metido, encontrado y arreglado
Al medir la portada contra el respaldo de antes de la noche, **recalcular estilos al bajar costaba el doble** (~800 ms contra
~350 ms). La causa: 5 reglas nuevas con `:has()` (la tarjeta del registro, la isla del login y el dibujo de Mensajes). `:has()`
obliga al navegador a vigilar cambios en toda la página, aunque esas reglas no tengan nada que ver con la portada.
Se cambiaron por clases (`con-vista-previa` la pone el JS del registro; `pagina-dos-columnas` va en el `<body>` de login y
recuperar; el dibujo de Mensajes usa `+`). Medido después: **igual que antes de la noche** (~285 ms contra ~305 ms).
Lección para `app.css`: nada de `:has()` en reglas nuevas.

### 34. Elegir cuenta: "El recorrido" (elegido por Luis entre tres direcciones)
Se probaron tres direcciones en una página aparte con selector (skill `prototype`): **El recorrido**, **El tablero** y
**La región**. Luis eligió **El recorrido**. Reemplaza las escenas de #24, cada una contada con lo que dice su tarjeta:
- **Busco trabajo:** tu casa se enciende ("Tu perfil"); tres vacantes brotan más altas mientras más encajan (92, 74 y 51 %);
  tus habilidades saltan a la mejor y **cada una enciende un piso al llegar**; chispa y "Postulación enviada".
- **Soy empresa:** el edificio publica "Se busca: Recepcionista"; llegan tres personas a la puerta; una se descarta y a otra
  se la acepta (chispa y "Aceptada").
Pasaron por las skills `choreograph` (un protagonista, esperas que se acortan, causa y efecto en el mismo instante, ~3 s en
total) y `review-animations` (letreros sin rebote, salidas más cortas que las entradas). Medido: sin cuadros de más de 50 ms
mientras se arman y en reposo al terminar. La página real quedó idéntica al prototipo (0 píxeles distintos) y el prototipo
se borró. (`escenas.js`: recetas `camino-persona` y `camino-empresa`, efecto nuevo `e-etiqueta` y `data-salida`;
`seleccionar-registro.html`: descripciones para el lector de pantalla)

---

### 35. La barra estilo YouTube: cápsula de cristal abajo y las dos barras se esconden al bajar
Idea de Luis a partir de la barra de YouTube en el iPhone (Liquid Glass). Skills: apple-design (material), review-animations (movimiento).
- **Celular:** la barra de pestañas ya no es una franja blanca pegada al borde. Ahora es una cápsula que flota a 12 px de los lados y 10 px de abajo, por encima de la raya del iPhone. La pestaña activa va dentro de un cristal más claro que se desliza al tocar otra, con el icono en turquesa. Se conservan las palabras debajo de los iconos.
- **Más cristal en las dos barras** (pedido de Luis):
  - El tinte bajó del 64–72 % al 34 %. Lo que se oscurece ahora es lo que pasa por detrás (`brightness` en el `backdrop-filter`), con 10 px de desenfoque.
  - El filo de luz da toda la vuelta.
  - El buscador es un "pozo" un poco más oscuro.
  - Sobre la portada la isla sigue casi transparente, como antes.
- **Contraste medido con píxeles**, bajando toda la página en Vacantes, Empresas e Inicio, celular y PC, claro y oscuro: la palabra más baja queda en 5,3:1 (mínimo 4,5).
- **Esconder al bajar:** la isla se va hacia arriba y la cápsula hacia abajo. Al subir 8 px vuelven.
  - Siempre se ven arriba del todo y al final de la página.
  - No se esconden mientras usas algo de ellas: el teclado, la campana abierta o la apertura de la portada.
  - Movimiento: solo `translate`, 0,22 s al irse y 0,3 s al volver. Con "reducir movimiento" se desvanecen.
  - Medido: 0 cuadros de más de 50 ms al bajar y subir (el peor, 28 ms).
- **Dónde está:**
  - app.css, secciones 78 y 79. La regla del tinte de la sección 49 ahora lleva `--isla-brillo: 1`, y el vidrio de la apertura usa 10 px.
  - ui.js: `barrasQueSeEsconden()` y la clase `.con-destino` en la barra de abajo.

### 36. Cristal que refracta y la gota de cristal con resortes
Pedido de Luis: que la barra distorsione lo de atrás como el vidrio de Apple, que la gota sea más cristalina y que se mueva más suave. Técnica de kube.io ("Liquid Glass in the Browser: Refraction with CSS and SVG"), LogRocket y ekino.
- **Refracción:**
  - ui.js (`cristalQueRefracta`) dibuja un mapa de desplazamiento del tamaño de cada barra. Se calcula como un cristal de verdad: borde curvo tipo squircle y ley de Snell con vidrio de índice 1,5.
  - Ese mapa se usa con `feDisplacementMap` dentro de `backdrop-filter` (app.css, sección 80): lo de atrás se dobla en los bordes y el centro queda limpio.
  - Solo en Chrome y Edge (navegadores Chromium). En Safari y Firefox sigue el vidrio anterior. Tampoco se activa con "reducir transparencia", con colores forzados ni en equipos con menos de 4 núcleos o 4 GB.
- **Gota:**
  - Se mueve con dos resortes, uno por borde. El de adelante es más rápido y un poco elástico, así se estira hacia donde va y se recoge al llegar.
  - Se puede interrumpir: sigue con la velocidad que lleva.
  - Se recorta con `clip-path`, así sus puntas no se deforman al estirarse.
  - El cuerpo es casi transparente, con un filo de luz de 1 px que da toda la vuelta (blanco arriba, turquesa abajo) y un brillo arriba.
- **Verificado (con permiso de Luis), y lo que se arregló al verificar:**
  1. **La refracción no se veía.** Diferencia máxima con y sin ella: 13 de 255.
     - Primera causa: el filtro nacía sin mapa y se lo poníamos después; Chromium no se entera de ese cambio. Ahora cada filtro nace completo, con otro nombre cada vez.
     - Segunda causa, encontrada con rayas detrás: el desenfoque borraba todo antes de doblarlo. Ahora el filtro esmerila solo el centro (7 px, donde van las palabras) y deja el borde curvo nítido y doblado, como Apple.
     - El borde curvo mide un cuarto del alto. Con un tercio, lo nítido llegaba hasta las palabras.
  2. **La gota con `clip-path` dejaba cuadros de 60 a 90 ms.** Ahora son tres piezas (dos puntas que se deslizan y un centro que se estira) y solo se anima `transform`.
     - Las piezas van al píxel exacto: montadas, se veía una raya en cada unión.
     - En reposo tienen opacidad 0,001 y no 0. Con 0, el primer cuadro al pasar el mouse tardaba unos 70 ms.
  3. **Doble forma:** la opción bajo el mouse ya no enciende su propio fondo mientras pasa la gota.
- **Medido al final:**
  - Gota: 0 cuadros de más de 50 ms en tres corridas (el peor, 21 a 35 ms).
  - Al bajar con la refracción: 0 cuadros de más de 50 ms (el peor, 28 ms en PC y 42 ms en celular).
  - Contraste con píxeles: la palabra más baja queda en 5,27:1.

### 37. El lente de las barras (video «Lente» de moxen.studio)
Luis pasó 5 videos y pidió la barra "lo más similar posible" al de «Lente». Se vieron cuadro por cuadro, con el código que muestra el video.
- **El lente:** reemplaza la gota y la línea turquesa (PC) y la pastilla de la pestaña activa (celular).
  - Es una cápsula de cristal **sobre** la opción actual. Agranda (x1,1) y refracta el ícono y la palabra que tiene debajo, con un arcoiris finito en el borde: tres pasadas de `feDisplacementMap`, una por color, como en el código del video.
  - Lleva un filo con degradado cónico, un brillo arriba y sombras interiores.
- **Movimiento:**
  - Resortes para el centro, el ancho y el agarre. Se estira con la velocidad: `sx = 1 + 0,22·tanh(v)`, `sy = 1 − 0,12·tanh(v)`.
  - Viaja con el clic, **no** al pasar el mouse (como en el video). Se puede **agarrar y arrastrar** con mouse o dedo: crece 7 %, ilumina la opción de abajo y al soltarlo lleva a esa página. Pasado el borde ofrece resistencia, como una goma.
- **Código:**
  - ui.js: un módulo `Cristal` con los mapas y filtros compartidos (barras y lente), `crearLente()` (el motor), y `lineaDelMenu()` y `pastillaDeLaBarra()` reescritas.
  - app.css: sección 81.
- **Ajustes medidos:**
  - La primera refracción torcía las palabras. Ahora el borde curvo mide 28 % del alto, con la mitad de la fuerza; el arcoiris va 1 / 0,92 / 0,84; y el lente es 6 px más alto que la opción.
  - El primer viaje de cada sesión del navegador tardaba unos 200 ms en dibujarse (la tarjeta de video preparando por primera vez; confirmado con una traza). Se arregló con una copia invisible del lente que se dibuja al cargar: 0 cuadros lentos después.
  - El lente vigila el tamaño de cada opción, no solo el de la barra.
  - El centro de las barras se esmerila con 9 px (antes 7): en el celular se leía el texto de la página detrás.
- **Medido:**
  - Clics y arrastres: 0 cuadros de más de 50 ms (el peor, 21 a 28 ms).
  - Al bajar la página: 0 cuadros de más de 50 ms.
  - Contraste bajo el texto: la palabra activa bajo el lente entre 10,5 y 13:1; la más baja de todas, 5,76:1.
- **Pruebas actualizadas:**
  - `menu.spec` y `cambio-de-pagina.spec`: el lente reemplaza la pastilla y la línea, el tinte pasa de 64 % a 34 %, y la isla se esconde al bajar.
  - Prueba nueva: arrastrar el lente.

### 38. «Vacante»: tu perfil frente a las vacantes (video de moxen.studio)
- **Panel "Tu perfil frente a estas vacantes"**, arriba de la lista de Vacantes: tus habilidades y en cuántas de las vacantes que ves aparece cada una.
- **Resaltado en los dos lados:**
  - Pasar el mouse o tocar una habilidad la subraya en las ofertas que la piden (etiqueta y palabras del título o la descripción) y apaga un poco las demás.
  - Pasar por una oferta enciende en el panel tus habilidades que pide.
- **"¿Y si aprendes…?"**: las habilidades más pedidas que te faltan se pueden sumar de prueba.
  - Recalculan los porcentajes y reordenan la lista.
  - No se guardan, y el detalle de cada vacante sigue usando solo tus habilidades reales.
- **La lista se reordena con animación (FLIP).** Al cambiar el orden o una habilidad de prueba se actualizan y se mueven las tarjetas que ya están, sin construirlas de nuevo. Solo se mueven las que cambian de lugar y solo se reescribe lo que cambió.
- **Rendimiento medido:**
  - Al principio, un cuadro de ~1 s (era la captura de pantalla de la medición) y después de 70 a 125 ms al reconstruir la lista.
  - El último culpable era el anillo, que contaba reescribiendo `--pct` en cada cuadro. Ahora cambia de una vez con un pulso corto.
  - Resultado: 0 cuadros de más de 50 ms en PC y celular (el peor, 21 a 42 ms).
- **Contraste medido con píxeles** en los dos temas: el texto más bajo queda en 4,92:1.
  - En oscuro, el naranja de las habilidades de prueba pasó a `#FFC896` (con el normal quedaba en 3,4 a 4,2:1).
  - En oscuro, el panel tiene fondo propio: dependía de las manchas del fondo (4,4 a 6,2:1).
- **Pruebas:** en `vacantes.spec` se actualizaron 3 (el resumen se volvió panel) y hay 6 nuevas (panel, resaltar, probar, no reconstruir). 60 pasan.
- **Código:** oportunidades.js (bloque «Vacante», `actualizarEnSitio`, `pintarConAnimacion`) y app.css (sección 82).

### 39. "Reducir transparencia" manda sobre la refracción
Lo encontraron las pruebas generales.
- **El problema:** si alguien activaba "reducir transparencia" con la página abierta, la regla de la refracción (secciones 80 y 81) le ganaba a la sólida y la barra seguía translúcida.
- **El arreglo** (app.css, sección 83): una regla al final que deja la isla, la cápsula y el lente sólidos al instante, sin el fundido del tinte. Se conserva el esconderse al bajar.
- **Pruebas:** `vidrio.spec` y `perfil.spec` ahora aceptan que el desenfoque de la barra vaya dentro del filtro SVG (`url(#…)`) y no solo como `blur()`.

### 40. «Titular»: el menú "Tu cuenta" (video de moxen.studio)
- **En la barra:** con sesión, "Tema", "Mi perfil" y "Cerrar sesión" se juntan en un botón **"Tu cuenta"**. Lleva tu inicial dentro de un anillo naranja que se llena con lo completo que está tu perfil. La campana de avisos se queda donde estaba.
  - Los enlaces de antes quedan en la página, escondidos, porque otros guiones los buscan.
  - Los visitantes ven la barra de siempre.
- **El menú**, de vidrio ahumado en los dos temas, vive en `<body>` para que su vidrio desenfoque la página de verdad. Trae:
  - Tu nombre, el tipo de cuenta y "Perfil al N %". Usa los mismos 5 puntos de Mi perfil; profile.js deja anotado el número de tu propio perfil.
  - "Tus postulaciones: te respondieron X de Y", con una barra que se llena (solo `transform`).
  - Opciones. Persona: Mi perfil, Hoja de vida, Mis postulaciones, Vacantes guardadas. Empresa: Mi empresa, Candidatos, Publicar una vacante. Ambas: Cambiar contraseña.
  - Cerrar sesión, en naranja.
  - Tema **Claro / Oscuro / Auto**. "Auto" es nuevo: no guarda nada y sigue al sistema, también si cambia con la página abierta. Se maneja con las flechas, como un grupo de radios.
- **Comportamiento:**
  - Se abre desde el botón (crece desde su esquina, 180 ms) y se cierra más rápido (120 ms).
  - Escape lo cierra y devuelve el foco al botón; un clic afuera o salir con Tab también lo cierran.
  - Abrirlo cierra la campana.
  - Mientras está abierto, la isla no se esconde al bajar.
  - En el celular ocupa todo el ancho.
- **Contraste medido con píxeles:** el texto más bajo queda en 5,38:1. "Cuenta personal · Perfil al…" pasó a un gris más claro, porque estaba en 4,45:1.
- **Pruebas:**
  - `navegacion.spec`: lo que ve cada quien ahora se revisa dentro del menú, más dos pruebas nuevas (el menú completo con teclado y tema, y cerrar sesión desde él).
  - `menu.spec`: el desenfoque de la isla puede ir dentro del filtro SVG.
- **Foto de perfil** (pedido de Luis): si la tienes, se ve dentro del anillo, en el botón y en el menú; en una empresa, su logo.
  - Sin foto, o si la imagen no carga, queda la inicial.
  - Solo se aceptan imágenes de verdad (`data:image` o `https`, la misma regla de los logos).
  - Al cambiarla en Mi perfil, profile.js avisa con el evento `skillmatch:foto` y el botón la toma en el momento.
  - Tiene su prueba en `navegacion.spec`.
- **Código:** ui.js (`menuDeCuenta`), profile.js (anota el porcentaje y avisa de la foto) y app.css (sección 84).

### 41. «Pastilla»: botones que responden (video de moxen.studio)
- **Enviar postulación:**
  - Mientras se envía, el botón muestra un círculo que gira y dice "Enviando…", con el ancho fijo.
  - Al confirmarse pasa a **"✓ Enviada"** por 550 ms; luego se cierra la ventana y sale la chispa en la tarjeta, como antes. Antes se cerraba de golpe, sin confirmar.
- **Guardar:** el botón recién puesto en "Guardada" da un salto corto y suelta **chispitas** (`SkillMatchUI.chispitas`, la versión chica de la chispa del match). Al quitarla no hay celebración.
  - De paso se arregló que el corazón de **todas** las guardadas latía cada vez que la lista se volvía a pintar: ahora solo late el de la recién guardada.
- **Enviar mensaje:** el avioncito del botón sale volando hacia arriba a la derecha y vuelve a entrar.
- **Gelatina:** Postularme, Guardar, Enviar y los botones principales de las ventanas se hunden al presionar (80 ms) y rebotan al soltar (400 ms).
- **Animación:** solo `transform` y `opacity`. Con "reducir movimiento" no hay saltos, rebotes ni vuelos, y el círculo de "Enviando…" gira más lento.
- **Pruebas:** dos nuevas en `vacantes.spec` (guardar y enviar postulación). Pasan con las 198 relacionadas.
- **Código:** ui.js (`UI.chispitas`), oportunidades.js, mensajes.js y app.css (sección 85).

### 42. «Monograma»: cada nombre con su avatar (video de moxen.studio)
- **El problema:** los cuadritos con inicial eran todos del mismo turquesa, así que "Hotel Puerta del Mar" y cualquier otro hotel se veían iguales.
- **Ahora** cada nombre tiene su monograma, sacado de una huella del nombre (FNV-1a): siempre el mismo para el mismo nombre, en todas las páginas.
  - **Colores:** uno de 7 pares oscuros (turquesa hondo, azul de mar, naranja quemado, morado, verde manglar, buganvilla y pizarra), con un giro.
  - **Patrón:** luz, anillos, rayas o puntos.
  - **Iniciales:** dos donde cabe ("HP"), sin contar palabras como "de" o "S.A.S."; en los avatares chicos, una.
- **Dónde:**
  - Tarjetas de Vacantes, Empresas (directorio y perfil), Conexiones, Mensajes (lista y cabecera del chat), postulaciones de Mi perfil, candidatos de Mi empresa, el carrusel de la portada y el botón "Tu cuenta" cuando no hay foto.
  - Cada página solo pone `data-monograma="<nombre>"`; ui.js (`SkillMatchUI.monograma`) hace el resto.
- **El logo o la foto siguen mandando:** el logo grande de la página de una empresa ahora avisa cuando carga (`.con-logo`), para no dejar el monograma detrás.
- **Contraste medido con píxeles** en los dos temas: la letra blanca queda en 5,07:1 o más. El brillo del patrón "luz" se bajó: con el de antes quedaba en 4,2:1.
- **Pruebas:** `monograma.spec.js`, nuevo. Revisa el mismo monograma entre páginas, la letra blanca y que el logo reemplace al monograma.
- **De paso, un error pequeño que no era de hoy:** los anillos de compatibilidad se llenan cuadro por cuadro. Si los cuadros se frenaban (pestaña oculta o equipo ocupado), el anillo quedaba a medio llenar; en las pruebas se vio 42,9 % en vez de 50 %, y por eso esa prueba fallaba a veces. Ahora, a los 1,5 s, el anillo queda siempre en su valor final (ui.js, `anillos`).
- **Código:** ui.js, conexiones.js, empresas.js, mensajes.js, oportunidades.js, perfil-empresa.js, profile.js, search-handler.js y app.css (sección 86).

### 43. La barra toma el color del fondo, el lente sin torcer palabras y la lupa del celular a la derecha
Pedido de Luis, con capturas.
- **Vidrio que se adapta** (app.css, sección 87; ui.js, `vidrioSegunFondo`):
  - **Tema claro:** vidrio **claro de fábrica**, casi transparente, que deja pasar el color de atrás; letras azul marino, logo normal y "Unirse ahora" en turquesa con letra blanca.
  - **Tema oscuro:** el vidrio oscuro de siempre.
  - **En tema claro, sobre una zona oscura**, la barra recibe `.vidrio-oscuro`. Son zonas oscuras la ciudad de noche, la portada de un perfil o de una empresa, el globo, el pie y cualquier fondo sólido oscuro, como la franja azul del inicio con sesión, que detectó sola. Se mira con `elementsFromPoint` en tres puntos de la barra, una vez por cuadro al bajar.
  - **Sin parpadeo:** el vidrio claro lo decide el CSS con el tema que el `<head>` fija antes de pintar. El logo también: con `content: url()` en la imagen. La portada trae `.vidrio-oscuro` escrito en su HTML. Antes, cada página arrancaba oscura y medio segundo después se aclaraba.
  - **En vidrio claro el lente va detrás de la palabra**, como una cápsula blanca esmerilada (lo que hace Apple en modo claro). Encima, el navegador lo pintaba gris y deslavaba la palabra.
  - **"Reducir transparencia":** sólido, del color de cada modo.
- **El lente ya no tuerce las palabras:**
  - Íconos de la isla de 20 a 18 px y de la barra de abajo de 24 a 22 px.
  - El doblez solo en un aro fino (16 % del alto, antes 28 %).
  - Por dentro, una lupa suave (x1,06, antes x1,1).
- **Celular (opción A):** la lupa va a la derecha, junto a "Tu cuenta", como dos botones redondos iguales de 44 px; el logo va a la izquierda.
- **Contraste medido con píxeles:** en vidrio claro, las palabras de 6,7 a 11,7:1.
  - El medidor tenía un error: con letra oscura buscaba el fondo más claro como peor caso. Se corrigió para buscar el más oscuro.
- **Pruebas:** `menu.spec` ahora revisa el vidrio claro en tema claro, el oscuro en tema oscuro y sobre la portada, y el logo de cada caso.

### 44. La barra y la burbuja como las de Apple (2026-11-14, sin commit)

Pedido de Luis con dos fotos de la barra del App Store (iOS 26): la burbuja «todavía no me convence», más transparente.

- **Qué hace Apple** (fotos + reseña de MacStories + recreaciones como Liquidum):
  - Quieta, la burbuja es un tinte casi transparente; la pestaña actual se reconoce por el **color** del icono y la palabra.
  - Al tocarla o cuando viaja, **se levanta**: crece y se vuelve una gota de cristal; al llegar se asienta con un rebote.
- **Qué cambió aquí** (`app.css` sección 88, `ui.js` `crearLente`):
  - El lente tiene dos capas: `.lente-reposo` (el tinte) y `.lente-cristal` (la gota). `ui.js` pone `.levantado` mientras
    se toca o viaja; el CSS solo cruza las dos con `opacity` (levantarse .12 s, asentarse .32 s).
  - Levantada crece hasta x1,22 (en la mano) o x1,165 (viajando), con un resorte con rebote corto.
  - El icono bajo la burbuja levantada crece x1,14 (la "lupa").
  - La opción donde está (o a la que va) la burbuja lleva `.con-lente`: icono **y** palabra en turquesa
    (`#5FD0DC` en vidrio oscuro, `#075A62` en vidrio claro). El color viaja con la burbuja.
  - La barra deja pasar más: tinte oscuro del 34 al 26 %, oscurecido de .42 a .5, velo claro del 50 al 40 %.
  - La barra de abajo baja de 68 a 62 px: la burbuja queda más ancha que alta (70 x 52), como la de Apple.
- **Se quitó el filtro que refractaba dentro del lente.** Motivo, visto con zoom: un `backdrop-filter` dentro de otra
  pieza con `backdrop-filter` no dobla las letras, les pone encima una copia torcida. Eso era el halo de colores en
  reposo y las manchas al cruzar el borde. Ahora el lente va siempre detrás del icono y la palabra, que quedan nítidos.
  La refracción de verdad sigue en el borde de las dos barras (sección 80).
- **Medido:**
  - Cuadros: 0 de más de 50 ms en clics y arrastres (PC peor 28–42 ms; celular peor 14–21 ms).
    - Al quitar el filtro también se fue su "precalentado" y el primer viaje tuvo un cuadro de ~130 ms. Se arregló con
      una copia invisible de cada tamaño y dejando la gota dibujada en su propia capa (`will-change: opacity`).
  - Contraste con píxeles, bajando toda la página: la palabra activa 5,06–5,59:1 en vidrio claro (antes de oscurecer el
    turquesa a `#075A62`; el mínimo era 4,64) y 8,5–9,8:1 en oscuro; las demás, de 7,75 a 15:1.
- **Pruebas:** `menu.spec` y `cambio-de-pagina.spec` revisan el tinte en reposo, que no lleva filtro, que se levanta al
  agarrarla y que se asienta al llegar. Corridas con navegación, vidrio, accesibilidad y humo: 141 en verde.
- **Límite que quedó aquí (resuelto en el #45):** la burbuja ya no agrandaba ni doblaba lo de atrás como una lupa real.

### 45. El movimiento de la burbuja, medido en un video (2026-11-14, sin commit)

Luis mandó un video de 15 s de la barra de WhatsApp en iOS 26 y pidió aplicar ese movimiento.

- **Cómo se analizó:** el video es HEVC (iPhone) y el equipo no tiene `ffmpeg`. Se abrió en el navegador de la app y se
  sacaron sus 906 cuadros (60 por segundo) con un `<canvas>`. Luego se midió cada fase en hojas de cuadros.
- **Lo que hace la burbuja en el video:**
  - **Al presionar (0,13 s):** toda la barra crece un 3,5 %. La burbuja pasa de tinte oscuro a un lente más claro que
    la barra, que crece más a lo alto (×1,3, se sale por arriba y por abajo) que a lo ancho (×1,14). Lo de debajo se ve
    agrandado.
  - **Al arrastrar:** sigue al dedo 1 a 1 y su borde dobla los iconos y palabras vecinos, con un arcoíris fino.
  - **Al soltar (0,17 s):** se encoge y se oscurece hasta volver a ser el tinte, con un rebote mínimo.
  - **Al tocar otra pestaña (0,3 s en total):** se vuelve lente casi al instante, viaja en ~0,1 s estirada, pasa un
    poco de largo y se asienta.
- **Qué cambió aquí** (`ui.js` `crearLente` y `Cristal`; `app.css` sección 89):
  - **La lupa (`.lente-lupa`):** el lente levantado ahora es de verdad. Agranda ×1,14 y dobla lo que tiene debajo con un
    filtro SVG, con arcoíris en el borde. Va **fuera de la barra**, en `<body>` y encima de ella: así su
    `backdrop-filter` ve la barra ya pintada y dobla sus letras de verdad (dentro de la barra les ponía una copia
    torcida encima, ver #44). Solo existe mientras la burbuja está levantada; quieta sigue el tinte con letras nítidas.
  - **Tamaño levantada:** ×1,30 de alto y ×1,14 de ancho (antes ×1,22 parejo).
  - **Resortes con los tiempos del video:** viaje `k=520, z=.75`; levantarse y asentarse `k=600, z=.7`.
  - **Fundidos:** levantarse .1 s, asentarse .2 s.
  - **La barra crece 3,5 % al agarrar la burbuja**, solo donde la barra no refracta (Safari y Firefox, o sea el iPhone).
    En Chromium, al agrandarla el filtro del borde dejaba de calzar y salía una raya curva en cada punta.
  - **Sin el filtro (Safari, Firefox):** se levanta la gota sin doblez del #44, y el icono y la palabra de debajo crecen.
- **Medido:**
  - Cuadros: 0 de más de 50 ms en clics y arrastres (PC peor 21–42 ms; celular peor 14–21 ms).
  - Cada tamaño de lupa se dibuja antes en una copia invisible: sin eso, el primer viaje tiene un cuadro lento.
- **Pruebas:** `cambio-de-pagina.spec` revisa la lupa en PC y en celular (está en `<body>`, lleva el filtro, va justo
  sobre el lente, crece más a lo alto y se va al soltar) y el camino sin filtro (gota, barra ×1,035, icono ×1,18).
  Corridas con menú, navegación, vidrio, accesibilidad y humo: 143 en verde.
- **Límites conocidos:**
  - En iPhone (Safari) no hay doblez: es un límite del navegador. Se ve la gota y la barra que crece.
  - La página cambia cuando la burbuja llega (0,38 s), no al instante como en una app: aquí cada pestaña es otra página.
  - Falta probarlo en un celular real.

### 46. Tres errores que encontró Luis al probar (2026-11-15, sin commit)

Los tres se reprodujeron con un script antes de tocarlos, y cada uno quedó con su prueba automática.

1. **La barra quedaba clara sobre la portada oscura al pasar a tema claro** (`ui.js`, `vidrioSegunFondo`).
   - **Causa:** el tema cambia con un efecto (View Transition). Mientras dura, `document.elementsFromPoint` solo
     devuelve la "foto" de la transición y no la página. La revisión caía justo ahí, no veía la ciudad y dejaba el
     vidrio claro. Se reprodujo 12 de 12 veces.
   - **Arreglo:** las zonas oscuras (portada, pie, portadas de perfil, mapa) ahora se miran por sus medidas, que no
     dependen de eso. Además se revisa en el mismo instante en que cambia el tema (la "foto" nueva ya sale bien) y
     otra vez al terminar el efecto.
   - **Prueba:** `menu.spec`, «en la portada, al pasar a tema claro la barra sigue de vidrio oscuro sobre la ciudad».
2. **Al agrandar el mapa, el anillo del alcance se salía del planeta** (`mapa-cerca.js`).
   - **Causa:** el anillo se dibuja en un SVG que deja ver lo que se sale. Con 100 km, un clic en «+» lo llevaba de
     271 a 503 px sobre un planeta de 364 px, encima del título, la leyenda y los botones.
   - **Arreglo:** el anillo va recortado al borde del planeta (`clipPath` `#cmDisco`), en un grupo aparte para que el
     recorte no crezca con la animación de entrada. Su etiqueta de km solo se pone en un punto que caiga dentro.
   - **Prueba:** `cerca.spec`, «al agrandar el mapa, el anillo de tu alcance no se sale del planeta».
3. **En la escena de la portada se montaban dos frases** (la naranja sobre la blanca) (`escenas.js`).
   - **Causa:** el navegador descarta por su cuenta una animación terminada cuando otra posterior manda sobre lo mismo.
     Al salir una pieza, su animación de entrada quedaba descartada (18 de 127). En la primera vuelta no se nota; desde
     la segunda, esas piezas ya no esperaban su momento: dos frases a la vez y los puntos del edificio antes de tiempo.
   - **Arreglo:** `persist()` en todas las animaciones de la escena: ninguna se descarta.
   - **Prueba:** `escena-inicio.spec`, «al repetirse la historia, cada frase vuelve a esperar su momento». Se comprobó
     que falla si se quita el arreglo.

Corridas con mapa, escena, menú, cambio de página, navegación, vidrio, accesibilidad, humo, inicio y elegir cuenta:
198 en verde.

### 47. Los dos caminos son diplomas (2026-11-15, sin commit)

Pedido de Luis: las tarjetas "Si buscas trabajo" y "Si eres empresa" del cierre de la portada, como diplomas de frente,
que al bajar se desenrollen como un papel enrollado, con la firma escrita a pluma y el sello de SkillMatch en una esquina.
Skills usadas: `frontend-design` (el diseño), `animate` (la animación) y `review-animations` (la revisión).

- **El diseño** (`app.css` sección 90; `index.js` arma las piezas en `DIPLOMAS`):
  - Papel blanco de algodón frío, más oscuro donde se curva hacia los rollos, con doble filete (azul marino y turquesa).
  - Rollos de papel arriba y abajo, con la espiral en las puntas (como la referencia que mandó Luis, pero de frente).
  - La firma: "SkillMatch" con los trazos de la fuente de un solo trazo EMS Allure (licencia libre OFL; anotado en
    `assets/fonts/LEEME.md`), con punta de pluma ancha (5 copias del trazo en diagonal) y un rasgo debajo. Sobre su
    línea dice "Cartagena de Indias".
  - El sello: roseta naranja con el centro azul marino, "SKILLMATCH · CARTAGENA" alrededor, las dos personas del logo y
    dos cintas, montado sobre la esquina de abajo a la derecha.
  - El texto y los botones no cambiaron (mismos enlaces). "Publicar mis vacantes" pasó a contorno azul marino.
  - Se quitó la chispa naranja que antes se encendía entre las dos tarjetas: el sello cumple ese papel.
- **La animación** (una sola vez, cuando el diploma ya se ve casi a la mitad; en el computador el segundo va 170 ms después):
  1. Aparece enrollado (0,3 s).
  2. Se desenrolla hacia abajo en 1,05 s con la curva del cajón de iOS: el rollo de abajo baja y el papel se descubre
     detrás. El texto no se mueve: una ventana baja mientras su contenido sube lo mismo (solo `transform`).
  3. La firma se escribe sola en 1,5 s, trazo por trazo y a velocidad pareja de pluma.
  4. El sello se estampa: baja girando, golpea (se aplasta un poco), sale una onda y las cintas se acomodan.
  - Con "reducir movimiento" ya está abierto, firmado y sellado, sin animación.
- **Medido:**
  - Contraste con píxeles sobre el papel: título 13,4:1, texto 7,3:1, ítems 11,1:1, "Cartagena de Indias" 5,8:1, iconos 4,7 a 5,5:1.
  - Cuadros: el primer cuadro del desenrollado tardaba 62 ms (dibujar el papel por primera vez en la tarjeta de video; sin
    código de por medio). Arreglo: mientras espera, el diploma ya está dibujado (opacidad .001) y cada pieza tiene su capa;
    al terminar se le quitan. Comparado contra la versión anterior en otro puerto: 0 cuadros de más de 50 ms (3 de 3).
- **Pruebas:** `diplomas.spec.js` (nueva): las piezas y los enlaces; que esperan sin verse y se abren al llegar con el
  texto quieto; y que con "reducir movimiento" ya están abiertos.

### 48. Los diplomas, con estilo antiguo (2026-11-15, sin commit)

Pedido de Luis: "dale un estilo al diploma como más antiguo". Solo cambió el aspecto (app.css sección 90 y el sello en
index.js); la animación es la misma del #47.

- **Papel:** pergamino marfil envejecido, con grano (un ruido SVG pequeño que se repite), manchas de humedad y los
  bordes tostados. Los rollos también son de pergamino.
- **Letra:** títulos y descripción en **IM Fell English**, una letra de imprenta del siglo XVII (libre, OFL; guardada en
  `assets/fonts`, anotada en el LEEME). La descripción va en cursiva. Las listas siguen en la letra del sitio, para leerse fácil.
- **Tinta:** sepia en el texto y los iconos. La firma, en tinta ferrogálica (casi negra, tirando a café).
- **Marco:** filete doble sepia y adornos de pluma en las cuatro esquinas.
- **Sello:** de **lacre** naranja (la chispa de la marca), de borde irregular con dos chorreados, con "SKILLMATCH · CARTAGENA"
  y las dos personas del logo en relieve. Va sobre dos cintas de seda azul marino.
- **Botones:** "Crear mi perfil" sigue naranja; "Publicar mis vacantes" pasa a contorno sepia.
- **Medido:**
  - Contraste con píxeles en el peor punto del papel: título 8,3:1, descripción 6,4:1, ítems 8,3:1, "Cartagena de Indias"
    5,6:1, botones 6,1 y 9,2:1, iconos 4,1 a 4,7:1.
  - La animación, medida contra la versión anterior: 0 cuadros de más de 50 ms (3 de 3).
- **Pruebas:** diplomas, inicio, humo, accesibilidad y escena: 92 en verde.

### 49. Los diplomas, en papel blanco y más separados (2026-11-15, sin commit)

Pedido de Luis: "que sean mejor de color blanco y sepáralos un poco".

- El papel y los rollos pasaron de pergamino marfil a **blanco de algodón**, con grano fino y los bordes apenas gastados.
  Lo demás del estilo antiguo sigue: IM Fell English, tinta sepia, adornos en las esquinas y el sello de lacre.
- Entre los dos diplomas hay **56 px** (antes 24); el cierre se ensanchó de 980 a 1040 px para que no se angosten. En el
  celular van uno debajo del otro con 48 px.
- Contraste (con píxeles, peor punto): título 12,8:1, descripción 9,9:1, ítems 11,8:1, "Cartagena de Indias" 8,4:1,
  iconos 5,8 a 6,7:1. Animación: 0 cuadros de más de 50 ms. Pruebas: 74 en verde.

### 50. Los diplomas pasan a contratos actuales (2026-11-15, sin commit)

Pedido de Luis: "mejor que sean como un contrato actual; la firma sí déjala, pero lo demás más actual, más profesional".

- **La hoja:** blanca, con la franja de la marca arriba (azul marino a turquesa), esquinas apenas redondeadas y una
  sombra real sobre la franja oscura. Sin rollos, sin adornos ni pergamino.
- **La letra:** la del sitio (Bricolage Grotesque y Instrument Sans). Se borró IM Fell English (archivos y nota del LEEME):
  ya no se usaba.
- **Los puntos, como cláusulas:** separados por rayas finas, y una raya bajo el título.
- **La firma:** se quedó la de pluma, ahora en tinta azul de firmar. Debajo dice "SkillMatch, Cartagena de Indias".
- **El sello:** de caucho en tinta turquesa, con doble aro, "SKILLMATCH · CARTAGENA DE INDIAS" alrededor y las dos personas
  del logo. La tinta no queda pareja (le faltan puntitos y rayitas, como un sello de verdad) y se mezcla con el papel.
- **La animación:** la hoja sale de arriba a abajo como de la impresora (0,9 s), se firma (1,4 s) y se estampa el sello.
- Los colores de la hoja son fijos (no los del tema): la hoja es blanca también en tema oscuro. Sin eso, el texto salía
  casi blanco sobre blanco en tema oscuro.
- **Medido:**
  - Contraste con píxeles: título 16,4:1, descripción 7,1:1, cláusulas 10,8:1, pie de firma 7,1:1, iconos 6 a 6,7:1.
  - Cuadros: la primera versión del sello usaba un filtro de ruido para la tinta y el primer cuadro tardaba ~90 ms. Con
    los huecos dibujados como figuras fijas: 0 cuadros de más de 50 ms (3 de 3).
- **Pruebas:** `diplomas.spec.js` actualizada (sin rollos); con inicio, humo y accesibilidad, 74 en verde.

### 51. Los contratos, con sombra y otra vez desenrollándose (2026-11-15, sin commit)

Pedido de Luis: "colócales como una sombra a los contratos y que también tengan la animación esa que se desenrollan".

- **La sombra:** mucho más honda (sobre la franja azul oscuro la de antes casi no se veía): una grande y suave, una de
  contacto y dos sombras inclinadas bajo las esquinas de abajo, como una hoja con las puntas apenas levantadas.
- **El desenrollado:** el contrato aparece enrollado arriba; un rollo de papel blanco baja (y se adelgaza) mientras la hoja
  se descubre detrás. Al llegar abajo, el rollo se aplana y desaparece: queda el contrato liso. Luego se firma y se sella.
  Con "reducir movimiento" no hay rollo: ya está firmado y sellado.
- **Medido:** el rollo trajo un cuadro de ~60 ms al empezar. La causa: las espirales de sus puntas, hechas con un degradado
  repetido (con un dibujo SVG, ~53 ms). Hechas con bordes interiores: el peor cuadro, 49 ms (ninguno de más de 50, 3 de 3).
- **Pruebas:** `diplomas.spec.js` revisa que haya un rollo y que al terminar no se vea; con inicio, humo y accesibilidad,
  74 en verde.

### 52. Fotos de perfil, el menú "Tu cuenta" y una revisión de fluidez (2026-11-15, sin commit)

Pedido de Luis: revisar a fondo trabas y fluidez; que las fotos de perfil salgan en Mensajes, Conexiones, etc.; una
animación suave para el menú del perfil; y que el cambio de tema en el celular sea más fluido. Todo se midió en un
"celular" simulado (390 px y el procesador 4 veces más lento, como un teléfono de gama media).

- **Fotos de perfil** (`ui.js` `pintarLogos`/`fotoDeCuenta`, `mensajes.js`, `conexiones.js`): si la persona tiene foto, se ve
  su foto (no su inicial) en la lista de Mensajes, la cabecera del chat, "Nuevo mensaje" y las tarjetas de Conexiones
  (conexiones, solicitudes y sugerencias). Se trae una vez por persona y queda guardada en la sesión; si la página ya
  la tiene en sus datos (sugerencias), no se pide nada. Al cambiar de conversación no se cuela la foto de otra persona.
  Prueba nueva: `fotos-de-perfil.spec.js`.
- **El menú "Tu cuenta"** (`ui.js` `menuDeCuenta`): nace del botón de tu foto (crece desde ahí con la curva de los
  paneles de iOS, 300 ms) y lo de adentro llega en cuatro tandas cortas (30 ms entre una y otra). Cierra más rápido
  (140 ms) hacia el botón. Si se abre a mitad del cierre, sigue desde donde iba. Con "reducir movimiento", solo un
  fundido. 0 cuadros de más de 50 ms abriendo y cerrando.
- **Abrir el menú era lento por un `:has()`**: reglas como `body:has(> .hero:not([hidden]))` hacían que, al mostrar
  cualquier cosa que cuelga de `body` (el menú), el navegador recalculara los estilos de toda la página. Abrir el menú
  costaba hasta 181 ms; ahora 41 a 52 ms. Se cambiaron por la clase `body.con-portada` (la trae `index.html` y la pone
  `ui.js`) y por selectores de hermanos (`.auth-shell ~ footer`).
- **Cambio de tema en el celular** (`ui.js` `cambiarTemaConEfecto`, `app.css` sección 91):
  - El toque se ve al instante (~15 ms): el efecto empieza en el cuadro siguiente. Antes el toque tardaba lo mismo que
    todo el recálculo (250 a 400 ms en el celular simulado).
  - `content-visibility: auto` en las secciones largas, las tarjetas y el pie: lo que está fuera de la pantalla no se
    recalcula. Con su alto de reserva medido en cada tamaño, para que la barra de desplazamiento no salte.
  - En el celular el círculo del efecto dura 520 ms (antes 650).
  - Peor cuadro al cambiar de tema, antes → ahora: Inicio 366 → 243 ms, Vacantes 348 → 223 ms, Mensajes 181 → 125 ms,
    Conexiones 282 → 139 ms (celular simulado; en un teléfono real es unas 4 veces menos).
- **Auditoría de fluidez** de 12 páginas (carga y desplazamiento):
  - **El arranque de cada página** se demoraba en `construirTabbar`: el lente de la barra de abajo dibujaba el mapa de su
    lupa punto por punto al cargar (+50 a 200 ms). Ahora se dibuja en un momento libre.
  - **El globo** de "Vacantes cerca de ti": sus nombres se escribían en cada cuadro y eso obligaba a recalcular los
    estilos de toda la página (38 a 82 ms por cuadro al bajar). Ahora cada nombre se dibuja una vez en un lienzo
    aparte y luego solo se pega. Además, mientras gira o vuela dibuja la mitad de puntos.
  - **Al bajar**: la revisión del color del vidrio pasó de cada cuadro a cada 40 px, y la barra de arriba se actualiza
    una vez por cuadro.
  - Resultado del desplazamiento en el celular (cuadros de más de 50 ms, antes → ahora): Inicio con sesión 23 → 4,
    Vacantes 16 → 2, Mensajes 9 → 0, Conexiones 1 → 0, Empresas 3 → 0, Mi empresa 2 → 0, Elegir cuenta 3 → 0.
  - Lo que queda: el globo del Inicio de visitante en su vuelo de entrada (~100 ms por cuadro en el celular simulado)
    y procesar los datos del mapa (mundo y municipios, una sola vez y en ratos libres, ~80 a 110 ms).

### 53. "Llenar con mi hoja de vida": solo propone lo que de verdad es una habilidad (2026-11-15, sin commit)
- **Archivo**: `leer-hoja-de-vida.js` (sección "Habilidades"), estilos `.lector-chip-nivel` y `.lector-subtitulo` en `app.css`.
- **Problema medido** con 6 hojas de vida típicas: todo lo que estaba bajo "Habilidades" separado por comas entraba
  marcado. Entraban rótulos ("Habilidades blandas: liderazgo"), cualidades ("puntual", "honesta y proactiva"),
  la ciudad ("Cartagena", "Bolívar"), los puntos de nivel ("○○"), la palabra "Avanzado" sola, y el nivel pegado
  al nombre ("Excel básico" se guardaba con ese nombre y con nivel Intermedio).
- **Ahora** cada pedazo pasa por filtros en orden:
  1. Se le separa el nivel ("Excel (Avanzado)", "Inglés B1", "AutoCAD 80%", "Photoshop ●●●○○", "3/5", o el nivel
     en el renglón de abajo) y ese nivel se guarda con esa habilidad.
  2. Si está en un **catálogo** de ~170 habilidades (oficios de Cartagena, herramientas, programación, idiomas),
     se propone **marcada** y con su nombre de siempre ("Microsoft Excel", "Manejo de Excel" → "Excel").
  3. El ruido (correo, teléfono, ciudad, fechas, rótulos) se descarta.
  4. Las **cualidades** ("Responsable", "Buena presentación personal") no se proponen: la ventana las nombra y
     sugiere contarlas en "Acerca de ti".
  5. En una **frase larga** se buscan las habilidades del catálogo ("Control de versiones con Git y GitHub" → Git, GitHub).
  6. Lo corto que no se reconoce aparece **sin marcar** y con "Revisa".
- **Nuevo**: las del catálogo que se mencionan en la experiencia, los cursos o el perfil (y no en "Habilidades")
  se ofrecen aparte, **sin marcar** ("También las mencionas en tu hoja de vida").
- **Pruebas**: `hoja-de-vida-pdf.spec.js` actualizada y una nueva ("solo propone marcado lo que de verdad es una
  habilidad"): 18 de 18 pasan en PC y celular.

### 54. El menú "Tu cuenta" sale de una "ranura de luz" (2026-11-15, sin commit)
- **Archivos**: `ui.js` (menuDeCuenta: `animarRanura`; el menú ahora va dentro de `.cuenta-ranura` y hay una línea
  `.cuenta-filo`) y `app.css` (`.cuenta-ranura`, `.cuenta-filo`; la sombra del menú pasó a la ranura).
- **Historia**: primero se probó el efecto "genio" de Apple. Luis: "parece una copia y no pega", pidió algo original,
  sutil, limpio y novedoso. El genio se quitó entero.
- **Qué hace ahora**: al tocar tu foto, una línea fina con los colores del logo (naranja → turquesa) se traza desde el
  botón a lo ancho del borde de arriba del menú, y el menú **sale de esa línea**: se desenrolla hacia abajo como un papel
  que sale de una ranura (el mismo gesto de los contratos de la portada). La línea se apaga cuando el menú ya salió.
  Al cerrar, el menú se enrolla rápido hacia la línea y la línea se recoge hacia tu foto.
- **Cómo**: solo `transform` y `opacity`. La ranura recorta y baja desde −alto hasta su lugar, mientras el menú de
  adentro sube lo mismo al revés: el menú casi no se mueve y lo que crece es la ventana que lo deja ver (va 10 px
  "atrasado" para que se sienta que lo jalan). Abrir (un poco más lento, pedido de Luis): línea ~230 ms + menú 440 ms (curva de cajón de iOS). Cerrar: 200 ms.
  Si se cierra a mitad de abrir, sigue desde donde iba. Con "reducir movimiento": un fundido.
- **Fluidez** (celular simulado 4 veces más lento, con tarjeta gráfica): peor cuadro 56 ms la primera vez y 14 ms las
  siguientes; en PC, 7 ms. Igual que un simple fundido (el genio llegaba a 56–200 ms).
- **Pruebas**: navegación, menú, cambio de página y hoja de vida (63) pasan.

### 55. Revisión final a fondo: errores, pruebas y fluidez (2026-11-15, sin commit)
- **La ola del pie se mueve otra vez** (pedido de Luis: "eso ya tampoco se mueve"). En las páginas de vidrio la
  curva era una máscara quieta sobre el pie. Ahora el pie no pinta sus primeros 47 px (su color va en `::after`) y
  la ola (`.pie-ola`) es el azul del pie con forma de ola, que se desliza con `transform` como la del inicio.
  `app.css`, sección del pie en páginas de vidrio. La prueba `pie-ola.spec.js` se actualizó a lo nuevo.
- **"Cómo aprende SkillMatch" se congelaba ~2,6 s al cargar** (PC y celular): llegó de `main` pidiendo las fuentes a
  Google Fonts (hoja que frena el primer dibujo). Ahora usa las fuentes del proyecto como las demás y tiene la
  transición entre páginas (`pagereveal`) que le faltaba. Carga: 2,6 s → 0,4 s.
- **El mapa se quedaba sin municipios** cuando la entrada del globo esperaba al mapa del mundo (red lenta): un
  `return` salía antes de pedirlos. Era también la causa de la prueba del mapa que fallaba "a veces".
- **Mapa más liviano**: el mundo y los municipios se leen cuando la página está quieta (no a mitad de un
  desplazamiento), y los contornos se cierran con una línea en vez de `closePath` (era lo más caro del vuelo de
  entrada: ~270 ms de 4,5 s en un celular lento).
- **Contratos de la portada en un celular acostado**: podían quedarse invisibles para siempre (esperaban ver el 42 %
  de un contrato más alto que la pantalla). Ahora también se abren al ocupar el 60 % de la pantalla.
- **Barrido de errores**: 21 páginas × tipos de cuenta × PC/celular × claro/oscuro, bajando hasta el final, abriendo
  "Tu cuenta", cambiando el tema y cerrando con Escape: 0 errores de JavaScript, 0 archivos que no cargan, 0
  desbordes laterales, 0 imágenes rotas. JS (`node --check`), HTML (etiquetas) y CSS (llaves) sin errores.
- **Fluidez al bajar** (cuadros de más de 50 ms): en PC, 0 en 15 de 16 páginas; en celular simulado 4 veces más lento,
  0 en 13 de 16. Queda el globo del inicio de visitante en su vuelo de entrada (dibujo de las costas del mundo).

### 56. La barra ya no se traba al cambiar de pestaña (2026-11-15, sin commit)
- **Lo que Luis sentía**: al tocar una opción de la barra, la marca (lente) llega a su destino al 99 % a los
  155 ms (medido), pero la página esperaba **380 ms** para cambiar: más de 200 ms quieta, y después la carga de la
  página nueva. Ahora cambia a los **200 ms** (`VIAJE_LENTE` en `ui.js`), en la barra de abajo y en la de arriba.
  Del toque a irse: 580–620 ms → 340–440 ms (celular simulado 4 veces más lento).
- **La página nueva se arma más liviana mientras entra deslizándose**: al cargar, varias piezas leían medidas con la
  página a medio armar y la obligaban a calcularse una y otra vez. Se quitaron:
  - el monograma (`ui.js`): leía el ancho de cada cuadrito con `offsetWidth` → ahora `ResizeObserver`
    (~160 ms menos al llegar a Vacantes);
  - el lente de la barra de abajo se ubica en el próximo cuadro (~96 ms);
  - la barra que se esconde y el vidrio según el fondo leían `scrollY` al cargar → lo toman en el primer
    desplazamiento (~100 ms cada una);
  - la rueda de "Cómo funciona" (`rueda-pasos.js`): ancho por `ResizeObserver` y sin `offsetWidth` forzado (~75 ms).
  - Inicio listo al llegar: 1302 → 707 ms (celular simulado).
- **Se probó y se quitó**: preparar la página de destino en segundo plano al apoyar el dedo (speculation rules,
  solo Chrome/Edge/Android). No se pudo comprobar en ningún navegador de prueba (lo tienen apagado) y una página
  preparada corre su código sin verse (por ejemplo, marcaría como vista la entrada de la isla del Inicio).
- **Pruebas**: `cambio-de-pagina.spec.js` pedía esperar al menos 300 ms; ahora 180 (sigue comprobando que la marca
  llega antes de cambiar).

## Lo que NO hice a propósito (necesita tu permiso)

1. ~~Fuentes dentro del proyecto~~ — **hecho con tu permiso** (ver #32).
2. **Caché del CSS y el JS** en el sitio en vivo (Render responde `no-store`). Las dos opciones:
   - en `sw.js` ("la copia guardada ya, y actualizar por detrás"): justo después de publicar, una persona podría ver una vez
     el HTML nuevo con un JS viejo. Por eso no lo hice sin preguntarte;
   - en el backend (`SecurityConfig.java`): CLAUDE.md pide explicarte antes de tocarlo.
3. **Quitar la pestaña "Mensajes" de Conexiones** (solo dice "ve a Mensajes"): sus IDs los usa `conexiones.js`.
4. **Cambiar textos de la marca** ("Unirse ahora" / "Crear mi perfil" / "Ofertas" vs "Vacantes"): es tu voz; te dejo la
   lista en el informe.
5. **No corrí la suite completa de una sola vez.** Sí corrí, archivo por archivo, las pruebas de cada cosa que toqué
   (más de 1.200 ejecuciones de pruebas en total durante la noche, todas en verde al final) y la auditoría de accesibilidad.

## Cómo revisarlo en la mañana

- Abre el sitio con Live Server y prueba en este orden: **Vacantes** sin sesión → "Postularme" (ventana nueva) → Entrar
  → vuelves a la vacante con la postulación abierta → envíala (la chispa). En el celular (F12, modo dispositivo):
  login, Vacantes → "Filtros".
- **Elegir cuenta** (`seleccionar-registro.html`) y los dos **registros** (escribe tu nombre y mira la tarjeta).
- Entra como empresa: **Inicio** (sus postulaciones) y **Mi empresa** (compatibilidad, "Ordenar: Más compatibles", "Aceptar").
- Todo está sin commit. Para ver solo lo de esta noche: `git diff` sobre los archivos de la lista de arriba, o compara con el
  respaldo `respaldo-antes-de-la-noche.tar`.
