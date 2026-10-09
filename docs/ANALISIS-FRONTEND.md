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
| Ver mis vacantes guardadas | `GET /saved-jobs/my-saved-jobs` | El corazón guarda, pero no hay dónde verlas |
| Cambiar contraseña | `PUT /users/{id}/password` | No existe |
| Mensajes sin leer en la barra | `GET /messages/unread-count` | No existe |
| Retirar una postulación | `DELETE /applications/{id}` | No existe |
| Ver todas mis postulaciones | `GET /applications/my-applications` | El perfil muestra 4, sin "ver todas" |
| Saber si ya me postulé | `GET /applications/check` | No se usa (ver crítico 4) |
| Vacantes paginadas y filtradas en el servidor | `GET /jobs?page=`, `GET /jobs/filter` | Solo 20 vacantes (crítico 5) |
| Enlaces de las notificaciones | `?tab=pending`, `?userId=`, `?jobId=`, `?tab=applicants` | Ninguna página los lee |
| Certificaciones reales | `/users/{id}/certifications` | Se quitaron las inventadas; no hay reales |
| Directorio de empresas | `GET /companies/search` | "Empresas" en la barra lleva a una sección de la portada |

Perfil de otra persona (`perfil-usuario.html?id=…`): siguen saliendo "Oportunidades recomendadas"
con botones "Aplicar" y no hay botones para conectar ni para escribirle.

## Mejoras de calidad

- **Ventana de candidatos del perfil de empresa:** 20 estilos fijos en el JS (fondo blanco, colores
  sueltos). No respeta el modo oscuro ni los colores de la marca.
- **9 `confirm()` del navegador** (eliminar habilidad, experiencia, educación u oferta; aplicar;
  iniciar sesión para guardar): cambiarlos por una ventana de la marca.
- **Buscadores y redes:** 12 de 13 páginas no tienen `<meta name="description">`; solo la portada
  tiene etiquetas `og:` (vista previa al compartir en WhatsApp).
- **Peso muerto:** 3 imágenes que nadie usa (`match-intelligent.png` de 1,8 MB,
  `usuario-profile.png`, `business-opportunities.png`): 2,1 MB dentro del jar.
- **Código muerto:** `showRecovery` (auth.js), `contactCandidate` y la primera copia de
  `viewCandidateProfile` (perfil-empresa.js), `apiDisponible` (api-config.js).
- **Mensajes** consulta el servidor cada 5 s aunque la pestaña esté oculta (las notificaciones sí se
  pausan).
- **Lottie:** siguen faltando los JSON de Lottieflow.
- **Indicadores:** pendiente de decidir (el Power BI pide iniciar sesión).

## Resultado de la auditoría automática

91 tomas (13 páginas × claro/oscuro × 375/1280 px, con las tres sesiones): **sin errores de JS, sin
desbordes y sin texto ilegible**. Solo falla en la red el 400 conocido de experiencias. Lo que queda:

- Etiqueta "Aceptada" del perfil de empresa: contraste 4,1:1 en modo claro (mínimo 4,5).
- Zonas táctiles pequeñas en celular: los nombres de zona del mapa de la portada (22 px de alto),
  "Nueva oferta" (26 px) y el enlace de la web de la empresa (26 px). ("Limpiar todo" y la "×" de
  habilidad ya tienen zona invisible de 44 px.)
- Falsos positivos revisados a mano: el logo del pie sí tiene nombre (el `alt` de la imagen), "Centro"
  del mapa se mide contra un fondo que no es el real, y las "mayúsculas" que quedan son nombres
  propios, cargos escritos por las empresas y categorías con barra.
- Visto a mano: la ventana de candidatos sale con tarjetas blancas en modo oscuro (captura en el
  análisis del 2026-10-09).

## Para Jesús (backend)

- Urgente: fuga de datos en `/connections/suggestions` (hash de contraseña, correo y teléfono).
- Que la empresa pueda editar sus datos (`PUT /companies/{id}` es solo de ADMIN) para guardar sector,
  tamaño, ciudad y web del registro.
- Campos para lo que pide el registro de usuario (área, nivel de estudios, modalidad, aspiración) o
  quitarlos; guardar la hoja de vida (GridFS) si se quiere conservar.
- `/users/{id}/experiences` responde 400 ("experienceService is null").
- Un endpoint con los conteos por ciudad, modalidad, experiencia y salario, o `keyword` en
  `/jobs/filter`.
- Restringir `connect-src` de la CSP a `'self'` cuando el frontend vaya dentro del jar.

## Avance

- **Punto 1 (hecho):** `api-config.js` solo acepta `?api=` en este equipo o en la red local
  (localhost, 127.x, 10.x, 172.16-31.x, 192.168.x) y hacia un servidor también local; en el sitio
  publicado lo ignora y borra lo que alguien haya dejado guardado. De paso, desde el celular en el wifi
  ya no hace falta `?api=`: la página usa el puerto 8080 del mismo equipo.

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
