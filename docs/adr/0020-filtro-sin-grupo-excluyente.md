# 0020 · Filtro "Sin grupo": clave de selección excluyente y filtro por exclusión

- Estado: propuesta
- Fecha: 2026-11-18
- Modifica: [0011](0011-seleccion-de-hermanos.md) (añade un tipo de clave)

## Contexto

La persona quiere ver solo los vídeos de canales que aún no están en ningún grupo ni subgrupo (ROADMAP 6-3, plan
[2026-11-19-fase6-3-filtro-sin-grupo](../plans/2026-11-19-fase6-3-filtro-sin-grupo.md)). La selección del ADR 0011 es
un array de claves `group:<id>` y `channel:<contenedor>:<url>` cuyo filtro es la **unión** de URL de canal: una
tarjeta pasa si su canal está en el conjunto. "Sin grupo" es lo contrario: pasa si su canal **no** está en ningún
grupo. Ya existe la lista de suscripciones conocidas (`youtubeSubscriptions`, ADR 0018), pero es parcial (solo
altas desde la guía, completa solo tras visitar `/feed/channels`).

## Decisión

1. **Clave**: `ungrouped` (sin `:` ni contenedor), filtro normalizado `{ type: "ungrouped" }`
   (`YouTubeGroupsFilter.UNGROUPED_FILTER`). `parseFilterKey`, `normalizeSelection` y el traspaso por `sessionStorage`
   la aceptan; el traspaso sigue en `version: 3` (el formato no cambia, solo hay un valor de clave más).
2. **Excluyente**: `ungrouped` solo es hermana de sí misma. Con la regla de `toggleSelection` del 0011, seleccionarla
   quita todo lo demás y seleccionar un grupo o canal la quita. `resolveSelection` conserva la regla de hermanos del
   último (si `ungrouped` es la última, queda sola).
3. **Filtro por exclusión**: `resolveSelection` devuelve además `exclude` (booleano). Con `ungrouped`, `exclude` es
   `true` y `urls` es el conjunto de **claves de canal** (`getChannelKey`) de todos los canales de todos los grupos y
   subgrupos. Una tarjeta pasa si su canal identificado no está en ese conjunto (comparando `getChannelKey` de su
   URL, insensible a mayúsculas en `/@handle`). Sin canal identificado pero con ID de vídeo no pasa (mixes,
   colaboraciones), igual que con grupos; sin canal ni ID (aún sin pintar) pasa; mientras se cargan los grupos
   (`urls === null`) pasa.
4. **Qué es "sin grupo"**: todo canal que no está en ningún grupo ni subgrupo, esté o no entre las suscripciones
   conocidas. El filtro no lee `youtubeSubscriptions`; esa clave solo da el número que se muestra junto a la entrada.
5. **Páginas, navegación y persistencia**: las mismas que cualquier clave (0007/0011): el filtro se aplica allí donde
   se aplica la selección, al añadirla fuera de `/feed/subscriptions` se navega allí y vive en memoria de la pestaña.

No cambia ningún formato de `browser.storage.local` ni la copia de seguridad.

## Alternativas descartadas

- Filtrar por las suscripciones conocidas sin grupo (`getUnclassifiedSubscriptions`): dependería de que la lista
  esté completa; un canal suscrito aún no leído quedaría oculto y en inicio o búsqueda no se verían canales no
  suscritos que tampoco están clasificados.
- Combinable con grupos (unión "grupo A + sin grupo"): mezcla inclusión y exclusión en un mismo conjunto y complica
  `resolveSelection` y el ancla de crear subgrupos sin un caso de uso pedido.
- Un ajuste o casilla aparte, fuera de la selección: duplicaría el estado, el traspaso y "Limpiar selección".
- Comparar en exclusión por URL normalizada (como el filtro de grupo): `/@Foo` y `/@foo` serían canales distintos y
  un canal agrupado aparecería como sin grupo.

## Consecuencias

- Se gana: ver lo que falta por clasificar en cualquier página, sin red ni formatos nuevos, reutilizando la selección,
  la navegación, el traspaso y "Limpiar selección".
- Se pierde: combinar "Sin grupo" con grupos o canales.
- A vigilar: un canal agrupado con una forma de URL (`/@handle`) y mostrado por YouTube con otra (`/channel/UC…`) se ve
  como sin grupo; las tarjetas sin enlace al canal cuyo canal no está en grupos no se pueden identificar (la búsqueda
  por nombre solo conoce canales agrupados) y quedan fuera del filtro.
