const YouTubeGroupsFilter = (() => {
  const ALL_FILTER = Object.freeze({ type: "all" });
  const PENDING_FILTER_KEY = "youtubeGroupsPendingFilter";
  const PENDING_MAX_AGE_MS = 30000;

  /**
   * Normaliza un filtro recibido (de la interfaz o de sessionStorage).
   *
   * @param {*} raw Filtro a validar.
   * @returns {{type: "all"}|{type: "group", id: string}|{type: "channel", containerId: string, url: string, name: string}}
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
      if (
        typeof raw.url !== "string" ||
        typeof raw.containerId !== "string" ||
        raw.containerId === ""
      ) {
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
        containerId: raw.containerId,
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
   * @returns {string|null} null para "todos", "group:<id>" o
   *   "channel:<contenedor codificado>:<url>".
   */
  function getFilterKey(filter) {
    const normalized = normalizeFilter(filter);
    if (normalized.type === "group") {
      return `group:${normalized.id}`;
    }
    if (normalized.type === "channel") {
      return `channel:${encodeURIComponent(normalized.containerId)}:${normalized.url}`;
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
      return groupOwnsChannel(groups, normalized.containerId, normalized.url)
        ? { status: "ok", urls: new Set([normalized.url]) }
        : { status: "missing" };
    }
    return { status: "all" };
  }

  /**
   * Indica si el grupo `containerId` (en cualquier nivel) tiene el canal
   * entre sus propios canales (sin contar subgrupos).
   *
   * @param {Array<Object>} groups Grupos guardados.
   * @param {string} containerId Id del grupo contenedor.
   * @param {string} url URL normalizada del canal.
   * @returns {boolean}
   */
  function groupOwnsChannel(groups, containerId, url) {
    if (!Array.isArray(groups)) {
      return false;
    }
    for (const group of groups) {
      if (!group) {
        continue;
      }
      if (group.id === containerId) {
        const channels = Array.isArray(group.channels) ? group.channels : [];
        return channels.some((channel) => {
          if (!channel || typeof channel.url !== "string") {
            return false;
          }
          try {
            return YouTubeGroups.normalizeChannelUrl(channel.url) === url;
          } catch {
            return false;
          }
        });
      }
      if (groupOwnsChannel(group.subgroups, containerId, url)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Convierte una clave de selección en un filtro normalizado.
   *
   * @param {*} key Clave "group:<id>" o "channel:<contenedor codificado>:<url>".
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
      const rest = key.slice(8);
      const separator = rest.indexOf(":");
      if (separator <= 0) {
        return null;
      }
      const url = rest.slice(separator + 1);
      if (!url.startsWith("https://") && !url.startsWith("http://")) {
        return null;
      }
      let containerId;
      try {
        containerId = decodeURIComponent(rest.slice(0, separator));
      } catch {
        return null;
      }
      filter = normalizeFilter({ type: "channel", containerId, url });
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
   * Busca la ruta de ids (de la raíz al grupo) de un grupo en cualquier nivel.
   *
   * @param {Array<Object>} groups Grupos guardados.
   * @param {string} id Id del grupo.
   * @returns {string[]|null} La ruta, o null si el grupo no existe.
   */
  function findGroupPath(groups, id) {
    if (!Array.isArray(groups)) {
      return null;
    }
    for (const group of groups) {
      if (!group) {
        continue;
      }
      if (group.id === id) {
        return [group.id];
      }
      const inner = findGroupPath(group.subgroups, id);
      if (inner) {
        return [group.id, ...inner];
      }
    }
    return null;
  }

  /**
   * Indica si dos claves de selección son hermanas: mismo tipo y mismo
   * contenedor (mismo padre para grupos, mismo grupo para canales).
   *
   * @param {Array<Object>} groups Grupos guardados.
   * @param {string} keyA Primera clave.
   * @param {string} keyB Segunda clave.
   * @returns {boolean}
   */
  function areSiblings(groups, keyA, keyB) {
    const a = parseFilterKey(keyA);
    const b = parseFilterKey(keyB);
    if (!a || !b || a.type !== b.type) {
      return false;
    }
    if (a.type === "channel") {
      return a.containerId === b.containerId;
    }
    const pathA = findGroupPath(groups, a.id);
    const pathB = findGroupPath(groups, b.id);
    if (!pathA || !pathB || pathA.length !== pathB.length) {
      return false;
    }
    return pathA.slice(0, -1).every((id, index) => id === pathB[index]);
  }

  /**
   * Añade o quita un filtro de la selección. Al añadir, solo se conservan los
   * elementos hermanos del nuevo (ADR 0011).
   *
   * @param {Array<Object>} groups Grupos guardados.
   * @param {*} selection Selección actual.
   * @param {*} filter Filtro pulsado.
   * @returns {string[]} Selección nueva; la entrada no se modifica.
   */
  function toggleSelection(groups, selection, filter) {
    const current = normalizeSelection(selection);
    const key = getFilterKey(filter);
    if (key === null) {
      return current;
    }
    if (current.includes(key)) {
      return current.filter((item) => item !== key);
    }
    return [...current.filter((item) => areSiblings(groups, item, key)), key];
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
    let kept = [];
    const resolvedByKey = new Map();
    for (const key of normalizeSelection(selection)) {
      const resolved = resolveFilterUrls(groups, parseFilterKey(key));
      if (resolved.status === "ok") {
        kept.push(key);
        resolvedByKey.set(key, resolved.urls);
      }
    }
    if (kept.length > 1) {
      const last = kept[kept.length - 1];
      kept = kept.filter((key) => areSiblings(groups, key, last));
    }
    const urls = new Set();
    for (const key of kept) {
      for (const url of resolvedByKey.get(key)) {
        urls.add(url);
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
      version: 3,
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
    if (!data || typeof data !== "object" || data.version !== 3) {
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
