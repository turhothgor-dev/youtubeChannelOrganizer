const YouTubeGroupsPages = (() => {
  const CHANNEL_PREFIX_RE = /^\/(?:@[^/]+|(?:channel|c|user)\/[^/]+)(?:\/.*)?$/;
  const SHORTS_RE = /^\/shorts\/[^/]+/;
  const LIVE_RE = /^\/live\/[^/]+/;
  /** Ancho mínimo de ventana (px) con el que la guía se fuerza fija. */
  const PINNED_GUIDE_MIN_WIDTH = 792;
  const CARD_CONTROL_PAGES = new Set([
    "home",
    "subscriptions",
    "search",
    "watch",
  ]);

  /**
   * Clasifica una página de YouTube según su ruta.
   *
   * @param {string} pathname Ruta de la URL (location.pathname).
   * @returns {"home"|"subscriptions"|"search"|"watch"|"shorts"|"channel"|"other"}
   */
  function getPageType(pathname) {
    if (typeof pathname !== "string") {
      return "other";
    }
    if (pathname === "/") {
      return "home";
    }
    if (pathname === "/feed/subscriptions") {
      return "subscriptions";
    }
    if (pathname === "/results") {
      return "search";
    }
    if (pathname === "/watch" || LIVE_RE.test(pathname)) {
      return "watch";
    }
    if (SHORTS_RE.test(pathname)) {
      return "shorts";
    }
    if (CHANNEL_PREFIX_RE.test(pathname)) {
      return "channel";
    }
    return "other";
  }

  /**
   * Indica si en ese tipo de página se muestran los botones en las tarjetas.
   *
   * @param {string} pageType Valor devuelto por getPageType.
   * @returns {boolean}
   */
  function shouldShowCardControls(pageType) {
    return CARD_CONTROL_PAGES.has(pageType);
  }

  /**
   * URL del canal al que pertenece una página de canal (primer tramo de la
   * ruta, sin subrutas ni barra final y sin decodificar).
   *
   * @param {string} pathname Ruta de la URL (location.pathname).
   * @param {string} origin Origen de la URL (location.origin).
   * @returns {string|null} null si la ruta no es de canal.
   */
  function getChannelUrlFromPath(pathname, origin) {
    if (typeof pathname !== "string" || typeof origin !== "string") {
      return null;
    }
    const match = pathname.match(/^\/(@[^/]+|(?:channel|c|user)\/[^/]+)/);
    return match ? `${origin}/${match[1]}` : null;
  }

  /**
   * Indica si la guía de YouTube se fuerza abierta y fija en esa página: solo
   * en suscripciones, con ancho suficiente y sin pantalla completa (ADR 0012).
   *
   * @param {string} pageType Valor devuelto por getPageType.
   * @param {number} width Ancho de la ventana (innerWidth).
   * @param {boolean} isFullscreen Si hay un elemento a pantalla completa.
   * @returns {boolean}
   */
  function shouldPinGuide(pageType, width, isFullscreen) {
    return (
      pageType === "subscriptions" &&
      width >= PINNED_GUIDE_MIN_WIDTH &&
      !isFullscreen
    );
  }

  /**
   * Indica si se muestran los botones sobre el reproductor de /watch: solo con
   * el vídeo pausado o terminado, sin pantalla completa y sin anuncio.
   *
   * @param {{pageType?: string, paused?: boolean, fullscreen?: boolean, adShowing?: boolean}} [state]
   * @returns {boolean}
   */
  function shouldShowPlayerControls(state) {
    const { pageType, paused, fullscreen, adShowing } = state || {};
    return (
      pageType === "watch" &&
      paused === true &&
      fullscreen !== true &&
      adShowing !== true
    );
  }

  /**
   * Ruta de una URL de navegación (absoluta o relativa) resuelta contra el
   * origen.
   *
   * @param {*} url URL de destino (por ejemplo, detail.url de yt-navigate-start).
   * @param {string} origin Origen de la URL (location.origin).
   * @returns {string|null} null si `url` no es un string o no es válida.
   */
  function getNavigationPathname(url, origin) {
    if (typeof url !== "string") {
      return null;
    }
    try {
      return new URL(url, origin).pathname;
    } catch {
      return null;
    }
  }

  return {
    PINNED_GUIDE_MIN_WIDTH,
    getPageType,
    getNavigationPathname,
    shouldShowCardControls,
    getChannelUrlFromPath,
    shouldPinGuide,
    shouldShowPlayerControls,
  };
})();
