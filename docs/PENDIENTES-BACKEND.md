# Pendientes del backend (para Jesús)

Escrito el 13 de octubre de 2026, al cerrar la rama `fase-1-visual` (PR #1 hacia `fase-1-identidad`). Cada punto dice
qué pasa hoy, dónde está en el código y una forma de arreglarlo. El frontend ya está listo para todos: en cuanto el
backend cambie, la pantalla lo usa sin tocar nada más (salvo donde se indica).

Ordenado por urgencia. Las rutas de archivo son relativas a `backend/src/main/java/com/skillmatch/backend/`.

---

## 1. Urgente: seguridad y datos personales

### 1.1 Las sugerencias de conexión filtran datos privados
- **Qué pasa:** `GET /api/connections/suggestions` devuelve objetos `User` completos: el hash de la contraseña, el correo
  y el teléfono de otras personas. También pasa en `main`, el sitio publicado.
- **Dónde:** `service/ConnectionService.java:165` (`getSuggestions` devuelve `List<User>`) y
  `controller/ConnectionController.java:126`.
- **Arreglo:** devolver un DTO solo con lo que se muestra. El frontend (`conexiones.js`) usa `id`, `firstName`,
  `lastName`, `headline`, `location` y `skills[].name`.

### 1.2 Cualquiera con sesión ve el correo y el teléfono de cualquier persona
- **Qué pasa:** `GET /api/users/{id}` devuelve `email` y `phone` sin importar quién pregunte. Contradice la política de
  datos (`pages/politica-datos.html`).
- **Dónde:** `service/UserService.java:107-121` (`getUserProfile`) y `controller/UserController.java:32-38`.
- **Arreglo:** incluir `email` y `phone` solo si quien pregunta es la misma persona (o ADMIN). Las empresas ya reciben el
  contacto del candidato en la postulación (`userEmail` y `userPhone` de `ApplicationResponse`). El frontend no los usa
  en el perfil de otra persona ni en su hoja de vida.

### 1.3 Contraseña de la base de datos expuesta
- **Qué pasa:** la contraseña del usuario de MongoDB Atlas quedó escrita en un chat.
- **Arreglo:** cambiarla en Atlas y actualizar `MONGODB_URI` en Render y en los `.env` locales.

### 1.4 Las experiencias no cargan (error 400 en todo el sitio)
- **Qué pasa:** `GET /api/users/{id}/experiences` responde 400 con "experienceService is null". El perfil dice "No se
  pudieron cargar las experiencias", "Experiencia" nunca se marca como completa y la hoja de vida sale sin esa
  sección.
- **Dónde:** `controller/ExperienceController.java:23`:
  `private final ExperienceService experienceService = null;`
- **Arreglo:** quitar `= null`. Al tener un valor, `@RequiredArgsConstructor` lo deja fuera del constructor y Spring
  nunca lo conecta.

### 1.5 Una empresa puede publicar vacantes a nombre de otra
- **Qué pasa:** `POST /api/jobs` acepta el `companyId` que venga en el cuerpo sin revisar que sea de quien publica.
  Cualquier cuenta de empresa puede crear una vacante que aparece como de otra empresa (por ejemplo, una oferta falsa
  para pedir datos o dinero a las personas). Encontrado el 14 de octubre de 2026 al crear datos de prueba locales.
- **Dónde:** `controller/JobController.java:34-43` (solo pide el rol `EMPRESA`) y `service/JobService.java:40`
  (`createJob` no recibe quién publica).
- **Arreglo:** pasar `currentUser.getId()` a `createJob` y rechazar con 403 si `companyId` no es una empresa cuyo
  `userId` sea ese (salvo ADMIN), igual que ya hace `verifyOwnership` al editar. El frontend siempre manda el
  `companyId` de la propia sesión, así que no cambia nada.

---

## 2. Funciones que el frontend ya espera

### 2.1 Nadie crea las notificaciones de postulaciones
- **Qué pasa:** la empresa no se entera cuando alguien se postula, y la persona no se entera cuando la aceptan o la
  rechazan. Solo llegan las notificaciones de conexiones y mensajes.
- **Dónde:** los métodos existen en `service/NotificationService.java`, pero ningún servicio los llama:
  - `createApplicationReceivedNotification` (línea 80): llamarlo en `ApplicationService.createApplication`, después de
    guardar (línea 74), con el `userId` de la empresa dueña de la vacante.
  - `createApplicationUpdateNotification` (línea 63): llamarlo en `ApplicationService.updateStatus`, después de guardar
    (línea 143), con el `userId` del postulante.
  - `createNewJobNotification` (línea 74): definir a quién avisar (por ejemplo, personas con habilidades de la vacante).
- **Ojo:** `createApplicationUpdateNotification` compara el estado con `"accepted"` y `"rejected"` (en inglés), pero los
  estados se guardan en español (`aceptada`, `rechazada`, `revisada`). Así como está, el texto diría siempre
  "actualizada".
- **Frontend listo:** las notificaciones abren `perfil-empresa.html?tab=applicants&postulacion=<id>` y
  `perfil-usuario.html?tab=applications&postulacion=<id>`, y marcan esa postulación.

### 2.2 La empresa no puede editar sus datos
- **Qué pasa:** `PUT /api/companies/{id}` es solo de ADMIN. Una empresa real queda sin sector, ciudad, tamaño ni sitio
  web; en el directorio nuevo aparece casi vacía.
- **Dónde:** `controller/CompanyController.java:40-41`.
- **Arreglo:** usar la misma regla que ya tiene el PATCH de la descripción (línea 75):
  `hasRole('ADMIN') or @companyService.isOwner(#id, authentication.principal.id)`.
- **Logo y portada:** hoy "Mi empresa" guarda el logo y la portada en la **cuenta de usuario** de la empresa
  (`PUT /users/{id}/profile-image` y `/cover-image`), porque la empresa no puede cambiar su `logo` y `Company` no tiene
  portada. Por eso solo los ve quien tiene sesión (`GET /users/{id}` pide sesión). Para que salgan a los visitantes, en
  el directorio y en las tarjetas de Vacantes (`JobResponse.companyLogo`), conviene que la empresa pueda guardar su
  `logo` y un campo nuevo `coverImage` en `Company` (y `CompanyResponse`). El frontend se cambia a esos campos en
  cuanto existan.
- **Frontend:** cuando esté, se agrega el formulario en el perfil de empresa y se vuelven a pedir esos datos en el
  registro.

### 2.3 Retirar una postulación la borra
- **Qué pasa:** `DELETE /api/applications/{id}` elimina el registro y la empresa no sabe que la persona se retiró.
- **Dónde:** `controller/ApplicationController.java:133` y `service/ApplicationService.java:148`.
- **Arreglo:** agregar el estado `RETIRADA` a `model/ApplicationStatus.java` y marcarla en vez de borrarla. El frontend
  solo deja retirar las que siguen Pendientes o Revisadas.

### 2.4 Una solicitud de conexión rechazada bloquea para siempre
- **Qué pasa:** si alguien rechaza tu solicitud, nunca más puedes enviarle otra: el servidor responde "Ya existe una
  conexión o solicitud pendiente con este usuario".
- **Dónde:** `service/ConnectionService.java:54`. `findConnectionBetweenUsers` encuentra también las rechazadas.
- **Arreglo:** si la que existe está `REJECTED`, volverla `PENDING` con fecha nueva (o borrarla al rechazar).

### 2.5 Vacantes guardadas sin su estado
- **Qué pasa:** `SavedJobResponse` (`dto/SavedJobResponse.java`) no trae si la vacante sigue abierta. Para marcar
  "Ya no recibe postulaciones", el frontend pide cada vacante por separado.
- **Arreglo:** agregar `status` y `active` de la vacante, y mandar `jobId` aunque la vacante se haya borrado. Sin él,
  no se puede quitar de guardadas.

### 2.6 Un endpoint con los conteos para Indicadores
- **Qué pasa:** `indicadores.js` arma las gráficas con 31 consultas pequeñas a `/api/jobs/filter?size=1` (usa su
  `totalElements`).
- **Arreglo:** un `GET /api/public/job-stats` con conteos por `type`, `modality`, `experienceLevel`, las ciudades con
  más vacantes y rangos de salario. Así sería una sola consulta.

### 2.7 (Opcional) Conexiones de otra persona
- No hay forma de saber cuántas conexiones tiene otra persona; por eso ese dato se oculta en su perfil.

### 2.8 Render no tiene vacantes ni empresas
- **Qué pasa:** el 14 de octubre de 2026 la base de producción (Cluster0) tenía 7 personas y ninguna empresa, vacante
  ni postulación. Vacantes, Empresas e Indicadores se ven vacíos. El frontend ya lo explica con un mensaje (PR #5),
  pero así no se puede mostrar el sitio.
- **No activar `DataSeeder` tal como está en Render:**
  - crea 190 cuentas con la contraseña `password123`, que está escrita en el repositorio público: cualquiera podría
    entrar como esas empresas;
  - crea 300 postulaciones falsas;
  - solo trae empresas de tecnología con nombres en inglés (ver `docs/GUIA-DE-LENGUAJE.md`, "Para Jesús").
- **Arreglo propuesto:**
  1. Lo mejor: empresas reales de Cartagena que se registren y publiquen. El equipo puede conseguir 2 o 3 cada uno.
  2. Para mostrar el sitio antes de eso, cargar datos de ejemplo **marcados como ejemplo**, para que nadie se postule
     creyendo que son reales:
     - "(ejemplo)" en el nombre de cada empresa;
     - una frase al inicio de cada vacante: "Vacante de ejemplo: no es una oferta real";
     - contraseñas al azar que no queden en el repositorio;
     - oficios de muchos sectores.
  3. Luis tiene un script listo que hace esto por la API, con todo lo anterior: 12 empresas de Cartagena, 100
     vacantes de muchos oficios que cierran entre 3 y casi 6 meses después, 15 personas de ejemplo que se postulan y
     postulaciones con estados mezclados. Lo corre él desde su computador cuando tú des el visto bueno.
  4. Lo que queda para ti, con tu acceso a la base de producción y `mongosh` (Luis te pasa los dos archivos):
     - `completar-vacantes.js`: pone sector, ciudad y tamaño a esas empresas (la API no deja, ver 2.2) y reparte las
       fechas de publicación en el último mes (si no, todas dicen "hoy");
     - `borrar-vacantes.js`: cuando lleguen empresas reales, borra todo lo de ejemplo (solo las cuentas
       `@skillmatch.test`, sus vacantes y postulaciones).
  5. El backend permite 20 entradas o registros por minuto por IP (`RateLimitingFilter`); el script espera solo.

### 2.9 Render se duerme
- **Qué pasa:** en el plan gratis, Render apaga el servidor tras 15 minutos sin visitas. La siguiente visita tarda
  cerca de un minuto y parece que el sitio no funciona.
- **Arreglo gratis:** programar en cron-job.org una visita a `https://skillmatch-yz37.onrender.com/api/health` cada
  10 minutos. Las 750 horas gratis al mes alcanzan para un servicio encendido todo el tiempo.

---

## 3. Validaciones y consistencia

### 3.1 Contraseña mínima
- **Qué pasa:** `dto/UpdatePasswordRequest.java:18` acepta contraseñas desde 6 caracteres, pero el registro
  (`dto/RegisterRequest.java:20`) y el frontend piden 8.
- **Arreglo:** cambiar `min = 6` por `min = 8`.

### 3.2 El texto de búsqueda se usa como expresión regular
- **Qué pasa:** buscar "(" o "C++" responde 400 o 500.
- **Dónde:** `service/CompanyService.java:129-131` y `:142`; `service/JobService.java:105-106` y `:121`.
- **Arreglo:** `Pattern.quote(keyword)` antes de `.regex(...)`. El frontend ya escapa el texto (`textoParaBuscar` en
  `api-config.js`), pero el servidor no debería depender de eso.

### 3.3 "Eliminar" vacante en realidad la cierra
- **Qué pasa:** `JobService.deleteJob` (`service/JobService.java:81-88`) hace lo mismo que "Archivar"
  (`active=false`, `CERRADA`). Por eso el frontend quitó el botón "Eliminar".
- **Arreglo:** si se quiere borrar de verdad, usar un estado distinto de "cerrada".

---

## 4. Configuración (`config/SecurityConfig.java`)

- **Power BI:** `frame-src https://app.powerbi.com` (línea 123) ya no hace falta: Indicadores ya no inserta el Power BI.
- **`connect-src`:** hoy es `'self' https:` (línea 122). Cuando el frontend va dentro del jar, conviene dejar solo
  `'self'`, para que ninguna página pueda mandar datos a otro servidor.
- **PWA:** no hay que agregar nada. `/sw.js` y `/manifest.json` ya pasan por las reglas `/*.js` y `/*.json`.

---

## 5. Para más adelante (opcional)

- Guardar la hoja de vida en PDF (GridFS) y los campos del registro que se quitaron (área, estudios, modalidad,
  aspiración salarial), si se quieren volver a pedir.
- Un proceso real para verificar empresas antes de mostrar la insignia. `isVerified` existe, pero el frontend no la
  muestra.
- Del plan original (`docs/PLAN-UI.md`):
  - `/api/assistant` para el asistente Skilly;
  - insignias;
  - perfil público `/p/{slug}`;
  - alertas de vacantes;
  - WebSocket para mensajes en tiempo real.
- `config/DataSeeder.java` repite nombres de empresas: en el directorio se ven "duplicadas", aunque son distintas.

---

## Cómo comprobar cada arreglo con el frontend

| Arreglo | Dónde se nota |
|---|---|
| 1.1 Sugerencias | Conexiones → Sugerencias: siguen saliendo, pero la respuesta ya no trae contraseña, correo ni teléfono |
| 1.2 Perfil ajeno | `perfil-usuario.html?id=<otra persona>`: la respuesta de `/users/{id}` ya no trae correo ni teléfono |
| 1.4 Experiencias | Mi perfil muestra las experiencias, el panel de inicio marca "Experiencia" y la hoja de vida trae la sección |
| 1.5 Vacante ajena | `POST /api/jobs` con el `companyId` de otra empresa responde 403 |
| 2.1 Notificaciones | Postúlate como persona: la campana de la empresa avisa; acepta como empresa: la campana de la persona avisa |
| 2.2 Datos de empresa | El directorio (`empresas.html`) y el perfil público muestran sector, ciudad y sitio web de empresas reales |
| 2.3 Retirada | En la ventana de candidatos aparece "Retirada" en vez de desaparecer |
| 2.4 Rechazada | En el perfil de quien te rechazó, "Conectar" vuelve a funcionar |
| 2.8 Vacantes en Render | Vacantes, Empresas e Indicadores de skillmatch-yz37.onrender.com muestran datos en vez del mensaje de vacío |
| 2.9 Sin dormirse | La primera visita del día abre en segundos, no en un minuto |
| 3.2 Búsqueda | `GET /api/jobs/search?keyword=(` responde 200 con 0 resultados |
