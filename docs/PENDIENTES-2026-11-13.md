# SkillMatch: qué trae la rama `volver-portada-luis` y qué queda pendiente

Fecha: 13 de noviembre de 2026. Autor: Luis (con Claude Code).

Esta rama **no está en `main`**. Render publica `main` en vivo, así que nada de esto está en el sitio todavía.
Para pasarlo al sitio hay que revisarlo y unirlo a `main` con un pull request.

## 1. Qué trae la rama (resumen)

El detalle de cada cambio, con el porqué y lo que se midió, está en **`docs/CAMBIOS-NOCHE-2026-11-13.md`** (cambios #1 a #43).

En pocas palabras:

| Área | Qué cambió |
| --- | --- |
| Barra de arriba (isla) y de abajo (celular) | Vidrio que **toma el color del fondo**: claro en tema claro y oscuro en tema oscuro. En tema claro se vuelve oscuro solo cuando pasa sobre una zona oscura. Refracción tipo Liquid Glass en el borde. Se esconde al bajar y vuelve al subir. |
| Lente del menú | Cápsula de cristal sobre la página actual. Viaja con el clic, se estira con la velocidad y se puede arrastrar a otra opción (como el video «Lente»). |
| Menú «Tu cuenta» | Con sesión, junta Tema, Mi perfil y Cerrar sesión en un botón con tu foto (o inicial) y un anillo con lo completo del perfil. Trae tus postulaciones y el tema Claro / Oscuro / Auto. |
| Vacantes | Panel «Tu perfil frente a estas vacantes», resaltado de habilidades en los dos lados, habilidades «¿Y si aprendes…?» de prueba y la lista que se reordena con animación. |
| Botones | «Enviando… → ✓ Enviada» al postularse, chispitas al guardar, el avión de papel en Mensajes y efecto gelatina al presionar. |
| Avatares | «Monograma»: cada empresa o persona sin logo tiene colores y patrón propios, sacados de su nombre. |
| Entrar y registrarse | Al iniciar sesión vuelves a donde ibas, los errores se marcan en su campo y la tarjeta de vista previa se arma mientras escribes. |
| Rendimiento | Fuentes dentro del proyecto (antes se esperaba a Google Fonts), CSS sin reglas muertas y cuadros medidos en cada animación. |
| Pruebas | Playwright (`pruebas/`), con pruebas nuevas para todo lo anterior. Las corridas por grupo terminan en verde. |

Además de este último lote, la rama trae 8 commits que nunca se habían subido al repo del equipo. Uno de ellos **deshace el
PR #24 de la portada**, menos el login único y la cifra de vacantes (commit `ab01839`). Conviene revisarlo con calma antes
de unir a `main`.

## 2. Cómo revisarlo

1. Abrir `SkillMatch/src/pages/index.html` con Live Server. Con el backend local, `api-config.js` apunta a `localhost:8080`.
2. Recorrido sugerido:
   - Vacantes sin sesión → «Postularme» → entrar → vuelves a la vacante → enviar.
   - En tema claro y oscuro, bajar y subir la página para ver cómo la barra cambia de vidrio y se esconde.
   - Celular (F12, modo dispositivo): la barra de abajo, arrastrar el lente y «Filtros» en Vacantes.
   - Entrar como empresa: Inicio y Mi empresa (compatibilidad de candidatos).
3. Pruebas: en `pruebas/`, `npm install` y luego `npx playwright test`. Usan un backend falso (`pruebas/apoyo/api-falsa.js`),
   así que no hace falta MongoDB.

## 3. Lo que queda pendiente

### Decisiones (necesitan a Luis o a Jesús)

- [ ] **Caché del CSS y el JS en el sitio en vivo.** Render responde `no-store` y cada visita descarga todo otra vez. Hay dos caminos:
  - En `sw.js` («la copia guardada ya, y actualizar por detrás»). Riesgo: justo después de publicar, alguien podría ver una vez el HTML nuevo con un JS viejo.
  - En el backend (`SecurityConfig.java`), con cabeceras de caché para `/assets/`. Es lo más limpio, pero CLAUDE.md pide acordarlo antes de tocar el backend.
- [ ] **La pestaña «Mensajes» dentro de Conexiones** solo dice «ve a Mensajes». Propuesta: quitarla (cuidando los IDs que usa `conexiones.js`).
- [ ] **Textos de la marca:** se mezclan «Unirse ahora» y «Crear mi perfil», y también «Ofertas» y «Vacantes». Hay que elegir una voz y usarla en todo el sitio.
- [ ] **Unir a `main`:** abrir un pull request de `volver-portada-luis` a `main`, revisarlo (sobre todo lo del PR #24) y unir cuando el equipo esté de acuerdo.

### Por hacer

- [ ] **Correr toda la suite de pruebas de una sola vez** antes de unir a `main`. Hasta ahora se corrió por grupos (todo en verde).
  - Una prueba (el anillo de compatibilidad en `vidrio.spec.js`) fallaba a veces con el equipo muy cargado. Se arregló la causa (`ui.js`, `anillos`: el anillo queda en su valor final a los 1,5 s), pero conviene confirmarlo en una corrida completa.
- [ ] **Probar en un celular real** (Android con Chrome y un iPhone): la refracción, el arrastre del lente y la gelatina se sienten distinto que en el emulador.
- [ ] **Escenas isométricas** en otras páginas. Hoy las tienen la portada, Elegir cuenta y Mensajes vacío.

### Límites conocidos (no son errores)

- **La refracción del vidrio solo se ve en Chrome, Edge y Android.** Safari (iPhone) y Firefox no soportan un filtro SVG en `backdrop-filter`; ahí se ve el mismo vidrio sin el doblez del borde, y todo funciona igual.
- **El medidor de contraste** (scripts locales, no están en el repo) no logra medir el texto de «Iniciar sesión» porque su color va con `!important`. El fondo es el mismo de las demás opciones, que pasan con 6,7:1 o más.

## 4. Reglas que siguen valiendo (de CLAUDE.md)

- Nunca trabajar directo en `main`.
- Sin librerías de pago ni CDN para scripts: todo en `SkillMatch/src/assets/js/vendor/`.
- Solo animar `transform` y `opacity`, y respetar «reducir movimiento».
- No usar `:has()` en CSS nuevo: se midió que duplica el costo de los estilos.
