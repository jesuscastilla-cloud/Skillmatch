# Auditoría del backend de SkillMatch

Rama: `backend/auditoria-seguridad` (sale de `main` en `47e6a77`, 27 de octubre de 2026).

Este documento revisa **todo el backend** (`backend/src/main/java/com/skillmatch/backend/`, unos 8.700 líneas de
Java) buscando fallos de seguridad, de manejo de datos personales y de operación. Al final hay un **plan por fases**
para arreglarlo todo, más las funciones nuevas pedidas (entrar con Google, número de teléfono y correos válidos).

> **Cómo se hizo:** leyendo el código archivo por archivo. Todavía **no** se atacó el servidor en vivo: cada
> "comportamiento actual" sale de leer el código. En cada fase se escriben pruebas automáticas que lo confirman antes
> de arreglarlo.
>
> **Ya documentado antes:** varios puntos ya estaban en `docs/PENDIENTES-BACKEND.md` (de Luis). Aquí se citan como
> "(pendientes 1.1)" y se suben de prioridad cuando corresponde. Este informe **no** reemplaza ese archivo.
>
> **No es asesoría legal.** La parte de datos personales es una revisión técnica; antes de abrir al público conviene
> validarla con un abogado (igual que dice `docs/REGISTRO-Y-MARCO-LEGAL.md`).

## Estado (27 de octubre de 2026)

| Fase | Estado | Notas |
|---|---|---|
| 1. Fugas de datos | Hecha | C1, C2, C3, A5, M7, A7 |
| 2. Vacantes y roles | Hecha | C4, A1, M9 (sin colección `audit_log`: por ahora solo una línea en el log), M13 |
| 3. Sesión y configuración | Hecha, salvo B1 | A2, A3, B2, M1, M2, M10, M11 |
| 4. Fuerza bruta y enumeración | Hecha, salvo el registro | A4 (IP real + bloqueo por cuenta 5 fallos / 15 min), M4 en el login. El registro sigue diciendo "El email ya está registrado": se resuelve con la verificación de correo (fase 8) |
| 5. Validación de entradas | Hecha | A6, B4, M5, M6, M12, M3, B3, A8 (con migración de correos al arrancar). Queda: algunos controladores todavía arman "Error al ...: " + mensaje en sus propios `catch`; con el manejador nuevo ya no llegan fallos de Java por ahí, pero conviene limpiarlos |
| 6. Mensajes y conexiones | Hecha | M8: el bloqueo impide escribir (en los dos sentidos); 20 mensajes/min y 500/día, 30 solicitudes/día por cuenta; la conversación devuelve los 1000 mensajes más recientes. Pendientes 2.4: una solicitud rechazada se puede reenviar a los 30 días (quien rechazó, de inmediato). Se mantiene que cualquiera puede escribir a cualquiera (así está diseñado el frontend). El frontend todavía no tiene botón "Bloquear". Si una conversación pasara de 1000 mensajes, "Eliminar conversación" dejaría los más viejos: la solución es un `DELETE /api/messages/conversation/{id}` (pendientes 2.11) |
| 7 a 11 | Pendientes | — |

**Al publicar la fase 5 en Render:** mirar el log del primer arranque. `Correos normalizados a minúsculas: N cuentas`
indica cuántas se arreglaron; una línea `Correo duplicado al normalizar` indica dos cuentas del mismo correo que hay
que revisar a mano (decidir cuál se conserva).

**Comprobar en Render al publicar la fase 4:** cuando alguien llegue al límite, el log mostrará
`Límite de intentos para IP ... (X-Forwarded-For: ...)`. La IP contada debe ser la última de esa cadena y la del
visitante real. Si Render agregara más de un proxy, ajustar `RATE_LIMIT_TRUSTED_PROXIES`.

**B1 queda pendiente a propósito:** el frontend guarda `data.token` en `localStorage` y lo manda como
`Authorization: Bearer`. Quitar el token del cuerpo rompería el login (en local la página va en `127.0.0.1:5500` y
la API en `localhost:8080`, así que la cookie no viaja). Primero el frontend debe usar solo la cookie `httpOnly`.

**Probado contra MongoDB local (27 de octubre):** 157 pruebas automáticas (incluida `AuthIntegrationTest`), 45
casos de ataque contra el servidor real (base `skillmatch-auditoria`) y el sitio en el navegador (entrar, perfil,
experiencias, cambio de contraseña, sugerencias, panel de empresa). Al probar se encontró y arregló que dos logins en
el mismo segundo daban el mismo token (ahora cada token lleva `jti`). Quedan anotados:
- Postularse dos veces responde 400 en vez de 409 (se bloquea igual): va en la fase 5 (M12).
- Una ruta estática que no existe (`/pages/sw.js`) responde 500 en vez de 404: va en la fase 5 (M3).
- Frontend: una experiencia sin fecha de fin sale como "dic 1969", y las fechas salen un mes antes por la zona
  horaria (`2025-01-01` se ve "dic 2024"). Se nota ahora que las experiencias cargan.
- Para correr `AuthIntegrationTest` en Windows con espacios en el usuario:
  `./mvnw test "-DargLine=-Djdk.net.unixdomain.tmpdir=C:/Temp/skillmatch-java"` (carpeta sin espacios).

**Revisar en Render al publicar la fase 3:** que exista `JWT_SECRET` (la app ya no arranca sin ella); que
`ALLOWED_ORIGINS` no esté definida o tenga solo dominios exactos; que `COOKIE_SAME_SITE` no sea `None`; que
`SWAGGER_ENABLED` no esté en `true`.

---

## 0. Cómo leer este informe

Cada hallazgo tiene un código y una gravedad:

| Gravedad | Qué significa | Ejemplo |
|---|---|---|
| **Crítico (C)** | Hoy, en el sitio publicado, alguien con una cuenta normal puede robar datos o suplantar a otros. | Ver el hash de la contraseña de otra persona |
| **Alto (A)** | Falla grave, pero necesita una condición extra o un poco más de esfuerzo. | Probar contraseñas sin límite real |
| **Medio (M)** | Debilita la seguridad o filtra información menor. | Mensajes de error que muestran detalles internos |
| **Bajo (B)** | Buenas prácticas, limpieza, cosas que conviene dejar bien. | Registros (logs) demasiado ruidosos |

Palabras que se repiten:

- **IDOR** (referencia directa insegura a un objeto): el servidor recibe un ID (`/api/applications/123`) y lo devuelve
  **sin revisar si es tuyo**. Basta con cambiar el número para ver lo de otra persona.
- **JWT**: el "pase" que el servidor te da al iniciar sesión. Lleva tu correo, tu ID y tu rol, y va **firmado** con una
  clave secreta (`JWT_SECRET`). Si alguien conoce la clave, puede fabricarse pases falsos.
- **Rol**: `USER` (persona), `EMPRESA` o `ADMIN`.

---

## 1. Resumen: lo más urgente

| # | Código | Qué pasa | Dónde |
|---|---|---|---|
| 1 | C1 | Las sugerencias de conexión devuelven el **hash de la contraseña**, el correo y el teléfono de otras personas | `ConnectionService.getSuggestions` |
| 2 | C2 | Cualquier empresa descarga **todas las postulaciones de la plataforma** (de todas las empresas) con correo, teléfono, hoja de vida y carta | `GET /api/applications/status/{status}` |
| 3 | C3 | Cualquier persona o empresa con sesión lee **cualquier postulación** cambiando el ID | `GET /api/applications/{id}` |
| 4 | C4 | Una empresa publica vacantes **a nombre de otra** (sirve para estafas) | `POST /api/jobs` |
| 5 | A1 | El rol y el estado de la cuenta se leen **del pase**, no de la base: desactivar una cuenta no la saca | `JwtAuthenticationFilter` |
| 6 | A2 | Si falta `JWT_SECRET`, el servidor arranca con una **clave publicada en GitHub**: cualquiera se fabrica un pase de ADMIN | `application.properties` |
| 7 | A3 | Cerrar sesión o cambiar la contraseña **no invalida** los pases ya entregados (la lista negra se borra cada vez que Render se duerme) | `TokenBlacklistService` |
| 8 | A4 | El límite de intentos de login **se salta** con una cabecera inventada | `RateLimitingFilter` |
| 9 | A5 | Cualquier sesión ve correo y teléfono de cualquier persona; el listado **público** de empresas muestra correo, teléfono e ID del dueño | `UserService.getUserProfile`, `CompanyService` |
| 10 | A6 | La búsqueda **pública** mete el texto del usuario como expresión regular (puede tumbar o frenar la base) | `JobService`, `CompanyService` |

Y un error funcional que afecta a todos: **las experiencias nunca cargan** (pendientes 1.4,
`ExperienceController.java:23`, `= null`).

---

## 2. Pruebas pedidas, una por una

"Esperado" es lo que debería pasar. "Hoy" es lo que hace el código.

### 2.1 Autenticación y JWT

| Caso | Esperado | Hoy | Estado |
|---|---|---|---|
| Login con contraseña incorrecta | 401 con mensaje genérico | 401 "Email o contraseña incorrectos" | ✅ Bien |
| Login con correo que no existe | El **mismo** 401 (no revelar si existe) | El mismo 401 (Spring oculta "usuario no encontrado") | ✅ Bien |
| Login de cuenta desactivada | 401 genérico | 400 "User is disabled": revela que la cuenta existe | ⚠️ M4 |
| Fuerza bruta (muchos intentos) | Bloqueo por IP **y** por cuenta | 20 por minuto por IP, que se salta (ver A4); sin bloqueo por cuenta | ❌ A4 |
| JWT expirado | 401 | 401 "Token inválido o expirado" | ✅ Bien (pero ver B2) |
| JWT manipulado (cambiar el rol o el correo) | 401 | 401: la firma ya no coincide | ✅ Bien |
| JWT con `alg: none` (sin firma) | 401 | 401: la librería (jjwt) exige firma | ✅ Bien |
| JWT firmado con la clave por defecto | 401 | **Aceptado** si el servidor arrancó sin `JWT_SECRET` | ❌ A2 |
| JWT de una cuenta desactivada o a la que se le quitó un rol | 401 / sin el rol | **Aceptado con el rol viejo** hasta 24 horas | ❌ A1 |
| JWT después de cerrar sesión | 401 | 401… hasta que Render reinicia (se duerme cada 15 min) | ❌ A3 |
| JWT después de cambiar la contraseña | 401 (cerrar las demás sesiones) | Sigue valiendo 24 horas | ❌ A3 |
| Petición sin token a una ruta privada | 401 en JSON | 401, pero sin el cuerpo JSON que usa el resto de la API | ⚠️ B2 |

### 2.2 Autorización (quién puede hacer qué)

| Caso | Esperado | Hoy | Estado |
|---|---|---|---|
| Leer el perfil de otra persona | Sin correo ni teléfono | Con correo y teléfono | ❌ A5 (pendientes 1.2) |
| Editar el perfil, foto o contraseña de otra persona | 403 | 403 | ✅ Bien |
| Editar habilidades, estudios o certificaciones de otra persona | 403 | 403 | ✅ Bien |
| Leer una postulación ajena (`/applications/{id}`) | 403 | **200 con todo** | ❌ C3 |
| Empresa lista postulaciones por estado (`/applications/status/pendiente`) | Solo las suyas | **Las de toda la plataforma** | ❌ C2 |
| Empresa lista postulaciones de otra empresa (`/applications/company/{id}`) | 403 | 403 | ✅ Bien |
| Empresa ve cuántas postulaciones tiene una vacante ajena (`/job/{id}/count`) | 403 | 200 | ⚠️ M13 |
| Empresa crea vacante con el `companyId` de otra | 403 | **201 creada** | ❌ C4 (pendientes 1.5) |
| Empresa edita, cierra o borra una vacante ajena | 403 | 403 | ✅ Bien |
| Persona (USER) llama endpoints de ADMIN (`/companies/{id}/verify`) | 403 | 403 | ✅ Bien |
| Rol incorrecto: EMPRESA se postula a una vacante | 403 | 403 | ✅ Bien |
| ADMIN modera (cierra) una vacante que no es suya | Permitido | 403: el ADMIN no puede moderar | ⚠️ M9 |
| Marcar o borrar un mensaje o notificación ajena | 403 | 403 | ✅ Bien |
| Ver estadísticas de otra persona o empresa | Solo las propias (o ADMIN) | Cualquiera con sesión | ⚠️ M13 |

### 2.3 Navegador, CORS y enumeración

| Caso | Esperado | Hoy | Estado |
|---|---|---|---|
| Petición desde `https://atacante.com` | Bloqueada por CORS | Bloqueada | ✅ Bien |
| Petición desde `https://lo-que-sea.onrender.com` (o `netlify.app`, `vercel.app`, `github.io`, `railway.app`) | Bloqueada | **Permitida, con credenciales** | ❌ M1 |
| Saber si un correo está registrado | Imposible sin acceso | El registro responde "El email ya está registrado"; editar perfil responde "El email ya está en uso" | ⚠️ M4 |

### 2.4 Datos de entrada

| Caso | Esperado | Hoy | Estado |
|---|---|---|---|
| Registrarse dos veces con el mismo correo | 409 | 409 | ✅ Bien |
| Mismo correo con mayúsculas (`Ana@x.com` / `ana@x.com`) | 409 | **Crea otra cuenta** | ❌ A8 |
| Postularse dos veces a la misma vacante | 409 | 409; si las dos llegan a la vez, 400 con el error interno de MongoDB | ⚠️ M12 |
| Inyección NoSQL (`{"email": {"$ne": null}}`) | 400 | 400: los DTO esperan texto y Jackson rechaza el objeto | ✅ Bien |
| Inyección en búsqueda (`keyword=(` o `keyword=(a+)+$`) | Búsqueda literal | Se usa como expresión regular: error o consulta lenta | ❌ A6 (pendientes 3.2) |
| Over-posting: mandar `"roles":["ADMIN"]` en el registro | Ignorado | Ignorado (el DTO no tiene ese campo) | ✅ Bien |
| Over-posting: `"userType":"ADMIN"` en el registro | Queda USER | Queda USER | ✅ Bien |
| Over-posting: `isVerified` en empresa | Solo ADMIN | Solo ADMIN | ✅ Bien |
| Campos nulos o vacíos | 400 con mensaje claro | La mayoría tiene `@NotBlank`; los que reciben `Map<String,String>` validan a mano | ✅ Casi bien |
| Textos gigantes (mensaje de 10 MB, 50.000 habilidades) | 400 | **Se guardan** | ❌ M5 |
| `<script>` en nombre, biografía o mensajes | Se guarda como texto y se escapa al mostrar | Se guarda tal cual; depende de que el frontend escape | ⚠️ ver M6 |
| URL de foto `javascript:alert(1)` o de otro servidor | Solo `https://` de orígenes permitidos | Cualquier texto | ❌ M6 |

---

## 3. Hallazgos en detalle

Las rutas son relativas a `backend/src/main/java/com/skillmatch/backend/`.

### Críticos

#### C1. Las sugerencias filtran el hash de la contraseña (pendientes 1.1)
- **Qué pasa:** `GET /api/connections/suggestions` devuelve la clase `User` completa, la misma que se guarda en la
  base. Jackson (la librería que convierte objetos a JSON) publica **todos** sus campos: `password` (el hash BCrypt),
  `email`, `phone`, `roles`, `enabled`, experiencias, etc.
- **Por qué es grave:** con el hash, un atacante puede intentar adivinar la contraseña en su propio computador, sin
  límite de intentos. La gente repite contraseñas, así que también pone en riesgo su correo y otras cuentas.
- **Dónde:** `service/ConnectionService.java` (`getSuggestions` devuelve `List<User>`) y
  `controller/ConnectionController.java` (`getSuggestions`).
- **Arreglo:** un DTO `UserSummaryResponse` solo con lo que se muestra (`id`, `firstName`, `lastName`, `headline`,
  `location`, `profileImageUrl`, nombres de habilidades). Además, marcar `password` en `User` con
  `@JsonIgnore` como cinturón de seguridad, para que **nunca** pueda salir aunque alguien vuelva a devolver la entidad.

#### C2. Una empresa descarga todas las postulaciones de la plataforma
- **Qué pasa:** `GET /api/applications/status/{status}` solo pide el rol EMPRESA y devuelve **todas** las postulaciones
  con ese estado, de todas las empresas. Cada una trae nombre, correo, teléfono, ciudad, foto, hoja de vida, carta de
  presentación y notas internas.
- **Ataque:** registrarse como empresa (no se verifica nada) y pedir `/status/pendiente`, `/status/aceptada`, etc.
- **Dónde:** `controller/ApplicationController.java` (`getApplicationsByStatus`) y `ApplicationService.getApplicationsByStatus`.
- **Arreglo:** filtrar por las vacantes de la empresa que pregunta (o quitar el endpoint si el frontend no lo usa).

#### C3. Cualquiera lee cualquier postulación (IDOR)
- **Qué pasa:** `GET /api/applications/{id}` no revisa quién pregunta. Los IDs de MongoDB no son secretos: salen en
  URLs y notificaciones (`perfil-empresa.html?postulacion=<id>`) y son en parte predecibles (empiezan con la fecha).
- **Dónde:** `ApplicationController.getApplicationById` y `ApplicationService.getApplicationById`.
- **Arreglo:** permitir solo al postulante, a la empresa dueña de la vacante o a un ADMIN; si no, responder **404**
  (no 403, para no confirmar que el ID existe).

#### C4. Vacantes a nombre de otra empresa (pendientes 1.5)
- **Qué pasa:** `POST /api/jobs` usa el `companyId` del cuerpo sin revisar que sea de quien publica.
- **Riesgo real:** ofertas falsas con el nombre de una empresa conocida para pedir datos o dinero.
- **Dónde:** `controller/JobController.java` (`createJob`) y `service/JobService.java` (`createJob`).
- **Arreglo:** pasar el usuario de la sesión y exigir que la empresa sea suya (salvo ADMIN).

### Altos

#### A1. El rol y el estado de la cuenta salen del pase, no de la base
- **Qué pasa:** `JwtAuthenticationFilter` arma los permisos con `tokenProvider.getRolesFromJwt(jwt)` y nunca revisa
  `isEnabled()`. Aunque se desactive una cuenta (`enabled=false`) o se le quite un rol en la base, el pase sigue
  valiendo con el rol viejo durante 24 horas.
- **Por qué importa más:** combinado con A2, quien falsifique un pase puede **ponerse el rol ADMIN** directamente.
- **Arreglo:** usar los roles de `userDetails.getAuthorities()` (que ya se carga de la base en cada petición) y
  rechazar si `!userDetails.isEnabled()`.

#### A2. Clave JWT por defecto conocida
- **Qué pasa:** `application.properties` trae `jwt.secret=${JWT_SECRET:skillmatch-secreto-solo-para-desarrollo-local…}`.
  Esa cadena tiene más de 32 caracteres, así que **pasa** la validación de `JwtTokenProvider.init()`. Si se despliega
  sin `JWT_SECRET`, el servidor arranca feliz con una clave que está en el repositorio público.
- **Hoy en Render:** `render.yaml` usa `generateValue: true`, así que Render genera una clave al azar. **En Render no
  aplica.** Pero `railway.json` y la guía de despliegue siguen ahí: es una trampa para el próximo despliegue.
- **Arreglo:** que la app **se niegue a arrancar** si la clave es la de desarrollo y no está en modo local (perfil
  `local`, o una variable `APP_ENV=local`).

#### A3. Cerrar sesión y cambiar contraseña no invalidan de verdad
- **Qué pasa:**
  1. La "lista negra" de pases cerrados (`TokenBlacklistService`) vive en la memoria del servidor. Render (plan
     gratis) se duerme tras 15 minutos sin visitas y, al despertar, la lista está vacía: el pase "cerrado" vuelve a
     servir.
  2. Cambiar la contraseña no cierra las demás sesiones. Si alguien te robó la sesión, cambiar la contraseña no lo saca.
  3. Además, `isBlacklisted` recorre toda la lista en cada petición.
- **Arreglo (sin servicios de pago):** un número `tokenVersion` en cada `User`. El pase lleva ese número; el filtro lo
  compara con la base (que ya consulta en cada petición). Cerrar sesión en todos lados o cambiar la contraseña suma 1 y
  todos los pases viejos dejan de valer, aunque el servidor reinicie. Para "cerrar solo esta sesión" basta con borrar
  la cookie; si se quiere más precisión, guardar la lista negra en MongoDB con un índice TTL (se borra sola al vencer).

#### A4. El límite contra fuerza bruta se salta
- **Qué pasa:** `RateLimitingFilter.resolveClientIp` toma la **primera** IP de la cabecera `X-Forwarded-For`, que la
  escribe quien hace la petición. Un atacante manda una IP inventada distinta en cada intento y nunca llega al límite.
  Además:
  - si el mapa pasa de 10.000 IPs se vacía entero (más fácil todavía de saltar);
  - no hay bloqueo por **cuenta**: con muchas IPs se puede atacar una sola cuenta;
  - solo cubre `/login` y `/register`; cambiar la contraseña (`PUT /users/{id}/password`) no tiene límite.
- **Arreglo:**
  1. Tomar la IP que agrega el proxy de Render (al final de la lista), no la primera. Antes, comprobar en los logs
     de Render cuántas IPs agrega su proxy.
  2. Contador de intentos fallidos por correo: tras 5 fallos, esperar 15 minutos (con el mismo mensaje genérico).
  3. Usar el filtro también en cambio de contraseña, registro y, más adelante, en "olvidé mi contraseña".

#### A5. Correo y teléfono a la vista (pendientes 1.2, ampliado)
- `GET /api/users/{id}`: cualquier sesión ve el correo y el teléfono de cualquier persona.
- `GET /api/companies`, `/search`, `/filter` y `/{id}` son **públicos** (sin sesión) y devuelven el correo, el
  teléfono y el `userId` del dueño de cada empresa. `GET /api/companies` incluye además las desactivadas. Si la
  "empresa" es una persona natural, son datos personales publicados.
- **Arreglo:** respuestas distintas según quién pregunta (la propia persona o ADMIN ven todo; los demás, el perfil
  público). Para empresas, mostrar un correo de contacto **solo si la empresa lo marca como público**.

#### A6. Búsqueda con expresiones regulares del usuario (pendientes 3.2, sube a Alto)
- `JobService.searchJobs`, `getJobsByFilters` (ubicación) y `CompanyService.searchCompanies`, `getCompaniesByFilters`
  pasan el texto tal cual a `.regex(...)`. Son endpoints **públicos**. Además de los errores con `(` o `C++`, un patrón
  como `(a+)+$` hace que MongoDB trabaje de más con cada documento (ReDoS: negar el servicio con expresiones
  regulares).
- **Arreglo:** `Pattern.quote(texto)` y un largo máximo (por ejemplo, 100 caracteres).
- **Además:** `/api/companies/search` y `/filter` no tienen paginación: devuelven **todas** las empresas.

#### A7. Experiencias rotas (pendientes 1.4)
- `ExperienceController.java:23` tiene `private final ExperienceService experienceService = null;`. Todo
  `/api/users/{id}/experiences` responde 400. No es de seguridad, pero se arregla en la fase 1 porque es una línea.

#### A8. Correos sin normalizar ni verificar
- **Qué pasa:**
  - `Ana@Correo.com` y `ana@correo.com` son cuentas distintas: el índice único distingue mayúsculas.
  - Nadie verifica que el correo sea de quien se registra: se puede crear una cuenta con el correo de otra persona o
    de una empresa real.
  - `@Email` de Hibernate acepta direcciones como `ana@localhost` (sin dominio real).
  - Cambiar el correo (`PUT /users/{id}`) no pide la contraseña ni confirma el correo nuevo. Además, el pase lleva el
    correo viejo, así que tras cambiarlo la sesión se rompe.
- **Arreglo:** ver la fase 8 ("Correos válidos").

### Medios

#### M1. CORS demasiado abierto
- **Qué pasa:** si no se define `ALLOWED_ORIGINS`, se aceptan **con credenciales** todos los subdominios de
  `onrender.com`, `netlify.app`, `vercel.app`, `github.io` y `railway.app`. Cualquiera puede publicar una página gratis
  en esos dominios. Además, la protección CSRF está desactivada y la sesión va en una cookie.
- **Hoy lo frena** que la cookie es `SameSite=Lax` y que `onrender.com` está en la "lista de sufijos públicos", así que
  el navegador no manda la cookie desde otro subdominio. Pero `DESPLIEGUE.md` recomienda `COOKIE_SAME_SITE=None` cuando
  el frontend va en otro dominio: con eso, **cualquier página en esos dominios podría actuar como el usuario y leer
  sus datos**.
- **Arreglo:** como el frontend va dentro del mismo jar, en producción no hace falta CORS: dejar por defecto solo
  `localhost` y el dominio real. Si algún día el frontend se separa, listar el dominio exacto, nunca `*.dominio`.

#### M2. Cookie sin `Secure` en producción
- `app.cookie.secure` es `false` por defecto y `render.yaml` no lo cambia. La cookie podría viajar por `http://`.
- **Arreglo:** `true` por defecto y `false` solo en local.

#### M3. Mensajes de error con detalles internos
- `GlobalExceptionHandler` devuelve `ex.getMessage()` para cualquier `RuntimeException` (400) y
  `"Error interno del servidor: " + ex.getMessage()` para el resto (500). `server.error.include-message=always` hace lo
  mismo con los errores de Spring. Varios controladores concatenan `e.getMessage()`.
- Con eso salen nombres de índices de MongoDB, valores duplicados, nombres de clases Java y `"Usuario no encontrado
  con email: ..."`. `GET /api/health` (público) muestra el nombre de la base y el error de conexión.
- **Arreglo:** mensajes propios para errores esperados y un genérico "Ocurrió un error, intenta de nuevo (código
  X)" para lo inesperado, con el detalle **solo en el log del servidor**.

#### M4. Enumeración de usuarios
- Registro: "El email ya está registrado". Editar perfil: "El email ya está en uso". Cuenta desactivada: mensaje
  distinto. Con eso se puede averiguar quién usa SkillMatch.
- **Arreglo realista:** el registro siempre necesita decir algo; lo estándar es limitar intentos por IP (A4) y,
  cuando haya verificación de correo (fase 8), responder siempre "Te enviamos un correo para continuar". El login
  desactivado debe responder igual que una contraseña mala.

#### M5. Sin límites de tamaño
- Sin `@Size`: contenido de mensajes, mensaje de solicitud de conexión, descripción de experiencias, estudios y
  certificaciones, listas de requisitos, responsabilidades, habilidades y beneficios de vacantes, notas de vacantes
  guardadas, `notes` de la empresa (llega por la URL).
- Sin tope de cantidad: habilidades, experiencias, estudios y certificaciones van **dentro** del documento del usuario
  (MongoDB admite 16 MB por documento). Se puede inflar una cuenta hasta romperla.
- El cuerpo JSON de una petición no tiene tope de tamaño.
- **Arreglo:** `@Size` en todos los textos y listas, un máximo por colección del perfil (por ejemplo, 50 habilidades) y
  un tope global del cuerpo de la petición.

#### M6. URLs sin validar
- `profileImageUrl`, `coverImageUrl`, `attachmentUrl` (mensajes), `logo` y `website` aceptan cualquier texto:
  `javascript:...`, `data:...` o la dirección de un servidor que registra la IP de quien abre el perfil.
- Si el frontend pone alguno de esos valores en un `href`, es XSS almacenado (código que se ejecuta en el navegador de
  la víctima). La CSP actual permite `'unsafe-inline'` en scripts, así que no lo frena.
- **Arreglo:** aceptar solo `https://` (y para imágenes, solo los servicios que el sitio usa o `data:image/...` con
  tamaño máximo, según cómo suba las fotos el frontend hoy). Revisar con el frontend antes de restringir.

#### M7. El candidato ve las notas internas de la empresa
- `ApplicationResponse.notes` (lo que escribe la empresa al cambiar el estado) sale también en
  `/applications/my-applications`. Las notas de un reclutador no deberían verse del lado del candidato.
- **Arreglo:** dos respuestas: una para el candidato (sin `notes`) y otra para la empresa.

#### M8. Mensajes y conexiones sin control de abuso
- Se puede escribir a **cualquier** cuenta, sin conexión previa, incluso a quien te bloqueó. Bloquear no impide nada.
- No hay límite de envío: se pueden mandar miles de mensajes (y miles de notificaciones).
- La conversación (`/conversation/{id}`) no se pagina.
- **Arreglo:** respetar el bloqueo, límite por minuto por cuenta y paginación. Decidir si las personas pueden escribirse
  sin estar conectadas (las empresas a sus postulantes, sí).

#### M9. El ADMIN no puede moderar
- `verifyOwnership` (vacantes) y `verifyJobOwnership` (postulaciones) no dejan pasar al ADMIN, aunque los controladores
  sí lo permiten. No existe forma de crear un ADMIN (solo a mano en la base) ni registro de lo que hace.
- **Arreglo:** dejar pasar al ADMIN donde tenga sentido (cerrar vacantes falsas, desactivar empresas) y guardar un
  registro de auditoría (`audit_log`: quién, qué, cuándo).

#### M10. Swagger público en producción
- `/swagger-ui.html` y `/v3/api-docs` publican el mapa completo de la API.
- **Arreglo:** apagarlo en producción (`springdoc.api-docs.enabled=${SWAGGER_ENABLED:false}`).

#### M11. Cabeceras de seguridad
- La CSP permite `'unsafe-inline'` en scripts y `connect-src https:` (pendientes 4). Faltan `Referrer-Policy` y
  `Permissions-Policy`.
- **Arreglo:** agregar las dos cabeceras ya. Quitar `'unsafe-inline'` depende de que el frontend no tenga scripts en
  línea: eso va en coordinación con el frontend.

#### M12. Duplicados en carrera y índices que fallan en silencio
- El código hace "¿existe? → guardar". Si llegan dos peticiones a la vez, las dos pasan la revisión; el índice único
  rechaza una con `DuplicateKeyException`, que termina como 400 con el texto interno de MongoDB.
- `MongoIndexConfig.safe()` ignora los errores al crear índices: si ya hay duplicados en la base, el índice único
  **no se crea** y nadie se entera (solo un aviso en el log).
- Las conexiones tienen índice único en `(userId, connectedUserId)` pero no en sentido contrario: A→B y B→A pueden
  existir a la vez.
- **Arreglo:** manejar `DuplicateKeyException` como 409, guardar el par de conexión ordenado (el ID menor primero) y
  revisar al arrancar que los índices únicos existan.

#### M13. Estadísticas abiertas e inventadas
- `/users/{id}/statistics` y `/companies/{id}/statistics` los ve cualquier sesión. `/applications/job/{id}/count`, cualquier
  empresa.
- `profileViews` no se mide: es una fórmula (`50 + postulaciones × 5 + días × 2`). Mostrar "vistas de perfil" que no
  existen es engañoso.
- **Arreglo:** solo el dueño o ADMIN; y quitar `profileViews` o medirlo de verdad.

### Bajos

- **B1. El JWT también va en el cuerpo de la respuesta** del login y el registro (`AuthResponse.token`). El frontend
  no lo usa (usa la cookie `httpOnly`); en el cuerpo solo sirve para que un script malicioso lo robe. Quitarlo.
- **B2. Logs ruidosos:** cada pase vencido o inválido imprime la traza completa a nivel ERROR (`JwtTokenProvider.validateToken`).
  `JwtAuthenticationEntryPoint` usa `sendError`, así que el 401 no trae el JSON `{"message": ...}` del resto de la API.
- **B3. Contraseñas:** al cambiarla se aceptan 6 caracteres (pendientes 3.1); no hay máximo (BCrypt solo usa los
  primeros 72 bytes y una contraseña de 1 MB gasta CPU); no se rechazan contraseñas muy comunes (`12345678`,
  `password`). BCrypt con costo 10 está bien.
- **B4. `sortBy` libre** en `/api/jobs`: se puede ordenar por cualquier campo; un nombre raro da un error interno.
  Aceptar solo una lista (`postedDate`, `salaryMax`, `title`).
- **B5. `DataSeeder`** crea 190 cuentas con la contraseña `password123` (pendientes 2.8). Nunca activarlo en producción;
  mejor que se niegue a correr fuera de local.
- **B6. Vacantes cerradas a la vista:** `/api/jobs/search` no filtra por `ABIERTA` y `/company/{id}` incluye las
  cerradas. Revisar qué espera el frontend antes de cambiarlo.
- **B7. Zona horaria** (pendientes 2.10): `TZ=America/Bogota`.

---

## 4. Datos personales y cumplimiento legal

### 4.1 Qué ley aplica

- **Colombia: Ley 1581 de 2012** (habeas data) y su reglamento (Decreto 1377 de 2013, hoy en el Decreto 1074 de 2015).
  SkillMatch trata datos de personas en Colombia, así que esta es **la que aplica**.
- **DSGVO / RGPD (Europa) y LOPDGDD (España):** aplican solo si SkillMatch **ofrece sus servicios a personas en la
  Unión Europea** o las monitorea. Una bolsa de empleo para Cartagena, en principio, no. Aun así, sus reglas son buena
  referencia y casi todas coinciden con la ley colombiana (consentimiento, finalidad, derechos de las personas, aviso
  de brechas). Si algún día se abre a Europa, habría que revisar: base legal, encargado de protección de datos,
  transferencias internacionales (MongoDB Atlas y Render guardan datos fuera de Colombia, y eso también importa en la
  Ley 1581) y aviso de brechas en **72 horas**.
- Lo legal de los formularios (qué datos pide la norma de empleo) ya está en `docs/REGISTRO-Y-MARCO-LEGAL.md`. Aquí va
  lo que le toca al backend.

### 4.2 Qué falta en el backend

| Requisito (Ley 1581) | Qué pide | Hoy | Qué hacer en el backend |
|---|---|---|---|
| Autorización previa, expresa e informada | Poder **probar** que la persona aceptó, cuándo y qué versión de la política | La casilla existe en el frontend, pero el backend **no guarda nada** | Guardar `consents: [{tipo, versión, fecha, ip}]` en el registro; rechazar el registro sin aceptación |
| Finalidad | Usar los datos solo para lo informado | Estadísticas inventadas; correos públicos de empresas | Quitar lo que no se informa (A5, M13) |
| Derecho a **conocer** | La persona puede pedir sus datos | No hay forma | `GET /api/users/me/export`: todo lo suyo en JSON |
| Derecho a **actualizar y rectificar** | Corregir datos | Sí (editar perfil) | Bien; falta poder corregir el correo con verificación |
| Derecho a **suprimir** y **revocar** | Borrar la cuenta y retirar la autorización | No hay forma de borrar la cuenta | `DELETE /api/users/me` con contraseña (ver 4.4) |
| Seguridad | Medidas para evitar acceso no autorizado | Fallos C1–C4, A5 | Fases 1 a 5 |
| Menores de edad | Interés superior; para trabajar, autorización | No se pregunta la edad | Declaración de mayoría de edad en el registro (decisión pendiente en el doc de registro) |
| Datos sensibles | Siempre opcionales y con autorización aparte | No se piden | Bien; si se agregan (discapacidad, etnia), autorización separada |

### 4.3 Datos de candidatos y de empresas

- **Candidatos:** al postularse, la empresa recibe nombre, correo, teléfono, ciudad, hoja de vida y carta. Es la
  finalidad del servicio y debe decirse en la política. El problema son las fugas (C2, C3) y que **nunca se borra
  nada**: una postulación de hace tres años sigue visible para la empresa.
- **Empresas y contactos:** si la empresa es persona natural, su correo y teléfono son datos personales. Hoy son
  públicos (A5). La persona que registra la empresa también es un titular de datos.
- **Mensajes:** son comunicaciones privadas. Solo los ven las dos partes (bien), pero no se borran nunca.

### 4.4 Tiempos de retención propuestos

La ley no fija plazos exactos: dice que los datos se guardan solo el tiempo **razonable y necesario** para la
finalidad (Decreto 1377, art. 11). Propuesta para discutir (y luego escribir en la política):

| Dato | Cuánto tiempo | Cómo se borra |
|---|---|---|
| Cuenta activa | Mientras la persona la use | — |
| Cuenta sin entrar | 24 meses; aviso por correo a los 23 | Tarea programada que la anonimiza |
| Cuenta borrada por la persona | Inmediato; 30 días en las copias de seguridad | `DELETE /api/users/me` + rotación de copias |
| Postulaciones | 12 meses después de cerrar la vacante | Tarea programada |
| Mensajes | Mientras exista alguna de las dos cuentas; si una se borra, sus mensajes quedan como "Usuario eliminado" | Al borrar cuenta |
| Notificaciones | 90 días | Índice TTL de MongoDB (se borran solas) |
| Lista negra de sesiones / intentos fallidos | Hasta que vence el pase / 24 horas | Índice TTL |
| Registros del servidor (logs) | Lo que guarde Render (pocos días en el plan gratis); no escribir contraseñas ni pases | — |
| Consentimientos | Mientras exista la cuenta + el tiempo de prescripción que diga el abogado | Se conservan como prueba |

**Al borrar una cuenta:** borrar perfil, habilidades, experiencias, postulaciones, vacantes guardadas, conexiones y
notificaciones; los mensajes enviados quedan sin nombre; si es empresa, cerrar sus vacantes y anonimizar la empresa.

---

## 5. Operación: incidentes, copias, secretos y brechas

Esto es más de proceso que de código. Se propone dejarlo escrito en `docs/OPERACION.md` (fase 11).

### 5.1 Respuesta ante incidentes
1. **Detectar:** revisar los logs de Render; alertas básicas (muchos 401 o 429 seguidos, errores 500).
2. **Contener:** según el caso, rotar `JWT_SECRET` (cierra todas las sesiones), cambiar la contraseña de MongoDB,
   desactivar cuentas, o suspender el servicio en Render.
3. **Evaluar:** qué datos, de cuántas personas, desde cuándo. Por eso conviene el registro de auditoría (M9).
4. **Avisar** (ver 5.4).
5. **Corregir y escribir qué pasó** (sin culpar a nadie): causa, arreglo y cómo evitar que se repita.

### 5.2 Copias de seguridad y restauración
- El plan gratis de MongoDB Atlas (M0) **no incluye copias automáticas** (confirmarlo en el panel de Atlas). Hoy, si se
  borra la base, se pierde todo.
- **Propuesta gratis:** un script `mongodump` semanal, cifrado (con `age` o `gpg`), guardado **fuera** del repositorio
  y de GitHub (las copias tienen datos personales). Guardar 4 semanales y 3 mensuales.
- **Probar la restauración** una vez al mes en una base local: una copia que nunca se probó no es una copia.

### 5.3 Rotación de secretos
| Secreto | Cuándo rotarlo | Efecto |
|---|---|---|
| `JWT_SECRET` | Cada 6 meses o si se filtra | Hoy cierra todas las sesiones. Mejora: aceptar la clave anterior unos días ("kid" en el pase) |
| Contraseña de MongoDB | **Ya** si no se hizo (pendientes 1.3: se filtró en un chat) y luego cada 6 meses | Actualizar `MONGODB_URI` en Render y en los `.env` |
| Secreto de Google (fase 10) y del correo (fase 8) | Cada 6 meses o si se filtra | Actualizar en Render |

Opcional y gratis: revisar el repositorio con `gitleaks` para detectar secretos subidos por error.

### 5.4 Notificación de brechas
- **Colombia:** la Ley 1581 obliga a informar a la Superintendencia de Industria y Comercio (SIC) cuando se violen los
  códigos de seguridad y haya riesgos para los datos (art. 17 y 18). La SIC pide reportarlo en el Registro Nacional de
  Bases de Datos dentro de los **15 días hábiles** siguientes a detectarlo (para quien esté obligado a inscribirse;
  verificar con el abogado si SkillMatch lo está). También hay que avisar a las personas afectadas.
- **Europa (solo si aplicara):** 72 horas a la autoridad.
- Dejar una plantilla de aviso lista en `docs/OPERACION.md`.

---

## 6. Funciones nuevas pedidas

Las tres respetan la regla "nada de pago" y la CSP (ningún script externo en el frontend).

### 6.1 Entrar con Google
- **Cómo:** el flujo "OAuth2" del lado del servidor, con `spring-boot-starter-oauth2-client` (gratis, de Spring).
  1. El botón "Continuar con Google" es un **enlace normal** a `/oauth2/authorization/google`. No se carga ningún
     script de Google, así que la CSP no cambia.
  2. Google pide permiso a la persona y vuelve a `/login/oauth2/code/google`.
  3. El backend recibe nombre, correo (Google dice si está verificado) y foto; busca la cuenta o la crea; entrega la
     misma cookie `auth_token` de siempre y redirige al panel.
- **Necesita de ti:** un proyecto en Google Cloud (gratis), la pantalla de consentimiento y las credenciales
  (`GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` como variables en Render, nunca en el código).
- **Decisiones pendientes:**
  - Si ya existe una cuenta con ese correo y contraseña, ¿se unen? (Propuesta: sí, solo si Google dice que el correo
    está verificado.)
  - Una cuenta nueva con Google, ¿es persona o empresa? (Propuesta: preguntar después, en una pantalla corta.)
  - ¿Pueden las empresas entrar con Google? (Propuesta: sí, pero igual pasan por la verificación de empresa.)

### 6.2 Número de teléfono
- **Validar y normalizar** (gratis): guardar en formato internacional E.164 (`+573001234567`) con
  `libphonenumber` (librería de Google, licencia Apache, va en el backend). Aceptar celulares y fijos de Colombia y,
  si se quiere, de otros países.
- **Entrar con el teléfono** en vez del correo (gratis): el login acepta correo **o** teléfono + contraseña.
  Requiere que el teléfono sea único (índice único).
- **Verificar que el número es de quien se registra** (código por SMS o WhatsApp): **cuesta dinero** en todos los
  proveedores (Twilio, Firebase en volumen, WhatsApp Business). Choca con la regla "nada de pago".
- **Decisión pendiente:** ¿teléfono como dato validado, como forma de entrar sin código, o con código (de pago)?
  Sin código, cualquiera podría registrar el número de otra persona.

### 6.3 Correos válidos
1. **Normalizar:** quitar espacios y pasar a minúsculas al registrarse, al entrar y al buscar (arregla A8). Migrar las
   cuentas existentes y detectar duplicados antes.
2. **Formato estricto:** exigir dominio con punto (`ana@localhost` no), máximo 254 caracteres.
3. **El dominio existe:** consultar en DNS si el dominio recibe correo (registro MX), con caché y tiempo límite. Gratis,
   sin librerías.
4. **Bloquear correos desechables** (`mailinator.com`, `10minutemail`...) con una lista guardada en el repositorio.
5. **Verificar el correo** con un enlace: es lo único que prueba que el correo es de quien se registra. Además permite
   "Olvidé mi contraseña", que **hoy no existe**.
   - Para enviar correos hace falta un servidor SMTP. Opciones gratis con límite diario: una cuenta de Gmail con
     "contraseña de aplicación" (~500 al día) o el plan gratis de Brevo (300 al día).
   - **Decisión pendiente:** cuál usar, y si una cuenta sin verificar puede postularse o publicar vacantes.

---

## 7. Plan por fases

Cada fase es un conjunto pequeño de commits en esta rama, con pruebas automáticas. Antes de cada fase se explica cada
cambio y se espera tu confirmación (regla 2 y 3 de `CLAUDE.md`). Varias fases tocan `SecurityConfig.java`; en cada
una se explica por qué.

| Fase | Qué arregla | Toca `SecurityConfig` | ¿Necesita algo de ti? |
|---|---|---|---|
| **0** | Este informe | No | Leerlo |
| **1. Fugas de datos** | C1, C2, C3, A5, M7, A7 (experiencias), `@JsonIgnore` en `password` | No | No |
| **2. Vacantes y roles** | C4, A1 (roles y cuenta desactivada desde la base), M9 (ADMIN modera), M13 | No | No |
| **3. Sesión y configuración segura** | A2, A3 (`tokenVersion`), B1, M1 (CORS), M2 (cookie), M10 (Swagger), M11 (cabeceras), B2 | **Sí** | Revisar variables en Render |
| **4. Fuerza bruta y enumeración** | A4 (IP real + bloqueo por cuenta), M4 | Sí (filtro) | No |
| **5. Validación de entradas** | A6, M5, M6, M3, M12, B3, B4, A8 (normalizar correos + migración) | No | Confirmar orígenes de imágenes con el frontend |
| **6. Mensajes y conexiones** | M8, conexión rechazada (pendientes 2.4) | No | Decidir si se puede escribir sin conexión |
| **7. Datos personales** | Consentimiento, exportar datos, borrar cuenta, retención (TTL, tareas) | No | Aprobar los plazos de 4.4 |
| **8. Correos válidos** | 6.3 + "Olvidé mi contraseña" | Sí (rutas públicas nuevas) | Elegir SMTP |
| **9. Teléfono** | 6.2 | No | Decidir el alcance |
| **10. Google** | 6.1 | Sí | Credenciales de Google Cloud |
| **11. Operación** | `docs/OPERACION.md`: incidentes, copias, rotación, brechas; script de copia | No | Probar la restauración |

### Cómo se prueba cada fase
- **Pruebas automáticas** (`backend/src/test/`): por cada hallazgo, una prueba que **falla hoy** y pasa después del
  arreglo (por ejemplo: "una empresa no puede leer la postulación de otra"). Las pruebas actuales necesitan MongoDB en
  `localhost:27017` (`src/test/resources/application.properties`).
- **Compilación:** `cd backend && ./mvnw -q -DskipTests package` antes de cada commit (regla 4 de `CLAUDE.md`).
- **A mano:** las tablas de la sección 2 sirven de lista de comprobación con Postman o `curl` contra el servidor local.
