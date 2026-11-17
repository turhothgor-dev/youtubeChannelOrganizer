# 0016 · Avatares de canal en una clave aparte, capturados del DOM de YouTube

- Estado: aceptada
- Fecha: 2026-11-17

## Contexto

La persona pide que los canales de grupos y subgrupos muestren la imagen del canal (plan 6-15) en la guía "YouTube
Groups" y en el panel "Canales" del editor. Hoy cada canal guardado es `{ name, url }` (ADR 0001) y no hay ninguna
imagen.

Restricciones: sin peticiones de red propias (`fetch`), sin API de YouTube ni servidores, sin permisos nuevos, datos en
`browser.storage.local`, sin `innerHTML` con datos. La única fuente posible es el DOM que YouTube ya ha cargado: las
imágenes de canal (`yt3.ggpht.com`, `yt3.googleusercontent.com`) de las tarjetas de vídeo, los resultados de canal
(`ytd-channel-renderer`, también en `/feed/channels`), el propietario del vídeo en `/watch`, la cabecera de la página
de canal y las suscripciones de la guía.

Un mismo canal puede estar en varios grupos (multi-asignación, ADR 0001), y cada escritura de `youtubeGroups` dispara
en todas las pestañas el repintado completo de guía, filtro y editor (ADR 0006).

## Decisión

Los avatares se guardan en una **clave nueva**, `youtubeAvatars`, independiente de los grupos, como un mapa
clave de canal → URL de imagen:

```json
{
  "youtubeAvatars": {
    "version": 1,
    "avatars": {
      "https://www.youtube.com/@lofigirl": "https://yt3.ggpht.com/abc=s88-c-k-c0x00ffffff-no-rj"
    }
  }
}
```

- La clave es `YouTubeGroups.getChannelKey(url)` (un solo avatar para `/@Foo` y `/@foo`).
- El valor es una URL validada y normalizada por `YouTubeGroupsAvatars.normalizeAvatarUrl`: solo `https:` (o `//`
  relativo al protocolo), host en la lista blanca `yt3.ggpht.com` y `yt3.googleusercontent.com`, sin usuario, puerto,
  query ni fragmento, y el sufijo de tamaño `=s…` sustituido por `=s88-c-k-c0x00ffffff-no-rj`.
- Solo se guardan avatares de canales que están en algún grupo. Cada escritura relee los grupos y descarta las
  entradas de canales que ya no están en ninguno, así que el mapa no crece más que los canales agrupados.
- Captura en el content script: un recolector en memoria anota lo que ve (de cualquier canal, con un límite de
  entradas) y, cuando el canal está agrupado y su avatar falta o es distinto, lo encola; las anotaciones se escriben
  juntas, como mucho una escritura cada 2 s, en `withLock` de su clave (ADR 0005), con una lectura y solo si algo
  cambia. Cada pestaña actualiza un avatar ya guardado como mucho una vez por canal y sesión, para que dos superficies
  con URL distintas no alternen escrituras.
- El formato de los grupos (ADR 0001) **no cambia** ni sube `version`.
- Copia de seguridad (ADR 0006): el fichero gana un campo opcional `avatars` con el mismo mapa; la `version` del
  fichero sigue en 1. Al importar, si falta, no se toca la clave; si está, se valida (entradas no válidas se descartan
  y se cuentan en `dropped`) y se reemplaza. Las versiones anteriores de la extensión ignoran el campo.
- Mostrar: `<img>` con `alt=""`, `loading="lazy"`, `decoding="async"` y `referrerpolicy="no-referrer"` sobre un círculo
  con la inicial del canal y un color derivado del nombre, que queda visible si no hay avatar o la imagen falla.

## Alternativas descartadas

- Campo opcional `avatar` en cada canal de `youtubeGroups`: duplica la URL en cada grupo donde está el canal, obliga a
  que quitar, restaurar, copiar, mover, limpiar y fusionar conserven el campo y, sobre todo, cada captura oportunista
  reescribiría el árbol entero y repintaría guía, filtro y editor en todas las pestañas.
- Pedir la imagen a YouTube (página del canal, oEmbed, RSS) o a la API: peticiones de red propias y, en algunos casos,
  credenciales.
- Guardar la imagen (data URL) en lugar de su URL: varios KB por canal en `storage.local` y en la copia de seguridad;
  las URL de `yt3` son estables y el navegador las cachea.
- Leer el avatar en el momento de pintar sin guardarlo: la guía y el editor no tienen a mano el DOM donde aparece.

## Consecuencias

- Se gana: avatares sin red propia ni permisos; escrituras pequeñas y raras que no tocan el árbol de grupos; la lógica
  del editor (6-1, 6-2) y la limpieza no cambian.
- Se pierde: un canal recién añadido no tiene avatar hasta que su imagen aparece en una página de YouTube ya cargada
  (normalmente la misma desde la que se añadió); los canales añadidos antes de esta versión lo ganan al verse.
- La página de opciones (`moz-extension://`) carga imágenes de `yt3.ggpht.com`: es una petición del navegador a Google
  sin `Referer`, como las que hace YouTube. La CSP por defecto de MV3 en Firefox no restringe `img-src`.
- A vigilar: si YouTube cambia los selectores de avatar, deja de capturarse (se ve la inicial). Los selectores están en
  una sola constante de `ui/avatars.js`. Si la URL de un avatar caduca, la imagen falla y se ve la inicial hasta que
  se vuelva a ver el canal en otra sesión.
