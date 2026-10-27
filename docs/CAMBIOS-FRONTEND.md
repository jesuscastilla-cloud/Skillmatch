# Cambios pendientes en el frontend

Lo que el backend ya tiene listo (o casi) y que el frontend todavía no usa. Cada punto dice **qué endpoint**,
**en qué archivo** y **qué mostrar**, para que al hacerlo solo haya que ir y aplicarlo.

Viene de la auditoría del backend (`docs/AUDITORIA-BACKEND.md`), rama `backend/auditoria-seguridad`.
Las rutas de archivo son relativas a `SkillMatch/src/`.

Estado: ⬜ pendiente · ✅ hecho

---

## De las fases 3 a 6

### ⬜ F1. Mostrar el motivo cuando un mensaje no se envía (fase 6)
- **Backend:** `POST /api/messages` responde **403** "No puedes enviar mensajes a esta persona" (bloqueo) y **429**
  "Estás enviando muchos mensajes seguidos..." (límite por cuenta).
- **Dónde:** `assets/js/mensajes.js`, función `sendMessage()` (línea ~493): hoy hace
  `if (!response.ok) throw new Error('Error al enviar mensaje')` y descarta el texto del servidor.
- **Qué hacer:** leer `(await response.json()).message` y mostrarlo; si es 429, no borrar lo que la persona escribió.

### ⬜ F2. Botón "Bloquear" (fase 6)
- **Backend:** `PATCH /api/connections/{connectionId}/block` ya existe y ahora sí impide los mensajes en los dos
  sentidos. Necesita el `id` de la conexión (lo traen `/api/connections/my-connections` y `/pending-requests`).
- **Dónde:** `assets/js/conexiones.js` (tarjeta de cada conexión) y, si se quiere, el menú de la conversación en
  `assets/js/mensajes.js`.
- **Qué hacer:** botón con confirmación ("No podrán escribirse ni enviarse solicitudes"). Hoy no hay forma de
  desbloquear: si se quiere, hace falta un endpoint nuevo (avisar antes de hacerlo).

### ⬜ F3. Fechas de experiencia y estudios (visto en la fase 3)
- **Qué pasa:** una experiencia sin fecha de fin sale "dic 1969", y `2025-01-01` se ve "dic 2024".
- **Dónde:** `assets/js/profile.js` línea ~594-595 (experiencias) y ~732 (estudios):
  `new Date(exp.endDate)` con `endDate` nulo da 1970, y `new Date("2025-01-01")` se lee en UTC (5 horas antes en
  Colombia, o sea el día anterior).
- **Qué hacer:** si no hay fecha de fin, mostrar "Actualidad" o nada; para mostrar, leer la fecha como local:
  `new Date(exp.startDate + 'T00:00:00')`. Revisar también `hoja-de-vida.js` si usa lo mismo.

### ⬜ F4. Token solo en la cookie (B1, fase 3)
- **Qué pasa:** el token se guarda en `localStorage` y va en `Authorization: Bearer`. Si alguna vez se cuela un
  script ajeno (XSS), puede leerlo. La cookie `auth_token` es `httpOnly`: ningún script la puede leer.
- **Dónde:** `assets/js/api-config.js` (`saveToken`, `fetchWithAuth`, `logout`), `assets/js/auth.js:42`,
  `assets/js/registro-usuario.js:109`, `assets/js/registro-empresa.js:105`, `assets/js/ui.js` (cambio de
  contraseña, `saveToken(cuerpo.token)`).
- **Qué hacer:** dejar de guardar y enviar el token; confiar en la cookie (`credentials: 'include'` ya está).
  Ojo en local: la página en `127.0.0.1:5500` y la API en `localhost:8080` son sitios distintos y la cookie no viaja;
  usar `localhost:5500` en el navegador. Cuando esté, avisar para quitar `token` de la respuesta del backend.

### ⬜ F5. Eliminar conversación de una vez (fase 6, pendientes 2.11)
- **Qué pasa:** "Eliminar conversación" baja la conversación y borra mensaje por mensaje; el backend ahora devuelve
  como máximo los 1000 más recientes, así que en una conversación más larga quedarían los viejos.
- **Backend:** falta `DELETE /api/messages/conversation/{otherUserId}` (no existe todavía; pedirlo cuando se haga
  esto). **Dónde:** `assets/js/mensajes.js` línea ~626.

---

## De la fase 7 (datos personales)

### ⬜ F6. Enviar las casillas del registro (consentimiento)
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

### ⬜ F7. Botón "Descargar mis datos"
- **Backend:** `GET /api/users/me/export` (con sesión) devuelve un JSON con todo lo de la persona: perfil,
  habilidades, experiencia, estudios, certificaciones, consentimientos, postulaciones, vacantes guardadas, conexiones,
  mensajes, notificaciones y, si es empresa, la empresa. Trae `Content-Disposition: attachment;
  filename="mis-datos-skillmatch.json"`.
- **Dónde:** en "Mi perfil" (`pages/perfil-usuario.html`, menú "Más" junto a "Cambiar contraseña", `assets/js/profile.js`)
  y en "Mi empresa" (`pages/perfil-empresa.html`, `assets/js/perfil-empresa.js`). Enlazarlo también desde
  `pages/politica-datos.html`, en la parte de los derechos.
- **Qué hacer:** `fetchWithAuth('/users/me/export')`, convertir la respuesta en `Blob` y descargarla con un `<a download>`
  (un enlace directo no manda el token mientras exista F4).

### ⬜ F8. Botón "Eliminar mi cuenta"
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

### ⬜ F9. Actualizar la política de datos (`pages/politica-datos.html`)
Lo que hace el backend ahora y la política todavía no dice. Al cambiarla, subir la versión ("Versión 0.1") aquí y en
Render (`PRIVACIDAD_VERSION_POLITICA`); si cambia **para qué** se usan los datos, hay que pedir de nuevo la autorización.
- **Sección 7 (Cómo ejercer tus derechos):** agregar que desde el perfil se puede **descargar todos tus datos** (F7)
  y **eliminar tu cuenta** (F8). Completar "[correo por completar]".
- **Sección 9 (Cuánto tiempo los guardamos):** hoy dice "Mientras tengas tu cuenta". Agregar los plazos aprobados:
  - notificaciones: 90 días;
  - postulaciones: 12 meses después de que se cierra la vacante;
  - cuentas sin entrar en 24 meses: se borran, avisando antes por correo (se activa con la fase 8);
  - al eliminar la cuenta se borran también los mensajes enviados y recibidos.
- **Sección 2 (Qué datos guardamos):** agregar la fecha de la última entrada y la prueba de la autorización
  (qué aceptaste, versión de la política y fecha).

---

## De la fase 8 (correo)

### ⬜ F11. "¿Olvidaste tu contraseña?"
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
- **Probar en local sin Brevo:** con `start.ps1` el código sale escrito en la consola del backend.
