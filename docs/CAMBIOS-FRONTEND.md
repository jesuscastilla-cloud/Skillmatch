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
