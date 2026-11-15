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
      if (!found) {
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
      .map((channel) => {
        let url = null;
        try {
          url = YouTubeGroups.normalizeChannelUrl(channel.url);
        } catch {
          url = null;
        }
        return url
          ? {
              name:
                typeof channel.name === "string" && channel.name !== ""
                  ? channel.name
                  : url,
              url,
            }
          : null;
      })
      .filter(Boolean);
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
    if (item) {
      return [...column.path, id];
    }
    return column.path;
  }

  /**
   * Busca un grupo en cualquier nivel y devuelve su ruta.
   *
   * @param {Array<Object>} groups Grupos guardados.
   * @param {string} id Id del grupo.
   * @returns {(string[]|null)} Ids desde el primer nivel hasta `id`, o null.
   */
  function findGuidePath(groups, id) {
    if (!Array.isArray(groups)) {
      return null;
    }
    for (const group of groups) {
      if (!group) {
        continue;
      }
      if (group.id === id) {
        return [id];
      }
      const inner = findGuidePath(getSubgroups(group), id);
      if (inner) {
        return [group.id, ...inner];
      }
    }
    return null;
  }

  /**
   * @param {Array<Object>} groups Grupos guardados.
   * @param {string} id Id del grupo.
   * @returns {(Object|null)} El grupo, o null si no existe.
   */
  function findGroup(groups, id) {
    const path = findGuidePath(groups, id);
    if (!path) {
      return null;
    }
    let level = groups;
    let found = null;
    for (const step of path) {
      found = level.find((group) => group && group.id === step);
      level = getSubgroups(found);
    }
    return found;
  }

  /**
   * Decide dónde crea el botón de crear según la selección y la columna.
   *
   * @param {Array<Object>} groups Grupos guardados.
   * @param {*} path Ruta actual de la guía.
   * @param {*} selection Claves de la selección activa.
   * @returns {{parentId: (string|null), parentName: (string|null),
   *   label: string, ariaLabel: (string|null)}}
   */
  function getCreateTarget(groups, path, selection) {
    const anchors = (Array.isArray(selection) ? selection : [])
      .filter((key) => typeof key === "string" && key.startsWith("group:"))
      .map((key) => findGroup(groups, key.slice("group:".length)))
      .filter(Boolean);
    if (anchors.length > 0) {
      const anchor = anchors[anchors.length - 1];
      const suffix = anchors.length > 1 ? " (último seleccionado)" : "";
      return {
        parentId: anchor.id,
        parentName: anchor.name,
        label: `+ Crear subgrupo en «${anchor.name}»${suffix}`,
        ariaLabel: `Crear subgrupo en ${anchor.name}`,
      };
    }
    const column = getGuideColumn(groups, path);
    if (column.parent) {
      return {
        parentId: column.parent.id,
        parentName: column.parent.name,
        label: `+ Crear subgrupo en «${column.parent.name}»`,
        ariaLabel: `Crear subgrupo en ${column.parent.name}`,
      };
    }
    return {
      parentId: null,
      parentName: null,
      label: "+ Crear grupo",
      ariaLabel: null,
    };
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
   * @param {string[]} selection Claves de la selección activa.
   * @returns {boolean}
   */
  function isChannelListOpen(overrides, item, depth, selection) {
    if (overrides && overrides.has(item.id)) {
      return Boolean(overrides.get(item.id));
    }
    if (
      Array.isArray(selection) &&
      item.channels.some((channel) =>
        selection.includes(
          YouTubeGroupsFilter.getFilterKey({
            type: "channel",
            containerId: item.id,
            url: channel.url,
          }),
        ),
      )
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
    findGuidePath,
    getCreateTarget,
    isChannelListOpen,
    findGuideInsertionIndex,
  };
})();
