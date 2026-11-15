const YouTubeGroupsFilter = (() => {
  const ALL_FILTER = Object.freeze({ type: "all" });
  const PENDING_FILTER_KEY = "youtubeGroupsPendingFilter";
  const PENDING_MAX_AGE_MS = 30000;

  /**
   * Normaliza un filtro recibido (de la interfaz o de sessionStorage).
   *
   * @param {*} raw Filtro a validar.
   * @returns {{type: "all"}|{type: "group", id: string}|{type: "channel", url: string, name: string}}
   *   El filtro normalizado, o ALL_FILTER si no es válido.
   */
  function normalizeFilter(raw) {
    if (!raw || typeof raw !== "object") {
      return ALL_FILTER;
    }

    if (raw.type === "group") {
      if (typeof raw.id === "string" && raw.id !== "") {
        return { type: "group", id: raw.id };
      }
      return ALL_FILTER;
    }

    if (raw.type === "channel") {
      if (typeof raw.url !== "string") {
        return ALL_FILTER;
      }
      let url = null;
      try {
        url = YouTubeGroups.normalizeChannelUrl(raw.url);
      } catch {
        url = null;
      }
      if (!url) {
        return ALL_FILTER;
      }
      return {
        type: "channel",
        url,
        name: typeof raw.name === "string" ? raw.name : "",
      };
    }

    return ALL_FILTER;
  }

  /**
   * Clave comparable de un filtro, con el tipo delante.
   *
   * @param {*} filter Filtro (se normaliza antes).
   * @returns {string|null} null para "todos", "group:<id>" o "channel:<url>".
   */
  function getFilterKey(filter) {
    const normalized = normalizeFilter(filter);
    if (normalized.type === "group") {
      return `group:${normalized.id}`;
    }
    if (normalized.type === "channel") {
      return `channel:${normalized.url}`;
    }
    return null;
  }

  /**
   * Resuelve las URL de canal que deja pasar un filtro.
   *
   * @param {Array<Object>} groups Grupos guardados.
   * @param {*} filter Filtro activo.
   * @returns {{status: "all"}|{status: "ok", urls: Set<string>}|{status: "missing"}}
   */
  function resolveFilterUrls(groups, filter) {
    const normalized = normalizeFilter(filter);
    if (normalized.type === "group") {
      const urls = YouTubeGroups.getGroupChannelUrls(groups, normalized.id);
      return urls ? { status: "ok", urls } : { status: "missing" };
    }
    if (normalized.type === "channel") {
      return channelInGroups(groups, normalized.url)
        ? { status: "ok", urls: new Set([normalized.url]) }
        : { status: "missing" };
    }
    return { status: "all" };
  }

  /**
   * Indica si un canal (URL normalizada) está en algún grupo o subgrupo.
   *
   * @param {Array<Object>} groups Grupos guardados.
   * @param {string} url URL normalizada del canal.
   * @returns {boolean}
   */
  function channelInGroups(groups, url) {
    if (!Array.isArray(groups)) {
      return false;
    }
    for (const group of groups) {
      if (!group) {
        continue;
      }
      const channels = Array.isArray(group.channels) ? group.channels : [];
      for (const channel of channels) {
        if (!channel || typeof channel.url !== "string") {
          continue;
        }
        try {
          if (YouTubeGroups.normalizeChannelUrl(channel.url) === url) {
            return true;
          }
        } catch {
          // URL no normalizable: no coincide
        }
      }
      if (channelInGroups(group.subgroups, url)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Indica si el filtro es de un grupo que se ha quitado.
   *
   * @param {*} filter Filtro activo.
   * @param {Iterable<string>} removedIds Ids de los grupos quitados.
   * @returns {boolean}
   */
  function isFilterOnRemovedGroup(filter, removedIds) {
    const normalized = normalizeFilter(filter);
    if (normalized.type !== "group" || !removedIds) {
      return false;
    }
    for (const id of removedIds) {
      if (id === normalized.id) {
        return true;
      }
    }
    return false;
  }

  /**
   * Selección única que alterna: pulsar lo elegido lo deselecciona.
   *
   * @param {*} current Filtro actual.
   * @param {*} next Filtro pulsado.
   * @returns {Object} El filtro resultante (ALL_FILTER si se deselecciona).
   */
  function toggleFilter(current, next) {
    const normalizedNext = normalizeFilter(next);
    const nextKey = getFilterKey(normalizedNext);
    if (nextKey === null || nextKey === getFilterKey(current)) {
      return ALL_FILTER;
    }
    return normalizedNext;
  }

  /**
   * Indica si hay que pasar a /feed/subscriptions para aplicar el filtro.
   *
   * @param {string} pageType Tipo de página (YouTubeGroupsPages.getPageType).
   * @param {*} filter Filtro resultante.
   * @returns {boolean}
   */
  function shouldNavigateToSubscriptions(pageType, filter) {
    return getFilterKey(filter) !== null && pageType !== "subscriptions";
  }

  /**
   * Serializa el filtro pendiente para sessionStorage (ADR 0007).
   *
   * @param {*} filter Filtro a traspasar.
   * @param {number} now Marca de tiempo actual (ms).
   * @returns {string} Texto JSON.
   */
  function serializePendingFilter(filter, now) {
    return JSON.stringify({
      version: 1,
      filter: normalizeFilter(filter),
      createdAt: now,
    });
  }

  /**
   * Lee el filtro pendiente guardado en sessionStorage.
   *
   * @param {string} text Texto guardado.
   * @param {number} now Marca de tiempo actual (ms).
   * @returns {Object|null} El filtro normalizado, o null si no es válido,
   *   es "todos" o ha caducado.
   */
  function parsePendingFilter(text, now) {
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return null;
    }
    if (!data || typeof data !== "object" || data.version !== 1) {
      return null;
    }
    if (typeof data.createdAt !== "number") {
      return null;
    }
    const age = now - data.createdAt;
    if (!(age >= 0 && age <= PENDING_MAX_AGE_MS)) {
      return null;
    }
    const filter = normalizeFilter(data.filter);
    return filter.type === "all" ? null : filter;
  }

  return {
    ALL_FILTER,
    PENDING_FILTER_KEY,
    PENDING_MAX_AGE_MS,
    normalizeFilter,
    getFilterKey,
    resolveFilterUrls,
    isFilterOnRemovedGroup,
    toggleFilter,
    shouldNavigateToSubscriptions,
    serializePendingFilter,
    parsePendingFilter,
  };
})();
