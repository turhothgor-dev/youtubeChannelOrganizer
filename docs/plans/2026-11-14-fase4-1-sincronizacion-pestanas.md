# Plan: Fase 4 (1/3) · Sincronización entre pestañas

**Estado:** aprobado (2026-11-14)

Issue: `ROADMAP.md`, Fase 4: "Sincronización cruzada" (primera mitad; la cierra el plan
`2026-11-14-fase4-2-copia-seguridad.md`).

<!-- Estados: borrador → aprobado (AAAA-MM-DD) → hecho. Se cambia solo la línea `**Estado:**`, y lo
     hace quien tiene la aprobación de una persona; los subagentes no ven la conversación, solo este fichero. -->

## Contexto y decisión

Cada pestaña lee los datos al arrancar y no ve los cambios de otra hasta recargar. Decisión (ADR 0006, punto 1):
`content.js` escucha `browser.storage.onChanged` y aplica cada clave cambiada a su caché y a la interfaz. Sin
permisos nuevos ni cambios de formato. Se descarta un `background.js` como único escritor (ver ADR 0006).

Decisiones (delegadas por la persona):

- **`modules/storage.js`** expone lectores puros del valor guardado, que reutilizan los `get*` actuales:
  `readGroupsValue(data)` (`data.groups` si es array; si no, `[]`), `readWatchedValue(data)` (`data.videos` si es
  objeto plano; si no, `{}`), `readSettingsValue(data)` (`data.settings` si es objeto plano; si no, `{}`) y
  `readPlaylistsValue(data)` (`data.playlists` si es array; si no, `[]`). `getGroups` conserva su inicialización a
  `[]` cuando no hay datos válidos.
- `getChangedKeys(changes, areaName)`: `[]` si `areaName !== "local"`; si no, los nombres lógicos de `KEYS`
  (`groups`, `watched`, `settings`, `playlists`) cuya clave real está en `changes`, en el orden de `KEYS`.
- **`content.js`**, un único `handleStorageChange(changes, areaName)` registrado con
  `browser.storage.onChanged.addListener`:
  - `watched`: `watchedVideos = readWatchedValue(newValue)`, `watchedLoadError = null`,
    `watchedAppliedSeq = watchedWriteSeq` (descarta resultados propios en vuelo), `applyWatchedToCard` en todas las
    tarjetas y `renderCurrentVideoSection()`.
  - `settings`: `settings = normalizeSettings(readSettingsValue(newValue))`, `settingsLoaded = true`,
    `settingsLoadError = null`, `settingsAppliedSeq = settingsWriteSeq`, `syncSettingsControls()` y
    `applyVisibilityToAllCards()`.
  - `groups`: `refreshActiveGroupFilter()` (si el grupo activo ya no existe, vuelve a "Todos", como hoy) y
    `renderGroupsPanel()`.
  - `playlists`: `renderPlaylistsSection()`; si el modal "Ver" está abierto, se repinta con su lista o se cierra si
    la lista ya no existe (el modal guarda su id en `data-playlist-id`).
  - Los errores de repintado se registran con `console.error`, como el resto.
- El evento llega también para las escrituras de la propia pestaña; repintar dos veces es inocuo.

## Tareas

Reglas comunes: sin `innerHTML` con datos; JSDoc en funciones nuevas; `make test` y `make lint` (0 avisos) en verde.

- [ ] T1 · Lectores puros y `getChangedKeys` en `modules/storage.js` (los `get*` los usan) · Ficheros:
  `modules/storage.js`, `tests/storage.test.js` · Test: cada `read*Value` con `undefined`, `null`, formato válido y
  campo de tipo incorrecto; `getChangedKeys` con área `sync` (`[]`), con dos claves en desorden (orden de `KEYS`) y
  con una clave ajena; los tests existentes de `get*` siguen pasando.
- [ ] T2 · `handleStorageChange` en `content.js` (ver **Decisiones**) y `data-playlist-id` en el modal de lista ·
  Ficheros: `content.js` · Test: `make lint`, `make test` y a mano V1–V4.
- [ ] T3 · Cerrar el plan: `docs/ARCHITECTURE.md` (flujo "Sincronización entre pestañas", fila de `storage.js` con
  los lectores) y ADR 0006 a `aceptada`. Este plan no marca puntos de `ROADMAP.md` (lo hace el plan 4-2). Estado a
  `hecho` · Ficheros: `docs/ARCHITECTURE.md`, `docs/adr/0006-sincronizacion-pestanas-y-copia.md`, este plan · Test:
  `make lint` y `make test`.

### Verificación manual (con `make up`, dos pestañas de YouTube)

- V1 · Crear, renombrar y borrar un grupo en A: el panel de B cambia sin recargar. Con ese grupo activo en B y
  borrado en A, B vuelve a "Todos".
- V2 · Marcar visto en A: la tarjeta del mismo vídeo en B se marca.
- V3 · Cambiar "Vídeos vistos" a "Ocultar" en A: B oculta los vistos y su selector muestra "Ocultar".
- V4 · Con el modal "Ver" de una lista abierto en B, quitar un vídeo en A: el modal de B se actualiza; borrar la lista
  en A: el modal de B se cierra.

## Criterios de aceptación

- Los cambios de grupos, vistos, ajustes y listas hechos en una pestaña se ven en las demás sin recargar.
- La pestaña que hace el cambio se comporta igual que antes.
- Sin permisos nuevos ni cambios de formato; `make lint` (0 avisos) y `make test` pasan.

## Fuera de alcance

- Sincronizar el grupo activo y los filtros avanzados (son estado de cada pestaña).
- Evitar la pérdida por escrituras simultáneas entre pestañas (ADR 0006, "A vigilar").
- Refrescar desplegables de grupos o listas ya abiertos.

## Cambios aprobados

Cambios sobre el plan después de aprobarlo. Sin una línea aquí, un cambio no está aprobado.

| Fecha | Tarea | Cambio | Motivo | Aprobado por |
| --- | --- | --- | --- | --- |

## Registro

Una línea por commit, añadida **antes** de commitear. El plan actualizado va en el mismo commit que el cambio.

| Fecha | Tarea | Commit | Nota |
| --- | --- | --- | --- |
