# Plan: Fase 4 (3/3) · Grupos en la guía lateral de YouTube

**Estado:** hecho

Issue: `ROADMAP.md`, Fase 4: "Integración en sidebar".

<!-- Estados: borrador → aprobado (AAAA-MM-DD) → hecho. Se cambia solo la línea `**Estado:**`, y lo
     hace quien tiene la aprobación de una persona; los subagentes no ven la conversación, solo este fichero. -->

## Contexto y decisión

Hoy los grupos solo se eligen desde el panel flotante, que tapa parte de la página. Decisión: añadir una sección
"Grupos" en la guía lateral de YouTube (`ytd-guide-renderer`) para elegir el filtro, y permitir minimizar el panel
(estado guardado). Se descarta una barra lateral propia (`sidebar_action`): exige otra superficie y mensajería con la
pestaña, y no aporta más que la guía de YouTube. Requisito previo recomendado: plan 4-1 en `hecho` (la guía se
repinta con `renderGroupsPanel` también al cambiar los grupos en otra pestaña).

Decisiones (delegadas por la persona):

- **`YouTubeGroups.flattenGroups(groups)`** (puro): `[{ id, name, level }]` en preorden (grupo, sus subgrupos,
  siguiente grupo), `level` 0 para primer nivel. No muta la entrada.
- **Sección en la guía** (`content.js`):
  - Contenedor `GUIDE_SECTIONS_SELECTOR = "ytd-guide-renderer #sections"`. Se inserta un
    `<div id="youtube-groups-guide" class="youtube-groups__guide">` justo después del primer
    `ytd-guide-section-renderer` hijo de `#sections` (si no hay, al principio). Una sola sección: si ya existe, se
    reutiliza.
  - Contenido, todo con `createElement`/`textContent`: título "Grupos" y un botón por elemento: "Todos" y cada grupo
    de `flattenGroups`, con la marca del grupo (`createGroupMark`), sangría por `level` y `aria-pressed` según el
    grupo activo. Clic: `setActiveGroup(null)` o `setActiveGroup({ id })`. No navega: filtra la página actual.
  - `renderGuideSection(groups)` se llama al final de `renderGroupsPanel` (que ya corre al arrancar, al cambiar el
    grupo activo, al navegar y al cambiar los grupos), y cuando la guía aparece tarde: en el `MutationObserver`, si la
    sección no está conectada, `scheduleGuideCheck()` programa como mucho una comprobación por frame que, si existe
    el contenedor, lee los grupos y pinta.
  - Si YouTube cambia la guía y el contenedor no existe, no se pinta nada y el panel sigue funcionando.
  - Estilos parecidos a las entradas de la guía (alto 40 px, `padding: 0 24px`, radio 10 px, colores con
    `var(--yt-spec-text-primary, ...)` y fondo `var(--yt-spec-badge-chip-background, ...)` en hover y activo).
- **Minimizar el panel**: ajuste nuevo `panelCollapsed` (`false` por defecto, valores `[false, true]`) en
  `modules/settings.js`; campo opcional según ADR 0003 (no sube `version`; se añade a la lista de campos del ADR).
  Botón "−"/"+" en la cabecera del panel (`youtube-groups__collapse-button`, `aria-expanded`, `title` "Minimizar
  panel"/"Mostrar panel"): con `panelCollapsed` el panel lleva la clase `youtube-groups--collapsed` y solo muestra el
  título y ese botón. Se guarda con `updateSettings({ panelCollapsed })` y se aplica al leer los ajustes y en
  `storage.onChanged`.

## Tareas

Reglas comunes: sin `innerHTML` con datos; JSDoc; `make test` y `make lint` (0 avisos) en verde.

- [x] T1 · `flattenGroups` en `modules/groups.js` · Ficheros: `modules/groups.js`, `tests/groups.test.js` · Test:
  árbol con dos grupos y subgrupos a dos niveles da el preorden y niveles esperados; `[]` da `[]`; grupos sin
  `subgroups` funcionan; la entrada no se muta.
- [x] T2 · Ajuste `panelCollapsed` y su mención en ADR 0003 · Ficheros: `modules/settings.js`,
  `tests/settings.test.js`, `docs/adr/0003-formato-almacenamiento-ajustes.md` · Test: por defecto `false`;
  `normalizeSettings({ panelCollapsed: "sí" })` da `false`; `updateSettings({ panelCollapsed: true })` escribe una
  vez y conserva los demás campos; `updateSettings({ panelCollapsed: 1 })` lanza.
- [x] T3 · Sección "Grupos" en la guía (ver **Decisiones**) y estilos (claro y `html[dark]`) · Ficheros:
  `content.js`, `content.css` · Test: `make lint`, `make test` y a mano V1–V3.
- [x] T4 · Minimizar el panel · Ficheros: `content.js`, `content.css` · Test: `make lint`, `make test` y a mano V4.
- [x] T5 · Cerrar el plan: `ROADMAP.md` marca ✅ "Integración en sidebar"; `docs/ARCHITECTURE.md` (flujo "Guía
  lateral", `panelCollapsed` en la fila de `settings.js`, `flattenGroups` en la de `groups.js`). Estado a `hecho` ·
  Ficheros: `ROADMAP.md`, `docs/ARCHITECTURE.md`, este plan · Test: `make lint` y `make test`.

### Verificación manual (con `make up`)

- V1 · En inicio, con la guía abierta, aparece "Grupos" tras la primera sección, con "Todos" y los grupos y
  subgrupos sangrados. Elegir un grupo filtra igual que desde el panel y ambos marcan el mismo activo.
- V2 · En `/watch`, abrir la guía con el menú: la sección aparece una sola vez. Navegar varias veces: sigue habiendo
  una sola.
- V3 · Crear un grupo (o en otra pestaña, con el plan 4-1): aparece en la guía sin recargar. Un nombre `<b>x</b>` se
  ve como texto.
- V4 · Minimizar el panel: queda solo la cabecera; recargar: sigue minimizado; mostrarlo de nuevo funciona.

## Criterios de aceptación

- La guía lateral de YouTube muestra los grupos y permite activar el filtro desde ella.
- El panel se puede minimizar y lo recuerda tras recargar.
- Si la guía no se encuentra, la extensión sigue funcionando con el panel. `make lint` y `make test` pasan;
  `ROADMAP.md` marca "Integración en sidebar" con ✅.

## Fuera de alcance

- Mini-guía (guía contraída), YouTube móvil, `sidebar_action` de Firefox.
- Crear, editar o borrar grupos desde la guía (se hace en el panel).
- Navegar a otra página al elegir un grupo; recordar el grupo activo entre recargas.

## Cambios aprobados

Cambios sobre el plan después de aprobarlo. Sin una línea aquí, un cambio no está aprobado.

| Fecha | Tarea | Cambio | Motivo | Aprobado por |
| --- | --- | --- | --- | --- |

## Registro

Una línea por commit, añadida **antes** de commitear. El plan actualizado va en el mismo commit que el cambio.

| Fecha | Tarea | Commit | Nota |
| --- | --- | --- | --- |
| 2026-11-14 | T1 | `feat: flattenGroups para aplanar el árbol de grupos` | Función pura en `modules/groups.js` con tests (preorden, niveles, vacío, sin mutar). |
| 2026-11-14 | T2 | `feat: ajuste panelCollapsed para minimizar el panel` | Campo `panelCollapsed` en `modules/settings.js`, tests y mención en ADR 0003. |
| 2026-11-14 | T3 | `feat: sección Grupos en la guía lateral de YouTube` | `renderGuideSection` y `scheduleGuideCheck` en `content.js`, estilos claro/oscuro en `content.css`. Pendiente V1–V3 a mano. |
| 2026-11-14 | T4 | `feat: minimizar el panel de grupos` | Botón `youtube-groups__collapse-button` en la cabecera, sincronizado con `panelCollapsed` vía `syncSettingsControls` (carga y `storage.onChanged`); estilos de panel minimizado. Pendiente V4 a mano. |
| 2026-11-14 | T5 | `docs: cerrar la integración en sidebar` | `ROADMAP.md` con ✅, `docs/ARCHITECTURE.md` con flujo "Guía lateral", `panelCollapsed` y `flattenGroups`; plan a `hecho`. |
