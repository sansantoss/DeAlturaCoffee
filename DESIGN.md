# DeAltura Coffee — Design System

Fuente única de verdad para la marca en la web y en la app (Expo). Los valores viven
en `src/app/globals.css` (web) y se copian a `theme.ts` cuando hagamos la app.

> **Estado:** provisional. El logo todavía no está decidido; la web usa el wordmark
> (logo principal) y el emblema (sello) redibujados en SVG a partir de los mockups,
> generados por `npm run brand` (scripts/build-brand.mjs). Cuando exista
> el logo final en vector, se reemplazan `public/brand/*.svg` (los componentes en `src/components/Wordmark.tsx` los leen de ahí).

## 1. Idea

*De altura* = "from altitude". La altitud a la que crece cada café es el dato que
organiza la marca: cada lote se ubica en una escala de metros sobre el nivel del mar,
contra los 76 m de Toronto, donde llega el café.

## 2. Color

Tomados de la guía de marca (cuarta imagen de los mockups). Valores en `src/app/globals.css`
y `design/tokens.json`.

| Rol | Nombre | Hex | Uso |
| --- | --- | --- | --- |
| `--bg` | Crema | `#F6EEE3` | Fondo de página |
| `--surface` | Arena | `#E6D5C1` | Un paso de tono: filas, paneles, campos |
| `--ink` | Verde bosque | `#023535` | Texto, wordmark, campos invertidos (footer) |
| `--muted` | Verde bosque suave | `#3F5552` | Notas secundarias (nunca texto corrido) |
| `--accent` | Turquesa principal | `#006F72` | La acción principal y el hero |
| `--accent-ink` | Crema | `#F6EEE3` | Texto sobre turquesa |
| `--gold` | Dorado | `#B0814C` | Emblema, punto del isotipo, detalles de la etiqueta |
| `--coffee` | Café profundo | `#382517` | Estados (cancelado) y la futura línea de microlotes |

Proporción: crema domina; verde bosque es la tinta y el campo invertido; turquesa en el
botón principal y el hero; dorado solo en marca y detalles.

## 3. Tipografía

Dos familias, autoalojadas con Fontsource (no dependen de Google Fonts en build):

| Rol | Familia | Uso |
| --- | --- | --- |
| Display | **Cormorant Garamond** | Titulares, cifras grandes, el nombre en el footer |
| Texto | **Jost** | Texto corrido, UI, formularios; y el wordmark |

| Paso | Tamaño | Uso |
| --- | --- | --- |
| Hero | `clamp(3.25rem, 1.6rem + 5.4vw, 6rem)` | Titular del hero (máx. 2 líneas) |
| 1 | `clamp(2.25rem, 1.4rem + 2.8vw, 3.75rem)` | Títulos de sección |
| 2 | `clamp(1.375rem, 1.1rem + 0.9vw, 1.875rem)` | Subtítulos, notas de cata |
| Texto | 17px, leading 1.55, máx. 62ch | Todo el texto corrido |
| Pequeño | 14px | Notas, legales |

Reglas: sin etiquetas pequeñas sobre los títulos, sin monospace, cifras tabulares en precios.

## 4. Espacio y forma

- Márgenes de página: `clamp(1rem, 2.4vw, 2.25rem)`.
- Entre secciones: `clamp(6rem, 12vw, 12rem)`.
- Esquinas: **cuadradas** en todo (radio 0). Botones rectangulares.
- Sin líneas finas, sin sombras en reposo, sin degradados. Las superficies se separan
  con un paso de tono.

## 5. Componentes

- **Botón principal:** fondo `--accent`, texto `--accent-ink`, 16px peso 500, alto 48px,
  padding 0 24px. Hover: fondo `--ink`.
- **Botón secundario:** texto `--ink` subrayado, sin caja.
- **Campos:** fondo `--surface`, sin borde, 48px de alto; foco con contorno 2px `--accent`.
- **Ficha de origen:** reproduce la etiqueta de la bolsa: país, región, notas de cata,
  variedad, proceso, altitud, puntaje SCA.

## 6. Marca

- `public/brand/wordmark.svg` — DEALTURA / COFFEE (logo principal).
- `public/brand/emblem.svg` / `emblem-cream.svg` — sello circular (secundario: footer, sellos).
- `public/brand/isotype.svg` — la gota sola (favicon `src/app/icon.svg`, futuro ícono de la app).

## 7. Movimiento

- Hero: la etiqueta de la bolsa entra línea por línea sobre las curvas de nivel.
- Entradas por sección: título → texto → imagen, 70 ms de escalonado, 24 px de subida.
- Todo con `prefers-reduced-motion`: sin desplazamiento, solo contenido.
