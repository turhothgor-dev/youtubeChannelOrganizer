# Plan: GUI 5 (2/3) · Selección siempre múltiple y "Limpiar selección"

**Estado:** aprobado (2026-11-15)

Issue: feedback de la persona tras probar la serie `2026-11-15-gui-*` en Firefox (2026-11-15), punto 2.

<!-- Estados: borrador → aprobado (AAAA-MM-DD) → hecho. Se cambia solo la línea `**Estado:**`, y lo
     hace quien tiene la aprobación de una persona; los subagentes no ven la conversación, solo este fichero. -->

Orden de la serie GUI 5: `2026-11-15-gui-5-1-columna-propia` → **este plan** → `2026-11-15-gui-5-3-crear-subgrupos`.
Requisito: `gui-5-1` en `hecho` (la sección se pinta en la columna propia). ADR asociado:
`docs/adr/0009-seleccion-multiple-como-filtro.md` (propuesta; sustituye en parte al 0007; se acepta al cerrar).

## Contexto y decisión

Hoy el filtro es único (`activeFilter`: todos, grupo o canal) y pulsar otro elemento sustituye al anterior
(`toggleFilter`, ADR 0007). Decidido por la persona (2026-11-15): la selección es **siempre múltiple**. Cada clic en un
grupo, subgrupo o canal lo añade o lo quita; el filtro muestra la **unión** de sus canales; sin nada seleccionado es
"todos". Un botón "Limpiar selección", visible solo con selección, vuelve a "todos". Añadir fuera de suscripciones
navega a `/feed/subscriptions`; quitar no navega. Se descarta una tecla modificadora para la múltiple (ver ADR 0009).

### Decisiones

- **Selección** = array de claves (`group:<id>`, `channel:<url normalizada>`, de `getFilterKey`), sin repetidos, en
  orden de adición. `[]` = "todos". Funciones nuevas en `modules/filter.js` (sin DOM):
  - `parseFilterKey(key)` → filtro normalizado (`normalizeFilter`) o `null` si la clave no es `group:`/`channel:` válida.
  - `normalizeSelection(raw)` → array de claves válidas, renormalizadas con `parseFilterKey` + `getFilterKey`, sin
    repetidos (se queda la primera aparición); lo que no es array → `[]`.
  - `toggleSelection(selection, filter)` → array nuevo: quita la clave de `filter` si está; si no, la añade al final.
    `filter` no válido → la selección normalizada sin cambios. No muta la entrada.
  - `clearSelection()` → `[]`.
  - `resolveSelection(groups, selection)` → `{ selection, urls }`: `selection` solo con las claves que existen
    (`resolveFilterUrls` de cada una con estado `ok`), `urls` el `Set` unión de sus URL, o `null` si no queda ninguna.
  - `shouldNavigateOnSelect(pageType, previous, next)` → `true` si `next` tiene alguna clave que no está en `previous`
    y `pageType !== "subscriptions"`.
  - `serializePendingSelection(selection, now)` y `parsePendingSelection(text, now)`: formato `version: 2` del ADR
    0009, misma `PENDING_FILTER_KEY` y `PENDING_MAX_AGE_MS`; `parse` devuelve la selección normalizada no vacía o
    `null` (JSON roto, otra versión, incluida la `1`, vacía o caducada: fuera de 0–30000 ms).
  - Se conservan `ALL_FILTER`, `normalizeFilter`, `getFilterKey` y `resolveFilterUrls`. Se quitan, con sus tests, al
    dejar de usarse (T2): `toggleFilter`, `isFilterOnRemovedGroup`, `shouldNavigateToSubscriptions`,
    `serializePendingFilter` y `parsePendingFilter`.
- **`content.js`**: `activeFilter` → `activeSelection` (`[]`); `activeGroupChannelUrls` → `activeSelectionUrls`;
  `setActiveFilter` → `setActiveSelection(selection)` (normaliza; no hace nada si es igual elemento a elemento);
  `selectFilter` → `toggleSelectionItem(filter)` (calcula con `toggleSelection`, aplica y navega si
  `shouldNavigateOnSelect`); `refreshActiveFilter` → `refreshActiveSelection` (con `resolveSelection`; si se
  descartan claves, `console.warn` "Elementos del filtro no encontrados" y `setActiveSelection(kept)`; la comprobación
  de respuesta obsoleta compara la versión y la identidad del array). `handleGroupsRemoved` solo llama a
  `refreshActiveSelection` (el descarte cubre los grupos borrados). `getActiveFilterKey` desaparece.
  `navigateToSubscriptions`/`consumePendingFilter` usan la selección y las funciones `*PendingSelection`.
- **Regla de visibilidad**: `YouTubeGroupsVisibility.matchesGroupFilter` cambia el parámetro `activeGroupId` (clave)
  por `hasFilter` (booleano: hay selección). La regla no cambia: sin filtro o con URL aún cargando pasa; con canal,
  según esté en la unión; sin canal y con ID de vídeo no pasa; sin canal ni ID pasa.
- **Guía**: `aria-pressed` de grupos y canales = `activeSelection.includes(clave)` (un canal en varias listas se marca
  en todas). `YouTubeGroupsGuide.isChannelListOpen(overrides, item, depth, selection)` recibe la selección: abierta si
  algún canal del elemento está seleccionado (el override sigue ganando).
- **"Limpiar selección"**: botón en la parte fija de la sección (bajo el botón de crear y su formulario, no se
  desliza), con el texto "Limpiar selección (N)", oculto (`hidden`) con la selección vacía. Clic →
  `setActiveSelection([])`, sin navegar. Estilos claro/oscuro como el botón de crear.

## Tareas

Reglas comunes: sin `innerHTML` con datos; JSDoc; sin dependencias nuevas; `make lint` (0 avisos) y `make test` en
verde.

- [x] T1 · Funciones de selección en `modules/filter.js` (ver **Decisiones**), sin quitar aún las antiguas · Ficheros:
  `modules/filter.js`, `tests/filter.test.js` · Test: `parseFilterKey` con grupo, canal con parámetros (sale
  normalizado), prefijo desconocido, id vacío y no cadena; `normalizeSelection` quita repetidos e inválidos y da `[]`
  con no-array; `toggleSelection`: desde `[]` añade A; `[A]`+B → `[A, B]`; `[A, B]`+A → `[B]`; `[B]`+A → `[B, A]`;
  un canal escrito con otra forma que normaliza igual lo quita; grupo y canal con el mismo texto no se confunden;
  `next` no válido no cambia nada; no muta la entrada; `clearSelection()` da `[]`; `resolveSelection`: grupo con
  subgrupos + canal de otro grupo → unión; grupo borrado y canal huérfano se descartan y el resto queda; todo
  inexistente → `{ selection: [], urls: null }`; `[]` → `urls: null`; `shouldNavigateOnSelect`: añadir en `home` y
  `watch` → `true`, en `subscriptions` → `false`, quitar o igual → `false`;
  `parsePendingSelection(serializePendingSelection(s, t), t + 1000)` devuelve `s`; `null` con `t + 31000`, futuro,
  JSON roto, `version: 1`, selección vacía.
- [x] T2 · `content.js` con selección múltiple (ver **Decisiones**), `matchesGroupFilter` con `hasFilter`,
  `isChannelListOpen` con la selección, y quitar de `filter.js` las funciones antiguas con sus tests (cambio
  intencionado) · Ficheros: `content.js`, `modules/filter.js`, `modules/visibility.js`, `modules/guide.js`,
  `tests/filter.test.js`, `tests/visibility.test.js`, `tests/guide.test.js` · Test: `matchesGroupFilter` cubre los
  mismos casos que hoy con `hasFilter`; `isChannelListOpen` abierta en profundidad 0 si contiene un canal de la
  selección, cerrada con selección solo de grupos o vacía, override `false` gana; `make test` y a mano V1, V2, V4, V5.
- [x] T3 · Botón "Limpiar selección (N)" (ver **Decisiones**) · Ficheros: `content.js`, `content.css` · Test: `make
  lint`, `make test` y a mano V3.
- [ ] T4 · Cerrar: `docs/ARCHITECTURE.md` (fila de `filter.js` con las funciones nuevas, flujo **Filtro** con
  selección múltiple, unión y "Limpiar selección"; `matchesGroupFilter` con `hasFilter`; enlace al ADR 0009); ADR 0009
  a `aceptada` y ADR 0007 a "Estado: aceptada; puntos 1, 2, 4 y 5 sustituidos por 0009". Estado de este plan a `hecho`
  · Ficheros: `docs/ARCHITECTURE.md`, `docs/adr/0009-seleccion-multiple-como-filtro.md`,
  `docs/adr/0007-filtro-activo-y-paso-a-suscripciones.md`, este plan · Test: `make lint` y `make test`.

### Verificación manual (tu Firefox con sesión, extensión recargada; grupos A con subgrupo A1, B, y un canal c de B)

- V1 · En `/feed/subscriptions`: clic en A → vídeos de A y A1, A marcado. Clic en B → se ven A, A1 y B, los dos
  marcados. Clic en A → solo B. Clic en B → nada marcado, se ve todo. Clic en el canal c de una lista de A y en B:
  unión, sin repetir vídeos.
- V2 · En `/` y en un `/watch`: clic en A → pasa a suscripciones con A. Vuelve a `/`: clic en B (añade) → pasa a
  suscripciones con A y B. Vuelve a `/`: clic en A (quita) → **no** cambia de página.
- V3 · Sin selección no hay "Limpiar selección". Con A y c marcados aparece "Limpiar selección (2)"; pulsarlo
  desmarca todo, se ve todo y no cambia de página; el botón desaparece.
- V4 · Con A y B marcados, borrar A desde otra pestaña (o con "Limpieza" si está vacío): queda solo B. Quitar c de
  todos sus grupos con "+G" estando solo c marcado: vuelve a "todos".
- V5 · Regresión en suscripciones con A y B marcados: Filtros (duración, fecha, visualizaciones), Vídeos vistos
  (mostrar, atenuar, ocultar) y Vídeos fuera del filtro (ocultar, atenuar) funcionan como antes. Tema claro y oscuro.

## Criterios de aceptación

- Cada clic en un grupo, subgrupo o canal lo añade o lo quita de la selección; el filtro muestra la unión; sin
  selección se ve todo.
- "Limpiar selección" solo aparece con selección y vuelve a "todos" sin navegar.
- Añadir fuera de suscripciones lleva a `/feed/subscriptions` con toda la selección (también tras carga completa);
  quitar nunca navega.
- Los elementos borrados salen de la selección; si no queda ninguno, se ve todo.
- Filtros avanzados, vistos y modos de visibilidad funcionan igual; sin dependencias nuevas ni cambios de formato en
  `browser.storage.local`.

## Fuera de alcance

- Botón de crear según la selección y "›" en todos los grupos (`gui-5-3`).
- Marcar en la columna raíz el grupo que contiene un subgrupo seleccionado.
- Conservar la selección tras una recarga hecha por la persona (ADR 0003 y 0007).
- Botones sobre la miniatura y panel flotante.
- Tests de DOM de `content.js`.

## Cambios aprobados

Cambios sobre el plan después de aprobarlo. Sin una línea aquí, un cambio no está aprobado.

| Fecha | Tarea | Cambio | Motivo | Aprobado por |
| --- | --- | --- | --- | --- |

## Registro

Una línea por commit, añadida **antes** de commitear. El plan actualizado va en el mismo commit que el cambio.

| Fecha | Tarea | Commit | Nota |
| --- | --- | --- | --- |
| 2026-11-15 | T1 | `feat: funciones de selección múltiple en filter.js` | Funciones nuevas y tests; las antiguas se quitan en T2. |
| 2026-11-15 | T2 | `feat: content.js con selección múltiple y quitar el filtro único` | `content.js`, `matchesGroupFilter` (`hasFilter`) y `isChannelListOpen` (selección); funciones y tests antiguos fuera de `filter.js`. Pendiente V1, V2, V4, V5 a mano. |
| 2026-11-15 | T3 | `feat: botón Limpiar selección en la guía` | Botón fijo bajo el formulario de crear, oculto sin selección; estilos claro/oscuro. Pendiente V3 a mano. |
