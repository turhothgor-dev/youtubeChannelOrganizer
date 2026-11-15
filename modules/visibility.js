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

  /**
   * Indica si una tarjeta pasa el filtro de la selección. Sin selección o con
   * los canales aún cargando, pasa. Con canal, depende de su pertenencia. Sin
   * canal, no pasa si la tarjeta ya tiene ID de vídeo (ya está pintada).
   *
   * @param {{hasFilter: boolean, channelUrls: (Set<string>|null), channelUrl: (string|null|undefined), hasVideoId: boolean}} state - Estado.
   * @returns {boolean}
   */
  function matchesGroupFilter({
    hasFilter,
    channelUrls,
    channelUrl,
    hasVideoId,
  }) {
    if (!hasFilter || channelUrls === null) {
      return true;
    }
    if (channelUrl) {
      return channelUrls.has(channelUrl);
    }
    return !hasVideoId;
  }

  return { getCardVisibility, matchesGroupFilter };
})();
