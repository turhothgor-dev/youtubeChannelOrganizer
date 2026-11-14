# Plan: Fase 5 (1/5) · Limpieza de canales y grupos

**Estado:** aprobado (2026-11-14)

Issue: `ROADMAP.md`, Fase 5: "Limpieza de canales".

<!-- Estados: borrador → aprobado (AAAA-MM-DD) → hecho. Se cambia solo la línea `**Estado:**`, y lo
     hace quien tiene la aprobación de una persona; los subagentes no ven la conversación, solo este fichero. -->

## Contexto y decisión

Con el uso se acumulan canales repetidos en un grupo (el mismo handle con otras mayúsculas o codificado:
`/@Foo` y `/@foo`, `/@ñu` y `/@%C3%B1u`), URL de canal no válidas (datos antiguos) y grupos vacíos. Decisión: una
sección "Limpieza" en el panel que analiza el árbol y, tras confirmar, aplica las limpiezas elegidas en una sola
escritura. Sin cambio de formato (ADR 0001) ni permisos.

Se descarta unir `/@handle` con `/channel/UC...`: exige conocer la equivalencia, que solo da la red o datos internos
de YouTube; queda para una versión 2 del formato (ADR 0001, "A vigilar").

Decisiones (delegadas por la persona), en `modules/groups.js`:

- `getChannelKey(url)`: para `/@handle`, el origen más `/@` y el handle con `decodeURIComponent` (si falla, tal cual)
  en minúsculas; para el resto, la URL sin cambios.
- `analyzeGroups(groups)` (puro) devuelve:
  - `duplicates`: `[{ groupId, groupName, name, url, keptUrl }]`, canales de un mismo grupo cuya `getChannelKey`
    coincide con la de uno anterior del grupo (se conserva el primero).
  - `invalid`: `[{ groupId, groupName, name, url }]`, canales cuya `url` no es cadena o
    `normalizeChannelUrl(url) !== url` (con `try/catch`).
  - `emptyGroups`: `[{ id, name }]`, grupos y subgrupos sin canales en todo su subárbol (solo el más alto de cada
    rama vacía).
- `applyCleanup(groups, { duplicates, invalid, emptyGroups })` (puro, booleanos): quita lo elegido. Primero canales,
  después grupos vacíos según el árbol ya limpio. Devuelve `{ groups, changed, removedGroupIds }`; no muta.
- `cleanupGroups(options)`: dentro de `withGroupsLock`, lee, aplica y escribe solo si `changed`.
- **Interfaz**: `<details class="youtube-groups__cleanup"><summary>Limpieza</summary>` en la plantilla estática,
  con botón "Analizar", resultado pintado con `createElement`/`textContent` (tres apartados con su número y cada
  elemento como "Grupo › Canal (URL)" o "Grupo"), tres casillas ("Unir canales repetidos" y "Quitar URL no válidas"
  marcadas; "Eliminar grupos vacíos" sin marcar), botón "Limpiar" (deshabilitado si lo elegido no tiene elementos)
  con `confirm` que resume cuántos elementos se quitan, y `<p aria-live>` para errores y "Limpieza hecha.". Tras
  limpiar: `renderGroupsPanel()`, `refreshActiveGroupFilter()` (si el grupo activo se borró, vuelve a "Todos") y se
  vuelve a analizar.

## Tareas

Reglas comunes: sin `innerHTML` con datos; JSDoc; tests con `loadModules` y `plain`; `make test` y `make lint`
(0 avisos) en verde.

- [x] T1 · `getChannelKey`, `analyzeGroups` y `applyCleanup` · Ficheros: `modules/groups.js`, `tests/groups.test.js` ·
  Test: `/@Foo` y `/@foo` en el mismo grupo son duplicado y se conserva el primero; en grupos distintos no;
  `/@%C3%B1u` y `/@ñu` duplicados; `/channel/UCx` y `/@x` no; URL `javascript:x` y `/watch?v=1` inválidas; árbol
  con un grupo vacío que contiene un subgrupo vacío informa solo del grupo; grupo con un subgrupo con canales no está
  vacío; `applyCleanup` con todo `false` da `changed: false`; con `emptyGroups` quita también los que quedan vacíos al
  quitar inválidos; la entrada no se muta.
- [ ] T2 · `cleanupGroups` · Ficheros: `modules/groups.js`, `tests/groups.test.js` · Test: sin nada que limpiar no
  escribe (`calls.set === 0`); con duplicados escribe una vez; con `latencyMs` y un `createGroup` simultáneo, el grupo
  creado no se pierde.
- [ ] T3 · Sección "Limpieza" del panel y estilos (claro y `html[dark]`) · Ficheros: `content.js`, `content.css` ·
  Test: `make lint`, `make test` y a mano V1–V3.
- [ ] T4 · Cerrar el plan: `ROADMAP.md` marca ✅ "Limpieza de canales"; `docs/ARCHITECTURE.md` (funciones nuevas en
  la fila de `groups.js` y flujo "Limpieza"). Estado a `hecho` · Ficheros: `ROADMAP.md`, `docs/ARCHITECTURE.md`, este
  plan · Test: `make lint` y `make test`.

### Verificación manual (con `make up`)

- V1 · Desde la consola de la extensión, guardar un grupo con `/@Foo` y `/@foo` y otro grupo vacío. "Analizar" muestra
  1 repetido, 0 inválidas y 1 grupo vacío.
- V2 · "Limpiar" con las casillas por defecto: queda un solo canal y el grupo vacío sigue; con "Eliminar grupos
  vacíos" marcada, desaparece. Cancelar el `confirm` no cambia nada.
- V3 · Con el grupo vacío activo como filtro, eliminarlo: el filtro vuelve a "Todos".

## Criterios de aceptación

- La persona ve qué canales repetidos, URL no válidas y grupos vacíos hay y los quita con una confirmación.
- No se borra nada sin confirmar ni nada no elegido; grupos con canales en algún subgrupo no se consideran vacíos.
- `ROADMAP.md` marca "Limpieza de canales" con ✅; `make lint` y `make test` pasan.

## Fuera de alcance

- Unir `/@handle` con `/channel/UC...` y cambiar `normalizeChannelUrl` (versión 2 del ADR 0001).
- Limpiar vídeos vistos antiguos, listas o canales de los que ya no se está suscrito.
- Elegir qué variante de un repetido se conserva.

## Cambios aprobados

Cambios sobre el plan después de aprobarlo. Sin una línea aquí, un cambio no está aprobado.

| Fecha | Tarea | Cambio | Motivo | Aprobado por |
| --- | --- | --- | --- | --- |
| 2026-11-14 | T1 | `/@ñu` sin codificar cuenta como URL no válida; los no válidos no entran en la detección de repetidos | `normalizeChannelUrl` no la devuelve igual; coherente con el formato del ADR 0001 | Persona (delegó decisiones a la opción recomendada) |

## Registro

Una línea por commit, añadida **antes** de commitear. El plan actualizado va en el mismo commit que el cambio.

| Fecha | Tarea | Commit | Nota |
| --- | --- | --- | --- |
| 2026-11-14 | T1 | `feat: analizar y aplicar la limpieza de canales y grupos` | `/@ñu` sin codificar cuenta como no válida (no está normalizada), así que el test de repetidos usa `/@%C3%91u` y `/@%C3%B1u`. Los canales no válidos no entran en la detección de repetidos. |
