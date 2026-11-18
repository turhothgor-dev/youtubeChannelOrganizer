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

  /**
   * Crea el recolector.
   * @param {Object} ctx - Contexto compartido de `content.js`; usa
   *   `ctx.cards.getChannelResultUrl`.
   * @returns {Readonly<Object>} API: `readGuide`, `scheduleGuideRead`,
   *   `noteMutations` y `flushPending`.
   */
  function create(ctx) {
    const { findSubscriptionSectionIndex, saveObservedSubscriptions } =
      YouTubeGroupsSubscriptions;
    const { normalizeChannelUrl, getChannelKey } = YouTubeGroups;

    /** Suscripciones ya anotadas en esta sesión: clave -> nombre. */
    const noted = new Map();
    /** Suscripciones por guardar en el próximo volcado. */
    const pending = new Map();
    let flushTimer = null;
    let guideReadScheduled = false;

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
      return guide;
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
        console.error(
          "[YouTube Groups] No se pudieron guardar suscripciones",
          error,
        );
      }
    }

    return Object.freeze({
      readGuide,
      scheduleGuideRead,
      noteMutations,
      flushPending,
    });
  }

  return Object.freeze({ create });
})();
