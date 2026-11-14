const YouTubeGroups = (() => {
  /**
   * Normaliza una URL de canal de YouTube.
   * @param {string} href - La URL a normalizar
   * @returns {string|null} La URL normalizada o null si inválida
   */
  function normalizeChannelUrl(href) {
    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin) {
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

  async function createGroup(name) {
    const groupName = name.trim();
    if (!groupName) {
      throw new Error("El nombre del grupo no puede estar vacío.");
    }

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
    const groups = await YouTubeGroupsStorage.getGroups();
    const result = removeGroupById(groups, groupId);
    await YouTubeGroupsStorage.saveGroups(result.groups);

    // La lógica del grupo activo se gestiona en content.js
    return result.removedIds;
  }

  async function renameGroup(groupId, newName) {
    const groups = await YouTubeGroupsStorage.getGroups();
    // Usar búsqueda recursiva para permitir renombrar también subgrupos
    const group = findGroupById(groups, groupId);
    if (!group) {
      throw new Error("No existe el grupo indicado.");
    }

    const newGroupName = newName.trim();
    if (!newGroupName) {
      throw new Error("El nombre del grupo no puede estar vacío.");
    }

    group.name = newGroupName;
    await YouTubeGroupsStorage.saveGroups(groups);
    return group;
  }

  async function addChannelToGroup(groupId, channel) {
    const channelName = channel?.name?.trim();
    const channelUrl = channel?.url?.trim();
    if (!channelName || !channelUrl) {
      throw new Error("El canal debe incluir nombre y URL.");
    }

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
  }

  async function removeChannelFromGroup(groupId, channelUrl) {
    const normalizedChannelUrl = channelUrl?.trim();
    if (!normalizedChannelUrl) {
      throw new Error("La URL del canal es obligatoria.");
    }

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
    const groups = await YouTubeGroupsStorage.getGroups();
    const result = applyChannelGroupSelection(
      groups,
      channel,
      selectedGroupIds,
    );

    if (result.addedGroupIds.length > 0 || result.removedGroupIds.length > 0) {
      await YouTubeGroupsStorage.saveGroups(result.groups);
    }

    return result;
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
  }

  async function deleteSubGroup(subGroupId) {
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

    const groups = await YouTubeGroupsStorage.getGroups();
    const group = findGroupById(groups, groupId);

    if (!group) {
      throw new Error("No existe el grupo indicado.");
    }

    group.icon = iconId;
    group.color = colorHex;
    await YouTubeGroupsStorage.saveGroups(groups);
    return group;
  }

  return {
    normalizeChannelUrl,
    createGroup,
    removeGroupById,
    deleteGroup,
    renameGroup,
    addChannelToGroup,
    removeChannelFromGroup,
    applyChannelGroupSelection,
    setChannelGroups,
    getGroupChannelUrls,
    createSubGroup, // Nueva función
    deleteSubGroup, // Nueva función
    getSubGroups, // Nueva función
    getAllGroupsAndSubGroups, // Nueva función
    setGroupAppearance, // Nueva función añadida
  };
})();
