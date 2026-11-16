const YouTubeGroupsIcons = (() => {
  // Icon set with 12 icons. El dibujo (multicolor, de fxemoji) está en
  // YouTubeGroupsFxemoji.ICONS, indexado por id; codepoint es el del emoji.
  const ICON_SET = [
    { id: "tech", label: "Tecnología", codepoint: "1F4BB" },
    { id: "music", label: "Música", codepoint: "1F3B5" },
    { id: "news", label: "Noticias", codepoint: "1F4F0" },
    { id: "gaming", label: "Gaming", codepoint: "1F3AE" },
    { id: "sports", label: "Deportes", codepoint: "26BD" },
    { id: "education", label: "Educación", codepoint: "1F393" },
    { id: "food", label: "Comida", codepoint: "1F374" },
    { id: "travel", label: "Viajes", codepoint: "2708" },
    { id: "art", label: "Arte", codepoint: "1F58C" },
    { id: "science", label: "Ciencia", codepoint: "1F52C" },
    { id: "movie", label: "Cine", codepoint: "1F3AC" },
    { id: "default", label: "Genérico", codepoint: "1F5C0" },
  ];

  // Iconos de interfaz (Material Icons, Apache 2.0, viewBox 24). Separados de
  // ICON_SET para que no salgan en el selector de iconos de grupos.
  const UI_ICON_PATHS = {
    eye: "M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z",
    check: "M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z",
    "playlist-add":
      "M14 10H2v2h12v-2zm0-4H2v2h12V6zm4 8v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM2 16h8v-2H2v2z",
  };

  // Color set with 8 colors
  const COLOR_SET = [
    { id: "blue", hex: "#2196F3" },
    { id: "green", hex: "#4CAF50" },
    { id: "red", hex: "#F44336" },
    { id: "orange", hex: "#FF9800" },
    { id: "purple", hex: "#9C27B0" },
    { id: "pink", hex: "#E91E63" },
    { id: "indigo", hex: "#3F51B5" },
    { id: "teal", hex: "#009688" },
  ];

  // Constants for no icon/color
  const NO_ICON = "";
  const NO_COLOR = "";

  /**
   * Gets the graphic (fxemoji) of an icon by ID
   * @param {string} id - The icon ID
   * @returns {{viewBox: string, shapes: Array<{tag: string, attrs: Object}>}|null}
   *   The graphic or null if not found
   */
  function getIconGraphic(id) {
    if (!ICON_SET.some((icon) => icon.id === id)) {
      return null;
    }
    const data = YouTubeGroupsFxemoji.ICONS[id];
    return data ? { viewBox: data.viewBox, shapes: data.shapes } : null;
  }

  /**
   * Gets the SVG path of an interface icon by ID
   * @param {string} id - The interface icon ID
   * @returns {string|null} The SVG path or null if not found
   */
  function getUiIconPath(id) {
    return Object.hasOwn(UI_ICON_PATHS, id) ? UI_ICON_PATHS[id] : null;
  }

  /**
   * Gets the label for an icon by ID
   * @param {string} id - The icon ID
   * @returns {string} The icon label or empty string if not found
   */
  function getIconLabel(id) {
    const icon = ICON_SET.find((icon) => icon.id === id);
    return icon ? icon.label : "";
  }

  /**
   * Checks if an icon ID is valid (empty or exists in ICON_SET)
   * @param {string} id - The icon ID to validate
   * @returns {boolean} True if valid
   */
  function isValidIconId(id) {
    return id === NO_ICON || ICON_SET.some((icon) => icon.id === id);
  }

  /**
   * Checks if a color hex is valid (empty or valid #rrggbb format)
   * @param {string} hex - The hex color to validate
   * @returns {boolean} True if valid
   */
  function isValidColor(hex) {
    return hex === NO_COLOR || /^#[A-Fa-f0-9]{6}$/.test(hex);
  }

  /**
   * Gets the hex color for a color ID
   * @param {string} id - The color ID
   * @returns {string|null} The hex color or null if not found
   */
  function getColorHex(id) {
    const color = COLOR_SET.find((color) => color.id === id);
    return color ? color.hex : null;
  }

  return {
    ICON_SET,
    COLOR_SET,
    NO_ICON,
    NO_COLOR,
    getIconGraphic,
    getUiIconPath,
    getIconLabel,
    isValidIconId,
    isValidColor,
    getColorHex,
  };
})();
