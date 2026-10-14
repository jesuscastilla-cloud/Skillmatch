# Análisis completo del frontend (2026-10-09)

Revisión de las 13 páginas y los 16 módulos JS de `SkillMatch/src`, comparados con los 96 endpoints
del backend. Se probó con el backend local y las cuentas del seed: código, auditoría automática en
el navegador (visitante, estudiante y empresa; claro y oscuro; 375 y 1280 px) y pruebas de seguridad.

Ya está con commit en `fase-1-visual` (hasta `39ffa9e`): rediseño completo, datos reales en los
perfiles, búsqueda de la portada con vacantes reales, listas de la marca, accesibilidad, mayúsculas
y el escape del texto del servidor (XSS).

## Crítico: flujos rotos o que engañan

1. **No se puede empezar una conversación.** "Nuevo mensaje" dice "Función en desarrollo" y el botón
   "Mensaje" de Conexiones lleva a `mensajes.html?userId=…`, pero `mensajes.js` no lee ese dato. Solo
   se puede responder a conversaciones que ya existen (las del seed). La notificación de un mensaje
   tampoco abre ese chat.
2. **Publicar una oferta guarda datos falsos.** La ventana de "Nueva oferta" no pregunta modalidad,
   nivel ni habilidades: el código guarda siempre `modality: 'híbrido'` y `experienceLevel: 'junior'`.
   Sin habilidades, el % de compatibilidad no funciona con ofertas reales. El salario del ejemplo
   ("$2M - $3M") se guarda como **2 pesos**. Tampoco hay requisitos, responsabilidades ni beneficios,
   aunque el backend los acepta.
3. **Los registros piden datos que no se guardan.** El de usuario exige profesión, área, experiencia,
   estudios, departamento, ciudad, modalidad, contrato, aspiración salarial y **subir la hoja de vida en
   PDF**, pero solo envía nombre, correo, teléfono y contraseña. El de empresa exige NIT, sector,
   tamaño, descripción (20+ caracteres), contacto, dirección y el RUT, y solo envía nombre, correo y
   teléfono. Además, el aviso dice "al menos 6 caracteres" cuando el backend exige 8.
4. **Postular envía una carta inventada.** Al aplicar se manda siempre "Estimado equipo, estoy muy
   interesado en la posición de X y creo que mi perfil se alinea perfectamente…", sin que el
   estudiante la escriba ni la vea. La confirmación es un `confirm()` del navegador que muestra
   `<i data-ico="list"></i>` como texto. Las vacantes a las que ya te postulaste siguen diciendo
   "Aplicar".
5. **Vacantes muestra solo 20 de 1.608.** `/jobs` devuelve la primera página y no hay "cargar más".
   Los filtros trabajan sobre esas 20 y no se combinan con la búsqueda.
6. **No hay detalle de vacante.** La tarjeta corta la descripción a 150 caracteres y no hay dónde ver
   la oferta completa antes de postularse.
7. **Seguridad: `?api=` permite robar contraseñas en el sitio publicado** (también está en `main`).
   Un enlace como `…/login.html?api=https://servidor-ajeno/api` hace que la página mande el correo y la
   contraseña a ese servidor y lo deja guardado para siempre. La CSP del backend permite cualquier
   `https:` en `connect-src`, así que el navegador no lo frena. Se agregó para probar desde el celular:
   debe funcionar solo en `localhost` y en IPs de la red local.
8. **El perfil de empresa finge guardar.** Si falla borrar una oferta, la quita del navegador y dice
   "Oferta eliminada localmente" (sigue publicada). Si falla cargar las ofertas, muestra las que
   quedaron guardadas en el navegador como si fueran reales.

## Lo que falta (el backend ya lo tiene, falta la pantalla)

| Función | Endpoint que ya existe | Estado en el frontend |
|---|---|---|
| Ver mis vacantes guardadas | `GET /saved-jobs/my-saved-jobs` | Hecho: pestaña "Guardadas" en Vacantes y tarjeta en Mi perfil |
| Cambiar contraseña | `PUT /users/{id}/password` | Hecho: botón en el perfil de persona y en el de empresa |
| Mensajes sin leer en la barra | `GET /messages/unread-count` | Hecho: número junto a "Mensajes" arriba y en la barra del celular |
| Retirar una postulación | `DELETE /applications/{id}` | Hecho: en "Mis postulaciones", mientras siga Enviada o Revisada |
| Ver todas mis postulaciones | `GET /applications/my-applications` | Hecho: "Ver todas" abre "Mis postulaciones" |
| Saber si ya me postulé | `GET /applications/check` | Hecho: "Ya te postulaste" en Vacantes (punto 4) |
| Vacantes paginadas | `GET /jobs?page=` | Hecho: "Cargar más" de 20 en 20 (punto 4) |
| Enlaces de las notificaciones | `?tab=pending`, `?userId=`, `?jobId=`, `?tab=applications`, `?tab=applicants` | Hecho: cada uno abre la pestaña o ventana y marca la solicitud o postulación |
| Certificaciones reales | `/users/{id}/certifications` | Se quitaron las inventadas; no hay reales |
| Directorio de empresas | `GET /companies`, `/companies/search`, `/companies/{id}`, `/jobs/company/{id}` | Hecho: `empresas.html` y el perfil público `empresa.html?id=` |

Perfil de otra persona (`perfil-usuario.html?id=…`): tiene "Enviar mensaje" y "Conectar" (que cambia a "Solicitud
enviada", "Aceptar solicitud" o "En tus conexiones"), y no muestra "Vacantes para ti" ni botones para borrar lo suyo.

## Mejoras de calidad

- **Ventana de candidatos del perfil de empresa (hecho):** ahora con clases y los colores de la marca;
  funciona en modo oscuro. Las postulaciones "Revisadas" también se pueden aceptar o rechazar.
- **`confirm()` del navegador (hecho):** los 3 que quedaban (quitar habilidad, experiencia o estudio) son
  ahora una pregunta de la marca (`SkillMatchUI.confirmar`), con el foco en "Cancelar".
- **Buscadores y redes (hecho):** las 14 páginas tienen descripción; las públicas que se comparten
  (Vacantes, Únete y los registros) tienen vista previa `og:`, y las que solo sirven con sesión llevan
  `noindex`. La imagen para compartir (`assets/img/compartir.png`, 1200 × 630) usa la dirección completa del sitio en
  Render (`https://skillmatch-yz37.onrender.com`); si el sitio cambia de dirección, hay que cambiarla en esas 8 páginas.
- **Peso muerto (hecho):** fuera las 3 imágenes que nadie usaba (2 MB). Las portadas en SVG sí se usan
  (el nombre se arma en `editor-imagen.js`).
- **Código muerto (hecho):** fuera `showRecovery` y todo el formulario escondido de "recuperar
  contraseña" (login.html y auth.js: decía "restablecida" sin hacer nada), `contactCandidate` y la
  primera copia de `viewCandidateProfile`, `apiDisponible` y el CSS que solo usaban.
- **Mensajes (hecho desde el punto 2):** solo consulta el servidor con la pestaña a la vista.
- **Lottie:** siguen faltando los JSON de Lottieflow.
- **"Saltar al contenido" (hecho):** todas las páginas con barra tienen el enlace para saltarla con el teclado y su
  contenido principal marcado con `id="main"` (antes faltaba en 11).
- **Indicadores (hecho):** página propia con los datos del sitio, visible para todos (ver Avance).

## Resultado de la auditoría automática

91 tomas (13 páginas × claro/oscuro × 375/1280 px, con las tres sesiones): **sin errores de JS, sin
desbordes y sin texto ilegible**. Solo falla en la red el 400 conocido de experiencias. Lo que queda:

- Etiqueta "Aceptada" (hecho): de 4,1:1 a 5,3:1.
- Zonas táctiles (hecho): "Nueva oferta" y el enlace de la web de la empresa llegan a 44 px en celular.
  El mapa de la portada ya estaba bien: cada botón ocupa toda su tarjeta con una capa invisible.
- Falsos positivos revisados a mano: el logo del pie sí tiene nombre (el `alt` de la imagen), "Centro"
  del mapa se mide contra un fondo que no es el real, y las "mayúsculas" que quedan son nombres
  propios, cargos escritos por las empresas y categorías con barra.
- Visto a mano: la ventana de candidatos sale con tarjetas blancas en modo oscuro (captura en el
  análisis del 2026-10-09).

## Para Jesús (backend)

> La lista ordenada por urgencia, con archivo, línea y cómo arreglar cada punto, está en
> `docs/PENDIENTES-BACKEND.md`. Esta sección es el historial de cómo se fue encontrando cada uno.

- Urgente: fuga de datos en `/connections/suggestions` (hash de contraseña, correo y teléfono).
- Que la empresa pueda editar sus datos (`PUT /companies/{id}` es solo de ADMIN) para guardar sector,
  tamaño, ciudad y web del registro.
- Campos para lo que pide el registro de usuario (área, nivel de estudios, modalidad, aspiración) o
  quitarlos; guardar la hoja de vida (GridFS) si se quiere conservar.
- `/users/{id}/experiences` responde 400 ("experienceService is null").
- Un endpoint con los conteos por ciudad, modalidad, experiencia y salario, o `keyword` en
  `/jobs/filter`.
- `DELETE /jobs/{id}` no borra: cierra la oferta igual que "Archivar" (por eso se quitó "Eliminar" del
  perfil de empresa). Si se quiere borrar de verdad, que marque un estado distinto de "cerrada".
- Registro de empresa: permitir que la empresa edite sector, tamaño, ciudad y sitio web (hoy
  `PUT /companies/{id}` es solo de ADMIN) para volver a pedirlos en el registro y en el perfil.
- Guardar la hoja de vida en PDF (GridFS) si se quiere pedir al registrarse.
- `GET /users/{id}` devuelve el correo y el teléfono de cualquier usuario a quien haya iniciado sesión.
- Restringir `connect-src` de la CSP a `'self'` cuando el frontend vaya dentro del jar.
- `frame-src https://app.powerbi.com` ya no hace falta en la CSP: Indicadores no inserta el Power BI (queda un
  enlace para abrirlo aparte).
- `GET /saved-jobs/my-saved-jobs`: agregar el estado de la vacante (para marcar las que cerraron en el
  perfil) y mandar el `jobId` aunque la vacante se haya borrado (sin él no se puede quitar de guardadas).
- `DELETE /applications/{id}` borra la postulación y la empresa pierde el registro: mejor marcarla
  "RETIRADA" para que la empresa vea que la persona se retiró. El frontend solo deja retirar las que
  siguen Enviadas o Revisadas.
- `PUT /users/{id}/password` acepta contraseñas desde 6 caracteres; el registro y el frontend piden 8.
  Conviene subir el mínimo a 8 en `UpdatePasswordRequest` y en el registro.
- Nadie crea 3 de las 6 notificaciones: `createApplicationReceivedNotification` (la empresa no se entera de
  que alguien se postuló), `createApplicationUpdateNotification` (la persona no se entera de que la aceptaron
  o rechazaron) y `createNewJobNotification` existen en `NotificationService`, pero ningún servicio las llama.
  Solo llegan las de conexiones y mensajes. El frontend ya sabe abrir esos enlaces cuando lleguen.
- Si alguien rechaza una solicitud de conexión, la otra persona no puede volver a enviarla nunca: la conexión
  rechazada queda guardada y `sendConnectionRequest` responde "Ya existe una conexión o solicitud pendiente".
- No hay forma de saber cuántas conexiones tiene otra persona (solo las propias); por eso ese dato se oculta en
  su perfil.

## Avance

- **Punto 1 (hecho):** `api-config.js` solo acepta `?api=` en este equipo o en la red local
  (localhost, 127.x, 10.x, 172.16-31.x, 192.168.x) y hacia un servidor también local; en el sitio
  publicado lo ignora y borra lo que alguien haya dejado guardado. De paso, desde el celular en el wifi
  ya no hace falta `?api=`: la página usa el puerto 8080 del mismo equipo.
- **Punto 2 (hecho): Mensajes funciona de punta a punta.** Al probarlo salieron tres fallos más que ya
  existían: la lista esperaba campos que el backend no manda (cada conversación salía como "Usuario",
  sin texto, y no se abría), el panel del chat nunca se mostraba (la clase `.hidden` le ganaba a
  `style.display`) y tus mensajes no salían a la derecha (el CSS usaba otra clase). Ahora: "Nuevo
  mensaje" con tus conexiones y buscador; `mensajes.html?userId=` abre o empieza la conversación
  (Conexiones, perfil ajeno con "Enviar mensaje", postulaciones y candidatos de la empresa,
  notificaciones); no leídos reales; revisión cada 5 s sin parpadeo ni saltos y pausada con la pestaña
  oculta; en celular, la lista o el chat con botón para volver; fuera "En línea" (inventado) y la
  papelera sin acción. De paso: las fechas decían "Ayer" para todo lo de las últimas 24 h (`utils.js`) y
  `[hidden]` ahora siempre oculta.
- **Punto 3 (hecho): la ventana de oferta pide todo lo que el backend guarda.** Tipo, modalidad, nivel,
  ciudad (con sugerencias), salario mínimo y máximo en pesos con vista previa (avisa si se escribe "2"
  pensando en millones), duración, fecha límite, habilidades como etiquetas (al menos una: con ellas se
  calcula la compatibilidad), requisitos, responsabilidades y beneficios. Editar carga la oferta completa:
  antes el backend la reemplazaba y se borraban requisitos, beneficios, habilidades y fecha. Tras guardar,
  la lista y las cifras se recargan del servidor. Fuera las copias de ofertas en el navegador (se mostraban
  como reales) y el botón "⋮": en el backend "eliminar" no borra, cierra igual que "Archivar".
- **Punto 4 (hecho): Vacantes completa.** Detalle de cada vacante (descripción completa, requisitos,
  responsabilidades, beneficios, modalidad, duración, fecha límite y tus habilidades marcadas), también
  desde `?jobId=` (notificaciones y perfil); "Ya te postulaste" en las vacantes donde ya enviaste tu
  postulación; la postulación lleva el mensaje que escribe la persona (opcional, 2.000 caracteres) en
  una ventana de la marca, en vez del `confirm()` con la carta inventada; "Cargar más" de 20 en 20
  (antes solo se veían 20 de 1.608) y los filtros sobre los resultados de la búsqueda. Las empresas ven
  el detalle sin botones de postularse. En el perfil, "Aplicar ahora" (que también mandaba una carta
  inventada) ahora es "Ver y postularme".
- **Lenguaje para todo público (hecho):** reglas y glosario en `docs/GUIA-DE-LENGUAJE.md`. Fuera la
  jerga de sistemas y el inglés (match, feedback, networking, freelance, junior/senior, seniority,
  algoritmo, badges...), ejemplos de muchos oficios (la demo de la portada es una recepcionista de hotel),
  "Busco trabajo" en vez de "Soy usuario", y fuera promesas que el sistema no cumple ("te avisa",
  "talento verificado", "tu perfil trabaja mientras no estás").
- **Punto 5 (hecho): registros honestos.** El de personas pasó de 3 pasos con campos que se perdían
  (área, estudios, aspiración, hoja de vida en PDF...) a 2 pasos con lo que sí se guarda: la cuenta y, en
  el perfil recién creado, a qué se dedica, su ciudad, "sobre ti" y sus habilidades (con ellas la
  compatibilidad funciona desde el primer día). El de empresa pasó de 3 pasos (NIT, sector, tamaño,
  contacto, dirección, RUT...) a 2: cuenta, nombre, teléfono y la descripción, que ahora sí queda en
  "Acerca de nosotros". De paso: la empresa recién registrada quedaba sin `userType` y el sitio la trataba
  como persona hasta volver a entrar; el aviso de contraseña decía 6 caracteres (son 8); los errores se
  muestran en el formulario en vez de ventanas; el campo de habilidades ahora es un componente de
  `ui.js` (lo usan el registro y la ventana de oferta). Pendiente: no hay página de política de
  tratamiento de datos (Ley 1581 de 2012); la casilla de autorización ya no enlaza a "#".
- **Revisión de todas las vistas (hecho):** capturas de las 47 vistas (PDF aparte, fuera del repositorio).
  Al revisarlas se arreglaron: la barra de Vacantes (a un visitante le decía "Cerrar sesión" y a una
  empresa le mostraba la barra de persona), notificaciones sin texto, el perfil de otra persona con botones
  para borrar sus habilidades, el registro descuadrado, "Freelance" y la portada del perfil clara en modo
  oscuro.
- **Punto 6, vacantes guardadas (hecho):** "Guardar" funcionaba pero no había dónde verlas. Ahora
  Vacantes tiene las pestañas "Todas las vacantes | Guardadas (n)" (solo para personas con sesión, con
  los mismos filtros y orden, y también con `?guardadas=1`), y Mi perfil tiene la tarjeta "Vacantes
  guardadas" con las 3 últimas, "Quitar" y el enlace a todas. Una guardada que ya cerró dice "Ya no
  recibe postulaciones" en vez de "Postularme". Al guardar, un aviso dice dónde encontrarla.
- **Resultados de la portada en carrusel (hecho, idea de Luis):** al buscar en la portada salen las 10
  vacantes que más encajan con la persona: la del centro de frente y completa, las de los lados inclinadas
  como vista previa. Se mueve con flechas, puntos, teclado, arrastrando, deslizando el dedo, con el touchpad
  y tocando la de al lado; en el celular también es 3D. El movimiento lo dibuja el navegador en su propio hilo
  (Web Animations), así se ve fluido en el celular. Debajo, "Ver todas en Vacantes" lleva la búsqueda
  (`oportunidades.html?q=`, que Vacantes ahora busca desde la primera carga). El carrusel es `SkillMatchUI.carrusel` (ui.js, sección 18)
  y sus estilos la sección 21b de app.css. De paso: la portada nunca mostraba el % (esperaba uno del backend
  que no llega); ahora se calcula con las habilidades de la persona, igual que en Vacantes. "Postularme"
  (y las vacantes de la paleta Ctrl+K) llevaban a Vacantes buscando por el título y salían todas las que se
  llamaran igual; ahora abren esa vacante.
- **Punto 6 completo (hecho):** "Cambiar contraseña" en el perfil de persona y en el de empresa (ventana de
  `ui.js`: pide la actual y la nueva dos veces, mínimo 8 caracteres, y avisa si la actual no es correcta);
  número de mensajes sin leer junto a "Mensajes" en la barra de arriba y en la del celular (se revisa al abrir
  la página, cada minuto con la pestaña a la vista y al leer una conversación); "Ver todas" en "Tus
  postulaciones" abre "Mis postulaciones" con todas y deja retirar las que siguen en proceso, con la
  confirmación en la misma ventana (sin `confirm()` del navegador). `SkillMatchUI.ventana()` crea ventanas
  de la marca desde JS para lo que venga.
- **Mejoras legales (hecho):** fecha límite obligatoria de máximo 6 meses en la vacante, vacantes sin
  edad, sexo, estado civil ni foto, sin datos de contacto, casilla "Tengo 18 años o más" y página de
  política de tratamiento de datos (borrador, enlazada desde los registros y el pie). Detalle en
  `docs/REGISTRO-Y-MARCO-LEGAL.md`.
- **Notificaciones que llevan al sitio exacto (hecho):** una solicitud de conexión abre Conexiones en la pestaña
  "Solicitudes" con esa solicitud marcada (si ya se respondió, lo dice); una postulación abre "Mis postulaciones"
  (persona) o baja a "Postulaciones recibidas" (empresa) con ella marcada, aunque estuviera escondida tras "Ver
  todas". La marca es `SkillMatchUI.resaltar` (ui.js, sección 20): borde naranja, un destello y el foco. En la
  campana: el número de no leídas nunca salía (el backend manda `{count}` y se comparaba el objeto con 0), "Ver
  todas" era un enlace a "#" y ahora muestra también las leídas, cada aviso se abre con el teclado, Escape cierra
  la lista y, si fallaba marcar como leída, el clic no llevaba a ningún lado. Las pestañas de Conexiones se
  recuerdan en la dirección (`?tab=solicitudes`) y se recorren con las flechas.
- **"Conectar" en el perfil de otra persona (hecho):** dice en qué va la conexión y deja aceptar ahí mismo una
  solicitud recibida. De paso: ese perfil decía "0 conexiones" aunque la persona tuviera varias (ahora se oculta)
  y "Conectar" en las sugerencias mandaba "¡Me gustaría conectar contigo!" sin que la persona lo escribiera.
- **Indicadores del mercado (hecho, decisión de Luis):** antes la página mostraba un informe de Power BI que pedía
  iniciar sesión con una cuenta de la organización, así que un visitante no veía nada. Ahora son indicadores propios
  con los datos del sitio, visibles para todos: las 4 cifras generales (`/public/stats`), tipo de trabajo, dónde se
  trabaja, experiencia, salario que ofrecen, ciudades con más vacantes (Cartagena en naranja) y habilidades más
  pedidas (cada una lleva a Vacantes buscándola). Las cifras son exactas sobre todas las vacantes abiertas: se le
  pide a `/jobs/filter` una sola vacante y se usa su `totalElements` (31 consultas pequeñas en vez de bajar las 1.608
  en 33 páginas de 50). El salario sale de conteos acumulados con `maxSalary`; las ciudades y las habilidades, de las
  200 vacantes más recientes (no hay filtro por habilidad). Barras propias que solo animan `transform`. El Power BI
  queda como enlace para el equipo. Código en `assets/js/indicadores.js` y la sección 24 de `app.css`. Para Jesús:
  el endpoint de conteos (ya pedido arriba) lo reduciría a una sola consulta.
- **Instalar como app (PWA, hecho):** `manifest.json` (nombre, colores, íconos y accesos directos a Vacantes y
  Mensajes) y `sw.js` en la raíz de `SkillMatch/src`, para que controle todas las páginas; la configuración de
  seguridad ya deja pasar `/*.json` y `/*.js`, así que no hubo que tocar el backend. Reglas del service worker:
  la API y lo de otros sitios nunca se guardan (ahí van los datos de cada persona); páginas, CSS y JS van primero
  a la red, así que una versión nueva se ve al instante y la copia solo se usa sin conexión; las imágenes, primero
  la copia. Sin internet, las páginas ya abiertas se ven y las demás muestran `pages/sin-conexion.html`, que se
  recarga sola cuando vuelve la red. En el pie, "Instalar la app" aparece cuando el navegador lo permite. Íconos
  nuevos de 192 y 512 px (normales y "maskable" para Android), nítidos: el favicon de 192 px se reconstruyó
  color por color en vez de estirarlo. Solo funciona con https o en el mismo equipo (localhost): en el celular por
  la IP del wifi no se puede instalar; en Render sí.
- **Directorio de empresas (hecho):** antes no había dónde conocer a una empresa: "Empresas" en la barra de
  visitantes llevaba a una sección de la portada y su nombre en Vacantes no llevaba a ningún lado. Ahora
  `empresas.html` muestra las que publicaron vacantes hace poco y todas de la A a la Z (de 24 en 24, con el
  número de vacantes abiertas de cada una, pedido solo cuando la tarjeta está por verse) y busca por nombre o
  sector; la búsqueda queda en la dirección (`?q=`). `empresa.html?id=` es el perfil público: a qué se dedica,
  datos, sitio web, sus vacantes abiertas (cada una abre en Vacantes) y "Escribir a la empresa" para personas con
  sesión. No se muestran el correo ni el teléfono de la empresa. El nombre de la empresa en las tarjetas y en el
  detalle de Vacantes lleva a su perfil; también está en el pie, en la paleta Ctrl+K (junto con Indicadores) y en
  "Empresas" de la barra de visitantes. El tamaño se muestra en palabras (Pequeña, Mediana, Grande, Muy grande)
  porque el backend no guarda cuántas personas son. De paso: la barra marcaba la página actual antes de cambiar sus
  enlaces para los visitantes (ahora al revés). Para Jesús: la búsqueda usa el texto como expresión regular (un
  "(" daba error 500; el frontend lo escapa); conviene escaparlo también en `CompanyService.searchCompanies`, igual
  que en `/jobs/filter` con `location`. La insignia de "empresa verificada" no se muestra: no hay un proceso de
  verificación real todavía.
- **"Saltar al contenido" y barra con sesión en las páginas públicas (hecho):** el enlace para saltar la barra está
  en todas las páginas que la tienen; en la portada, Indicadores, la política y los registros, quien tiene sesión ve
  su barra (Conexiones y Mensajes) y no la de visitante.
- **Panel de inicio (hecho):** quien entra con su cuenta ya no ve en la portada la presentación para visitantes con
  "Crear mi perfil". Una persona ve un saludo según la hora, cuatro cifras que llevan a su sitio (postulaciones en
  proceso, mensajes sin leer, solicitudes de conexión y vacantes guardadas, con un punto naranja si algo espera
  respuesta), sus últimas postulaciones como una línea de pasos (Enviada, Revisada, Respuesta), lo que le falta al
  perfil (la misma lista de Mi perfil, así el porcentaje coincide) y las vacantes recientes que más coinciden con
  sus habilidades, sin las que ya se postuló. Una empresa ve sus cifras (ofertas activas, por revisar, recibidas y
  mensajes) y botones para publicar (`perfil-empresa.html?nueva=1` abre la ventana) y ver candidatos. Las secciones
  que invitan a registrarse se ocultan con sesión. Código en `assets/js/panel-inicio.js` y la sección 24d de
  `app.css`.
- **Hoja de vida en PDF (hecho):** `hoja-de-vida.html` arma la hoja de vida con los datos reales del perfil (perfil,
  experiencia, estudios, habilidades con su nivel y certificaciones) y "Descargar en PDF" usa la impresión del
  navegador: sin librerías ni servicios. Al imprimir solo sale la hoja, en tamaño carta. La propia lleva correo y
  teléfono; la de otra persona (`?id=`), no. Se llega desde Mi perfil ("Hoja de vida en PDF"), desde el perfil de
  otra persona ("Ver hoja de vida") y desde la ventana de candidatos de la empresa. Mientras el backend falle en
  experiencias, la hoja avisa en pantalla (no en el PDF) que sale sin esa sección. De paso: las fechas "2025-09-12"
  se leen como fecha local (con `new Date()` salían un día antes por la hora de Colombia).
- **Tablero de postulaciones (hecho, del plan original):** en "Postulaciones recibidas" la empresa elige ver la lista o
  un tablero con una columna por estado (Pendientes, Revisadas, Aceptadas, Rechazadas). Las tarjetas se mueven
  arrastrándolas con el mouse o con sus botones ("Marcar revisada", "Aceptar", "Rechazar", "Volver a revisadas"), que
  sirven con teclado y en el celular; el foco sigue a la tarjeta. El cambio se ve al instante y vuelve atrás si el
  servidor falla; la lista y las cifras de arriba se actualizan. La vista elegida se recuerda en el navegador. Al
  llegar desde una notificación se muestra la lista, para marcar la postulación.
- **Fotos en el sitio publicado (arreglado):** en Render ninguna foto de perfil ni portada abría ("No pudimos abrir
  esa imagen"). El editor la mostraba con una URL `blob:`, y la CSP del backend (`img-src 'self' data: https:`) no la
  permite; en local no se notaba porque Live Server no manda CSP. Ahora se lee como `data:`. Además acepta cualquier
  imagen que el navegador abra (fotos sin tipo o HEIC) y explica qué hacer con una HEIC que no se puede leer.
- **Vista previa al publicar vacante (hecho, del plan original):** en "Nueva oferta" y "Editar oferta", a la derecha
  (debajo en el celular) se ve la tarjeta tal como saldrá en Vacantes, y se actualiza mientras se escribe: título,
  ciudad, tipo, modalidad, experiencia, salario, el comienzo de la descripción, las habilidades y la fecha límite.
- **Logo y portada de la empresa (hecho):** "Mi empresa" tiene "Cambiar logo" y "Cambiar portada" con el mismo editor
  de las personas y una **galería exclusiva para empresas**, una portada por sector (puerto y logística, turismo y
  hoteles, comercio, tecnología, salud, industria, construcción y educación; generadas con los colores de la marca). Se
  guardan en el servidor en la cuenta de usuario de la empresa, así que el perfil público las muestra a quien tiene
  sesión; para los visitantes y las tarjetas de Vacantes falta el cambio del backend (PENDIENTES-BACKEND 2.2).
- **Vacantes vistas por una empresa (hecho):** la empresa sigue viendo todas las vacantes (le sirve para comparar
  ofertas y salarios), pero adaptado: un aviso arriba ("Así ven las personas las vacantes…"), la pestaña "Mis
  vacantes" con todas las suyas (también las cerradas, marcadas), "Tu vacante" y "Ver candidatos" en las suyas (abre
  directo la ventana de candidatos de esa oferta con `perfil-empresa.html?candidatos=<id>`) y orden por "Más reciente"
  (la compatibilidad no aplica a una empresa).
- **Primeros pasos para empresas (hecho, del plan original):** tarjeta arriba en "Mi empresa" con el avance (por
  ejemplo, 3 de 5) y cada paso pendiente como un botón que abre lo que falta: contar a qué se dedica, poner el logo,
  elegir una portada, publicar la primera vacante y, si ya hay postulaciones, responderlas. Desaparece cuando todo
  está listo.
- **Cifras por vacante (hecho, del plan original):** cada oferta de "Mi empresa" muestra cómo van sus postulaciones,
  con una barra por estado (por revisar, revisadas, aceptadas, rechazadas) y los números. Sale de las postulaciones que
  la página ya trae, sin consultas nuevas, y se actualiza al aceptar, rechazar o mover en el tablero.
- **Tamaño de letra (hecho, del plan original):** en el pie de todas las páginas, "Letra" con tres botones (normal,
  grande y muy grande) y también en la paleta Ctrl+K. Todo el texto usa `rem`, así que crece entero (16, 18 o 20 px de
  base). Se recuerda en el navegador y lo aplica el guion del `<head>` antes de pintar, para que la página no salte.
- **Recorrido guiado (hecho, del plan original):** la primera vez que una persona entra a su panel de inicio, o una
  empresa a "Mi empresa", la pantalla se oscurece menos la parte que se explica y una tarjeta cuenta para qué sirve
  ("Paso 1 de 6", Siguiente, Anterior, Saltar). Una sola vez por navegador; se puede volver a ver desde la paleta (la
  lupa de la barra o Ctrl+K: "Ver el recorrido de esta página"). Con teclado (flechas y Escape, el foco queda en la
  tarjeta), sin animar con movimiento reducido, y no interrumpe si se llega a abrir una ventana (por ejemplo
  "Nueva oferta"). Es `SkillMatchUI.recorrido` (ui.js, sección 23): sirve para cualquier página. Botón visible
  "Cómo funciona" en el panel de inicio (persona y empresa) y en "Mi empresa" para verlo cuando se quiera.

## Orden propuesto (solo frontend)

1. `?api=` solo en local (seguridad, 1 archivo).
2. Mensajes: empezar conversación desde Conexiones, desde un perfil y con "Nuevo mensaje"; abrir el
   chat que trae la notificación.
3. Nueva oferta completa: modalidad, nivel, habilidades, salario mínimo y máximo, requisitos.
4. Vacantes: detalle de la oferta, "ya te postulaste", carta de presentación escrita por el
   estudiante en una ventana de la marca, paginación con "cargar más".
5. Registros honestos: guardar profesión y ciudad (sí se puede con `PUT /users/{id}`) y la
   descripción de la empresa (`PATCH /companies/{id}/description`); quitar lo que no se guarda.
6. Vacantes guardadas, cambiar contraseña, contador de mensajes, retirar postulación.
7. Calidad: ventana de candidatos con la marca, `confirm()` de la marca, metadatos, peso muerto.
