"use strict";

// Fragmentos mínimos de HTML de YouTube para los tests de DOM.

/** Guía con #sections y una sección "Más de YouTube" (ver findGuideInsertionIndex). */
const GUIDE_HTML = `
  <tp-yt-app-drawer>
    <div id="sections">
      <ytd-guide-section-renderer>
        <a href="/feed/subscriptions">Suscripciones</a>
      </ytd-guide-section-renderer>
      <ytd-guide-section-renderer>
        <a href="/premium">Más de YouTube</a>
      </ytd-guide-section-renderer>
    </div>
  </tp-yt-app-drawer>`;

/** Tarjeta de vídeo de suscripciones con miniatura, enlace de vídeo y de canal. */
const SUBSCRIPTION_CARD_HTML = `
  <ytd-rich-item-renderer>
    <ytd-thumbnail><a id="thumbnail" href="/watch?v=abc123"><img src="x.jpg"></a></ytd-thumbnail>
    <a id="video-title" href="/watch?v=abc123">Vídeo de prueba</a>
    <ytd-channel-name><a href="/@canal">Canal</a></ytd-channel-name>
  </ytd-rich-item-renderer>`;

/** Resultado de canal de la búsqueda. */
const CHANNEL_RESULT_HTML = `
  <ytd-channel-renderer>
    <a id="main-link" href="/@canal"><div id="text-container"><span id="text">Canal</span></div></a>
  </ytd-channel-renderer>`;

/** Página /watch con reproductor, vídeo y propietario. */
const WATCH_PAGE_HTML = `
  <ytd-watch-flexy video-id="abc123">
    <div id="movie_player"><video></video></div>
    <ytd-video-owner-renderer>
      <a href="/@canal">Canal</a>
    </ytd-video-owner-renderer>
  </ytd-watch-flexy>`;

module.exports = {
  GUIDE_HTML,
  SUBSCRIPTION_CARD_HTML,
  CHANNEL_RESULT_HTML,
  WATCH_PAGE_HTML,
};
