# 0018 · Suscripciones conocidas en una clave aparte, leídas del DOM de YouTube

- Estado: propuesta
- Fecha: 2026-11-18

## Contexto

La bandeja "Sin clasificar" del editor (ROADMAP 6-4, plan
[2026-11-18-fase6-4-sin-clasificar](../plans/2026-11-18-fase6-4-sin-clasificar.md)) lista las suscripciones que no
están en ningún grupo. Hoy la extensión no sabe a qué canales está suscrita la persona: solo guarda los canales que ha
metido en grupos (ADR 0001).

Restricciones (las de siempre): sin peticiones de red propias, sin API de YouTube ni credenciales, sin permisos nuevos,
datos en `browser.storage.local`, sin automatizar acciones de la cuenta. Las únicas fuentes son las que YouTube ya pinta:

- La sección "Suscripciones" de la guía (`ytd-guide-section-renderer` con entradas `ytd-guide-entry-renderer` que
  enlazan a canales). Es **parcial**: YouTube muestra un subconjunto y el resto tras "Mostrar más".
- La página "Todas las suscripciones" (`/feed/channels`), con un `ytd-channel-renderer` por canal y carga infinita
  (un `ytd-continuation-item-renderer` al final mientras queda lista por cargar). Es la única **completa**.
- El botón "Suscrito" de la página de canal: su estado depende del idioma y de varias versiones del componente.

## Decisión

Las suscripciones conocidas se guardan en una **clave nueva**, `youtubeSubscriptions`:

```json
{
  "youtubeSubscriptions": {
    "version": 1,
    "channels": {
      "https://www.youtube.com/@lofigirl": {
        "name": "Lofi Girl",
        "url": "https://www.youtube.com/@LofiGirl",
        "firstSeen": 1763452800000
      }
    }
  }
}
```

- Clave del mapa: `YouTubeGroups.getChannelKey(url)`; `url`: `normalizeChannelUrl` de lo leído; `name`: texto visible
  (no vacío, recortado, como mucho 200 caracteres); `firstSeen`: milisegundos de la primera vez que se anotó.
- **Altas**: cada canal leído de la sección "Suscripciones" de la guía o de `/feed/channels` que no esté se añade; si
  ya está y su nombre cambia, se actualiza el nombre. `firstSeen` no cambia nunca.
- **Bajas (reconciliación)**: solo en `/feed/channels`, cuando la lista está **completa** (en la página activa hay al
  menos un `ytd-channel-renderer` y ningún `ytd-continuation-item-renderer`) y lleva 3 s sin canales nuevos, se borran
  las entradas que no se han visto en esa visita. La guía nunca borra (es parcial). No se lee el botón de la página de
  canal.
- Escrituras: un recolector en el content script anota en memoria y vuelca como mucho una vez cada 2 s, en `withLock`
  de su clave (ADR 0005), con una lectura y solo si algo cambia (patrón del ADR 0016).
- La bandeja son las suscripciones conocidas cuya clave no está en ningún grupo ni subgrupo, de la más reciente
  (`firstSeen`) a la más antigua.
- **Avatares** (modifica el ADR 0016): se conservan los de canales agrupados **o** suscritos conocidos, para que la
  bandeja los muestre.
- **Copia de seguridad** (ADR 0006): la clave **no** entra en la copia. Es una caché de datos de YouTube que se
  regenera con una visita a `/feed/channels`, y una copia importada en otro perfil o con otra cuenta traería
  suscripciones ajenas.
- El formato de los grupos (ADR 0001) no cambia.

## Alternativas descartadas

- Guardar las suscripciones dentro de `youtubeGroups` (grupo especial o campo): mezcla datos de YouTube con los de la
  persona, cada lectura oportunista reescribiría el árbol y repintaría guía, filtro y editor en todas las pestañas.
- API de YouTube o RSS: peticiones de red y credenciales o el id `UC…`.
- Leer el botón "Suscrito" de la página de canal: depende del idioma y del componente; un falso negativo borraría una
  suscripción. Se puede reconsiderar si se encuentra un atributo estable.
- Caducar entradas que no se ven en N días: la guía es parcial y `/feed/channels` se visita poco; daría bajas falsas.

## Consecuencias

- Se gana: la bandeja sin red ni permisos; escrituras raras (solo altas, cambios de nombre y reconciliaciones) que no
  tocan el árbol de grupos.
- Se pierde: hasta visitar `/feed/channels` (y bajar hasta el final) la lista solo tiene lo que muestra la guía; una baja
  hecha fuera de `/feed/channels` sigue en la bandeja hasta la siguiente visita completa. Si en el mismo perfil se
  cambia de cuenta de YouTube, las listas se mezclan hasta la siguiente reconciliación.
- A vigilar: si YouTube cambia los selectores de la guía o de `/feed/channels`, deja de leerse (no se borra nada: la
  reconciliación exige ver la lista completa). El riesgo de bajas falsas está en detectar mal la lista completa: los
  selectores van en constantes de `ui/subscriptions.js` y la verificación manual del plan lo comprueba.
