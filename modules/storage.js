const YouTubeGroupsStorage = (() => {
  const STORAGE_KEY = "youtubeGroups";
  const WATCHED_KEY = "youtubeWatched";
  let groupsInitializationPromise = null;

  async function getGroups() {
    const stored = await browser.storage.local.get(STORAGE_KEY);
    const data = stored[STORAGE_KEY];

    if (!data || !Array.isArray(data.groups)) {
      if (!groupsInitializationPromise) {
        const emptyGroups = [];
        groupsInitializationPromise = saveGroups(emptyGroups)
          .then(() => emptyGroups)
          .finally(() => {
            groupsInitializationPromise = null;
          });
      }

      return groupsInitializationPromise;
    }

    return data.groups;
  }

  async function saveGroups(groups) {
    if (!Array.isArray(groups)) {
      throw new TypeError("Los grupos deben ser un array.");
    }

    await browser.storage.local.set({
      [STORAGE_KEY]: {
        version: 1,
        groups,
      },
    });
  }

  /**
   * Lee el mapa de vídeos vistos (ADR 0002). Sin datos válidos devuelve {} y no escribe.
   * @returns {Promise<Object>} Mapa ID de vídeo -> entrada.
   */
  async function getWatchedVideos() {
    const stored = await browser.storage.local.get(WATCHED_KEY);
    const data = stored[WATCHED_KEY];

    if (!data || !isPlainObject(data.videos)) {
      return {};
    }

    return data.videos;
  }

  /**
   * Guarda el mapa de vídeos vistos con el formato versión 1 (ADR 0002).
   * @param {Object} videos Mapa ID de vídeo -> entrada.
   */
  async function saveWatchedVideos(videos) {
    if (!isPlainObject(videos)) {
      throw new TypeError("Los vídeos vistos deben ser un objeto.");
    }

    await browser.storage.local.set({
      [WATCHED_KEY]: {
        version: 1,
        videos,
      },
    });
  }

  function isPlainObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  return {
    getGroups,
    saveGroups,
    getWatchedVideos,
    saveWatchedVideos,
  };
})();
