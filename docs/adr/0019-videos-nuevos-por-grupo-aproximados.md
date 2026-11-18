# 0019 · Vídeos nuevos por grupo, aproximados con lo observado en suscripciones

- Estado: aceptada
- Fecha: 2026-11-18

## Contexto

La persona quiere ver en el botón de cada grupo de la guía cuántos vídeos nuevos tiene (ROADMAP 6-5, plan
[2026-11-18-fase6-5-videos-nuevos-por-grupo](../plans/2026-11-18-fase6-5-videos-nuevos-por-grupo.md)); el bullet de
color del botón (plan gui-9) lo mostrará.

Restricciones: sin peticiones de red (el contador exacto por RSS está descartado en el ROADMAP), sin permisos nuevos,
datos en `browser.storage.local`. Solo se puede contar lo que YouTube ya ha cargado en `/feed/subscriptions`. Las
tarjetas dan: id del vídeo, canal y antigüedad aproximada ("hace 3 horas", `YouTubeGroupsMetadata.parseAge`, en
segundos y redondeada hacia abajo). El `MutationObserver` de `content.js` procesa las tarjetas varias veces y la guía
se repinta con cada cambio de grupos.

## Decisión

Clave nueva `youtubeNewVideos`:

```json
{
  "youtubeNewVideos": {
    "version": 1,
    "since": 1763452800000,
    "videos": {
      "dQw4w9WgXcQ": {
        "channel": "https://www.youtube.com/@canal",
        "seenAt": 1763460000000,
        "publishedBefore": 1763449200000
      }
    },
    "visits": { "g-123": 1763455000000 }
  }
}
```

- `videos`: vídeos observados en `/feed/subscriptions` de canales que están en algún grupo. `channel` es
  `getChannelKey`; `seenAt`, cuándo se anotó por primera vez (no cambia); `publishedBefore`, la cota superior de la
  publicación (`seenAt − edad`, o `null` si no se pudo leer la edad).
- `visits`: por id de grupo o subgrupo, la última vez que se "vio" (ver abajo). `since`: cuándo se creó la clave; un
  grupo sin visita usa `since`.
- **Reconocer (poner a 0)**: al seleccionar un grupo en la guía, su visita pasa a ahora. Mientras un grupo está
  seleccionado y se está en `/feed/subscriptions`, cada volcado vuelve a poner su visita a ahora (lo que se carga
  mientras se mira ese grupo no es nuevo). Seleccionar canales sueltos o ver suscripciones sin filtro no reconoce nada
  (si no, como solo se observa en suscripciones, el contador nunca subiría).
- **Vídeo nuevo**: con `ack(v)` = la visita más reciente entre los grupos cuyo subárbol contiene el canal de `v` (o
  `since`), `v` es nuevo si no está en `youtubeWatched` (ADR 0002), `seenAt > ack(v)` y (`publishedBefore` es `null`
  o `publishedBefore > ack(v)`). La segunda condición evita contar vídeos antiguos que aparecen al desplazarse.
- **Contador de un grupo**: número de vídeos nuevos distintos de los canales de su subárbol (grupo y subgrupos). Ver un
  subgrupo reduce también el contador del padre; ver un grupo, el de sus subgrupos y el de otros grupos que comparten
  el canal.
- Escrituras: el recolector anota en memoria (una vez por vídeo y pestaña) y vuelca como mucho una vez cada 2 s en
  `withLock` de su clave (ADR 0005), con una lectura y solo si algo cambia. El reconocimiento se aplica al momento en
  memoria (el bullet se vacía sin esperar) y se escribe en el siguiente volcado.
- Poda en cada escritura: vídeos con `seenAt` de hace más de 30 días, de canales que ya no están en ningún grupo y, si
  quedan más de 1000, los más antiguos; visitas de grupos que ya no existen.
- Repintado: un cambio de la clave, de los grupos o de los vistos recalcula los contadores y actualiza solo los
  bullets de la guía, sin rehacer la columna y escribiendo en el DOM solo si el número cambia. La anotación sale del
  procesado de tarjetas, no de las mutaciones de la guía, así que actualizar los bullets no provoca nuevas escrituras.
- No entra en la copia de seguridad (ADR 0006): es un estado transitorio y local.

## Alternativas descartadas

- Contador exacto por RSS o página del canal: peticiones de red y el id `UC…` (descartado en el ROADMAP).
- Campo `lastVisit` en cada grupo de `youtubeGroups`: cada selección reescribiría el árbol y repintaría guía, filtro y
  editor en todas las pestañas (mismo motivo que el ADR 0016).
- Guardar por grupo los ids ya vistos: crece con cada grupo y cada vídeo y duplica ids entre grupos que comparten
  canal.
- Solo `seenAt` sin la antigüedad: al desplazarse por suscripciones aparecen vídeos de hace días que contarían como
  nuevos.
- Reconocer al visitar suscripciones sin filtro: el contador se vaciaría justo donde se calcula.

## Consecuencias

- Se gana: una señal útil de novedades por grupo sin red ni permisos, con escrituras acotadas y sin bucles con el
  `MutationObserver`.
- Se pierde: solo cuenta lo que YouTube ha cargado en suscripciones (si no se baja, no se ven vídeos más antiguos); el
  primer día todo lo cargado antes de la primera escritura queda como no nuevo; un grupo creado después cuenta desde
  `since`; la antigüedad es aproximada ("hace 1 día" puede ser 47 h) y la cota usa el límite favorable a contar. Con
  varias pestañas en suscripciones a la vez, un volcado puede pisar otro (límite del ADR 0005); se recupera al volver
  a observar.
- A vigilar: si YouTube cambia el texto de la antigüedad, `publishedBefore` queda `null` y solo cuenta `seenAt`.
