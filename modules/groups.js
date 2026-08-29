const YouTubeGroups = (() => {
  async function createGroup(name) {
    const groupName = name.trim();
    if (!groupName) {
      throw new Error("El nombre del grupo no puede estar vacío.");
    }

    const groups = await YouTubeGroupsStorage.getGroups();
    const group = {
      id: crypto.randomUUID(),
      name: groupName,
      channels: []
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
    const group = groups.find((item) => item.id === groupId);
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
    const group = groups.find((item) => item.id === groupId);
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
    const group = groups.find((item) => item.id === groupId);
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

  return {
    createGroup,
    deleteGroup,
    renameGroup,
    addChannelToGroup,
    removeChannelFromGroup
  };
})();