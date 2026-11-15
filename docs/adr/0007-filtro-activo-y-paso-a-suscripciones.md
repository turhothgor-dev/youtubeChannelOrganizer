# 0007 · Filtro activo (todos, grupo o canal) y paso a /feed/subscriptions

- Estado: propuesta
- Fecha: 2026-11-15

## Contexto

La revisión de la GUI (plan `2026-11-15-gui-3-guia-lateral`) mueve la elección del filtro a la guía lateral de
YouTube, que está en todas las páginas, y añade el filtro por un solo canal. Al elegir un grupo, subgrupo o canal hay
que ir a `/feed/subscriptions` y aplicar allí el filtro.

Hoy el filtro es un id de grupo en memoria de la pestaña (`activeGroupId`), se pierde al recargar (ADR 0003,
"Alternativas descartadas") y se mantiene en las navegaciones SPA porque el content script no se recarga. Una carga
completa de página sí reinicia el script y perdería el filtro elegido justo antes de navegar.

## Decisión

1. **Modelo del filtro** (`modules/filter.js`, `YouTubeGroupsFilter`), en memoria de la pestaña como hoy:
   `{ type: "all" }`, `{ type: "group", id }` o `{ type: "channel", url, name }`. El filtro de canal compara la URL
   normalizada del canal (`normalizeChannelUrl`) con la de la tarjeta, igual que el de grupo (ADR 0001); no depende de
   que el canal siga en algún grupo. Cada filtro tiene una clave con el tipo delante (`group:<id>`,
   `channel:<url>`; `null` para "todos"), así que un grupo y un canal nunca se confunden.
2. **Selección que alterna** (decidido por la persona, 2026-11-15): "Todos" no es un elemento que se elija; es el
   estado inicial y significa que no hay grupo, subgrupo ni canal seleccionado. En la guía, pulsar un elemento no
   seleccionado lo selecciona y sustituye a lo anterior (selección única); pulsar el seleccionado lo deselecciona y
   vuelve a "todos". Lo calcula `toggleFilter(actual, pulsado)` comparando claves.
3. **Navegación**: si el filtro **resultante** no es "todos" y la página no es `/feed/subscriptions`, el script guarda
   el filtro en memoria y navega pulsando el enlace propio de YouTube a suscripciones de la guía
   (`a[href="/feed/subscriptions"]`, navegación SPA: la memoria se conserva). Si no lo encuentra, usa
   `location.assign("/feed/subscriptions")` (carga completa). Deseleccionar nunca navega: quita el filtro en la
   página actual.
4. **Traspaso tras carga completa**: antes de navegar se escribe en `sessionStorage` (de la pestaña, origen
   `www.youtube.com`) la clave `youtubeGroupsPendingFilter`:

   ```json
   { "version": 1, "filter": { "type": "group", "id": "<uuid>" }, "createdAt": 1763200000000 }
   ```

   Al arrancar en `/feed/subscriptions`, el script la lee, la borra siempre y aplica el filtro si es válido y tiene
   menos de 30 s. En `yt-navigate-finish` se borra (en la ruta SPA el filtro ya está en memoria).
5. **Estado de la guía** (columna abierta y listas de canales desplegadas): solo en memoria; tras recargar vuelve a la
   columna principal con las listas en su estado por defecto. Como la única forma de quitar el filtro es volver a
   pulsar lo elegido, la lista que contiene el canal activo se despliega por defecto.

No cambia ningún formato de `browser.storage.local` (ADR 0001 a 0006) ni la copia de seguridad.

## Alternativas descartadas

- Parámetro en la URL (`/feed/subscriptions?ytg=...`): visible, se comparte al copiar el enlace y YouTube puede
  quitarlo o reescribirlo en sus navegaciones.
- Guardar el filtro en `browser.storage.local`: cambiaría el comportamiento (filtro en todas las pestañas y tras
  recargar) y dispararía `storage.onChanged` en las demás pestañas.
- Usar la API interna de navegación de YouTube (`yt-navigate`, `ytd-app.navigate`...): no es pública y cambia sin
  aviso; pulsar su propio enlace usa el mismo camino que una persona.
- Navegar siempre con carga completa: más lento y pierde el estado de la guía sin necesidad.
- Un elemento "Todos" en la guía (como en el panel actual): la persona prefiere que la selección se active y
  desactive con el mismo clic, sin un elemento más en cada columna.
- Que el nombre del grupo padre, en una columna de subgrupos, filtre por ese grupo: la persona prefiere que sea solo
  un título; el grupo completo se elige en la columna anterior.

## Consecuencias

- Se gana: el filtro elegido en cualquier página llega a suscripciones, por SPA o por carga completa, sin permisos ni
  formatos nuevos.
- Se pierde: nada del comportamiento actual; el filtro sigue sin sobrevivir a una recarga hecha por la persona.
- Se pierde también, tras el plan `2026-11-15-gui-4-panel`, la elección de grupo desde el panel flotante: la guía
  es el único sitio para elegir filtro.
- A vigilar: si YouTube cambia el enlace de suscripciones de la guía, se usa siempre la carga completa (más lenta pero
  correcta). Si cambia el DOM de la guía y la sección no aparece, no se puede filtrar por grupo ni por canal hasta
  corregirlo; con la ventana estrecha la sección sigue en el cajón de ☰. Los scripts de la página pueden leer
  `sessionStorage`; solo contiene un id de grupo o una URL de canal.
