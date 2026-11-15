# 0008 · Columna propia fija a la izquierda que desplaza el contenido de YouTube

- Estado: propuesta
- Fecha: 2026-11-15

## Contexto

La sección "YouTube Groups" vive dentro de la guía lateral de YouTube (`ytd-guide-renderer #sections`, plan
`2026-11-15-gui-3-guia-lateral`). Por debajo de unos 1300 px YouTube colapsa su guía a la mini-guía de iconos, y en
`/watch` la guía solo existe como cajón de ☰: la sección solo se ve abriendo un cajón que se superpone al contenido y
bloquea los clics en los vídeos. La persona decide (2026-11-15) sacar la sección a una columna propia, siempre abierta
por defecto, que desplace el contenido en lugar de taparlo, en todas las páginas (también `/watch`, modo cine y
`/shorts`), y que se pueda plegar a una tira estrecha recordando el estado.

Restricciones: no podemos cambiar el código de YouTube; su masthead (`#masthead-container`), su guía persistente
(`tp-yt-app-drawer#guide`) y su mini-guía (`ytd-mini-guide-renderer`) son `position: fixed` a la izquierda, y YouTube
desplaza el contenido con `margin-left` en `ytd-page-manager#page-manager` según los atributos de `ytd-app`
`guide-persistent-and-visible` (guía de 240 px) y `mini-guide-visible` (mini-guía de 72 px).

## Decisión

1. **Elemento**: `<aside id="youtube-groups-sidebar">` hijo de `<body>`, **detrás de `ytd-app`** (hermano posterior),
   `position: fixed`, de `top: var(--ytd-masthead-height, 56px)` a `bottom: 0`, con scroll vertical propio. Solo se
   crea si existe `ytd-app`.
2. **Coexistencia con la guía de YouTube sin solaparse**: la columna se coloca **a la derecha** de la guía o mini-guía
   de YouTube, leyendo sus atributos con el combinador de hermanos (sin `:has()` ni JavaScript):
   `left: 0` por defecto, `ytd-app[mini-guide-visible] ~ #youtube-groups-sidebar { left: 72px }` y
   `ytd-app[guide-persistent-and-visible] ~ #youtube-groups-sidebar { left: 240px }` (esta regla va después y gana).
   El cajón de ☰ de YouTube (no persistente, con velo) queda por encima de la columna, como hoy sobre el contenido.
3. **Desplazar el contenido**: el script pone la clase `youtube-groups--sidebar` en `<html>` y la variable
   `--youtube-groups-sidebar-width` (240 px abierta, 40 px plegada, clase `youtube-groups--sidebar-collapsed`). El CSS
   añade `padding-left: var(--youtube-groups-sidebar-width)` a `ytd-page-manager#page-manager`. Es un `padding`, no un
   `margin`: se **suma** al `margin-left` que YouTube ya pone según su guía, así que no hay que repetir su lógica ni
   usar `!important`. El masthead no se toca (sigue a todo el ancho, por encima de la columna).
4. **Pantalla completa**: un escuchador de `fullscreenchange` pone `youtube-groups--fullscreen` en `<html>` mientras
   `document.fullscreenElement` no sea `null`; con esa clase la columna se oculta y el `padding` es 0. El modo cine no
   es pantalla completa: la columna sigue y el reproductor ocupa el ancho restante.
5. **Plegado**: ajuste `sidebarCollapsed` en `youtubeSettings` (ADR 0003), `false` por defecto. La columna y las
   clases de `<html>` se aplican cuando se han leído los ajustes (o ha fallado la lectura, con los valores por
   defecto), para desplazar el contenido una sola vez al cargar.
6. **Capas**: `z-index` por debajo del masthead y del cajón de ☰ de YouTube y por encima del contenido (valor de
   partida 2000, se comprueba a mano). Los desplegables de la extensión (selector de iconos, etc.) siguen por encima.

## Alternativas descartadas

- Seguir dentro de la guía de YouTube: es justo el problema (mini-guía y cajón que tapa el contenido).
- Columna en `left: 0` moviendo la guía y la mini-guía de YouTube a la derecha: hay que sobrescribir su posición y su
  animación (`transform`) del cajón; más frágil.
- `margin-left` en `ytd-page-manager` sumando el ancho de la guía: obliga a replicar las reglas de YouTube para cada
  estado de la guía y a usar `!important`.
- `margin-left` o `padding` en `ytd-app` o `<body>`: los elementos fijos de YouTube (masthead, guía) no se mueven y
  algunos componentes miden contra `ytd-app`; no aporta nada frente a `ytd-page-manager`.
- Selectores con `:has(ytd-app[...])` en `<html>`: invalidación costosa en un DOM tan grande y cambiante.
- Medir la guía con JavaScript (`getBoundingClientRect`, `ResizeObserver`): más código y reflujos para lo que dos
  selectores de atributo resuelven.
- Insertar la columna dentro de `ytd-page-manager` (con `position: sticky`): YouTube gestiona sus hijos al navegar.

## Consecuencias

- Se gana: la sección se ve siempre (también en `/watch`, `/shorts` y con la ventana estrecha) y no bloquea los
  clics en los vídeos; se puede plegar.
- Se pierde: 240 px de ancho para el contenido mientras está abierta (40 px plegada). La sección deja de estar en la
  guía de YouTube.
- A vigilar: dependemos de los atributos `guide-persistent-and-visible` y `mini-guide-visible` de `ytd-app` y de
  `#page-manager`. Si YouTube los cambia, la columna puede quedar sobre su guía o el contenido sin desplazar (la
  columna sigue funcionando). Elementos fijos propios de una página (barra de chips de inicio, `#frosted-glass`)
  pueden quedar mal alineados: se corrigen con reglas concretas cuando se detecten.
