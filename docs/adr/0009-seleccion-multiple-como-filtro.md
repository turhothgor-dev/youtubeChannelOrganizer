# 0009 · Selección múltiple como filtro activo

- Estado: sustituida por [0011](0011-seleccion-de-hermanos.md)
- Fecha: 2026-11-15
- Sustituye en parte a: [0007](0007-filtro-activo-y-paso-a-suscripciones.md) (puntos 1, 2, 4 y 5)

## Contexto

El ADR 0007 define un filtro único (todos, grupo o canal) con selección que alterna: pulsar otro elemento sustituye
al anterior. Tras probarlo (2026-11-15), la persona decide que la selección sea **siempre múltiple**: cada clic en un
grupo, subgrupo o canal lo añade o lo quita, y el filtro muestra la unión. La navegación a `/feed/subscriptions` y el
traspaso por `sessionStorage` del ADR 0007 siguen, adaptados.

## Decisión

1. **Modelo** (`modules/filter.js`): la selección es un array de claves (`group:<id>`, `channel:<url normalizada>`,
   las de `getFilterKey`), sin repetidos, en **orden de adición** (la última añadida va al final; quitar y volver a
   añadir la lleva al final). Array vacío = "todos". En memoria de la pestaña, como antes.
2. **Alternar por elemento**: un clic añade la clave si no está y la quita si está. No hay selección única.
   "Limpiar selección" vacía el array.
3. **Filtro**: las URL que pasan son la **unión** de las de cada clave (grupo: sus canales y los de sus
   descendientes; canal: su URL). La regla de tarjetas sin canal identificado no cambia.
4. **Elementos que desaparecen**: al resolver la selección contra los grupos se descartan las claves inexistentes
   (grupo borrado, canal que ya no está en ningún grupo). Si no queda ninguna, se vuelve a "todos".
5. **Navegación**: solo navega a `/feed/subscriptions` un clic que **añade** un elemento fuera de esa página. Quitar
   elementos y "Limpiar selección" nunca navegan.
6. **Traspaso tras carga completa**: misma clave `youtubeGroupsPendingFilter` y caducidad de 30 s, con formato
   `version: 2`:

   ```json
   { "version": 2, "selection": ["group:<uuid>", "channel:https://www.youtube.com/@x"], "createdAt": 1763200000000 }
   ```

   Un valor `version: 1` (de antes de este cambio) se ignora.
7. **Estado de la guía**: la lista de canales de un grupo se despliega por defecto si contiene algún canal
   seleccionado.

No cambia ningún formato de `browser.storage.local` ni la copia de seguridad.

## Alternativas descartadas

- Conservar la selección única con una tecla modificadora (Ctrl+clic) para la múltiple: la persona quiere un solo
  gesto.
- Guardar objetos filtro (`{ type, id }`, `{ type, url, name }`) en lugar de claves: las claves ya identifican el
  elemento y se comparan sin normalizar cada vez; el nombre del canal no se usa para filtrar.
- Un `Set` en lugar de un array: se pierde el orden, que hace falta para el "último grupo pulsado" al crear
  subgrupos (plan `2026-11-15-gui-5-3-crear-subgrupos`).
- Intersección en lugar de unión: no es lo pedido.
- Leer también la `version: 1` del traspaso: solo vive 30 s; no compensa el código.

## Consecuencias

- Se gana: filtrar por varios grupos y canales a la vez; un botón para volver a "todos" de una vez.
- Se pierde: el reemplazo con un clic (ahora hay que quitar el anterior o limpiar).
- A vigilar: una selección con un grupo y uno de sus subgrupos no cambia el resultado (la unión ya los incluye); es
  correcto pero puede sorprender.
