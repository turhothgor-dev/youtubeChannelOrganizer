const YouTubeGroupsVisibility = (() => {
  /**
   * Decide cómo se ve una tarjeta. Ocultar gana a atenuar.
   *
   * @param {{matchesFilter: boolean, isWatched: boolean}} state - Estado de la tarjeta.
   * @param {{watchedMode: string, outsideMode: string}} settings - Ajustes normalizados.
   * @returns {"visible"|"dimmed"|"hidden"}
   */
  function getCardVisibility({ matchesFilter, isWatched }, settings) {
    if (!matchesFilter && settings.outsideMode === "hide") {
      return "hidden";
    }
    if (isWatched && settings.watchedMode === "hide") {
      return "hidden";
    }
    if (!matchesFilter) {
      return "dimmed";
    }
    if (isWatched && settings.watchedMode === "dim") {
      return "dimmed";
    }
    return "visible";
  }

  return { getCardVisibility };
})();
