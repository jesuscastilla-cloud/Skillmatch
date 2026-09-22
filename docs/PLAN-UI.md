# Plan de mejoras premium de SkillMatch

Stack: HTML/CSS/JS puro + Spring Boot + MongoDB Atlas, desplegado gratis en Render. Nada de pago.

## Reglas técnicas
1. Librerías (GSAP, Lottie…) guardadas en `assets/js/vendor/`, no desde CDN (la CSP las bloquea).
2. Solo se animan `transform` y `opacity`.
3. Efectos de mouse apagados en táctil y con `prefers-reduced-motion`.

---

## FASE 1 — Identidad visual y movimiento global (secciones 1 y 3)

### 1. Identidad visual
- Recuperar el **naranja del logo** como acento real (botones de acción, matches altos, logros) en lugar del magenta.
- **Fondos con textura**: grano sutil y degradados *mesh* suaves con los tres colores de marca (portada y cabeceras). *(Stripe)*
- **Fotografía real de Cartagena y estudiantes** en WebP dentro de `assets/img` (muralla, Getsemaní, gente trabajando).
- **Ilustraciones SVG animadas propias** para estados vacíos, onboarding y errores.
- **Modo oscuro** completo con interruptor en la barra superior que recuerda la elección. *(Linear, GitHub)*

### 3. Movimiento global y el mouse
- **Cursor personalizado**: punto + anillo con retraso suave; crece sobre enlaces, dice "Ver" sobre tarjetas y "Arrastra" sobre carruseles. *(Awwwards)*
- **Foco de luz que sigue al mouse** dentro de las tarjetas, con el borde iluminado en esa zona. *(Linear, Vercel)*
- **Inclinación 3D** de 3–4° en tarjetas de vacante siguiendo al cursor.
- **Botones magnéticos** que se acercan levemente al cursor.
- **Ripple** al hacer clic desde el punto exacto. *(Material Design)*
- **Transiciones entre páginas** con la View Transitions API (la tarjeta se expande hasta su detalle).
- **Aparición escalonada de listas** (40 ms entre tarjetas).
- **Paleta de comandos Ctrl+K** para navegar, buscar vacantes y ejecutar acciones. *(Linear, Notion, Vercel)*
- **Tooltips animados** con contexto útil.

## FASE 2 — Portada premium y asistente Skilly (secciones 2 y 4)

### 2. Portada
- **Hero con gradiente vivo** que respira y reacciona al mouse. *(Stripe)*
- **Titular palabra por palabra** con palabra clave en bucle: "El trabajo / la práctica / el proyecto que buscas ya está en Cartagena".
- **Demo del match en vivo**: el visitante marca 3–4 habilidades y el anillo recalcula en tiempo real.
- **Scroll-telling tipo Apple**: sección *sticky* con 4 escenas (creas tu perfil → te comparamos → recibes el match → te contratan).
- **Historias de éxito** en carrusel infinito que se detiene con hover.
- **Cinta de logos** de empresas y universidades de Cartagena.
- **Contadores al entrar en pantalla** con datos reales de `/api/public/stats`.
- **Mapa SVG de Cartagena** con puntos que laten por barrio (Bocagrande, Manga, Mamonal, Centro).
- **Separadores en forma de ola** con desplazamiento lento.
- **Pie de página grande** con CTA final y logo con brillo al hover.

### 4. Asistente "Skilly"
- Burbuja flotante abajo a la derecha con personaje animado que saluda y parpadea.
- Opciones rápidas ("¿Cómo funciona el match?", "Busco prácticas", "Soy empresa", "¿Cómo mejoro mi perfil?") + texto libre.
- Ejecuta acciones: "prácticas de sistemas en Manga" consulta `/api/jobs` y muestra tarjetas dentro del chat.
- **Tour guiado** que resalta partes de la pantalla oscureciendo el resto. *(Notion, Duolingo)*
- Consejos según pantalla y perfil ("Te faltan 2 habilidades para llegar al 90%").
- Gratis: endpoint `/api/assistant` en Spring Boot que reconoce intención por palabras clave y consulta MongoDB.
- IA conversacional real: mejora opcional futura, siempre desde el backend (nunca exponer claves en el navegador).

## FASE 3 — Oportunidades (sección 6)
- Vista previa al hover con "Aplicar en 1 clic". *(Airbnb)*
- Panel lateral de detalle que se desliza desde la derecha. *(LinkedIn Jobs)*
- **"¿Por qué este match?"**: habilidades que coinciden (verde) y que faltan (naranja) con enlace para aprender.
- Filtros como chips animados con contador en vivo.
- Guardar con corazón animado. *(Airbnb)*
- Aplicar en un clic: enviando → éxito → aviso con "deshacer".
- Vista de mapa por barrio.
- Autocompletado de búsqueda (Atlas Search tiene versión en M0 con índices limitados; confirmar en el panel).
- Alertas guardadas ("Avísame cuando haya prácticas de Java en Cartagena").

## FASE 4 — Panel del estudiante, perfil-portafolio y gamificación (secciones 5, 7, 11, 12)

### 5. Registro y onboarding
- Asistente de 4 pasos con transición lateral y barra de progreso.
- Previsualización en vivo de la tarjeta de perfil mientras se llena.
- Selector de habilidades con etiquetas que rebotan y autocompletado.
- Microcopy que reduce ansiedad.
- Confeti sutil con colores de marca + primera insignia al terminar. *(Duolingo)*
- Medidor de contraseña animado.

### 7. Perfil como portafolio
- Portada propia o de galería de Cartagena con parallax.
- Anillo de completitud con tareas que se tachan animadas.
- Proyectos en galería visual con modal y carrusel. *(Behance, Dribbble)*
- Línea de tiempo que se dibuja al bajar.
- Habilidades con nivel visual e insignia "verificada".
- Portafolio público `/p/{slug}` sin login, con copiar enlace y QR.
- Descargar perfil como CV en PDF desde el navegador.
- "Quién vio tu perfil" con gráfico semanal.

### 11. Panel de inicio del estudiante (nuevo)
- Saludo según la hora.
- Resumen: matches nuevos, mensajes, entrevistas, postulaciones, con gráficos pequeños.
- Feed personalizado de vacantes, eventos y consejos.
- Estado de postulaciones como línea de progreso.

### 12. Gamificación
- Insignias (perfil completo, primera postulación, match >90%, 10 conexiones) con animación de desbloqueo. *(Duolingo)*
- Racha de actividad con llama que crece.
- Niveles: Explorador, Talento, Destacado.
- Retos de habilidad de 10 minutos → insignia "verificada".

## FASE 5 — Tiempo real, empresa, conexiones y PWA (secciones 8, 9, 10, 13, 14)

### 8. Empresa: pipeline
- Kanban de candidatos (Aplicó, En revisión, Entrevista, Oferta, Contratado) con arrastrar y soltar. *(Trello, Linear)*
- Evaluación rápida con estrellas por competencia.
- Plantillas de mensajes.
- Publicar vacante con vista previa en vivo.
- Mini-analítica por vacante con gráficos animados.
- Insignia de empresa verificada.
- Lista de pasos para empresas nuevas.

### 9. Mensajes y notificaciones en tiempo real
- WebSocket con `spring-boot-starter-websocket` (gratis, Render lo soporta).
- "Escribiendo…", doble check de leído, burbujas con rebote, reacciones.
- Campana que se sacude con contador animado; centro de notificaciones con pestañas.
- Programar entrevista con selector visual en el chat.

### 10. Conexiones
- Sugerencias con motivo visible y avatares compartidos.
- Deslizar para aceptar/descartar en celular.
- Animación de conexión aceptada (los avatares se unen, como en el logo).
- Mapa de red con nodos arrastrables.

### 13. Celular y PWA
- Barra inferior con indicador que se desliza.
- Manifiesto + service worker para instalar como app.
- Modo sin conexión básico (perfil y últimos mensajes).
- Gestos: deslizar para archivar y cerrar paneles.

### 14. Accesibilidad y confianza
- Contraste verificado, navegación por teclado, foco visible.
- Privacidad del perfil: público / solo empresas verificadas / privado.
- Selector de tamaño de letra.

## Backend necesario (sección 15, se construye dentro de cada fase)
- `/api/assistant` (Skilly) — fase 2
- `/api/matches/{jobId}/explain` — fase 3
- `/api/alerts` — fase 3
- `/api/p/{slug}`, `/api/badges` + colección `badges`, `/api/dashboard/me` — fase 4
- Subida de imágenes con GridFS (cuidando los 512 MB de Atlas M0) — fase 4
- WebSocket, estados de pipeline en `applications` — fase 5
