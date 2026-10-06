# Revisión de calidad — 2026-10-05 (rama `fase-1-visual`)

Auditoría automática de las 13 páginas (375 y 1280 px, claro y oscuro) más revisión visual parcial.
Páginas con sesión revisadas con las cuentas de prueba del seed local (`DataSeeder.java`).

## Lo que está bien
- Sin errores de JS ni desbordes horizontales en ninguna página (375 y 1280 px).
- Contraste AA correcto en casi todo; sin textos de menos de 12 px salvo un caso.
- Sin emojis en el HTML (los de `ui.js` son la tabla que los convierte en iconos).

## Hallazgos, por prioridad

### Alta (se ve roto o engaña)
1. **Perfil de empresa: contenido fijo en el HTML** (`perfil-empresa.html`, líneas 133-149 y 332-349):
   certificaciones ("ISO 9001:2015", "CMMI Level 3", "Great Place to Work"), beneficios, "Recursos útiles"
   (enlaces `#`) y "Plan Professional" salen iguales para toda empresa. Hay que conectarlos a datos reales
   o quitarlos → **hablar con Jesús** (requiere backend).
2. **Certificaciones rotas en el perfil de empresa:** `.certification-badge` comparte regla con `.cert-badge`
   (icono de 40 × 40, `app.css` ~línea 3670) y el texto queda en una columna de 40 px, palabra por palabra.
   Arreglo solo CSS: separar las dos clases y mostrar las etiquetas como pastillas que se acomodan.

### Media (uso en celular)
3. **Botones pequeños para el dedo (menos de 44 px de alto):** "Guardar"/"Aplicar" de cada vacante (36 px, ×20),
   filtros de Oportunidades ("Aplicar filtros" 26 px, "Limpiar" 23 px, control de salario 16 px), "Nuevo mensaje"
   (26 px), "¿Olvidaste tu contraseña?" (21 px), botones de editar en los perfiles (34-39 px), pasos del registro
   de empresa (30 px), habilidades de la demo de la portada (32 px).
4. **Sin título principal (`h1`):** `registro-usuario.html`, `registro-empresa.html` y `mensajes.html`.
   Saltos de nivel de títulos en portada, Oportunidades y perfiles.
5. **Contraste:** número del paso activo del registro en modo oscuro (`.step-index`, 2,44:1).
   Por verificar a mano: etiquetas del mapa de la portada (posible falso positivo) y la barra inferior
   de `registro-empresa` en oscuro.

### Baja (pulido)
6. Contadores de filtros a 11 px (`.filter-count`).
7. Enlace del logo con `alt="SkillMatch Logo"` en varias páginas; mejor "SkillMatch, ir al inicio" como en la portada.
8. Estilos dentro del HTML en `login.html` (4) y `dashboard.html` (3): pasarlos a `app.css`.

## Arreglado el 2026-10-06 (solo diseño, sin backend)
- Certificaciones del perfil de empresa: pastillas que se acomodan en filas (`.certification-badge`
  separada de `.cert-badge`).
- Número de los pasos del registro en modo oscuro (activo y completados): azul marino, legible.
- `h1` en `registro-usuario`, `registro-empresa` y `mensajes` (mismo tamaño que antes).
- Botones táctiles: se completó el bloque `@media (pointer: coarse)` (filtros, botones del perfil de
  empresa, botones de icono, acciones de ofertas, barra superior, subir archivo, "Ver todo",
  habilidades de la demo). Re-auditado con emulación táctil: sin pendientes salvo los enlaces falsos
  de "Recursos útiles" (dependen de Jesús).
- Contadores de filtros a 12 px. Botón "Reintentar" de Oportunidades con la clase `btn`.
- Falsos positivos confirmados: etiqueta activa del mapa (capa naranja en `::before`), botones del
  mapa (la zona táctil es la tarjeta), "¿Olvidaste tu contraseña?" y "Limpiar" (zona invisible de 44 px).

## Perfil de usuario con datos reales (2026-10-06)
Arreglado (frontend):
- Escritorio: 3 columnas como el perfil de empresa (antes 2 columnas para 3 bloques: el centro en 320 px
  y 360 px vacíos); 2 columnas entre 1081 y 1279 px. La barra izquierda ya no es "sticky" (era más alta
  que la pantalla y su parte de abajo no se veía).
- Secciones del centro en tarjetas; "+ Agregar" en una línea; títulos al tamaño de las tarjetas.
- Ubicación: el icono salía como texto `<i data-ico="pin">` (profile.js usaba textContent).
- Progreso: decía 100 % con experiencia y educación pendientes (el backend no las cuenta); ahora se
  calcula con la misma lista que se muestra. Pendientes con círculo vacío (icono nuevo `circle`).
- Estadísticas en una fila compacta; estrellas de nivel rellenas en naranja.

Para Jesús (backend o contenido):
- `GET /users/{id}/experiences` responde 400: "experienceService is null" (falta inyectar el servicio
  en el controlador). Por eso "No se pudieron cargar las experiencias".
- Contenido fijo en `perfil-usuario.html`: certificaciones, proyectos y recomendaciones de empresas
  son iguales para todos. "0 conexiones" también es fijo (nadie lo actualiza).

## Falta revisar
- Revisión visual página por página (espaciados, tipografía, consistencia) de: perfil de usuario, conexiones,
  mensajes, registros y el resto del perfil de empresa.
