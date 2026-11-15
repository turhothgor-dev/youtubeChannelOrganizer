# Plan: GUI (3/4) · Grupos, subgrupos y canales en la guía lateral, con filtro de canal único

**Estado:** aprobado (2026-11-15)

Issue: revisión de usabilidad de la GUI pedida por la persona (2026-11-15), puntos 4.1, 4.2 y 5.

<!-- Estados: borrador → aprobado (AAAA-MM-DD) → hecho. Se cambia solo la línea `**Estado:**`, y lo
     hace quien tiene la aprobación de una persona; los subagentes no ven la conversación, solo este fichero. -->

Orden de la serie GUI 2026-11-15: `gui-1-selector-iconos` → `gui-2-botones-miniatura` → **este plan** →
`gui-4-panel`. Requisito: `gui-1-selector-iconos` hecho (T9 usa su `hideIconPicker()`). Este plan apenas toca el
panel flotante (sigue sirviendo para elegir grupo, con su "Todos", y para editar), para poder comparar ambos filtros
mientras se prueba; solo adapta su botón "Icono" a la nueva firma de `openIconPicker` (T9). `gui-4-panel` le quita
después todo lo de grupos, así que la guía de este plan pasa a ser el único sitio para elegir filtro y crear grupos.
ADR asociado: `docs/adr/0007-filtro-activo-y-paso-a-suscripciones.md` (propuesta; se acepta al aprobar este plan).

## Contexto y decisión

Hoy la guía lateral (`renderGuideSection`, plan `2026-11-14-fase4-3-sidebar`) tiene una sección "Grupos" tras la
primera sección, con "Todos" y la lista plana de grupos y subgrupos; elegir uno filtra la página actual sin navegar. No
muestra canales ni permite filtrar por un canal.

Decisión: sustituir esa sección por "YouTube Groups", encima de "Más de YouTube", con un botón de crear grupo arriba,
una sola columna visible que se desplaza para entrar en los subgrupos, listas de canales desplegables, filtro por
canal único, selección que se activa y desactiva con el mismo clic (sin elemento "Todos") y paso a
`/feed/subscriptions` al elegir. Toda la lógica que se puede probar va en dos módulos puros nuevos; `content.js` solo
pinta y conecta.

### Decisiones

- **Filtro activo** (ADR 0007): `modules/filter.js` (`YouTubeGroupsFilter`, sin DOM, se carga tras `pages.js`):
  - `ALL_FILTER` (`{ type: "all" }`, congelado).
  - `normalizeFilter(raw)`: `{ type: "group", id }` con `id` cadena no vacía; `{ type: "channel", url, name }` con
    `url` que `YouTubeGroups.normalizeChannelUrl` acepta (se guarda la normalizada) y `name` cadena (si no, `""`);
    cualquier otra cosa → `ALL_FILTER`.
  - `getFilterKey(filter)`: `null` para "todos", `"group:<id>"` o `"channel:<url>"`.
  - `resolveFilterUrls(groups, filter)`: `{ status: "all" }`, `{ status: "ok", urls: Set }` (grupo:
    `YouTubeGroups.getGroupChannelUrls`; canal: `Set` con su URL) o `{ status: "missing" }` (grupo que ya no existe).
  - `isFilterOnRemovedGroup(filter, removedIds)`: `true` si es de grupo y su id está en `removedIds`.
  - `toggleFilter(current, next)`: normaliza `next`; si su clave (`getFilterKey`) es igual a la de `current`, devuelve
    `ALL_FILTER` (clic sobre lo ya elegido lo deselecciona); si no, devuelve `next` normalizado (selección única: otro
    elemento sustituye al anterior). Las claves llevan el tipo delante, así que un grupo y un canal nunca se confunden
    aunque coincida el texto del id y la URL. Con `next` no válido da `ALL_FILTER`.
  - `shouldNavigateToSubscriptions(pageType, filter)`: `true` si el filtro no es "todos" y `pageType !==
    "subscriptions"`. Se llama con el filtro **resultante** de `toggleFilter`, así que deseleccionar nunca navega.
  - `PENDING_FILTER_KEY = "youtubeGroupsPendingFilter"`, `PENDING_MAX_AGE_MS = 30000`,
    `serializePendingFilter(filter, now)` y `parsePendingFilter(text, now)` (formato del ADR 0007; devuelve el filtro
    normalizado o `null` si el texto no es JSON, `version !== 1`, el filtro es "todos" o no es válido, o
    `now - createdAt` no está entre 0 y 30000).
- **`content.js` con filtro general**: `activeGroupId` pasa a `activeFilter` (por defecto `ALL_FILTER`) y
  `setActiveGroup(group)` a `setActiveFilter(filter)` (normaliza; no hace nada si la clave no cambia).
  `refreshActiveGroupFilter` pasa a `refreshActiveFilter` y usa `resolveFilterUrls` (con `"missing"` vuelve a "todos",
  como hoy). `cardMatchesFilter` pasa `activeGroupId: getFilterKey(activeFilter)` a
  `YouTubeGroupsVisibility.matchesGroupFilter` (la función no cambia). Las comprobaciones de grupo borrado (limpieza,
  eliminar grupo) usan `isFilterOnRemovedGroup`, a través de una función nueva `handleGroupsRemoved(removedIds)`
  (vuelve a "todos" si el filtro estaba en un grupo quitado; si no, `refreshActiveFilter`) que llaman la limpieza y
  "Eliminar" del panel. El panel sigue eligiendo grupos como hoy, con `setActiveFilter({ type: "group", id })` (sin
  alternar) y su botón "Todos", y marca `aria-pressed` comparando claves.
- **Columna de la guía**: `modules/guide.js` (`YouTubeGroupsGuide`, sin DOM, se carga tras `filter.js`):
  - `normalizeGuidePath(groups, path)`: el prefijo más largo de `path` (array de ids) en que el primero es un grupo de
    primer nivel, cada siguiente es subgrupo directo del anterior y todos tienen subgrupos. Una entrada que no es array
    da `[]`.
  - `getGuideColumn(groups, path)` → `{ path, parent, items }`: `path` normalizado; `parent` `null` en la raíz o
    `{ id, name }` del último id; `items` los grupos de primer nivel o los subgrupos directos de `parent`, cada uno
    `{ id, name, hasSubgroups, channels: [{ name, url }] }` (solo canales con `url` cadena; sin nombre, la URL). No muta
    la entrada.
  - `enterGuideGroup(groups, path, id)`: añade `id` si es un elemento de la columna actual con subgrupos; si no,
    devuelve el `path` normalizado. `leaveGuideGroup(path)`: quita el último (en la raíz, `[]`).
  - `isChannelListOpen(overrides, item, depth, activeKey)`: el valor de `overrides` (`Map` id → booleano) para
    `item.id` si lo tiene; si no, abierta si alguno de `item.channels` es el filtro activo (`activeKey ===
    "channel:<url>"`) o si `depth > 0` (cerradas en la raíz, abiertas en los subgrupos). La regla del canal activo
    existe porque, sin "Todos", la única forma de quitar el filtro es volver a pulsar lo elegido: tiene que verse (por
    ejemplo, tras llegar a suscripciones con una carga completa, que reinicia la guía).
  - La columna no tiene elemento "Todos": "todos" es el estado sin nada seleccionado (ADR 0007).
  - `findGuideInsertionIndex(sections)`: `sections` es un array (una entrada por `ytd-guide-section-renderer`) de
    arrays de `href`; devuelve el índice de la primera sección con un enlace a `studio.youtube.com`,
    `music.youtube.com`, `youtubekids.com`, `www.youtubekids.com` o `tv.youtube.com` (la de "Más de YouTube", sin
    depender del idioma), o `-1`. Los `href` relativos se resuelven contra `https://www.youtube.com`; los no válidos se
    ignoran.
- **Validación de nombres**: `YouTubeGroups.validateGroupName(name, kind = "group")` → `null` o el mensaje que hoy da
  el panel ("El nombre del grupo debe tener al menos 2 caracteres" / "... no puede exceder 80 caracteres"; con
  `kind === "subgroup"`, "del subgrupo"). Usa `trim`; si no es cadena, el mensaje de mínimo.
- **Sección de la guía** (`content.js`, todo con `createElement`/`textContent`):
  - Misma `GUIDE_SECTIONS_SELECTOR` e id `youtube-groups-guide`. Posición: antes de la sección que da
    `findGuideInsertionIndex` (calculado con los `ytd-guide-section-renderer` hijos de `#sections`, sin la nuestra); con
    `-1`, tras la primera sección como hoy. Solo se mueve si no está ya en su sitio. Aparece en todas las páginas donde
    YouTube pinta la guía (también el cajón de `/watch`), como hoy.
  - Estado en memoria: `guidePath` (`[]`) y `guideChannelOverrides` (`Map`). Al repintar (cambio de grupos, de filtro o
    navegación) se normaliza `guidePath` sin animar.
  - Estructura, de arriba abajo. La cabecera, el botón de crear y el formulario se crean una vez con la sección y no se
    desplazan; al repintar solo cambian sus textos y su visibilidad. Solo la columna de elementos se desplaza.
    1. **Cabecera**: en la raíz, el título "YouTube Groups"; en una columna de subgrupos, botón "‹" (`aria-label`
       "Volver") y el nombre del grupo padre como **título de texto, no pulsable** (decidido por la persona,
       2026-11-15: no filtra; para filtrar por el grupo completo se pulsa en la columna anterior).
    2. **Botón de crear**, primer elemento bajo la cabecera, a todo el ancho: "+ Crear grupo" en la raíz; "+ Crear
       subgrupo" (`aria-label` "Crear subgrupo en <nombre>") en una columna de subgrupos. Es el mismo botón; cambia su
       texto y lo que crea según la columna.
    3. **Formulario de crear** (oculto hasta pulsar el botón; se oculta y se vacía al cambiar de columna): campo
       (`maxlength` 80, `keydown` sin propagar para que no salten los atajos de YouTube), botón "Icono" con una
       vista previa del icono y color elegidos (T9), "Guardar", "Cancelar" y error `aria-live`. Guardar valida con
       `validateGroupName` y llama a `createGroup` o `createSubGroup(parent.id, nombre)` (vale en cualquier nivel);
       si se eligió icono o color, después `YouTubeGroups.setGroupAppearance(nuevo.id, icono, color)` (las dos
       funciones devuelven el grupo creado). Si falla solo el segundo paso, el grupo queda creado sin icono y el
       error se muestra en el formulario. Luego oculta el formulario y llama a `renderGroupsPanel()`.
    4. **Columna** de elementos (contenedor deslizable).
  - En la sección **no hay** botones de editar, renombrar, eliminar, cambiar icono de un grupo existente ni quitar
    canales (decidido por la persona, 2026-11-15): quedan para la futura pantalla de edición (`ROADMAP.md`).
  - Columna: sin elemento "Todos". Por cada elemento, una fila con: botón "▸"/"▾" para desplegar sus canales
    (`aria-expanded`; oculto si no tiene canales), botón principal (marca del grupo con `createGroupMark`, nombre con
    elipsis y número de canales propios) y, si tiene subgrupos, botón "›" (`aria-label` "Ver subgrupos de <nombre>").
    Debajo, la lista de canales (`hidden` según `isChannelListOpen`), un botón por canal con su nombre (`title` con la
    URL). Desplegar o plegar cambia `guideChannelOverrides` y el `hidden` de esa lista, sin repintar. Sin grupos, la
    columna raíz muestra el texto "Aún no hay grupos" bajo el botón de crear.
  - `aria-pressed` en grupos y canales según `getFilterKey(activeFilter)`. Un mismo canal puede estar en varias
    listas: todas sus apariciones quedan marcadas y pulsar cualquiera lo deselecciona.
  - Clic en un grupo, subgrupo o canal → `selectFilter(filter)` (alterna; ver **Navegación**); "▸", "›", "‹", el
    título del padre, el botón de crear y el formulario no cambian el filtro ni navegan.
  - Animación: al entrar ("›") la columna actual sale hacia la izquierda y la nueva entra por la derecha; al volver
    ("‹"), al revés. Contenedor con `overflow: hidden; position: relative`; animaciones CSS de 200 ms
    (`youtube-groups__guide-column--in-right`, `--in-left`, `--out-left`, `--out-right`); la columna saliente se quita
    con `animationend` o a los 300 ms. Con `prefers-reduced-motion: reduce`, sin animación.
  - Estilos con variables de YouTube (`--yt-spec-text-primary`, `--yt-spec-text-secondary`,
    `--yt-spec-badge-chip-background`, `--yt-spec-10-percent-layer`) y respaldo claro y `html[dark]`, como la sección
    actual. Filas de 36 px y canales de 32 px, sangrados.
- **Selección que alterna** (decidido por la persona, 2026-11-15; ADR 0007): "Todos" es el estado inicial y significa
  que no hay grupo, subgrupo ni canal seleccionado; no es un elemento pulsable de la guía. Clic en un elemento no
  seleccionado lo selecciona (sustituye a lo que hubiera: selección única) y aplica el filtro; clic en el elemento
  seleccionado lo deselecciona y vuelve a "todos" (sin filtro y sin navegar).
- **Navegación** (ADR 0007): `selectFilter(filter)` calcula `next = toggleFilter(activeFilter, filter)`, llama a
  `setActiveFilter(next)` y, si `shouldNavigateToSubscriptions(pageType, next)`, escribe `serializePendingFilter(next,
  Date.now())` en `sessionStorage` (con
  `try/catch`) y pulsa `ytd-guide-renderer a[href="/feed/subscriptions"]` o `ytd-mini-guide-renderer
  a[href="/feed/subscriptions"]`; si no hay ninguno, `location.assign("/feed/subscriptions")`. Al arrancar, antes del
  primer `refreshActiveFilter`, se lee y borra la clave; si la página es `subscriptions` y `parsePendingFilter` da un
  filtro, se aplica. En `yt-navigate-finish` se borra la clave.
- **Selector de iconos al crear** (T9): `openIconPicker(initial, anchorButton, onSave)` pasa a recibir el icono y color
  de partida (`{ iconId, colorHex }`) y una función `onSave({ iconId, colorHex })` que puede ser asíncrona; el
  selector ya no sabe de grupos (desaparece `form.dataset.groupId`). Al pulsar "Guardar" llama a `onSave`: si
  resuelve, `hideIconPicker()`; si lanza, muestra el mensaje en su error y sigue abierto.
  - Formulario de crear de la guía: `onSave` guarda la elección en el formulario y pinta la vista previa; no escribe
    nada hasta pulsar "Guardar" en el formulario. "Cancelar" del formulario o cambiar de columna la descarta.
  - Botón "Icono" del panel (hasta `gui-4-panel`): `onSave` llama a `setGroupAppearance(group.id, ...)` y a
    `renderGroupsPanel()`, como hoy.
  - El selector se abre junto al botón "Icono" del formulario (mismo cálculo de posición) y se sigue cerrando con
    clic fuera y con el scroll de la ventana. Riesgo: si la guía se desplaza por dentro (tiene scroll propio), el
    selector no se cierra y queda separado del botón; se acepta (se cierra con clic fuera).

## Tareas

Reglas comunes: sin `innerHTML` con datos; JSDoc; `make lint` (0 avisos) y `make test` en verde. Los módulos nuevos
se añaden a `manifest.json` (tras `modules/pages.js`: `filter.js`, `guide.js`) y a `MODULES` y al objeto devuelto de
`tests/helpers/load-modules.js`.

- [x] T1 · `modules/filter.js` (ver **Decisiones**) · Ficheros: `modules/filter.js`, `tests/filter.test.js`,
  `manifest.json`, `tests/helpers/load-modules.js` · Test: `normalizeFilter` acepta grupo y canal (normaliza
  `https://www.youtube.com/@x?a=1` a `.../@x`) y da "todos" con `null`, tipo desconocido, id vacío o URL de otro
  origen; `getFilterKey` de los tres tipos; `resolveFilterUrls` con grupo que tiene subgrupos (incluye sus canales),
  con canal (solo su URL), con "todos" y con id inexistente (`"missing"`); `isFilterOnRemovedGroup`;
  `toggleFilter`: desde "todos" con grupo A → A; con A activo y A otra vez → "todos"; con A activo y B → B; con A
  activo y un canal → el canal; con un canal activo y el mismo canal escrito con otra forma que normaliza igual
  (`.../@x?a=1`) → "todos"; con un canal activo cuya URL es `https://www.youtube.com/@x` y un grupo con `id`
  `"https://www.youtube.com/@x"` → el grupo (claves distintas por tipo); con `next` no válido → "todos"; no muta
  `current`; `shouldNavigateToSubscriptions` para `home`, `watch` y `subscriptions` con grupo, canal y "todos";
  `parsePendingFilter(serializePendingFilter(f, t), t + 1000)` devuelve `f`; da `null` con `t + 31000`, con
  `createdAt` en el futuro, con JSON roto, `version: 2` o filtro "todos".
- [x] T2 · `content.js` con `activeFilter`, `setActiveFilter`, `refreshActiveFilter`, `isFilterOnRemovedGroup` y
  `handleGroupsRemoved(removedIds)` (usada por la limpieza y por "Eliminar" del panel), sin cambios visibles ·
  Ficheros: `content.js` · Test: `make lint`, `make test` y a mano V1 (regresión de filtros).
- [x] T3 · `modules/guide.js` (ver **Decisiones**) · Ficheros: `modules/guide.js`, `tests/guide.test.js`,
  `manifest.json`, `tests/helpers/load-modules.js` · Test: árbol de tres niveles: `getGuideColumn(g, [])` da los de
  primer nivel con `hasSubgroups` y canales; con `[A]` da los subgrupos de A y `parent` A; `normalizeGuidePath`
  recorta ids inexistentes, saltos de nivel (`[A, nieto]`) y grupos sin subgrupos, y con algo que no es array da `[]`;
  `enterGuideGroup` no entra en un id de otra columna ni en uno sin subgrupos; `leaveGuideGroup([])` da `[]`;
  `isChannelListOpen` con y sin override en profundidad 0 y 1, abierta en profundidad 0 si contiene el canal activo
  (`activeKey` `"channel:<url>"`), cerrada si el activo es un grupo o es "todos" (`null`), y el override `false` gana
  aunque contenga el canal activo; `findGuideInsertionIndex` encuentra la sección con
  `https://studio.youtube.com/` o `https://music.youtube.com/` aunque haya `/feed/history` y hrefs relativos o no
  válidos, y da `-1` sin ellas; la entrada no se muta.
- [x] T4 · `YouTubeGroups.validateGroupName` · Ficheros: `modules/groups.js`, `tests/groups.test.js` · Test: `"a"`,
  `"  a "` y `42` dan el mensaje de mínimo; 81 caracteres el de máximo; `"ab"` y 80 caracteres dan `null`; con
  `"subgroup"` los mensajes dicen "subgrupo".
- [x] T5 · Sección "YouTube Groups" en la guía: posición, cabecera, botón "+ Crear grupo" visible pero aún sin
  función, columna raíz sin "Todos" con grupos, listas de canales plegadas (salvo la que contiene el canal activo) y
  selección que alterna por grupo y por canal (`selectFilter` con `toggleFilter`, sin navegar todavía); estilos
  claro/oscuro. Sustituye la sección "Grupos" actual · Ficheros: `content.js`, `content.css` · Test: `make lint`,
  `make test` y a mano V2, V3.
- [x] T6 · Columnas de subgrupos: "›", "‹", título del padre no pulsable, botón de crear con el texto "+ Crear
  subgrupo" (aún sin función), canales desplegados por defecto, varios niveles y animación (sin animación con
  `prefers-reduced-motion`) · Ficheros: `content.js`, `content.css` · Test: `make lint`, `make test` y a mano V4.
- [x] T7 · Paso a `/feed/subscriptions` en `selectFilter` (solo con filtro resultante distinto de "todos") y traspaso
  por `sessionStorage` · Ficheros: `content.js` · Test: `make lint`, `make test` y a mano V5.
- [x] T8 · Botón de crear y su formulario, sin icono todavía (grupo en la raíz, subgrupo en las demás columnas) con
  `validateGroupName` · Ficheros: `content.js`, `content.css` · Test: `make lint`, `make test` y a mano V6.
- [ ] T9 · Icono y color al crear: nueva firma de `openIconPicker(initial, anchorButton, onSave)` (ver **Selector de
  iconos al crear**), botón "Icono" con vista previa en el formulario de la guía y `setGroupAppearance` tras crear; el
  botón "Icono" del panel pasa a la nueva firma sin cambiar su comportamiento · Ficheros: `content.js`, `content.css`
  · Test: `make lint`, `make test` y a mano V8.
- [ ] T10 · Cerrar: `docs/ARCHITECTURE.md` (filas de `filter.js` y `guide.js`, `validateGroupName` en `groups.js`,
  orden de carga, flujos **Filtro** y **Guía lateral** reescritos, selector de iconos con `onSave`, enlace al ADR
  0007); ADR 0007 a `aceptada`. Estado de este plan a `hecho` · Ficheros: `docs/ARCHITECTURE.md`,
  `docs/adr/0007-filtro-activo-y-paso-a-suscripciones.md`, este plan · Test: `make lint` y `make test`.

### Verificación manual (Firefox con sesión iniciada, extensión cargada en `about:debugging`; recargar la extensión tras cada tarea)

Preparación: dos grupos A y B; A con un subgrupo A1 y este con un subgrupo A1a (crear A1a con el "+" de la guía tras
T8, o importar una copia); cada uno con algún canal que tenga vídeos recientes.

- V1 · (tras T2) En `/feed/subscriptions`, desde el panel: A muestra solo vídeos de canales de A, A1 y A1a; A1 solo de
  A1 y A1a; "Todos" muestra todo. Con A activo, "Filtros" → Duración y "Ajustes" → Vídeos vistos (mostrar, atenuar,
  ocultar) y Vídeos fuera del filtro (ocultar, atenuar) se comportan como antes. Borrar el grupo activo vuelve a
  "Todos".
- V2 · La sección "YouTube Groups" está justo encima de "Más de YouTube" en `/`, `/feed/subscriptions`, una búsqueda,
  una página de canal y en el cajón de `/watch` (menú ☰). Bajo el título, el primer elemento es "+ Crear grupo". No
  hay "Todos" ni botones de editar, eliminar o icono. Con la ventana estrecha (YouTube muestra la mini-guía de
  iconos), el menú ☰ abre el cajón con la sección "YouTube Groups" y se puede filtrar desde ahí. Tras navegar varias
  veces sigue habiendo una sola.
- V3 · Los canales de cada grupo están plegados; "▸" los despliega. En suscripciones, sin nada marcado se ve todo.
  Clic en un canal: solo se ven sus vídeos y el canal queda marcado; clic otra vez en el mismo canal: se desmarca y se
  ve todo. Clic en A: vídeos de A y descendientes y solo A marcado; clic en B: B sustituye a A; clic en B otra vez:
  nada marcado y se ve todo. Un canal que está en A y en B se marca en las dos listas. El panel marca A cuando se
  elige desde la guía y viceversa; "Todos" del panel desmarca la guía.
- V4 · "›" en A: la columna se desplaza a la izquierda y entra la de A1 con sus canales desplegados; arriba, "‹" y el
  título "A"; debajo, "+ Crear subgrupo". "›" en A1 entra A1a; "‹" vuelve con la animación inversa. Clic en el título
  "A" no hace nada. Con "Reducir movimiento" activado en el sistema, el cambio es instantáneo.
- V5 · En `/` y en un `/watch`: clic en B → se pasa a suscripciones con solo vídeos de B y B marcado. Desde `/watch`,
  clic en un canal (lista desplegada) → suscripciones con solo ese canal. Con B activo, volver a `/` y pulsar B: se
  desmarca, se quita el filtro y **no** se cambia de página. Con un canal que esté en A y en A1 (sin haber tocado la
  lista de A): elegirlo en la columna de A1 y volver con "‹": la lista de A aparece desplegada con el canal marcado,
  y pulsarlo ahí lo desmarca. Plegarla con "▾" la pliega aunque contenga el canal activo.
- V6 · "+ Crear grupo": crear "C" aparece en la guía y en el panel; "a" muestra el error de mínimo; `<b>x</b>` se ve
  como texto. "+ Crear subgrupo" dentro de A1: crea un subgrupo de A1. Escribir en el campo no dispara atajos de
  YouTube (por ejemplo, "k" o "/"). Abrir el formulario y pulsar "‹": el formulario se oculta y se vacía.
- V7 · En otra pestaña, borrar A1 desde el panel con la guía de esta pestaña dentro de A1: esta vuelve a la columna
  válida más profunda (A o la raíz) sin recargar. Tema oscuro y claro: la sección se lee bien en los dos.
- V8 · Formulario de crear → "Icono": el selector se abre junto al botón; elegir icono y color → "Guardar": el
  selector se cierra del todo y la vista previa del formulario muestra la elección; "Guardar" del formulario crea el
  grupo y la guía lo muestra con ese icono y color. "Cancelar" el formulario tras elegir icono y volver a abrirlo:
  empieza sin icono. Crear sin elegir icono funciona como en V6. El botón "Icono" del panel sigue cambiando el icono
  de un grupo existente.

## Criterios de aceptación

- La guía lateral muestra "YouTube Groups" encima de "Más de YouTube" en todas las páginas con guía (también en el
  cajón de ☰), con "+ Crear grupo" como primer elemento, los grupos y sus canales (plegados), "›" para entrar en los
  subgrupos a cualquier nivel (con "+ Crear subgrupo") y "‹" para volver. Se puede elegir icono y color al crear. No
  hay botones de editar ni eliminar.
- No hay elemento "Todos": sin nada marcado no hay filtro. Pulsar un grupo, subgrupo o canal lo marca y sustituye a
  lo marcado antes; pulsarlo otra vez lo desmarca y quita el filtro sin cambiar de página.
- Marcar un elemento fuera de suscripciones lleva a `/feed/subscriptions` con ese filtro aplicado; en suscripciones
  filtra sin navegar. Un canal filtra solo sus vídeos.
- Los filtros existentes (grupo, subgrupo, "Todos", filtros avanzados, vistos y modos de visibilidad) funcionan igual
  que antes, también desde el panel.
- Formatos de `browser.storage.local` sin cambios; sin dependencias nuevas.

## Fuera de alcance

- Renombrar o borrar grupos, cambiar el icono de un grupo existente o quitar canales desde la guía: pantalla propia
  futura (`ROADMAP.md`, lo anota `gui-4-panel`). Mientras dure este plan siguen en el panel; quitar canales se hace,
  como hoy, con "+G" de las tarjetas y "Canal actual".
- Marcar en la columna raíz qué grupo contiene el filtro activo cuando este es un subgrupo de otra columna (hay que
  entrar con "›" para verlo marcado y poder desmarcarlo).
- Mostrar en una columna de subgrupos los canales propios del grupo padre (se ven en la columna anterior).
- Mini-guía (la barra estrecha de iconos de YouTube), YouTube móvil. Con la ventana estrecha la sección está en el
  cajón de ☰ (V2); si YouTube cambia el DOM de la guía y la sección no aparece, no se puede filtrar por grupo hasta
  corregirlo (riesgo descrito en `gui-4-panel`).
- Conservar el filtro o la columna de la guía tras una recarga hecha por la persona (ADR 0003 y 0007).
- Comparar handles sin distinguir mayúsculas en el filtro de canal (igual que el de grupo, ADR 0001).
- Reorganizar el panel flotante (`gui-4-panel`).
- Tests de DOM de `content.js`.

## Cambios aprobados

Cambios sobre el plan después de aprobarlo. Sin una línea aquí, un cambio no está aprobado.

| Fecha | Tarea | Cambio | Motivo | Aprobado por |
| --- | --- | --- | --- | --- |

## Registro

Una línea por commit, añadida **antes** de commitear. El plan actualizado va en el mismo commit que el cambio.

| Fecha | Tarea | Commit | Nota |
| --- | --- | --- | --- |
| 2026-11-15 | T1 | `feat: módulo de filtro activo (todos, grupo o canal)` | `modules/filter.js` con tests; añadido a `manifest.json` y a `load-modules.js`. |
| 2026-11-15 | T2 | `refactor: content.js usa un filtro activo general` | `activeFilter`, `setActiveFilter`, `refreshActiveFilter` y `handleGroupsRemoved`; sin cambios visibles. V1 manual pendiente. |
| 2026-11-15 | T3 | `feat: módulo puro de la columna de la guía lateral` | `modules/guide.js` con tests; añadido a `manifest.json` y a `load-modules.js`. |
| 2026-11-15 | T4 | `feat: YouTubeGroups.validateGroupName` | Validación de nombre de grupo/subgrupo en `modules/groups.js` con tests. |
| 2026-11-15 | T5 | `feat: sección YouTube Groups en la guía lateral con filtro que alterna` | Sección sobre "Más de YouTube", columna raíz con canales plegables y selección alternante; "+ Crear grupo" aún sin función. V2 y V3 manuales pendientes. |
| 2026-11-15 | T6 | `feat: columnas de subgrupos con animación en la guía lateral` | Botones "›" y "‹", título del padre no pulsable, "+ Crear subgrupo" sin función, animación de 200 ms (sin ella con `prefers-reduced-motion`). V4 manual pendiente. |
| 2026-11-15 | T7 | `feat: paso a suscripciones al elegir filtro desde la guía` | `selectFilter` navega con el filtro resultante; traspaso por `sessionStorage` (guardar, consumir al arrancar, borrar en `yt-navigate-finish`). V5 manual pendiente. |
| 2026-11-15 | T8 | `feat: crear grupos y subgrupos desde la guía lateral` | Formulario oculto bajo el botón de crear (grupo en la raíz, subgrupo en las demás columnas) con `validateGroupName`; se oculta y vacía al cambiar de columna. Sin icono todavía. V6 manual pendiente. |
