# SkillMatch — instrucciones para Claude Code

Este archivo lo lee Claude Code al iniciar en este repositorio. Define cómo se trabaja aquí.

## Qué es el proyecto
SkillMatch: bolsa de empleo y networking para Cartagena (estudiantes ↔ empresas).
- Backend: Spring Boot 3.5 + Java 17 + MongoDB Atlas (carpeta `backend/`).
- Frontend: HTML + CSS + JavaScript puro, SIN frameworks (carpeta `SkillMatch/src/`).
- Despliegue: Render (plan Free) con el `Dockerfile` de la raíz, que mete el frontend dentro del jar.
- Render despliega automáticamente cada push a la rama `main`.

## El plan a seguir
El plan completo de mejoras está en `docs/PLAN-UI.md`. Síguelo al pie de la letra, fase por fase,
sin saltar ni reordenar fases. No inventes funcionalidades fuera del plan sin preguntar.

## Reglas de trabajo (obligatorias)
1. Trabaja SIEMPRE en una rama, nunca directamente en `main` (un error en main tumba el sitio en vivo).
2. Explica cada cambio en español, paso a paso, antes de aplicarlo. El dueño del proyecto aprende
   con explicaciones construidas desde cero y quiere confirmar que entendió cada pieza antes de avanzar.
3. Al terminar cada tarea, detente y espera confirmación antes de pasar a la siguiente.
4. Antes de cualquier commit, verifica:
   - `cd backend && ./mvnw -q -DskipTests package` compila sin errores (si se tocó Java).
   - `node --check` en cada archivo JS modificado.
   - Que ninguna página HTML quede con etiquetas sin cerrar.
5. Commits pequeños, con mensaje en español que diga qué cambió y por qué.
6. Nunca subas secretos: nada de `MONGODB_URI`, `JWT_SECRET` ni contraseñas en el código.

## Reglas técnicas del frontend
- **Nada de pago.** Ningún servicio, API ni librería de pago.
- **Librerías de terceros SIEMPRE guardadas dentro del proyecto** en `SkillMatch/src/assets/js/vendor/`,
  nunca enlazadas desde un CDN: la política CSP de `SecurityConfig.java` bloquea scripts externos.
  (Las fuentes de Google Fonts sí están permitidas.)
- Solo animar `transform` y `opacity` (rendimiento a 60 fps).
- Todo efecto que siga al mouse se desactiva en pantallas táctiles (`@media (hover: none)`)
  y con `prefers-reduced-motion: reduce`.
- Los estilos van en `assets/css/app.css` (sistema de diseño existente, respetar sus tokens `--*`).
- La capa de interfaz está en `assets/js/ui.js`: iconos SVG (`<i data-ico="nombre">`), avisos
  (`SkillMatchUI.aviso`), esqueletos de carga (`SkillMatchUI.skeletons`). Reutilizarla, no duplicarla.
- NO cambiar IDs ni clases que usan los módulos JS existentes (auth.js, oportunidades.js, profile.js,
  perfil-empresa.js, mensajes.js, conexiones.js, notifications.js, search-handler.js).
- Nada de emojis en la interfaz: usar los iconos de `ui.js`.

## Colores de marca (del logo)
- Azul marino (confianza) — base y textos.
- Turquesa (energía) — acciones principales.
- Naranja del logo (la chispa del match) — acento principal: matches altos, logros, acción decisiva.
  Sustituye al magenta `--buganvilla` que existe hoy en `app.css`.

## Backend
- No tocar `application.properties` ni `SecurityConfig.java` salvo que la tarea lo exija; si hay que
  hacerlo, explicar el motivo antes.
- Endpoints nuevos: permitir en `SecurityConfig` solo lo público estrictamente necesario.

## Cómo probar localmente
1. Backend: en `backend/`, definir `MONGODB_URI` y `JWT_SECRET` como variables de entorno y ejecutar
   `./mvnw spring-boot:run` (Windows: `.\mvnw.cmd spring-boot:run`). Salud: http://localhost:8080/api/health
2. Frontend: abrir `SkillMatch/src/pages/index.html` con Live Server de VS Code.
   `api-config.js` detecta localhost y apunta solo a http://localhost:8080/api.
