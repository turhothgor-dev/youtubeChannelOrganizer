# Plan: GUI 6 (3/3) · Texto corto en el botón de crear

**Estado:** hecho

Issue: feedback de la persona tras probar la serie `2026-11-15-gui-5-*` en Firefox (2026-11-15), punto 3.

<!-- Estados: borrador → aprobado (AAAA-MM-DD) → hecho. Se cambia solo la línea `**Estado:**`, y lo
     hace quien tiene la aprobación de una persona; los subagentes no ven la conversación, solo este fichero. -->

Orden de la serie GUI 6: `2026-11-15-gui-6-1-guia-fija` → `2026-11-15-gui-6-2-seleccion-hermanos` → **este plan**.
Requisito: `gui-6-2` en `hecho`. Sin ADR (texto de interfaz).

## Contexto y decisión

"+ Crear subgrupo en «X» (último seleccionado)" no cabe en el ancho de la guía. Decidido por la persona (2026-11-15):
la etiqueta visible es solo "+ Grupo" o "+ Subgrupo"; el destino completo va en `title` y `aria-label`. Con la regla de
hermanos (`gui-6-2`), varios grupos seleccionados son siempre hermanos y el ancla sigue siendo el **último pulsado**;
el `title` lo dice.

`getCreateTarget(groups, path, selection)` pasa a devolver `{ parentId, parentName, label, title }` (desaparece
`ariaLabel`):

| Caso | `label` | `title` (también `aria-label`) |
| --- | --- | --- |
| Raíz sin grupos seleccionados | `+ Grupo` | `Crear grupo` |
| Un grupo X seleccionado, o subcolumna de X sin grupos seleccionados | `+ Subgrupo` | `Crear subgrupo en «X»` |
| Varios grupos seleccionados, último X | `+ Subgrupo` | `Crear subgrupo en «X» (último seleccionado)` |

`content.js` pone `textContent = label` y `title` y `aria-label` = `title`. El resto (ancla, formulario, paso a la
columna del padre) no cambia.

## Tareas

- [x] T1 · Textos nuevos en `getCreateTarget`, su uso en `content.js` y `docs/ARCHITECTURE.md` al día (flujo de la guía:
  "+ Grupo"/"+ Subgrupo" con el destino en `title`); estado de este plan a `hecho` · Ficheros: `modules/guide.js`,
  `tests/guide.test.js`, `content.js`, `docs/ARCHITECTURE.md`, este plan · Test: los casos de la tabla (incluido que
  solo canales seleccionados da "+ Grupo" en la raíz y "+ Subgrupo" del padre en una subcolumna, y que un ancla
  inexistente se salta); el test actual de `getCreateTarget` se adapta (cambio intencionado); `make lint`, `make test`
  y a mano V1.

### Verificación manual

- V1 · En la raíz el botón dice "+ Grupo" y su tooltip "Crear grupo". Marcar A: "+ Subgrupo", tooltip "Crear subgrupo
  en «A»"; marcar además B (hermano): tooltip "… en «B» (último seleccionado)". El texto se lee entero en la guía.
  Crear funciona como antes. Tema claro y oscuro.

## Criterios de aceptación

- El botón de crear muestra "+ Grupo" o "+ Subgrupo" completo, y el tooltip y el nombre accesible dicen dónde se crea.

## Fuera de alcance

- Cambiar el destino de crear, el formulario o los estilos del botón.

## Cambios aprobados

Cambios sobre el plan después de aprobarlo. Sin una línea aquí, un cambio no está aprobado.

| Fecha | Tarea | Cambio | Motivo | Aprobado por |
| --- | --- | --- | --- | --- |

## Registro

Una línea por commit, añadida **antes** de commitear. El plan actualizado va en el mismo commit que el cambio.

| Fecha | Tarea | Commit | Nota |
| --- | --- | --- | --- |
| 2026-11-15 | T1 | `feat: texto corto en el botón de crear` | Etiqueta "+ Grupo"/"+ Subgrupo"; destino en `title` y `aria-label`. V1 manual pendiente. |
