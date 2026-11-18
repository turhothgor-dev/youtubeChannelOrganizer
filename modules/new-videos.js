/**
 * Lógica pura de los vídeos nuevos por grupo (ADR 0019). Sin DOM.
 * Se carga tras subscriptions.js (usa groups.js, avatars.js y storage.js).
 */
const YouTubeGroupsNewVideos = (() => {
  const VIDEO_ID_PATTERN = /^[\w-]{11}$/;
  const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
  const MAX_VIDEOS = 1000;

  function isPlainObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  /** Clave de canal de una URL (normalizada o no), o null si no es de un canal. */
  function toChannelKey(url) {
    if (typeof url !== "string") {
      return null;
    }
    try {
      const normalized = YouTubeGroups.normalizeChannelUrl(url);
      return normalized ? YouTubeGroups.getChannelKey(normalized) : null;
    } catch {
      return null;
    }
  }

  function isChannelKey(value) {
    return toChannelKey(value) === value;
  }

  function isValidVideo(id, entry) {
    return (
      VIDEO_ID_PATTERN.test(id) &&
      isPlainObject(entry) &&
      isChannelKey(entry.channel) &&
      isFiniteNumber(entry.seenAt) &&
      (entry.publishedBefore === null || isFiniteNumber(entry.publishedBefore))
    );
  }

  /**
   * Descarta lo no válido de un estado guardado.
   * @param {*} value Valor guardado bajo `youtubeNewVideos`.
   * @returns {{since: (number|null), videos: Object, visits: Object}} Copia limpia.
   */
  function normalizeNewVideos(value) {
    const source = isPlainObject(value) ? value : {};
    const videos = {};
    const visits = {};

    if (isPlainObject(source.videos)) {
      for (const [id, entry] of Object.entries(source.videos)) {
        if (isValidVideo(id, entry)) {
          videos[id] = {
            channel: entry.channel,
            seenAt: entry.seenAt,
            publishedBefore: entry.publishedBefore,
          };
        }
      }
    }
    if (isPlainObject(source.visits)) {
      for (const [groupId, time] of Object.entries(source.visits)) {
        if (isFiniteNumber(time)) {
          visits[groupId] = time;
        }
      }
    }

    return {
      since: isFiniteNumber(source.since) ? source.since : null,
      videos,
      visits,
    };
  }

  /**
   * Aplica un lote de vídeos observados y reconocimientos. No muta la entrada.
   * @param {*} stored Estado guardado.
   * @param {Map<string, {channelUrl: string, seenAt: number, ageSeconds: (number|null)}>} batch
   * @param {{now: number, ackGroupIds?: Iterable<string>, groups: Array}} options
   * @returns {{state: Object, changed: boolean}}
   */
  function applyFeedBatch(
    stored,
    batch,
    { now, ackGroupIds = [], groups = [] } = {},
  ) {
    const before = normalizeNewVideos(stored);
    const state = normalizeNewVideos(stored);
    const groupedKeys = YouTubeGroupsAvatars.getGroupedChannelKeys(groups);
    const groupIds = new Set(
      YouTubeGroups.flattenGroups(groups).map((g) => g.id),
    );

    if (state.since === null) {
      state.since = now;
    }

    const entries =
      batch && typeof batch.entries === "function" ? [...batch.entries()] : [];
    for (const [id, item] of entries) {
      if (!VIDEO_ID_PATTERN.test(id) || !isPlainObject(item)) {
        continue;
      }
      const seenAt = isFiniteNumber(item.seenAt) ? item.seenAt : now;
      const hasAge = isFiniteNumber(item.ageSeconds) && item.ageSeconds >= 0;
      const publishedBefore = hasAge ? seenAt - item.ageSeconds * 1000 : null;
      const existing = state.videos[id];

      if (existing) {
        if (existing.publishedBefore === null && publishedBefore !== null) {
          existing.publishedBefore = publishedBefore;
        }
        continue;
      }
      const channel = toChannelKey(item.channelUrl);
      if (channel && groupedKeys.has(channel)) {
        state.videos[id] = { channel, seenAt, publishedBefore };
      }
    }

    for (const groupId of ackGroupIds) {
      if (groupIds.has(groupId)) {
        state.visits[groupId] = now;
      }
    }

    for (const [id, entry] of Object.entries(state.videos)) {
      if (entry.seenAt < now - MAX_AGE_MS || !groupedKeys.has(entry.channel)) {
        delete state.videos[id];
      }
    }
    const ids = Object.keys(state.videos);
    if (ids.length > MAX_VIDEOS) {
      ids
        .sort(
          (a, b) =>
            state.videos[b].seenAt - state.videos[a].seenAt || (a < b ? -1 : 1),
        )
        .slice(MAX_VIDEOS)
        .forEach((id) => delete state.videos[id]);
    }
    for (const groupId of Object.keys(state.visits)) {
      if (!groupIds.has(groupId)) {
        delete state.visits[groupId];
      }
    }

    const changed = JSON.stringify(before) !== JSON.stringify(state);
    return { state, changed };
  }

  /**
   * Estado nuevo con las visitas de esos grupos a `now`. No muta la entrada.
   * @param {*} state Estado.
   * @param {Iterable<string>} groupIds Ids de grupo.
   * @param {number} now Marca de tiempo en ms.
   * @returns {{since: (number|null), videos: Object, visits: Object}}
   */
  function acknowledgeGroups(state, groupIds, now) {
    const result = normalizeNewVideos(state);
    for (const groupId of groupIds) {
      result.visits[groupId] = now;
    }
    return result;
  }

  /**
   * Vídeos nuevos por grupo (con sus subgrupos), sin red.
   * Nuevo: no visto, `seenAt > ack` y `publishedBefore` no nulo y `> ack`, con
   * `ack` la visita más reciente de los grupos cuyo subárbol contiene el
   * canal, o `since` si no hay visitas.
   * @param {*} state Estado guardado.
   * @param {Array} groups Árbol de grupos.
   * @param {Object} [watched] Mapa de vídeos vistos.
   * @returns {Map<string, number>} Id de grupo -> número (solo los > 0).
   */
  function countNewVideos(state, groups, watched = {}) {
    const { since, videos, visits } = normalizeNewVideos(state);
    const seen = isPlainObject(watched) ? watched : {};
    const counts = new Map();
    const channelAcks = new Map();
    const channelVideos = new Map();

    for (const [id, entry] of Object.entries(videos)) {
      if (!channelVideos.has(entry.channel)) {
        channelVideos.set(entry.channel, []);
      }
      channelVideos.get(entry.channel).push(id);
    }

    // Visita más reciente de los grupos cuyo subárbol contiene cada canal.
    const collect = (group, ancestors) => {
      const chain = [...ancestors, group.id];
      for (const channel of Array.isArray(group.channels)
        ? group.channels
        : []) {
        const key = YouTubeGroups.getChannelKey(channel.url);
        for (const groupId of chain) {
          if (isFiniteNumber(visits[groupId])) {
            channelAcks.set(
              key,
              Math.max(channelAcks.get(key) ?? -Infinity, visits[groupId]),
            );
          }
        }
      }
      for (const child of Array.isArray(group.subgroups)
        ? group.subgroups
        : []) {
        collect(child, chain);
      }
    };
    for (const group of Array.isArray(groups) ? groups : []) {
      collect(group, []);
    }

    const isNew = (id, entry) => {
      if (seen[id]) {
        return false;
      }
      const ack = channelAcks.get(entry.channel) ?? since ?? 0;
      // Sin edad legible (directos, estrenos, tarjetas sin fecha) no cuenta
      return (
        entry.publishedBefore !== null &&
        entry.seenAt > ack &&
        entry.publishedBefore > ack
      );
    };

    // Vídeos nuevos distintos de los canales del subárbol de cada grupo.
    const gather = (group) => {
      const ids = new Set();
      for (const channel of Array.isArray(group.channels)
        ? group.channels
        : []) {
        const key = YouTubeGroups.getChannelKey(channel.url);
        for (const id of channelVideos.get(key) || []) {
          if (isNew(id, videos[id])) {
            ids.add(id);
          }
        }
      }
      for (const child of Array.isArray(group.subgroups)
        ? group.subgroups
        : []) {
        for (const id of gather(child)) {
          ids.add(id);
        }
      }
      if (ids.size > 0) {
        counts.set(group.id, ids.size);
      }
      return ids;
    };
    for (const group of Array.isArray(groups) ? groups : []) {
      gather(group);
    }
    return counts;
  }

  /**
   * Guarda un lote de vídeos observados y reconocimientos, solo si algo cambia.
   * @param {Map} batch Ver `applyFeedBatch`.
   * @param {{ackGroupIds?: Iterable<string>}} [options]
   * @returns {Promise<{state: Object, changed: boolean}>}
   */
  function saveFeedBatch(batch, { ackGroupIds = [] } = {}) {
    const storage = YouTubeGroupsStorage;
    return storage.withLock(storage.KEYS.newVideos, async () => {
      const [stored, groups] = await Promise.all([
        storage.getNewVideos(),
        storage.getGroups(),
      ]);
      const result = applyFeedBatch(stored, batch, {
        now: Date.now(),
        ackGroupIds,
        groups,
      });
      if (result.changed) {
        await storage.saveNewVideos(result.state);
      }
      return result;
    });
  }

  return {
    normalizeNewVideos,
    applyFeedBatch,
    acknowledgeGroups,
    countNewVideos,
    saveFeedBatch,
  };
})();
