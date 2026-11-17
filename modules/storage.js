const YouTubeGroupsStorage = (() => {
  /** Nombres reales de las claves de almacenamiento (ADR 0005). */
  const KEYS = Object.freeze({
    groups: "youtubeGroups",
    watched: "youtubeWatched",
    settings: "youtubeSettings",
    playlists: "youtubePlaylists",
    avatars: "youtubeAvatars",
  });
  const STORAGE_KEY = KEYS.groups;
  const WATCHED_KEY = KEYS.watched;
  const SETTINGS_KEY = KEYS.settings;
  const PLAYLISTS_KEY = KEYS.playlists;
  const AVATARS_KEY = KEYS.avatars;
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

  /**
   * Extrae los grupos de un valor guardado (o de un `newValue` de onChanged).
   * @param {*} data Valor guardado bajo la clave de grupos.
   * @returns {Array} Grupos, o [] si el formato no es válido.
   */
  function readGroupsValue(data) {
    return data && Array.isArray(data.groups) ? data.groups : [];
  }

  /**
   * Extrae el mapa de vídeos vistos de un valor guardado.
   * @param {*} data Valor guardado bajo la clave de vistos.
   * @returns {Object} Mapa de vídeos, o {} si el formato no es válido.
   */
  function readWatchedValue(data) {
    return data && isPlainObject(data.videos) ? data.videos : {};
  }

  /**
   * Extrae los ajustes de un valor guardado.
   * @param {*} data Valor guardado bajo la clave de ajustes.
   * @returns {Object} Ajustes, o {} si el formato no es válido.
   */
  function readSettingsValue(data) {
    return data && isPlainObject(data.settings) ? data.settings : {};
  }

  /**
   * Extrae las listas de un valor guardado.
   * @param {*} data Valor guardado bajo la clave de listas.
   * @returns {Array} Listas, o [] si el formato no es válido.
   */
  function readPlaylistsValue(data) {
    return data && Array.isArray(data.playlists) ? data.playlists : [];
  }

  /**
   * Extrae el mapa de avatares de un valor guardado (ADR 0016).
   * @param {*} data Valor guardado bajo la clave de avatares.
   * @returns {Object} Mapa clave de canal -> URL de imagen, o {} si el formato no es válido.
   */
  function readAvatarsValue(data) {
    return data && isPlainObject(data.avatars) ? data.avatars : {};
  }

  /**
   * Nombres lógicos de KEYS cuya clave real aparece en un evento storage.onChanged.
   * @param {Object} changes Objeto `changes` del evento.
   * @param {string} areaName Área del evento.
   * @returns {string[]} Nombres lógicos, en el orden de KEYS; [] si el área no es "local".
   */
  function getChangedKeys(changes, areaName) {
    if (areaName !== "local" || !changes) {
      return [];
    }

    return Object.keys(KEYS).filter((name) =>
      Object.prototype.hasOwnProperty.call(changes, KEYS[name]),
    );
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

    return readGroupsValue(data);
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

    return readWatchedValue(data);
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

    return readSettingsValue(data);
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

    return readPlaylistsValue(data);
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

  /**
   * Lee los avatares de canal (ADR 0016). Sin datos válidos devuelve {} y no escribe.
   * @returns {Promise<Object>} Mapa clave de canal -> URL de imagen.
   */
  async function getAvatars() {
    const stored = await browser.storage.local.get(AVATARS_KEY);

    return readAvatarsValue(stored[AVATARS_KEY]);
  }

  /**
   * Guarda los avatares de canal con el formato versión 1 (ADR 0016).
   * @param {Object} avatars Mapa clave de canal -> URL de imagen.
   */
  async function saveAvatars(avatars) {
    if (!isPlainObject(avatars)) {
      throw new TypeError("Los avatares deben ser un objeto.");
    }

    await browser.storage.local.set({
      [AVATARS_KEY]: {
        version: 1,
        avatars,
      },
    });
  }

  function isPlainObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  return {
    KEYS,
    withLock,
    readGroupsValue,
    readWatchedValue,
    readSettingsValue,
    readPlaylistsValue,
    readAvatarsValue,
    getChangedKeys,
    getGroups,
    saveGroups,
    getWatchedVideos,
    saveWatchedVideos,
    getSettings,
    saveSettings,
    getPlaylists,
    savePlaylists,
    getAvatars,
    saveAvatars,
  };
})();
