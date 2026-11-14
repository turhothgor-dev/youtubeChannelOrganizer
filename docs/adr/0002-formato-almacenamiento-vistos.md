# 0002 · Formato de los vídeos vistos en browser.storage.local (versión 1)

- Estado: propuesta
- Fecha: 2026-11-14

## Contexto

La Fase 2 del roadmap pide "Marca como visto": la persona marca y desmarca vídeos como vistos desde la extensión y
la marca se conserva entre sesiones. La Fase 3 tiene "Ocultar videos vistos" y "Marcar videos vistos" (marcado
automático), que leerán y escribirán el mismo dato, así que el formato debe fijarse ahora y servir a ambas.

Restricciones: no hay `background.js`; solo el content script accede a `browser.storage.local`, a través de
`YouTubeGroupsStorage`. Los grupos ya usan la clave `youtubeGroups` (ADR 0001), que no cambia. La extensión no se
ha publicado y no hay datos de vistos que migrar.

## Decisión

Los vídeos vistos se guardan en una clave propia, `youtubeWatched`, independiente de los grupos:

```json
{
  "youtubeWatched": {
    "version": 1,
    "videos": {
      "<videoId>": { "watchedAt": 1794672642000 }
    }
  }
}
```

- La identidad de un vídeo es su ID de YouTube: 11 caracteres de `[A-Za-z0-9_-]`, sacado de `/watch?v=<id>` o
  `/shorts/<id>` del mismo origen (`YouTubeGroupsWatched.extractVideoId`). Otros parámetros (`t`, `list`...) no
  cuentan.
- `videos` es un objeto (mapa ID → entrada) para consultar en tiempo constante; un vídeo está visto si y solo si su
  ID es clave de `videos`. Desmarcar borra la clave; no hay entradas "no visto".
- `watchedAt` son milisegundos desde epoch del primer marcado. Volver a marcar un vídeo ya visto no lo cambia.
- La entrada es un objeto para poder añadir campos opcionales sin subir `version` (por ejemplo, `source:
  "manual" | "auto"` cuando la Fase 3 marque automáticamente). Al leer, los campos desconocidos se conservan y los
  que falten se tratan como ausentes.
- Leer sin datos o con datos que no son un objeto `videos` devuelve un mapa vacío y no escribe nada.
- Marcar o desmarcar hace una lectura y, solo si hay cambio, una escritura de la clave completa.
- Cualquier cambio incompatible sube `version` y añade una migración al leer.

## Alternativas descartadas

- Guardar los vistos dentro de `youtubeGroups`: cada marca reescribiría el árbol de grupos y mezclaría dos
  versiones de formato independientes.
- Una clave de almacenamiento por vídeo (`watched:<id>`): leer todos los vistos exige `get(null)` y recorrer todo
  el almacenamiento.
- Un array de IDs: búsqueda lineal por tarjeta y riesgo de duplicados.
- Valor `true` o un número en lugar de un objeto: más compacto, pero añadir el origen de la marca en la Fase 3
  obligaría a una migración.
- Identificar por la URL completa del vídeo: el mismo vídeo aparece con parámetros distintos (`t`, `list`, `pp`).

## Consecuencias

- Se gana: marcar un vídeo no toca los grupos; la Fase 3 puede ocultar vistos con `isVideoWatched` sin cambiar el
  formato y marcar automáticamente con la misma escritura.
- Se pierde: el mapa crece sin límite (unos 40 bytes por vídeo; 10 000 vídeos rondan los 400 KB, dentro de lo que
  admite `storage.local`). No hay limpieza por antigüedad.
- A vigilar: si el tamaño molesta, añadir una limpieza por `watchedAt` (no requiere cambiar `version`).
  Escrituras simultáneas desde dos pestañas pueden perder una marca (la última escritura gana), igual que con los
  grupos.
