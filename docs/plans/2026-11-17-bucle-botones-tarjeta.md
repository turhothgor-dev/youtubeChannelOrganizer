# Plan: cortar el bucle de reprocesado de las tarjetas con botones

**Estado:** aprobado (2026-11-17)

Issue: sin issue (detectado por los tests de humo del refactor de `content.js`, ver
`docs/plans/2026-11-17-refactor-content-js.md`, Registro de la revisión).

## Contexto y decisión

`setCardButtonContent` (`ui/icons-dom.js`) reescribe siempre `labelEl.textContent = label` y vacía y recrea el glifo
(`glyphEl.textContent = ""` + SVG o texto), aunque nada haya cambiado. Asignar `textContent` sustituye los nodos hijos
aunque el texto sea el mismo, así que genera una mutación `childList` dentro de la tarjeta. El `MutationObserver` de
`content.js` (`childList`, `subtree`, y atributos solo `href` e `is-active`) llama a `scheduleContainingCard`, que vuelve
a programar la tarjeta; `processPendingCards` → `applyWatchedToCard` → `updateWatchedButton` → `setCardButtonContent`
vuelve a escribir, y así en cada frame: CPU continuo en cualquier página con tarjetas con botones. En los tests lo
oculta `flushLoose` (`tests/helpers/youtube-fixtures.js`), que se traga el error "flush: no se estabiliza".

**Decisión**: que el procesado de una tarjeta solo escriba en el DOM lo que cambia.

- `setCardButtonContent`: escribe el texto de la etiqueta solo si `labelEl.textContent !== label`, y `aria-label` solo
  si es distinto. Para el glifo guarda lo pintado en un atributo del `span` del glifo,
  `data-youtube-groups-glyph`, con valor `icon:<id>` o `text:<texto>`; si coincide con lo pedido, no toca el glifo; si
  no, lo vacía, lo repinta como ahora y actualiza el atributo. Con `glyph === null` sigue sin tocar el glifo.
- Revisión del resto del procesado (`processPendingCards`): las únicas escrituras de nodos (`childList`) que se repiten
  son las de `setCardButtonContent`; `ensureChannelControl` y `ensureChannelResultControl` ya son idempotentes (solo
  crean o mueven el control una vez) y `classList.toggle(clase, forzado)` y `removeAttribute` de un atributo ausente
  no generan mutaciones. Las escrituras de atributos que se repiten con el mismo valor sí generan registros, aunque
  hoy no realimentan el bucle porque el `attributeFilter` de `content.js` solo mira `href` e `is-active`. Se hacen
  también condicionales (sin cambiar el valor final), para que la garantía no dependa de ese filtro:
  - `applyWatchedToCard` (`ui/watched.js`): `setAttribute(VIDEO_ID_ATTRIBUTE, videoId)` solo si es distinto;
    `playlistButton.disabled` solo si cambia.
  - `updateWatchedButton` (`ui/watched.js`): `aria-pressed`, `disabled` y `title` solo si cambian. La rama del botón del
    panel (texto plano) no se toca: no está en una tarjeta.
  - `updateAddButtonAvailability` (`ui/cards.js`): `disabled` y `title` solo si cambian.
  - `detectCard` (`ui/cards.js`): `dataset.youtubeGroupsChannelName` y `dataset.youtubeGroupsChannelUrl` solo si
    cambian.
  - `applyCardVisibility` ya es idempotente (`classList.toggle` con forzado); no se toca.

Basta con comparaciones en línea (`if (el.disabled !== x) el.disabled = x;`); no hace falta una función auxiliar nueva
ni cambiar la interfaz pública de ningún componente.

**Alternativas descartadas**:

- Desconectar el `MutationObserver` mientras se procesan las tarjetas (o filtrar en `content.js` las mutaciones bajo
  `.youtube-groups__subscription-control`): oculta el síntoma, perdería mutaciones legítimas de YouTube en la misma
  tarjeta y deja escrituras inútiles en cada procesado.
- Comparar el SVG pintado (por ejemplo, el atributo `d` del `path`) en lugar de un atributo `data-*`: depende de la
  forma interna del SVG y no sirve para los glifos de texto (`+G`).

Sin dependencias nuevas. No es una decisión de arquitectura (no hay ADR); en `docs/ARCHITECTURE.md` se añade una
frase al flujo **Detección**.

## Tareas

- [x] T1 · Procesado de tarjetas idempotente: `setCardButtonContent` escribe etiqueta, `aria-label` y glifo solo si
  cambian (glifo pintado en `data-youtube-groups-glyph`), y las escrituras de atributos listadas en **Contexto y
  decisión** pasan a ser condicionales. Añadir en `docs/ARCHITECTURE.md`, flujo **Detección**, una frase: "Procesar una
  tarjeta ya al día no escribe en el DOM (`setCardButtonContent` y los atributos solo se escriben si cambian); si no,
  la mutación la vuelve a programar y se reprocesa en cada frame." · Ficheros: `ui/icons-dom.js`, `ui/watched.js`,
  `ui/cards.js`, `docs/ARCHITECTURE.md`, `tests/ui-icons-dom.test.js`, `tests/ui-cards.test.js` · Test:
  - `tests/ui-icons-dom.test.js`: "setCardButtonContent con los mismos datos no muta el botón": pinta un botón, pone un
    `MutationObserver` del `window` de jsdom sobre el botón (`childList`, `subtree`, `attributes`, `characterData`),
    repite la llamada con los mismos argumentos (con icono y con texto) y comprueba que `observer.takeRecords()` está
    vacío. Otro: "setCardButtonContent cambia el glifo y la etiqueta cuando cambian": de `("eye", "Marcar visto")` a
    `("check", "Visto")` cambia etiqueta, `aria-label` y el glifo (un solo SVG y `data-youtube-groups-glyph` =
    `icon:check`); con `glyph` `null` conserva el glifo anterior.
  - `tests/ui-cards.test.js`: "una tarjeta con botones se estabiliza y reprocesarla no muta el DOM": `loadDom` con
    `SUBSCRIPTION_CARD_HTML` y `await dom.flush()` (el estricto, no `flushLoose`) no lanza; después se añade un
    `span` a la tarjeta (eso la vuelve a programar), se crea un `MutationObserver` del test sobre la tarjeta
    (`childList`, `subtree`, `attributes`, `characterData`), `await dom.flush()` no lanza y `takeRecords()` está vacío.
    Repetirlo con el vídeo guardado como visto en el `store` (glifo `check`, botón pulsado) para cubrir
    `updateWatchedButton` con estado distinto del inicial.
- [ ] T2 · Quitar la tolerancia de los tests: sustituir `await flushLoose(dom)` por `await dom.flush()` en todos los
  tests de `ui-*` y eliminar `flushLoose` (función, comentario y exportación) de `tests/helpers/youtube-fixtures.js`.
  Si algún test sigue sin estabilizarse tras T1, es otro bucle: no se vuelve a tolerar; se para y se informa (causa
  y propuesta) para anotarlo en **Cambios aprobados** o en un plan aparte · Ficheros:
  `tests/helpers/youtube-fixtures.js`, `tests/ui-cards.test.js`, `tests/ui-watched.test.js`,
  `tests/ui-dropdowns.test.js`, `tests/ui-player.test.js`, `tests/ui-icon-picker.test.js`,
  `tests/ui-icons-dom.test.js`, `tests/ui-guide-section.test.js` · Test: `make test` en verde con `flush` estricto en
  todos los tests de DOM, y `flushLoose` sin ninguna aparición en el repositorio (búsqueda en `tests/`).

## Criterios de aceptación

- En una página con tarjetas con botones (inicio, suscripciones, búsqueda, recomendaciones de `/watch`), una vez
  pintadas, la extensión deja de reprocesar tarjetas en cada frame: sin interacción ni cambios de YouTube no hay
  mutaciones del DOM causadas por la extensión (en los tests, `flush()` se estabiliza y un reprocesado no produce
  registros de mutación).
- Los botones se ven y se comportan igual que antes: "+G", "Marcar visto"/"Visto" con su glifo (`eye`/`check`),
  pulsado, deshabilitado y `title` de error; "Lista" con su glifo y deshabilitado sin ID de vídeo; "Añadir a grupo"
  deshabilitado con "No se pudo identificar el canal" en `/watch` mientras no se conoce el canal.
- Marcar o desmarcar un vídeo como visto sigue cambiando etiqueta, glifo y estado del botón en todas sus tarjetas y en
  el reproductor.
- No queda `flushLoose` en el repositorio y todos los tests de DOM usan `flush()` estricto; `make test` y `make lint` en
  verde.

## Fuera de alcance

- `content.js` y su `MutationObserver` (opciones, `attributeFilter`): no se tocan.
- `ui/player.js`: sus escrituras de `disabled` y `title` en `syncPlayerControl` no se cambian (el control no está en una
  tarjeta y solo se resincroniza por eventos o si falta); sí se beneficia del cambio de `setCardButtonContent`.
- El botón del panel "Vídeo actual" (rama de texto plano de `updateWatchedButton`), la sección de la guía y el panel.
- Cambios visuales, de textos o de la interfaz pública de los componentes de `ui/`.
- Otros posibles bucles que aparezcan al quitar `flushLoose` fuera del procesado de tarjetas (ver T2).

## Cambios aprobados

Cambios sobre el plan después de aprobarlo. Sin una línea aquí, un cambio no está aprobado.

| Fecha | Tarea | Cambio | Motivo | Aprobado por |
| --- | --- | --- | --- | --- |

## Registro

Una línea por commit, añadida **antes** de commitear. El plan actualizado va en el mismo commit que el cambio.

| Fecha | Tarea | Commit | Nota |
| --- | --- | --- | --- |
| 2026-11-17 | T1 | `fix: procesar tarjetas con botones sin reescribir el DOM si nada cambia` | `setCardButtonContent` y atributos condicionales; tests nuevos en `ui-icons-dom` y `ui-cards`. |
