# 0015 · Interfaz de `content.js` dividida en componentes de `ui/`, con contexto explícito y tests de DOM

- Estado: aceptada
- Fecha: 2026-11-17

## Contexto

`content.js` tiene 4163 líneas en un único IIFE con unas 40 variables de estado de nivel superior que leen y escriben
funciones de todas las partes (panel, guía, tarjetas, desplegables, reproductor, vistos). La Fase 6 empieza por un
editor de grupos que necesita reutilizar el SVG de iconos, la banda de color y el selector de icono y color
(ADR 0014), y cada cambio en la interfaz obliga hoy a leer miles de líneas. La interfaz no tiene tests: los de
`tests/` solo cubren `modules/` (sin DOM).

Restricciones: Firefox MV3, scripts clásicos sin compilar ni empaquetador (los content scripts no admiten módulos ES),
sin dependencias en el paquete, sin cambiar el comportamiento visible ni el formato guardado.

## Decisión

1. **Componentes en `ui/`**: el código de `content.js` se mueve, sin cambiar su lógica, a scripts clásicos (IIFE) que
   exponen un global `YouTubeGroups<Componente>`: `ui/icons-dom.js` (`YouTubeGroupsIconsDom`), `ui/icon-picker.js`
   (`YouTubeGroupsIconPicker`), `ui/dropdowns.js` (`YouTubeGroupsDropdowns`), `ui/player.js` (`YouTubeGroupsPlayer`),
   `ui/watched.js` (`YouTubeGroupsWatchedUi`), `ui/cards.js` (`YouTubeGroupsCards`), `ui/guide-section.js`
   (`YouTubeGroupsGuideSection`) y `ui/panel.js` (`YouTubeGroupsPanel`). Se cargan en `manifest.json` después de
   `modules/` y antes de `content.js`.
2. **Sin efectos al cargar**: un fichero de `ui/` solo define funciones y constantes. Los dos sin estado compartido
   (`icons-dom`, `icon-picker`) exponen sus funciones directamente; el resto expone `create(ctx)`, que devuelve su API
   sin tocar el DOM, y, si escucha eventos globales, `start()`, que `content.js` llama en el mismo punto y orden en que
   hoy se registran.
3. **Contexto explícito `ctx`**: `content.js` crea un objeto `ctx` con `ctx.state` (el estado compartido entre
   componentes: ajustes, vistos, selección activa, filtros avanzados) y un espacio de nombres por componente
   (`ctx.cards`, `ctx.panel`…). Los componentes llaman a los demás solo a través de `ctx`, en el momento de la
   llamada (nunca desestructurado al crear). El estado que usa un solo componente queda privado en su fichero.
4. **`content.js` queda como orquestador**: estado, selección activa y filtro pendiente, `renderGroupsPanel`, el
   `MutationObserver`, los eventos de navegación y `storage.onChanged`.
5. **CSS por componente** en `ui/*.css`, listados en `manifest.json` en un orden que conserva la cascada de
   `content.css`, que desaparece.
6. **Tests de DOM con `jsdom`** como `devDependency` (solo tests; no entra en el `.xpi`): un ayudante
   `tests/helpers/load-dom.js` carga los scripts de `manifest.json` en un documento de jsdom con `browser`
   simulado, y cada componente tiene tests de humo (se crea, responde a un clic, no se duplica). Se previó `linkedom`
   y se pasó a `jsdom` en la T1 del plan: en `linkedom`, `HTMLSelectElement.value` solo tiene getter y
   `syncSettingsControls` fallaba al crear el panel (el criterio de paso a `jsdom` que fijaba el plan).
7. Modifica el punto 3 del ADR 0014: en lugar de `ui/group-ui.js`, la página de opciones carga `ui/icons-dom.js` y
   `ui/icon-picker.js` y enlaza sus CSS en lugar de `content.css`.

## Alternativas descartadas

- **Módulos ES o un empaquetador** (esbuild, Rollup): los content scripts de MV3 no cargan módulos ES sin un
  `import()` dinámico con `web_accessible_resources` (que expone ficheros a la página), y un empaquetador añade un paso
  de compilación y una dependencia de producción a un proyecto que hoy se carga tal cual.
- **Partir en ficheros que compartan el ámbito global sin `ctx`** (variables `var` globales): el estado seguiría siendo
  implícito y cualquier script de la página de opciones vería esas variables.
- **Clases o un patrón de eventos (bus)**: obliga a reescribir la lógica, y el requisito es mover código sin cambiar
  comportamiento.
- **Refactor parcial (solo lo que necesita el editor)**: deja un `content.js` de 3800 líneas y obliga a repetir el
  trabajo en los siguientes planes de la Fase 6.
- **`linkedom` como herramienta de tests**: se probó primero (pequeño y rápido), pero su DOM no implementa partes
  que usa el código (p. ej. el setter de `HTMLSelectElement.value`); se usa `jsdom`, con más dependencias y arranque
  más lento.
- **Tests de extremo a extremo en Firefox** (Playwright, Selenium): pesados para un proyecto sin CI de navegador; se
  mantiene la verificación manual en Firefox.

## Consecuencias

- Se gana: ficheros de 150 a 1000 líneas con su API explícita, código de iconos reutilizable por la página de
  opciones, y una red de tests de DOM para la interfaz que se mantiene en los siguientes planes.
- Se pierde: más ficheros y un orden de carga que hay que respetar en `manifest.json`; `ctx` añade un nivel de
  indirección; una `devDependency` nueva (`jsdom`).
- A vigilar: un componente que acceda a otro al cargar (y no en la llamada) depende del orden del manifiesto; el
  orden de los escuchadores del mismo evento (`yt-navigate-start`, `yt-navigate-finish`) debe seguir siendo el de hoy;
  el orden de los `ui/*.css` en el manifiesto es parte de la cascada; los tests de DOM no ven maquetación (posiciones,
  `checkVisibility`), que sigue necesitando la prueba manual.
