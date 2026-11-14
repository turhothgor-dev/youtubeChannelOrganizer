# Plan: Fase 4 (2/3) · Copia de seguridad para llevar los datos a otro dispositivo

**Estado:** aprobado (2026-11-14)

Issue: `ROADMAP.md`, Fase 4: "Sincronización cruzada" (segunda mitad; al terminar, el punto queda ✅).

<!-- Estados: borrador → aprobado (AAAA-MM-DD) → hecho. Se cambia solo la línea `**Estado:**`, y lo
     hace quien tiene la aprobación de una persona; los subagentes no ven la conversación, solo este fichero. -->

## Contexto y decisión

Requisito previo: plan `2026-11-14-fase4-1-sincronizacion-pestanas.md` en `hecho` (tras importar, la interfaz se
repinta por `storage.onChanged`). Entre dispositivos se usa exportar/importar un JSON (ADR 0006, punto 2) en lugar de
`storage.sync`, por cuota y conflictos (ver ADR).

Decisiones (delegadas por la persona):

- **Módulo nuevo `modules/backup.js`** (`YouTubeGroupsBackup`, sin DOM), cargado tras `playlists.js`:
  - `buildBackup({ groups, watched, settings, playlists }, now)`: objeto del formato del ADR 0006 con
    `exportedAt = new Date(now).toISOString()`.
  - `parseBackup(text)`: devuelve `{ data: { groups, watched, settings, playlists }, dropped }` o lanza:
    - texto de más de 5 000 000 caracteres, JSON no válido o `format` distinto: `Error("El fichero no es una copia de
      YouTube Groups.")`; `version !== 1`: `Error("Versión de copia no admitida.")`; estructura incorrecta:
      `Error("La copia está dañada: <qué>.")`.
    - Grupos: array; cada nodo necesita `id` cadena no vacía y única en todo el árbol y `name` cadena recortada de 1
      a 80 caracteres (si no, error). `type` y `parentId` se recalculan por nivel; `icon` y `color` no válidos
      (`YouTubeGroupsIcons.isValidIconId`/`isValidColor`) pasan a `""`. Canales: se conservan los que tienen
      `normalizeChannelUrl(url) === url` (con `try/catch`), sin repetir URL en el grupo, con `name` cadena truncada a
      100; el resto cuenta en `dropped`.
    - Vistos: objeto; se conservan las claves con `isValidVideoId` y `watchedAt` número finito; el resto, `dropped`.
    - Ajustes: `YouTubeGroupsSettings.normalizeSettings(settings)`.
    - Listas: array; cada lista con `id` cadena no vacía única y nombre válido (si no, error); vídeos con ID válido,
      sin repetir en la lista, `title`/`channelName` limpiados con las reglas del ADR 0004 y `addedAt` número finito
      (si no, `0`); los vídeos no válidos cuentan en `dropped`. Para no duplicar reglas, `modules/playlists.js` exporta
      `cleanVideoEntry(video, addedAt)` (usa `cleanText` y los máximos actuales).
  - `exportBackup()`: lee las cuatro claves con los `get*` de storage y `YouTubeGroupsSettings.getSettings()` y
    devuelve `JSON.stringify(buildBackup(...), null, 2)`.
  - `importBackup(text)`: `parseBackup` primero (si lanza, no escribe nada); después escribe en orden ajustes,
    grupos, listas y vistos, cada una con su `save*` dentro de `withLock` de su clave. Devuelve `{ dropped }`.
- **Interfaz**, en la sección "Ajustes" del panel (plantilla estática): botones "Exportar copia" e "Importar copia",
  `<input type="file" accept=".json,application/json" hidden>` y `<p class="youtube-groups__backup-message"
  aria-live="polite">`.
  - Exportar: `Blob` + `URL.createObjectURL` + `<a download="youtube-groups-AAAA-MM-DD.json">` creado con
    `createElement`, `click()` y `revokeObjectURL` tras un `setTimeout`. Si la descarga no arranca en Firefox (V1),
    se cambia a `data:application/json;charset=utf-8,` + `encodeURIComponent` anotándolo en **Cambios aprobados**.
  - Importar: elegir fichero, `confirm("Se reemplazarán los grupos, vistos, ajustes y listas de este navegador.
    ¿Continuar?")`, `file.text()`, `importBackup`, mensaje "Copia importada." o "Copia importada (N entradas
    descartadas)."; errores en el mismo `<p>`. El `input` se vacía al terminar para poder repetir el mismo fichero.

## Tareas

Reglas comunes: sin `innerHTML` con datos; JSDoc; tests con `loadModules` y `plain`; `make test` y `make lint`
(0 avisos) en verde.

- [x] T1 · `cleanVideoEntry` en `modules/playlists.js` y `modules/backup.js` con `buildBackup`/`parseBackup`; añadir
  `backup.js` a `manifest.json` (antes de `content.js`) y a `tests/helpers/load-modules.js` (devuelve
  `YouTubeGroupsBackup`) · Ficheros: `modules/playlists.js`, `modules/backup.js` (nuevo), `manifest.json`,
  `tests/helpers/load-modules.js`, `tests/playlists.test.js`, `tests/backup.test.js` (nuevo) · Test: ida y vuelta
  `parseBackup(JSON.stringify(buildBackup(x)))` devuelve `x` con `dropped: 0`; JSON roto, `format` ajeno, `version: 2`
  y texto de 5 000 001 caracteres lanzan; id de grupo repetido lanza; canal `javascript:alert(1)` y `/watch?v=x` se
  descartan y cuentan; `type`/`parentId` se recalculan; icono desconocido → `""`; visto con ID de 10 caracteres
  descartado; ajuste no válido → valor por defecto; vídeo de lista repetido descartado; título de 201 → 200.
- [x] T2 · `exportBackup` e `importBackup` · Ficheros: `modules/backup.js`, `tests/backup.test.js` · Test: exportar e
  importar en otro `loadModules` deja las cuatro claves iguales con `version: 1`; importar una copia no válida no
  llama a `set` (`calls.set === 0`); `importBackup` con `latencyMs` y un `setVideoWatched` simultáneo no deja la cola
  bloqueada (ambas promesas se resuelven).
- [ ] T3 · Botones de exportar e importar en "Ajustes" (ver **Decisiones**) y estilos (claro y `html[dark]`) ·
  Ficheros: `content.js`, `content.css` · Test: `make lint`, `make test` y a mano V1–V4.
- [ ] T4 · Cerrar el plan: `ROADMAP.md` marca ✅ "Sincronización cruzada"; `docs/ARCHITECTURE.md` (fila de
  `modules/backup.js`, orden de carga, flujo "Copia de seguridad"). Estado a `hecho` · Ficheros: `ROADMAP.md`,
  `docs/ARCHITECTURE.md`, este plan · Test: `make lint` y `make test`.

### Verificación manual (con `make up`)

- V1 · "Exportar copia" descarga `youtube-groups-<fecha>.json` con el formato del ADR 0006.
- V2 · En otro perfil de Firefox, "Importar copia" con ese fichero y aceptar: grupos, vistos, ajustes y listas
  aparecen sin recargar. Cancelar el `confirm` no cambia nada.
- V3 · Importar un `.json` cualquiera muestra "El fichero no es una copia de YouTube Groups." y no cambia nada.
- V4 · Un nombre de grupo `<b>x</b>` en la copia se ve como texto tras importar.

## Criterios de aceptación

- La persona puede exportar todos sus datos a un fichero e importarlos en otro navegador o equipo.
- Un fichero no válido no cambia nada y muestra el motivo; las entradas sueltas no válidas se descartan y se cuentan.
- Sin permisos nuevos ni red; `ROADMAP.md` marca "Sincronización cruzada" con ✅; `make lint` y `make test` pasan.

## Fuera de alcance

- `storage.sync` y sincronización automática entre dispositivos (ADR 0006).
- Fusionar la copia con los datos existentes; exportar solo una parte.

## Cambios aprobados

Cambios sobre el plan después de aprobarlo. Sin una línea aquí, un cambio no está aprobado.

| Fecha | Tarea | Cambio | Motivo | Aprobado por |
| --- | --- | --- | --- | --- |

## Registro

Una línea por commit, añadida **antes** de commitear. El plan actualizado va en el mismo commit que el cambio.

| Fecha | Tarea | Commit | Nota |
| --- | --- | --- | --- |
| 2026-11-14 | T1 | `feat: validar copias de seguridad con parseBackup y buildBackup` | `cleanVideoEntry` en playlists, `modules/backup.js` y tests; 120 tests y lint en verde. |
| 2026-11-14 | T2 | `feat: exportar e importar copias de seguridad en backup.js` | `exportBackup`/`importBackup` con `withLock` por clave y tests; 123 tests y lint en verde. |
