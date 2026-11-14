# 0004 · Listas de vídeos locales en browser.storage.local (versión 1)

- Estado: propuesta
- Fecha: 2026-11-14

## Contexto

La Fase 3 del roadmap pide un "Gestor de playlists". Gestionar las playlists de la cuenta de YouTube exige la
YouTube Data API con OAuth (credenciales, cuota, permisos de red y de identidad), algo que la extensión no tiene:
hoy solo usa el content script y `browser.storage.local`, sin peticiones de red. Imitar clics en el menú "Guardar"
de YouTube depende de selectores muy frágiles.

Restricciones: sin API ni OAuth, sin permisos nuevos en `manifest.json`, sin peticiones de red. Los grupos
(ADR 0001), los vistos (ADR 0002) y los ajustes (ADR 0003) no cambian.

## Decisión

Las "listas" son listas de vídeos propias de la extensión, guardadas en local en la clave `youtubePlaylists`:

```json
{
  "youtubePlaylists": {
    "version": 1,
    "playlists": [
      {
        "id": "<uuid>",
        "name": "<texto>",
        "videos": [
          {
            "id": "<videoId>",
            "title": "<texto>",
            "channelName": "<texto>",
            "addedAt": 1794672642000
          }
        ]
      }
    ]
  }
}
```

- `playlists` es un array en orden de creación; `videos`, un array en orden de adición (se añade al final).
- La identidad de un vídeo es su ID de 11 caracteres (como en el ADR 0002). Un vídeo no se repite dentro de una
  lista, pero puede estar en varias.
- `name` de la lista: texto recortado de 1 a 80 caracteres; se permiten nombres repetidos, como en los grupos.
- `title` y `channelName` son informativos (lo que se veía al guardar), recortados a 200 y 100 caracteres, pueden
  ser `""` y se tratan siempre como texto, nunca como HTML. No se actualizan si cambian en YouTube.
- Al leer, sin datos o con `playlists` que no es un array, se devuelve `[]` sin escribir.
- Cada operación (crear, renombrar, borrar lista; cambiar las listas de un vídeo; quitar un vídeo) hace una
  lectura y, solo si cambia algo, una escritura de la clave completa.
- "Reproducir" abre `https://www.youtube.com/watch_videos?video_ids=<id1>,<id2>,...` con los 50 primeros vídeos:
  una URL pública de YouTube que crea una lista de reproducción anónima sin cuenta. No está documentada; si deja de
  funcionar, se sustituye por abrir el primer vídeo sin cambiar el formato.
- Un cambio incompatible sube `version` y añade una migración al leer.

## Alternativas descartadas

- YouTube Data API con OAuth: credenciales, permisos de identidad y de red, cuota y revisión en Firefox Add-ons;
  desproporcionado para un MVP.
- Automatizar el diálogo "Guardar en playlist" de YouTube: depende de selectores internos que cambian a menudo y
  necesita sesión iniciada.
- Guardar solo los IDs: la lista no se podría mostrar sin pedir a la red el título de cada vídeo.
- Mapa ID → lista en lugar de array: se pierde el orden, que es lo que define una lista.
- Guardar las listas dentro de `youtubeGroups`: mezclaría dos formatos y reescribiría el árbol de grupos.

## Consecuencias

- Se gana: listas útiles sin credenciales ni red, con el mismo patrón de almacenamiento que el resto.
- Se pierde: las listas no aparecen en la cuenta de YouTube ni en otros dispositivos (sincronización: Fase 4).
- A vigilar: la URL `watch_videos` es no documentada; el tamaño crece con unos 300 bytes por vídeo guardado;
  escrituras simultáneas desde dos pestañas pueden perder un cambio (la última escritura gana).
