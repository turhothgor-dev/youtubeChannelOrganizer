# 0001 · Formato de los grupos en browser.storage.local (versión 1)

- Estado: propuesta
- Fecha: 2026-11-14

## Contexto

El WIP de d6b6a8d ya guarda grupos en `browser.storage.local` con un formato que solo está documentado en un
comentario de `content.js`. El botón "Añadir a grupo" de cada vídeo lee y escribe ese formato, así que cerrarlo
fija de hecho una decisión de la fase 2 (modelo de datos de grupos). Hay que decidir si se fija tal cual o se
cambia antes de que haya datos de usuarios que migrar.

Restricciones: no hay `background.js`; solo el content script accede al almacenamiento. La extensión no se ha
publicado, así que aún no hay datos reales que migrar.

## Decisión

Se mantiene el formato actual como versión 1, sin cambios:

```json
{
  "youtubeGroups": {
    "version": 1,
    "groups": [{ "id": "<uuid>", "name": "<texto>", "channels": [{ "name": "<texto>", "url": "<url>" }] }]
  }
}
```

- La identidad de un canal es su URL normalizada: origen de YouTube más `/@handle`, `/channel/<id>`, `/c/<nombre>`
  o `/user/<nombre>`, sin query ni fragmento. Un canal no se repite dentro de un grupo (misma URL).
- `name` es informativo (el nombre visto al añadirlo); no se actualiza si el canal cambia de nombre.
- Cualquier cambio incompatible sube `version` y añade una migración al leer.

## Alternativas descartadas

- Identificar canales por el ID `UC...`: es estable, pero las tarjetas de vídeo suelen enlazar por `/@handle` y
  obtener el ID exige leer datos internos de YouTube o pedirlo a la red. Se pospone a una versión 2 si hace falta.
- Una clave de almacenamiento por grupo: complica las escrituras y no aporta nada con pocos grupos.

## Consecuencias

- Se gana: el botón por vídeo puede cerrarse sin esperar a la fase 2, y el formato queda documentado.
- Se pierde: el mismo canal visto con dos URL distintas (`/@Handle` y `/channel/UC...`, o un handle con otra
  combinación de mayúsculas) cuenta como dos canales; el filtro de un grupo no reconocerá el vídeo si la tarjeta
  usa la otra URL.
- A vigilar (pregunta abierta para la fase 2): si este caso aparece en la práctica, decidir una versión 2 con un
  identificador canónico y su migración.
