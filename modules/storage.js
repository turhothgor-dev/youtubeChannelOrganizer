const YouTubeGroupsStorage = (() => {
  /** Nombres reales de las claves de almacenamiento (ADR 0005). */
  const KEYS = Object.freeze({
    groups: "youtubeGroups",
    watched: "youtubeWatched",
    settings: "youtubeSettings",
    playlists: "youtubePlaylists",
  });
  const STORAGE_KEY = KEYS.groups;
  const WATCHED_KEY = KEYS.watched;
  const SETTINGS_KEY = KEYS.settings;
  const PLAYLISTS_KEY = KEYS.playlists;
  let groupsInitializationPromise = null;
  const lockQueues = new Map();

  /**
   * Ejecuta `fn` cuando han terminado todas las llamadas anteriores con la misma clave (cola FIFO, ADR 0005).
   * Un error de `fn` rechaza la promesa devuelta y no bloquea la cola. No es reentrante.
   * @param {string} key Clave de la cola (normalmente un valor de KEYS).
   * @param {Function} fn Función síncrona o asíncrona.
   * @returns {Promise<*>} Resultado de `fn`.
   */
  function withLock(key, fn) {
    const previous = lockQueues.get(key) || Promise.resolve();
    const run = previous.then(() => fn());
    const tail = run.then(
      () => undefined,
      () => undefined,
    );

    lockQueues.set(key, tail);
    tail.then(() => {
      if (lockQueues.get(key) === tail) {
        lockQueues.delete(key);
      }
    });

    return run;
  }

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

  /**
   * Lee las listas de vídeos (ADR 0004). Sin datos válidos devuelve [] y no escribe.
   * @returns {Promise<Array>} Listas tal como se guardaron.
   */
  async function getPlaylists() {
    const stored = await browser.storage.local.get(PLAYLISTS_KEY);
    const data = stored[PLAYLISTS_KEY];

    if (!data || !Array.isArray(data.playlists)) {
      return [];
    }

    return data.playlists;
  }

  /**
   * Guarda las listas de vídeos con el formato versión 1 (ADR 0004).
   * @param {Array} playlists Listas con sus vídeos.
   */
  async function savePlaylists(playlists) {
    if (!Array.isArray(playlists)) {
      throw new TypeError("Las listas deben ser un array.");
    }

    await browser.storage.local.set({
      [PLAYLISTS_KEY]: {
        version: 1,
        playlists,
      },
    });
  }

  function isPlainObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  return {
    KEYS,
    withLock,
    getGroups,
    saveGroups,
    getWatchedVideos,
    saveWatchedVideos,
    getSettings,
    saveSettings,
    getPlaylists,
    savePlaylists,
  };
})();
