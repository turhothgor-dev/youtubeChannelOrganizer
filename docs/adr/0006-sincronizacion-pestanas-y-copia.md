# 0006 · Sincronización entre pestañas con storage.onChanged y entre dispositivos con copia de seguridad

- Estado: propuesta
- Fecha: 2026-11-14

## Contexto

La Fase 4 pide "Sincronización cruzada". Hoy cada pestaña de YouTube lee grupos, vistos, ajustes y listas al
arrancar y no ve los cambios de otra pestaña hasta recargar (ADR 0003, "A vigilar"). Tampoco hay forma de llevar los
datos a otro equipo. ADR 0003 y 0004 aplazaron a esta fase `storage.sync` y la sincronización entre dispositivos.

Restricciones: sin red propia, sin API de YouTube ni OAuth, sin dependencias, sin permisos nuevos, sin cambiar los
formatos versión 1 (ADR 0001 a 0004). Datos reales: los vistos crecen sin límite (~40 B por vídeo, ADR 0002) y las
listas ~300 B por vídeo (ADR 0004).

## Decisión

1. **Entre pestañas**: el content script escucha `browser.storage.onChanged` (área `local`) y, para cada clave
   cambiada, sustituye su caché en memoria por `newValue` y repinta lo que dependa de ella. El evento es la fuente de
   verdad: al aplicarlo se descartan los resultados de escrituras propias anteriores todavía en vuelo (contadores de
   secuencia existentes). No requiere permisos (lo cubre `storage`).
2. **Entre dispositivos**: copia de seguridad manual. "Exportar copia" descarga un JSON y "Importar copia" lo valida y
   **reemplaza** las cuatro claves. Formato del fichero, versión 1:

```json
{
  "format": "youtube-groups-backup",
  "version": 1,
  "exportedAt": "2026-11-14T10:00:00.000Z",
  "groups": [],
  "watched": {},
  "settings": {},
  "playlists": []
}
```

- `groups`, `watched`, `settings` y `playlists` son el contenido interno de cada clave (sin su envoltorio
  `{ version, ... }`), con los formatos de los ADR 0001 a 0004.
- Al importar se valida todo antes de escribir nada: estructura incorrecta, `format` distinto o `version` distinta de
  1 rechazan el fichero entero; entradas sueltas no válidas (URL de canal que no queda igual tras
  `normalizeChannelUrl`, ID de vídeo no válido, icono o color desconocidos) se descartan y se cuentan. Ficheros de
  más de 5 MB se rechazan.
- La escritura se hace clave a clave, cada una dentro de su `withLock` (ADR 0005). No es atómica entre claves: si
  falla a mitad, las claves ya escritas quedan con la copia.

## Alternativas descartadas

- `browser.storage.sync`: cuota de 100 KB en total y 8 KB por elemento en Firefox; los grupos con unos cien canales
  ya superan 8 KB (habría que trocearlos) y los vistos y las listas no caben. Exige cuenta de Firefox, sincroniza
  cada varios minutos y la última escritura de un dispositivo pisa el árbol entero del otro. Mucha complejidad para
  sincronizar solo una parte.
- Servidor propio o API de YouTube: red, credenciales y permisos nuevos.
- `background.js` como único escritor para evitar pérdidas entre pestañas: cambia todos los módulos a mensajes por una
  carrera de milisegundos (cada operación ya relee antes de escribir).
- `navigator.locks` entre pestañas: ver ADR 0005; mismo motivo.
- Importar fusionando: reglas de fusión distintas para cada clave (árbol de grupos, ids repetidos); reemplazar con
  confirmación es predecible.

## Consecuencias

- Se gana: todas las pestañas muestran el mismo estado sin recargar; copia de seguridad y traslado a otro equipo sin
  permisos ni red.
- Se pierde: la sincronización entre dispositivos es manual; importar sustituye lo que hubiera.
- A vigilar: entre pestañas sigue ganando la última escritura si dos operaciones sobre la misma clave coinciden en
  milisegundos. Si se pide sincronización automática entre dispositivos, reconsiderar `storage.sync` solo para grupos y
  ajustes, troceados, en un ADR nuevo.
