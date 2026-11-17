"use strict";

/**
 * Página de opciones: editor de grupos (esqueleto: tema, errores y recuento).
 */
(() => {
  const errorEl = document.getElementById("options-error");
  const summaryEl = document.getElementById("options-summary");

  /**
   * Aplica el atributo `dark` en <html> según el tema del sistema.
   * @param {boolean} isDark - Si el tema es oscuro.
   * @returns {void}
   */
  function applyTheme(isDark) {
    document.documentElement.toggleAttribute("dark", isDark);
  }

  /**
   * Muestra u oculta el mensaje de error de la cabecera.
   * @param {string} message - Texto del error; vacío lo oculta.
   * @returns {void}
   */
  function showError(message) {
    errorEl.textContent = message;
    errorEl.hidden = !message;
  }

  /**
   * Cuenta todos los grupos y subgrupos del árbol.
   * @param {Array<Object>} groups - Árbol de grupos.
   * @returns {number} Número total de nodos.
   */
  function countGroups(groups) {
    return groups.reduce(
      (total, group) =>
        total +
        1 +
        (Array.isArray(group.subgroups) ? countGroups(group.subgroups) : 0),
      0,
    );
  }

  /**
   * Lee los grupos y pinta el recuento.
   * @returns {Promise<void>}
   */
  async function render() {
    try {
      const groups = await YouTubeGroupsStorage.getGroups();
      summaryEl.textContent = `${countGroups(groups)} grupos`;
      showError("");
    } catch (error) {
      console.error(error);
      showError("No se pudieron leer los grupos.");
    }
  }

  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
  applyTheme(darkQuery.matches);
  darkQuery.addEventListener("change", (event) => applyTheme(event.matches));

  render();
})();
