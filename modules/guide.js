const YouTubeGroupsGuide = (() => {
  const MORE_FROM_YOUTUBE_HOSTS = new Set([
    "studio.youtube.com",
    "music.youtube.com",
    "youtubekids.com",
    "www.youtubekids.com",
    "tv.youtube.com",
  ]);

  /**
   * @param {*} group Grupo a comprobar.
   * @returns {Array<Object>} Sus subgrupos (vacío si no tiene).
   */
  function getSubgroups(group) {
    return group && Array.isArray(group.subgroups) ? group.subgroups : [];
  }

  /**
   * Recorta una ruta de la guía al prefijo más largo que sigue siendo válido.
   *
   * @param {Array<Object>} groups Grupos guardados.
   * @param {*} path Ids de grupo desde el primer nivel.
   * @returns {string[]} La ruta normalizada.
   */
  function normalizeGuidePath(groups, path) {
    if (!Array.isArray(path) || !Array.isArray(groups)) {
      return [];
    }
    const result = [];
    let level = groups;
    for (const id of path) {
      const found = level.find((group) => group && group.id === id);
      if (!found || getSubgroups(found).length === 0) {
        break;
      }
      result.push(id);
      level = getSubgroups(found);
    }
    return result;
  }

  /**
   * @param {Object} group Grupo.
   * @returns {{id: string, name: string, hasSubgroups: boolean,
   *   channels: Array<{name: string, url: string}>}}
   */
  function toGuideItem(group) {
    const channels = (Array.isArray(group.channels) ? group.channels : [])
      .filter((channel) => channel && typeof channel.url === "string")
      .map((channel) => ({
        name:
          typeof channel.name === "string" && channel.name !== ""
            ? channel.name
            : channel.url,
        url: channel.url,
      }));
    return {
      id: group.id,
      name: group.name,
      hasSubgroups: getSubgroups(group).length > 0,
      channels,
    };
  }

  /**
   * Calcula la columna que muestra la guía para una ruta.
   *
   * @param {Array<Object>} groups Grupos guardados.
   * @param {*} path Ruta de ids (se normaliza).
   * @returns {{path: string[], parent: ({id: string, name: string}|null),
   *   items: Array<Object>}}
   */
  function getGuideColumn(groups, path) {
    const safeGroups = Array.isArray(groups) ? groups : [];
    const normalized = normalizeGuidePath(safeGroups, path);
    let level = safeGroups;
    let parent = null;
    for (const id of normalized) {
      const found = level.find((group) => group.id === id);
      parent = { id: found.id, name: found.name };
      level = getSubgroups(found);
    }
    return { path: normalized, parent, items: level.map(toGuideItem) };
  }

  /**
   * Entra en un subgrupo de la columna actual.
   *
   * @param {Array<Object>} groups Grupos guardados.
   * @param {*} path Ruta actual.
   * @param {string} id Grupo en el que entrar.
   * @returns {string[]} La nueva ruta (la normalizada si no se puede entrar).
   */
  function enterGuideGroup(groups, path, id) {
    const column = getGuideColumn(groups, path);
    const item = column.items.find((candidate) => candidate.id === id);
    if (item && item.hasSubgroups) {
      return [...column.path, id];
    }
    return column.path;
  }

  /**
   * @param {string[]} path Ruta actual.
   * @returns {string[]} La ruta sin el último id.
   */
  function leaveGuideGroup(path) {
    return Array.isArray(path) ? path.slice(0, -1) : [];
  }

  /**
   * Indica si la lista de canales de un elemento está desplegada.
   *
   * @param {Map<string, boolean>} overrides Elección manual por id.
   * @param {{id: string, channels: Array<{url: string}>}} item Elemento.
   * @param {number} depth Profundidad de la columna (0 en la raíz).
   * @param {string|null} activeKey Clave del filtro activo.
   * @returns {boolean}
   */
  function isChannelListOpen(overrides, item, depth, activeKey) {
    if (overrides && overrides.has(item.id)) {
      return Boolean(overrides.get(item.id));
    }
    if (
      activeKey &&
      item.channels.some((channel) => `channel:${channel.url}` === activeKey)
    ) {
      return true;
    }
    return depth > 0;
  }

  /**
   * Busca la sección "Más de YouTube" de la guía sin depender del idioma.
   *
   * @param {string[][]} sections Un array de href por sección de la guía.
   * @returns {number} Índice de la primera sección que la identifica, o -1.
   */
  function findGuideInsertionIndex(sections) {
    if (!Array.isArray(sections)) {
      return -1;
    }
    for (let index = 0; index < sections.length; index += 1) {
      const hrefs = Array.isArray(sections[index]) ? sections[index] : [];
      for (const href of hrefs) {
        try {
          const url = new URL(href, "https://www.youtube.com");
          if (MORE_FROM_YOUTUBE_HOSTS.has(url.hostname)) {
            return index;
          }
        } catch {
          // href no válido: se ignora.
        }
      }
    }
    return -1;
  }

  return {
    normalizeGuidePath,
    getGuideColumn,
    enterGuideGroup,
    leaveGuideGroup,
    isChannelListOpen,
    findGuideInsertionIndex,
  };
})();
