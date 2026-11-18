/**
 * Lógica pura de las suscripciones conocidas (ADR 0018). Sin DOM.
 * Se carga tras avatars.js y storage.js.
 */
const YouTubeGroupsSubscriptions = (() => {
  const CHANNELS_FEED_PATH = "/feed/channels";
  const YOUTUBE_HOSTS = ["www.youtube.com", "youtube.com"];

  /**
   * Indica si una entrada de suscripción es válida para la clave dada.
   * @param {*} key Clave del mapa.
   * @param {*} entry Entrada `{ name, url, firstSeen }`.
   * @returns {boolean}
   */
  function isValidEntry(key, entry) {
    if (!entry || typeof entry !== "object") {
      return false;
    }
    const { name, url, firstSeen } = entry;
    if (
      typeof key !== "string" ||
      typeof url !== "string" ||
      typeof name !== "string" ||
      name.trim() === "" ||
      typeof firstSeen !== "number" ||
      !Number.isFinite(firstSeen)
    ) {
      return false;
    }
    try {
      return (
        YouTubeGroups.normalizeChannelUrl(url) === url &&
        YouTubeGroups.getChannelKey(url) === key
      );
    } catch {
      return false;
    }
  }

  /**
   * Descarta las entradas no válidas de un mapa de suscripciones.
   * @param {*} value Mapa clave de canal -> `{ name, url, firstSeen }`.
   * @returns {Object} Mapa solo con entradas válidas (copias).
   */
  function normalizeSubscriptions(value) {
    const result = {};
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return result;
    }
    for (const [key, entry] of Object.entries(value)) {
      if (isValidEntry(key, entry)) {
        result[key] = {
          name: entry.name,
          url: entry.url,
          firstSeen: entry.firstSeen,
        };
      }
    }
    return result;
  }

  /**
   * Combina las suscripciones guardadas con las observadas. No muta ninguna entrada.
   * @param {Object} stored Suscripciones guardadas.
   * @param {Object|Map} observed Suscripciones vistas (clave -> `{ name, url }`).
   * @param {{now?: number, reconcileKeys?: Iterable<string>}} [options]
   *   `reconcileKeys`: si existe, se borra lo guardado que no esté en ese conjunto.
   * @returns {{channels: Object, changed: boolean}}
   */
  function mergeSubscriptions(
    stored,
    observed,
    { now = Date.now(), reconcileKeys } = {},
  ) {
    const previous = stored && typeof stored === "object" ? stored : {};
    const channels = normalizeSubscriptions(previous);

    if (reconcileKeys) {
      const seen = new Set(reconcileKeys);
      for (const key of Object.keys(channels)) {
        if (!seen.has(key)) {
          delete channels[key];
        }
      }
    }

    const entries =
      Object.prototype.toString.call(observed) === "[object Map]"
        ? [...observed.entries()]
        : Object.entries(observed || {});
    for (const [key, entry] of entries) {
      const name =
        entry && typeof entry.name === "string" ? entry.name.trim() : "";
      const url = entry && entry.url;
      if (!isValidEntry(key, { name, url, firstSeen: now })) {
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(channels, key)) {
        channels[key].name = name;
      } else {
        channels[key] = { name, url, firstSeen: now };
      }
    }

    const keys = Object.keys(channels);
    const changed =
      keys.length !== Object.keys(previous).length ||
      keys.some((key) => {
        const before = previous[key];
        const after = channels[key];
        return (
          !Object.prototype.hasOwnProperty.call(previous, key) ||
          !before ||
          before.name !== after.name ||
          before.url !== after.url ||
          before.firstSeen !== after.firstSeen
        );
      });

    return { channels, changed };
  }

  /**
   * Suscripciones que no están en ningún grupo ni subgrupo.
   * @param {Object} channels Suscripciones conocidas.
   * @param {Array} groups Grupos.
   * @returns {Array<{key: string, name: string, url: string, firstSeen: number}>}
   *   Ordenadas por `firstSeen` descendente y, a igualdad, por nombre.
   */
  function getUnclassifiedSubscriptions(channels, groups) {
    const grouped = YouTubeGroupsAvatars.getGroupedChannelKeys(groups);
    const valid = normalizeSubscriptions(channels);
    return Object.entries(valid)
      .filter(([key]) => !grouped.has(key))
      .map(([key, entry]) => ({ key, ...entry }))
      .sort(
        (a, b) => b.firstSeen - a.firstSeen || a.name.localeCompare(b.name),
      );
  }

  /**
   * Busca la sección de suscripciones de la guía (la del enlace a /feed/channels).
   * @param {string[][]} sections Un array de href por sección de la guía.
   * @returns {number} Índice de la primera sección que la contiene, o -1.
   */
  function findSubscriptionSectionIndex(sections) {
    if (!Array.isArray(sections)) {
      return -1;
    }
    for (let index = 0; index < sections.length; index += 1) {
      const hrefs = Array.isArray(sections[index]) ? sections[index] : [];
      for (const href of hrefs) {
        try {
          const url = new URL(href, "https://www.youtube.com");
          if (
            YOUTUBE_HOSTS.includes(url.hostname) &&
            url.pathname === CHANNELS_FEED_PATH
          ) {
            return index;
          }
        } catch {
          // href no válido: se ignora.
        }
      }
    }
    return -1;
  }

  /**
   * Indica si la lista de /feed/channels está completa y se puede reconciliar.
   * @param {{channelCount: number, notedCount: number, hasContinuation: boolean}} state
   * @returns {boolean}
   */
  function isChannelListComplete({
    channelCount,
    notedCount,
    hasContinuation,
  }) {
    return channelCount > 0 && notedCount >= channelCount && !hasContinuation;
  }

  /**
   * Guarda las suscripciones observadas, solo si algo cambia.
   * @param {Object|Map} observed Suscripciones vistas (clave -> `{ name, url }`).
   * @param {{reconcileKeys?: Iterable<string>}} [options]
   * @returns {Promise<{changed: boolean}>}
   */
  function saveObservedSubscriptions(observed, { reconcileKeys } = {}) {
    const storage = YouTubeGroupsStorage;
    return storage.withLock(storage.KEYS.subscriptions, async () => {
      const stored = await storage.getSubscriptions();
      const { channels, changed } = mergeSubscriptions(stored, observed, {
        now: Date.now(),
        reconcileKeys,
      });
      if (changed) {
        await storage.saveSubscriptions(channels);
      }
      return { changed };
    });
  }

  return {
    normalizeSubscriptions,
    mergeSubscriptions,
    getUnclassifiedSubscriptions,
    findSubscriptionSectionIndex,
    isChannelListComplete,
    saveObservedSubscriptions,
  };
})();
