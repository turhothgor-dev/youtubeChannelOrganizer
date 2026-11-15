# 0003 · Formato de los ajustes en browser.storage.local (versión 1)

- Estado: aceptada
- Fecha: 2026-11-14

## Contexto

La Fase 3 del roadmap añade preferencias que la persona elige una vez y espera conservar entre sesiones: cómo se
muestran los vídeos vistos (mostrar, atenuar u ocultar), cómo se muestran los vídeos que no pasan el filtro
(ocultar o atenuar) y a partir de qué porcentaje de reproducción se marca un vídeo como visto automáticamente.
Hasta ahora no hay ajustes guardados: el filtro oculta siempre y los vistos se atenúan siempre.

Restricciones: no hay `background.js`; solo el content script accede a `browser.storage.local`, a través de
`YouTubeGroupsStorage`. Los grupos (`youtubeGroups`, ADR 0001) y los vistos (`youtubeWatched`, ADR 0002) no
cambian. La extensión no se ha publicado.

## Decisión

Los ajustes se guardan en una clave propia, `youtubeSettings`:

```json
{
  "youtubeSettings": {
    "version": 1,
    "settings": {
      "watchedMode": "dim",
      "outsideMode": "hide",
      "autoMarkPercent": 80
    }
  }
}
```

- `watchedMode`: `"show"`, `"dim"` u `"hide"`; por defecto `"dim"` (el comportamiento de la Fase 2).
- `outsideMode`: `"hide"` o `"dim"`; por defecto `"hide"` (el comportamiento del filtro actual). Se aplica a los
  vídeos que no pasan el filtro activo (grupo y, cuando existan, filtros avanzados).
- `autoMarkPercent`: `0` (desactivado), `50`, `80` o `95`; por defecto `80`. Lo introduce el plan
  `2026-11-14-fase3-2-marcado-automatico`; hasta entonces no se guarda ni se lee.
- `panelCollapsed`: `false` o `true`; por defecto `true`. Indica si el panel flotante está minimizado. Lo
  introduce el plan `2026-11-14-fase4-3-sidebar`; el valor por defecto (antes `false`) lo cambia el plan
  `2026-11-15-gui-4-panel`. Es un cambio de valor por defecto de un campo opcional: no sube `version`.
- `sidebarCollapsed`: **retirado** por el plan `2026-11-15-gui-6-1-guia-fija` (ADR 0010). Lo introdujo
  `2026-11-15-gui-5-1-columna-propia` para plegar la columna propia, que ya no existe. No sube `version`: un valor
  guardado o presente en una copia de seguridad se ignora sin error y no se vuelve a guardar.
- Todos los campos son opcionales al leer: si falta uno o su valor no es válido, se usa su valor por defecto. Leer
  sin datos devuelve los valores por defecto y no escribe nada.
- La normalización conserva solo los campos conocidos.
- Cambiar un ajuste hace una lectura y, solo si cambia algo, una escritura de la clave completa.
- Añadir un campo opcional nuevo no sube `version`; un cambio incompatible sí, con su migración al leer.

## Alternativas descartadas

- Guardar los ajustes dentro de `youtubeGroups`: cada cambio de ajuste reescribiría el árbol de grupos y mezclaría
  dos versiones de formato.
- Una clave por ajuste: leer todos exige varias lecturas o `get(null)`, y no hay un único sitio con la versión.
- `browser.storage.sync`: sincronizar entre dispositivos es la Fase 4; mezclarlo ahora obliga a decidir antes
  cuotas y conflictos.
- Guardar también el grupo activo y los filtros avanzados: hoy el filtro es estado de la pestaña y se pierde al
  recargar; persistirlo cambia el comportamiento sin que se haya pedido.

## Consecuencias

- Se gana: un único sitio para las preferencias de la Fase 3 y siguientes, con valores por defecto que mantienen
  el comportamiento actual para quien no toque nada.
- Se pierde: nada relevante; la clave ocupa unos pocos bytes.
- A vigilar: dos pestañas que cambian ajustes a la vez pueden perder un cambio (la última escritura gana) y una
  pestaña no ve los cambios de otra hasta recargar (`storage.onChanged` queda fuera de alcance).
