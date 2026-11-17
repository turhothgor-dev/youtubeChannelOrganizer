const YouTubeGroupsEditor = (() => {
  /**
   * Lista de hijos de un grupo (vacía si no tiene).
   * @param {Object} group - Grupo o subgrupo.
   * @returns {Array<Object>} Sus subgrupos.
   */
  function childrenOf(group) {
    return Array.isArray(group.subgroups) ? group.subgroups : [];
  }

  /**
   * Busca un grupo y su lugar en el árbol.
   * @param {Array<Object>} groups - Árbol de grupos.
   * @param {string} id - Id del grupo.
   * @returns {{group: Object, parentId: string|null, list: Array<Object>, index: number}|null}
   */
  function locate(groups, id) {
    const visit = (list, parentId) => {
      for (let index = 0; index < list.length; index++) {
        const group = list[index];
        if (group.id === id) {
          return { group, parentId, list, index };
        }
        const found = visit(childrenOf(group), group.id);
        if (found) {
          return found;
        }
      }
      return null;
    };
    return visit(groups, null);
  }

  /**
   * Indica si `id` es el propio grupo o uno de sus descendientes.
   * @param {Object} group - Grupo raíz del subárbol.
   * @param {string} id - Id a buscar.
   * @returns {boolean} true si está en el subárbol.
   */
  function subtreeContains(group, id) {
    if (group.id === id) {
      return true;
    }
    return childrenOf(group).some((child) => subtreeContains(child, id));
  }

  /**
   * Lugar actual de un grupo entre sus hermanos.
   * @param {Array<Object>} groups - Árbol de grupos.
   * @param {string} id - Id del grupo.
   * @returns {{parentId: string|null, index: number, siblingCount: number}|null}
   *   `null` si el grupo no existe.
   */
  function findGroupLocation(groups, id) {
    const found = locate(groups, id);
    if (!found) {
      return null;
    }
    return {
      parentId: found.parentId,
      index: found.index,
      siblingCount: found.list.length,
    };
  }

  /**
   * Mueve un grupo a otro lugar sin mutar la entrada.
   * @param {Array<Object>} groups - Árbol de grupos.
   * @param {string} groupId - Id del grupo a mover.
   * @param {string|null} parentId - Nuevo padre (`null` para el primer nivel).
   * @param {number} index - Posición en la lista de destino sin el grupo movido;
   *   se acota a `[0, longitud]`.
   * @returns {{groups: Array<Object>, changed: boolean}} Árbol resultante y si
   *   el grupo cambió de lugar.
   * @throws {Error} Si el grupo o el padre no existen, o si el padre es el
   *   propio grupo o un descendiente.
   */
  function moveGroup(groups, groupId, parentId, index) {
    const source = locate(groups, groupId);
    if (!source) {
      throw new Error("No existe el grupo indicado.");
    }

    const targetParentId = parentId ?? null;
    if (targetParentId !== null) {
      const parent = locate(groups, targetParentId);
      if (!parent) {
        throw new Error("No existe el grupo padre indicado.");
      }
      if (subtreeContains(source.group, targetParentId)) {
        throw new Error("No se puede mover un grupo dentro de sí mismo.");
      }
    }

    const result = structuredClone(groups);
    const moving = locate(result, groupId);
    moving.list.splice(moving.index, 1);

    let targetList = result;
    if (targetParentId !== null) {
      const parent = locate(result, targetParentId).group;
      if (!Array.isArray(parent.subgroups)) {
        parent.subgroups = [];
      }
      targetList = parent.subgroups;
    }

    const wanted = Number.isFinite(index)
      ? Math.trunc(index)
      : targetList.length;
    const clamped = Math.min(Math.max(wanted, 0), targetList.length);

    if (source.parentId === targetParentId && source.index === clamped) {
      return { groups: structuredClone(groups), changed: false };
    }

    const moved = moving.group;
    if (targetParentId === null) {
      moved.type = "group";
      delete moved.parentId;
    } else {
      moved.type = "subgroup";
      moved.parentId = targetParentId;
    }
    targetList.splice(clamped, 0, moved);

    return { groups: result, changed: true };
  }

  /**
   * Lugar para subir o bajar un grupo entre sus hermanos.
   * @param {Array<Object>} groups - Árbol de grupos.
   * @param {string} groupId - Id del grupo.
   * @param {number} delta - `-1` para subir, `1` para bajar.
   * @returns {{parentId: string|null, index: number}|null} `null` en los
   *   extremos o si el grupo no existe.
   */
  function getSiblingMove(groups, groupId, delta) {
    const location = findGroupLocation(groups, groupId);
    if (!location) {
      return null;
    }
    const index = location.index + delta;
    if (index < 0 || index >= location.siblingCount) {
      return null;
    }
    return { parentId: location.parentId, index };
  }

  /**
   * Destinos posibles para "Mover a…": primer nivel y el árbol en preorden
   * sin el grupo ni sus descendientes.
   * @param {Array<Object>} groups - Árbol de grupos.
   * @param {string} groupId - Id del grupo a mover.
   * @returns {Array<{id: string|null, name: string, level: number, current: boolean}>}
   *   `current` marca el padre actual.
   */
  function getMoveTargets(groups, groupId) {
    const source = locate(groups, groupId);
    if (!source) {
      return [];
    }

    const targets = [
      {
        id: null,
        name: "Primer nivel",
        level: 0,
        current: source.parentId === null,
      },
    ];
    const visit = (list, level) => {
      for (const group of list) {
        if (group.id === groupId) {
          continue;
        }
        targets.push({
          id: group.id,
          name: group.name,
          level,
          current: source.parentId === group.id,
        });
        visit(childrenOf(group), level + 1);
      }
    };
    visit(groups, 1);
    return targets;
  }

  /**
   * Lugar resultante de soltar un grupo arrastrado sobre otro.
   * @param {Array<Object>} groups - Árbol de grupos.
   * @param {string} draggedId - Id del grupo arrastrado.
   * @param {string} targetId - Id del grupo sobre el que se suelta.
   * @param {"before"|"after"|"inside"} zone - Zona de la suelta; `"inside"` lo
   *   deja como último hijo del destino.
   * @returns {{parentId: string|null, index: number}|null} `null` si el destino
   *   es el propio grupo o un descendiente, o alguno no existe.
   */
  function getDropPosition(groups, draggedId, targetId, zone) {
    const dragged = locate(groups, draggedId);
    const target = locate(groups, targetId);
    if (!dragged || !target || subtreeContains(dragged.group, targetId)) {
      return null;
    }

    const draggedInTargetList = (list) => list === dragged.list;

    if (zone === "inside") {
      const children = childrenOf(target.group);
      const count = children.some((child) => child.id === draggedId)
        ? children.length - 1
        : children.length;
      return { parentId: targetId, index: count };
    }

    if (zone !== "before" && zone !== "after") {
      return null;
    }

    let index = target.index;
    if (draggedInTargetList(target.list) && dragged.index < target.index) {
      index -= 1;
    }
    if (zone === "after") {
      index += 1;
    }
    return { parentId: target.parentId, index };
  }

  /**
   * Mueve un grupo y guarda: una lectura y, si cambia de lugar, una escritura.
   * @param {string} groupId - Id del grupo a mover.
   * @param {string|null} parentId - Nuevo padre (`null` para el primer nivel).
   * @param {number} index - Posición en la lista de destino sin el grupo.
   * @returns {Promise<{changed: boolean}>} Si hubo cambio.
   */
  async function moveGroupAndSave(groupId, parentId, index) {
    return YouTubeGroupsStorage.withLock(
      YouTubeGroupsStorage.KEYS.groups,
      async () => {
        const groups = await YouTubeGroupsStorage.getGroups();
        const result = moveGroup(groups, groupId, parentId, index);
        if (result.changed) {
          await YouTubeGroupsStorage.saveGroups(result.groups);
        }
        return { changed: result.changed };
      },
    );
  }

  /**
   * Cuenta los subgrupos y los canales distintos de un subárbol.
   * @param {Array<Object>} groups - Árbol de grupos.
   * @param {string} id - Id del grupo raíz del subárbol.
   * @returns {{subgroups: number, channels: number}|null} `subgroups` son los
   *   descendientes (sin el propio grupo) y `channels` los canales distintos
   *   de todo el subárbol; `null` si el grupo no existe.
   */
  function summarizeSubtree(groups, id) {
    const found = locate(groups, id);
    if (!found) {
      return null;
    }
    const keys = new Set();
    let subgroups = 0;
    const visit = (group, isRoot) => {
      if (!isRoot) {
        subgroups += 1;
      }
      for (const channel of Array.isArray(group.channels)
        ? group.channels
        : []) {
        keys.add(YouTubeGroups.getChannelKey(channel.url));
      }
      for (const child of childrenOf(group)) {
        visit(child, false);
      }
    };
    visit(found.group, true);
    return { subgroups, channels: keys.size };
  }

  /**
   * Recoge los ids de un subárbol.
   * @param {Object} group - Raíz del subárbol.
   * @returns {Array<string>} Ids en preorden.
   */
  function collectIds(group) {
    return [group.id, ...childrenOf(group).flatMap(collectIds)];
  }

  /**
   * Quita un grupo con todo su subárbol y devuelve una instantánea para
   * restaurarlo, sin mutar la entrada.
   * @param {Array<Object>} groups - Árbol de grupos.
   * @param {string} id - Id del grupo a borrar.
   * @returns {{groups: Array<Object>, removedIds: Array<string>,
   *   snapshot: {group: Object, parentId: string|null, index: number}}}
   * @throws {Error} Si el grupo no existe.
   */
  function removeGroupWithSnapshot(groups, id) {
    const found = locate(groups, id);
    if (!found) {
      throw new Error("No existe el grupo indicado.");
    }
    const snapshot = {
      group: structuredClone(found.group),
      parentId: found.parentId,
      index: found.index,
    };
    const result = structuredClone(groups);
    const target = locate(result, id);
    target.list.splice(target.index, 1);
    return { groups: result, removedIds: collectIds(found.group), snapshot };
  }

  /**
   * Devuelve a su sitio un subárbol borrado, sin mutar la entrada.
   * @param {Array<Object>} groups - Árbol de grupos actual.
   * @param {{group: Object, parentId: string|null, index: number}} snapshot -
   *   Instantánea de `removeGroupWithSnapshot`.
   * @returns {{groups: Array<Object>, restored: boolean, atRoot: boolean}}
   *   `restored` es `false` si algún id ya existe; `atRoot` es `true` si el
   *   padre ya no existe y se añade al final del primer nivel.
   */
  function restoreGroup(groups, snapshot) {
    const restoredGroup = structuredClone(snapshot.group);
    if (collectIds(restoredGroup).some((id) => locate(groups, id))) {
      return {
        groups: structuredClone(groups),
        restored: false,
        atRoot: false,
      };
    }

    const result = structuredClone(groups);
    const parent =
      snapshot.parentId === null ? null : locate(result, snapshot.parentId);

    if (snapshot.parentId !== null && parent) {
      if (!Array.isArray(parent.group.subgroups)) {
        parent.group.subgroups = [];
      }
      const list = parent.group.subgroups;
      restoredGroup.type = "subgroup";
      restoredGroup.parentId = snapshot.parentId;
      list.splice(
        Math.min(Math.max(snapshot.index, 0), list.length),
        0,
        restoredGroup,
      );
      return { groups: result, restored: true, atRoot: false };
    }

    restoredGroup.type = "group";
    delete restoredGroup.parentId;
    if (snapshot.parentId === null) {
      result.splice(
        Math.min(Math.max(snapshot.index, 0), result.length),
        0,
        restoredGroup,
      );
      return { groups: result, restored: true, atRoot: false };
    }
    result.push(restoredGroup);
    return { groups: result, restored: true, atRoot: true };
  }

  /**
   * Borra un grupo y guarda: una lectura y una escritura.
   * @param {string} id - Id del grupo a borrar.
   * @returns {Promise<{removedIds: Array<string>, snapshot: Object,
   *   summary: {subgroups: number, channels: number}}>}
   * @throws {Error} Si el grupo no existe (no escribe).
   */
  async function deleteGroupAndSnapshot(id) {
    return YouTubeGroupsStorage.withLock(
      YouTubeGroupsStorage.KEYS.groups,
      async () => {
        const groups = await YouTubeGroupsStorage.getGroups();
        const summary = summarizeSubtree(groups, id);
        const result = removeGroupWithSnapshot(groups, id);
        await YouTubeGroupsStorage.saveGroups(result.groups);
        return {
          removedIds: result.removedIds,
          snapshot: result.snapshot,
          summary,
        };
      },
    );
  }

  /**
   * Restaura un grupo borrado y guarda; no escribe si ya estaba restaurado.
   * @param {{group: Object, parentId: string|null, index: number}} snapshot -
   *   Instantánea de `deleteGroupAndSnapshot`.
   * @returns {Promise<{restored: boolean, atRoot: boolean}>}
   */
  async function restoreGroupAndSave(snapshot) {
    return YouTubeGroupsStorage.withLock(
      YouTubeGroupsStorage.KEYS.groups,
      async () => {
        const groups = await YouTubeGroupsStorage.getGroups();
        const result = restoreGroup(groups, snapshot);
        if (result.restored) {
          await YouTubeGroupsStorage.saveGroups(result.groups);
        }
        return { restored: result.restored, atRoot: result.atRoot };
      },
    );
  }

  return {
    findGroupLocation,
    moveGroup,
    getSiblingMove,
    getMoveTargets,
    getDropPosition,
    moveGroupAndSave,
    summarizeSubtree,
    removeGroupWithSnapshot,
    restoreGroup,
    deleteGroupAndSnapshot,
    restoreGroupAndSave,
  };
})();
