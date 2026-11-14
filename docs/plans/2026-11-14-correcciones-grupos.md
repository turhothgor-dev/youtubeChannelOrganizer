# Plan: correcciones de grupos, desplegable, filtro y tarjetas reutilizadas

**Estado:** hecho

Issue: fallos detectados en la revisión del plan `docs/plans/2026-11-14-boton-canal-video.md` (estado `hecho`;
el borrado de subgrupos figuraba en su **Fuera de alcance** como "para otro plan").

<!-- Estados: borrador → aprobado (AAAA-MM-DD) → hecho. Se cambia solo la línea `**Estado:**`, y lo
     hace quien tiene la aprobación de una persona; los subagentes no ven la conversación, solo este fichero. -->

## Contexto y decisión

**Qué falla** (código en 4122c77):

1. **Eliminar un subgrupo falla.** El botón "Eliminar" del panel (`content.js`, ~línea 411) llama a
   `deleteGroup(group.id)` también para subgrupos, y `deleteGroup` (`modules/groups.js`) solo busca en el primer
   nivel con `findIndex`: lanza "No existe el grupo indicado.". Además, `content.js` solo desactiva el filtro si el
   grupo borrado es el activo; si el activo es un descendiente del borrado, el filtro queda apuntando a un id que
   ya no existe. Revisión del resto de operaciones del módulo: `renameGroup`, `addChannelToGroup`,
   `removeChannelFromGroup`, `createSubGroup`, `getSubGroups`, `setGroupAppearance`, `getGroupChannelUrls` y
   `applyChannelGroupSelection` ya recorren todos los niveles (`findGroupById` o recursión propia);
   `deleteSubGroup` también, pero `content.js` no la usa. Solo `deleteGroup` tiene el fallo en lo que usa la
   interfaz; `isChannelInGroup`/`getGroupsForChannel` (módulo) y `getAllChannelsFromGroup` (`content.js`) también
   miran solo el primer nivel, pero no se usan (ver **Fuera de alcance**).
2. **Guardar en el desplegable puede borrar el canal anterior.** `openSubscriptionGroupsForm` (~847-903) vacía
   las casillas al abrir, pero deja el botón Guardar habilitado y `form.dataset.channelName/channelUrl` con el
   canal de la apertura anterior hasta que `getGroups()` responde. Si se envía el formulario en ese intervalo (por
   ejemplo, con Enter), el `submit` (~935-972) llama a `setChannelGroups(canalAnterior, [])`, que quita el canal
   anterior de todos sus grupos. Además, el `finally` del `submit` vuelve a habilitar Guardar aunque entretanto se
   haya abierto el desplegable para otro canal.
3. **Parpadeo del filtro.** `refreshActiveGroupFilter` (~1107-1152) pone `activeGroupChannelUrls = null` y llama a
   `showAllVideoCards()` antes de leer los grupos, y aplica el filtro en un `setTimeout`: tras cada guardado,
   navegación o cambio de grupo se ven todas las tarjetas un instante. `setActiveGroup` añade otro
   `setTimeout(filterAllDetectedCards)` que, con el cambio de esta tarea, filtraría con el `Set` del grupo anterior.
4. **Tarjetas reutilizadas con canal obsoleto.** `detectCard` (~1016) sale si la tarjeta ya está en
   `detectedCards`, así que si YouTube reutiliza el elemento para otro vídeo,
   `data-youtube-groups-channel-url` conserva el canal antiguo y el filtro oculta o muestra la tarjeta según un
   canal que ya no es el suyo. El `MutationObserver` solo observa `childList`, de modo que un cambio solo de
   `href` en el enlace del canal ni siquiera vuelve a programar la tarjeta.

**Decisiones** (delegadas por la persona):

- **Borrado a cualquier nivel con una función pura.** En `modules/groups.js`, nueva función pura y exportada
  `removeGroupById(groups, groupId)` que busca el grupo a cualquier nivel y devuelve
  `{ groups, removedIds }` sin mutar la entrada (`removedIds`: el id borrado y los de todos sus descendientes); si
  no existe lanza `Error("No existe el grupo indicado.")`. `deleteGroup(groupId)` la usa (una lectura, una
  escritura) y **devuelve `removedIds`** en lugar de `true`. Es un cambio de la interfaz pública del módulo: el
  único llamante es `content.js`, que usa el valor para desactivar el filtro si el grupo activo está entre los
  borrados. `deleteSubGroup` no se toca (no se usa; ver **Fuera de alcance**).
- **Desplegable sin canal hasta que carga.** Al principio de `openSubscriptionGroupsForm`, en todos los casos (con
  y sin canal): Guardar deshabilitado y `dataset.channelName/channelUrl` vacíos. Solo se rellenan cuando la
  respuesta de `getGroups()` es de la apertura vigente, y `renderChannelGroupChoices` habilita Guardar si hay
  grupos (como hoy). El `submit` no hace nada si `dataset.channelUrl` está vacío (segunda barrera) y su `finally`
  solo restaura el botón si no ha habido otra apertura desde que se pulsó Guardar (contador
  `subscriptionDropdownOpenCount`).
- **Filtro sin mostrar todo.** `refreshActiveGroupFilter` lee los grupos, calcula el `Set` y, si sigue siendo la
  actualización vigente, lo asigna y aplica `filterAllDetectedCards()` de forma síncrona. Mientras tanto, las
  tarjetas siguen con el filtro anterior (sin mostrar todo). Si el grupo activo ya no existe, llama a
  `setActiveGroup(null)` (muestra todo y repinta el panel) en lugar de dejar el filtro a medias. Se quita el
  `setTimeout(filterAllDetectedCards)` de `setActiveGroup`.
- **Releer el canal si cambia su enlace.** `detectedCards` pasa de `WeakSet` a `WeakMap` tarjeta →
  `{ link, href }` (el elemento enlace del canal y su `href` al leerlo). `detectCard` solo se salta la tarjeta si
  ese enlace sigue dentro de la tarjeta y con el mismo `href`; si no, vuelve a leer el canal, actualiza los
  `data-*` y reaplica el filtro a esa tarjeta; si ya no hay canal, borra los `data-*` y la entrada. El observador
  añade `attributes: true, attributeFilter: ["href"]` para que un cambio solo de `href` vuelva a programar la
  tarjeta (el `mutation.target` es el enlace y `scheduleContainingCard` ya sube hasta la tarjeta). Se vigila el
  enlace del canal, no el del vídeo: el filtro depende solo del canal.

Alternativas descartadas:

- Que `content.js` llame a `deleteSubGroup` para los subgrupos: deja dos funciones de borrado con mensajes
  distintos y la lógica de "qué ids desaparecen" sin test.
- Ocultar el formulario del desplegable mientras carga: no evita el envío si ya estaba visible con el canal
  anterior, y hace saltar la posición; deshabilitar y vaciar es suficiente.
- Quitar la caché de `detectCard` y releer siempre: un `querySelectorAll` por tarjeta y mutación, justo lo que el
  plan anterior eliminó con `scanSubscriptionsPage`.
- Observar todos los atributos (`attributes: true` sin filtro): YouTube cambia atributos constantemente; con
  `attributeFilter: ["href"]` el coste es un `closest()` por cambio de enlace, agrupado por `requestAnimationFrame`.
- `jsdom` para probar el DOM: dependencia nueva; las tareas de `content.js` se verifican a mano (como en el plan
  anterior). Sin dependencias nuevas.

No hay ADR: no cambia el formato (ADR 0001), ni la estructura, ni se añaden dependencias. `docs/ARCHITECTURE.md`
no cambia.

## Tareas

Cada tarea es del tamaño de un commit. Al tocar `content.js`, no introducir `innerHTML` con valores interpolados y
quitar los `console.log`/`console.debug` de diagnóstico de las funciones que se modifiquen (se mantienen
`console.error` y `console.warn` de errores reales). Los tests usan `tests/helpers/load-modules.js` (`loadModules`,
`plain`) como los existentes.

- [x] T1 · Eliminar grupos y subgrupos a cualquier nivel. En `modules/groups.js`, añadir y exportar
  `removeGroupById(groups, groupId)` (pura, descrita en **Decisiones**) y reescribir `deleteGroup` para que la use y
  devuelva `removedIds`. En `content.js`, el botón "Eliminar" usa `const removedIds = await deleteGroup(group.id)`
  y llama a `setActiveGroup(null)` si `removedIds.includes(getActiveGroupId())`, en lugar de comparar solo con
  `group.id` · Ficheros: `modules/groups.js`, `content.js`, `tests/groups.test.js` · Test (nuevos en
  `tests/groups.test.js`): `removeGroupById` borra un grupo de primer nivel y devuelve su id y los de sus
  descendientes; borra un subgrupo de segundo nivel (grupo → subgrupo → subgrupo) dejando intactos el padre y los
  hermanos; id desconocido lanza "No existe el grupo indicado."; no muta la entrada. `deleteGroup` de un subgrupo
  anidado lo quita del almacenamiento con una sola llamada a `set` y devuelve sus ids; con id desconocido lanza y
  no escribe. Regresión del resto de la revisión: `renameGroup` y `setGroupAppearance(id, "", "")` sobre un
  subgrupo anidado lo modifican. `make test`, `make lint` y a mano V1.
- [x] T2 · Desplegable sin canal anterior mientras carga. En `content.js`, `openSubscriptionGroupsForm`
  deshabilita Guardar y vacía `form.dataset.channelName` y `form.dataset.channelUrl` al principio, antes de
  distinguir si hay canal (la rama sin canal deja de repetirlo); el `then` de la apertura vigente rellena el
  `dataset` antes de mostrar el formulario. En el `submit` del desplegable: si `form.dataset.channelUrl` está vacío,
  sale sin guardar; se guarda el valor de `subscriptionDropdownOpenCount` al empezar y el `finally` solo restaura
  texto y estado de Guardar si no ha cambiado (si ha cambiado, solo restaura el texto y lo deja deshabilitado;
  la nueva apertura lo habilitará) · Ficheros: `content.js` · Test: `make lint`, `make test` y a mano V2 y V3.
- [x] T3 · Filtro sin parpadeo. En `content.js`, `refreshActiveGroupFilter`: sin grupo activo, como hoy
  (`activeGroupChannelUrls = null` y `showAllVideoCards()`); con grupo activo, no toca `activeGroupChannelUrls` ni
  la visibilidad antes de `await getGroups()`; si la actualización sigue vigente, calcula
  `YouTubeGroups.getGroupChannelUrls`; si devuelve `null`, llama a `setActiveGroup(null)` y sale; si no, asigna el
  `Set` y llama a `filterAllDetectedCards()` sin `setTimeout`. En `setActiveGroup`, quitar el
  `setTimeout(filterAllDetectedCards)` y el `console.log` de cambio de grupo · Ficheros: `content.js` · Test:
  `make lint`, `make test` y a mano V4 y V5.
- [x] T4 · Releer el canal de tarjetas reutilizadas. En `content.js`: `detectedCards` pasa a `WeakMap` (también en
  `yt-navigate-finish`); `detectCard` sigue la regla de **Decisiones** (usar `findChannelLink` una vez para obtener
  enlace, nombre y URL normalizada, sin la rama `console.warn` de URL no normalizable, que no puede darse porque
  `findChannelLink` ya exige URL de canal); quitar `loggedChannelUrls` y su `console.debug`. El observador añade
  `attributes: true, attributeFilter: ["href"]` a `observer.observe` · Ficheros: `content.js` · Test: `make lint`,
  `make test` y a mano V6 y V7.
- [x] T5 · Hallazgos de la revisión (ver **Cambios aprobados**): (a) quitar `clearDetectedChannelData()` de
  `yt-navigate-finish` (el `WeakMap` nuevo ya obliga a releer) para que no haya destello al navegar con filtro
  activo; (b) en `tests/groups.test.js`, el test de `setGroupAppearance` en subgrupo anidado crea el subgrupo con
  icono y color no vacíos, los cambia y comprueba los valores nuevos; (c) al eliminar un grupo, si el activo no
  está entre `removedIds` y hay grupo activo, llamar a `refreshActiveGroupFilter()`; (d) en el `submit` del
  desplegable, aplicar `form.hidden = true` y el texto de error solo si `submitOpenId ===
  subscriptionDropdownOpenCount` · Ficheros: `content.js`, `tests/groups.test.js` · Test: `make test` (b), `make
  lint` y a mano V4.

### Verificación manual (con `make up`)

- V1 · Crear un grupo con un subgrupo y, dentro, otro subgrupo. "Eliminar" en el subgrupo más profundo y luego en
  el intermedio: desaparecen del panel sin error y siguen sin estar tras recargar (F5). Con un subgrupo activo como
  filtro, eliminar su grupo padre: el filtro vuelve a "Todos" y se ven todas las tarjetas. Renombrar y cambiar el
  icono de un subgrupo funciona.
- V2 · En `about:debugging` → Inspeccionar la extensión, poner un punto de ruptura en `getGroups` (o en el `then`
  de `openSubscriptionGroupsForm`). Abrir el desplegable del canal A y guardar; abrir el del canal B y, con la
  ejecución detenida, comprobar que Guardar está deshabilitado y que `form.dataset.channelUrl` está vacío; pulsar
  Enter en el formulario: no se guarda nada. Tras continuar, "Ver canales" muestra A en los mismos grupos que
  antes.
- V3 · Uso normal del desplegable: abrir, marcar, guardar; el canal queda en los grupos marcados. Abrir dos
  botones seguidos de canales distintos: solo se ven las casillas del segundo y Guardar se habilita cuando
  aparecen.
- V4 · Con un grupo activo, guardar desde el botón de una tarjeta, cambiar a otro grupo y navegar a otra página y
  volver: en ningún momento aparecen de golpe todas las tarjetas (grabar la pantalla o mirar con atención; antes
  del cambio se veía el destello).
- V5 · Con un subgrupo activo, el filtro solo muestra sus vídeos (y los de sus descendientes); "Todos" muestra
  todo.
- V6 · En `/` o `/feed/subscriptions` con un grupo activo, hacer scroll largo hacia abajo y volver arriba (YouTube
  recicla tarjetas): cada tarjeta visible es de un canal del grupo. En el inspector, en una tarjeta,
  `data-youtube-groups-channel-url` coincide con el enlace del canal que muestra.
- V7 · En la consola de la página, cambiar a mano el `href` del enlace de canal de una tarjeta visible a un canal
  que no esté en el grupo activo: la tarjeta se oculta y su `data-youtube-groups-channel-url` cambia.

## Criterios de aceptación

- Eliminar un subgrupo, a cualquier nivel, funciona y persiste; eliminar un grupo elimina también sus subgrupos.
- Si el grupo o subgrupo activo desaparece (borrado él o un antecesor), el filtro vuelve a "Todos".
- Renombrar, cambiar icono y color, añadir canales y crear subgrupos funcionan también sobre subgrupos anidados.
- Mientras el desplegable de una tarjeta carga los grupos de un canal, no se puede guardar, y guardar nunca
  modifica los grupos de un canal abierto antes.
- Guardar, cambiar de grupo activo o navegar con un filtro activo no muestra todas las tarjetas ni siquiera un
  instante.
- Una tarjeta que YouTube reutiliza para un vídeo de otro canal se filtra según su canal actual.
- Los grupos guardados siguen cargando (formato versión 1, ADR 0001, sin cambios).
- `make lint` y `make test` pasan, sin avisos `UNSAFE_VAR_ASSIGNMENT` nuevos (3 como máximo).

## Fuera de alcance

- Código sin uso: `deleteSubGroup`, `getSubGroups`, `isChannelInGroup` y `getGroupsForChannel` en
  `modules/groups.js`, y `getAllChannelsFromGroup` en `content.js` (los dos últimos de cada lista solo miran el
  primer nivel, pero nadie los llama). Se pueden borrar en un plan de limpieza.
- El formulario "Canal actual" del panel: lee el canal al guardar (`getCurrentVideoChannel()`) y no tiene el
  problema del desplegable.
- Cambiar el formato de almacenamiento o la identidad canónica de canales (ADR 0001).
- Sincronizar otras pestañas (`storage.onChanged`) o escrituras concurrentes entre pestañas.
- Detectar la reutilización de una tarjeta por el enlace del vídeo, o tarjetas cuyo canal no es un enlace.
- El `setTimeout(filterAllDetectedCards, 100)` del arranque y el resto de `console.log` de `content.js` fuera de
  las funciones modificadas.
- Botón en búsqueda, recomendaciones, listas o Shorts (`ROADMAP.md`, fase 5).

## Cambios aprobados

Cambios sobre el plan después de aprobarlo. Sin una línea aquí, un cambio no está aprobado.

| Fecha | Tarea | Cambio | Motivo | Aprobado por |
| --- | --- | --- | --- | --- |
| 2026-11-14 | T5 (nueva) | Corregir hallazgos de la revisión: destello al navegar, test de apariencia, filtro tras borrar subgrupo descendiente, desplegable tras guardado tardío | Revisión `revisar-cambios` de 6c7568a..HEAD (2 importantes, 2 sugerencias) | Persona (delegó decisiones a la opción recomendada) |

## Registro

Una línea por commit, añadida **antes** de commitear. El plan actualizado va en el mismo commit que el cambio.

| Fecha | Tarea | Commit | Nota |
| --- | --- | --- | --- |
| 2026-11-14 | T1 | `fix: eliminar grupos y subgrupos a cualquier nivel` | `removeGroupById` pura, `deleteGroup` devuelve `removedIds`; V1 pendiente a mano |
| 2026-11-14 | T2 | `fix: no guardar en el desplegable hasta cargar el canal` | Guardar deshabilitado y `dataset` vacío al abrir; `submit` ignora canal vacío y respeta `subscriptionDropdownOpenCount`; V2 y V3 pendientes a mano |
| 2026-11-14 | T3 | `fix: aplicar el filtro de grupo sin mostrar todas las tarjetas` | `refreshActiveGroupFilter` no resetea el filtro con grupo activo y filtra de forma síncrona; grupo inexistente llama a `setActiveGroup(null)`; sin `setTimeout` en `setActiveGroup`; V4 y V5 pendientes a mano |
| 2026-11-14 | T4 | `fix: releer el canal de las tarjetas reutilizadas` | `detectedCards` pasa a `WeakMap` con `{ link, href }`; `detectCard` relee si cambia el enlace; observador con `attributeFilter: ["href"]`; sin `loggedChannelUrls`; V6 y V7 pendientes a mano |
| 2026-11-14 | T5 | `fix: corregir hallazgos de la revisión de grupos y filtro` | Sin `clearDetectedChannelData` al navegar (función eliminada); test de apariencia con valores no vacíos; `refreshActiveGroupFilter` tras borrar si el activo sigue; `submit` del desplegable solo oculta/muestra error en la apertura vigente; V4 pendiente a mano |
