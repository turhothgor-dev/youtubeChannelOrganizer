# 0005 · Serializar las escrituras leer-modificar-escribir por clave de almacenamiento

- Estado: aceptada
- Fecha: 2026-11-14

## Contexto

Cada operación que cambia datos (grupos, ADR 0001; vistos, ADR 0002; ajustes, ADR 0003; listas, ADR 0004) lee la
clave completa de `browser.storage.local`, aplica el cambio en memoria y escribe la clave completa. Entre la lectura
y la escritura hay `await`, así que dos operaciones solapadas en la misma pestaña leen el mismo estado y la segunda
escritura pisa la primera. Ejemplos reales: el marcado automático de un vídeo mientras se pulsa "Marcar visto" en
otra tarjeta, dos selectores de "Ajustes" cambiados seguidos o dos "Guardar" en el desplegable de listas.

Restricciones: scripts clásicos sin dependencias, sin permisos nuevos y sin cambiar el formato guardado.
`browser.storage.local` no ofrece transacciones ni comparar-y-escribir.

## Decisión

`YouTubeGroupsStorage` expone `withLock(key, fn)`: una cola de promesas FIFO por clave de almacenamiento. `fn`
empieza cuando han terminado (bien o con error) todas las operaciones anteriores encoladas con la misma clave; el
resultado o el error de `fn` se devuelve tal cual y un error no bloquea la cola. Las claves se exponen en
`YouTubeGroupsStorage.KEYS` (`groups`, `watched`, `settings`, `playlists`, con el nombre real de la clave como
valor). Toda operación de `modules/` que lee y luego escribe una clave hace la lectura, el cálculo y la escritura
dentro de `withLock` de esa clave. Las lecturas que no escriben no se encolan.

`withLock` no es reentrante: dentro de `fn` no se llama a otra función que use `withLock` con la misma clave (se
bloquearía para siempre).

## Alternativas descartadas

- Un único cerrojo global: serializa sin necesidad operaciones de claves distintas (marcar un vídeo esperaría a
  guardar un grupo).
- Caché en memoria como fuente de verdad que se escribe entera: cambia el modelo de datos de los módulos y no
  resuelve más casos que la cola.
- Reintentar comparando versiones (comparar-y-escribir manual): `storage.local` no es atómico, así que no evita la
  carrera y añade complejidad.
- Web Locks API (`navigator.locks`): coordinaría también entre pestañas del mismo origen, pero en un content script
  el origen es `www.youtube.com` (compartido con la página) y su disponibilidad y semántica en content scripts de
  Firefox no están garantizadas; se puede reconsiderar en la Fase 4.

## Consecuencias

- Se gana: dentro de una pestaña no se pierden cambios por operaciones solapadas, sin dependencias ni cambios de
  formato.
- Se pierde: las escrituras de una misma clave esperan a las anteriores (milisegundos en la práctica).
- A vigilar: entre pestañas distintas sigue ganando la última escritura (ya anotado en los ADR 0002 a 0004); una
  función encolada nunca debe llamar a otra encolada con la misma clave. `getGroups` sigue inicializando `[]` fuera
  de la cola, pero esa escritura siempre termina antes de que una operación encolada lea la clave.
