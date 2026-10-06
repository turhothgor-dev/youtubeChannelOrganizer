const YouTubeGroupsIcons = (() => {
  // Icon set with 12 icons
  const ICON_SET = [
    { id: "tech", label: "Tecnología", path: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" },
    { id: "music", label: "Música", path: "M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3H12z" },
    { id: "news", label: "Noticias", path: "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-7h2v7z" },
    { id: "gaming", label: "Gaming", path: "M15 7.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5.67-1.5 1.5-1.5 1.5.67 1.5 1.5zm-10 0c0 .83-.67 1.5-1.5 1.5S3 8.33 3 7.5 3.67 6 4.5 6s1.5.67 1.5 1.5zM15 16.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5.67-1.5 1.5-1.5 1.5.67 1.5 1.5zm-10 0c0 .83-.67 1.5-1.5 1.5S3 17.33 3 16.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5z" },
    { id: "sports", label: "Deportes", path: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" },
    { id: "education", label: "Educación", path: "M5 12h14M5 12l7-7m0 0v14" },
    { id: "food", label: "Comida", path: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" },
    { id: "travel", label: "Viajes", path: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" },
    { id: "art", label: "Arte", path: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" },
    { id: "science", label: "Ciencia", path: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" },
    { id: "movie", label: "Cine", path: "M18 3v2h-2V3H8v2H6V3H4v18h2v-2h2v2h8v-2h2v2h2V3h-2zM8 17H6v-2h2v2zm0-4H6v-2h2v2zm0-4H6V7h2v2zm10 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2z" },
    { id: "default", label: "Genérico", path: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" }
  ];

  // Color set with 8 colors
  const COLOR_SET = [
    { id: "blue", hex: "#2196F3" },
    { id: "green", hex: "#4CAF50" },
    { id: "red", hex: "#F44336" },
    { id: "orange", hex: "#FF9800" },
    { id: "purple", hex: "#9C27B0" },
    { id: "pink", hex: "#E91E63" },
    { id: "indigo", hex: "#3F51B5" },
    { id: "teal", hex: "#009688" }
  ];

  // Constants for no icon/color
  const NO_ICON = "";
  const NO_COLOR = "";

  /**
   * Gets the SVG path for an icon by ID
   * @param {string} id - The icon ID
   * @returns {string|null} The SVG path or null if not found
   */
  function getIconPath(id) {
    const icon = ICON_SET.find(icon => icon.id === id);
    return icon ? icon.path : null;
  }

  /**
   * Gets the label for an icon by ID
   * @param {string} id - The icon ID
   * @returns {string} The icon label or empty string if not found
   */
  function getIconLabel(id) {
    const icon = ICON_SET.find(icon => icon.id === id);
    return icon ? icon.label : "";
  }

  /**
   * Checks if an icon ID is valid (empty or exists in ICON_SET)
   * @param {string} id - The icon ID to validate
   * @returns {boolean} True if valid
   */
  function isValidIconId(id) {
    return id === NO_ICON || ICON_SET.some(icon => icon.id === id);
  }

  /**
   * Checks if a color hex is valid (empty or valid #rrggbb format)
   * @param {string} hex - The hex color to validate
   * @returns {boolean} True if valid
   */
  function isValidColor(hex) {
    return hex === NO_COLOR || /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex);
  }

  /**
   * Gets the hex color for a color ID
   * @param {string} id - The color ID
   * @returns {string|null} The hex color or null if not found
   */
  function getColorHex(id) {
    const color = COLOR_SET.find(color => color.id === id);
    return color ? color.hex : null;
  }

  return {
    ICON_SET,
    COLOR_SET,
    NO_ICON,
    NO_COLOR,
    getIconPath,
    getIconLabel,
    isValidIconId,
    isValidColor,
    getColorHex
  };
})();