/**
 * Tarjetas de vídeo y resultados de canal: detección del canal, controles
 * sobre la miniatura, filtrado y visibilidad, y su programación. Se crea con
 * `create(ctx)`; no toca el DOM al crearse.
 */
const YouTubeGroupsCards = (() => {
  const { setCardButtonContent, shieldControlEvents } = YouTubeGroupsIconsDom;
  const { normalizeChannelUrl } = YouTubeGroups;

  /**
   * Crea el componente de tarjetas.
   * @param {Object} ctx - Contexto compartido de `content.js`.
   * @returns {Readonly<Object>} API: `VIDEO_CARD_SELECTOR`, `WATCHED_CLASS`,
   *   `VIDEO_ID_ATTRIBUTE`, `applyVisibilityToAllCards`, `findVideoId`,
   *   `getChannelFromCard`, `getCurrentVideoChannel`,
   *   `refreshChannelNameIndex`, `applyCardVisibility`, `showAllVideoCards`,
   *   `filterAllDetectedCards`, `scheduleCardsIn`, `scheduleContainingCard`,
   *   `scanDocument`, `nodeBelongsToCurrentVideoOwner` y `resetDetectedCards`.
   */
  function create(ctx) {
    const VIDEO_CARD_SELECTOR = [
      "ytd-rich-item-renderer",
      "ytd-video-renderer",
      "ytd-grid-video-renderer",
      "ytd-compact-video-renderer",
      "ytd-playlist-video-renderer",
      // Recomendaciones de /watch; en inicio la tarjeta es el rich-item
      // Los de listas y mixes (enlace con list=) no son vídeos
      'yt-lockup-view-model:not(ytd-rich-item-renderer yt-lockup-view-model):not(:has(a[href*="list="]))',
      // Estanterías de Shorts (búsqueda, suscripciones, canal); sin botones
      "ytd-reel-item-renderer:not(ytd-rich-item-renderer *)",
      "ytm-shorts-lockup-view-model:not(ytd-rich-item-renderer *)",
      "ytm-shorts-lockup-view-model-v2:not(ytd-rich-item-renderer *)",
    ].join(",");

    /**
     * Índice nombre de canal → URL de los canales guardados; sirve para
     * identificar tarjetas sin enlace de canal.
     * @type {Map<string, string>}
     */
    let channelNameIndex = new Map();

    const WATCHED_CLASS = "youtube-groups--watched";
    const VIDEO_ID_ATTRIBUTE = "data-youtube-groups-video-id";

    /**
     * Reaplica la visibilidad a todas las tarjetas de vídeo.
     */
    function applyVisibilityToAllCards() {
      for (const card of document.querySelectorAll(VIDEO_CARD_SELECTOR)) {
        applyCardVisibility(card);
      }
    }

    /**
     * Busca el ID del vídeo de una tarjeta en su primer enlace válido.
     * @param {Element} card - Tarjeta de vídeo.
     * @returns {string|null} ID de 11 caracteres o null.
     */
    function findVideoId(card) {
      for (const link of card.querySelectorAll("a[href]")) {
        const videoId = YouTubeGroupsWatched.extractVideoId(
          link.getAttribute("href"),
        );
        if (videoId) {
          return videoId;
        }
      }
      return null;
    }

    let detectedCards = new WeakMap();
    const pendingCards = new Set();
    let processingScheduled = false;

    function getChannelName(link) {
      return (
        link.textContent.trim() ||
        link.getAttribute("aria-label")?.trim() ||
        link.getAttribute("title")?.trim() ||
        ""
      );
    }

    // Enlace con nombre y URL de canal de una tarjeta
    function findChannelLink(card) {
      for (const link of card.querySelectorAll("a[href]")) {
        if (getChannelName(link) && normalizeChannelUrl(link.href)) {
          return link;
        }
      }

      return null;
    }

    function getChannelFromCard(card) {
      const link = findChannelLink(card);

      return link
        ? { name: getChannelName(link), url: normalizeChannelUrl(link.href) }
        : null;
    }

    // Canal que `detectCard` guardó en la tarjeta (por enlace o por nombre)
    function getDetectedChannel(card) {
      const name = card.dataset.youtubeGroupsChannelName;
      const url = card.dataset.youtubeGroupsChannelUrl;

      return name && url ? { name, url } : null;
    }

    // "Añadir a grupo" queda deshabilitado mientras no se identifique el canal
    function updateAddButtonAvailability(card, button) {
      const known = Boolean(
        getChannelFromCard(card) || getDetectedChannel(card),
      );
      if (button.disabled !== !known) {
        button.disabled = !known;
      }
      if (known) {
        button.removeAttribute("title");
      } else if (button.title !== "No se pudo identificar el canal") {
        button.title = "No se pudo identificar el canal";
      }
    }

    /**
     * Crea el control de una tarjeta.
     * @param {Element} card Tarjeta sobre la que va el control.
     * @param {{videoButtons?: boolean, channel?: {name: string, url: string}}} [options]
     *   `videoButtons: false` deja solo "Añadir a grupo"; `channel` fija el canal
     *   en lugar de leerlo de la tarjeta al pulsar.
     * @returns {HTMLElement} Control con los botones.
     */
    function createSubscriptionChannelControl(card, options = {}) {
      const { videoButtons = true, channel = null, compact = false } = options;
      const control = document.createElement("span");
      control.className = "youtube-groups__subscription-control";
      if (compact) {
        control.classList.add("youtube-groups__subscription-control--compact");
      }

      const button = document.createElement("button");
      button.className =
        "youtube-groups__subscription-add-button action-button primary-button";
      button.type = "button";
      if (videoButtons) {
        setCardButtonContent(button, "+G", "Añadir a grupo", false);
      } else {
        button.textContent = "Añadir a grupo";
      }
      control.appendChild(button);

      shieldControlEvents(control);

      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        // El canal se lee de la tarjeta al abrir, no al crear el control
        ctx.dropdowns.openSubscriptionGroupsForm(
          channel || getChannelFromCard(card) || getDetectedChannel(card),
          button,
        );
      });
      if (compact) {
        updateAddButtonAvailability(card, button);
      }

      if (!videoButtons) {
        return control;
      }

      const watchedButton = document.createElement("button");
      watchedButton.className =
        "youtube-groups__watched-button action-button secondary-button";
      watchedButton.type = "button";
      const initialVideoId = findVideoId(card);
      setCardButtonContent(watchedButton, null, "Marcar visto");
      ctx.watched.updateWatchedButton(
        watchedButton,
        initialVideoId,
        Boolean(initialVideoId) &&
          ctx.state.watchedVideos !== null &&
          YouTubeGroupsWatched.isVideoWatched(
            ctx.state.watchedVideos,
            initialVideoId,
          ),
      );
      control.appendChild(watchedButton);

      watchedButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        // El ID se lee de la tarjeta al pulsar: YouTube puede reutilizarla
        ctx.watched.toggleVideoWatched(findVideoId(card), watchedButton, card);
      });

      const playlistButton = document.createElement("button");
      playlistButton.className =
        "youtube-groups__playlist-button action-button secondary-button";
      playlistButton.type = "button";
      setCardButtonContent(playlistButton, "playlist-add", "Lista");
      playlistButton.disabled = !initialVideoId;
      control.appendChild(playlistButton);

      playlistButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        // Los datos se leen de la tarjeta al abrir: YouTube puede reutilizarla
        ctx.dropdowns.openPlaylistForm(
          getVideoDataFromCard(card),
          playlistButton,
        );
      });

      return control;
    }

    /**
     * Lee del DOM los datos de una tarjeta para guardarla en una lista.
     * @param {Element} card - Tarjeta de vídeo.
     * @returns {{id: string|null, title: string, channelName: string}} Datos del vídeo.
     */
    function getVideoDataFromCard(card) {
      let title = card.querySelector("#video-title")?.textContent.trim() ?? "";
      if (!title) {
        for (const link of card.querySelectorAll("a[href]")) {
          if (YouTubeGroupsWatched.extractVideoId(link.getAttribute("href"))) {
            title =
              link.getAttribute("title")?.trim() || link.textContent.trim();
            break;
          }
        }
      }

      return {
        id: findVideoId(card),
        title,
        channelName: getChannelFromCard(card)?.name ?? "",
      };
    }

    const WATCH_RELATED_SELECTOR =
      "#related, ytd-watch-next-secondary-results-renderer";

    // Un control por tarjeta; es idempotente porque insertarlo provoca una
    // mutación que vuelve a programar la tarjeta.
    function ensureChannelControl(card) {
      const pageType = YouTubeGroupsPages.getPageType(window.location.pathname);
      if (
        !card.isConnected ||
        !YouTubeGroupsPages.shouldShowCardControls(pageType)
      ) {
        return;
      }

      const isWatch = pageType === "watch";
      if (isWatch && !card.closest(WATCH_RELATED_SELECTOR)) {
        return;
      }

      const thumbHost = card.querySelector(
        "ytd-thumbnail, yt-thumbnail-view-model",
      );
      const existing = card.querySelector(
        ".youtube-groups__subscription-control",
      );
      if (existing) {
        // Si la miniatura apareció después, el control pasa a ella
        if (
          thumbHost &&
          !existing.classList.contains(
            "youtube-groups__card-actions--overlay",
          ) &&
          existing.querySelector(".youtube-groups__watched-button")
        ) {
          placeControlOnThumbnail(thumbHost, existing);
        }
        // El canal puede identificarse después de crear el control
        const addButton = existing.querySelector(
          ".youtube-groups__subscription-add-button",
        );
        if (isWatch && addButton) {
          updateAddButtonAvailability(card, addButton);
        }
        return;
      }

      const channelLink = findChannelLink(card);
      if (isWatch) {
        const compact = createSubscriptionChannelControl(card, {
          compact: true,
        });
        if (thumbHost) {
          placeControlOnThumbnail(thumbHost, compact);
        } else if (channelLink) {
          channelLink.insertAdjacentElement("afterend", compact);
        } else {
          (
            card.querySelector("yt-lockup-metadata-view-model") || card
          ).appendChild(compact);
        }
        return;
      }

      if (!channelLink) {
        return;
      }

      const control = createSubscriptionChannelControl(card);
      if (thumbHost) {
        placeControlOnThumbnail(thumbHost, control);
        return;
      }

      // Respaldo sin miniatura: tras el nombre del canal, en línea propia.
      const anchor =
        (pageType === "search" && channelLink.closest("ytd-channel-name")) ||
        channelLink;

      anchor.insertAdjacentElement("afterend", control);
    }

    /**
     * Coloca el control como columna superpuesta a la miniatura.
     * @param {Element} thumbHost Miniatura anfitriona.
     * @param {HTMLElement} control Control de la tarjeta.
     */
    function placeControlOnThumbnail(thumbHost, control) {
      thumbHost.setAttribute("data-youtube-groups-thumb-host", "");
      control.classList.add("youtube-groups__card-actions--overlay");
      thumbHost.appendChild(control);
    }

    const CHANNEL_RESULT_SELECTOR = "ytd-channel-renderer";

    // Control "Añadir a grupo" en un resultado de canal de la búsqueda;
    // idempotente por el mismo motivo que ensureChannelControl.
    function ensureChannelResultControl(card) {
      const pageType = YouTubeGroupsPages.getPageType(window.location.pathname);
      if (
        !card.isConnected ||
        pageType !== "search" ||
        card.querySelector(".youtube-groups__subscription-control")
      ) {
        return;
      }

      let url = null;
      for (const link of card.querySelectorAll("a[href]")) {
        url = normalizeChannelUrl(link.href);
        if (url) {
          break;
        }
      }

      const nameElement =
        card.querySelector("ytd-channel-name #text") ||
        card.querySelector("#channel-title");
      const name = nameElement?.textContent.trim();
      if (!url || !name) {
        return;
      }

      const container = card.querySelector("#info") || card;
      container.appendChild(
        createSubscriptionChannelControl(card, {
          videoButtons: false,
          channel: { name, url },
        }),
      );
    }

    const CURRENT_VIDEO_OWNER_SELECTOR =
      "ytd-watch-metadata #owner, ytd-video-owner-renderer";

    const SHORTS_OWNER_SELECTOR = "ytd-reel-video-renderer[is-active]";

    /**
     * Canal del vídeo actual: en /watch, el propietario; en /shorts, el del
     * Short activo.
     * @returns {{name: string, url: string}|null}
     */
    function getCurrentVideoChannel() {
      const pageType = YouTubeGroupsPages.getPageType(window.location.pathname);
      if (pageType !== "watch" && pageType !== "shorts") {
        return null;
      }

      const owner = document.querySelector(
        pageType === "shorts"
          ? SHORTS_OWNER_SELECTOR
          : CURRENT_VIDEO_OWNER_SELECTOR,
      );
      return owner ? getChannelFromCard(owner) : null;
    }

    /**
     * Recalcula el índice de canales por nombre; si cambia, reprograma las
     * tarjetas que aún no tienen canal identificado.
     * @param {Array<Object>} groups - Árbol de grupos.
     */
    function refreshChannelNameIndex(groups) {
      const next = YouTubeGroups.buildChannelNameIndex(groups);
      const changed =
        next.size !== channelNameIndex.size ||
        [...next].some(([name, url]) => channelNameIndex.get(name) !== url);
      channelNameIndex = next;
      if (!changed) {
        return;
      }
      for (const card of document.querySelectorAll(VIDEO_CARD_SELECTOR)) {
        const known = detectedCards.get(card);
        if (known && known.link === null) {
          detectedCards.delete(card);
        }
        if (!detectedCards.has(card)) {
          scheduleCard(card);
        }
      }
    }

    function detectCard(card) {
      if (!card.isConnected) {
        return;
      }

      // Saltar la tarjeta si su enlace de canal sigue siendo el mismo, o, si no
      // tenía enlace, si sigue sin tenerlo y el vídeo no ha cambiado
      const known = detectedCards.get(card);
      const videoId = card.getAttribute(VIDEO_ID_ATTRIBUTE);
      const link = findChannelLink(card);
      if (known) {
        if (known.link === null) {
          if (link === null && known.videoId === videoId) {
            return;
          }
        } else if (
          card.contains(known.link) &&
          known.link.href === known.href
        ) {
          return;
        }
      }

      let channel = null;
      if (link) {
        channel = {
          name: getChannelName(link),
          url: normalizeChannelUrl(link.href),
        };
        detectedCards.set(card, { link, href: link.href });
      } else {
        const pageChannelUrl =
          YouTubeGroupsPages.getPageType(window.location.pathname) === "channel"
            ? YouTubeGroupsPages.getChannelUrlFromPath(
                window.location.pathname,
                window.location.origin,
              )
            : null;
        if (pageChannelUrl) {
          // En páginas de canal las tarjetas son del canal de la página
          const name = pageChannelUrl.replace(
            /^[^/]+:\/\/[^/]+\/(?:@|(?:channel|c|user)\/)/,
            "",
          );
          let decoded = name;
          try {
            decoded = decodeURIComponent(name);
          } catch {
            // Se deja sin decodificar
          }
          channel = { name: decoded, url: pageChannelUrl };
        } else {
          // Sin enlace: se busca por nombre entre los canales guardados
          channel = YouTubeGroups.matchChannelByTexts(
            channelNameIndex,
            getChannelTexts(card),
          );
        }
        detectedCards.set(card, { link: null, videoId, channel });
      }

      if (!channel) {
        // La tarjeta no tiene canal: borrar los datos del anterior
        delete card.dataset.youtubeGroupsChannelName;
        delete card.dataset.youtubeGroupsChannelUrl;
        applyCardVisibility(card);
        return;
      }

      if (card.dataset.youtubeGroupsChannelName !== channel.name) {
        card.dataset.youtubeGroupsChannelName = channel.name;
      }
      if (card.dataset.youtubeGroupsChannelUrl !== channel.url) {
        card.dataset.youtubeGroupsChannelUrl = channel.url;
      }

      // La visibilidad se aplica en cuanto se detecta la tarjeta
      applyCardVisibility(card);
    }

    /**
     * Indica si una tarjeta pasa el filtro activo (ver
     * `YouTubeGroupsVisibility.matchesGroupFilter`). Con grupo activo, una
     * tarjeta con vídeo pero sin canal identificado no pasa.
     * @param {Element} card - Tarjeta de vídeo.
     * @returns {boolean}
     */
    function cardMatchesFilter(card) {
      return YouTubeGroupsVisibility.matchesGroupFilter({
        hasFilter: ctx.state.activeSelection.length > 0,
        channelUrls: ctx.state.activeSelectionUrls,
        channelUrl: card.dataset.youtubeGroupsChannelUrl,
        hasVideoId: card.hasAttribute(VIDEO_ID_ATTRIBUTE),
      });
    }

    /** Caché tarjeta -> { videoId, metadata } de los metadatos ya leídos. */
    const cardMetadataCache = new WeakMap();

    /**
     * Lee los textos visibles de una tarjeta: los `span` y `div` sin hijos
     * elemento, con 1 a 60 caracteres, fuera del título y fuera de los nodos
     * añadidos por la extensión.
     * @param {Element} card - Tarjeta de vídeo.
     * @returns {string[]} Textos recortados.
     */
    function getCardTexts(card, root = card) {
      const texts = [];
      for (const element of root.querySelectorAll("span, div")) {
        if (
          element.children.length > 0 ||
          element.closest('h3, #video-title, [class*="youtube-groups__"]')
        ) {
          continue;
        }
        const text = (element.textContent ?? "").trim();
        if (text.length >= 1 && text.length <= 60) {
          texts.push(text);
        }
      }
      return texts;
    }

    /** Zona de la tarjeta donde YouTube pinta el canal y los metadatos. */
    const CHANNEL_TEXT_SCOPE_SELECTOR =
      "yt-content-metadata-view-model, #metadata, #byline-container";

    /**
     * Textos de la zona de metadatos de la tarjeta, para buscar el canal por
     * nombre. Sin esa zona no hay textos (no se busca por nombre).
     * @param {Element} card - Tarjeta de vídeo.
     * @returns {string[]} Textos recortados.
     */
    function getChannelTexts(card) {
      const scope = card.querySelector(CHANNEL_TEXT_SCOPE_SELECTOR);
      return scope ? getCardTexts(card, scope) : [];
    }

    /**
     * Devuelve los metadatos de una tarjeta, con caché por ID de vídeo. Se
     * vuelven a leer mientras falte algún dato (YouTube pinta la duración tarde).
     * @param {Element} card - Tarjeta de vídeo.
     * @returns {{duration: number|null, age: number|null, views: number|null}}
     */
    function getCardMetadata(card) {
      const videoId = card.getAttribute(VIDEO_ID_ATTRIBUTE);
      const cached = cardMetadataCache.get(card);
      if (cached && cached.videoId === videoId) {
        return cached.metadata;
      }
      const metadata = YouTubeGroupsMetadata.extractCardMetadata(
        getCardTexts(card),
      );
      const complete = Object.values(metadata).every((value) => value !== null);
      if (complete) {
        cardMetadataCache.set(card, { videoId, metadata });
      } else {
        cardMetadataCache.delete(card);
      }
      return metadata;
    }

    /**
     * Indica si una tarjeta pasa los filtros avanzados (sin filtros, pasa).
     * @param {Element} card - Tarjeta de vídeo.
     * @returns {boolean}
     */
    function cardMatchesAdvancedFilters(card) {
      if (!YouTubeGroupsMetadata.hasActiveFilters(ctx.state.advancedFilters)) {
        return true;
      }
      return YouTubeGroupsMetadata.matchesAdvancedFilters(
        getCardMetadata(card),
        ctx.state.advancedFilters,
      );
    }

    /**
     * Único punto que pinta la visibilidad de una tarjeta: combina filtro,
     * visto y ajustes, y alterna las clases `hidden` y `dimmed`.
     * @param {Element} card - Tarjeta de vídeo.
     */
    function applyCardVisibility(card) {
      const visibility = YouTubeGroupsVisibility.getCardVisibility(
        {
          matchesFilter:
            cardMatchesFilter(card) && cardMatchesAdvancedFilters(card),
          isWatched: card.classList.contains(WATCHED_CLASS),
        },
        ctx.state.settings,
      );
      card.classList.toggle("youtube-groups--hidden", visibility === "hidden");
      card.classList.toggle("youtube-groups--dimmed", visibility === "dimmed");
    }

    function showAllVideoCards() {
      applyVisibilityToAllCards();
    }

    function filterAllDetectedCards() {
      applyVisibilityToAllCards();
    }

    function scheduleCard(card) {
      if (card instanceof Element) {
        pendingCards.add(card);
      }

      if (!processingScheduled) {
        processingScheduled = true;
        requestAnimationFrame(processPendingCards);
      }
    }

    function processPendingCards() {
      processingScheduled = false;
      for (const card of pendingCards) {
        if (card.matches(CHANNEL_RESULT_SELECTOR)) {
          ensureChannelResultControl(card);
          continue;
        }

        // Primero el ID de vídeo: el filtro de detectCard lo necesita al día
        ctx.watched.applyWatchedToCard(card);
        detectCard(card);
        ensureChannelControl(card);
      }

      pendingCards.clear();
    }

    function scheduleCardsIn(node) {
      if (!(node instanceof Element)) {
        return;
      }

      scheduleContainingCard(node);

      const cardSelector = `${VIDEO_CARD_SELECTOR}, ${CHANNEL_RESULT_SELECTOR}`;

      if (node.matches(cardSelector)) {
        scheduleCard(node);
      }

      for (const card of node.querySelectorAll(cardSelector)) {
        scheduleCard(card);
      }
    }

    function scheduleContainingCard(element) {
      const containingCard = element.closest(
        `${VIDEO_CARD_SELECTOR}, ${CHANNEL_RESULT_SELECTOR}`,
      );
      if (containingCard) {
        scheduleCard(containingCard);
      }
    }

    function scanDocument() {
      scheduleCardsIn(document.documentElement);
    }

    function nodeBelongsToCurrentVideoOwner(node) {
      return (
        node instanceof Element &&
        (node.matches(CURRENT_VIDEO_OWNER_SELECTOR) ||
          node.closest(CURRENT_VIDEO_OWNER_SELECTOR) ||
          node.querySelector(CURRENT_VIDEO_OWNER_SELECTOR))
      );
    }

    /**
     * Olvida las tarjetas ya detectadas para que `scanDocument` las procese
     * de nuevo (YouTube reutiliza tarjetas entre navegaciones internas).
     */
    function resetDetectedCards() {
      detectedCards = new WeakMap();
    }

    return Object.freeze({
      VIDEO_CARD_SELECTOR,
      WATCHED_CLASS,
      VIDEO_ID_ATTRIBUTE,
      applyVisibilityToAllCards,
      findVideoId,
      getChannelFromCard,
      getCurrentVideoChannel,
      refreshChannelNameIndex,
      applyCardVisibility,
      showAllVideoCards,
      filterAllDetectedCards,
      scheduleCardsIn,
      scheduleContainingCard,
      scanDocument,
      nodeBelongsToCurrentVideoOwner,
      resetDetectedCards,
    });
  }

  return Object.freeze({ create });
})();
