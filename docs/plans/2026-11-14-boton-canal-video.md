# Plan: cerrar el botón "Añadir a grupo" del canal de cada vídeo (WIP de d6b6a8d)

**Estado:** borrador

Issue: commit d6b6a8d `feat(videos): added button to add video's channel to groups. WIP`

<!-- Estados: borrador → aprobado (AAAA-MM-DD) → hecho. Se cambia solo la línea `**Estado:**`, y lo
     hace quien tiene la aprobación de una persona; los subagentes no ven la conversación, solo este fichero. -->

## Contexto y decisión

**Qué hay hoy** (estado de `content.js` tras d6b6a8d; los commits posteriores solo tocan formato y
`manifest.json`). El diff de d6b6a8d no se ha podido leer al planificar; el análisis es sobre el código actual.

- Almacenamiento de grupos en `browser.storage.local` (`getGroups`, `saveGroups`, `createGroup`,
  `addChannelToGroup`, `removeChannelFromGroup`). Formato documentado en el ADR 0001.
- Panel fijo `#youtube-groups-panel` con la lista de grupos (filtro activo), "Crear grupo" y, en `/watch`, una
  sección "Canal actual" con casillas para añadir el canal del vídeo que se está viendo.
- En `/feed/subscriptions`, un control "Añadir a grupo" junto al enlace del canal de cada tarjeta, con casillas
  de grupos y "Guardar" (`scanSubscriptionsPage`, `addSubscriptionChannelControl`,
  `createSubscriptionChannelControl`), con muchos `console.log` de diagnóstico.

**Qué falla o falta** para que sea completo y fiable:

1. **No es "cada vídeo"**: `addSubscriptionChannelControl` deduplica por URL de canal en toda la página
   (`subscriptionChannelControls`), así que solo el primer vídeo de cada canal tiene botón.
2. **Dos recorridos del DOM en paralelo**: el escaneo de suscripciones repite lo que ya hace `detectCard` con el
   `MutationObserver` y `requestAnimationFrame`. Si YouTube vuelve a pintar el nombre del canal y borra el
   control, no se vuelve a insertar mientras esa URL siga en el mapa.
3. **Canal capturado en un closure**: el control guarda el canal al crearse. Si YouTube reutiliza la tarjeta para
   otro vídeo (navegación SPA), el botón guardaría el canal antiguo.
4. **Punto de inserción incoherente**: `getChannelFromCard` exige un enlace con nombre, pero
   `getChannelLinkFromCard` coge el primer enlace al canal, que puede ser el del avatar.
5. **Guardado no atómico y duplicado**: los dos formularios repiten el cálculo de altas y bajas y hacen una lectura
   y una escritura del almacenamiento por cada grupo cambiado. Guardar desde una tarjeta no refresca el panel.
6. **Panel "Canal actual" inestable**: cualquier mutación dentro del bloque del propietario (contador de
   suscriptores, botón de suscribirse) vuelve a pintar el panel, cierra el formulario y pierde las casillas
   marcadas.
7. **Sin grupos**: el selector se abre vacío, sin explicar que hay que crear un grupo.
8. **Sin tests**: todo está dentro de la IIFE de `content.js` y no se puede probar con `node --test`.

**Decisión.** Integrar el botón en el recorrido existente de tarjetas (`processPendingCards`): un control por
tarjeta que lee el canal de la propia tarjeta al abrirse y al guardar, y que se vuelve a insertar si YouTube lo
borra. La lógica sin DOM (normalizar la URL del canal y calcular la nueva pertenencia a grupos) se extrae a
`groups-model.js`, cargado antes de `content.js` en el manifiesto, para probarla con `node --test` y `node:vm`
sin dependencias nuevas. El formato de almacenamiento no cambia (ADR 0001).

Alternativas descartadas:

- Arreglar el escaneo de suscripciones por separado: deja dos recorridos del DOM que hacen lo mismo.
- Añadir `jsdom` para probar el DOM: dependencia nueva y fixtures que no reproducen el DOM real de YouTube, que
  es lo frágil. La parte de DOM se verifica a mano con `make up` y la lista de cada tarea.

### Preguntas abiertas (a responder al aprobar)

- **P1 · Dónde aparece el botón.** El código del WIP solo lo pone en `/feed/subscriptions`; el mensaje del commit
  habla del canal "de cada vídeo". Propuesta: T1-T4 lo cierran en suscripciones y T5 lo extiende a todas las
  tarjetas de `VIDEO_CARD_SELECTOR` (inicio, búsqueda, lista lateral de `/watch`, listas). Si la persona elige
  solo suscripciones, T5 se elimina del plan.
- **P2 · Identidad del canal (fase 2).** Se fija el formato actual (URL normalizada como clave) en el ADR 0001,
  que queda en `propuesta` hasta que la persona lo acepte. El problema de un mismo canal con dos URL se deja
  para la fase 2.
- **P3 · Alcance del WIP.** Confirmar que el WIP incluye tanto el control de suscripciones como la sección
  "Canal actual" del panel (este plan cierra ambos porque comparten el guardado).

## Tareas

Cada tarea es del tamaño de un commit, toca pocos ficheros y tiene un test que la valida.

- [ ] T1 · Crear `groups-model.js` (script clásico, sin DOM ni `browser.*`) que expone
  `globalThis.YouTubeGroupsModel` con `normalizeChannelUrl(href, origin)` (misma lógica que la actual, con el
  origen como parámetro; devuelve `null` si no es un canal o es otro origen). Cargarlo antes de `content.js` en
  `manifest.json` (`"js": ["groups-model.js", "content.js"]`) y hacer que `content.js` lo use en lugar de su
  copia. Añadir `tests` a `ignoreFiles` de `web-ext-config.mjs`. Sin cambios de comportamiento · Ficheros:
  `groups-model.js`, `content.js`, `manifest.json`, `web-ext-config.mjs`, `tests/groups-model.test.js` · Test:
  `tests/groups-model.test.js` carga el fichero con `node:vm` y cubre `/@handle`, `/channel/UC...`, `/c/`,
  `/user/`, query y fragmento eliminados, barra final, ruta de vídeo (`/watch`, `/@handle/videos`) y otro origen
  (`null`); `make test`, `make lint`, y `make build` genera un `.zip` con `groups-model.js` y sin `tests/`.
- [ ] T2 · Guardado único de la pertenencia. Añadir al modelo `applyChannelGroupSelection(groups, channel,
  selectedGroupIds)` que devuelve `{ groups, addedGroupIds, removedGroupIds }` sin mutar la entrada, valida
  nombre y URL del canal (mismo mensaje de error que hoy), no duplica el canal e ignora ids desconocidos. En
  `content.js`, una función `saveChannelGroups(channel, selectedGroupIds)` que lee una vez, aplica y escribe una
  vez (solo si hay cambios); la usan los dos formularios (panel y tarjeta), y tras guardar se refrescan el panel
  y el filtro activo. Quitar `addChannelToGroup` y `removeChannelFromGroup` si quedan sin uso · Ficheros:
  `groups-model.js`, `content.js`, `tests/groups-model.test.js` · Test: casos de alta, baja, sin cambios, canal ya
  presente, id desconocido, canal sin nombre o URL (error) y entrada no mutada; a mano con `make up`: guardar
  desde una tarjeta de suscripciones marca la casilla en el panel en `/watch` de ese canal tras recargar.
- [ ] T3 · Un botón por tarjeta, dentro del recorrido de tarjetas. Sustituir `scanSubscriptionsPage`,
  `scheduleSubscriptionsScan`, `addSubscriptionChannelControl`, `subscriptionChannelControls` y los `console.log`
  de diagnóstico por `ensureChannelControl(card)`, llamado desde `processPendingCards` para cada tarjeta
  programada (aunque ya estuviera detectada) cuando `shouldShowChannelControls()` sea cierto (en esta tarea:
  solo `/feed/subscriptions`). Reglas: como máximo un control por tarjeta (se comprueba dentro de la tarjeta);
  se inserta tras el enlace de canal que tiene nombre (el mismo que usa `getChannelFromCard`); el control no
  guarda el canal: lo lee de su tarjeta al abrir y al guardar, y si ya no hay canal muestra el error "No se ha
  podido identificar el canal."; si no hay grupos, muestra "Crea un grupo en el panel para añadir canales." en
  lugar de la lista vacía y sin botón Guardar activo. Mantener las clases CSS actuales y que los clics no
  naveguen · Ficheros: `content.js`, `content.css` (solo si hace falta para el mensaje) · Test: `make lint`,
  `make test` y la verificación manual V1-V5 de abajo.
- [ ] T4 · Panel "Canal actual" estable. Volver a pintar la sección solo cuando cambie la URL del canal del
  propietario (o los grupos), no con cualquier mutación del bloque; con el formulario abierto, las casillas
  marcadas se conservan · Ficheros: `content.js` · Test: verificación manual V6.
- [ ] T5 · (solo si P1 = todas las páginas) Extender `shouldShowChannelControls()` a todas las tarjetas de
  `VIDEO_CARD_SELECTOR` y ajustar `content.css` para que el control no rompa la maquetación de rejilla, búsqueda
  y lista lateral · Ficheros: `content.js`, `content.css` · Test: verificación manual V1-V3 en inicio, búsqueda,
  lista lateral de `/watch` y una lista de reproducción.

### Verificación manual (con `make up`)

- V1 · En `/feed/subscriptions`, cada tarjeta de vídeo con enlace de canal tiene exactamente un botón, también
  dos vídeos seguidos del mismo canal y las tarjetas que se cargan al hacer scroll.
- V2 · Ir a otra página y volver a suscripciones (navegación interna, sin recargar): sigue habiendo un botón por
  tarjeta y cada uno abre el selector con el canal correcto.
- V3 · Pulsar el botón, marcar o desmarcar grupos y guardar no navega al canal ni al vídeo; tras recargar (F5) la
  pertenencia se mantiene y un canal no aparece dos veces en un grupo.
- V4 · Sin grupos creados, el selector muestra el mensaje para crear uno.
- V5 · Con un grupo activo en el panel, guardar un canal en ese grupo hace visibles sus vídeos sin recargar.
- V6 · En `/watch`, abrir "Añadir a un grupo" en el panel y esperar a que cambie algo del bloque del canal (o
  pasar el ratón por "Suscribirse"): el formulario sigue abierto con lo marcado. Al pasar a otro vídeo de otro
  canal, el nombre cambia y el formulario se cierra.

## Criterios de aceptación

- Cada vídeo de la página de suscripciones (y del resto de listados si P1 = todas) muestra un botón "Añadir a
  grupo" del canal de ese vídeo, también en vídeos cargados de forma dinámica y tras navegar dentro de YouTube.
- El selector muestra todos los grupos con marcados aquellos que ya contienen el canal; al guardar, el canal queda
  exactamente en los grupos marcados y se mantiene tras recargar.
- Guardar desde una tarjeta o desde el panel actualiza al momento el filtro activo y el panel.
- El formulario del panel en `/watch` no se cierra solo mientras se usa.
- Los grupos guardados antes del cambio siguen cargando (formato versión 1 sin cambios).
- `make lint` y `make test` pasan; `make build` incluye `groups-model.js` y no incluye `tests/`.

## Fuera de alcance

- Cambiar el formato de almacenamiento, migraciones o la identidad canónica de canales (ADR 0001, fase 2).
- Mejorar la detección del canal en tarjetas sin enlace de canal (por ejemplo, la lista lateral de `/watch` si el
  nombre no es un enlace, o nuevos diseños de tarjeta de YouTube): esas tarjetas no tendrán botón. Es fase 1.
- Shorts, la página de un canal y el filtrado (fase 4) más allá de refrescarlo al guardar.
- Sincronizar otras pestañas (`storage.onChanged`), `background.js`, popup u opciones.
- Rediseñar el panel, cerrar el selector al hacer clic fuera o con Escape, renombrar clases CSS, traducciones.

## Cambios aprobados

Cambios sobre el plan después de aprobarlo. Sin una línea aquí, un cambio no está aprobado.

| Fecha | Tarea | Cambio | Motivo | Aprobado por |
| --- | --- | --- | --- | --- |

## Registro

Una línea por commit, añadida **antes** de commitear. El plan actualizado va en el mismo commit que el cambio.

| Fecha | Tarea | Commit | Nota |
| --- | --- | --- | --- |
