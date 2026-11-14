const YouTubeGroupsWatched = (() => {
  const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

  /**
   * Indica si un valor es un ID de vídeo válido (11 caracteres de YouTube).
   *
   * @param {*} value - Valor a comprobar.
   * @returns {boolean}
   */
  function isValidVideoId(value) {
    return typeof value === "string" && VIDEO_ID_PATTERN.test(value);
  }

  /**
   * Extrae el ID de un vídeo de una URL de /watch?v=<id> o /shorts/<id> del mismo origen.
   *
   * @param {string} href - La URL (absoluta o relativa).
   * @returns {string|null} El ID de 11 caracteres o null si no es un vídeo válido.
   */
  function extractVideoId(href) {
    let url;
    try {
      url = new URL(href, window.location.origin);
    } catch {
      return null;
    }

    if (url.origin !== window.location.origin) {
      return null;
    }

    let candidate = null;
    if (url.pathname === "/watch") {
      candidate = url.searchParams.get("v");
    } else {
      const match = url.pathname.match(/^\/shorts\/([^/]+)\/?$/);
      candidate = match ? match[1] : null;
    }

    return isValidVideoId(candidate) ? candidate : null;
  }

  /**
   * Indica si un vídeo está en el mapa de vistos.
   *
   * @param {Object} videos - Mapa ID de vídeo -> entrada.
   * @param {string} videoId - ID del vídeo.
   * @returns {boolean}
   */
  function isVideoWatched(videos, videoId) {
    return Boolean(videos) && Object.hasOwn(videos, videoId);
  }

  /**
   * Marca o desmarca un vídeo sin mutar el mapa recibido.
   *
   * @param {Object} videos - Mapa ID de vídeo -> entrada.
   * @param {string} videoId - ID del vídeo.
   * @param {boolean} isWatched - Estado deseado.
   * @param {number} now - Marca de tiempo para `watchedAt`.
   * @returns {{videos: Object, changed: boolean}}
   */
  function applyVideoWatched(videos, videoId, isWatched, now) {
    if (!isValidVideoId(videoId)) {
      throw new Error("Vídeo inválido.");
    }

    const alreadyWatched = isVideoWatched(videos, videoId);
    const next = { ...videos };

    if (isWatched) {
      if (alreadyWatched) {
        return { videos: next, changed: false };
      }
      next[videoId] = { watchedAt: now };
      return { videos: next, changed: true };
    }

    if (!alreadyWatched) {
      return { videos: next, changed: false };
    }
    delete next[videoId];
    return { videos: next, changed: true };
  }

  /**
   * Lee los vistos, aplica el cambio y escribe solo si hubo cambio.
   *
   * @param {string} videoId - ID del vídeo.
   * @param {boolean} isWatched - Estado deseado.
   * @returns {Promise<{videos: Object, changed: boolean}>}
   */
  async function setVideoWatched(videoId, isWatched) {
    return YouTubeGroupsStorage.withLock(
      YouTubeGroupsStorage.KEYS.watched,
      async () => {
        const videos = await YouTubeGroupsStorage.getWatchedVideos();
        const result = applyVideoWatched(
          videos,
          videoId,
          isWatched,
          Date.now(),
        );

        if (result.changed) {
          await YouTubeGroupsStorage.saveWatchedVideos(result.videos);
        }

        return result;
      },
    );
  }

  /**
   * Indica si la reproducción ha alcanzado el porcentaje para marcar como visto.
   *
   * @param {number} currentTime - Posición actual en segundos.
   * @param {number} duration - Duración en segundos (Infinity en directos).
   * @param {number} percent - Porcentaje de umbral; 0 desactiva el marcado.
   * @returns {boolean}
   */
  function shouldAutoMark(currentTime, duration, percent) {
    return (
      percent > 0 &&
      Number.isFinite(duration) &&
      duration > 0 &&
      Number.isFinite(currentTime) &&
      currentTime >= (duration * percent) / 100
    );
  }

  /**
   * Actualiza el ID "armado" para el marcado automático: se arma un vídeo
   * cuando se ha visto su reproducción cerca del inicio (`currentTime < 1`).
   *
   * @param {string|null} armedId - ID armado hasta ahora.
   * @param {string} videoId - ID del vídeo actual.
   * @param {number} currentTime - Posición actual en segundos.
   * @returns {string|null} `videoId` si se arma; `armedId` en otro caso.
   */
  function updateAutoMarkArm(armedId, videoId, currentTime) {
    if (Number.isFinite(currentTime) && currentTime < 1) {
      return videoId;
    }
    return armedId;
  }

  return {
    isValidVideoId,
    extractVideoId,
    shouldAutoMark,
    updateAutoMarkArm,
    isVideoWatched,
    applyVideoWatched,
    setVideoWatched,
  };
})();
