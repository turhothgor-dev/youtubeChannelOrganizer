const YouTubeGroupsPlaylists = (() => {
  const MAX_NAME_LENGTH = 80;
  const MAX_TITLE_LENGTH = 200;
  const MAX_CHANNEL_LENGTH = 100;
  const MAX_PLAY_ALL = 50;
  const YOUTUBE_ORIGIN = "https://www.youtube.com";

  /**
   * Valida y recorta el nombre de una lista.
   *
   * @param {string} name - Nombre propuesto.
   * @returns {string} El nombre recortado.
   */
  function normalizeName(name) {
    const trimmed = typeof name === "string" ? name.trim() : "";
    if (!trimmed) {
      throw new Error("El nombre de la lista no puede estar vacío.");
    }
    if (trimmed.length > MAX_NAME_LENGTH) {
      throw new Error(
        `El nombre de la lista no puede exceder ${MAX_NAME_LENGTH} caracteres.`,
      );
    }
    return trimmed;
  }

  /**
   * Convierte un valor en cadena recortada y truncada (no cadena -> "").
   *
   * @param {*} value - Valor de entrada.
   * @param {number} max - Longitud máxima.
   * @returns {string}
   */
  function cleanText(value, max) {
    return typeof value === "string" ? value.trim().slice(0, max) : "";
  }

  /**
   * Busca el índice de una lista o lanza error si no existe.
   *
   * @param {Array} playlists - Listas.
   * @param {string} playlistId - ID de la lista.
   * @returns {number}
   */
  function requireIndex(playlists, playlistId) {
    const index = playlists.findIndex((list) => list.id === playlistId);
    if (index === -1) {
      throw new Error("No existe la lista indicada.");
    }
    return index;
  }

  /**
   * Añade una lista vacía al final sin mutar la entrada.
   *
   * @param {Array} playlists - Listas actuales.
   * @param {string} name - Nombre de la lista.
   * @param {string} id - ID de la nueva lista.
   * @returns {{playlists: Array, changed: boolean}}
   */
  function applyCreatePlaylist(playlists, name, id) {
    const clean = normalizeName(name);
    return {
      playlists: [...playlists, { id, name: clean, videos: [] }],
      changed: true,
    };
  }

  /**
   * Renombra una lista sin mutar la entrada.
   *
   * @param {Array} playlists - Listas actuales.
   * @param {string} playlistId - ID de la lista.
   * @param {string} name - Nuevo nombre.
   * @returns {{playlists: Array, changed: boolean}}
   */
  function applyRenamePlaylist(playlists, playlistId, name) {
    const clean = normalizeName(name);
    const index = requireIndex(playlists, playlistId);
    if (playlists[index].name === clean) {
      return { playlists: [...playlists], changed: false };
    }
    const next = [...playlists];
    next[index] = { ...playlists[index], name: clean };
    return { playlists: next, changed: true };
  }

  /**
   * Elimina una lista sin mutar la entrada.
   *
   * @param {Array} playlists - Listas actuales.
   * @param {string} playlistId - ID de la lista.
   * @returns {{playlists: Array, changed: boolean}}
   */
  function applyDeletePlaylist(playlists, playlistId) {
    requireIndex(playlists, playlistId);
    return {
      playlists: playlists.filter((list) => list.id !== playlistId),
      changed: true,
    };
  }

  /**
   * Deja el vídeo exactamente en las listas indicadas, sin mutar la entrada.
   *
   * @param {Array} playlists - Listas actuales.
   * @param {{id: string, title: string, channelName: string}} video - Vídeo.
   * @param {Set<string>|string[]} playlistIds - Listas donde debe estar.
   * @param {number} now - Marca de tiempo para `addedAt`.
   * @returns {{playlists: Array, changed: boolean}}
   */
  function applyVideoPlaylists(playlists, video, playlistIds, now) {
    if (!video || !YouTubeGroupsWatched.isValidVideoId(video.id)) {
      throw new Error("Vídeo inválido.");
    }

    const selected = new Set(playlistIds);
    const entry = {
      id: video.id,
      title: cleanText(video.title, MAX_TITLE_LENGTH),
      channelName: cleanText(video.channelName, MAX_CHANNEL_LENGTH),
      addedAt: now,
    };
    let changed = false;

    const next = playlists.map((list) => {
      const present = list.videos.some((item) => item.id === video.id);
      if (selected.has(list.id) && !present) {
        changed = true;
        return { ...list, videos: [...list.videos, { ...entry }] };
      }
      if (!selected.has(list.id) && present) {
        changed = true;
        return {
          ...list,
          videos: list.videos.filter((item) => item.id !== video.id),
        };
      }
      return list;
    });

    return { playlists: next, changed };
  }

  /**
   * Quita un vídeo de una lista sin mutar la entrada.
   *
   * @param {Array} playlists - Listas actuales.
   * @param {string} playlistId - ID de la lista.
   * @param {string} videoId - ID del vídeo.
   * @returns {{playlists: Array, changed: boolean}}
   */
  function applyRemoveVideo(playlists, playlistId, videoId) {
    const index = requireIndex(playlists, playlistId);
    const list = playlists[index];
    if (!list.videos.some((item) => item.id === videoId)) {
      return { playlists: [...playlists], changed: false };
    }
    const next = [...playlists];
    next[index] = {
      ...list,
      videos: list.videos.filter((item) => item.id !== videoId),
    };
    return { playlists: next, changed: true };
  }

  /**
   * Devuelve los IDs de las listas que contienen el vídeo.
   *
   * @param {Array} playlists - Listas.
   * @param {string} videoId - ID del vídeo.
   * @returns {string[]}
   */
  function getVideoPlaylistIds(playlists, videoId) {
    return playlists
      .filter((list) => list.videos.some((item) => item.id === videoId))
      .map((list) => list.id);
  }

  /**
   * Construye la URL para reproducir los primeros 50 vídeos de una lista.
   *
   * @param {{videos: Array}} playlist - Lista.
   * @returns {string|null} La URL o null si la lista está vacía.
   */
  function buildPlayAllUrl(playlist) {
    if (
      !playlist ||
      !Array.isArray(playlist.videos) ||
      !playlist.videos.length
    ) {
      return null;
    }
    const ids = playlist.videos.slice(0, MAX_PLAY_ALL).map((item) => item.id);
    const url = new URL("/watch_videos", YOUTUBE_ORIGIN);
    url.searchParams.set("video_ids", ids.join(","));
    return url.href;
  }

  /**
   * Construye la URL de un vídeo.
   *
   * @param {string} videoId - ID del vídeo.
   * @returns {string|null} La URL o null si el ID no es válido.
   */
  function buildVideoUrl(videoId) {
    if (!YouTubeGroupsWatched.isValidVideoId(videoId)) {
      return null;
    }
    const url = new URL("/watch", YOUTUBE_ORIGIN);
    url.searchParams.set("v", videoId);
    return url.href;
  }

  /**
   * Aplica una función pura a las listas guardadas y escribe solo si hubo cambio.
   *
   * @param {function(Array): {playlists: Array, changed: boolean}} apply
   * @returns {Promise<{playlists: Array, changed: boolean}>}
   */
  async function update(apply) {
    return YouTubeGroupsStorage.withLock(
      YouTubeGroupsStorage.KEYS.playlists,
      async () => {
        const playlists = await YouTubeGroupsStorage.getPlaylists();
        const result = apply(playlists);
        if (result.changed) {
          await YouTubeGroupsStorage.savePlaylists(result.playlists);
        }
        return result;
      },
    );
  }

  /**
   * Crea una lista nueva.
   *
   * @param {string} name - Nombre de la lista.
   * @returns {Promise<{id: string, name: string, videos: Array}>} La lista creada.
   */
  async function createPlaylist(name) {
    const id = crypto.randomUUID();
    const result = await update((playlists) =>
      applyCreatePlaylist(playlists, name, id),
    );
    return result.playlists[result.playlists.length - 1];
  }

  /**
   * Renombra una lista guardada.
   *
   * @param {string} playlistId - ID de la lista.
   * @param {string} name - Nuevo nombre.
   * @returns {Promise<{playlists: Array, changed: boolean}>}
   */
  function renamePlaylist(playlistId, name) {
    return update((playlists) =>
      applyRenamePlaylist(playlists, playlistId, name),
    );
  }

  /**
   * Elimina una lista guardada.
   *
   * @param {string} playlistId - ID de la lista.
   * @returns {Promise<{playlists: Array, changed: boolean}>}
   */
  function deletePlaylist(playlistId) {
    return update((playlists) => applyDeletePlaylist(playlists, playlistId));
  }

  /**
   * Guarda el vídeo en las listas indicadas y lo quita de las demás.
   *
   * @param {{id: string, title: string, channelName: string}} video - Vídeo.
   * @param {Set<string>|string[]} playlistIds - Listas donde debe estar.
   * @returns {Promise<{playlists: Array, changed: boolean}>}
   */
  function setVideoPlaylists(video, playlistIds) {
    const now = Date.now();
    return update((playlists) =>
      applyVideoPlaylists(playlists, video, playlistIds, now),
    );
  }

  /**
   * Quita un vídeo de una lista guardada.
   *
   * @param {string} playlistId - ID de la lista.
   * @param {string} videoId - ID del vídeo.
   * @returns {Promise<{playlists: Array, changed: boolean}>}
   */
  function removeVideoFromPlaylist(playlistId, videoId) {
    return update((playlists) =>
      applyRemoveVideo(playlists, playlistId, videoId),
    );
  }

  return {
    applyCreatePlaylist,
    applyRenamePlaylist,
    applyDeletePlaylist,
    applyVideoPlaylists,
    applyRemoveVideo,
    getVideoPlaylistIds,
    buildPlayAllUrl,
    buildVideoUrl,
    createPlaylist,
    renamePlaylist,
    deletePlaylist,
    setVideoPlaylists,
    removeVideoFromPlaylist,
  };
})();
