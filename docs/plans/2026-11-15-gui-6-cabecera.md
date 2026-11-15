# Plan: guía fija con una sola cabecera (gui-6, cabecera del cajón)

**Estado:** hecho

Issue: hallazgo de la persona en Firefox (2026-11-15), sobre ADR 0010 y el plan `gui-6-correcciones`.

## Contexto y decisión

Con la guía fija (`html.youtube-groups--guide-pinned`) se ve **dos veces** la cabecera con ☰, logo y nombre: la del
masthead y la propia del cajón, `tp-yt-app-drawer#guide #contentContainer #guide-wrapper > #header` (contiene
`#guide-button` y `ytd-topbar-logo-renderer#logo`). YouTube solo la oculta en modo persistente; nosotros forzamos la
guía también fuera de ese modo. La regla actual oculta `tp-yt-app-drawer#guide ytd-guide-renderer #guide-header`, que
no es ese elemento.

Decisión:

- Ocultar con `display: none !important`, bajo la clase, `html.youtube-groups--guide-pinned tp-yt-app-drawer#guide
  #guide-wrapper > #header`. Se usa la forma con `#guide-wrapper >` en lugar de `tp-yt-app-drawer#guide #header` a
  secas para no alcanzar ningún otro `#header` que YouTube (o una versión futura de la guía) pueda tener dentro del
  contenido del cajón; el elemento es el mismo.
- **Se quita** la regla de `ytd-guide-renderer #guide-header`: no es la cabecera que se ve, no está comprobado que
  exista y solo añade un selector más a la lista de **A vigilar** del ADR.
- Con la cabecera oculta, el primer elemento de la guía debe quedar justo bajo el masthead: el host ya está en `top:
  var(--ytd-masthead-height, 56px)`, `#contentContainer` en `top: 0` sin `padding` vertical y `#guide-spacer` oculto.
  Si en la verificación queda un hueco, se anula el desplazamiento que lo cause (por ejemplo, `margin-top`/`padding-top`
  de `#guide-content`) con una línea en **Cambios aprobados**.

Descartado: ocultar solo `#guide-button` y `#logo` dentro de la cabecera del cajón (deja la caja vacía ocupando altura,
que es justo el hueco que no queremos).

## Tareas

Reglas comunes: sin dependencias nuevas; todo el CSS nuevo bajo `html.youtube-groups--guide-pinned`; sin tests de DOM
(fuera de alcance, como en `gui-6-1` y `gui-6-correcciones`).

- [x] T1 · Ocultar la cabecera propia del cajón y quitar la regla de `#guide-header` · Ficheros: `content.css` (bloque
  de la guía fija, ~1323-1383): sustituir la regla `tp-yt-app-drawer#guide ytd-guide-renderer #guide-header` por
  `tp-yt-app-drawer#guide #guide-wrapper > #header { display: none !important; }` · Test: `make lint`, `make test` y a
  mano V1–V3.
- [x] T2 · Documentación y cierre · Ficheros: `docs/adr/0010-seccion-en-la-guia-de-youtube-fija.md` (punto 2: "la
  cabecera propia del cajón (☰ y logo)" con su selector `tp-yt-app-drawer#guide #guide-wrapper > #header`, en lugar de
  `ytd-guide-renderer #guide-header`; **A vigilar**: añadir `#guide-wrapper > #header`), `docs/ARCHITECTURE.md`
  (flujo **Guía lateral**, línea ~112: "ocultan la mini-guía, el velo y la cabecera propia del cajón"), este plan
  (estado `hecho`) · Test: `make lint` y `make test`.

### Verificación manual (tu Firefox con sesión; recarga la extensión en `about:debugging`)

- V1 · Ventana de ~1000 px en `/feed/subscriptions` y en `/`: una sola cabecera (☰, logo y nombre) arriba, la del
  masthead; la guía no repite ☰ ni logo.
- V2 · Lo mismo a ~1400 px en `/feed/subscriptions` y en `/`.
- V3 · En los cuatro casos: el primer elemento de la guía ("Inicio") queda justo bajo el masthead, sin hueco; la guía se
  desplaza entera hasta el final. En un `/watch`, ☰ abre el cajón de YouTube con su cabecera (☰ y logo) como siempre.

## Criterios de aceptación

- En páginas con la guía fija, a ~1000 px y a ~1400 px, en suscripciones e inicio, se ve una sola cabecera con ☰, logo y
  nombre.
- La guía empieza justo bajo el masthead, sin hueco ni solape.
- En `/watch` (sin la clase) el cajón de ☰ se ve como en YouTube, con su cabecera.
- `make lint` y `make test` en verde.

## Fuera de alcance

- Cualquier otro ajuste de la guía fija (anchos, elementos fijos, ☰ del masthead, `syncGuidePin`).
- Cambios en `content.js`.
- Tests automáticos de CSS o de DOM.

## Cambios aprobados

Cambios sobre el plan después de aprobarlo. Sin una línea aquí, un cambio no está aprobado.

| Fecha | Tarea | Cambio | Motivo | Aprobado por |
| --- | --- | --- | --- | --- |

## Registro

Una línea por commit, añadida **antes** de commitear. El plan actualizado va en el mismo commit que el cambio.

| Fecha | Tarea | Commit | Nota |
| --- | --- | --- | --- |
| 2026-11-15 | T1 | `fix: ocultar la cabecera propia del cajón en la guía fija` | Regla `#guide-wrapper > #header` sustituye a `#guide-header`; lint y 182 tests en verde; V1–V3 pendientes a mano. |
| 2026-11-15 | T2 | `docs: documentar la cabecera propia del cajón en la guía fija` | ADR 0010 (punto 2 y A vigilar) y ARCHITECTURE actualizados; plan en `hecho`. |
