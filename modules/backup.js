const YouTubeGroupsBackup = (() => {
  const FORMAT = "youtube-groups-backup";
  const VERSION = 1;
  const MAX_TEXT_LENGTH = 5000000;
  const MAX_NAME_LENGTH = 80;
  const MAX_CHANNEL_NAME_LENGTH = 100;

  /**
   * Crea el error de "fichero ajeno".
   *
   * @returns {Error}
   */
  function notBackupError() {
    return new Error("El fichero no es una copia de YouTube Groups.");
  }

  /**
   * Crea el error de estructura incorrecta.
   *
   * @param {string} what - Qué está mal.
   * @returns {Error}
   */
  function damagedError(what) {
    return new Error(`La copia está dañada: ${what}.`);
  }

  /**
   * Indica si un valor es un objeto plano (no null ni array).
   *
   * @param {*} value - Valor a comprobar.
   * @returns {boolean}
   */
  function isPlainObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  /**
   * Valida un nombre de grupo o lista: cadena recortada de 1 a 80 caracteres.
   *
   * @param {*} value - Nombre propuesto.
   * @param {string} what - Descripción para el error.
   * @returns {string}
   */
  function requireName(value, what) {
    const name = typeof value === "string" ? value.trim() : "";
    if (!name || name.length > MAX_NAME_LENGTH) {
      throw damagedError(`${what} con nombre no válido`);
    }
    return name;
  }

  /**
   * Construye el objeto de copia a partir de los datos actuales.
   *
   * @param {{groups: Array, watched: Object, settings: Object, playlists: Array}} data - Datos.
   * @param {number} now - Marca de tiempo de la exportación.
   * @returns {Object} Objeto listo para serializar.
   */
  function buildBackup(data, now) {
    return {
      format: FORMAT,
      version: VERSION,
      exportedAt: new Date(now).toISOString(),
      groups: data.groups,
      watched: data.watched,
      settings: data.settings,
      playlists: data.playlists,
      avatars: data.avatars,
    };
  }

  /**
   * Valida y limpia una lista de canales; suma los descartados al contador.
   *
   * @param {*} channels - Canales de un grupo.
   * @param {{dropped: number}} counter - Contador de descartados.
   * @returns {Array<{name: string, url: string}>}
   */
  function parseChannels(channels, counter) {
    if (!Array.isArray(channels)) {
      throw damagedError("canales no válidos");
    }
    const seen = new Set();
    const result = [];
    for (const channel of channels) {
      let valid = false;
      if (isPlainObject(channel) && typeof channel.url === "string") {
        try {
          valid =
            YouTubeGroups.normalizeChannelUrl(channel.url) === channel.url &&
            !seen.has(channel.url);
        } catch {
          valid = false;
        }
      }
      if (!valid) {
        counter.dropped += 1;
        continue;
      }
      seen.add(channel.url);
      result.push({
        name:
          typeof channel.name === "string"
            ? channel.name.trim().slice(0, MAX_CHANNEL_NAME_LENGTH)
            : "",
        url: channel.url,
      });
    }
    return result;
  }

  /**
   * Valida un nivel del árbol de grupos recalculando `type` y `parentId`.
   *
   * @param {*} nodes - Grupos de este nivel.
   * @param {string|null} parentId - ID del padre (null en el nivel superior).
   * @param {Set<string>} ids - IDs ya vistos en todo el árbol.
   * @param {{dropped: number}} counter - Contador de descartados.
   * @returns {Array<Object>}
   */
  function parseGroups(nodes, parentId, ids, counter) {
    if (!Array.isArray(nodes)) {
      throw damagedError("grupos no válidos");
    }
    return nodes.map((node) => {
      if (!isPlainObject(node)) {
        throw damagedError("grupo no válido");
      }
      if (typeof node.id !== "string" || !node.id || ids.has(node.id)) {
        throw damagedError("id de grupo vacío o repetido");
      }
      ids.add(node.id);
      const name = requireName(node.name, "grupo");
      const group = { id: node.id, name };
      if (parentId === null) {
        group.type = "group";
      } else {
        group.type = "subgroup";
        group.parentId = parentId;
      }
      group.channels = parseChannels(node.channels, counter);
      group.subgroups = parseGroups(
        node.subgroups === undefined ? [] : node.subgroups,
        node.id,
        ids,
        counter,
      );
      group.icon = YouTubeGroupsIcons.isValidIconId(node.icon) ? node.icon : "";
      group.color = YouTubeGroupsIcons.isValidColor(node.color)
        ? node.color
        : "";
      return group;
    });
  }

  /**
   * Valida el mapa de vídeos vistos.
   *
   * @param {*} watched - Mapa ID -> { watchedAt }.
   * @param {{dropped: number}} counter - Contador de descartados.
   * @returns {Object}
   */
  function parseWatched(watched, counter) {
    if (!isPlainObject(watched)) {
      throw damagedError("vistos no válidos");
    }
    const result = {};
    for (const [id, entry] of Object.entries(watched)) {
      if (
        YouTubeGroupsWatched.isValidVideoId(id) &&
        isPlainObject(entry) &&
        Number.isFinite(entry.watchedAt)
      ) {
        result[id] = { watchedAt: entry.watchedAt };
      } else {
        counter.dropped += 1;
      }
    }
    return result;
  }

  /**
   * Valida las listas de vídeos.
   *
   * @param {*} playlists - Listas.
   * @param {{dropped: number}} counter - Contador de descartados.
   * @returns {Array<Object>}
   */
  function parsePlaylists(playlists, counter) {
    if (!Array.isArray(playlists)) {
      throw damagedError("listas no válidas");
    }
    const ids = new Set();
    return playlists.map((list) => {
      if (!isPlainObject(list)) {
        throw damagedError("lista no válida");
      }
      if (typeof list.id !== "string" || !list.id || ids.has(list.id)) {
        throw damagedError("id de lista vacío o repetido");
      }
      ids.add(list.id);
      const name = requireName(list.name, "lista");
      if (!Array.isArray(list.videos)) {
        throw damagedError("vídeos de lista no válidos");
      }
      const seen = new Set();
      const videos = [];
      for (const item of list.videos) {
        if (
          !isPlainObject(item) ||
          !YouTubeGroupsWatched.isValidVideoId(item.id) ||
          seen.has(item.id)
        ) {
          counter.dropped += 1;
          continue;
        }
        seen.add(item.id);
        videos.push(
          YouTubeGroupsPlaylists.cleanVideoEntry(
            item,
            Number.isFinite(item.addedAt) ? item.addedAt : 0,
          ),
        );
      }
      return { id: list.id, name, videos };
    });
  }

  /**
   * Valida el mapa de avatares de canal. Las copias antiguas no lo traen.
   *
   * @param {*} avatars - Mapa clave de canal -> URL de imagen.
   * @param {{dropped: number}} counter - Contador de descartados.
   * @returns {Object|null} Mapa limpio, o null si la copia no lo incluye.
   */
  function parseAvatars(avatars, counter) {
    if (avatars === undefined) {
      return null;
    }
    if (!isPlainObject(avatars)) {
      throw damagedError("avatares no válidos");
    }
    const result = {};
    for (const [key, value] of Object.entries(avatars)) {
      if (
        YouTubeGroupsAvatars.isValidAvatarKey(key) &&
        YouTubeGroupsAvatars.normalizeAvatarUrl(value) === value
      ) {
        result[key] = value;
      } else {
        counter.dropped += 1;
      }
    }
    return result;
  }

  /**
   * Valida el texto de una copia y devuelve los datos limpios.
   *
   * @param {string} text - Contenido del fichero.
   * @returns {{data: {groups: Array, watched: Object, settings: Object, playlists: Array, avatars: (Object|null)}, dropped: number}}
   * @throws {Error} Si el fichero no es una copia válida.
   */
  function parseBackup(text) {
    if (typeof text !== "string" || text.length > MAX_TEXT_LENGTH) {
      throw notBackupError();
    }
    let raw;
    try {
      raw = JSON.parse(text);
    } catch {
      throw notBackupError();
    }
    if (!isPlainObject(raw) || raw.format !== FORMAT) {
      throw notBackupError();
    }
    if (raw.version !== VERSION) {
      throw new Error("Versión de copia no admitida.");
    }

    const counter = { dropped: 0 };
    const groups = parseGroups(raw.groups, null, new Set(), counter);
    const watched = parseWatched(raw.watched, counter);
    const settings = YouTubeGroupsSettings.normalizeSettings(raw.settings);
    const playlists = parsePlaylists(raw.playlists, counter);
    const avatars = parseAvatars(raw.avatars, counter);

    return {
      data: { groups, watched, settings, playlists, avatars },
      dropped: counter.dropped,
    };
  }

  /**
   * Lee los datos actuales y los serializa como copia de seguridad.
   *
   * @returns {Promise<string>} JSON con sangría de 2 espacios.
   */
  async function exportBackup() {
    const [groups, watched, settings, playlists, avatars] = await Promise.all([
      YouTubeGroupsStorage.getGroups(),
      YouTubeGroupsStorage.getWatchedVideos(),
      YouTubeGroupsSettings.getSettings(),
      YouTubeGroupsStorage.getPlaylists(),
      YouTubeGroupsStorage.getAvatars(),
    ]);
    return JSON.stringify(
      buildBackup(
        { groups, watched, settings, playlists, avatars },
        Date.now(),
      ),
      null,
      2,
    );
  }

  /**
   * Valida una copia y reemplaza con ella los datos guardados.
   * Si la copia no es válida, no escribe nada.
   *
   * @param {string} text - Contenido del fichero.
   * @returns {Promise<{dropped: number}>}
   * @throws {Error} Si el fichero no es una copia válida.
   */
  async function importBackup(text) {
    const { data, dropped } = parseBackup(text);
    const keys = YouTubeGroupsStorage.KEYS;
    await YouTubeGroupsStorage.withLock(keys.settings, () =>
      YouTubeGroupsStorage.saveSettings(data.settings),
    );
    await YouTubeGroupsStorage.withLock(keys.groups, () =>
      YouTubeGroupsStorage.saveGroups(data.groups),
    );
    await YouTubeGroupsStorage.withLock(keys.playlists, () =>
      YouTubeGroupsStorage.savePlaylists(data.playlists),
    );
    await YouTubeGroupsStorage.withLock(keys.watched, () =>
      YouTubeGroupsStorage.saveWatchedVideos(data.watched),
    );
    if (data.avatars !== null) {
      await YouTubeGroupsStorage.withLock(keys.avatars, () =>
        YouTubeGroupsStorage.saveAvatars(data.avatars),
      );
    }
    return { dropped };
  }

  return { buildBackup, parseBackup, exportBackup, importBackup };
})();
