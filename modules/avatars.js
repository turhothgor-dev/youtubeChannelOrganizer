/**
 * Lógica pura de los avatares de canal (ADR 0016). Sin DOM.
 * Se carga tras groups.js y storage.js.
 */
const YouTubeGroupsAvatars = (() => {
  const AVATAR_HOSTS = ["yt3.ggpht.com", "yt3.googleusercontent.com"];
  const AVATAR_SIZE_SUFFIX = "=s88-c-k-c0x00ffffff-no-rj";
  const MAX_URL_LENGTH = 2048;
  const BASE_URL = "https://www.youtube.com";

  /**
   * Normaliza la URL de una imagen de avatar o devuelve null si no es aceptable.
   * @param {*} src URL candidata.
   * @returns {string|null} URL https normalizada (sin query ni fragmento, tamaño fijo) o null.
   */
  function normalizeAvatarUrl(src) {
    if (typeof src !== "string" || src.length > MAX_URL_LENGTH) {
      return null;
    }

    let url;
    try {
      url = new URL(src, BASE_URL);
    } catch {
      return null;
    }

    if (
      url.protocol !== "https:" ||
      !AVATAR_HOSTS.includes(url.hostname) ||
      url.username ||
      url.password ||
      url.port ||
      url.pathname === "/"
    ) {
      return null;
    }

    const path = url.pathname.replace(/=s\d+[^/]*$/, AVATAR_SIZE_SUFFIX);
    return `https://${url.hostname}${path}`;
  }

  /**
   * Indica si una clave de avatar es una clave de canal ya normalizada.
   * @param {*} key Clave candidata.
   * @returns {boolean}
   */
  function isValidAvatarKey(key) {
    if (typeof key !== "string") {
      return false;
    }
    try {
      return (
        YouTubeGroups.normalizeChannelUrl(key) !== null &&
        YouTubeGroups.getChannelKey(key) === key
      );
    } catch {
      return false;
    }
  }

  /**
   * Devuelve el avatar guardado de un canal, si es válido.
   * @param {Object} avatars Mapa clave de canal -> URL de imagen.
   * @param {string} url URL del canal.
   * @returns {string|null}
   */
  function getAvatarFor(avatars, url) {
    if (!avatars || typeof avatars !== "object") {
      return null;
    }
    const key = YouTubeGroups.getChannelKey(url);
    if (!Object.prototype.hasOwnProperty.call(avatars, key)) {
      return null;
    }
    const value = avatars[key];
    return normalizeAvatarUrl(value) === value ? value : null;
  }

  /**
   * Claves de todos los canales del árbol de grupos (todos los niveles).
   * @param {Array} groups Grupos.
   * @returns {Set<string>}
   */
  function getGroupedChannelKeys(groups) {
    const keys = new Set();
    const visit = (list) => {
      for (const group of Array.isArray(list) ? list : []) {
        for (const channel of Array.isArray(group.channels)
          ? group.channels
          : []) {
          keys.add(YouTubeGroups.getChannelKey(channel.url));
        }
        visit(group.subgroups);
      }
    };
    visit(groups);
    return keys;
  }

  /**
   * Claves de los canales cuyo avatar se conserva: los agrupados y los
   * suscritos conocidos (ADR 0018).
   * @param {Array} groups Grupos.
   * @param {Object} [subscriptions] Mapa clave de canal -> suscripción.
   * @returns {Set<string>}
   */
  function getKeptChannelKeys(groups, subscriptions = {}) {
    const keys = getGroupedChannelKeys(groups);
    if (subscriptions && typeof subscriptions === "object") {
      for (const key of Object.keys(subscriptions)) {
        keys.add(key);
      }
    }
    return keys;
  }

  /**
   * Combina los avatares guardados con los observados, solo para canales
   * agrupados o suscritos conocidos. No muta ninguna entrada.
   * @param {Object} stored Avatares guardados.
   * @param {Object|Map} observed Avatares vistos (clave -> URL).
   * @param {Array} groups Grupos.
   * @param {Object} [subscriptions] Suscripciones conocidas (clave -> datos).
   * @returns {{avatars: Object, changed: boolean}}
   */
  function mergeAvatars(stored, observed, groups, subscriptions = {}) {
    const grouped = getKeptChannelKeys(groups, subscriptions);
    const previous = stored && typeof stored === "object" ? stored : {};
    const avatars = {};

    for (const [key, value] of Object.entries(previous)) {
      if (
        isValidAvatarKey(key) &&
        normalizeAvatarUrl(value) === value &&
        grouped.has(key)
      ) {
        avatars[key] = value;
      }
    }

    const entries =
      Object.prototype.toString.call(observed) === "[object Map]"
        ? [...observed.entries()]
        : Object.entries(observed || {});
    for (const [key, src] of entries) {
      const value = normalizeAvatarUrl(src);
      if (value !== null && grouped.has(key)) {
        avatars[key] = value;
      }
    }

    const keys = Object.keys(avatars);
    const changed =
      keys.length !== Object.keys(previous).length ||
      keys.some(
        (key) =>
          !Object.prototype.hasOwnProperty.call(previous, key) ||
          previous[key] !== avatars[key],
      );

    return { avatars, changed };
  }

  /**
   * Primera letra (punto de código) del nombre, en mayúsculas.
   * @param {string} name Nombre del canal.
   * @returns {string} La inicial o "?".
   */
  function getInitial(name) {
    const clean = String(name ?? "")
      .trim()
      .replace(/^@/, "");
    const first = Array.from(clean)[0];
    return first ? first.toLocaleUpperCase() : "?";
  }

  /**
   * Color de fondo determinista derivado del nombre.
   * @param {string} name Nombre del canal.
   * @returns {string} Color `hsl(H 45% 40%)`.
   */
  function getFallbackColor(name) {
    let hash = 0;
    for (const char of String(name ?? "").trim()) {
      hash = (hash * 31 + char.codePointAt(0)) >>> 0;
    }
    return `hsl(${hash % 360} 45% 40%)`;
  }

  /**
   * Guarda los avatares observados de canales agrupados, solo si algo cambia.
   * @param {Object|Map} observed Avatares vistos (clave -> URL).
   * @returns {Promise<{changed: boolean}>}
   */
  function saveObservedAvatars(observed) {
    const storage = YouTubeGroupsStorage;
    return storage.withLock(storage.KEYS.avatars, async () => {
      const [stored, groups, subscriptions] = await Promise.all([
        storage.getAvatars(),
        storage.getGroups(),
        storage.getSubscriptions(),
      ]);
      const { avatars, changed } = mergeAvatars(
        stored,
        observed,
        groups,
        subscriptions,
      );
      if (changed) {
        await storage.saveAvatars(avatars);
      }
      return { changed };
    });
  }

  return {
    AVATAR_HOSTS,
    AVATAR_SIZE_SUFFIX,
    normalizeAvatarUrl,
    isValidAvatarKey,
    getAvatarFor,
    getGroupedChannelKeys,
    getKeptChannelKeys,
    mergeAvatars,
    getInitial,
    getFallbackColor,
    saveObservedAvatars,
  };
})();
