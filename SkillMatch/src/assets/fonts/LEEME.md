# Fuentes de SkillMatch (guardadas en el proyecto)

Antes se pedían a Google Fonts en cada página y el navegador esperaba esa hoja (~1,5 s) antes de pintar.
Ahora están aquí y `app.css` las declara con `@font-face` (sección 77). Descargadas el 13 de noviembre de 2026
desde Google Fonts, solo el juego **latino** (cubre todo el español: tildes, ñ, ¿ ¡, comillas y rayas).

| Archivo | Fuente | Ejes | Peso |
|---|---|---|---|
| `bricolage-grotesque-latin.woff2` | Bricolage Grotesque (títulos) | grosor 400–800 y tamaño óptico 12–96 | 75 KB |
| `instrument-sans-latin.woff2` | Instrument Sans (texto) | grosor 400–700 | 29 KB |

Son fuentes **variables**: un solo archivo trae todos los grosores.

## Licencia

Las dos tienen la licencia libre **SIL Open Font License 1.1** (se pueden usar, guardar y distribuir con el sitio, también
en proyectos comerciales; no se pueden vender solas). Texto completo: https://openfontlicense.org/open-font-license-official-text/

- Bricolage Grotesque — Copyright 2022 The Bricolage Grotesque Project Authors (https://github.com/ateliertriay/bricolage)
- Instrument Sans — Copyright 2022 The Instrument Sans Project Authors (https://github.com/Instrument/instrument-sans)

## Para actualizarlas

Pedir la hoja de Google con un navegador moderno (el enlace que estaba en las páginas) y bajar los `.woff2` del bloque
`/* latin */` de cada familia.
