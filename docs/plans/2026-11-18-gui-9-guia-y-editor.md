# Plan: gui-9 · Ajustes de la guía (pie, bullet de color, iconos, separación, navegación) y texto del editor

**Estado:** aprobado (2026-11-18)

Issue: correcciones de la persona tras probar gui-8 en Firefox (2026-11-18), puntos 1 a 6 y el bullet sin número del
punto 2. Índice: [2026-11-18-gui-9-y-fase6-4-6-5](2026-11-18-gui-9-y-fase6-4-6-5.md). Sin ADR (solo presentación).

<!-- Estados: borrador → aprobado (AAAA-MM-DD) → hecho. Se cambia solo la línea `**Estado:**`, y lo
     hace quien tiene la aprobación de una persona; los subagentes no ven la conversación, solo este fichero. -->

## Contexto y decisión

Estado actual (`ui/guide-section.js`, `ui/guide-section.css`, `ui/icons-dom.js`):

- El pie (`.youtube-groups__guide-footer`, `display: flex`) pone reciclaje y engranaje a la izquierda.
- El color del grupo es una banda curva en el borde derecho de su botón principal (`setGroupBand(main, color)` en
  `createGuideRow`; regla `.youtube-groups__guide-item.youtube-groups__group-band` en `ui/guide-section.css`).
- `GROUP_ICON_SIZES` = `{ guide: 27, choice: 17, pickerGrid: 22, pickerPreview: 27, formPreview: 20 }`.
- Los botones de grupo y de canal van pegados (sin separación vertical).
- "›" (`.youtube-groups__guide-enter`), "‹" (`.youtube-groups__guide-back`) y el desplegable de canales "▸/▾"
  (`.youtube-groups__guide-toggle`, a la izquierda de "A (n)") usan el color secundario y 18 px / 12 px.
- El panel "Canales" del editor dice "Elige un grupo" sin grupo seleccionado (`options/options.js`, `renderChannels`).

Decisiones:

1. **Pie a la derecha**: `.youtube-groups__guide-footer` con `justify-content: flex-end`; el orden sigue siendo
   reciclaje y engranaje.
2. **Bullet en lugar de banda (solo en el botón principal del grupo de la guía)**: nueva función
   `setGroupBullet(element, color)` en `ui/icons-dom.js`, idempotente y que solo escribe en el DOM si algo cambia:
   - Con color: asegura un único hijo `<span class="youtube-groups__group-bullet" aria-hidden="true">` como **último
     hijo** del elemento, con la propiedad `--yg-group-color` = color; sin texto.
   - Sin color: quita el bullet si lo hay.
   - En el botón principal (`main` de `createGuideRow`) sustituye a `setGroupBand`; el color es el de
     `getGroupAppearance` (heredado incluido). El botón principal gana `data-group-id` con el id del grupo (lo usará el
     plan 6-5 para actualizar los bullets sin repintar).
   - CSS (`ui/icons.css`, junto a la banda): `.youtube-groups__group-bullet { flex: none; margin-left: auto; width:
     10px; height: 10px; border-radius: 50%; background: var(--yg-group-color); }`. El nombre conserva la elipsis y el
     bullet queda a la derecha. En `ui/guide-section.css`, el botón principal de la fila (`.youtube-groups__guide-row
     .youtube-groups__guide-item`) pasa a `padding-right: 8px` (el bullet queda a 8 px del borde, no pegado) y se borra
     la regla `.youtube-groups__guide-item.youtube-groups__group-band`.
   - **Grupo sin color (ni heredado)**: sin bullet. Cuando el plan 6-5 añada el número, un grupo sin color con vídeos
     nuevos tendrá un bullet gris neutro con el número; sin color y sin número, nada.
   - `setGroupBand` **no** se borra: la siguen usando el editor (filas del árbol), las casillas de grupos, el selector
     de iconos y el formulario de crear de la guía.
3. **Iconos un 10 % más pequeños en todos los sitios** (coherente con los ajustes anteriores, que cambiaron todos los
   tamaños a la vez), redondeando: `GROUP_ICON_SIZES = { guide: 24, choice: 15, pickerGrid: 20, pickerPreview: 24,
   formPreview: 18 }`. La caja `.youtube-groups__guide-form-icon-preview` (20 px) no cambia.
4. **Separación vertical**: 2 px entre filas de grupo y entre botones de canal (`gap` en la columna
   `.youtube-groups__guide-column` y en `.youtube-groups__guide-channels` con `display: flex; flex-direction: column`;
   la regla `[hidden]` existente sigue ocultando la lista). Entre la fila de un grupo y su lista desplegada, también
   2 px.
5. **Navegación más visible**: "›" y "‹" con `color: var(--yt-spec-text-primary)`, `font-size: 22px`,
   `font-weight: 700`, `border-radius: 8px` y fondo `var(--yt-spec-badge-chip-background)` en `:hover` y
   `:focus-visible`; "▸/▾" con `color: var(--yt-spec-text-primary)`, `font-size: 14px`, `border-radius: 6px` y el mismo
   fondo en `:hover` y `:focus-visible`. En `html[dark]` pasan de la lista de color secundario a la de primario. Los
   botones de crear y editar de la cabecera no cambian.
6. **Texto del editor**: el resumen del panel "Canales" sin grupo seleccionado pasa a "Elige un grupo o subgrupo para
   ver sus canales". La opción vacía del selector de copiar/mover ("Elige un grupo") **no** cambia: es otro control.

Alternativa descartada: conservar la banda y añadir el bullet aparte (dos marcas del mismo color en el mismo botón).

## Tareas

- [x] T1 · Pie a la derecha, separación vertical y navegación más visible (decisiones 1, 4 y 5) · Ficheros:
  `ui/guide-section.css` · Test: `make lint` y `make test` en verde (los tests de la guía no cambian) y V1, V3 y V4.
- [x] T2 · Iconos de grupo un 10 % más pequeños (decisión 3) · Ficheros: `ui/icons-dom.js`,
  `tests/ui-icons-dom.test.js` · Test: el test "la marca de un grupo con icono es un .youtube-groups__icon con un svg
  de 27 px" pasa a 24 px (el requisito cambia); test nuevo: `GROUP_ICON_SIZES` vale exactamente `{ guide: 24, choice:
  15, pickerGrid: 20, pickerPreview: 24, formPreview: 18 }`.
- [x] T3 · Bullet del color del grupo en lugar de la banda (decisión 2) · Ficheros: `ui/icons-dom.js`, `ui/icons.css`,
  `ui/guide-section.js`, `ui/guide-section.css`, `tests/ui-icons-dom.test.js`, `tests/ui-guide-section.test.js` ·
  Test (jsdom): `setGroupBullet` con color crea un único `.youtube-groups__group-bullet` último hijo, `aria-hidden`,
  sin texto y con `--yg-group-color`; llamarlo otra vez con el mismo color no muta el DOM (un `MutationObserver` del
  test no registra nada); con otro color solo cambia la propiedad; con `null` lo quita. En la guía, con A de color
  `#2196F3` (con A1 sin color) y B sin color: el botón principal de A tiene el bullet con `#2196F3`, `data-group-id`
  de A y no tiene `youtube-groups__group-band`; el de B no tiene bullet; dentro de A, A1 tiene bullet heredado
  `#2196F3`; los nombres de fila (`rowNames`) no cambian. Los tests "la banda de color va en el botón del grupo, no en
  la fila" y "el botón del grupo con color tiene la banda y --yg-group-color" se reescriben para el bullet porque el
  requisito cambia; el test de `setGroupBand` se queda (sigue en uso).
- [x] T4 · Texto del panel "Canales" (decisión 6) · Ficheros: `options/options.js`, `tests/ui-options.test.js` · Test
  (jsdom): al cargar el editor sin grupo seleccionado, `#options-channels` muestra "Elige un grupo o subgrupo para ver
  sus canales"; al abrir "Copiar a…" la primera opción del selector sigue siendo "Elige un grupo".
- [ ] T5 · Cerrar · Ficheros: `docs/ARCHITECTURE.md` (fila de `ui/icons-dom.js` con `setGroupBullet`; flujo "Guía
  lateral": el color del grupo es un bullet a la derecha de su botón, no la banda; pie a la derecha), este plan a
  `hecho` · Test: `make lint`, `make test` y V1 a V6.

### Verificación manual (Firefox, extensión recargada; A azul con subgrupo A1 sin color y un canal, B sin color)

- V1 · En suscripciones, el pie muestra reciclaje y engranaje alineados a la derecha; siguen funcionando.
- V2 · El botón de A muestra a la derecha un círculo azul a unos 8 px del borde, sin banda; dentro de A, A1 también;
  B no tiene círculo; con nombres largos la elipsis no tapa el círculo; con el cursor encima y seleccionado se ve
  bien, en tema claro y oscuro.
- V3 · Con dos grupos seleccionados seguidos, se distingue un hueco entre sus fondos; igual entre canales de una lista
  desplegada.
- V4 · "›", "‹" y "▸/▾" se ven más marcados que antes y resaltan con el cursor y con el foco del teclado.
- V5 · Los iconos de grupo son algo más pequeños en la guía, las casillas de "+G", el selector de iconos, el
  formulario de crear y el árbol del editor.
- V6 · En el editor sin grupo seleccionado se lee "Elige un grupo o subgrupo para ver sus canales".

## Criterios de aceptación

- El color de un grupo en la guía es un círculo a la derecha de su botón, separado del borde; sin color no hay marca.
- Los iconos del pie están a la derecha; los botones de grupo y de canal tienen separación vertical.
- Los iconos de grupo son un 10 % menores en todos los sitios.
- "›", "‹" y el desplegable de canales tienen más contraste y estado de cursor y foco.
- El editor sin selección dice "Elige un grupo o subgrupo para ver sus canales".

## Fuera de alcance

- El número de vídeos nuevos dentro del bullet (plan 6-5).
- Cambiar la banda del editor, de las casillas, del selector de iconos o del formulario de crear.
- Cambiar los botones de crear y editar de la cabecera o el texto "A (n)" del botón.

## Cambios aprobados

Cambios sobre el plan después de aprobarlo. Sin una línea aquí, un cambio no está aprobado.

| Fecha | Tarea | Cambio | Motivo | Aprobado por |
| --- | --- | --- | --- | --- |

## Registro

Una línea por commit, añadida **antes** de commitear. El plan actualizado va en el mismo commit que el cambio.

| Fecha | Tarea | Commit | Nota |
| --- | --- | --- | --- |
| 2026-11-18 | gui-9 T1 | `style: pie a la derecha, separación vertical y navegación más visible en la guía` | Solo CSS; lint y 353 tests en verde. V1, V3 y V4 pendientes en Firefox. |
| 2026-11-18 | gui-9 T2 | `style: iconos de grupo un 10 % más pequeños` | `GROUP_ICON_SIZES` actualizado y tests; lint y 354 tests en verde. V5 pendiente en Firefox. |
| 2026-11-18 | gui-9 T3 | `feat: bullet de color del grupo en la guía en lugar de la banda` | `setGroupBullet`, CSS y `data-group-id` en el botón principal; lint y 355 tests en verde. V2 pendiente en Firefox. |
| 2026-11-18 | gui-9 T4 | `feat: texto del panel de canales del editor sin grupo seleccionado` | Texto nuevo y test; lint y 356 tests en verde. V6 pendiente en Firefox. |
