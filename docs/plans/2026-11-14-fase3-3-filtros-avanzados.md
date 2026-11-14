# Plan: Fase 3 (3/4) · Filtros avanzados (duración, fecha, popularidad)

**Estado:** aprobado (2026-11-14)

Issue: `ROADMAP.md`, Fase 3: "Filtros avanzados (duración, fecha, popularidad)".

<!-- Estados: borrador → aprobado (AAAA-MM-DD) → hecho. Se cambia solo la línea `**Estado:**`, y lo
     hace quien tiene la aprobación de una persona; los subagentes no ven la conversación, solo este fichero. -->

## Contexto y decisión

Requisito previo: el plan `2026-11-14-fase3-1-visibilidad-vistos.md` en estado `hecho` (usa `applyCardVisibility`,
`getCardVisibility` y el ajuste "Vídeos fuera del filtro"). Puede implementarse antes o después del plan 2.

Hoy el único filtro es el grupo. La persona quiere además filtrar por duración, antigüedad y número de
visualizaciones. La extensión no hace peticiones de red, así que esos datos solo pueden salir del texto que YouTube
ya pinta en cada tarjeta: la insignia de duración (`12:34`), la antigüedad (`hace 3 días` / `3 days ago`) y las
visualizaciones (`1,2 M de visualizaciones` / `1.2M views`). Ese texto depende del idioma de YouTube.

### Decisiones (delegadas por la persona)

- **Idiomas:** se interpretan español e inglés. En otros idiomas los datos no se reconocen y el filtro deja pasar
  la tarjeta.
- **Dato desconocido = pasa** (por criterio): si no se puede leer la duración (Shorts, directos, tarjetas sin
  insignia), la antigüedad o las visualizaciones, ese criterio no excluye la tarjeta. Ocultar por no saber leer
  sería peor que mostrar de más.
- **Opciones fijas** (como los filtros de búsqueda de YouTube), no valores libres:
  - Duración (`duration`): Cualquiera (`any`), Menos de 4 min (`short`, `< 240 s`), De 4 a 20 min (`medium`,
    `240 s ≤ d ≤ 1200 s`), Más de 20 min (`long`, `> 1200 s`).
  - Fecha (`age`): Cualquiera (`any`), Últimas 24 horas (`day`, `≤ 86 400 s`), Última semana (`week`, `≤ 7 días`),
    Último mes (`month`, `≤ 30 días`), Último año (`year`, `≤ 365 días`).
  - Popularidad (`views`): Cualquiera (`any`), Desde 1 mil (`1k`), Desde 10 mil (`10k`), Desde 100 mil (`100k`),
    Desde 1 M (`1m`) visualizaciones (`≥` umbral).
- **Estado en memoria, no guardado**, como el grupo activo: `advancedFilters = { duration: "any", age: "any",
  views: "any" }` en `content.js`; se conserva al navegar dentro de YouTube (SPA) y se pierde al recargar. No
  cambia ningún formato de almacenamiento.
- **Se combinan con el grupo con Y:** una tarjeta pasa el filtro si pasa el grupo **y** los filtros avanzados. El
  resultado entra como `matchesFilter` en `getCardVisibility`, así que el ajuste "Vídeos fuera del filtro" (ocultar
  o atenuar) se aplica igual.
- **Módulo nuevo `modules/metadata.js`** (`YouTubeGroupsMetadata`, sin DOM, puro):
  - `parseDuration(text)`: `"12:34"` → 754, `"1:02:03"` → 3723; solo `m:ss` o `h:mm:ss` (minutos y segundos de
    dos cifras menores que 60 tras el primer grupo, que admite 1 o 2 cifras); espacios alrededor permitidos; si no,
    `null`.
  - `parseViewCount(text)`: exige la palabra `visualización`/`visualizaciones` o `view`/`views` (sin distinguir
    mayúsculas); `Sin visualizaciones` y `No views` → 0. Número con sufijo opcional: `K`/`mil` (×1 000),
    `M`/`mill.` (×1 000 000), `B`/`mil M`/`mil millones` (×1 000 000 000). Con sufijo, `,` o `.` es el separador
    decimal; sin sufijo, `,`, `.` y espacios (incluido el no separable) son separadores de miles. Devuelve un
    entero (`Math.round`). Textos de directos (`espectadores`, `watching`) → `null`.
  - `parseAge(text)`: español `hace N <unidad>` (también precedido de `Emitido`/`Transmitido`/`Estrenado`) e inglés
    `N <unit> ago` (también precedido de `Streamed`/`Premiered`). Unidades en singular y plural: segundo/second,
    minuto/minute, hora/hour, día/dia/day, semana/week, mes/meses/month, año/year. Mes = 30 días, año = 365 días.
    Devuelve segundos; si no, `null`.
  - `extractCardMetadata(texts)`: recorre un array de cadenas y devuelve `{ duration, age, views }` con el primer
    valor no nulo de cada parser (o `null`).
  - `FILTER_OPTIONS`: las opciones de arriba (id y etiqueta) por criterio, para que `content.js` pinte los
    `<select>` sin repetir datos.
  - `matchesAdvancedFilters(metadata, filters)`: `true` si cada criterio es `any`, su dato es `null` o el dato cumple
    el rango. Un id de filtro desconocido se trata como `any`.
  - `hasActiveFilters(filters)`: `true` si algún criterio no es `any`.
- **Lectura del DOM en `content.js`**, aislada en una función `getCardTexts(card)`: textos recortados (1 a 60
  caracteres) de los elementos `span` y `div` **sin hijos elemento** de la tarjeta, excluyendo los que están dentro
  de `h3` o `#video-title` (el título podría parecer una fecha). Es deliberadamente genérica: no depende de las
  clases de las insignias de YouTube, que cambian.
- **Rendimiento:** solo se leen los textos si `hasActiveFilters(advancedFilters)`. Caché `WeakMap` tarjeta →
  `{ videoId, metadata }`, reutilizada si el ID del vídeo de la tarjeta no ha cambiado **y** los tres datos son no
  nulos (si falta alguno, se vuelve a leer: YouTube pinta la insignia de duración tarde). Como `applyWatchedToCard`
  (y con ella `applyCardVisibility`) se ejecuta en cada procesado de la tarjeta, una tarjeta se reevalúa cuando
  llegan sus metadatos.
- **Interfaz:** sección plegable estática `<details class="youtube-groups__filters">` con `<summary>Filtros</summary>`
  en la plantilla del panel, encima de "Ajustes", con tres `<select>` vacíos (Duración, Fecha, Popularidad) que
  `content.js` rellena desde `FILTER_OPTIONS` con `createElement("option")` y `textContent`, y un botón "Quitar
  filtros". Con algún filtro activo, el `<summary>` muestra "Filtros (N)" (N = criterios activos, vía
  `textContent`). Cambiar un `<select>` o quitar filtros actualiza `advancedFilters` y reaplica
  `applyCardVisibility` a todas las tarjetas; no hay guardado, así que no hay estado de error.

Alternativas descartadas:

- Pedir duración, fecha y visualizaciones a la YouTube Data API: red, clave de API y cuota.
- Leer los datos internos de YouTube (`ytInitialData`, propiedades `data` de los elementos `ytd-*`): no públicos y
  accesibles desde el content script solo con `wrappedJSObject`; más frágil que el texto visible.
- Selectores concretos de la insignia y de la línea de metadatos: cambian con cada rediseño de YouTube (`ytd-*` vs
  `yt-lockup-view-model`); la lectura genérica de textos hoja resiste mejor.
- Rangos libres (mínimo y máximo escritos a mano): más validación e interfaz sin un caso que lo pida.
- Guardar los filtros: cambiaría el comportamiento del filtro, que hoy es de la pestaña (ver ADR 0003).
- Dato desconocido = no pasa: ocultaría Shorts, directos y todas las tarjetas en otros idiomas.

Sin ADR nuevo (no cambia el almacenamiento ni hay dependencias). `docs/ARCHITECTURE.md` se actualiza en T4.

## Tareas

Reglas comunes: nada de `innerHTML` con valores interpolados; textos siempre con `textContent`; JSDoc en las
funciones nuevas; los tests usan `loadModules` y `plain`. Cada tarea termina con `make test` y `make lint` en verde y
sin avisos.

- [x] T1 · Intérpretes de metadatos. Nuevo `modules/metadata.js` con `parseDuration`, `parseViewCount` y `parseAge`.
  Añadirlo a `manifest.json` (después de `modules/visibility.js`, antes de `content.js`) y a `MODULES` de
  `tests/helpers/load-modules.js`, que también devuelve `YouTubeGroupsMetadata` · Ficheros: `modules/metadata.js`
  (nuevo), `manifest.json`, `tests/helpers/load-modules.js`, `tests/metadata.test.js` (nuevo) · Test:
  `parseDuration`: `"0:59"` 59, `"12:34"` 754, `"1:02:03"` 3723, `" 4:00 "` 240; `null` para `"12:3"`, `"1:60"`,
  `"abc"`, `"12"`, `"EN DIRECTO"`, `""`. `parseViewCount`: `"345 visualizaciones"` 345, `"1 visualización"` 1,
  `"1.234 visualizaciones"` 1234, `"12 mil visualizaciones"` 12000, `"1,2 M de visualizaciones"` 1200000,
  `"2 mil M de visualizaciones"` 2000000000, `"Sin visualizaciones"` 0, `"1.2M views"` 1200000, `"12K views"`
  12000, `"1,234 views"` 1234, `"3.4B views"` 3400000000, `"No views"` 0; `null` para `"1,2 mil espectadores"`,
  `"500 watching"`, `"hace 3 días"`, `"12:34"`. `parseAge`: `"hace 3 días"` 259200, `"hace 1 hora"` 3600,
  `"Emitido hace 2 semanas"` 1209600, `"hace 5 meses"` 12960000, `"hace 1 año"` 31536000, `"3 days ago"` 259200,
  `"Streamed 1 month ago"` 2592000, `"10 minutes ago"` 600; `null` para `"345 visualizaciones"`, `"ayer"`,
  `"12:34"`.
- [ ] T2 · Criterios de filtro. En `modules/metadata.js`: `extractCardMetadata`, `FILTER_OPTIONS`,
  `matchesAdvancedFilters` y `hasActiveFilters` · Ficheros: `modules/metadata.js`, `tests/metadata.test.js` · Test:
  `extractCardMetadata(["Título", "12:34", "1,2 M de visualizaciones", "hace 3 días"])` devuelve los tres datos;
  con textos sin datos devuelve tres `null`; usa el primer valor de cada tipo. `matchesAdvancedFilters`: todo `any`
  pasa; límites exactos (`short` con 239 sí y 240 no; `medium` con 240 y 1200 sí; `long` con 1201 sí y 1200 no;
  `day` con 86400 sí y 86401 no; `1k` con 999 no y 1000 sí); dato `null` pasa en cada criterio; un criterio que
  falla basta para no pasar; id desconocido = `any`. `hasActiveFilters` con todo `any` es `false` y con uno activo
  `true`. Cada criterio de `FILTER_OPTIONS` empieza por `any` y tiene ids únicos y etiquetas no vacías.
- [ ] T3 · Filtros en el panel y en las tarjetas. En `content.js`: `advancedFilters`, `getCardTexts`, la caché de
  metadatos, el cálculo de `matchesFilter` (grupo Y filtros avanzados) dentro de `applyCardVisibility`, la sección
  "Filtros" (ver **Decisiones**) y sus manejadores. En `content.css`: estilos de la sección (claro y `html[dark]`) ·
  Ficheros: `content.js`, `content.css` · Test: `make lint`, `make test` y a mano V1 a V6.
- [ ] T4 · Cerrar el plan. En `ROADMAP.md`, marcar con ✅ "Filtros avanzados (duración, fecha, popularidad)". En
  `docs/ARCHITECTURE.md`: fila de `modules/metadata.js`, orden de carga, y el flujo "Filtro" describe los filtros
  avanzados (texto visible, español e inglés, desconocido = pasa, combinación Y con el grupo). Estado de este plan a
  `hecho` · Ficheros: `ROADMAP.md`, `docs/ARCHITECTURE.md`, este plan · Test: `make lint` y `make test`.

### Verificación manual (con `make up`, YouTube en español y luego en inglés)

- V1 · En `/feed/subscriptions`, "Duración: Más de 20 min": solo quedan vídeos de más de 20 minutos (comprobar la
  insignia); los Shorts y directos siguen visibles. "Quitar filtros": vuelve todo.
- V2 · "Fecha: Última semana": desaparecen los de `hace 2 semanas` o más. "Popularidad: Desde 100 mil": desaparecen
  los de menos visualizaciones.
- V3 · Con un grupo activo y "Duración: Menos de 4 min": solo quedan vídeos cortos de ese grupo. Con "Vídeos fuera
  del filtro: Atenuar", los excluidos se atenúan en vez de ocultarse.
- V4 · Hacer scroll largo con un filtro activo: las tarjetas nuevas también se filtran (también las que pintan la
  duración tarde).
- V5 · Navegar de suscripciones a inicio: los filtros siguen activos y el resumen "Filtros (N)" se mantiene;
  recargar (F5): vuelven a "Cualquiera".
- V6 · Cambiar el idioma de YouTube a inglés y repetir V1 y V2: funcionan igual. En un tercer idioma, ninguna
  tarjeta se oculta por los filtros avanzados.

## Criterios de aceptación

- La persona puede filtrar por duración, antigüedad y visualizaciones desde el panel, con YouTube en español o en
  inglés; el cambio se aplica al momento y a las tarjetas que se cargan después.
- Los filtros avanzados se combinan con el grupo activo y respetan el ajuste "Vídeos fuera del filtro".
- Una tarjeta cuyo dato no se puede leer no se oculta por ese criterio.
- Los filtros se mantienen al navegar dentro de YouTube y se reinician al recargar; no se guarda nada nuevo.
- En `ROADMAP.md`, "Filtros avanzados (duración, fecha, popularidad)" aparece con ✅.
- `make lint` (0 avisos) y `make test` pasan.

## Fuera de alcance

- Otros idiomas, rangos libres, ordenar tarjetas, filtrar por título o por canal.
- Guardar los filtros o tener filtros por grupo.
- Datos de la API de YouTube o de `ytInitialData`.
- Resultados de búsqueda, Shorts y recomendaciones como objetivo propio (Fase 5); sus tarjetas se filtran si
  coinciden con `VIDEO_CARD_SELECTOR`.

## Cambios aprobados

Cambios sobre el plan después de aprobarlo. Sin una línea aquí, un cambio no está aprobado.

| Fecha | Tarea | Cambio | Motivo | Aprobado por |
| --- | --- | --- | --- | --- |

## Registro

Una línea por commit, añadida **antes** de commitear. El plan actualizado va en el mismo commit que el cambio.

| Fecha | Tarea | Commit | Nota |
| --- | --- | --- | --- |
| 2026-11-14 | T1 | feat: añadir los intérpretes de metadatos de tarjeta (duración, visualizaciones, antigüedad) | `modules/metadata.js` con `parseDuration`, `parseViewCount` y `parseAge`; en manifest y helper de tests. |
