const YouTubeGroupsIcons = (() => {
  // Icon set with 12 icons
  const ICON_SET = [
      { id: "tech", label: "Tecnología", path: "M17 3H7c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 16H6v-2h6v2zm0-4H6v-2h6v2zm0-4H6V9h6v2zm0-4H6V5h6v2zm6 8h-4v-2h4v2zm0-4h-4V9h4v2zm0-4h-4V5h4v2z" },
      { id: "music", label: "Música", path: "M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3H12z" },
      { id: "news", label: "Noticias", path: "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-7h2v7z" },
      { id: "gaming", label: "Gaming", path: "M15 7.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5.67-1.5 1.5-1.5 1.5.67 1.5 1.5zm-10 0c0 .83-.67 1.5-1.5 1.5S3 8.33 3 7.5 3.67 6 4.5 6s1.5.67 1.5 1.5zM15 16.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5.67-1.5 1.5-1.5 1.5.67 1.5 1.5zm-10 0c0 .83-.67 1.5-1.5 1.5S3 17.33 3 16.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5z" },
      { id: "sports", label: "Deportes", path: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" },
      { id: "education", label: "Educación", path: "M5 12h14M5 12l7-7m0 0v14" },
      { id: "food", label: "Comida", path: "M8.1 13.34l2.83-2.83L3.91 3.5c-1.56 1.56-1.56 4.09 0 5.66l4.19 4.19zm6.78-1.81c1.53.71 3.68.21 5.27-1.38 1.91-1.91 2.28-4.65.81-6.12-1.46-1.46-4.2-1.1-6.12.81-1.59 1.59-2.09 3.74-1.38 5.27L3.7 19.87l1.41 1.41L12 14.41l6.88 6.88 1.41-1.41L13.41 13l1.47-1.47z" },
      { id: "travel", label: "Viajes", path: "M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" },
      { id: "art", label: "Arte", path: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" },
      { id: "science", label: "Ciencia", path: "M19.8 18.4L14 10.67V6.5l1.35-1.69c.26-.33.03-.81-.39-.81H9.04c-.42 0-.65.48-.39.81L10 6.5v4.17L4.2 18.4c-.49.66-.02 1.6.8 1.6h14c.82 0 1.29-.94.8-1.6zM12 20c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" },
      { id: "movie", label: "Cine", path: "M18 3v2h-2V3H8v2H6V3H4v18h2v-2h2v2h8v-2h2v2h2V3h-2zM8 17H6v-2h2v2zm0-4H6v-2h2v2zm0-4H6V7h2v2zm10 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2z" },
      { id: "default", label: "Genérico", path: "M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z" }
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