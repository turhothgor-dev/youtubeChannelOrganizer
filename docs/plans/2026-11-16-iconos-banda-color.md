# Plan: color del grupo como banda lateral e iconos más grandes

**Estado:** hecho

Issue: opinión de la persona tras probar en Firefox la rama `iconos-fxemoji` (2026-11-16). Continúa el plan
`docs/plans/2026-11-16-iconos-fxemoji.md` (rama `iconos-fxemoji`).

<!-- Estados: borrador → aprobado (AAAA-MM-DD) → hecho. Se cambia solo la línea `**Estado:**`, y lo
     hace quien tiene la aprobación de una persona; los subagentes no ven la conversación, solo este fichero. -->

## Contexto y decisión

Tras el plan anterior, el color resultante del grupo (`YouTubeGroups.getGroupAppearance`, con herencia) se ve como
un aro (`.youtube-groups__icon--ringed` + `--yg-group-color` en `box-shadow`) y, en `html[dark]`, todo icono de
grupo lleva un fondo claro tenue (`content.css`, regla con `html[dark] .youtube-groups__icon`,
`html[dark] .youtube-groups__icon-picker-option svg` y `html[dark] .youtube-groups__guide-form-icon-preview`). A la
persona no le gustan ni el aro ni el fondo, y los iconos le resultan pequeños.

Decisiones:

1. **Emoji sin fondo ni borde.** Se eliminan la clase `youtube-groups__icon--ringed`, su regla CSS, el uso de
   `--yg-group-color` en el chip del icono y la regla del fondo claro en `html[dark]` (las tres selecciones). Los emoji
   se pintan tal cual en claro y en oscuro.
2. **El color pasa a una banda vertical en el borde derecho de la fila del grupo.** Nueva función en `content.js`,
   `setGroupBand(element, color)`: con color, añade la clase `youtube-groups__group-band` y fija
   `--yg-group-color`; sin color (vacío o `null`), quita ambas. CSS:
   `.youtube-groups__group-band { box-shadow: inset -4px 0 0 var(--yg-group-color); padding-right: 8px; }`
   (`inset` no altera el tamaño de la fila, así que las filas con y sin color siguen alineadas; el `padding-right`
   evita que el texto pise la banda; si el elemento ya tiene más relleno a la derecha, el implementador conserva el
   mayor). Se aplica en:
   - **Guía "YouTube Groups"**: la fila `.youtube-groups__guide-row` de cada grupo o subgrupo (tras el botón "›"),
     con el color de `getGroupAppearance(groups, item.id)`. Las filas de canales no llevan banda.
   - **Desplegables de casillas** (`renderGroupChoices`: "Canal actual" del panel con `youtube-groups__group-choice`
     y desplegable de suscripción con `youtube-groups__subscription-group-choice`): el `<label>` de cada grupo. El
     panel no tiene otras filas de grupo.
   - **Selector de iconos** (`openIconPicker`): la caja de vista previa `.youtube-groups__icon-picker-preview`, con
     `selectedColorHex` (también con "Sin icono", que hoy no muestra el color).
   - **Formulario de crear grupo de la guía**: el botón `.youtube-groups__guide-form-icon`, con
     `appearance.colorHex` (en `paintAppearance`).

   El color de la banda es el **resultante con herencia**, igual que ahora. En la vista previa del selector y del
   formulario se usa el color elegido; "Heredar" (vacío) no pinta banda, como hoy no pintaba aro.
3. **Desaparece el punto de color** (`youtube-groups__color-dot`) de los grupos sin icono: la banda lo sustituye y
   así el color no se muestra dos veces. `createGroupMark(groups, groupId, size)` pasa a devolver solo el chip del
   icono (o `null` si no hay icono); se borra la regla CSS `.youtube-groups__color-dot`.
4. **Iconos de grupo un 20 % más grandes**, redondeando al píxel. Los tamaños se agrupan en una constante de
   `content.js`, `GROUP_ICON_SIZES`, para no repartir números por el código:

   | Sitio | Llamada | Antes | Después |
   | --- | --- | --- | --- |
   | Guía | `createGroupMark(…, 24)` | 24 | 29 |
   | Desplegables de casillas | `createGroupMark(…, 16)` | 16 | 19 |
   | Rejilla del selector | `createIconSvg(icon.id, 20)` | 20 | 24 |
   | Vista previa del selector | `createIconSvg(selectedIconId, 24)` | 24 | 29 |
   | Vista previa del formulario | `createIconSvg(appearance.iconId, 18)` | 18 | 22 |

   En `content.css`: `.youtube-groups__icon` deja de fijar `width`/`height` a 20 px (hoy el SVG de 24 de la guía
   desborda ese chip y el de 16 de las casillas queda holgado); el chip toma el tamaño del SVG.
   `.youtube-groups__guide-form-icon-preview` pasa de 18 a 22 px. Caben sin cambiar alturas: fila de la guía 36 px,
   botón de la rejilla 36 px (32 útiles), vista previa del selector 36 px, botón del formulario 32 px. Los iconos de
   interfaz (`createUiIconSvg`) no cambian.

Alternativas descartadas:

- `border-right` en la fila: cambia el ancho útil solo en las filas con color y desalinea la lista.
- Banda en el borde izquierdo o un pseudoelemento `::after` posicionado: la persona pide el derecho, y `inset
  box-shadow` lo resuelve sin tocar la posición de los hijos.
- Mantener el punto además de la banda: duplica la información.
- Escalar con `transform: scale` en CSS: emborrona y no cambia el espacio que ocupa el icono.

No hay cambios de almacenamiento (ADR 0001), ni de `getGroupAppearance`, ni dependencias nuevas. No es una decisión de
arquitectura nueva: basta una nota en el ADR 0013, que decía que el color se muestra como aro. `docs/ARCHITECTURE.md`
no menciona el aro ni el punto; no cambia.

## Tareas

Cada tarea es del tamaño de un commit, toca pocos ficheros y tiene un test que la valida.

- [x] T1 · Quitar aro, fondo oscuro y punto, y pintar la banda (decisiones 1–3): `setGroupBand` en `content.js`;
  `createGroupMark` sin aro ni punto; banda en la fila de la guía, en los `<label>` de `renderGroupChoices`, en la
  vista previa de `openIconPicker` (`updatePreview`, también en la rama "Sin icono") y en el botón del formulario
  (`paintAppearance`, que deja de tocar `iconPreview` para el color); en `content.css`, borrar
  `.youtube-groups__icon--ringed`, la regla del fondo en `html[dark]` y `.youtube-groups__color-dot`, y añadir
  `.youtube-groups__group-band` · Ficheros: `content.js`, `content.css` · Test: `make lint` y `make test` en verde
  sin cambiar tests (la lógica de color de `modules/` no cambia); búsqueda sin resultados de `ringed` y `color-dot`
  en `content.js` y `content.css`; a mano V1–V4.
- [x] T2 · Iconos un 20 % más grandes (decisión 4): constante `GROUP_ICON_SIZES` en `content.js` usada en las cinco
  llamadas de la tabla; `.youtube-groups__icon` sin `width`/`height` fijos y
  `.youtube-groups__guide-form-icon-preview` a 22 px · Ficheros: `content.js`, `content.css` · Test: `make lint` y
  `make test`; a mano V5.
- [x] T3 · Documentación: en `docs/adr/0013-iconos-fxemoji-empaquetados.md`, cambiar "se muestra como un aro" por
  "se muestra como una banda vertical en el borde derecho de la fila del grupo" y añadir al final una sección
  "Actualización (2026-11-16)" que diga que el aro y el fondo claro en oscuro se sustituyeron por la banda (plan
  `2026-11-16-iconos-banda-color`) y que el punto de color de los grupos sin icono desaparece; plan a `hecho` ·
  Ficheros: el ADR y este plan · Test: `make lint` (incluye formato Markdown).

### Verificación manual (Firefox, extensión cargada en `about:debugging`, tema claro y oscuro)

Grupos de prueba: con icono y color, con icono sin color, sin icono con color, sin icono ni color, y un subgrupo sin
color propio cuyo padre tiene color.

- V1 · Guía "YouTube Groups": los emoji sin fondo ni aro; la fila de cada grupo con color (propio o heredado) tiene
  una banda de ese color en el borde derecho, tras "›"; sin color, no hay banda; los grupos sin icono no muestran
  punto. Las filas con y sin banda están alineadas y el texto largo no pisa la banda. Las filas de canales, sin banda.
- V2 · Desplegables de casillas ("Canal actual" del panel en `/watch` y "Añadir a grupo" de una tarjeta): misma
  banda a la derecha de cada grupo con color, sin punto.
- V3 · Selector de iconos (crear grupo desde la guía): al elegir un color, la vista previa muestra la banda, también
  con "Sin icono"; "Heredar" la quita. El botón "Icono" del formulario muestra la banda del color elegido.
- V4 · Tras guardar un grupo nuevo con color, la guía lo muestra con su banda.
- V5 · Los iconos de grupo se ven más grandes (aprox. 29 px en la guía, 19 px en las casillas, 24 px en la
  rejilla) sin cambiar la altura de las filas ni desbordar los botones de la rejilla.

## Criterios de aceptación

- Los iconos de grupo se pintan sin fondo ni borde en tema claro y oscuro.
- El color de un grupo (propio o heredado) se ve como una banda vertical en el borde derecho de su fila en la guía,
  en los desplegables de casillas y en las vistas previas del selector y del formulario de crear grupo; sin color no
  hay banda.
- Los grupos sin icono ya no muestran el punto de color.
- Los iconos de grupo son un 20 % más grandes en todos los sitios donde aparecen, sin cambiar la altura de las filas.
- Los grupos y copias de seguridad existentes se ven igual salvo por lo anterior, sin migración; `make lint` y
  `make test` en verde sin tocar los tests.

## Fuera de alcance

- Cambiar el formato de almacenamiento, `getGroupAppearance` o la paleta `COLOR_SET`.
- Banda en las filas de canales, en las tarjetas de vídeo o en los botones del reproductor.
- Iconos de interfaz (`eye`, `check`, `playlist-add`) y sus tamaños.
- Rediseñar el selector de iconos o la pantalla de edición de grupos (`ROADMAP.md`).
- Tests de DOM para `content.js` (el proyecto no los tiene; se verifica a mano).

## Casos límite

- Subgrupo sin color propio: banda con el color heredado (como antes el aro); si ningún antepasado tiene color, sin
  banda.
- Grupo con color y sin icono: solo la banda; el nombre queda alineado como el de un grupo sin icono.
- Fila con hover o seleccionada en la guía: el fondo redondeado de `.youtube-groups__guide-item` no tapa la banda,
  que está en la fila contenedora.
- Botón del formulario con `border-radius: 8px`: la sombra interior sigue la curva; se acepta.
- `<label>` de casillas que no ocupe todo el ancho del desplegable: la banda quedaría junto al texto; si pasa en V2,
  el implementador añade `width: 100%`/`box-sizing: border-box` al `<label>` con banda y lo anota en
  **Cambios aprobados**.

## Cambios aprobados

Cambios sobre el plan después de aprobarlo. Sin una línea aquí, un cambio no está aprobado.

| Fecha | Tarea | Cambio | Motivo | Aprobado por |
| --- | --- | --- | --- | --- |
| 2026-11-17 | T2 | Iconos un 5 % menores que tras T2, redondeado: guía y vista previa del selector 28, casillas 18, rejilla 23, formulario 21 (`GROUP_ICON_SIZES` y `.youtube-groups__guide-form-icon-preview`). | La persona los prefiere algo más pequeños tras probarlos en Firefox. | La persona (2026-11-17) |
| 2026-11-17 | T2 | Otro 5 % menos, redondeado: guía y vista previa del selector 27, casillas 17, rejilla 22, formulario 20. | La persona pide reducir otro 5 %. | La persona (2026-11-17) |

## Registro

Una línea por commit, añadida **antes** de commitear. El plan actualizado va en el mismo commit que el cambio.

| Fecha | Tarea | Commit | Nota |
| --- | --- | --- | --- |
| 2026-11-16 | T1 | `feat: pintar el color del grupo como banda lateral y quitar aro, fondo y punto` | `setGroupBand` en guía, casillas, selector y formulario; sin tocar tests. V1–V4 pendientes a mano. |
| 2026-11-16 | T2 | `feat: agrandar un 20 % los iconos de grupo` | `GROUP_ICON_SIZES` en las cinco llamadas; chip sin tamaño fijo; vista previa del formulario a 22 px. V5 pendiente a mano. |
| 2026-11-16 | T3 | `docs: actualizar el ADR 0013 con la banda de color` | ADR 0013 con banda en lugar de aro y sección de actualización. Plan a `hecho`; V1–V5 pendientes a mano. |
| 2026-11-17 | T2 (ajuste) | `fix: reducir un 5 % los iconos de grupo` | Tamaños 28/18/23/28/21 según **Cambios aprobados**. |
| 2026-11-17 | T2 (ajuste 2) | `fix: reducir otro 5 % los iconos de grupo` | Tamaños 27/17/22/27/20 según **Cambios aprobados**. |
