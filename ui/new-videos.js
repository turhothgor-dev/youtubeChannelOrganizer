/**
 * Recolector de vídeos nuevos por grupo (ADR 0019): anota, sin red, los vídeos
 * de las tarjetas de `/feed/subscriptions` de canales agrupados, los guarda en
 * lotes cada pocos segundos y mantiene en `ctx.state.newVideoCounts` el número
 * de vídeos nuevos de cada grupo. Se crea con `create(ctx)`; no toca el DOM al
 * crearse.
 */
const YouTubeGroupsNewVideosUi = (() => {
  const FLUSH_DELAY_MS = 2000;

  /**
   * Crea el recolector.
   * @param {Object} ctx - Contexto compartido de `content.js`; usa
   *   `ctx.state` (`activeSelection`, `watchedVideos`, `newVideoCounts`) y
   *   `ctx.guide.updateNewVideoBullets` si existe.
   * @returns {Readonly<Object>} API: `noteVideo`, `acknowledgeSelection`,
   *   `flushPending`, `setGroups`, `applyStoredValue`, `recount` y `start`.
   */
  function create(ctx) {
    const N = YouTubeGroupsNewVideos;
    const { normalizeChannelUrl, getChannelKey } = YouTubeGroups;

    let groups = null;
    let groupedKeys = null;
    let state = N.normalizeNewVideos(null);
    /** Vídeos ya anotados en esta pestaña: id -> si se anotó con edad. */
    const noted = new Map();
    /** Vídeos por guardar en el próximo volcado. */
    const pending = new Map();
    /** Reconocimientos aún no volcados: id de grupo -> ms. */
    const pendingAcks = new Map();
    let flushTimer = null;

    const isSubscriptionsPage = () =>
      YouTubeGroupsPages.getPageType(window.location.pathname) ===
      "subscriptions";

    function scheduleFlush() {
      if (flushTimer === null) {
        flushTimer = setTimeout(() => {
          flushPending();
        }, FLUSH_DELAY_MS);
      }
    }

    function isGroupedChannel(channelUrl) {
      if (groupedKeys === null) {
        return true;
      }
      try {
        const normalized = normalizeChannelUrl(channelUrl);
        return (
          normalized !== null && groupedKeys.has(getChannelKey(normalized))
        );
      } catch {
        return false;
      }
    }

    /**
     * Anota un vídeo visto en una tarjeta de suscripciones. Solo en
     * `/feed/subscriptions` y de canales agrupados; una vez por pestaña (si se
     * anotó sin edad y aún no se ha volcado, se reintenta la edad).
     * @param {string|null} videoId - Id del vídeo.
     * @param {string|undefined} channelUrl - URL del canal de la tarjeta.
     * @param {Function} getAgeSeconds - Devuelve la edad en segundos o null.
     */
    function noteVideo(videoId, channelUrl, getAgeSeconds) {
      if (!videoId || !channelUrl || !isSubscriptionsPage()) {
        return;
      }
      if (!isGroupedChannel(channelUrl)) {
        return;
      }
      const known = noted.get(videoId);
      if (known === true || (known === false && !pending.has(videoId))) {
        return;
      }
      const age = getAgeSeconds();
      const hasAge = typeof age === "number" && Number.isFinite(age);
      if (known === false) {
        if (hasAge) {
          pending.get(videoId).ageSeconds = age;
          noted.set(videoId, true);
        }
        return;
      }
      noted.set(videoId, hasAge);
      pending.set(videoId, {
        channelUrl,
        seenAt: Date.now(),
        ageSeconds: hasAge ? age : null,
      });
      scheduleFlush();
    }

    function groupIdsOf(selection) {
      const ids = [];
      for (const key of Array.isArray(selection) ? selection : []) {
        const filter = YouTubeGroupsFilter.parseFilterKey(key);
        if (filter && filter.type === "group") {
          ids.push(filter.id);
        }
      }
      return ids;
    }

    /**
     * Reconoce los grupos de una selección nueva: los pone a 0 al momento y
     * los deja pendientes para el siguiente volcado.
     * @param {string[]} selection - Selección nueva.
     */
    function acknowledgeSelection(selection) {
      const ids = groupIdsOf(selection);
      if (ids.length === 0) {
        return;
      }
      const now = Date.now();
      for (const id of ids) {
        pendingAcks.set(id, now);
      }
      state = N.acknowledgeGroups(state, ids, now);
      recount();
      scheduleFlush();
    }

    /**
     * Guarda los vídeos y reconocimientos pendientes; los errores se
     * registran sin relanzar.
     * @returns {Promise<void>}
     */
    async function flushPending() {
      if (flushTimer !== null) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      const ackIds = new Set(pendingAcks.keys());
      if (isSubscriptionsPage()) {
        for (const id of groupIdsOf(ctx.state.activeSelection)) {
          ackIds.add(id);
        }
      }
      if (pending.size === 0 && pendingAcks.size === 0) {
        return;
      }
      const batch = new Map(pending);
      const flushedAcks = new Map(pendingAcks);
      pending.clear();
      pendingAcks.clear();
      try {
        const result = await N.saveFeedBatch(batch, { ackGroupIds: ackIds });
        state = result.state;
        applyStoredValue(state);
      } catch (error) {
        // Para que se reintente con la próxima tarjeta.
        for (const id of batch.keys()) {
          noted.delete(id);
        }
        for (const [id, time] of flushedAcks) {
          if (!pendingAcks.has(id)) {
            pendingAcks.set(id, time);
          }
        }
        console.error(
          "[YouTube Groups] No se pudieron guardar vídeos nuevos",
          error,
        );
      }
    }

    function sameCounts(a, b) {
      if (a.size !== b.size) {
        return false;
      }
      for (const [id, count] of a) {
        if (b.get(id) !== count) {
          return false;
        }
      }
      return true;
    }

    /**
     * Recalcula los números por grupo; solo si cambian los guarda y avisa a
     * la guía.
     */
    function recount() {
      if (groups === null) {
        return;
      }
      const counts = N.countNewVideos(
        state,
        groups,
        ctx.state.watchedVideos ?? {},
      );
      const previous = ctx.state.newVideoCounts ?? new Map();
      if (sameCounts(previous, counts)) {
        return;
      }
      ctx.state.newVideoCounts = counts;
      ctx.guide?.updateNewVideoBullets?.();
    }

    /**
     * Aplica un valor guardado, conservando en memoria los reconocimientos
     * aún no volcados.
     * @param {*} newValue - Valor de `youtubeNewVideos`.
     */
    function applyStoredValue(newValue) {
      let next = N.normalizeNewVideos(newValue);
      for (const [id, time] of pendingAcks) {
        if (!(next.visits[id] >= time)) {
          next = N.acknowledgeGroups(next, [id], time);
        }
      }
      state = next;
      recount();
    }

    /**
     * Fija el árbol de grupos y recuenta.
     * @param {Array} newGroups - Grupos.
     */
    function setGroups(newGroups) {
      groups = Array.isArray(newGroups) ? newGroups : [];
      groupedKeys = YouTubeGroupsAvatars.getGroupedChannelKeys(groups);
      recount();
    }

    /** Lee la clave guardada y recuenta. */
    function start() {
      YouTubeGroupsStorage.getNewVideos()
        .then((value) => {
          applyStoredValue(value);
        })
        .catch((error) => {
          console.error(
            "[YouTube Groups] No se pudieron leer los vídeos nuevos",
            error,
          );
        });
    }

    return Object.freeze({
      noteVideo,
      acknowledgeSelection,
      flushPending,
      setGroups,
      applyStoredValue,
      recount,
      start,
    });
  }

  return Object.freeze({ create });
})();
