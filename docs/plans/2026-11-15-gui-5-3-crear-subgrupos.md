# Plan: GUI 5 (3/3) · Crear subgrupos según la selección y "›" en todos los grupos

**Estado:** aprobado (2026-11-15)

Issue: feedback de la persona tras probar la serie `2026-11-15-gui-*` en Firefox (2026-11-15), punto 3.

<!-- Estados: borrador → aprobado (AAAA-MM-DD) → hecho. Se cambia solo la línea `**Estado:**`, y lo
     hace quien tiene la aprobación de una persona; los subagentes no ven la conversación, solo este fichero. -->

Orden de la serie GUI 5: `2026-11-15-gui-5-1-columna-propia` → `2026-11-15-gui-5-2-seleccion-multiple` → **este
plan**. Requisito: `gui-5-2` en `hecho` (la selección es un array de claves en orden de adición, `activeSelection`).
Sin ADR nuevo (lógica de interfaz).

## Contexto y decisión

Hoy es imposible crear el primer subgrupo de un grupo: "›" solo aparece en grupos que ya tienen subgrupos y
"+ Crear subgrupo" solo existe dentro de una subcolumna. Decidido por la persona (2026-11-15):

- El botón de crear depende de la selección. Sin grupos ni subgrupos seleccionados: "+ Crear grupo" en la raíz y, en
  una subcolumna, subgrupo del padre de esa columna (como hoy). Con uno seleccionado: "+ Crear subgrupo en «X»". Con
  varios: se crea en el **último grupo o subgrupo pulsado** (ancla) y el texto lo dice. Los canales no cuentan.
- **Todos** los grupos y subgrupos muestran "›"; una subcolumna vacía muestra "Sin subgrupos".

Decisión recomendada (no la pidió la persona, se toma por usabilidad): tras crear un subgrupo, la columna pasa a la del
grupo padre, para que se vea el nuevo subgrupo; si ya se estaba en ella, no cambia.

### Decisiones

- **Funciones puras** en `modules/guide.js`:
  - `getCreateTarget(groups, path, selection)` → `{ parentId, parentName, label, ariaLabel }`. Ancla = la última clave
    `group:<id>` de `selection` cuyo grupo existe en cualquier nivel del árbol (búsqueda local recursiva). Con ancla:
    `parentId`/`parentName` del ancla, `label` "+ Crear subgrupo en «X»" y, si `selection` tiene dos o más claves de
    grupo existentes, "+ Crear subgrupo en «X» (último seleccionado)"; `ariaLabel` "Crear subgrupo en X". Sin ancla y
    `path` normalizado no vacío: el padre de la columna, mismos textos sin el sufijo. Sin ancla y en la raíz:
    `{ parentId: null, parentName: null, label: "+ Crear grupo", ariaLabel: null }`.
  - `findGuidePath(groups, id)` → array de ids desde el primer nivel hasta `id` (incluido), o `null` si no existe.
  - `normalizeGuidePath` deja de exigir que cada grupo tenga subgrupos (basta que exista y sea hijo directo del
    anterior), y `enterGuideGroup` entra en cualquier elemento de la columna actual. `hasSubgroups` se conserva.
- **`content.js`**:
  - El botón de crear toma texto y `aria-label` de `getCreateTarget(groups, guidePath, activeSelection)` en cada
    repintado (también al cambiar la selección). El texto largo se recorta con elipsis (`title` con el texto completo).
  - El formulario usa el destino al enviar: `parentId` nulo → `createGroup` y `validateGroupName(…, "group")`; si no,
    `createSubGroup(parentId, …)` y `"subgroup"`. Icono y color, igual que hoy.
  - El formulario se oculta y vacía cuando cambia el **destino** (`parentId`, o raíz), en lugar de cuando cambia la
    columna: con un ancla, moverse entre columnas no lo cierra; seleccionar otro grupo sí.
  - Tras crear un subgrupo: `guidePath = findGuidePath(groups, parentId)` con los grupos ya guardados; si cambia,
    se repinta con animación `"forward"`.
  - "›" en todas las filas; la subcolumna sin elementos muestra "Sin subgrupos" (la raíz sigue con "Aún no hay
    grupos").

## Tareas

Reglas comunes: sin `innerHTML` con datos; JSDoc; sin dependencias nuevas; `make lint` (0 avisos) y `make test` en
verde.

- [ ] T1 · `getCreateTarget`, `findGuidePath` y `normalizeGuidePath`/`enterGuideGroup` sin exigir subgrupos (ver
  **Decisiones**) · Ficheros: `modules/guide.js`, `tests/guide.test.js` · Test: `getCreateTarget` en la raíz sin
  selección → "+ Crear grupo"; en la columna de A sin selección → subgrupo de A; con `[group:B]` estando en la columna
  de A → B; con `[group:A, channel:x, group:A1]` → A1 con "(último seleccionado)"; solo canales → como sin selección;
  ancla inexistente se salta y se usa la anterior; `findGuidePath` de un nieto → `[A, A1, A1a]`, de un id inexistente
  → `null`; `normalizeGuidePath` conserva un grupo sin subgrupos y sigue recortando ids inexistentes y saltos de
  nivel; `enterGuideGroup` entra en un grupo sin subgrupos y no en uno de otra columna. El test actual que esperaba
  recortar los grupos sin subgrupos se actualiza (cambio intencionado).
- [ ] T2 · Botón de crear según `getCreateTarget`, envío con su destino, reinicio del formulario al cambiar de destino
  y paso a la columna del padre tras crear un subgrupo · Ficheros: `content.js`, `content.css` · Test: `make lint`,
  `make test` y a mano V1, V2, V4.
- [ ] T3 · "›" en todos los grupos y subgrupos y "Sin subgrupos" en la subcolumna vacía · Ficheros: `content.js` ·
  Test: `make lint`, `make test` y a mano V3.
- [ ] T4 · Cerrar: `docs/ARCHITECTURE.md` (fila de `guide.js` con `getCreateTarget` y `findGuidePath`; flujo de la
  columna: botón de crear según la selección y "›" en todos). Estado de este plan a `hecho` · Ficheros:
  `docs/ARCHITECTURE.md`, este plan · Test: `make lint` y `make test`.

### Verificación manual (tu Firefox con sesión, extensión recargada; grupos A y B sin subgrupos)

- V1 · Sin selección, en la raíz: "+ Crear grupo". Marcar A: el botón dice "+ Crear subgrupo en «A»"; crear "A1":
  la columna pasa a la de A y se ve A1. Volver con "‹": A sigue marcado.
- V2 · Marcar A y luego B: "+ Crear subgrupo en «B» (último seleccionado)"; marcar además un canal: no cambia.
  Desmarcar B: "… en «A»". Con el formulario abierto, marcar otro grupo: el formulario se cierra y se vacía.
- V3 · B (sin subgrupos) muestra "›"; al entrar se ve "Sin subgrupos" y "+ Crear subgrupo en «B»"; crear uno lo
  muestra en esa columna. "‹" vuelve con la animación inversa.
- V4 · Regresión: crear grupo con icono y color; el nombre `<b>x</b>` se ve como texto; "a" da el error de mínimo;
  escribir en el campo no dispara atajos de YouTube. Filtros en suscripciones como antes. Tema claro y oscuro.

## Criterios de aceptación

- Se puede crear el primer subgrupo de cualquier grupo o subgrupo, seleccionándolo o entrando con "›".
- El texto del botón de crear dice siempre dónde se va a crear; con varios grupos seleccionados, en el último pulsado.
- Todos los grupos y subgrupos tienen "›"; una subcolumna vacía dice "Sin subgrupos".
- Tras crear un subgrupo se ve en su columna. Lo demás de la columna funciona como antes; sin dependencias nuevas.

## Fuera de alcance

- Editar, renombrar, borrar o mover grupos (pantalla de edición futura, `ROADMAP.md`).
- Seleccionar el grupo recién creado de forma automática.
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
