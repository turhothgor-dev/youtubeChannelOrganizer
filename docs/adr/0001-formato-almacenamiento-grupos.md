# 0001 · Formato de los grupos en browser.storage.local (versión 1)

- Estado: aceptada
- Fecha: 2026-11-14

## Contexto

Los grupos se guardan en `browser.storage.local` con un formato que solo estaba documentado en el código
(`modules/storage.js` y `modules/groups.js`). Tras el merge de `origin/master` (d3ef534) el formato incluye
subgrupos anidados, multi-asignación de canales, icono y color. El botón "Añadir a grupo" de cada vídeo lee y
escribe ese formato, así que hay que fijarlo antes de que haya datos de usuarios que migrar.

Restricciones: no hay `background.js`; solo el content script accede al almacenamiento, a través de
`YouTubeGroupsStorage` (`getGroups`, `saveGroups`). La extensión no se ha publicado.

## Decisión

Se acepta el formato actual como versión 1, sin cambios:

```json
{
  "youtubeGroups": {
    "version": 1,
    "groups": [
      {
        "id": "<uuid>",
        "name": "<texto>",
        "type": "group",
        "icon": "<id de icons.js o vacío>",
        "color": "<#rrggbb o vacío>",
        "channels": [{ "name": "<texto>", "url": "<url normalizada>" }],
        "subgroups": [
          {
            "id": "<uuid>",
            "name": "<texto>",
            "type": "subgroup",
            "parentId": "<id del padre>",
            "icon": "",
            "color": "",
            "channels": [],
            "subgroups": []
          }
        ]
      }
    ]
  }
}
```

- `groups` contiene solo grupos de primer nivel; los subgrupos van anidados en `subgroups` del padre, con
  `type: "subgroup"` y `parentId`. Las búsquedas por id recorren todos los niveles (`findGroupById`).
- La identidad de un canal es su URL normalizada (`YouTubeGroups.normalizeChannelUrl`): origen de YouTube más
  `/@handle`, `/channel/<id>`, `/c/<nombre>` o `/user/<nombre>`, sin query ni fragmento.
- Un canal no se repite dentro de los `channels` de un mismo grupo o subgrupo, pero puede estar en varios
  (multi-asignación), incluidos un grupo y sus subgrupos.
- Filtrar por un grupo incluye los canales de sus subgrupos y descendientes.
- `name` del canal es informativo (el nombre visto al añadirlo) y se trata siempre como texto, nunca como HTML;
  no se actualiza si el canal cambia de nombre.
- `type`, `icon`, `color` y `subgroups` son opcionales al leer: los grupos guardados antes de que existieran se
  tratan como grupo de primer nivel, sin icono, sin color y sin subgrupos.
- Cualquier cambio incompatible sube `version` y añade una migración al leer en `getGroups`.

## Alternativas descartadas

- Identificar canales por el ID `UC...`: es estable, pero las tarjetas de vídeo suelen enlazar por `/@handle` y
  obtener el ID exige leer datos internos de YouTube o pedirlo a la red. Se pospone a una versión 2 si hace falta.
- Una clave de almacenamiento por grupo: complica las escrituras y no aporta nada con pocos grupos.
- Subgrupos en una lista plana con `parentId`: haría más simple la búsqueda, pero el código ya guarda el árbol y
  cambiarlo exigiría una migración sin beneficio claro ahora.

## Consecuencias

- Se gana: el formato queda documentado y el botón por vídeo se puede cerrar sin migraciones.
- Se pierde: el mismo canal visto con dos URL distintas (`/@Handle` y `/channel/UC...`, o un handle con otra
  combinación de mayúsculas) cuenta como dos canales, y el filtro de un grupo no reconoce el vídeo si la tarjeta
  usa la otra URL.
- Cambiar la pertenencia de un canal a varios grupos debe hacerse con una sola lectura y una sola escritura del
  árbol completo (`setChannelGroups`, plan `2026-11-14-boton-canal-video`).
- A vigilar: si el caso de las dos URL aparece en la práctica, decidir una versión 2 con un identificador canónico
  y su migración.
