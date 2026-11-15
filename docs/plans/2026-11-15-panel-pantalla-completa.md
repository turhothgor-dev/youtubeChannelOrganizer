# Plan: ocultar el panel flotante en pantalla completa

**Estado:** hecho

Issue: sin issue (petición directa, 2026-11-15)

## Contexto y decisión

El panel flotante `#youtube-groups-panel` (hijo de `<body>`, `position: fixed`, `z-index: 2147483647`) sigue a la
vista al reproducir un vídeo en pantalla completa. Los desplegables flotantes de la extensión, también hijos de
`<body>` y con el mismo `z-index` (`.youtube-groups__subscription-dropdown`, `.youtube-groups__playlist-dropdown` y
`.youtube-groups__icon-picker`), tienen el mismo problema si estaban abiertos al entrar en pantalla completa (por
ejemplo, abiertos desde los botones del reproductor). Deben ocultarse mientras haya pantalla completa y volver tal
cual al salir.

**Decisión**: solo CSS, al final de `content.css`. Dos reglas separadas (para que, si un navegador no entiende
`:has()`, la otra siga valiendo):

```css
:fullscreen #youtube-groups-panel,
:fullscreen .youtube-groups__subscription-dropdown,
:fullscreen .youtube-groups__playlist-dropdown,
:fullscreen .youtube-groups__icon-picker {
  display: none !important;
}

html:has(:fullscreen) #youtube-groups-panel,
html:has(:fullscreen) .youtube-groups__subscription-dropdown,
html:has(:fullscreen) .youtube-groups__playlist-dropdown,
html:has(:fullscreen) .youtube-groups__icon-picker {
  display: none !important;
}
```

- La primera cubre el caso en que el elemento en pantalla completa es `<html>` o `<body>` (`html:has(...)` no
  casaría consigo mismo, porque `:has()` solo mira descendientes).
- La segunda cubre cualquier otro elemento en pantalla completa (`ytd-app`, `#movie_player`...).
- `display: none` no toca el estado: el panel conserva si estaba plegado o desplegado (`panelCollapsed`) y los
  desplegables, su contenido; al salir de pantalla completa vuelven igual. `!important` es necesario porque el
  atributo `hidden` y otras reglas de `display` de esos elementos no deben ganar a esta.
- Compatibilidad: `:fullscreen` sin prefijo existe en Firefox desde la 64 y `:has()` desde la 121. `manifest.json` no
  fija `strict_min_version`, pero `data_collection_permissions` ya exige un Firefox reciente (140 o posterior), así que
  ambos selectores están soportados. No se cambia el manifiesto.
- Rendimiento: el ADR 0008 descartó `:has(ytd-app[...])` en `<html>` porque invalida con cada mutación de atributos
  de `ytd-app`. `:has(:fullscreen)` solo depende de un estado que cambia al entrar o salir de pantalla completa;
  el coste es despreciable.

**Alternativas descartadas**:

- Clase en `<html>` desde JS en `fullscreenchange` (como hacía la columna del ADR 0008): más código y un estado más
  que sincronizar, para lo que el CSS resuelve solo. Si la verificación manual mostrara que el CSS no basta, se
  propondría como cambio del plan.
- Reutilizar `shouldShowPlayerControls` u otra lógica de `modules/pages.js`: no hay decisión que probar; es
  presentación pura.

No hace falta ADR: no hay dependencia nueva ni cambio de estructura.

## Tareas

- [x] T1 · Añadir las dos reglas de arriba al final de `content.css` (con un comentario breve de por qué hay dos) y
  una frase en la fila de `content.css` de `docs/ARCHITECTURE.md` ("el panel y los desplegables flotantes se ocultan
  en pantalla completa con `:fullscreen` y `:has(:fullscreen)`") · Ficheros: `content.css`, `docs/ARCHITECTURE.md` ·
  Test: `make lint` y `make test` en verde (sin tests nuevos: no hay lógica JS) y verificación manual en Firefox con
  `make up` según los criterios de aceptación.

## Criterios de aceptación

- En `/watch`, con el panel visible (plegado o desplegado), al pasar a pantalla completa (botón del reproductor o
  tecla `f`) el panel deja de verse; al salir (`Esc` o `f`) vuelve en el mismo estado (plegado o desplegado).
- Con el desplegable de lista o de grupos abierto desde el botón del reproductor o del panel, al entrar en pantalla
  completa no se ve sobre el vídeo.
- Fuera de pantalla completa (también en modo cine) el panel y los desplegables se ven y funcionan como antes.
- `make lint` y `make test` pasan.

## Fuera de alcance

- El modal de "Ver" lista y el resto de elementos de la extensión (botones de tarjeta, sección de la guía, botones del
  reproductor, que ya se ocultan con `shouldShowPlayerControls`).
- Cerrar los desplegables al entrar en pantalla completa: solo se ocultan.
- Añadir `strict_min_version` al manifiesto.
- Cambios de JavaScript y tests de DOM.

## Cambios aprobados

Cambios sobre el plan después de aprobarlo. Sin una línea aquí, un cambio no está aprobado.

| Fecha | Tarea | Cambio | Motivo | Aprobado por |
| --- | --- | --- | --- | --- |

## Registro

Una línea por commit, añadida **antes** de commitear. El plan actualizado va en el mismo commit que el cambio.

| Fecha | Tarea | Commit | Nota |
| --- | --- | --- | --- |
| 2026-11-15 | T1 | `feat: ocultar el panel y los desplegables flotantes en pantalla completa` | Dos reglas CSS al final de `content.css` y frase en `docs/ARCHITECTURE.md`. `make lint` y tests en verde. Verificación manual en Firefox con `make up` pendiente. |
