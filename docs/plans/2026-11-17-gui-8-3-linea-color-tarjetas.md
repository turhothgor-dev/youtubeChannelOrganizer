# Plan: gui-8-3 · Línea de color del grupo en las tarjetas de suscripciones

**Estado:** aprobado (2026-11-17)

Issue: corrección 6 de la persona tras probar en Firefox (2026-11-17). Índice:
[gui-8](2026-11-17-gui-8-guia-y-editor.md). Sin ADR: no cambia el formato ni la estructura; sigue la regla de
idempotencia del plan [bucle-botones-tarjeta](2026-11-17-bucle-botones-tarjeta.md).

<!-- Estados: borrador → aprobado (AAAA-MM-DD) → hecho. Se cambia solo la línea `**Estado:**`, y lo
     hace quien tiene la aprobación de una persona; los subagentes no ven la conversación, solo este fichero. -->

## Contexto y decisión

En `/feed/subscriptions` se quiere reconocer de un vistazo a qué grupo pertenece cada vídeo. `ui/cards.js` ya guarda
en cada tarjeta la URL de su canal (`data-youtube-groups-channel-url`, en `detectCard`) y `content.js` le pasa el
árbol en cada repintado (`ctx.cards.refreshChannelNameIndex(groups)` dentro de `renderGroupsPanel`, que también corre
con `storage.onChanged` de grupos).

Decisión:

- **Lógica pura** en `modules/groups.js`:
  - `buildChannelColorIndex(groups)` → `Map<getChannelKey(url), string[]>`: recorre el árbol en preorden (grupo, sus
    subgrupos, siguiente grupo) con el color resultante de cada grupo, igual que `getGroupAppearance` (propio o, si
    está vacío, el del antecesor más cercano con color); solo cuentan colores con `YouTubeGroupsIcons.isValidColor` y
    no vacíos, en minúsculas; por canal, sin repetidos (primera aparición) y como mucho 4. Grupos sin color no aportan;
    un canal sin ningún color no está en el índice. No muta la entrada.
  - `getStripeBackground(colors)` → `""` si la lista está vacía; si no, `linear-gradient(to right, c0 0% p1%, c1 p1%
    p2%, …)` con segmentos iguales y porcentajes `+(i * 100 / n).toFixed(2)` (p. ej. dos colores: `linear-gradient(to
    right, #ff0000 0% 50%, #00ff00 50% 100%)`; uno: `linear-gradient(to right, #ff0000 0% 100%)`).
- **DOM** en `ui/cards.js`:
  - `refreshChannelColorIndex(groups)` (en la API): recalcula el índice; si cambia (comparando claves y listas),
    reaplica `applyGroupStripe` a todas las tarjetas de `VIDEO_CARD_SELECTOR`, sin reprogramarlas. `content.js` lo
    llama en `renderGroupsPanel` junto a `refreshChannelNameIndex`.
  - `applyGroupStripe(card)`: si la página es `subscriptions` (`getPageType`) y la tarjeta tiene canal, el valor es
    `getStripeBackground(índice.get(getChannelKey(url)) ?? [])`; si no, `""`. Escribe solo si cambia: con valor, la
    propiedad `--yg-group-stripe` y la clase `youtube-groups--group-stripe`; sin valor, quita ambas. Se llama en
    `processPendingCards` tras `detectCard` (también si no hay canal, para limpiar una tarjeta reutilizada) y al
    cambiar el índice. Al navegar fuera de suscripciones, el reprocesado de `yt-navigate-finish` las quita.
  - Escribir `style` o `class` en la tarjeta no reactiva el `MutationObserver` (solo observa `childList` y los
    atributos `href` e `is-active`), pero se mantiene la regla de no escribir si no cambia.
- **CSS** en `ui/cards.css`: `.youtube-groups--group-stripe { position: relative; }` y
  `.youtube-groups--group-stripe::before { content: ""; position: absolute; left: 0; right: 0; bottom: 100%;
  margin-bottom: 2px; height: 3px; border-radius: 2px; background: var(--yg-group-stripe); pointer-events: none; }`:
  la línea va justo encima de la tarjeta, en el hueco entre filas, sin tapar la miniatura ni cambiar la maquetación.
  Si en V1 no se ve bien (recortada o solapada), se ajusta con un cambio aprobado (alternativa prevista: `top: 0` y
  `z-index: 3` sobre la miniatura).
- La línea no participa en la visibilidad: una tarjeta oculta no se ve; atenuada, se atenúa con ella.

## Tareas

- [x] T1 · Colores de un canal y fondo de la línea · Ficheros: `modules/groups.js`, `tests/groups.test.js` · Test:
  canal en un grupo con color → `["#2196f3"]`; en dos grupos con colores distintos → los dos en preorden; en A (rojo) y
  en su subgrupo A1 sin color → solo rojo (heredado y sin repetir); A1 con color propio → rojo y su color; grupo sin
  color y sin antecesor con color → no aporta (canal ausente del índice); color no válido (`"red"`, `"#fff"`) → no
  aporta; seis grupos con colores distintos → los 4 primeros; `/@Canal` y `/@canal` → misma clave; la entrada no se
  muta; `getStripeBackground([])` → `""`, uno, dos y tres colores con las cadenas exactas
  (`#a 0% 33.33%, #b 33.33% 66.67%, #c 66.67% 100%`).
- [x] T2 · Línea en las tarjetas de suscripciones · Ficheros: `ui/cards.js`, `ui/cards.css`, `content.js`,
  `tests/ui-cards.test.js`, `tests/helpers/youtube-fixtures.js` (opción `color` en `makeGroup`) · Test (jsdom): en
  `/feed/subscriptions`, una tarjeta de un canal de A (`#2196F3`) tiene la clase `youtube-groups--group-stripe` y
  `--yg-group-stripe` con ese color; el canal en A y B (colores distintos) da dos segmentos; un canal en un grupo sin
  color no tiene clase ni propiedad; la misma tarjeta en `/` (inicio) no la tiene; reprocesar la tarjeta sin cambios
  no produce registros de un `MutationObserver` con `attributes: true` sobre ella; cambiar el color de A en el
  almacenamiento (onChanged) actualiza la línea; los botones de la miniatura siguen y, con un filtro que la excluye,
  la tarjeta tiene `youtube-groups--hidden`.
- [ ] T3 · Cerrar · Ficheros: `docs/ARCHITECTURE.md` (fila de `modules/groups.js` con `buildChannelColorIndex` y
  `getStripeBackground`; fila de `ui/cards.js`; flujo "Detección" o uno nuevo "Línea de color en suscripciones"), este
  plan a `hecho` · Test: `make lint`, `make test` y V1 a V4.

### Verificación manual (Firefox, A azul con el canal X, B rojo con X e Y, C sin color con Z)

- V1 · En suscripciones (cuadrícula): los vídeos de Y tienen una línea roja de 3 px justo encima; los de X, mitad azul y
  mitad roja; los de Z, ninguna. La línea no tapa la miniatura ni desalinea las filas, en tema claro y oscuro.
- V2 · Vista de lista de suscripciones y estanterías de Shorts: la línea se ve bien o, como mínimo, no estorba; si no,
  se anota y se ajusta con un cambio aprobado.
- V3 · Cambiar el color de B en el editor: la línea cambia en la pestaña de suscripciones sin recargar. Ir a inicio:
  no hay líneas; volver a suscripciones: vuelven.
- V4 · Regresión: filtro por grupos, ocultar/atenuar vistos, botones de miniatura y vista previa al pasar el cursor
  sin cambios; desplazar suscripciones no produce trabajo continuo (perfilador o consola sin repintados en bucle).

## Criterios de aceptación

- En `/feed/subscriptions`, cada vídeo cuyo canal está en algún grupo o subgrupo con color (propio o heredado) muestra
  una línea de 3 px en su borde superior con ese color; con varios colores distintos, la línea se divide en partes
  iguales (como mucho 4, en el orden del árbol); sin color, no hay línea.
- Fuera de suscripciones no hay líneas.
- La línea se actualiza al cambiar grupos o colores, sin recargar, y no rompe filtros, visibilidad ni botones.

## Fuera de alcance

- Líneas en inicio, búsqueda, recomendaciones o páginas de canal.
- Mostrar el nombre o el icono del grupo en la tarjeta.
- Un ajuste para activar o desactivar la línea.

## Cambios aprobados

Cambios sobre el plan después de aprobarlo. Sin una línea aquí, un cambio no está aprobado.

| Fecha | Tarea | Cambio | Motivo | Aprobado por |
| --- | --- | --- | --- | --- |

## Registro

Una línea por commit, añadida **antes** de commitear. El plan actualizado va en el mismo commit que el cambio.

| Fecha | Tarea | Commit | Nota |
| --- | --- | --- | --- |
| 2026-11-17 | T1 | feat: índice de colores por canal y fondo de la línea en groups.js | `buildChannelColorIndex` y `getStripeBackground` con tests. |
| 2026-11-17 | T2 | feat: línea de color del grupo en las tarjetas de suscripciones | `applyGroupStripe` y `refreshChannelColorIndex` en cards.js, CSS, llamada en content.js y tests jsdom. |
