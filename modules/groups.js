const YouTubeGroups = (() => {
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
      subgroups: []
  };

    groups.push(group);
    await YouTubeGroupsStorage.saveGroups(groups);
    return group;
  }

  async function deleteGroup(groupId) {
    const groups = await YouTubeGroupsStorage.getGroups();
    const groupIndex = groups.findIndex((item) => item.id === groupId);

    if (groupIndex === -1) {
      throw new Error("No existe el grupo indicado.");
    }

    // Remove the group
    groups.splice(groupIndex, 1);
    await YouTubeGroupsStorage.saveGroups(groups);

    // Note: Active group logic is handled in content.js
    return true;
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

    // Verificar si el canal ya está en este grupo
    const existingChannelIndex = group.channels.findIndex((item) => item.url === channelUrl);

    if (existingChannelIndex === -1) {
      // Solo agregar si no existe
      group.channels.push({ name: channelName, url: channelUrl });
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

    const remainingChannels = group.channels.filter((item) => item.url !== normalizedChannelUrl);
    if (remainingChannels.length !== group.channels.length) {
      group.channels = remainingChannels;
      await YouTubeGroupsStorage.saveGroups(groups);
    }

    return group;
  }

  // Nueva función para verificar si un canal está en un grupo
  function isChannelInGroup(group, channelUrl) {
    return group.channels.some((item) => item.url === channelUrl);
  }

  // Nueva función para obtener todos los grupos donde está un canal
  async function getGroupsForChannel(channelUrl) {
    const groups = await YouTubeGroupsStorage.getGroups();
    return groups.filter(group => isChannelInGroup(group, channelUrl));
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
      subgroups: []
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

  return {
    createGroup,
    deleteGroup,
    renameGroup,
    addChannelToGroup,
    removeChannelFromGroup,
    createSubGroup,  // Nueva función
    deleteSubGroup,  // Nueva función
    getSubGroups,    // Nueva función
    getAllGroupsAndSubGroups  // Nueva función
  };
})();