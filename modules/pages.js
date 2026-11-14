const YouTubeGroupsPages = (() => {
  const CHANNEL_PREFIX_RE = /^\/(?:@[^/]+|(?:channel|c|user)\/[^/]+)(?:\/.*)?$/;
  const SHORTS_RE = /^\/shorts\/[^/]+/;
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
    if (pathname === "/watch") {
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

  return { getPageType, shouldShowCardControls, getChannelUrlFromPath };
})();
