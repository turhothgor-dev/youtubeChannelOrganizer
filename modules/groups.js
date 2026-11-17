const YouTubeGroups = (() => {
  const YOUTUBE_ORIGIN = "https://www.youtube.com";

  /**
   * Normaliza una URL de canal de YouTube.
   * @param {string} href - La URL a normalizar
   * @returns {string|null} La URL normalizada o null si inválida
   */
  function normalizeChannelUrl(href) {
    const url = new URL(href, YOUTUBE_ORIGIN);
    if (url.origin !== YOUTUBE_ORIGIN) {
      return null;
    }

    const match = url.pathname.match(
      /^(\/@[^/]+|\/channel\/[^/]+|\/c\/[^/]+|\/user\/[^/]+)\/?$/,
    );

    if (!match) {
      return null;
    }

    const cleanUrl = new URL(match[1], url.origin);
    cleanUrl.search = "";
    cleanUrl.hash = "";
    return cleanUrl.href;
  }

  /**
   * Busca de forma recursiva un grupo o subgrupo por su id.
   * Recorre cada grupo y, si existe, recursa dentro de sus subgrupos.
   *
   * @param {Array<Object>} groupsArray - Lista de grupos (puede contener subgrupos anidados).
   * @param {string} id - Id del grupo o subgrupo a buscar.
   * @returns {Object|null} El grupo/susgrupo encontrado, o null si no existe.
   */
  function findGroupById(groupsArray, id) {
    for (const group of groupsArray) {
      if (group.id === id) {
        return group;
      }
      if (group.subgroups && group.subgroups.length > 0) {
        const found = findGroupById(group.subgroups, id);
        if (found) {
          return found;
        }
      }
    }
    return null;
  }

  /**
   * Ejecuta `fn` en la cola de escrituras de los grupos (ADR 0005).
   * @param {Function} fn Lectura, cálculo y escritura de los grupos.
   * @returns {Promise<*>} Resultado de `fn`.
   */
  function withGroupsLock(fn) {
    return YouTubeGroupsStorage.withLock(YouTubeGroupsStorage.KEYS.groups, fn);
  }

  /**
   * Valida el nombre de un grupo o subgrupo (2 a 80 caracteres sin espacios en los extremos).
   * @param {*} name Nombre propuesto.
   * @param {string} [kind="group"] `"group"` o `"subgroup"`; solo cambia el texto del mensaje.
   * @returns {string|null} Mensaje de error o `null` si el nombre es válido.
   */
  function validateGroupName(name, kind = "group") {
    const label = kind === "subgroup" ? "del subgrupo" : "del grupo";
    const trimmed = typeof name === "string" ? name.trim() : "";
    if (trimmed.length < 2) {
      return `El nombre ${label} debe tener al menos 2 caracteres`;
    }
    if (trimmed.length > 80) {
      return `El nombre ${label} no puede exceder 80 caracteres`;
    }
    return null;
  }

  async function createGroup(name) {
    const groupName = name.trim();
    if (!groupName) {
      throw new Error("El nombre del grupo no puede estar vacío.");
    }

    return withGroupsLock(async () => {
      const groups = await YouTubeGroupsStorage.getGroups();
      const group = {
        id: crypto.randomUUID(),
        name: groupName,
        type: "group",
        channels: [],
        subgroups: [],
        icon: YouTubeGroupsIcons.NO_ICON,
        color: YouTubeGroupsIcons.NO_COLOR,
      };

      groups.push(group);
      await YouTubeGroupsStorage.saveGroups(groups);
      return group;
    });
  }

  /**
   * Quita un grupo o subgrupo (a cualquier nivel) sin mutar la entrada.
   * @param {Array<Object>} groups - Árbol de grupos.
   * @param {string} groupId - Id del grupo a quitar.
   * @returns {{groups: Array<Object>, removedIds: string[]}} Árbol resultante y
   *   ids del grupo quitado y de todos sus descendientes.
   * @throws {Error} Si el grupo no existe.
   */
  function removeGroupById(groups, groupId) {
    const removedIds = [];

    const collectIds = (group) => {
      removedIds.push(group.id);
      for (const child of group.subgroups || []) {
        collectIds(child);
      }
    };

    const prune = (list) => {
      const result = [];
      for (const group of list) {
        if (group.id === groupId) {
          collectIds(group);
          continue;
        }
        const copy = { ...group };
        if (Array.isArray(group.subgroups)) {
          copy.subgroups = prune(group.subgroups);
        }
        result.push(copy);
      }
      return result;
    };

    const remaining = prune(groups);
    if (removedIds.length === 0) {
      throw new Error("No existe el grupo indicado.");
    }
    return { groups: remaining, removedIds };
  }

  async function deleteGroup(groupId) {
    return withGroupsLock(async () => {
      const groups = await YouTubeGroupsStorage.getGroups();
      const result = removeGroupById(groups, groupId);
      await YouTubeGroupsStorage.saveGroups(result.groups);

      // La lógica del grupo activo se gestiona en content.js
      return result.removedIds;
    });
  }

  async function renameGroup(groupId, newName) {
    return withGroupsLock(async () => {
      const groups = await YouTubeGroupsStorage.getGroups();
      // Usar búsqueda recursiva para permitir renombrar también subgrupos
      const group = findGroupById(groups, groupId);
      if (!group) {
        throw new Error("No existe el grupo indicado.");
      }

      const nameError = validateGroupName(
        newName,
        group.type === "subgroup" ? "subgroup" : "group",
      );
      if (nameError) {
        throw new Error(nameError);
      }

      group.name = newName.trim();
      await YouTubeGroupsStorage.saveGroups(groups);
      return group;
    });
  }

  async function addChannelToGroup(groupId, channel) {
    const channelName = channel?.name?.trim();
    const channelUrl = channel?.url?.trim();
    if (!channelName || !channelUrl) {
      throw new Error("El canal debe incluir nombre y URL.");
    }

    return withGroupsLock(async () => {
      const groups = await YouTubeGroupsStorage.getGroups();
      // Usar búsqueda recursiva para permitir añadir canales también a subgrupos
      const group = findGroupById(groups, groupId);
      if (!group) {
        throw new Error("No existe el grupo indicado.");
      }

      // Normalize the channel URL before storing to ensure consistency
      const normalizedUrl = normalizeChannelUrl(channelUrl);
      if (!normalizedUrl) {
        throw new Error("URL de canal inválida.");
      }

      // Verificar si el canal ya está en este grupo
      const existingChannelIndex = group.channels.findIndex(
        (item) => item.url === normalizedUrl,
      );

      if (existingChannelIndex === -1) {
        // Solo agregar si no existe
        group.channels.push({ name: channelName, url: normalizedUrl });
        await YouTubeGroupsStorage.saveGroups(groups);
      }

      return group;
    });
  }

  async function removeChannelFromGroup(groupId, channelUrl) {
    const normalizedChannelUrl = channelUrl?.trim();
    if (!normalizedChannelUrl) {
      throw new Error("La URL del canal es obligatoria.");
    }

    return withGroupsLock(async () => {
      const groups = await YouTubeGroupsStorage.getGroups();
      // Usar búsqueda recursiva para permitir eliminar canales también de subgrupos
      const group = findGroupById(groups, groupId);
      if (!group) {
        throw new Error("No existe el grupo indicado.");
      }

      // Normalize the URL for comparison
      const normalizedUrl = normalizeChannelUrl(normalizedChannelUrl);
      if (!normalizedUrl) {
        throw new Error("URL de canal inválida.");
      }

      const remainingChannels = group.channels.filter(
        (item) => item.url !== normalizedUrl,
      );
      if (remainingChannels.length !== group.channels.length) {
        group.channels = remainingChannels;
        await YouTubeGroupsStorage.saveGroups(groups);
      }

      return group;
    });
  }

  /**
   * Calcula, sin mutar la entrada, la pertenencia de un canal a los grupos y
   * subgrupos (a cualquier nivel) para que quede exactamente en los indicados.
   * @param {Array<Object>} groups - Árbol de grupos.
   * @param {{name: string, url: string}} channel - Canal a asignar.
   * @param {Iterable<string>} selectedGroupIds - Ids de los grupos marcados.
   * @returns {{groups: Array<Object>, addedGroupIds: string[], removedGroupIds: string[]}}
   */
  function applyChannelGroupSelection(groups, channel, selectedGroupIds) {
    const channelName = channel?.name?.trim();
    const channelUrl = channel?.url?.trim();
    if (!channelName || !channelUrl) {
      throw new Error("El canal debe incluir nombre y URL.");
    }

    const normalizedUrl = normalizeChannelUrl(channelUrl);
    if (!normalizedUrl) {
      throw new Error("URL de canal inválida.");
    }

    const selected = new Set(selectedGroupIds);
    const addedGroupIds = [];
    const removedGroupIds = [];

    function visit(group) {
      const copy = { ...group };
      const channels = Array.isArray(group.channels) ? group.channels : [];
      const isMember = channels.some((item) => item.url === normalizedUrl);

      if (selected.has(group.id) && !isMember) {
        copy.channels = [
          ...channels.map((item) => ({ ...item })),
          { name: channelName, url: normalizedUrl },
        ];
        addedGroupIds.push(group.id);
      } else if (!selected.has(group.id) && isMember) {
        copy.channels = channels
          .filter((item) => item.url !== normalizedUrl)
          .map((item) => ({ ...item }));
        removedGroupIds.push(group.id);
      } else {
        copy.channels = channels.map((item) => ({ ...item }));
      }

      if (Array.isArray(group.subgroups)) {
        copy.subgroups = group.subgroups.map(visit);
      }
      return copy;
    }

    return { groups: groups.map(visit), addedGroupIds, removedGroupIds };
  }

  /**
   * Deja el canal exactamente en los grupos indicados: una lectura y, si hay
   * cambios, una sola escritura.
   */
  async function setChannelGroups(channel, selectedGroupIds) {
    return withGroupsLock(async () => {
      const groups = await YouTubeGroupsStorage.getGroups();
      const result = applyChannelGroupSelection(
        groups,
        channel,
        selectedGroupIds,
      );

      if (
        result.addedGroupIds.length > 0 ||
        result.removedGroupIds.length > 0
      ) {
        await YouTubeGroupsStorage.saveGroups(result.groups);
      }

      return result;
    });
  }

  /**
   * URL de los canales de un grupo y de todos sus descendientes.
   *
   * @returns {Set<string>|null} null si el grupo no existe.
   */
  function getGroupChannelUrls(groups, groupId) {
    const group = findGroupById(groups, groupId);
    if (!group) {
      return null;
    }

    const urls = new Set();
    const collect = (item) => {
      for (const channel of item.channels || []) {
        urls.add(channel.url);
      }
      for (const child of item.subgroups || []) {
        collect(child);
      }
    };
    collect(group);
    return urls;
  }

  /**
   * Índice nombre de canal (recortado) → URL con todos los canales del árbol.
   * Un nombre con dos URL distintas se excluye por ambiguo.
   * @param {Array<Object>} groups - Árbol de grupos.
   * @returns {Map<string, string>} Índice nombre → URL.
   */
  function buildChannelNameIndex(groups) {
    const index = new Map();
    const ambiguous = new Set();
    const visit = (list) => {
      for (const group of list || []) {
        for (const channel of group.channels || []) {
          const name =
            typeof channel.name === "string" ? channel.name.trim() : "";
          if (!name || typeof channel.url !== "string") {
            continue;
          }
          if (index.has(name) && index.get(name) !== channel.url) {
            ambiguous.add(name);
          } else {
            index.set(name, channel.url);
          }
        }
        visit(group.subgroups);
      }
    };
    visit(groups);
    for (const name of ambiguous) {
      index.delete(name);
    }
    return index;
  }

  /**
   * Busca el canal cuyos nombres aparecen exactamente en los textos dados.
   * @param {Map<string, string>} index - Índice de `buildChannelNameIndex`.
   * @param {string[]} texts - Textos de la tarjeta.
   * @returns {{name: string, url: string}|null} El canal si todas las
   *   coincidencias apuntan a una sola URL; si no, null.
   */
  function matchChannelByTexts(index, texts) {
    let found = null;
    for (const text of texts || []) {
      const name = typeof text === "string" ? text.trim() : "";
      if (!index.has(name)) {
        continue;
      }
      const url = index.get(name);
      if (found && found.url !== url) {
        return null;
      }
      found = { name, url };
    }
    return found;
  }

  // Nueva función para verificar si un canal está en un grupo
  function isChannelInGroup(group, channelUrl) {
    return group.channels.some((item) => item.url === channelUrl);
  }

  // Nueva función para obtener todos los grupos donde está un canal
  async function getGroupsForChannel(channelUrl) {
    const groups = await YouTubeGroupsStorage.getGroups();
    return groups.filter((group) => isChannelInGroup(group, channelUrl));
  }

  // Agregar nuevas funciones para manejar subgrupos
  async function createSubGroup(parentGroupId, name) {
    const groupName = name.trim();
    if (!groupName) {
      throw new Error("El nombre del grupo no puede estar vacío.");
    }
    return withGroupsLock(async () => {
      const groups = await YouTubeGroupsStorage.getGroups();
      const parentGroup = findGroupById(groups, parentGroupId);

      if (!parentGroup) {
        throw new Error("No existe el grupo padre indicado.");
      }

      const subGroup = {
        id: crypto.randomUUID(),
        name: groupName,
        type: "subgroup",
        parentId: parentGroupId,
        channels: [],
        subgroups: [],
        icon: YouTubeGroupsIcons.NO_ICON,
        color: YouTubeGroupsIcons.NO_COLOR,
      };

      // Añadir subgrupo al grupo padre
      if (!parentGroup.subgroups) {
        parentGroup.subgroups = [];
      }
      parentGroup.subgroups.push(subGroup);

      await YouTubeGroupsStorage.saveGroups(groups);
      return subGroup;
    });
  }

  async function deleteSubGroup(subGroupId) {
    return withGroupsLock(async () => {
      const groups = await YouTubeGroupsStorage.getGroups();
      let subGroupDeleted = false;

      // Buscar y eliminar el subgrupo en cualquier nivel
      function findAndDeleteSubGroup(groupsArray) {
        for (let i = 0; i < groupsArray.length; i++) {
          const group = groupsArray[i];

          // Verificar si es el subgrupo a eliminar
          if (group.id === subGroupId) {
            groupsArray.splice(i, 1);
            subGroupDeleted = true;
            return true;
          }

          // Buscar en subgrupos anidados
          if (group.subgroups && group.subgroups.length > 0) {
            if (findAndDeleteSubGroup(group.subgroups)) {
              return true;
            }
          }
        }
        return false;
      }

      findAndDeleteSubGroup(groups);

      if (!subGroupDeleted) {
        throw new Error("No existe el subgrupo indicado.");
      }

      await YouTubeGroupsStorage.saveGroups(groups);
      return true;
    });
  }

  async function getSubGroups(groupId) {
    const groups = await YouTubeGroupsStorage.getGroups();
    const group = findGroupById(groups, groupId);

    if (!group) {
      throw new Error("No existe el grupo indicado.");
    }

    return group.subgroups || [];
  }

  // Función para obtener todos los grupos y subgrupos de forma plana
  async function getAllGroupsAndSubGroups() {
    const groups = await YouTubeGroupsStorage.getGroups();

    function flattenGroups(groupsArray, result = []) {
      for (const group of groupsArray) {
        result.push(group);
        if (group.subgroups && group.subgroups.length > 0) {
          flattenGroups(group.subgroups, result);
        }
      }
      return result;
    }

    return flattenGroups(groups);
  }

  /**
   * Actualiza el icono y color de un grupo o subgrupo en una sola operación
   * @param {string} groupId - ID del grupo o subgrupo
   * @param {string} iconId - ID del icono o "" para sin icono
   * @param {string} colorHex - Color hexadecimal o "" para heredar
   * @returns {Object} El grupo actualizado
   * @throws {Error} Si el icono o color son inválidos o el grupo no existe
   */
  async function setGroupAppearance(groupId, iconId, colorHex) {
    // Validaciones
    if (!YouTubeGroupsIcons.isValidIconId(iconId)) {
      throw new Error("Icono inválido.");
    }

    if (!YouTubeGroupsIcons.isValidColor(colorHex)) {
      throw new Error("Color inválido.");
    }

    return withGroupsLock(async () => {
      const groups = await YouTubeGroupsStorage.getGroups();
      const group = findGroupById(groups, groupId);

      if (!group) {
        throw new Error("No existe el grupo indicado.");
      }

      group.icon = iconId;
      group.color = colorHex;
      await YouTubeGroupsStorage.saveGroups(groups);
      return group;
    });
  }

  /**
   * Apariencia resultante de un grupo: el icono es el propio (sin herencia) y el
   * color es el propio o, si está vacío, el del antecesor más cercano con color.
   * @param {Array<Object>} groups - Árbol de grupos.
   * @param {string} groupId - Id del grupo o subgrupo.
   * @returns {{icon: string, color: string}|null} null si el grupo no existe.
   */
  function getGroupAppearance(groups, groupId) {
    const findPath = (list, trail) => {
      for (const group of list) {
        const current = [...trail, group];
        if (group.id === groupId) {
          return current;
        }
        const found = findPath(group.subgroups || [], current);
        if (found) {
          return found;
        }
      }
      return null;
    };

    const path = findPath(groups, []);
    if (!path) {
      return null;
    }

    const group = path[path.length - 1];
    const icon = YouTubeGroupsIcons.isValidIconId(group.icon) ? group.icon : "";

    let color = "";
    for (let i = path.length - 1; i >= 0; i--) {
      if (path[i].color) {
        color = path[i].color;
        break;
      }
    }

    return { icon: icon || "", color };
  }

  /**
   * Aplana el árbol de grupos en preorden (grupo, sus subgrupos, siguiente
   * grupo) sin mutar la entrada.
   * @param {Array<Object>} groups - Árbol de grupos.
   * @returns {Array<{id: string, name: string, level: number}>} `level` es 0
   *   para el primer nivel.
   */
  function flattenGroups(groups) {
    const result = [];
    const visit = (list, level) => {
      for (const group of list) {
        result.push({ id: group.id, name: group.name, level });
        if (Array.isArray(group.subgroups)) {
          visit(group.subgroups, level + 1);
        }
      }
    };
    visit(groups, 0);
    return result;
  }

  /**
   * Clave para detectar canales repetidos: para `/@handle`, origen más `/@` y
   * el handle decodificado en minúsculas; para el resto, la URL sin cambios.
   * @param {string} url - URL del canal.
   * @returns {string} La clave de comparación.
   */
  function getChannelKey(url) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return url;
    }
    if (!parsed.pathname.startsWith("/@")) {
      return url;
    }
    let handle = parsed.pathname.slice(2);
    try {
      handle = decodeURIComponent(handle);
    } catch {
      // Se deja el handle tal cual.
    }
    return `${parsed.origin}/@${handle.toLowerCase()}`;
  }

  /**
   * Indica si una URL guardada no es válida (no es cadena o no está normalizada).
   * @param {*} url - Valor guardado.
   * @returns {boolean} true si no es válida.
   */
  function isInvalidChannelUrl(url) {
    if (typeof url !== "string") {
      return true;
    }
    try {
      return normalizeChannelUrl(url) !== url;
    } catch {
      return true;
    }
  }

  /**
   * Devuelve la URL corregida de una URL guardada recuperable.
   * @param {*} url - Valor guardado.
   * @returns {string|null} La URL normalizada, o null si no es recuperable.
   */
  function getFixedChannelUrl(url) {
    if (typeof url !== "string") {
      return null;
    }
    try {
      return normalizeChannelUrl(url) || null;
    } catch {
      return null;
    }
  }

  /**
   * Indica si un grupo no tiene canales en todo su subárbol.
   * @param {Object} group - Grupo o subgrupo.
   * @returns {boolean} true si está vacío.
   */
  function isEmptyGroup(group) {
    const channels = Array.isArray(group.channels) ? group.channels : [];
    const subgroups = Array.isArray(group.subgroups) ? group.subgroups : [];
    return channels.length === 0 && subgroups.every(isEmptyGroup);
  }

  /**
   * Analiza el árbol y busca canales repetidos, URL no válidas y grupos vacíos.
   * No muta la entrada.
   * @param {Array<Object>} groups - Árbol de grupos.
   * @returns {{
   *   duplicates: Array<{groupId: string, groupName: string, name: string, url: string, keptUrl: string}>,
   *   invalid: Array<{groupId: string, groupName: string, name: string, url: *, fixedUrl: string|null}>,
   *   emptyGroups: Array<{id: string, name: string}>
   * }} Resultado del análisis.
   */
  function analyzeGroups(groups) {
    const duplicates = [];
    const invalid = [];
    const emptyGroups = [];

    const visit = (list) => {
      for (const group of list) {
        if (isEmptyGroup(group)) {
          emptyGroups.push({ id: group.id, name: group.name });
          continue;
        }
        const seen = new Map();
        for (const channel of Array.isArray(group.channels)
          ? group.channels
          : []) {
          if (isInvalidChannelUrl(channel.url)) {
            invalid.push({
              groupId: group.id,
              groupName: group.name,
              name: channel.name,
              url: channel.url,
              fixedUrl: getFixedChannelUrl(channel.url),
            });
            continue;
          }
          const key = getChannelKey(channel.url);
          if (seen.has(key)) {
            duplicates.push({
              groupId: group.id,
              groupName: group.name,
              name: channel.name,
              url: channel.url,
              keptUrl: seen.get(key),
            });
          } else {
            seen.set(key, channel.url);
          }
        }
        visit(Array.isArray(group.subgroups) ? group.subgroups : []);
      }
    };
    visit(groups);

    return { duplicates, invalid, emptyGroups };
  }

  /**
   * Aplica las limpiezas elegidas sin mutar la entrada. Primero quita canales
   * y después los grupos que quedan vacíos.
   * @param {Array<Object>} groups - Árbol de grupos.
   * @param {{duplicates?: boolean, invalid?: boolean, emptyGroups?: boolean}} options
   *   Qué limpiezas aplicar.
   * @returns {{groups: Array<Object>, changed: boolean, removedGroupIds: string[]}}
   *   Árbol limpio, si hubo cambios y ids de los grupos eliminados (con su subárbol).
   */
  function applyCleanup(groups, options = {}) {
    const { duplicates, invalid, emptyGroups } = options;
    const removedGroupIds = [];
    let changed = false;

    const collectIds = (group) => {
      removedGroupIds.push(group.id);
      for (const sub of group.subgroups || []) {
        collectIds(sub);
      }
    };

    const clean = (list) =>
      list.map((group) => {
        const copy = { ...group };
        if (Array.isArray(group.channels)) {
          const seen = new Set();
          const validKeys = new Set();
          const fixedKeys = new Set();
          for (const channel of group.channels) {
            if (!isInvalidChannelUrl(channel.url)) {
              validKeys.add(getChannelKey(channel.url));
            }
          }
          copy.channels = [];
          for (const channel of group.channels) {
            if (invalid && isInvalidChannelUrl(channel.url)) {
              changed = true;
              const fixedUrl = getFixedChannelUrl(channel.url);
              if (fixedUrl === null) {
                continue;
              }
              const fixedKey = getChannelKey(fixedUrl);
              if (validKeys.has(fixedKey) || fixedKeys.has(fixedKey)) {
                continue;
              }
              fixedKeys.add(fixedKey);
              copy.channels.push({ ...channel, url: fixedUrl });
              continue;
            }
            if (duplicates && !isInvalidChannelUrl(channel.url)) {
              const key = getChannelKey(channel.url);
              if (seen.has(key)) {
                changed = true;
                continue;
              }
              seen.add(key);
            }
            copy.channels.push({ ...channel });
          }
        }
        if (Array.isArray(group.subgroups)) {
          copy.subgroups = clean(group.subgroups);
        }
        return copy;
      });

    const prune = (list) => {
      const kept = [];
      for (const group of list) {
        if (isEmptyGroup(group)) {
          collectIds(group);
          changed = true;
          continue;
        }
        if (Array.isArray(group.subgroups)) {
          group.subgroups = prune(group.subgroups);
        }
        kept.push(group);
      }
      return kept;
    };

    let result = clean(groups);
    if (emptyGroups) {
      result = prune(result);
    }
    return { groups: result, changed, removedGroupIds };
  }

  /**
   * Aplica la limpieza elegida sobre los grupos guardados, en una sola
   * escritura y solo si hay cambios.
   * @param {{duplicates?: boolean, invalid?: boolean, emptyGroups?: boolean}} options
   *   Qué limpiezas aplicar.
   * @returns {Promise<{changed: boolean, removedGroupIds: string[]}>} Resultado.
   */
  async function cleanupGroups(options = {}) {
    return withGroupsLock(async () => {
      const groups = await YouTubeGroupsStorage.getGroups();
      const result = applyCleanup(groups, options);
      if (result.changed) {
        await YouTubeGroupsStorage.saveGroups(result.groups);
      }
      return {
        changed: result.changed,
        removedGroupIds: result.removedGroupIds,
      };
    });
  }

  return {
    normalizeChannelUrl,
    getChannelKey,
    analyzeGroups,
    applyCleanup,
    cleanupGroups,
    flattenGroups,
    getGroupAppearance,
    validateGroupName,
    createGroup,
    removeGroupById,
    deleteGroup,
    renameGroup,
    addChannelToGroup,
    removeChannelFromGroup,
    applyChannelGroupSelection,
    setChannelGroups,
    getGroupChannelUrls,
    buildChannelNameIndex,
    matchChannelByTexts,
    createSubGroup, // Nueva función
    deleteSubGroup, // Nueva función
    getSubGroups, // Nueva función
    getAllGroupsAndSubGroups, // Nueva función
    setGroupAppearance, // Nueva función añadida
  };
})();
