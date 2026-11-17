# Plan: gui-8 · Guía, menú de opciones, editor y línea de color en tarjetas (índice)

**Estado:** hecho

Issue: correcciones de la persona tras probar en Firefox (2026-11-17), con las decisiones por defecto recomendadas
("usa lo recomendado"). ADR: [0017](../adr/0017-menu-de-opciones-en-la-guia.md) (aceptada).

<!-- Estados: borrador → aprobado (AAAA-MM-DD) → hecho. Se cambia solo la línea `**Estado:**`, y lo
     hace quien tiene la aprobación de una persona; los subagentes no ven la conversación, solo este fichero. -->

## Contexto y decisión

Seis correcciones en tres zonas independientes. Se parten en tres planes, cada uno con sus tareas, tests y
verificación manual; este fichero solo fija el orden y lo común.

| Plan | Correcciones | Depende de |
| --- | --- | --- |
| [gui-8-1 · Guía y menú de opciones](2026-11-17-gui-8-1-guia-y-menu.md) | 1 (limpiar y engranaje al pie; el menú sustituye al panel flotante), 2 (crear y editar como iconos en el título), 3 (banda de color en el botón del grupo) | — |
| [gui-8-2 · Editor con botones de icono](2026-11-17-gui-8-2-editor-iconos.md) | 4 (nombre con espacio), 5 (acciones solo icono y nuevo orden) | T1 de gui-8-1 (iconos de interfaz) |
| [gui-8-3 · Línea de color en tarjetas](2026-11-17-gui-8-3-linea-color-tarjetas.md) | 6 (línea superior con los colores de los grupos del canal en suscripciones) | — |

Orden recomendado: gui-8-1, gui-8-2, gui-8-3. Cada plan se aprueba por separado (su línea `**Estado:**`); aprobar
este índice no aprueba los tres.

Reglas comunes: sin `innerHTML` con datos (las plantillas estáticas sin datos que ya existen pueden quedarse); JSDoc;
sin dependencias nuevas; sin permisos nuevos; `make lint` y `make test` en verde en cada tarea; un commit por tarea.

## Tareas

- [x] T1 · Cerrar el índice cuando los tres planes estén `hecho` · Ficheros: este plan · Test: los tres planes en
  `hecho`.

## Criterios de aceptación

- Los criterios de los tres planes se cumplen.

## Fuera de alcance

- Lo que cada plan declara fuera de alcance.

## Cambios aprobados

Cambios sobre el plan después de aprobarlo. Sin una línea aquí, un cambio no está aprobado.

| Fecha | Tarea | Cambio | Motivo | Aprobado por |
| --- | --- | --- | --- | --- |

## Registro

Una línea por commit, añadida **antes** de commitear. El plan actualizado va en el mismo commit que el cambio.

| Fecha | Tarea | Commit | Nota |
| --- | --- | --- | --- |
| 2026-11-17 | T1 | docs: cerrar gui-8-3 (ARCHITECTURE, línea de color en tarjetas) | Los tres planes (gui-8-1, gui-8-2, gui-8-3) en `hecho`; índice cerrado en el mismo commit que gui-8-3 T3. |
