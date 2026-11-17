"use strict";

// Fragmentos mínimos de HTML de YouTube para los tests de DOM.

/**
 * Guía con `ytd-guide-renderer #sections` y una sección "Más de YouTube"
 * (la que lleva enlaces a hosts de YouTube Music, ver findGuideInsertionIndex).
 */
const GUIDE_HTML = `
  <tp-yt-app-drawer>
    <ytd-guide-renderer><div id="sections">
      <ytd-guide-section-renderer>
        <a href="/feed/subscriptions">Suscripciones</a>
      </ytd-guide-section-renderer>
      <ytd-guide-section-renderer>
        <a href="https://music.youtube.com/">YouTube Music</a>
      </ytd-guide-section-renderer>
    </div></ytd-guide-renderer>
  </tp-yt-app-drawer>`;

/** ID de vídeo de los fragmentos (11 caracteres, como exige extractVideoId). */
const VIDEO_ID = "abc123DEF45";

/** Tarjeta de vídeo de suscripciones con miniatura, enlace de vídeo y de canal. */
const SUBSCRIPTION_CARD_HTML = `
  <ytd-rich-item-renderer>
    <ytd-thumbnail><a id="thumbnail" href="/watch?v=${VIDEO_ID}"><img src="x.jpg"></a></ytd-thumbnail>
    <a id="video-title" href="/watch?v=${VIDEO_ID}">Vídeo de prueba</a>
    <ytd-channel-name><a href="/@canal">Canal</a></ytd-channel-name>
  </ytd-rich-item-renderer>`;

/** Resultado de canal de la búsqueda. */
const CHANNEL_RESULT_HTML = `
  <ytd-channel-renderer>
    <a id="main-link" href="/@canal"><div id="text-container"><ytd-channel-name><span id="text">Canal</span></ytd-channel-name></div></a>
  </ytd-channel-renderer>`;

/** Página /watch con reproductor, vídeo y propietario. */
const WATCH_PAGE_HTML = `
  <ytd-watch-flexy video-id="${VIDEO_ID}">
    <div id="movie_player"><video></video></div>
    <ytd-video-owner-renderer>
      <a href="/@canal">Canal</a>
    </ytd-video-owner-renderer>
  </ytd-watch-flexy>`;

/** URL normalizada del canal de las tarjetas de ejemplo. */
const CHANNEL_URL = "https://www.youtube.com/@canal";

/**
 * Grupo con el formato guardado (ver createGroup de modules/groups.js).
 * @param {string} id - Id (y nombre por defecto) del grupo.
 * @param {Object} [options] - name, channels, subgroups.
 * @returns {Object} Grupo.
 */
function makeGroup(id, { name = id, channels = [], subgroups = [] } = {}) {
  return {
    id,
    name,
    type: "group",
    channels,
    subgroups,
    icon: "",
    color: "",
  };
}

/**
 * Contenido inicial del almacenamiento con unos grupos.
 * @param {Object[]} groups - Grupos.
 * @returns {Object} Valor para la opción `store` de loadDom.
 */
function groupsStore(groups) {
  return { youtubeGroups: { version: 1, groups } };
}

/**
 * `flush` que tolera que no se estabilice. Con una tarjeta con botones,
 * `setCardButtonContent` reescribe el texto de la etiqueta en cada procesado,
 * eso muta el DOM de la tarjeta y la vuelve a programar en el siguiente frame,
 * sin parar (comportamiento actual de content.js, que este plan no cambia).
 * Tras las vueltas del límite el estado ya es el final.
 * @param {{flush: Function}} dom - Resultado de loadDom.
 * @returns {Promise<void>}
 */
async function flushLoose(dom) {
  try {
    await dom.flush();
  } catch (error) {
    if (!String(error.message).startsWith("flush: no se estabiliza")) {
      throw error;
    }
  }
}

module.exports = {
  VIDEO_ID,
  flushLoose,
  CHANNEL_URL,
  makeGroup,
  groupsStore,
  GUIDE_HTML,
  SUBSCRIPTION_CARD_HTML,
  CHANNEL_RESULT_HTML,
  WATCH_PAGE_HTML,
};
