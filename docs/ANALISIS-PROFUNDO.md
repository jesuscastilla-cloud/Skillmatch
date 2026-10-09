# Análisis profundo — 2026-10-07 (rama `fase-1-visual`, commit 8826cbf)

Revisión de las 13 páginas como **visitante**, **estudiante** (`usuario1`) y **empresa** (`empresa1`),
a 1280 y 375 px, en modo claro y oscuro (56 auditorías automáticas), más revisión visual de cada página
y lectura del código. El celular se auditó simulando pantalla táctil de verdad.

## Lo que está bien
- **Cero errores de JavaScript** en todas las páginas y estados.
- Un solo error de red: `GET /users/{id}/experiences` → 400 (ya conocido, es del backend).
- Sin desbordes horizontales, salvo uno (registro de empresa en celular, abajo).
- Contraste AA correcto en todo (el único aviso es la etiqueta del mapa, falso positivo ya conocido).
- Zonas táctiles de 44 px en celular, salvo un botón (abajo).

## Crítico — roto o engaña al usuario
1. **Fuga de datos en `/api/connections/suggestions`** (backend, Jesús): devuelve el usuario completo
   de otras personas, con el hash de la contraseña, correo y teléfono. Está en el sitio publicado.
   Detalle en `REVISION-CALIDAD.md`.
2. **Indicadores no muestra nada:** el informe de Power BI no es público y a todos les pide
   "Inicie sesión para ver este informe". Hay que publicarlo como público ("Publicar en la web") o
   quitar la página y sus enlaces (pie y paleta) hasta tenerlo.
3. **Perfil de empresa con datos falsos o mal etiquetados:**
   - Las ofertas dicen "Publicado: **31/12/1969**": el código usa `createdAt`, que llega vacío
     (la fecha está en `postedDate`).
   - "Contrataciones exitosas" muestra las **ofertas activas** y "Miembros del equipo" las
     **postulaciones pendientes** (etiquetas cambiadas en `perfil-empresa.js`).
   - Cifras escritas a mano en el HTML: 8 ofertas, 156 candidatos, 12 contratados, "1,245 seguidores".
   - "Candidatos recomendados" inventados (Juan Rodríguez 98 %, María García 94 %).
   - Certificaciones, beneficios, "Recursos útiles" (5 enlaces que no llevan a nada) y
     "Plan Professional / Upgrade Plan" (no hay planes ni pagos): iguales para toda empresa.
4. **"¿Olvidaste tu contraseña?" no hace nada** en los dos logins (`href="#"`): no existe la
   recuperación de contraseña en el backend.
5. **Registro de empresa en celular se sale de la pantalla** (402 px en un celular de 375): el
   selector de archivo del logo, sin estilo, empuja los campos. Además se ve distinto al resto
   (podría usar el editor de imágenes nuevo).

## Alta — se ve mal o confunde
6. **Mensajes:** el título y "+ Nuevo" se parten en dos líneas; el estado vacío (la misma ilustración)
   sale en los dos paneles a la vez y no hay botón para empezar una conversación.
7. **Elegir tipo de cuenta:** las frases de cada tarjeta salen en negrita grande (parecen títulos),
   los botones de registro son blancos (débiles para la acción principal) y "Unirse ahora" muestra
   debajo la línea de "página actual" (es para enlaces, no para botones). Promete "portafolio" e
   "IA para priorizar candidatos", que no existen.
8. **Login general:** el botón "Iniciar sesión" es corto (en el de usuario es de ancho completo) y no
   hay enlace para crear cuenta.
9. **Perfil de empresa, cabecera:** el sector ("Educación") queda suelto a la derecha y "Editar perfil"
   debajo del nombre; "+ Nueva oferta" y "Ver todos" se parten en dos líneas; el tipo de vacante sale en
   minúscula ("práctica", "freelance").
10. **Textos que prometen lo que ya no está:** el login de usuario ofrece "portafolio con logros y
    proyectos" (se quitó del perfil) y la portada tiene "Ver roadmap completo", que no lleva a nada.
11. **La búsqueda de la portada inventa el %** de compatibilidad (70-90 según el id de la vacante),
    mientras Vacantes ya usa el real.

## Media — accesibilidad y consistencia
12. Buscadores sin nombre para lectores de pantalla: portada, Vacantes y Mensajes (solo tienen placeholder).
13. Saltos de títulos (h1 → h3) en portada, registros, Vacantes, perfiles y Mensajes.
14. El logo del pie es un enlace sin nombre accesible.
15. Mayúsculas de título que quedan (~40): "Correo Electrónico", "Crear cuenta de Usuario",
    "Registrar mi Empresa", "Registro de Usuarios", "Soy Usuario", "Para Empresas",
    "Oportunidades Personalizadas", "Tipo de Oportunidad", "Nivel de Experiencia",
    "Progreso del Perfil", "Oportunidades Recomendadas", "Conexiones y Networking", casi todos los
    títulos del perfil de empresa, la sección "Innovación Futura"…
16. Botón "×" para quitar una habilidad del perfil: 32 × 22 px en celular (debe ser 44).
17. Modo oscuro: "Unirse ahora" (azul marino) casi se pierde sobre la barra oscura.

## Para Jesús (backend)
- Fuga de datos en `/connections/suggestions` (urgente) y excluir de las sugerencias a quienes ya son
  conexión o tienen solicitud pendiente.
- `/users/{id}/experiences` → 400 ("experienceService is null").
- Recuperación de contraseña (no existe).
- Estadísticas reales de empresa (candidatos, contratados; "seguidores" no existe en el modelo).
- Guardar las imágenes como archivos (GridFS) y permitir quitar la foto.
- Indicadores: publicar el informe de Power BI como público (o quien sea su dueño).

## Avance de las correcciones
- **Paso 1 — Perfil de empresa (hecho, 2026-10-08):** nombre, sector, ciudad, tamaño, web e insignia
  de verificada salen del backend; logo con las iniciales de la empresa (antes "ST" de un servicio
  externo para todas); cifras reales (ofertas activas, postulaciones, por revisar, % respondidas);
  fechas de las ofertas desde `postedDate`; tipos bien escritos; las **postulaciones reales** con
  resumen por estado y "Ver todas" (antes nunca se mostraban); fuera seguidores, cifras fijas,
  candidatos inventados, certificaciones, recursos vacíos y el plan de pago falso; fuera los botones
  que fingían guardar (portada, logo y datos solo se guardaban en el navegador: el backend solo deja
  a la empresa cambiar su descripción). De paso: notificaciones sin errores sin conexión y la
  búsqueda ya no pide guardados con sesión de empresa (403).
- Para Jesús: permitir que la empresa edite sus datos (hoy `PUT /companies/{id}` es solo de ADMIN),
  agregar portada a `Company` y guardar beneficios como lista.

## Propuesta de orden para corregir (solo frontend)
1. Perfil de empresa: fechas, etiquetas cambiadas, cifras reales o fuera, quitar lo inventado
   (como se hizo en el perfil de usuario), cabecera y textos partidos.
2. Registro de empresa: el desborde y el logo con el editor de imágenes.
3. Mensajes: cabecera y estados vacíos.
4. Elegir tipo de cuenta y logins: tarjetas, botones, promesas falsas, "¿Olvidaste tu contraseña?".
5. Indicadores: ocultar hasta tener el informe público (o dejar un aviso claro).
6. Accesibilidad y mayúsculas (puntos 12 a 17) y el % de la búsqueda de la portada.
