# Plan: GUI (1/4) · El selector de iconos se cierra del todo

**Estado:** aprobado (2026-11-15)

Issue: revisión de usabilidad de la GUI pedida por la persona (2026-11-15), punto 1.

<!-- Estados: borrador → aprobado (AAAA-MM-DD) → hecho. Se cambia solo la línea `**Estado:**`, y lo
     hace quien tiene la aprobación de una persona; los subagentes no ven la conversación, solo este fichero. -->

## Orden de ejecución de la serie GUI 2026-11-15

1. **Este plan** (`gui-1-selector-iconos`): error pequeño y aislado; se cierra en un commit.
2. `gui-2-botones-miniatura`: botones de las tarjetas sobre la miniatura. Independiente del resto; va pronto porque
   depende del DOM real de YouTube y conviene que la persona lo pruebe cuanto antes en su navegador.
3. `gui-3-guia-lateral`: filtro de canal único con selección que se activa y desactiva (sin elemento "Todos"), nueva
   sección de la guía con columnas, crear grupo o subgrupo (con icono y color) desde la guía y paso a
   `/feed/subscriptions`. Es el cambio con más riesgo para los filtros; deja el panel como está para poder comparar.
4. `gui-4-panel`: panel minimizado por defecto y **sin nada de grupos**. Va el último porque quita del panel la
   selección y la creación de grupos, que solo pueden quitarse cuando la guía (plan 3) ya las hace.

Dependencias: 1 y 2 son independientes. 3 usa `hideIconPicker()` de este plan (su T9 abre el selector desde la guía).
4 necesita 3 en `hecho`.

## Contexto y decisión

Tras elegir un icono y pulsar "Guardar" (o "Cancelar", clic fuera o scroll), el selector queda visible. Causa:
`openIconPicker`/`createIconPicker` (`content.js`) solo ponen `hidden` en el `<form>`, pero

- el contenedor `.youtube-groups__icon-picker` tiene fondo, borde, `padding: 12px` y sombra, así que sin el
  formulario sigue viéndose una caja vacía; y
- `.youtube-groups__icon-picker-form { display: flex }` gana a la regla `[hidden]` del navegador, de modo que el
  propio formulario tampoco se oculta.

Decisión: una función `hideIconPicker()` que pone `hidden` en el contenedor (y en el formulario) y que usan los cuatro
puntos de cierre (Cancelar, guardado correcto, `mousedown` fuera y `scroll`); `openIconPicker` quita `hidden` de los
dos. En `content.css`, `.youtube-groups__icon-picker[hidden], .youtube-groups__icon-picker-form[hidden] { display:
none; }`. Se descarta mover los estilos de caja al formulario (como en los desplegables de suscripción): toca más CSS
para el mismo resultado.

Contexto en que se abre el selector a lo largo de la serie (el arreglo sirve en todos, porque está en el propio
selector y no en quien lo abre):

- Al hacer este plan: botón "Icono" de cada grupo en el panel (como hoy). Es donde se verifica.
- Tras `gui-3-guia-lateral` (T9): también desde el formulario de crear grupo o subgrupo de la guía. Ese plan cambia
  `openIconPicker` para recibir el icono y color de partida y una función que recibe la elección; el panel la usa
  para guardar con `setGroupAppearance`.
- Tras `gui-4-panel`: solo desde la guía, al crear. El botón "Icono" del panel desaparece; cambiar el icono de un
  grupo existente queda para la futura pantalla de edición (`ROADMAP.md`).

## Tareas

- [ ] T1 · `hideIconPicker()` y reglas `[hidden]` (ver **Contexto y decisión**) · Ficheros: `content.js`,
  `content.css` · Test: `make lint` (0 avisos), `make test` y a mano V1–V2.

### Verificación manual (Firefox con sesión iniciada, extensión cargada en `about:debugging`)

- V1 · Panel → "Icono" de un grupo → elegir icono y color → "Guardar": el selector desaparece por completo y el icono
  nuevo se ve en el panel y en la guía. Repetir con "Cancelar", con clic fuera y haciendo scroll: no queda caja.
- V2 · Abrir otra vez "Icono" (del mismo u otro grupo): el selector aparece entero, con el icono actual marcado. En
  tema oscuro se ve con fondo oscuro.

## Criterios de aceptación

- Tras guardar, cancelar, hacer clic fuera o hacer scroll, no queda nada visible del selector de iconos.
- Volver a abrirlo funciona igual que antes.

## Fuera de alcance

- Cambiar desde dónde se abre el selector o su forma de devolver la elección (lo hacen `gui-3-guia-lateral` y
  `gui-4-panel`).
- Rediseñar el selector.

## Cambios aprobados

Cambios sobre el plan después de aprobarlo. Sin una línea aquí, un cambio no está aprobado.

| Fecha | Tarea | Cambio | Motivo | Aprobado por |
| --- | --- | --- | --- | --- |

## Registro

Una línea por commit, añadida **antes** de commitear. El plan actualizado va en el mismo commit que el cambio.

| Fecha | Tarea | Commit | Nota |
| --- | --- | --- | --- |
