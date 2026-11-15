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
   * Convierte una clave de selección en un filtro normalizado.
   *
   * @param {*} key Clave "group:<id>" o "channel:<url>".
   * @returns {Object|null} El filtro normalizado, o null si la clave no es válida.
   */
  function parseFilterKey(key) {
    if (typeof key !== "string") {
      return null;
    }
    let filter = ALL_FILTER;
    if (key.startsWith("group:")) {
      filter = normalizeFilter({ type: "group", id: key.slice(6) });
    } else if (key.startsWith("channel:")) {
      filter = normalizeFilter({ type: "channel", url: key.slice(8) });
    }
    return filter.type === "all" ? null : filter;
  }

  /**
   * Normaliza una selección: claves válidas, renormalizadas y sin repetidos.
   *
   * @param {*} raw Selección a validar.
   * @returns {string[]} Selección normalizada ([] si no es un array).
   */
  function normalizeSelection(raw) {
    if (!Array.isArray(raw)) {
      return [];
    }
    const result = [];
    for (const key of raw) {
      const filter = parseFilterKey(key);
      const normalizedKey = filter ? getFilterKey(filter) : null;
      if (normalizedKey !== null && !result.includes(normalizedKey)) {
        result.push(normalizedKey);
      }
    }
    return result;
  }

  /**
   * Añade o quita un filtro de la selección (selección siempre múltiple).
   *
   * @param {*} selection Selección actual.
   * @param {*} filter Filtro pulsado.
   * @returns {string[]} Selección nueva; la entrada no se modifica.
   */
  function toggleSelection(selection, filter) {
    const current = normalizeSelection(selection);
    const key = getFilterKey(filter);
    if (key === null) {
      return current;
    }
    return current.includes(key)
      ? current.filter((item) => item !== key)
      : [...current, key];
  }

  /**
   * Selección vacía, equivalente a "todos".
   *
   * @returns {string[]}
   */
  function clearSelection() {
    return [];
  }

  /**
   * Resuelve la selección contra los grupos guardados.
   *
   * @param {Array<Object>} groups Grupos guardados.
   * @param {*} selection Selección activa.
   * @returns {{selection: string[], urls: Set<string>|null}} Las claves que
   *   existen y la unión de sus URL (null si no queda ninguna).
   */
  function resolveSelection(groups, selection) {
    const kept = [];
    const urls = new Set();
    for (const key of normalizeSelection(selection)) {
      const resolved = resolveFilterUrls(groups, parseFilterKey(key));
      if (resolved.status === "ok") {
        kept.push(key);
        for (const url of resolved.urls) {
          urls.add(url);
        }
      }
    }
    return { selection: kept, urls: kept.length > 0 ? urls : null };
  }

  /**
   * Indica si hay que pasar a /feed/subscriptions tras cambiar la selección.
   *
   * @param {string} pageType Tipo de página (YouTubeGroupsPages.getPageType).
   * @param {string[]} previous Selección anterior.
   * @param {string[]} next Selección resultante.
   * @returns {boolean} true si se añade algo fuera de suscripciones.
   */
  function shouldNavigateOnSelect(pageType, previous, next) {
    if (pageType === "subscriptions") {
      return false;
    }
    const before = normalizeSelection(previous);
    return normalizeSelection(next).some((key) => !before.includes(key));
  }

  /**
   * Serializa la selección pendiente para sessionStorage (ADR 0009).
   *
   * @param {*} selection Selección a traspasar.
   * @param {number} now Marca de tiempo actual (ms).
   * @returns {string} Texto JSON.
   */
  function serializePendingSelection(selection, now) {
    return JSON.stringify({
      version: 2,
      selection: normalizeSelection(selection),
      createdAt: now,
    });
  }

  /**
   * Lee la selección pendiente guardada en sessionStorage.
   *
   * @param {string} text Texto guardado.
   * @param {number} now Marca de tiempo actual (ms).
   * @returns {string[]|null} La selección normalizada, o null si no es válida,
   *   está vacía o ha caducado.
   */
  function parsePendingSelection(text, now) {
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return null;
    }
    if (!data || typeof data !== "object" || data.version !== 2) {
      return null;
    }
    if (typeof data.createdAt !== "number") {
      return null;
    }
    const age = now - data.createdAt;
    if (!(age >= 0 && age <= PENDING_MAX_AGE_MS)) {
      return null;
    }
    const selection = normalizeSelection(data.selection);
    return selection.length > 0 ? selection : null;
  }

  return {
    parseFilterKey,
    normalizeSelection,
    toggleSelection,
    clearSelection,
    resolveSelection,
    shouldNavigateOnSelect,
    serializePendingSelection,
    parsePendingSelection,
    ALL_FILTER,
    PENDING_FILTER_KEY,
    PENDING_MAX_AGE_MS,
    normalizeFilter,
    getFilterKey,
    resolveFilterUrls,
  };
})();
