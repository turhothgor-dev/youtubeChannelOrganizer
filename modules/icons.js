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
    settings:
      "M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z",
    recycle:
      "M5.77 7.15 7.2 4.78l1.03-1.71c.39-.65 1.33-.65 1.72 0l1.48 2.46-1.23 2.06-1 1.62-3.43-2.06zm15.95 5.82-1.6-2.66-3.46 2L18.87 16H20a2 2 0 0 0 2-2c0-.36-.1-.71-.28-1.03zM16 21h1.5a2 2 0 0 0 1.79-1.11L20.74 17H16v-2l-4 4 4 4v-2zm-6-4H5.7l-.84 1.41c-.3.5-.32 1.12-.06 1.65.28.57.87.94 1.52.94H10v-4zm-3.88-2.65 1.73 1.04L6.48 9.9 1 11.27l1.7 1.02-.41.69c-.35.59-.38 1.31-.07 1.92l1.63 3.26 2.27-3.81zm10.9-9.21-1.3-2.17C15.35 2.37 14.7 2 14 2h-3.53l3.12 5.2-1.72 1.03 5.49 1.37 1.37-5.49-1.71 1.03z",
    add: "M13 7h-2v4H7v2h4v4h2v-4h4v-2h-4V7zm-1-5C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z",
    edit: "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z",
    "arrow-up": "M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z",
    "arrow-down":
      "M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z",
    palette:
      "M12 3a9 9 0 0 0 0 18c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z",
    delete:
      "M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z",
    swap: "M16 17.01V10h-2v7.01h-3L15 21l4-3.99h-3zM9 3 5 6.99h3V14h2V6.99h3L9 3z",
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
