/**
 * Recolector de suscripciones conocidas (ADR 0018): lee, sin red, los canales
 * de la sección de suscripciones de la guía de YouTube y los guarda agrupados
 * en una sola escritura cada pocos segundos. Se crea con `create(ctx)`; no toca
 * el DOM al crearse.
 */
const YouTubeGroupsSubscriptionsUi = (() => {
  const GUIDE_SELECTOR = "ytd-guide-renderer";
  const GUIDE_SECTIONS_SELECTOR =
    "ytd-guide-renderer #sections > ytd-guide-section-renderer";
  const GUIDE_ENTRY_SELECTOR = "ytd-guide-entry-renderer";
  const OWN_GUIDE_SELECTOR = "#youtube-groups-guide";
  const ENTRY_TITLE_SELECTOR = ".title";
  const FLUSH_DELAY_MS = 2000;
  const CHANNELS_PAGE_ROOT_SELECTOR = "ytd-browse:not([hidden])";
  const CHANNEL_RENDERER_SELECTOR = "ytd-channel-renderer";
  const CONTINUATION_SELECTOR = "ytd-continuation-item-renderer";
  const CHANNEL_NAME_SELECTOR = "ytd-channel-name #text";
  const CHANNEL_TITLE_SELECTOR = "#channel-title";
  const LIST_ITEM_SELECTOR = `${CHANNEL_RENDERER_SELECTOR}, ${CONTINUATION_SELECTOR}`;
  const SETTLE_DELAY_MS = 3000;

  /**
   * Crea el recolector.
   * @param {Object} ctx - Contexto compartido de `content.js`; usa
   *   `ctx.cards.getChannelResultUrl`.
   * @returns {Readonly<Object>} API: `readGuide`, `scheduleGuideRead`,
   *   `noteMutations` y `flushPending`.
   */
  function create(ctx) {
    const {
      findSubscriptionSectionIndex,
      isChannelListComplete,
      saveObservedSubscriptions,
    } = YouTubeGroupsSubscriptions;
    const { normalizeChannelUrl, getChannelKey } = YouTubeGroups;

    /** Suscripciones ya anotadas en esta sesión: clave -> nombre. */
    const noted = new Map();
    /** Suscripciones por guardar en el próximo volcado. */
    const pending = new Map();
    let flushTimer = null;
    let guideReadScheduled = false;
    /** Claves vistas en `/feed/channels` en la visita actual. */
    const visitKeys = new Set();
    let visit = 0;
    let reconciled = false;
    /** Si se ha visto una mutación de la lista en la visita actual. */
    let listMutated = false;
    let channelsCheckScheduled = false;
    let settleTimer = null;
    let settleCount = 0;

    /**
     * Anota una suscripción vista; no encola lo ya anotado con el mismo nombre.
     * @param {string} url - URL del canal.
     * @param {string} name - Nombre visible.
     */
    function noteChannel(url, name) {
      const channelUrl = url ? normalizeChannelUrl(url) : null;
      const cleanName = typeof name === "string" ? name.trim() : "";
      if (!channelUrl || !cleanName) {
        return;
      }
      const key = getChannelKey(channelUrl);
      if (noted.get(key) === cleanName) {
        return;
      }
      noted.set(key, cleanName);
      pending.set(key, { name: cleanName, url: channelUrl });
      if (flushTimer === null) {
        flushTimer = setTimeout(() => {
          flushPending();
        }, FLUSH_DELAY_MS);
      }
    }

    /**
     * Nombre de una entrada de la guía: atributo `title` del enlace o, si
     * falta, el texto de `.title`.
     * @param {Element} entry - `ytd-guide-entry-renderer`.
     * @returns {string}
     */
    function getEntryName(entry) {
      for (const link of entry.querySelectorAll("a[title]")) {
        const title = link.getAttribute("title").trim();
        if (title) {
          return title;
        }
      }
      return (
        entry.querySelector(ENTRY_TITLE_SELECTOR)?.textContent.trim() || ""
      );
    }

    /**
     * Lee los canales de la sección de suscripciones de la guía. Sin esa
     * sección no hace nada.
     */
    function readGuide() {
      const sections = [...document.querySelectorAll(GUIDE_SECTIONS_SELECTOR)];
      const index = findSubscriptionSectionIndex(
        sections.map((section) =>
          [...section.querySelectorAll("a[href]")].map((link) =>
            link.getAttribute("href"),
          ),
        ),
      );
      if (index === -1) {
        return;
      }
      for (const entry of sections[index].querySelectorAll(
        GUIDE_ENTRY_SELECTOR,
      )) {
        const url = ctx.cards.getChannelResultUrl(entry);
        if (url) {
          noteChannel(url, getEntryName(entry));
        }
      }
    }

    /** Programa como mucho una lectura de la guía por frame. */
    function scheduleGuideRead() {
      if (guideReadScheduled) {
        return;
      }
      guideReadScheduled = true;
      requestAnimationFrame(() => {
        guideReadScheduled = false;
        readGuide();
      });
    }

    /**
     * Programa una lectura si alguna mutación toca `ytd-guide-renderer` fuera
     * de nuestra sección (`#youtube-groups-guide`, que se repinta a menudo).
     * @param {MutationRecord[]} mutations - Mutaciones observadas.
     * @returns {boolean} Si se ha programado la lectura.
     */
    function noteMutations(mutations) {
      const touchesGuide = (node) =>
        node instanceof Element &&
        node.closest(OWN_GUIDE_SELECTOR) === null &&
        (node.matches(GUIDE_SELECTOR) || node.closest(GUIDE_SELECTOR) !== null);
      const guide = mutations.some(
        (mutation) =>
          touchesGuide(mutation.target) ||
          [...mutation.addedNodes].some(touchesGuide),
      );
      if (guide) {
        scheduleGuideRead();
      }
      // La continuación que desaparece también es una mutación de la lista.
      if (isChannelsPage() && mutations.some(touchesChannelList)) {
        listMutated = true;
        scheduleChannelsCheck();
      }
      return guide;
    }

    /**
     * Si una mutación toca la lista de canales: renderers o continuación que
     * se añaden, se quitan o cambian por dentro.
     * @param {MutationRecord} mutation - Mutación observada.
     * @returns {boolean}
     */
    function touchesChannelList(mutation) {
      const isList = (node) =>
        node instanceof Element &&
        (node.matches(LIST_ITEM_SELECTOR) ||
          node.closest(LIST_ITEM_SELECTOR) !== null ||
          node.querySelector(LIST_ITEM_SELECTOR) !== null);
      const target = mutation.target;
      return (
        (target instanceof Element &&
          (target.matches(LIST_ITEM_SELECTOR) ||
            target.closest(LIST_ITEM_SELECTOR) !== null)) ||
        [...mutation.addedNodes].some(isList) ||
        [...(mutation.removedNodes ?? [])].some(isList)
      );
    }

    /**
     * Guarda las suscripciones pendientes; los errores se registran sin
     * relanzar.
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
      try {
        await saveObservedSubscriptions(batch);
      } catch (error) {
        // Para que se reintente con la próxima lectura.
        for (const key of batch.keys()) {
          noted.delete(key);
        }
        console.error(
          "[YouTube Groups] No se pudieron guardar suscripciones",
          error,
        );
      }
    }

    const isChannelsPage = () =>
      YouTubeGroupsPages.getPageType(window.location.pathname) === "channels";

    /** Reinicia el estado de la visita (al cargar y en `yt-navigate-finish`). */
    function startVisit() {
      visit += 1;
      visitKeys.clear();
      reconciled = false;
      listMutated = false;
      channelsCheckScheduled = false;
      clearSettleTimer();
    }

    function clearSettleTimer() {
      if (settleTimer !== null) {
        clearTimeout(settleTimer);
        settleTimer = null;
      }
    }

    /**
     * Anota un `ytd-channel-renderer` de `/feed/channels`; en otras páginas
     * (búsquedas) no hace nada, porque ahí no son suscripciones.
     * @param {Element} card - `ytd-channel-renderer`.
     * @param {string|null} url - URL del canal.
     */
    function noteChannelCard(card, url) {
      if (
        !isChannelsPage() ||
        card.closest(CHANNELS_PAGE_ROOT_SELECTOR) === null
      ) {
        return;
      }
      const name =
        card.querySelector(CHANNEL_NAME_SELECTOR)?.textContent.trim() ||
        card.querySelector(CHANNEL_TITLE_SELECTOR)?.textContent.trim() ||
        "";
      const channelUrl = url ? normalizeChannelUrl(url) : null;
      if (channelUrl && name) {
        visitKeys.add(getChannelKey(channelUrl));
        noteChannel(channelUrl, name);
      }
      scheduleChannelsCheck();
    }

    /**
     * Si la lista de la página activa está completa: todos los renderers
     * anotados y sin continuación pendiente.
     * @returns {boolean}
     */
    function isListComplete() {
      const root = document.querySelector(CHANNELS_PAGE_ROOT_SELECTOR);
      if (!root) {
        return false;
      }
      const renderers = [...root.querySelectorAll(CHANNEL_RENDERER_SELECTOR)];
      const notedCount = renderers.filter((renderer) => {
        const url = ctx.cards.getChannelResultUrl(renderer);
        return url && visitKeys.has(getChannelKey(url));
      }).length;
      return isChannelListComplete({
        channelCount: renderers.length,
        notedCount,
        hasContinuation: root.querySelector(CONTINUATION_SELECTOR) !== null,
      });
    }

    /** Vuelca lo pendiente y da de baja lo no visto en la visita. */
    async function reconcile() {
      reconciled = true;
      const keys = new Set(visitKeys);
      for (const key of [...noted.keys()]) {
        if (!keys.has(key)) {
          noted.delete(key);
        }
      }
      try {
        await flushPending();
        await saveObservedSubscriptions(new Map(), { reconcileKeys: keys });
      } catch (error) {
        console.error(
          "[YouTube Groups] No se pudieron reconciliar suscripciones",
          error,
        );
      }
    }

    /**
     * Comprueba si la lista está completa y, si lo está y no llegan canales
     * nuevos durante `SETTLE_DELAY_MS`, reconcilia (una vez por visita).
     */
    function checkChannelsList() {
      if (!isChannelsPage() || reconciled || !listMutated) {
        return;
      }
      if (!isListComplete()) {
        clearSettleTimer();
        return;
      }
      if (settleTimer !== null && settleCount === visitKeys.size) {
        return;
      }
      clearSettleTimer();
      settleCount = visitKeys.size;
      const startedVisit = visit;
      settleTimer = setTimeout(() => {
        settleTimer = null;
        if (
          startedVisit === visit &&
          !reconciled &&
          settleCount === visitKeys.size &&
          isChannelsPage() &&
          isListComplete()
        ) {
          reconcile();
        }
      }, SETTLE_DELAY_MS);
    }

    /** Programa como mucho una comprobación de la lista por frame. */
    function scheduleChannelsCheck() {
      if (channelsCheckScheduled || reconciled) {
        return;
      }
      channelsCheckScheduled = true;
      requestAnimationFrame(() => {
        if (!channelsCheckScheduled) {
          return;
        }
        channelsCheckScheduled = false;
        checkChannelsList();
      });
    }

    return Object.freeze({
      readGuide,
      scheduleGuideRead,
      noteMutations,
      flushPending,
      startVisit,
      noteChannelCard,
      scheduleChannelsCheck,
      checkChannelsList,
    });
  }

  return Object.freeze({ create });
})();
