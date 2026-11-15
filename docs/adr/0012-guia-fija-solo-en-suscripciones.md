# 0012 · Guía fija solo en /feed/subscriptions

- Estado: propuesta
- Fecha: 2026-11-15
- Modifica: [0010](0010-seccion-en-la-guia-de-youtube-fija.md) (puntos 2 y 4 y Consecuencias)

## Contexto

El ADR 0010 fuerza la guía de YouTube abierta y fija (clase `youtube-groups--guide-pinned` en `<html>`) en todas las
páginas salvo `/watch`, con ventana de 792 px o más y sin pantalla completa. Tras probarlo en Firefox (2026-11-15), la
persona quiere la guía fija **solo** en `/feed/subscriptions`, que es donde se filtra; en el resto de páginas (inicio,
canal, búsqueda, Shorts, `/watch`...) prefiere el comportamiento normal de YouTube (mini-guía, cajón con ☰, guía
persistente a partir de ~1313 px).

## Decisión

`shouldPinGuide(pageType, width, isFullscreen)` es cierto solo si `pageType === "subscriptions"`, `width >=
PINNED_GUIDE_MIN_WIDTH` (792) y no hay pantalla completa. La firma, la clase, las reglas de `content.css`, el bloqueo de
☰ del masthead y los momentos en que se recalcula (`syncGuidePin`) no cambian: solo cambia en qué páginas se pone la
clase. La sección "YouTube Groups" se sigue insertando en la guía en **todas** las páginas (en la guía persistente o en
el cajón de ☰, según decida YouTube).

## Alternativas descartadas

- Lista de páginas configurable o un ajuste para elegir dónde fijar la guía: nadie lo ha pedido y añade un campo a
  `youtubeSettings` (ADR 0003).
- Fijar en suscripciones e inicio: la persona pide solo suscripciones.

## Consecuencias

- Se gana: fuera de suscripciones, YouTube se comporta exactamente como sin la extensión (☰ funciona, mini-guía y cajón).
- Se pierde: en inicio, canal, búsqueda y Shorts por debajo de ~1313 px la sección "YouTube Groups" solo está en el cajón
  de ☰ (como ya pasaba en `/watch`). Elegir un grupo desde allí sigue navegando a suscripciones (ADR 0007), donde la guía
  queda fija.
- A vigilar: lo mismo que en el ADR 0010, ahora solo en `/feed/subscriptions`. Las transiciones de suscripciones a otra
  página quitan la clase (`yt-navigate-start` con la ruta de destino) y devuelven el control a YouTube.
