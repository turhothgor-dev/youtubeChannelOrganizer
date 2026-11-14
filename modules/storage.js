const YouTubeGroupsStorage = (() => {
  const STORAGE_KEY = "youtubeGroups";
  const WATCHED_KEY = "youtubeWatched";
  const SETTINGS_KEY = "youtubeSettings";
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

  /**
   * Lee los ajustes guardados (ADR 0003). Sin datos válidos devuelve {} y no escribe.
   * @returns {Promise<Object>} Objeto de ajustes tal como se guardó.
   */
  async function getSettings() {
    const stored = await browser.storage.local.get(SETTINGS_KEY);
    const data = stored[SETTINGS_KEY];

    if (!data || !isPlainObject(data.settings)) {
      return {};
    }

    return data.settings;
  }

  /**
   * Guarda los ajustes con el formato versión 1 (ADR 0003).
   * @param {Object} settings Objeto de ajustes.
   */
  async function saveSettings(settings) {
    if (!isPlainObject(settings)) {
      throw new TypeError("Los ajustes deben ser un objeto.");
    }

    await browser.storage.local.set({
      [SETTINGS_KEY]: {
        version: 1,
        settings,
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
    getSettings,
    saveSettings,
  };
})();
