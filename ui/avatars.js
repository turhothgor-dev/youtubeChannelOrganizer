/**
 * Recolector de avatares de canal (ADR 0016): anota las imágenes de canal que
 * YouTube ya ha cargado en la página y guarda, agrupadas en una sola escritura
 * cada pocos segundos, las de los canales que están en algún grupo. No hace
 * peticiones de red. Se crea con `create(ctx)`; no toca el DOM al crearse.
 */
const YouTubeGroupsAvatarsUi = (() => {
  /** Imágenes de avatar de las tarjetas, resultados, propietario y guía. */
  const AVATAR_IMG_SELECTOR = [
    "yt-avatar-shape img",
    "yt-decorated-avatar-view-model img",
    "#avatar img",
    "#channel-thumbnail img",
    "#author-thumbnail img",
    "yt-img-shadow img",
  ].join(", ");

  /** En la cabecera de canal solo estas, para no tomar el banner. */
  const HEADER_AVATAR_IMG_SELECTOR = "yt-avatar-shape img, #avatar img";
  const HEADER_SELECTOR =
    "yt-page-header-renderer, ytd-c4-tabbed-header-renderer";

  const GUIDE_SELECTOR = "ytd-guide-renderer";
  const MAX_SEEN = 500;
  const FLUSH_DELAY_MS = 2000;

  /**
   * Crea el recolector.
   * @param {Object} ctx - Contexto compartido de `content.js`; usa
   *   `ctx.state.avatars`, `ctx.cards.getChannelFromCard` y
   *   `ctx.cards.getChannelResultUrl`.
   * @returns {Readonly<Object>} API: `AVATAR_IMG_SELECTOR`, `findAvatarSrc`,
   *   `noteAvatar`, `noteCard`, `setGroupedChannels`, `scanPage`,
   *   `scheduleScan`, `noteMutations` y `flushPending`.
   */
  function create(ctx) {
    const { normalizeAvatarUrl, getGroupedChannelKeys, saveObservedAvatars } =
      YouTubeGroupsAvatars;
    const { normalizeChannelUrl, getChannelKey } = YouTubeGroups;

    /** Avatares vistos en esta sesión: clave de canal -> URL normalizada. */
    const seen = new Map();
    /** Avatares por guardar en el próximo volcado. */
    const pending = new Map();
    /** Claves con avatar ya guardado que se han actualizado en esta sesión. */
    const updatedThisSession = new Set();
    let groupedKeys = new Set();
    let flushTimer = null;
    let scanScheduled = false;
    let scanGuide = false;

    /**
     * URL del avatar de un elemento: la normalizada si las imágenes que casan
     * tienen una sola URL distinta; `null` con cero o varias.
     * @param {Element} root - Elemento donde buscar.
     * @param {string} [selector] - Selector de las imágenes.
     * @returns {string|null}
     */
    function findAvatarSrc(root, selector = AVATAR_IMG_SELECTOR) {
      const urls = new Set();
      for (const img of root.querySelectorAll(selector)) {
        const url = normalizeAvatarUrl(img.src);
        if (url) {
          urls.add(url);
        }
      }
      return urls.size === 1 ? [...urls][0] : null;
    }

    /**
     * Pasa a pendiente el avatar visto de un canal agrupado si difiere del
     * guardado y no se ha actualizado ya en esta sesión.
     * @param {string} key - Clave del canal.
     */
    function considerKey(key) {
      const url = seen.get(key);
      if (!url || !groupedKeys.has(key)) {
        return;
      }
      const stored = ctx.state.avatars?.[key];
      if (stored === url || (stored && updatedThisSession.has(key))) {
        return;
      }
      pending.set(key, url);
      if (flushTimer === null) {
        flushTimer = setTimeout(() => {
          flushPending();
        }, FLUSH_DELAY_MS);
      }
    }

    /**
     * Anota el avatar visto de un canal.
     * @param {string} url - URL del canal.
     * @param {string|null} src - URL de la imagen.
     */
    function noteAvatar(url, src) {
      const channelUrl = url ? normalizeChannelUrl(url) : null;
      const avatar = src ? normalizeAvatarUrl(src) : null;
      if (!channelUrl || !avatar) {
        return;
      }
      const key = getChannelKey(channelUrl);
      seen.delete(key);
      seen.set(key, avatar);
      if (seen.size > MAX_SEEN) {
        seen.delete(seen.keys().next().value);
      }
      considerKey(key);
    }

    /**
     * Anota el avatar de una tarjeta ya procesada.
     * @param {Element} card - Tarjeta.
     * @param {string|undefined} url - URL del canal de la tarjeta.
     */
    function noteCard(card, url) {
      if (!url) {
        return;
      }
      const src = findAvatarSrc(card);
      if (src) {
        noteAvatar(url, src);
      }
    }

    /**
     * Actualiza los canales agrupados y reconsidera lo visto (así se guarda el
     * avatar de un canal recién añadido).
     * @param {Array} groups - Árbol de grupos.
     */
    function setGroupedChannels(groups) {
      groupedKeys = getGroupedChannelKeys(groups);
      for (const key of seen.keys()) {
        considerKey(key);
      }
    }

    /**
     * Lee de la página los avatares visibles que no son de tarjeta.
     * @param {boolean} [includeGuide=true] - Si se leen también las
     *   suscripciones de la guía.
     */
    function scanPage(includeGuide = true) {
      const pageType = YouTubeGroupsPages.getPageType(window.location.pathname);

      if (includeGuide) {
        for (const entry of document.querySelectorAll(
          "ytd-guide-entry-renderer",
        )) {
          const url = ctx.cards.getChannelResultUrl(entry);
          if (url) {
            noteAvatar(url, findAvatarSrc(entry));
          }
        }
      }

      if (pageType === "watch") {
        const owner = document.querySelector("ytd-video-owner-renderer");
        const channel = owner ? ctx.cards.getChannelFromCard(owner) : null;
        if (channel) {
          noteAvatar(channel.url, findAvatarSrc(owner));
        }
      }

      if (pageType === "channel") {
        const channelUrl = YouTubeGroupsPages.getChannelUrlFromPath(
          window.location.pathname,
          window.location.origin,
        );
        const header = document.querySelector(HEADER_SELECTOR);
        if (channelUrl && header) {
          noteAvatar(
            channelUrl,
            findAvatarSrc(header, HEADER_AVATAR_IMG_SELECTOR),
          );
        }
      }
    }

    /**
     * Programa como mucho un `scanPage` por frame.
     * @param {{guide?: boolean}} [options] - `guide: true` incluye las
     *   suscripciones de la guía (arranque, navegación y cambios en la guía).
     */
    function scheduleScan({ guide = false } = {}) {
      scanGuide = scanGuide || guide;
      if (scanScheduled) {
        return;
      }
      scanScheduled = true;
      requestAnimationFrame(() => {
        const includeGuide = scanGuide;
        scanScheduled = false;
        scanGuide = false;
        scanPage(includeGuide);
      });
    }

    /**
     * Programa un escaneo tras un lote de mutaciones; la guía solo se lee si
     * alguna toca `ytd-guide-renderer`.
     * @param {MutationRecord[]} mutations - Mutaciones observadas.
     */
    function noteMutations(mutations) {
      const touchesGuide = (node) =>
        node instanceof Element &&
        (node.matches(GUIDE_SELECTOR) || node.closest(GUIDE_SELECTOR) !== null);
      const guide = mutations.some(
        (mutation) =>
          touchesGuide(mutation.target) ||
          [...mutation.addedNodes].some(touchesGuide),
      );
      scheduleScan({ guide });
    }

    /**
     * Guarda los avatares pendientes; los errores se registran sin relanzar.
     * @returns {Promise<void>}
     */
    async function flushPending() {
      if (flushTimer !== null) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      if (pending.size === 0) {
        return;
      }
      const batch = new Map(pending);
      pending.clear();
      for (const key of batch.keys()) {
        if (ctx.state.avatars?.[key]) {
          updatedThisSession.add(key);
        }
      }
      try {
        await saveObservedAvatars(batch);
      } catch (error) {
        console.error(
          "[YouTube Groups] No se pudieron guardar avatares",
          error,
        );
      }
    }

    return Object.freeze({
      AVATAR_IMG_SELECTOR,
      findAvatarSrc,
      noteAvatar,
      noteCard,
      setGroupedChannels,
      scanPage,
      scheduleScan,
      noteMutations,
      flushPending,
    });
  }

  return Object.freeze({ create });
})();
