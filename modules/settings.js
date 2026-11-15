const YouTubeGroupsSettings = (() => {
  const DEFAULT_SETTINGS = Object.freeze({
    watchedMode: "dim",
    outsideMode: "hide",
    autoMarkPercent: 80,
    panelCollapsed: true,
    sidebarCollapsed: false,
  });
  const WATCHED_MODES = Object.freeze(["show", "dim", "hide"]);
  const OUTSIDE_MODES = Object.freeze(["hide", "dim"]);
  const AUTO_MARK_PERCENTS = Object.freeze([0, 50, 80, 95]);
  const PANEL_COLLAPSED_VALUES = Object.freeze([false, true]);
  const SIDEBAR_COLLAPSED_VALUES = Object.freeze([false, true]);

  const ALLOWED_VALUES = {
    watchedMode: WATCHED_MODES,
    outsideMode: OUTSIDE_MODES,
    autoMarkPercent: AUTO_MARK_PERCENTS,
    panelCollapsed: PANEL_COLLAPSED_VALUES,
    sidebarCollapsed: SIDEBAR_COLLAPSED_VALUES,
  };

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
   * Devuelve unos ajustes completos y válidos a partir de lo guardado.
   *
   * @param {*} raw - Lo leído del almacenamiento (puede ser cualquier cosa).
   * @returns {{watchedMode: string, outsideMode: string, autoMarkPercent: number, panelCollapsed: boolean, sidebarCollapsed: boolean}} Objeto nuevo con solo los campos conocidos.
   */
  function normalizeSettings(raw) {
    const source = isPlainObject(raw) ? raw : {};
    const result = {};

    for (const key of Object.keys(ALLOWED_VALUES)) {
      result[key] = ALLOWED_VALUES[key].includes(source[key])
        ? source[key]
        : DEFAULT_SETTINGS[key];
    }

    return result;
  }

  /**
   * Lee los ajustes guardados y los normaliza.
   *
   * @returns {Promise<{watchedMode: string, outsideMode: string, autoMarkPercent: number, panelCollapsed: boolean, sidebarCollapsed: boolean}>}
   */
  async function getSettings() {
    return normalizeSettings(await YouTubeGroupsStorage.getSettings());
  }

  /**
   * Aplica un cambio parcial a los ajustes y escribe solo si algo cambia.
   *
   * @param {Object} patch - Claves de ajuste con su nuevo valor.
   * @returns {Promise<{settings: Object, changed: boolean}>}
   * @throws {Error} Si hay una clave desconocida o un valor no válido.
   */
  async function updateSettings(patch) {
    if (!isPlainObject(patch)) {
      throw new Error("Ajuste inválido: patch.");
    }

    for (const [key, value] of Object.entries(patch)) {
      if (
        !Object.hasOwn(ALLOWED_VALUES, key) ||
        !ALLOWED_VALUES[key].includes(value)
      ) {
        throw new Error(`Ajuste inválido: ${key}.`);
      }
    }

    return YouTubeGroupsStorage.withLock(
      YouTubeGroupsStorage.KEYS.settings,
      async () => {
        const current = await getSettings();
        const settings = { ...current, ...patch };
        const changed = Object.keys(settings).some(
          (key) => settings[key] !== current[key],
        );

        if (changed) {
          await YouTubeGroupsStorage.saveSettings(settings);
        }

        return { settings, changed };
      },
    );
  }

  return {
    DEFAULT_SETTINGS,
    WATCHED_MODES,
    OUTSIDE_MODES,
    AUTO_MARK_PERCENTS,
    PANEL_COLLAPSED_VALUES,
    SIDEBAR_COLLAPSED_VALUES,
    normalizeSettings,
    getSettings,
    updateSettings,
  };
})();
