# Cambios pendientes en el frontend

Lo que el backend ya tiene listo (o casi) y que el frontend todavía no usa. Cada punto dice **qué endpoint**,
**en qué archivo** y **qué mostrar**, para que al hacerlo solo haya que ir y aplicarlo.

Viene de la auditoría del backend (`docs/AUDITORIA-BACKEND.md`), rama `backend/auditoria-seguridad`.
Las rutas de archivo son relativas a `SkillMatch/src/`.

Estado: ⬜ pendiente · ✅ hecho

---

## De las fases 3 a 6

### ✅ F1. Mostrar el motivo cuando un mensaje no se envía (fase 6)
- **Hecho:** `sendMessage()` muestra el `message` del servidor (403, 429...) y no borra lo escrito.
- **Backend:** `POST /api/messages` responde **403** "No puedes enviar mensajes a esta persona" (bloqueo) y **429**
  "Estás enviando muchos mensajes seguidos..." (límite por cuenta).
- **Dónde:** `assets/js/mensajes.js`, función `sendMessage()` (línea ~493): hoy hace
  `if (!response.ok) throw new Error('Error al enviar mensaje')` y descarta el texto del servidor.
- **Qué hacer:** leer `(await response.json()).message` y mostrarlo; si es 429, no borrar lo que la persona escribió.

### ✅ F2. Botón "Bloquear" (fase 6)
- **Hecho:** botón en cada tarjeta de "Mis conexiones" (`conexiones.js`, `bloquearConexion`) con confirmación que
  avisa que no se puede deshacer. **Pendiente:** desbloquear (el backend no guarda quién bloqueó: hace falta
  `blockedBy` en `Connection` y un endpoint nuevo).
- **Backend:** `PATCH /api/connections/{connectionId}/block` ya existe y ahora sí impide los mensajes en los dos
  sentidos. Necesita el `id` de la conexión (lo traen `/api/connections/my-connections` y `/pending-requests`).
- **Dónde:** `assets/js/conexiones.js` (tarjeta de cada conexión) y, si se quiere, el menú de la conversación en
  `assets/js/mensajes.js`.
- **Qué hacer:** botón con confirmación ("No podrán escribirse ni enviarse solicitudes"). Hoy no hay forma de
  desbloquear: si se quiere, hace falta un endpoint nuevo (avisar antes de hacerlo).

### ✅ F3. Fechas de experiencia y estudios (visto en la fase 3)
- **Hecho:** `mesAnio()` y `periodoFechas()` en `profile.js` leen el mes tal cual; sin fin, "Actualidad".
  `hoja-de-vida.js` ya lo hacía bien.
- **Qué pasa:** una experiencia sin fecha de fin sale "dic 1969", y `2025-01-01` se ve "dic 2024".
- **Dónde:** `assets/js/profile.js` línea ~594-595 (experiencias) y ~732 (estudios):
  `new Date(exp.endDate)` con `endDate` nulo da 1970, y `new Date("2025-01-01")` se lee en UTC (5 horas antes en
  Colombia, o sea el día anterior).
- **Qué hacer:** si no hay fecha de fin, mostrar "Actualidad" o nada; para mostrar, leer la fecha como local:
  `new Date(exp.startDate + 'T00:00:00')`. Revisar también `hoja-de-vida.js` si usa lo mismo.

### ✅ F4. Token solo en la cookie (B1, fase 3)
- **Hecho:** el token ya no se guarda ni se envía en `Authorization`. `api-config.js` guarda solo cuándo vence la
  sesión (`skillmatch_sesion_vence`, con `guardarSesion(expiresAt)` / `haySesion()`) y convierte las sesiones
  viejas al cargar. En local la API usa el mismo nombre que la página (`127.0.0.1` o `localhost`). El cambio de
  contraseña ahora también devuelve `expiresAt`. Las pruebas (API falsa) usan la cookie.
  **Siguiente paso (backend):** quitar `token` de las respuestas de login, registro, Google y contraseña, y dejar de
  aceptar `Authorization: Bearer` si ningún otro cliente lo usa.
- **Qué pasa:** el token se guarda en `localStorage` y va en `Authorization: Bearer`. Si alguna vez se cuela un
  script ajeno (XSS), puede leerlo. La cookie `auth_token` es `httpOnly`: ningún script la puede leer.
- **Dónde:** `assets/js/api-config.js` (`saveToken`, `fetchWithAuth`, `logout`), `assets/js/auth.js:42`,
  `assets/js/registro-usuario.js:109`, `assets/js/registro-empresa.js:105`, `assets/js/ui.js` (cambio de
  contraseña, `saveToken(cuerpo.token)`).
- **Qué hacer:** dejar de guardar y enviar el token; confiar en la cookie (`credentials: 'include'` ya está).
  Ojo en local: la página en `127.0.0.1:5500` y la API en `localhost:8080` son sitios distintos y la cookie no viaja;
  usar `localhost:5500` en el navegador. Cuando esté, avisar para quitar `token` de la respuesta del backend.

### ✅ F5. Eliminar conversación de una vez (fase 6, pendientes 2.11)
- **Hecho:** backend `DELETE /api/messages/conversation/{otherUserId}` (`MessageService.deleteConversation`, con
  pruebas) y `mensajes.js` la usa.
- **Qué pasa:** "Eliminar conversación" baja la conversación y borra mensaje por mensaje; el backend ahora devuelve
  como máximo los 1000 más recientes, así que en una conversación más larga quedarían los viejos.
- **Backend:** falta `DELETE /api/messages/conversation/{otherUserId}` (no existe todavía; pedirlo cuando se haga
  esto). **Dónde:** `assets/js/mensajes.js` línea ~626.

---

## De la fase 7 (datos personales)

### ✅ F6. Enviar las casillas del registro (consentimiento)
- **Hecho:** los dos registros envían `aceptaPolitica` (y `mayorDeEdad` las personas). Además, arriba de cada
  registro va "Crear mi perfil con Google" / "Registrar mi empresa con Google" con el aviso de autorización al lado
  (`acepta=1&mayor=1`, `tipo=EMPRESA&acepta=1`). **Falta en Render:** `PRIVACIDAD_EXIGIR_CONSENTIMIENTO=true`.
- **Backend:** `POST /api/auth/register` acepta `aceptaPolitica` (true/false) y, para personas, `mayorDeEdad`.
  Guarda la prueba (qué se aceptó, versión de la política y fecha) en `User.consentimientos`.
- **Dónde:**
  - `assets/js/registro-usuario.js` línea ~88, dentro del `JSON.stringify({...})`:
    `aceptaPolitica: document.getElementById('usuario-terminos').checked,`
    `mayorDeEdad: document.getElementById('usuario-mayor').checked,`
  - `assets/js/registro-empresa.js`, en el cuerpo del registro:
    `aceptaPolitica: document.getElementById('empresa-terminos').checked,`
- **Después de publicarlo:** en Render, agregar `PRIVACIDAD_EXIGIR_CONSENTIMIENTO=true`. Desde ahí, registrarse sin
  aceptar es imposible (hoy el backend no lo exige para no romper el registro actual).
- **Si cambia la política:** subir la versión en `pages/politica-datos.html` ("Versión 0.1") **y** en Render
  (`PRIVACIDAD_VERSION_POLITICA`).

### ✅ F7. Botón "Descargar mis datos"
- **Hecho:** `SkillMatchUI.descargarMisDatos()` en `ui.js` (Blob + `<a download>`), en el menú "Más" de Mi perfil y
  de Mi empresa (que ahora tiene ese menú, con "Cambiar contraseña"). La política (sección 7) lo explica.
- **Backend:** `GET /api/users/me/export` (con sesión) devuelve un JSON con todo lo de la persona: perfil,
  habilidades, experiencia, estudios, certificaciones, consentimientos, postulaciones, vacantes guardadas, conexiones,
  mensajes, notificaciones y, si es empresa, la empresa. Trae `Content-Disposition: attachment;
  filename="mis-datos-skillmatch.json"`.
- **Dónde:** en "Mi perfil" (`pages/perfil-usuario.html`, menú "Más" junto a "Cambiar contraseña", `assets/js/profile.js`)
  y en "Mi empresa" (`pages/perfil-empresa.html`, `assets/js/perfil-empresa.js`). Enlazarlo también desde
  `pages/politica-datos.html`, en la parte de los derechos.
- **Qué hacer:** `fetchWithAuth('/users/me/export')`, convertir la respuesta en `Blob` y descargarla con un `<a download>`
  (un enlace directo no manda el token mientras exista F4).

### ✅ F8. Botón "Eliminar mi cuenta"
- **Hecho:** `SkillMatchUI.eliminarCuenta()` en `ui.js`: ventana con lo que se borra (distinto para personas y
  empresas), "Descargar mis datos" antes, la contraseña con el ojo y el botón rojo; tras el 200, `limpiarSesion()`
  y vuelta a `index.html` con el aviso. Mismo menú "Más" que F7. Las cuentas creadas con Google reciben el mensaje
  del backend que pide crear una contraseña con "¿Olvidaste tu contraseña?".
- **Backend:** `DELETE /api/users/me` con cuerpo `{"password": "<contraseña actual>"}`.
  - 200 `{"message": "Tu cuenta y tus datos fueron eliminados"}` y borra la cookie de sesión.
  - 400 `{"message": "La contraseña no es correcta"}`; 429 tras 5 intentos fallidos (mismo bloqueo que el login).
  - Borra postulaciones, vacantes guardadas, conexiones, **todos** los mensajes (enviados y recibidos) y
    notificaciones. Si es empresa, cierra sus vacantes y la empresa queda como "Empresa eliminada".
- **Dónde:** "Mi perfil" (`assets/js/profile.js`, menú "Más", junto a "Cambiar contraseña" que vive en
  `assets/js/ui.js`) y "Mi empresa" (`assets/js/perfil-empresa.js`). Se puede copiar la ventana de cambio de
  contraseña de `ui.js` (línea ~2270): mismo campo de contraseña con el ojo.
- **Qué mostrar antes:** que es definitivo y qué se borra (incluidas las conversaciones de la otra persona con ella),
  y ofrecer primero "Descargar mis datos" (F7). Después del 200: `limpiarSesion()` y volver a `index.html`.
- **Enlazarlo** desde `pages/politica-datos.html`, en la parte de los derechos (suprimir).

### ✅ F9. Actualizar la política de datos (`pages/politica-datos.html`)
- **Hecho (versión 0.2):** correo de contacto `skillmatchproject@gmail.com`, datos de Google, última entrada y
  prueba de la autorización, Gmail y Google como servicios, copias cifradas y los plazos de retención.
  **Falta:** los datos del responsable (`[por completar]`), la revisión con un abogado y, cuando existan F7 y F8,
  decir en la sección 7 que se hacen desde el perfil (hecho con F7/F8: versión 0.3).
  **En Render:** `PRIVACIDAD_VERSION_POLITICA=0.3`.
Lo que hace el backend ahora y la política todavía no dice. Al cambiarla, subir la versión ("Versión 0.1") aquí y en
Render (`PRIVACIDAD_VERSION_POLITICA`); si cambia **para qué** se usan los datos, hay que pedir de nuevo la autorización.
- **Sección 7 (Cómo ejercer tus derechos):** agregar que desde el perfil se puede **descargar todos tus datos** (F7)
  y **eliminar tu cuenta** (F8). Completar "[correo por completar]".
- **Sección 9 (Cuánto tiempo los guardamos):** hoy dice "Mientras tengas tu cuenta". Agregar los plazos aprobados:
  - notificaciones: 90 días;
  - postulaciones: 12 meses después de que se cierra la vacante;
  - cuentas sin entrar en 24 meses: a los 23 llega un correo de aviso; si no entra en 30 días, se borran
    (activo desde la fase 8, solo con el correo configurado; las cuentas ADMIN no se borran);
  - al eliminar la cuenta se borran también los mensajes enviados y recibidos.
- **Sección 2 (Qué datos guardamos):** agregar la fecha de la última entrada y la prueba de la autorización
  (qué aceptaste, versión de la política y fecha).

---

## De la fase 8 (correo)

### ✅ F11. "¿Olvidaste tu contraseña?"
- **Hecho:** enlace bajo la contraseña en los tres login; página `pages/recuperar.html` con `assets/js/recuperar.js`
  (paso 1 correo, paso 2 código + contraseña nueva, "Pedir otro código" al minuto, "Usar otro correo"). Al
  cambiarla se borra la sesión guardada en el navegador. De paso se arregló el backend: una cookie con un token
  que ya no vale (por ejemplo tras recuperar la contraseña) bloqueaba TODO el sitio con 401; ahora se ignora y
  se borra (`JwtAuthenticationFilter`).
- **Backend:**
  1. `POST /api/auth/forgot-password` `{"email"}` → siempre 200 con
     "Si ese correo tiene una cuenta en SkillMatch, te enviamos un código..." (no revela si existe la cuenta).
  2. `POST /api/auth/reset-password` `{"email", "codigo" (6 números), "newPassword"}` →
     200 "Listo: tu contraseña quedó cambiada. Ya puedes iniciar sesión." o 400 con el motivo
     ("El código no es correcto o ya venció", contraseña común, menos de 8...). Cierra todas las sesiones abiertas.
  - El código vence en 15 minutos, admite 5 intentos y se puede pedir otro cada minuto.
  - Las dos rutas tienen el límite por IP (429).
- **Dónde:** enlace "¿Olvidaste tu contraseña?" en `pages/login-usuario.html`, `pages/login-empresa.html` y
  `pages/login.html`; página nueva (p. ej. `pages/recuperar-clave.html` con su `assets/js/recuperar-clave.js`) con dos
  pasos: correo → código + contraseña nueva (reusar `UI.claveNueva` de `ui.js`, el medidor de contraseña).
- **Probar en local sin correo configurado:** con `start.ps1` el código sale escrito en la consola del backend.

### ✅ F10. Registro con código (sin cuentas a medias)
- **Hecho:** `assets/js/registro-codigo.js` (compartido) muestra el paso del código cuando el registro responde 202:
  campo de 6 números, "Pedir otro código" (cada 60 s) y "Corregir mis datos". `registro-usuario.js` y
  `registro-empresa.js` llevan lo de después del registro a `terminar(datos)`, que se llama con el 200 de hoy o con el
  200 de `/register/verify`. Falta: poner `REGISTRO_VERIFICAR_CORREO=true` en Render.
- **Backend (con `REGISTRO_VERIFICAR_CORREO=true`):**
  1. `POST /api/auth/register` (mismos campos de hoy, más F6) → **202** `{"message": "Te enviamos un código de 6
     números..."}`. **No** crea la cuenta ni abre sesión. Responde igual si el correo ya tenía cuenta (al dueño le
     llega un aviso), así que la pantalla siempre pasa al paso del código.
  2. `POST /api/auth/register/verify` `{"email", "codigo"}` → **200** con la misma respuesta del registro de hoy
     (`token`, `id`, `companyId`, `role`...) y la cookie de sesión. 400 si el código no es correcto o venció.
  3. `POST /api/auth/register/resend` `{"email"}` → otro código (uno por minuto; responde siempre lo mismo).
- **Dónde:** `assets/js/registro-usuario.js` (línea ~88) y `assets/js/registro-empresa.js`: si la respuesta del
  registro es 202, mostrar el paso "Escribe el código que te enviamos a <correo>" (un campo de 6 números,
  `inputmode="numeric"`, botón "Reenviar código"); al confirmar, hacer lo mismo que hoy tras un registro exitoso
  (`saveToken`, `saveUserData`, redirigir). Si es 200 (backend con el interruptor apagado), seguir como hoy.
  Así el mismo frontend sirve antes y después de activar el interruptor.
- **Después de publicarlo:** con el correo configurado (`MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM`; ya está), poner
  `REGISTRO_VERIFICAR_CORREO=true` en Render.

---

## De la fase 9 (teléfono)

### ⬜ F12. Entrar y registrarse con el celular
- **Solo cuando haya proveedor** (Twilio, de pago) y `TELEFONO_HABILITADO=true`. Antes de mostrar los botones,
  preguntar `GET /api/auth/phone/disponible` → `{"disponible": true|false}`; con `false`, no mostrarlos (las rutas
  responden 503).
- **Backend:**
  - Registro (solo personas): `POST /api/auth/phone/register` `{"phone", "password", "firstName", "lastName",
    "aceptaPolitica", "mayorDeEdad"}` → 202 y llega un código por SMS (o WhatsApp). Luego
    `POST /api/auth/phone/register/verify` `{"phone", "codigo"}` → 200 con la sesión (misma forma que el login;
    `email` viene `null`).
  - Entrar sin contraseña: `POST /api/auth/phone/code` `{"phone"}` → 200 (siempre igual) y
    `POST /api/auth/phone/login` `{"phone", "codigo"}` → 200 con la sesión. Solo para números ya verificados.
  - Agregar el número a una cuenta (con sesión): `POST /api/users/me/phone/code` `{"phone"}` y
    `POST /api/users/me/phone/verify` `{"phone", "codigo"}`.
  - El número se puede escribir como sea (`300 123 4567`, `+57...`); el backend lo devuelve como `+573001234567`.
- **Dónde:** pestaña "Con mi celular" en `pages/login-usuario.html` y `pages/registro-usuario.html` (empresas no:
  se registran con correo); en "Mi perfil", junto al teléfono, "Confirmar número" si `phoneVerified` no es `true`.
- **Mostrar el número bonito:** el backend guarda `+573001234567`; en pantalla conviene `+57 300 123 4567`.
  Revisar dónde se muestra `phone` (`profile.js`, `hoja-de-vida.js`, `perfil-empresa.js`).
- **Cuentas sin correo:** el frontend debe aguantar `email: null` (por ejemplo `ui.js` línea ~2282 hace
  `String(datos.email || '')`, bien; revisar los demás usos de `email` del usuario en sesión).

---

## De la fase 10 (Google)

### ✅ F13. Botón "Continuar con Google" (hecho en las páginas de login; en el registro va con F6)
- **Hecho:** botón en `login.html`, `login-usuario.html` y `login-empresa.html` (este con `data-tipo="EMPRESA"`),
  oculto si el servidor no tiene Google; icono `google` en `ui.js`; `auth.js` canjea `#google=` y muestra
  `#google-error=` (función compartida `completarEntrada`). Falta: el botón en los registros, junto con F6.
- **Antes de mostrarlo:** `GET /api/auth/google/disponible` → `{"disponible": true|false}`. Con `false` (sin
  credenciales de Google en el servidor), no mostrar el botón.
- **El botón es un enlace normal** (sin scripts de Google: la CSP los bloquea y no hacen falta):
  `<a class="btn-google" href="/oauth2/authorization/google">` con el icono de `ui.js` (agregar `google` si no
  existe). En local con Live Server, el `href` debe ir al backend: `http://localhost:8080/oauth2/authorization/google`
  (usar la base de `api-config.js` sin el `/api`).
  - En `login.html`, `login-usuario.html` y `login-empresa.html`: el enlace tal cual.
  - En `registro-usuario.html`: agregar `?acepta=1&mayor=1` **solo** si las casillas de F6 están marcadas (armar el
    enlace al hacer clic). En `registro-empresa.html`: `?tipo=EMPRESA&acepta=1`.
  - Con `PRIVACIDAD_EXIGIR_CONSENTIMIENTO=true`, una cuenta nueva sin esas casillas vuelve con
    `#google-error=consentimiento`: mandar a la persona al registro.
- **Al volver de Google** el backend redirige a `pages/login.html` (cambiable con `GOOGLE_PAGINA_RETORNO`) con:
  - `#google=<código>` → `POST /api/auth/google/canjear` `{"codigo"}` → 200 con lo mismo que el login (`token`,
    `id`, `companyId`, `role`...). Hacer lo mismo que `auth.js` tras un login exitoso (`saveToken`, `saveUserData`,
    redirigir). Borrar el `#` de la barra con `history.replaceState` antes de canjear. El código vence al minuto y
    sirve una sola vez (400 si no).
  - `#google-error=<motivo>` → mostrar con `SkillMatchUI.aviso`:
    - `cancelado`: "Cancelaste la entrada con Google."
    - `correo_no_verificado`: "Google no confirma ese correo. Verifícalo en Google o regístrate con tu correo."
    - `cuenta_desactivada`: "Esta cuenta está desactivada."
    - `consentimiento`: "Para crear tu cuenta, acepta la política de datos en el registro."
    - `error`: "No se pudo entrar con Google. Intenta de nuevo."
- **Cuentas sin contraseña:** quien se registró con Google no tiene contraseña. "Cambiar contraseña" y "Eliminar mi
  cuenta" (F8) responden 400 con el mensaje "Tu cuenta no tiene contraseña (entraste con Google). Crea una con
  ¿Olvidaste tu contraseña?..."; mostrarlo tal cual y ofrecer el enlace a F11.
- **"Descargar mis datos"** (F7) ahora trae `cuentaUnidaAGoogle: true|false`.

---

## Sesión única y validaciones

### ✅ F14. Una sola sesión por cuenta
- **Backend:** cada token anota su `jti` como la sesión activa de la cuenta (`User.sesionActiva`, `SesionUnicaService`).
  Entrar en otro dispositivo (correo, Google, teléfono, registro o cambio de contraseña) cierra la sesión anterior: el
  401 trae `{"motivo": "OTRA_SESION", "message": "Tu sesión se cerró porque entraste desde otro dispositivo..."}`.
  Las cuentas que no han vuelto a entrar desde el cambio conservan su sesión hasta que entren de nuevo.
- **Hecho:** `fetchWithAuth` (`api-config.js`) muestra ese aviso una vez y lleva al login.

### ✅ F15. Validación de nombres y datos
- **Backend:** clase `Nombres` (personas: letras, espacios, - y ', 2 a 50; empresas: también números y & . , ( ),
  hasta 100), en el registro (correo y teléfono) y al editar el perfil; los nombres de Google se ajustan. Fechas de
  experiencia y estudios coherentes, salario máximo ≥ mínimo, caracteres permitidos en habilidades y ciudades. Los
  errores de validación traen además `message` con el primer problema.
- **Hecho:** `Validar` en `api-config.js` (mismas reglas) en los registros y en el perfil (nombres, ciudad,
  habilidades, fechas); `maxlength` en los campos; los formularios con contraseña usan `method="post"` para que,
  si el JavaScript falla, la contraseña no quede en la dirección.

### ✅ F16. La empresa edita sus datos
- **Backend:** `PATCH /api/companies/{id}` (dueño o ADMIN): nombre, sector, tamaño (`micro|small|medium|large`),
  ciudad, sitio web, teléfono, año de fundación (0 lo quita) y beneficios. null no cambia; "" quita. Cambiar el
  nombre también cambia el de la cuenta. Correo, `isVerified` y `active` no se cambian aquí.
- **Hecho:** botón "Editar datos" en Mi empresa (`abrirDatosEmpresa` en `perfil-empresa.js`).

### ✅ F17. Cambiar el correo con un código
- **Backend:** `POST /api/users/me/email/code` `{"email"}` → código al correo nuevo (responde igual si ya tiene cuenta y
  a su dueño le llega un aviso); `POST /api/users/me/email/verify` `{"codigo"}` → cambia el correo (verificado),
  el de la empresa y avisa al correo anterior. `PUT /api/users/{id}` ya no cambia el correo (400 si llega otro).
- **Hecho:** `SkillMatchUI.cambiarCorreo()` en `ui.js`, en el menú "Más" de Mi perfil y de Mi empresa; en "Editar
  perfil" el correo es de solo lectura con el enlace a ese cambio.

### ✅ F18. El token ya no va en el cuerpo de las respuestas
- **Backend:** login, registro, Google, teléfono y cambio de contraseña ponen el token solo en la cookie httpOnly
  (`AuthResponse.token` con `@JsonIgnore`). El frontend ya usaba solo `expiresAt` (F4).
