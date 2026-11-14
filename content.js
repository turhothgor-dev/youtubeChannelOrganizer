(() => {
  "use strict";

  console.log("[YouTube Groups] content.js cargado");

  const { getGroups, saveGroups } = YouTubeGroupsStorage;

  const {
    createGroup,
    deleteGroup,
    renameGroup,
    setChannelGroups,
    createSubGroup, // Nueva función
    deleteSubGroup, // Nueva función
    getSubGroups, // Nueva función
    getAllGroupsAndSubGroups, // Nueva función
  } = YouTubeGroups;

  /**
   * Crea el SVG de un icono sin usar innerHTML.
   * @param {string} iconId - Id del icono de ICON_SET.
   * @param {number} size - Lado en píxeles.
   * @returns {SVGElement|null} null si el icono no existe.
   */
  function createIconSvg(iconId, size) {
    const iconPath = YouTubeGroupsIcons.getIconPath(iconId);
    if (!iconPath) {
      return null;
    }
    const svgNs = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNs, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
    svg.setAttribute("fill", "currentColor");
    const path = document.createElementNS(svgNs, "path");
    path.setAttribute("d", iconPath);
    svg.append(path);
    return svg;
  }

  /**
   * Crea la marca de un grupo: su icono con el color resultante, o un punto
   * de color si solo hay color.
   * @param {Array<Object>} groups - Árbol de grupos.
   * @param {string} groupId - Id del grupo o subgrupo.
   * @param {number} size - Lado del icono en píxeles.
   * @returns {HTMLElement|null} null si no hay icono ni color.
   */
  function createGroupMark(groups, groupId, size) {
    const appearance = YouTubeGroups.getGroupAppearance(groups, groupId);
    if (!appearance) {
      return null;
    }
    const svg = appearance.icon ? createIconSvg(appearance.icon, size) : null;
    if (svg) {
      const chip = document.createElement("span");
      chip.className = "youtube-groups__icon";
      if (appearance.color) {
        chip.style.color = appearance.color;
      }
      chip.title = YouTubeGroupsIcons.getIconLabel(appearance.icon);
      chip.append(svg);
      return chip;
    }
    if (appearance.color) {
      const dot = document.createElement("span");
      dot.className = "youtube-groups__color-dot";
      dot.style.backgroundColor = appearance.color;
      return dot;
    }
    return null;
  }

  const VIDEO_CARD_SELECTOR = [
    "ytd-rich-item-renderer",
    "ytd-video-renderer",
    "ytd-grid-video-renderer",
    "ytd-compact-video-renderer",
    "ytd-playlist-video-renderer",
  ].join(",");

  getGroups().catch((error) => {
    console.error(
      "[YouTube Groups] No se pudo inicializar el almacenamiento",
      error,
    );
  });

  const WATCHED_CLASS = "youtube-groups--watched";
  const VIDEO_ID_ATTRIBUTE = "data-youtube-groups-video-id";

  /** Vídeos vistos en memoria; null hasta cargarlos (sin datos no se marca nada). */
  let watchedVideos = null;

  /** Mensaje del error al leer los vistos; null si no ha fallado. */
  let watchedLoadError = null;

  /** Número de la última operación de vistos iniciada. */
  let watchedWriteSeq = 0;

  /** Número de la última operación de vistos cuyo resultado se aplicó. */
  let watchedAppliedSeq = 0;

  /** Número de la última operación de ajustes iniciada. */
  let settingsWriteSeq = 0;

  /** Número de la última operación de ajustes cuyo resultado se aplicó. */
  let settingsAppliedSeq = 0;

  /** IDs de vídeo cuyo cambio de visto se está guardando. */
  const savingWatchedIds = new Set();

  /** IDs que el marcado automático ya no debe volver a intentar en esta pestaña. */
  const autoMarkHandledIds = new Set();

  /** Ajustes en memoria; valores por defecto hasta cargar los guardados. */
  let settings = YouTubeGroupsSettings.DEFAULT_SETTINGS;

  /**
   * Reaplica la visibilidad a todas las tarjetas de vídeo.
   */
  function applyVisibilityToAllCards() {
    for (const card of document.querySelectorAll(VIDEO_CARD_SELECTOR)) {
      applyCardVisibility(card);
    }
  }

  /** Si los ajustes guardados ya se han leído (habilita los selectores). */
  let settingsLoaded = false;

  /** Mensaje del error al leer los ajustes; null si no ha fallado. */
  let settingsLoadError = null;

  /**
   * Refleja los ajustes en los selectores de la sección "Ajustes" del panel.
   * Los selectores quedan deshabilitados hasta cargar los ajustes.
   * @param {Element|null} [panel] - Panel; por defecto, el que hay en el documento.
   */
  function syncSettingsControls(
    panel = document.getElementById(GROUPS_PANEL_ID),
  ) {
    if (!panel) {
      return;
    }
    const watchedSelect = panel.querySelector(
      ".youtube-groups__watched-mode-select",
    );
    const outsideSelect = panel.querySelector(
      ".youtube-groups__outside-mode-select",
    );
    const autoMarkSelect = panel.querySelector(
      ".youtube-groups__auto-mark-select",
    );
    panel.classList.toggle(
      "youtube-groups--collapsed",
      settings.panelCollapsed,
    );
    const collapseButton = panel.querySelector(
      ".youtube-groups__collapse-button",
    );
    collapseButton.textContent = settings.panelCollapsed ? "+" : "−";
    collapseButton.title = settings.panelCollapsed
      ? "Mostrar panel"
      : "Minimizar panel";
    collapseButton.setAttribute(
      "aria-expanded",
      String(!settings.panelCollapsed),
    );
    collapseButton.disabled = !settingsLoaded;
    watchedSelect.value = settings.watchedMode;
    outsideSelect.value = settings.outsideMode;
    autoMarkSelect.value = String(settings.autoMarkPercent);
    watchedSelect.disabled = !settingsLoaded;
    outsideSelect.disabled = !settingsLoaded;
    autoMarkSelect.disabled = !settingsLoaded;
    if (settingsLoadError !== null) {
      panel.querySelector(".youtube-groups__settings-error").textContent =
        "No se pudieron leer los ajustes: " + settingsLoadError;
    }
  }

  /**
   * Refleja `advancedFilters` en los selectores de la sección "Filtros" y
   * pone el resumen "Filtros (N)" con N criterios activos.
   * @param {Element} panel - Panel de grupos.
   */
  function syncFiltersControls(panel) {
    let active = 0;
    for (const select of panel.querySelectorAll(
      ".youtube-groups__filter-select",
    )) {
      const value = advancedFilters[select.dataset.filter];
      select.value = value;
      if (value !== "any") {
        active += 1;
      }
    }
    panel.querySelector(".youtube-groups__filters summary").textContent =
      active > 0 ? `Filtros (${active})` : "Filtros";
  }

  YouTubeGroupsSettings.getSettings()
    .then((loaded) => {
      settings = loaded;
      settingsLoaded = true;
      applyVisibilityToAllCards();
      syncSettingsControls();
    })
    .catch((error) => {
      settingsLoadError = error.message;
      syncSettingsControls();
      console.error("[YouTube Groups] No se pudieron leer los ajustes", error);
    });

  /**
   * Guarda un cambio de ajuste desde su selector y reaplica la visibilidad.
   * Si falla, el selector vuelve al valor anterior y se muestra el error.
   * @param {HTMLSelectElement} select - Selector que ha cambiado.
   * @param {string} key - Clave del ajuste (`watchedMode`, `outsideMode` o `autoMarkPercent`).
   * @param {HTMLElement} errorElement - Elemento donde mostrar el error.
   * @param {function(string): *} [parse] - Convierte el valor del selector (cadena) al del ajuste.
   * @returns {Promise<void>}
   */
  async function changeSetting(
    select,
    key,
    errorElement,
    parse = (value) => value,
  ) {
    errorElement.textContent = "";
    select.disabled = true;
    settingsWriteSeq += 1;
    const seq = settingsWriteSeq;
    try {
      const result = await YouTubeGroupsSettings.updateSettings({
        [key]: parse(select.value),
      });
      if (seq > settingsAppliedSeq) {
        settingsAppliedSeq = seq;
        settings = result.settings;
        applyVisibilityToAllCards();
      }
    } catch (error) {
      select.value = String(settings[key]);
      errorElement.textContent =
        "No se pudo guardar el ajuste: " + error.message;
      console.error("[YouTube Groups] No se pudo guardar el ajuste", error);
    } finally {
      select.disabled = false;
    }
  }

  /**
   * Busca el ID del vídeo de una tarjeta en su primer enlace válido.
   * @param {Element} card - Tarjeta de vídeo.
   * @returns {string|null} ID de 11 caracteres o null.
   */
  function findVideoId(card) {
    for (const link of card.querySelectorAll("a[href]")) {
      const videoId = YouTubeGroupsWatched.extractVideoId(
        link.getAttribute("href"),
      );
      if (videoId) {
        return videoId;
      }
    }
    return null;
  }

  /**
   * Guarda el ID del vídeo en la tarjeta y marca si está visto.
   * Se reevalúa en cada procesado: YouTube puede reutilizar tarjetas.
   * @param {Element} card - Tarjeta de vídeo.
   */
  function applyWatchedToCard(card) {
    const videoId = findVideoId(card);
    if (videoId) {
      card.setAttribute(VIDEO_ID_ATTRIBUTE, videoId);
    } else {
      card.removeAttribute(VIDEO_ID_ATTRIBUTE);
    }
    const isWatched =
      Boolean(videoId) &&
      watchedVideos !== null &&
      YouTubeGroupsWatched.isVideoWatched(watchedVideos, videoId);
    card.classList.toggle(WATCHED_CLASS, isWatched);
    applyCardVisibility(card);

    const watchedButton = card.querySelector(".youtube-groups__watched-button");
    if (watchedButton) {
      updateWatchedButton(watchedButton, videoId, isWatched);
    }

    const playlistButton = card.querySelector(
      ".youtube-groups__playlist-button",
    );
    if (playlistButton) {
      playlistButton.disabled = !videoId;
    }
  }

  /**
   * Pone el texto, el estado y la disponibilidad de un botón de visto.
   * @param {HTMLButtonElement} button - Botón "Marcar visto".
   * @param {string|null} videoId - ID del vídeo, o null si no se conoce.
   * @param {boolean} isWatched - Si el vídeo está visto.
   */
  function updateWatchedButton(button, videoId, isWatched) {
    button.textContent = isWatched ? "✓ Visto" : "Marcar visto";
    button.setAttribute("aria-pressed", String(isWatched));
    button.disabled =
      !videoId || watchedVideos === null || savingWatchedIds.has(videoId);
    if (watchedLoadError !== null) {
      button.title = "No se pudieron leer los vistos: " + watchedLoadError;
    }
  }

  /**
   * Alterna el estado de visto de un vídeo y reaplica la marca a sus tarjetas.
   * Si falla el guardado, el estado no cambia y el botón recibe el error en `title`.
   * @param {string|null} videoId - ID del vídeo.
   * @param {HTMLButtonElement} button - Botón pulsado.
   * @returns {Promise<void>}
   */
  async function toggleVideoWatched(videoId, button, card = null) {
    if (!videoId || watchedVideos === null || savingWatchedIds.has(videoId)) {
      return;
    }
    savingWatchedIds.add(videoId);
    refreshWatchedUi(videoId, card);
    watchedWriteSeq += 1;
    const seq = watchedWriteSeq;
    try {
      const result = await YouTubeGroupsWatched.setVideoWatched(
        videoId,
        !YouTubeGroupsWatched.isVideoWatched(watchedVideos, videoId),
      );
      if (seq > watchedAppliedSeq) {
        watchedAppliedSeq = seq;
        watchedVideos = result.videos;
      }
      button.removeAttribute("title");
    } catch (error) {
      button.title = "No se pudo guardar: " + error.message;
      console.error("[YouTube Groups] No se pudo guardar el visto", error);
    } finally {
      savingWatchedIds.delete(videoId);
      refreshWatchedUi(videoId, card);
    }
  }

  /**
   * Reaplica el estado de visto a la tarjeta pulsada (si la hay), a las demás
   * tarjetas con ese ID y a la sección "Vídeo actual" del panel.
   * @param {string} videoId - ID del vídeo.
   * @param {Element|null} [pressedCard] - Tarjeta cuyo botón se pulsó.
   */
  function refreshWatchedUi(videoId, pressedCard = null) {
    if (pressedCard) {
      applyWatchedToCard(pressedCard);
    }
    for (const card of document.querySelectorAll(VIDEO_CARD_SELECTOR)) {
      if (
        card !== pressedCard &&
        card.getAttribute(VIDEO_ID_ATTRIBUTE) === videoId
      ) {
        applyWatchedToCard(card);
      }
    }
    renderCurrentVideoSection();
  }

  /**
   * Devuelve el ID del vídeo abierto, solo en páginas /watch.
   * @returns {string|null} ID de 11 caracteres o null.
   */
  function getCurrentWatchVideoId() {
    if (window.location.pathname !== "/watch") {
      return null;
    }
    return YouTubeGroupsWatched.extractVideoId(window.location.href);
  }

  /**
   * Indica si el DOM de /watch ya corresponde al vídeo de la URL. Durante una
   * navegación SPA, `ytd-watch-flexy` puede seguir con el `video-id` anterior.
   * @param {string} videoId - ID del vídeo de la URL.
   * @returns {boolean} false solo si `ytd-watch-flexy` declara otro vídeo.
   */
  function isWatchPageInSync(videoId) {
    const flexyVideoId = document
      .querySelector("ytd-watch-flexy")
      ?.getAttribute("video-id");
    return !flexyVideoId || flexyVideoId === videoId;
  }

  /**
   * Lee del DOM los datos del vídeo abierto en /watch para guardarlo en una lista.
   * Si el DOM aún es del vídeo anterior, devuelve id null y textos vacíos.
   * @returns {{id: string|null, title: string, channelName: string}} Datos del vídeo.
   */
  function getCurrentWatchVideoData() {
    const videoId = getCurrentWatchVideoId();
    if (videoId && !isWatchPageInSync(videoId)) {
      return { id: null, title: "", channelName: "" };
    }
    let title =
      document.querySelector("ytd-watch-metadata h1")?.textContent.trim() ?? "";
    if (!title) {
      title = document.title.replace(/ - YouTube$/, "").trim();
    }

    return {
      id: videoId,
      title,
      channelName: getCurrentVideoChannel()?.name ?? "",
    };
  }

  /**
   * Muestra u oculta la sección "Vídeo actual" del panel y refleja su estado.
   */
  function renderCurrentVideoSection() {
    const panel = document.getElementById("youtube-groups-panel");
    const section = panel?.querySelector(".youtube-groups__current-video");
    if (!section) {
      return;
    }
    const videoId = getCurrentWatchVideoId();
    section.hidden = !videoId;
    if (!videoId) {
      return;
    }
    const isWatched =
      watchedVideos !== null &&
      YouTubeGroupsWatched.isVideoWatched(watchedVideos, videoId);
    updateWatchedButton(
      section.querySelector(".youtube-groups__current-video-button"),
      videoId,
      isWatched,
    );
  }

  /**
   * Marca un vídeo como visto desde el marcado automático.
   * Un error se registra y se muestra en el botón del panel; no se reintenta.
   * @param {string} videoId - ID del vídeo.
   * @returns {Promise<void>}
   */
  async function markVideoWatched(videoId) {
    savingWatchedIds.add(videoId);
    refreshWatchedUi(videoId, null);
    const panelButton = document.querySelector(
      ".youtube-groups__current-video-button",
    );
    watchedWriteSeq += 1;
    const seq = watchedWriteSeq;
    try {
      const result = await YouTubeGroupsWatched.setVideoWatched(videoId, true);
      if (seq > watchedAppliedSeq) {
        watchedAppliedSeq = seq;
        watchedVideos = result.videos;
      }
      panelButton?.removeAttribute("title");
    } catch (error) {
      if (panelButton) {
        panelButton.title = "No se pudo guardar: " + error.message;
      }
      console.error(
        "[YouTube Groups] No se pudo guardar el visto automático",
        error,
      );
    } finally {
      savingWatchedIds.delete(videoId);
      refreshWatchedUi(videoId, null);
    }
  }

  /**
   * Marca como visto el vídeo principal de /watch al alcanzar el porcentaje
   * de reproducción configurado. Escucha `timeupdate` en fase de captura.
   * @param {Event} event - Evento `timeupdate`.
   */
  function handleVideoProgress(event) {
    if (!settingsLoaded) {
      return;
    }
    if (settings.autoMarkPercent === 0) {
      return;
    }
    const video = event.target;
    if (!(video instanceof HTMLVideoElement)) {
      return;
    }
    const player = video.closest("#movie_player");
    if (!player || player.classList.contains("ad-showing")) {
      return;
    }
    const videoId = getCurrentWatchVideoId();
    if (!videoId) {
      return;
    }
    if (!isWatchPageInSync(videoId)) {
      return;
    }
    if (
      watchedVideos === null ||
      YouTubeGroupsWatched.isVideoWatched(watchedVideos, videoId) ||
      savingWatchedIds.has(videoId) ||
      autoMarkHandledIds.has(videoId)
    ) {
      return;
    }
    if (
      !YouTubeGroupsWatched.shouldAutoMark(
        video.currentTime,
        video.duration,
        settings.autoMarkPercent,
      )
    ) {
      return;
    }
    autoMarkHandledIds.add(videoId);
    markVideoWatched(videoId);
  }

  document.addEventListener("timeupdate", handleVideoProgress, true);

  YouTubeGroupsStorage.getWatchedVideos()
    .then((videos) => {
      watchedVideos = videos;
      for (const card of document.querySelectorAll(VIDEO_CARD_SELECTOR)) {
        applyWatchedToCard(card);
      }
      renderCurrentVideoSection();
    })
    .catch((error) => {
      watchedLoadError = error.message;
      for (const card of document.querySelectorAll(VIDEO_CARD_SELECTOR)) {
        applyWatchedToCard(card);
      }
      renderCurrentVideoSection();
      console.error("[YouTube Groups] No se pudieron leer los vistos", error);
    });

  const GROUPS_PANEL_ID = "youtube-groups-panel";
  let activeGroupId = null;
  let activeGroupChannelUrls = null;
  let filterUpdateVersion = 0;

  function getActiveGroupId() {
    return activeGroupId;
  }

  function setActiveGroup(group) {
    const nextGroupId = group?.id ?? null;
    if (activeGroupId === nextGroupId) {
      return;
    }

    activeGroupId = nextGroupId;
    // Reset activeGroupChannelUrls when switching to "Todos" (null group)
    if (nextGroupId === null) {
      activeGroupChannelUrls = null;
    }

    refreshActiveGroupFilter();

    renderGroupsPanel().catch((error) => {
      console.error(
        "[YouTube Groups] No se pudo actualizar el grupo activo",
        error,
      );
    });
  }

  /**
   * Conecta la sección "Limpieza" del panel: analiza el árbol de grupos y,
   * tras confirmar, aplica las limpiezas elegidas.
   * @param {HTMLElement} panel Panel de grupos ya creado.
   */
  function setupCleanupSection(panel) {
    const analyzeButton = panel.querySelector(
      ".youtube-groups__cleanup-analyze",
    );
    const result = panel.querySelector(".youtube-groups__cleanup-result");
    const report = panel.querySelector(".youtube-groups__cleanup-report");
    const duplicatesBox = panel.querySelector(
      ".youtube-groups__cleanup-duplicates",
    );
    const invalidBox = panel.querySelector(".youtube-groups__cleanup-invalid");
    const emptyBox = panel.querySelector(".youtube-groups__cleanup-empty");
    const applyButton = panel.querySelector(".youtube-groups__cleanup-apply");
    const message = panel.querySelector(".youtube-groups__cleanup-message");
    let analysis = null;

    function getChosen() {
      return {
        duplicates: duplicatesBox.checked,
        invalid: invalidBox.checked,
        emptyGroups: emptyBox.checked,
      };
    }

    function countChosen() {
      if (!analysis) {
        return 0;
      }
      const chosen = getChosen();
      return (
        (chosen.duplicates ? analysis.duplicates.length : 0) +
        (chosen.invalid ? analysis.invalid.length : 0) +
        (chosen.emptyGroups ? analysis.emptyGroups.length : 0)
      );
    }

    function syncApplyButton() {
      applyButton.disabled = countChosen() === 0;
    }

    function appendSection(title, items, describe) {
      const heading = document.createElement("h4");
      heading.className = "youtube-groups__cleanup-title";
      heading.textContent = title + ": " + items.length;
      report.append(heading);
      if (items.length === 0) {
        return;
      }
      const list = document.createElement("ul");
      list.className = "youtube-groups__cleanup-list";
      for (const item of items) {
        const entry = document.createElement("li");
        entry.textContent = describe(item);
        list.append(entry);
      }
      report.append(list);
    }

    function renderReport() {
      report.replaceChildren();
      const describeChannel = (item) =>
        item.groupName + " › " + item.name + " (" + item.url + ")";
      appendSection("Canales repetidos", analysis.duplicates, describeChannel);
      appendSection("URL no válidas", analysis.invalid, describeChannel);
      appendSection("Grupos vacíos", analysis.emptyGroups, (item) => item.name);
      result.hidden = false;
      syncApplyButton();
    }

    async function analyze() {
      const groups = await getGroups();
      analysis = YouTubeGroups.analyzeGroups(groups);
      renderReport();
    }

    analyzeButton.addEventListener("click", async () => {
      message.textContent = "";
      try {
        await analyze();
      } catch (error) {
        message.textContent = "No se pudo analizar: " + error.message;
        console.error("[YouTube Groups] No se pudo analizar", error);
      }
    });

    for (const box of [duplicatesBox, invalidBox, emptyBox]) {
      box.addEventListener("change", syncApplyButton);
    }

    applyButton.addEventListener("click", async () => {
      message.textContent = "";
      const total = countChosen();
      if (total === 0) {
        return;
      }
      if (
        !confirm(
          "Se quitarán " + total + " elementos de los grupos. ¿Continuar?",
        )
      ) {
        return;
      }
      applyButton.disabled = true;
      try {
        const { removedGroupIds } =
          await YouTubeGroups.cleanupGroups(getChosen());
        if (removedGroupIds.includes(getActiveGroupId())) {
          setActiveGroup(null);
        }
        await renderGroupsPanel();
        await refreshActiveGroupFilter();
        await analyze();
        message.textContent = "Limpieza hecha.";
      } catch (error) {
        message.textContent = "No se pudo limpiar: " + error.message;
        console.error("[YouTube Groups] No se pudo limpiar", error);
        syncApplyButton();
      }
    });
  }

  function createGroupsPanel() {
    const existingPanel = document.getElementById(GROUPS_PANEL_ID);
    if (existingPanel) {
      return existingPanel;
    }

    if (!document.body) {
      return null;
    }

    const panel = document.createElement("aside");
    panel.id = GROUPS_PANEL_ID;
    panel.setAttribute("aria-label", "YouTube Groups");
    panel.innerHTML = `
          <div class="youtube-groups__header">
            <h2 class="youtube-groups__title">YouTube Groups</h2>
            <button class="youtube-groups__collapse-button" type="button" aria-expanded="true" title="Minimizar panel" disabled>−</button>
            <button class="youtube-groups__create-button action-button primary-button" type="button">Crear grupo</button>
          </div>
          <div class="youtube-groups__options" role="listbox" aria-label="Grupos"></div>
          <section class="youtube-groups__current-channel" hidden>
            <h3 class="youtube-groups__section-title">Canal actual</h3>
            <p class="youtube-groups__channel-name"></p>
            <button class="youtube-groups__add-channel-button action-button secondary-button" type="button">Añadir a un grupo</button>
            <form class="youtube-groups__channel-groups-form" hidden>
              <div class="youtube-groups__channel-groups" aria-label="Seleccionar grupos"></div>
              <div class="youtube-groups__form-actions">
                <button class="youtube-groups__cancel-channel-button action-button noaction-button" type="button">Cancelar</button>
                <button class="youtube-groups__confirm-channel-button action-button primary-button" type="submit">Guardar</button>
              </div>
              <p class="youtube-groups__channel-error" aria-live="polite"></p>
            </form>
          </section>
          <section class="youtube-groups__current-video" hidden>
            <h3 class="youtube-groups__section-title">Vídeo actual</h3>
            <button class="youtube-groups__watched-button youtube-groups__current-video-button action-button secondary-button" type="button">Marcar visto</button>
            <button class="youtube-groups__current-playlist-button action-button secondary-button" type="button">Guardar en lista</button>
          </section>
          <details class="youtube-groups__playlists">
            <summary>Listas</summary>
            <form class="youtube-groups__playlist-form">
              <input class="youtube-groups__playlist-input" type="text" name="playlistName" placeholder="Nueva lista" maxlength="80" required>
              <button class="youtube-groups__playlist-create-button action-button primary-button" type="submit">Crear</button>
            </form>
            <ul class="youtube-groups__playlist-list"></ul>
            <p class="youtube-groups__playlist-error" aria-live="polite"></p>
          </details>
          <details class="youtube-groups__cleanup">
            <summary>Limpieza</summary>
            <button class="youtube-groups__cleanup-analyze action-button secondary-button" type="button">Analizar</button>
            <div class="youtube-groups__cleanup-result" hidden>
              <div class="youtube-groups__cleanup-report"></div>
              <label class="youtube-groups__cleanup-option">
                <input type="checkbox" class="youtube-groups__cleanup-duplicates" checked>
                <span>Unir canales repetidos</span>
              </label>
              <label class="youtube-groups__cleanup-option">
                <input type="checkbox" class="youtube-groups__cleanup-invalid" checked>
                <span>Quitar URL no válidas</span>
              </label>
              <label class="youtube-groups__cleanup-option">
                <input type="checkbox" class="youtube-groups__cleanup-empty">
                <span>Eliminar grupos vacíos</span>
              </label>
              <button class="youtube-groups__cleanup-apply action-button primary-button" type="button" disabled>Limpiar</button>
            </div>
            <p class="youtube-groups__cleanup-message" aria-live="polite"></p>
          </details>
          <details class="youtube-groups__filters">
            <summary>Filtros</summary>
            <label class="youtube-groups__setting">
              <span>Duración</span>
              <select class="youtube-groups__filter-select" data-filter="duration"></select>
            </label>
            <label class="youtube-groups__setting">
              <span>Fecha</span>
              <select class="youtube-groups__filter-select" data-filter="age"></select>
            </label>
            <label class="youtube-groups__setting">
              <span>Popularidad</span>
              <select class="youtube-groups__filter-select" data-filter="views"></select>
            </label>
            <button class="youtube-groups__filters-reset action-button secondary-button" type="button">Quitar filtros</button>
          </details>
          <details class="youtube-groups__settings">
            <summary>Ajustes</summary>
            <label class="youtube-groups__setting">
              <span>Vídeos vistos</span>
              <select class="youtube-groups__watched-mode-select" disabled>
                <option value="show">Mostrar</option>
                <option value="dim">Atenuar</option>
                <option value="hide">Ocultar</option>
              </select>
            </label>
            <label class="youtube-groups__setting">
              <span>Vídeos fuera del filtro</span>
              <select class="youtube-groups__outside-mode-select" disabled>
                <option value="hide">Ocultar</option>
                <option value="dim">Atenuar</option>
              </select>
            </label>
            <label class="youtube-groups__setting">
              <span>Marcar visto al reproducir</span>
              <select class="youtube-groups__auto-mark-select" disabled>
                <option value="0">Desactivado</option>
                <option value="50">Al 50 %</option>
                <option value="80">Al 80 %</option>
                <option value="95">Al 95 %</option>
              </select>
            </label>
            <p class="youtube-groups__settings-error" aria-live="polite"></p>
            <div class="youtube-groups__backup">
              <button class="youtube-groups__backup-export action-button secondary-button" type="button">Exportar copia</button>
              <button class="youtube-groups__backup-import action-button secondary-button" type="button">Importar copia</button>
              <input class="youtube-groups__backup-file" type="file" accept=".json,application/json" hidden>
            </div>
            <p class="youtube-groups__backup-message" aria-live="polite"></p>
          </details>
          <form class="youtube-groups__form" hidden>
            <input class="youtube-groups__input" type="text" name="groupName" placeholder="Nombre del grupo" maxlength="80" required>
            <div class="youtube-groups__form-actions">
              <button class="youtube-groups__cancel-button action-button noaction-button" type="button">Cancelar</button>
              <button class="youtube-groups__confirm-button action-button primary-button" type="submit">Guardar</button>
            </div>
            <p class="youtube-groups__error" aria-live="polite"></p>
          </form>
          <form class="youtube-groups__subgroup-form" hidden>
            <input class="youtube-groups__input" type="text" name="subGroupName" placeholder="Nombre del subgrupo" maxlength="80" required>
            <div class="youtube-groups__form-actions">
              <button class="youtube-subgroups__cancel-button action-button noaction-button" type="button">Cancelar</button>
              <button class="youtube-subgroups__confirm-button action-button primary-button" type="submit">Guardar</button>
            </div>
            <p class="youtube-groups__subgroup-error" aria-live="polite"></p>
          </form>
        `;

    panel
      .querySelector(".youtube-groups__current-video-button")
      .addEventListener("click", (event) => {
        const videoId = getCurrentWatchVideoId();
        if (videoId) {
          autoMarkHandledIds.add(videoId);
        }
        toggleVideoWatched(videoId, event.currentTarget);
      });

    panel
      .querySelector(".youtube-groups__current-playlist-button")
      .addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        openPlaylistForm(getCurrentWatchVideoData(), event.currentTarget);
      });

    const settingsError = panel.querySelector(
      ".youtube-groups__settings-error",
    );
    panel
      .querySelector(".youtube-groups__watched-mode-select")
      .addEventListener("change", (event) => {
        changeSetting(event.currentTarget, "watchedMode", settingsError);
      });
    panel
      .querySelector(".youtube-groups__outside-mode-select")
      .addEventListener("change", (event) => {
        changeSetting(event.currentTarget, "outsideMode", settingsError);
      });
    panel
      .querySelector(".youtube-groups__auto-mark-select")
      .addEventListener("change", (event) => {
        changeSetting(
          event.currentTarget,
          "autoMarkPercent",
          settingsError,
          Number,
        );
      });
    panel
      .querySelector(".youtube-groups__collapse-button")
      .addEventListener("click", async (event) => {
        const button = event.currentTarget;
        button.disabled = true;
        settingsWriteSeq += 1;
        const seq = settingsWriteSeq;
        try {
          const result = await YouTubeGroupsSettings.updateSettings({
            panelCollapsed: !settings.panelCollapsed,
          });
          if (seq > settingsAppliedSeq) {
            settingsAppliedSeq = seq;
            settings = result.settings;
          }
        } catch (error) {
          settingsError.textContent =
            "No se pudo guardar el ajuste: " + error.message;
          console.error("[YouTube Groups] No se pudo guardar el ajuste", error);
        } finally {
          syncSettingsControls();
        }
      });
    syncSettingsControls(panel);

    const backupMessage = panel.querySelector(
      ".youtube-groups__backup-message",
    );
    const backupFile = panel.querySelector(".youtube-groups__backup-file");
    panel
      .querySelector(".youtube-groups__backup-export")
      .addEventListener("click", async () => {
        backupMessage.textContent = "";
        try {
          const text = await YouTubeGroupsBackup.exportBackup();
          const blob = new Blob([text], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download =
            "youtube-groups-" + new Date().toISOString().slice(0, 10) + ".json";
          document.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 10000);
        } catch (error) {
          backupMessage.textContent = error.message;
          console.error("[YouTube Groups] No se pudo exportar", error);
        }
      });
    panel
      .querySelector(".youtube-groups__backup-import")
      .addEventListener("click", () => {
        backupFile.click();
      });
    backupFile.addEventListener("change", async () => {
      const file = backupFile.files[0];
      if (!file) {
        return;
      }
      backupMessage.textContent = "";
      try {
        if (
          !confirm(
            "Se reemplazarán los grupos, vistos, ajustes y listas de este navegador. ¿Continuar?",
          )
        ) {
          return;
        }
        const text = await file.text();
        const { dropped } = await YouTubeGroupsBackup.importBackup(text);
        backupMessage.textContent =
          dropped > 0
            ? "Copia importada (" + dropped + " entradas descartadas)."
            : "Copia importada.";
      } catch (error) {
        backupMessage.textContent = error.message;
      } finally {
        backupFile.value = "";
      }
    });

    panel
      .querySelector(".youtube-groups__playlist-form")
      .addEventListener("submit", async (event) => {
        event.preventDefault();
        const playlistInput = panel.querySelector(
          ".youtube-groups__playlist-input",
        );
        const playlistError = panel.querySelector(
          ".youtube-groups__playlist-error",
        );
        playlistError.textContent = "";
        try {
          await YouTubeGroupsPlaylists.createPlaylist(playlistInput.value);
          playlistInput.value = "";
          await renderPlaylistsSection();
        } catch (exception) {
          playlistError.textContent = exception.message;
        }
      });
    renderPlaylistsSection();
    setupCleanupSection(panel);

    const filterSelects = panel.querySelectorAll(
      ".youtube-groups__filter-select",
    );
    for (const select of filterSelects) {
      const key = select.dataset.filter;
      for (const option of YouTubeGroupsMetadata.FILTER_OPTIONS[key]) {
        const optionElement = document.createElement("option");
        optionElement.value = option.id;
        optionElement.textContent = option.label;
        select.append(optionElement);
      }
      select.addEventListener("change", () => {
        advancedFilters[key] = select.value;
        syncFiltersControls(panel);
        applyVisibilityToAllCards();
      });
    }
    panel
      .querySelector(".youtube-groups__filters-reset")
      .addEventListener("click", () => {
        for (const key of Object.keys(advancedFilters)) {
          advancedFilters[key] = "any";
        }
        syncFiltersControls(panel);
        applyVisibilityToAllCards();
      });
    syncFiltersControls(panel);

    const form = panel.querySelector(".youtube-groups__form");
    const input = panel.querySelector(".youtube-groups__input");
    const error = panel.querySelector(".youtube-groups__error");
    const subgroupForm = panel.querySelector(".youtube-groups__subgroup-form");
    const subgroupInput = panel.querySelector(
      ".youtube-groups__input[name='subGroupName']",
    );
    const subgroupError = panel.querySelector(
      ".youtube-groups__subgroup-error",
    );
    const currentChannelForm = panel.querySelector(
      ".youtube-groups__channel-groups-form",
    );
    const currentChannelError = panel.querySelector(
      ".youtube-groups__channel-error",
    );

    panel
      .querySelector(".youtube-groups__create-button")
      .addEventListener("click", () => {
        form.hidden = false;
        error.textContent = "";
        input.focus();
      });

    panel
      .querySelector(".youtube-groups__cancel-button")
      .addEventListener("click", () => {
        form.reset();
        form.hidden = true;
        error.textContent = "";
      });

    panel
      .querySelector(".youtube-groups__add-channel-button")
      .addEventListener("click", () => {
        currentChannelForm.hidden = false;
        currentChannelError.textContent = "";
      });

    panel
      .querySelector(".youtube-groups__cancel-channel-button")
      .addEventListener("click", () => {
        currentChannelForm.hidden = true;
        currentChannelError.textContent = "";
      });

    // Subgroup form handlers
    panel
      .querySelector(".youtube-subgroups__cancel-button")
      .addEventListener("click", () => {
        subgroupForm.reset();
        subgroupForm.hidden = true;
        subgroupError.textContent = "";
      });

    subgroupForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      subgroupError.textContent = "";

      try {
        // Validación adicional
        const subGroupName = subgroupInput.value.trim();
        if (subGroupName.length < 2) {
          subgroupError.textContent =
            "El nombre del subgrupo debe tener al menos 2 caracteres";
          return;
        }

        if (subGroupName.length > 80) {
          subgroupError.textContent =
            "El nombre del subgrupo no puede exceder 80 caracteres";
          return;
        }

        // We need to get the parent group ID - this will be set when the form is shown
        const parentGroupId = subgroupForm.dataset.parentGroupId;
        if (!parentGroupId) {
          subgroupError.textContent = "No se pudo identificar el grupo padre";
          return;
        }

        await createSubGroup(parentGroupId, subgroupInput.value);
        subgroupForm.reset();
        subgroupForm.hidden = true;
        await renderGroupsPanel();

        // Feedback visual
        const createSubGroupButton = panel.querySelector(
          ".youtube-groups__create-subgroup-button",
        );
        createSubGroupButton.textContent = "✓ Subgrupo creado";
        setTimeout(() => {
          createSubGroupButton.textContent = "+ Subgrupo";
        }, 2000);
      } catch (exception) {
        subgroupError.textContent = exception.message;
      }
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      error.textContent = "";

      try {
        // Validación adicional
        const groupName = input.value.trim();
        if (groupName.length < 2) {
          error.textContent =
            "El nombre del grupo debe tener al menos 2 caracteres";
          return;
        }

        if (groupName.length > 80) {
          error.textContent =
            "El nombre del grupo no puede exceder 80 caracteres";
          return;
        }

        await createGroup(input.value);
        form.reset();
        form.hidden = true;
        await renderGroupsPanel();

        // Feedback visual
        const createButton = panel.querySelector(
          ".youtube-groups__create-button",
        );
        createButton.textContent = "✓ Grupo creado";
        setTimeout(() => {
          createButton.textContent = "Crear grupo";
        }, 2000);
      } catch (exception) {
        error.textContent = exception.message;
      }
    });

    currentChannelForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      currentChannelError.textContent = "";

      const channel = getCurrentVideoChannel();
      const selectedGroupIds = new Set(
        Array.from(
          currentChannelForm.querySelectorAll("input:checked"),
          (input) => input.value,
        ),
      );

      if (!channel) {
        currentChannelError.textContent =
          "No se ha podido identificar el canal actual.";
        return;
      }

      const submitButton = currentChannelForm.querySelector(
        ".youtube-groups__confirm-channel-button",
      );
      const originalText = submitButton.textContent;
      submitButton.textContent = "Guardando...";
      submitButton.disabled = true;

      try {
        await setChannelGroups(channel, selectedGroupIds);
        await renderGroupsPanel();
        await refreshActiveGroupFilter();

        currentChannelError.textContent = "Canales asignados correctamente";
        setTimeout(() => {
          currentChannelError.textContent = "";
        }, 3000);
      } catch (exception) {
        currentChannelError.textContent = exception.message;
      } finally {
        submitButton.textContent = originalText;
        submitButton.disabled = false;
      }
    });

    document.body.append(panel);
    return panel;
  }

  /**
   * Muestra un error en la sección "Listas" del panel.
   *
   * @param {Error|string} error - Error o mensaje a mostrar.
   */
  function showPlaylistError(error) {
    const errorElement = document.querySelector(
      `#${GROUPS_PANEL_ID} .youtube-groups__playlist-error`,
    );
    if (errorElement) {
      errorElement.textContent =
        error instanceof Error ? error.message : String(error);
    }
  }

  /**
   * Cierra el modal de vídeos de una lista, si está abierto.
   */
  function closePlaylistModal() {
    document
      .querySelector(".youtube-groups__channel-list-modal--playlist")
      ?.remove();
  }

  /**
   * Abre (o repinta) el modal con los vídeos de una lista.
   *
   * @param {string} playlistId - ID de la lista a mostrar.
   */
  async function openPlaylistVideosModal(playlistId) {
    const playlists = await YouTubeGroupsStorage.getPlaylists();
    const playlist = playlists.find((item) => item.id === playlistId);
    closePlaylistModal();
    if (!playlist) {
      return;
    }

    const modal = document.createElement("div");
    modal.className =
      "youtube-groups__channel-list-modal youtube-groups__channel-list-modal--playlist";
    modal.dataset.playlistId = playlistId;
    const content = document.createElement("div");
    content.className = "youtube-groups__channel-list-content";

    const header = document.createElement("div");
    header.className = "youtube-groups__channel-list-header";
    const headerTitle = document.createElement("h3");
    headerTitle.textContent = "Vídeos de la lista";
    const closeButton = document.createElement("button");
    closeButton.className = "youtube-groups__close-channels-button";
    closeButton.type = "button";
    closeButton.textContent = "×";
    closeButton.addEventListener("click", closePlaylistModal);
    header.append(headerTitle, closeButton);

    const listTitle = document.createElement("h4");
    listTitle.textContent = `${playlist.name} (${playlist.videos.length})`;

    const list = document.createElement("ul");
    for (const video of playlist.videos) {
      const item = document.createElement("li");
      item.className = "youtube-groups__playlist-video";
      const url = YouTubeGroupsPlaylists.buildVideoUrl(video.id);
      const title = video.title || video.id;
      let titleElement;
      if (url) {
        titleElement = document.createElement("a");
        titleElement.href = url;
      } else {
        titleElement = document.createElement("span");
      }
      titleElement.textContent = title;
      const channel = document.createElement("span");
      channel.className = "youtube-groups__playlist-video-channel";
      channel.textContent = video.channelName;
      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className =
        "youtube-groups__playlist-remove-button action-button noaction-button";
      removeButton.textContent = "Quitar";
      removeButton.addEventListener("click", async () => {
        try {
          await YouTubeGroupsPlaylists.removeVideoFromPlaylist(
            playlistId,
            video.id,
          );
          await openPlaylistVideosModal(playlistId);
          await renderPlaylistsSection();
        } catch (exception) {
          showPlaylistError(exception);
        }
      });
      item.append(titleElement, channel, removeButton);
      list.append(item);
    }

    content.append(header, listTitle, list);
    modal.append(content);
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        closePlaylistModal();
      }
    });
    document.body.append(modal);
  }

  /**
   * Pinta la lista de listas de vídeos en la sección "Listas" del panel.
   */
  async function renderPlaylistsSection() {
    const panel = document.getElementById(GROUPS_PANEL_ID);
    const listElement = panel?.querySelector(".youtube-groups__playlist-list");
    if (!listElement) {
      return;
    }

    let playlists;
    try {
      playlists = await YouTubeGroupsStorage.getPlaylists();
    } catch (exception) {
      showPlaylistError(exception);
      return;
    }
    listElement.replaceChildren();

    for (const playlist of playlists) {
      const item = document.createElement("li");
      item.className = "youtube-groups__playlist-item";

      const label = document.createElement("span");
      label.className = "youtube-groups__playlist-name";
      label.textContent = `${playlist.name} (${playlist.videos.length})`;

      const actions = document.createElement("div");
      actions.className = "youtube-groups__playlist-actions";

      const viewButton = document.createElement("button");
      viewButton.type = "button";
      viewButton.className = "action-button secondary-button";
      viewButton.textContent = "Ver";
      viewButton.addEventListener("click", async () => {
        try {
          await openPlaylistVideosModal(playlist.id);
        } catch (exception) {
          showPlaylistError(exception);
        }
      });
      actions.append(viewButton);

      const playUrl = YouTubeGroupsPlaylists.buildPlayAllUrl(playlist);
      if (playUrl) {
        const playLink = document.createElement("a");
        playLink.className =
          "youtube-groups__playlist-play action-button secondary-button";
        playLink.href = playUrl;
        playLink.textContent = "Reproducir";
        actions.append(playLink);
      }

      const renameButton = document.createElement("button");
      renameButton.type = "button";
      renameButton.className = "action-button secondary-button";
      renameButton.textContent = "Renombrar";
      renameButton.addEventListener("click", async () => {
        const newName = prompt("Nuevo nombre de la lista:", playlist.name);
        if (newName === null) {
          return;
        }
        try {
          await YouTubeGroupsPlaylists.renamePlaylist(playlist.id, newName);
          await renderPlaylistsSection();
        } catch (exception) {
          showPlaylistError(exception);
        }
      });

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "action-button noaction-button";
      deleteButton.textContent = "Eliminar";
      deleteButton.addEventListener("click", async () => {
        if (
          !confirm(
            `¿Estás seguro de que quieres eliminar la lista "${playlist.name}"?`,
          )
        ) {
          return;
        }
        try {
          await YouTubeGroupsPlaylists.deletePlaylist(playlist.id);
          closePlaylistModal();
          await renderPlaylistsSection();
        } catch (exception) {
          showPlaylistError(exception);
        }
      });
      actions.append(renameButton, deleteButton);

      item.append(label, actions);
      listElement.append(item);
    }
  }

  async function renderGroupsPanel() {
    const panel = createGroupsPanel();
    if (!panel) {
      return;
    }

    const options = panel.querySelector(".youtube-groups__options");
    // Get groups FIRST, before any early returns
    const groups = await getGroups();
    options.replaceChildren();

    const allOption = document.createElement("button");
    allOption.type = "button";
    allOption.className = "youtube-groups__option";
    allOption.textContent = "Todos";
    allOption.setAttribute("aria-pressed", String(getActiveGroupId() === null));
    allOption.addEventListener("click", () => setActiveGroup(null));
    options.append(allOption);

    // Función auxiliar para renderizar grupos y subgrupos
    function renderGroupWithSubGroups(group, level = 0) {
      const groupOption = document.createElement("button");
      groupOption.type = "button";
      groupOption.className = "youtube-groups__option";
      const mark = createGroupMark(groups, group.id, 16);
      if (mark) {
        groupOption.appendChild(mark);
      }

      var nameSpan = document.createElement("span");
      nameSpan.className = "youtube-groups__option-name";
      nameSpan.textContent = group.name;
      groupOption.appendChild(nameSpan);
      groupOption.setAttribute(
        "aria-pressed",
        String(getActiveGroupId() === group.id),
      );
      groupOption.setAttribute("data-level", level); // Para estilos jerárquicos

      // Añadir ícono de grupo/subgrupo
      if (group.type === "subgroup") {
        groupOption.style.fontStyle = "italic";
        groupOption.style.color = "#666";
      }

      // Añadir contador de canales
      if (group.channels && group.channels.length > 0) {
        const channelCount = document.createElement("span");
        channelCount.className = "youtube-groups__channel-count";
        channelCount.textContent = ` (${group.channels.length})`;
        groupOption.appendChild(channelCount);
      }

      // Añadir indentación visual para subgrupos
      if (level > 0) {
        groupOption.style.paddingLeft = `${12 + level * 16}px`;
        groupOption.style.fontStyle = "italic";
      }

      // Añadir botones de edición y eliminación
      const editButton = document.createElement("button");
      editButton.className =
        "youtube-groups__edit-button action-button secondary-button";
      editButton.textContent = "Editar";
      editButton.addEventListener("click", async (event) => {
        event.stopPropagation();
        const newName = prompt("Nuevo nombre del grupo:", group.name);
        if (newName !== null) {
          try {
            await renameGroup(group.id, newName);
            await renderGroupsPanel();
          } catch (exception) {
            alert(exception.message);
          }
        }
      });

      const deleteButton = document.createElement("button");
      deleteButton.className =
        "youtube-groups__delete-button action-button noaction-button";
      deleteButton.textContent = "Eliminar";
      deleteButton.setAttribute("aria-label", `Eliminar grupo ${group.name}`);
      deleteButton.addEventListener("click", async (event) => {
        event.stopPropagation();

        if (
          confirm(
            `¿Estás seguro de que quieres eliminar el grupo "${group.name}"?`,
          )
        ) {
          try {
            const removedIds = await deleteGroup(group.id);
            if (removedIds.includes(getActiveGroupId())) {
              setActiveGroup(null);
            } else if (getActiveGroupId()) {
              await refreshActiveGroupFilter();
            }
            await renderGroupsPanel();
          } catch (exception) {
            alert(exception.message);
          }
        }
      });

      // Botón para crear subgrupo (solo para grupos principales)
      if (group.type !== "subgroup") {
        const createSubGroupButton = document.createElement("button");
        createSubGroupButton.className =
          "youtube-groups__create-subgroup-button action-button secondary-button";
        createSubGroupButton.textContent = "+ Subgrupo";
        createSubGroupButton.setAttribute(
          "aria-label",
          `Crear subgrupo en ${group.name}`,
        );
        createSubGroupButton.addEventListener("click", async (event) => {
          event.stopPropagation();
          // Show the subgroup form instead of using prompt
          const subgroupForm = panel.querySelector(
            ".youtube-groups__subgroup-form",
          );
          const subgroupInput = panel.querySelector(
            ".youtube-groups__input[name='subGroupName']",
          );
          const subgroupError = panel.querySelector(
            ".youtube-groups__subgroup-error",
          );

          subgroupForm.hidden = false;
          subgroupForm.dataset.parentGroupId = group.id;
          subgroupError.textContent = "";
          subgroupInput.focus();
        });

        groupOption.appendChild(createSubGroupButton);
      }

      // Add view channels button - only for user-created groups (not "Todos")
      const viewChannelsButton = document.createElement("button");
      viewChannelsButton.className =
        "youtube-groups__view-channels-button action-button secondary-button";
      viewChannelsButton.textContent = "Ver canales";
      viewChannelsButton.setAttribute(
        "aria-label",
        `Ver canales del grupo ${group.name}`,
      );
      // In the "Ver canales" button click handler:
      viewChannelsButton.addEventListener("click", async (event) => {
        event.stopPropagation();

        try {
          // Obtener todos los grupos y subgrupos para localizar también subgrupos
          const groupsData = await getAllGroupsAndSubGroups();
          const targetGroup = groupsData.find((g) => g.id === group.id);
          if (
            targetGroup &&
            targetGroup.channels &&
            targetGroup.channels.length > 0
          ) {
            console.log(
              "[YouTube Groups][VIEW CHANNELS] Grupo:",
              targetGroup.name,
              "Canales:",
              targetGroup.channels.length,
            );

            // Check if modal already exists
            const existingModal = document.querySelector(
              ".youtube-groups__channel-list-modal",
            );
            if (existingModal) {
              document.body.removeChild(existingModal);
            }

            const modal = document.createElement("div");
            modal.className = "youtube-groups__channel-list-modal";

            const content = document.createElement("div");
            content.className = "youtube-groups__channel-list-content";

            const header = document.createElement("div");
            header.className = "youtube-groups__channel-list-header";
            const headerTitle = document.createElement("h3");
            headerTitle.textContent = "Lista de Canales";
            const closeButton = document.createElement("button");
            closeButton.className = "youtube-groups__close-channels-button";
            closeButton.type = "button";
            closeButton.textContent = "×";
            header.append(headerTitle, closeButton);

            const listTitle = document.createElement("h4");
            listTitle.textContent = `Canales en "${targetGroup.name}" (${targetGroup.channels.length})`;

            const list = document.createElement("ul");
            for (const channel of targetGroup.channels) {
              const item = document.createElement("li");
              const channelName = document.createElement("strong");
              channelName.textContent = channel.name;
              item.append(
                channelName,
                document.createElement("br"),
                channel.url,
              );
              list.appendChild(item);
            }

            content.append(header, listTitle, list);
            modal.appendChild(content);
            document.body.appendChild(modal);

            // Add close functionality
            closeButton.addEventListener("click", () => {
              document.body.removeChild(modal);
            });

            // Close when clicking outside
            modal.addEventListener("click", (event) => {
              if (event.target === modal) {
                document.body.removeChild(modal);
              }
            });
          } else {
            console.log(
              "[YouTube Groups][VIEW CHANNELS] Grupo:",
              targetGroup.name,
              "Sin canales",
            );
            alert(`El grupo "${targetGroup.name}" no tiene canales.`);
          }
        } catch (exception) {
          console.error(
            "[YouTube Groups][VIEW CHANNELS] Error mostrando canales:",
            exception,
          );
          alert("Error al mostrar los canales del grupo.");
        }
      });

      groupOption.appendChild(viewChannelsButton);
      // --- Icon Picker (singleton lazy) ---
      const iconButton = document.createElement("button");
      iconButton.className =
        "youtube-groups__icon-button action-button secondary-button";
      iconButton.textContent = "Icono";
      iconButton.setAttribute("aria-label", "Cambiar icono de " + group.name);
      iconButton.addEventListener("click", async (event) => {
        event.stopPropagation();
        openIconPicker(group, iconButton);
      });
      groupOption.appendChild(iconButton);
      groupOption.appendChild(editButton);
      groupOption.appendChild(deleteButton);
      groupOption.addEventListener("click", () => setActiveGroup(group));
      options.append(groupOption);

      // Renderizar subgrupos si existen
      if (group.subgroups && group.subgroups.length > 0) {
        group.subgroups.forEach((subgroup) => {
          renderGroupWithSubGroups(subgroup, level + 1);
        });
      }
    }

    // Renderizar todos los grupos y subgrupos
    groups.forEach((group) => {
      if (group.type !== "subgroup") {
        // Solo renderizar grupos principales
        renderGroupWithSubGroups(group, 0);
      }
    });

    renderCurrentChannelSection(groups);
    renderCurrentVideoSection();
    renderGuideSection(groups);
  }

  const GUIDE_SECTIONS_SELECTOR = "ytd-guide-renderer #sections";
  const GUIDE_SECTION_ID = "youtube-groups-guide";

  /** Si ya hay una comprobación de la guía programada para el próximo frame. */
  let guideCheckScheduled = false;

  /**
   * Crea un botón de la sección "Grupos" de la guía lateral.
   * @param {string} label - Texto del botón.
   * @param {boolean} pressed - Si es el filtro activo.
   * @param {number} level - Nivel de sangría (0 = primer nivel).
   * @param {HTMLElement|null} mark - Marca del grupo, si la tiene.
   * @param {function(): void} onClick - Acción al pulsar.
   * @returns {HTMLButtonElement} Botón creado.
   */
  function createGuideButton(label, pressed, level, mark, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "youtube-groups__guide-item";
    button.setAttribute("aria-pressed", String(pressed));
    if (level > 0) {
      button.style.paddingLeft = `${24 + level * 16}px`;
    }
    if (mark) {
      button.append(mark);
    }
    const name = document.createElement("span");
    name.className = "youtube-groups__guide-name";
    name.textContent = label;
    button.append(name);
    button.addEventListener("click", onClick);
    return button;
  }

  /**
   * Pinta la sección "Grupos" en la guía lateral de YouTube. Si la guía no
   * existe, no hace nada; si la sección ya existe, la reutiliza.
   * @param {Array<Object>} groups - Árbol de grupos.
   */
  function renderGuideSection(groups) {
    const container = document.querySelector(GUIDE_SECTIONS_SELECTOR);
    if (!container) {
      return;
    }
    let section = document.getElementById(GUIDE_SECTION_ID);
    if (!section) {
      section = document.createElement("div");
      section.id = GUIDE_SECTION_ID;
      section.className = "youtube-groups__guide";
      const firstSection = container.querySelector(
        ":scope > ytd-guide-section-renderer",
      );
      if (firstSection) {
        firstSection.after(section);
      } else {
        container.prepend(section);
      }
    } else if (!section.isConnected || section.parentElement !== container) {
      container.prepend(section);
    }

    const title = document.createElement("h3");
    title.className = "youtube-groups__guide-title";
    title.textContent = "Grupos";
    const items = [
      createGuideButton("Todos", getActiveGroupId() === null, 0, null, () =>
        setActiveGroup(null),
      ),
    ];
    for (const { id, name, level } of YouTubeGroups.flattenGroups(groups)) {
      items.push(
        createGuideButton(
          name,
          getActiveGroupId() === id,
          level,
          createGroupMark(groups, id, 24),
          () => setActiveGroup({ id }),
        ),
      );
    }
    section.replaceChildren(title, ...items);
  }

  /**
   * Programa, como mucho una vez por frame, el pintado de la sección de la
   * guía cuando esta aparece tarde. Solo lee los grupos si hay contenedor.
   */
  function scheduleGuideCheck() {
    if (guideCheckScheduled) {
      return;
    }
    guideCheckScheduled = true;
    requestAnimationFrame(() => {
      guideCheckScheduled = false;
      if (
        !document.querySelector(GUIDE_SECTIONS_SELECTOR) ||
        document.getElementById(GUIDE_SECTION_ID)?.isConnected
      ) {
        return;
      }
      getGroups()
        .then((groups) => renderGuideSection(groups))
        .catch((error) => {
          console.error(
            "[YouTube Groups] No se pudo pintar la guía lateral",
            error,
          );
        });
    });
  }

  // URL del canal pintado por última vez en la sección "Canal actual".
  let renderedCurrentChannelUrl = null;

  function renderCurrentChannelSection(groups) {
    const panel = document.getElementById(GROUPS_PANEL_ID);
    if (!panel) {
      return;
    }

    const currentChannelSection = panel.querySelector(
      ".youtube-groups__current-channel",
    );
    const currentChannelName = panel.querySelector(
      ".youtube-groups__channel-name",
    );
    const currentChannelGroups = panel.querySelector(
      ".youtube-groups__channel-groups",
    );
    const currentChannelForm = panel.querySelector(
      ".youtube-groups__channel-groups-form",
    );

    const channel = getCurrentVideoChannel();
    renderedCurrentChannelUrl = channel ? channel.url : null;
    currentChannelSection.hidden = !channel;
    currentChannelForm.hidden = true;
    currentChannelGroups.replaceChildren();

    if (!channel) {
      return;
    }

    currentChannelName.textContent = channel.name;

    renderChannelGroupChoices(
      currentChannelGroups,
      groups,
      channel.url,
      "youtube-groups__group-choice",
    );
  }

  // Pinta el árbol de casillas de grupos y subgrupos para un canal. Lo usan el
  // panel y el desplegable de las tarjetas. Sin grupos, muestra un aviso y
  // deshabilita el botón Guardar del formulario que contiene el contenedor.
  function renderChannelGroupChoices(
    container,
    groups,
    channelUrl,
    choiceClassName,
  ) {
    container.replaceChildren();

    const submitButton = container
      .closest("form")
      ?.querySelector("button[type='submit']");

    if (groups.length === 0) {
      const message = document.createElement("p");
      message.className = "youtube-groups__empty-choices";
      message.textContent = "Crea un grupo en el panel para añadir canales.";
      container.append(message);
      if (submitButton) {
        submitButton.disabled = true;
      }
      return;
    }

    if (submitButton) {
      submitButton.disabled = false;
    }

    function renderLevel(groupsArray, level) {
      for (const group of groupsArray) {
        const label = document.createElement("label");
        label.className = choiceClassName;

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = group.id;
        checkbox.checked = group.channels.some(
          (item) => item.url === channelUrl,
        );

        const groupName = document.createElement("span");
        groupName.textContent = group.name;
        if (level > 0) {
          groupName.style.marginLeft = `${level * 12}px`;
        }

        const mark = createGroupMark(groups, group.id, 16);
        if (mark) {
          label.append(checkbox, mark, groupName);
        } else {
          label.append(checkbox, groupName);
        }
        container.append(label);

        if (group.subgroups && group.subgroups.length > 0) {
          renderLevel(group.subgroups, level + 1);
        }
      }
    }

    renderLevel(groups, 0);
  }

  // Añadir nueva función para obtener todos los canales de un grupo y sus subgrupos
  async function getAllChannelsFromGroup(groupId) {
    const groups = await getGroups();
    const group = groups.find((item) => item.id === groupId);

    if (!group) {
      return [];
    }

    // Función recursiva para obtener todos los canales
    function collectChannels(group) {
      let channels = [...group.channels];

      if (group.subgroups && group.subgroups.length > 0) {
        group.subgroups.forEach((subgroup) => {
          channels = channels.concat(collectChannels(subgroup));
        });
      }

      return channels;
    }

    return collectChannels(group);
  }

  let detectedCards = new WeakMap();
  const pendingCards = new Set();
  let processingScheduled = false;

  const { normalizeChannelUrl } = YouTubeGroups;

  function getChannelName(link) {
    return (
      link.textContent.trim() ||
      link.getAttribute("aria-label")?.trim() ||
      link.getAttribute("title")?.trim() ||
      ""
    );
  }

  // Enlace con nombre y URL de canal de una tarjeta
  function findChannelLink(card) {
    for (const link of card.querySelectorAll("a[href]")) {
      if (getChannelName(link) && normalizeChannelUrl(link.href)) {
        return link;
      }
    }

    return null;
  }

  function getChannelFromCard(card) {
    const link = findChannelLink(card);

    return link
      ? { name: getChannelName(link), url: normalizeChannelUrl(link.href) }
      : null;
  }

  /**
   * Crea el control de una tarjeta.
   * @param {Element} card Tarjeta sobre la que va el control.
   * @param {{videoButtons?: boolean, channel?: {name: string, url: string}}} [options]
   *   `videoButtons: false` deja solo "Añadir a grupo"; `channel` fija el canal
   *   en lugar de leerlo de la tarjeta al pulsar.
   * @returns {HTMLElement} Control con los botones.
   */
  function createSubscriptionChannelControl(card, options = {}) {
    const { videoButtons = true, channel = null } = options;
    const control = document.createElement("span");
    control.className = "youtube-groups__subscription-control";

    const button = document.createElement("button");
    button.className =
      "youtube-groups__subscription-add-button action-button primary-button";
    button.type = "button";
    button.textContent = "Añadir a grupo";
    control.appendChild(button);

    // Evitar que los clics sobre el control naveguen o abran otros menús de YouTube
    control.addEventListener("mousedown", (event) => {
      event.stopPropagation();
    });

    control.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      // El canal se lee de la tarjeta al abrir, no al crear el control
      openSubscriptionGroupsForm(channel || getChannelFromCard(card), button);
    });

    if (!videoButtons) {
      return control;
    }

    const watchedButton = document.createElement("button");
    watchedButton.className =
      "youtube-groups__watched-button action-button secondary-button";
    watchedButton.type = "button";
    const initialVideoId = findVideoId(card);
    updateWatchedButton(
      watchedButton,
      initialVideoId,
      Boolean(initialVideoId) &&
        watchedVideos !== null &&
        YouTubeGroupsWatched.isVideoWatched(watchedVideos, initialVideoId),
    );
    control.appendChild(watchedButton);

    watchedButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      // El ID se lee de la tarjeta al pulsar: YouTube puede reutilizarla
      toggleVideoWatched(findVideoId(card), watchedButton, card);
    });

    const playlistButton = document.createElement("button");
    playlistButton.className =
      "youtube-groups__playlist-button action-button secondary-button";
    playlistButton.type = "button";
    playlistButton.textContent = "Lista";
    playlistButton.disabled = !initialVideoId;
    control.appendChild(playlistButton);

    playlistButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      // Los datos se leen de la tarjeta al abrir: YouTube puede reutilizarla
      openPlaylistForm(getVideoDataFromCard(card), playlistButton);
    });

    return control;
  }

  // Dropdown flotante único, anclado a document.body para evitar que YouTube
  // recorte el selector dentro del flujo de la tarjeta (overflow).
  let subscriptionDropdown = null;
  let subscriptionDropdownOpenCount = 0;
  let subscriptionDropdownListenersAdded = false;

  function getOrCreateSubscriptionDropdown() {
    if (!subscriptionDropdown || !subscriptionDropdown.isConnected) {
      subscriptionDropdown = createSubscriptionDropdown();
      document.body.appendChild(subscriptionDropdown);
    }

    // Los escuchadores se registran una sola vez aunque el elemento se recree
    if (!subscriptionDropdownListenersAdded) {
      subscriptionDropdownListenersAdded = true;

      // Cerrar dropdown al hacer clic fuera de él
      document.addEventListener("mousedown", (event) => {
        if (
          subscriptionDropdown &&
          !subscriptionDropdown.contains(event.target)
        ) {
          const form = subscriptionDropdown.querySelector(
            ".youtube-groups__subscription-groups-form",
          );
          if (form) {
            form.hidden = true;
          }
        }
      });

      // Cerrar dropdown al hacer scroll para evitar posiciones obsoletas
      window.addEventListener(
        "scroll",
        () => {
          if (subscriptionDropdown) {
            const form = subscriptionDropdown.querySelector(
              ".youtube-groups__subscription-groups-form",
            );
            if (form) {
              form.hidden = true;
            }
          }
        },
        { passive: true },
      );
    }

    return subscriptionDropdown;
  }

  // Posiciona el desplegable junto al botón pulsado, sin salirse de la ventana
  function positionSubscriptionDropdown(dropdown, form, anchorButton) {
    const rect = anchorButton.getBoundingClientRect();
    const formRect = form.getBoundingClientRect();
    let left = rect.left;
    let top = rect.bottom + 6;

    if (top + formRect.height > window.innerHeight) {
      top = rect.top - formRect.height - 6;
    }
    if (left + formRect.width > window.innerWidth) {
      left = window.innerWidth - formRect.width - 6;
    }
    dropdown.style.left = `${Math.max(left, 6)}px`;
    dropdown.style.top = `${Math.max(top, 6)}px`;
  }

  function openSubscriptionGroupsForm(channel, anchorButton) {
    const dropdown = getOrCreateSubscriptionDropdown();
    const form = dropdown.querySelector(
      ".youtube-groups__subscription-groups-form",
    );
    const groupsContainer = dropdown.querySelector(
      ".youtube-groups__subscription-groups",
    );
    const error = dropdown.querySelector(".youtube-groups__subscription-error");

    // Cada apertura invalida las respuestas pendientes de aperturas anteriores
    subscriptionDropdownOpenCount += 1;
    const openId = subscriptionDropdownOpenCount;

    error.textContent = "";
    groupsContainer.replaceChildren();

    // Hasta que carguen los grupos no hay canal asociado ni se puede guardar
    const openSubmitButton = form.querySelector("button[type='submit']");
    if (openSubmitButton) {
      openSubmitButton.disabled = true;
    }
    form.dataset.channelName = "";
    form.dataset.channelUrl = "";

    if (!channel) {
      error.textContent = "No se ha podido identificar el canal.";
      form.hidden = false;
      positionSubscriptionDropdown(dropdown, form, anchorButton);
      return;
    }

    getGroups()
      .then((groups) => {
        if (openId !== subscriptionDropdownOpenCount) {
          return;
        }

        renderChannelGroupChoices(
          groupsContainer,
          groups,
          channel.url,
          "youtube-groups__subscription-group-choice",
        );

        // Guardar el canal en el formulario para la operación de guardado
        form.dataset.channelName = channel.name;
        form.dataset.channelUrl = channel.url;

        form.hidden = false;

        positionSubscriptionDropdown(dropdown, form, anchorButton);
      })
      .catch((exception) => {
        if (openId === subscriptionDropdownOpenCount) {
          error.textContent = exception.message;
        }
      });
  }

  function createSubscriptionDropdown() {
    const container = document.createElement("div");
    container.className = "youtube-groups__subscription-dropdown";
    container.innerHTML = `
      <form class="youtube-groups__subscription-groups-form" hidden>
        <div class="youtube-groups__subscription-groups"></div>
        <div class="youtube-groups__subscription-actions">
          <button class="youtube-groups__subscription-cancel-button action-button secondary-button" type="button">Cancelar</button>
          <button class="youtube-groups__subscription-save-button action-button primary-button" type="submit">Guardar</button>
        </div>
        <p class="youtube-groups__subscription-error" aria-live="polite"></p>
      </form>
    `;

    const form = container.querySelector(
      ".youtube-groups__subscription-groups-form",
    );
    const error = container.querySelector(
      ".youtube-groups__subscription-error",
    );

    container
      .querySelector(".youtube-groups__subscription-cancel-button")
      .addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        form.hidden = true;
        error.textContent = "";
      });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      error.textContent = "";

      if (!form.dataset.channelUrl) {
        return;
      }

      const channel = {
        name: form.dataset.channelName,
        url: form.dataset.channelUrl,
      };
      const submitOpenId = subscriptionDropdownOpenCount;

      const selectedGroupIds = new Set(
        Array.from(
          form.querySelectorAll("input:checked"),
          (input) => input.value,
        ),
      );

      const submitButton = form.querySelector("button[type='submit']");
      const originalText = submitButton?.textContent;
      if (submitButton) {
        submitButton.textContent = "Guardando...";
        submitButton.disabled = true;
      }

      try {
        await setChannelGroups(channel, selectedGroupIds);
        await renderGroupsPanel();
        await refreshActiveGroupFilter();
        if (submitOpenId === subscriptionDropdownOpenCount) {
          form.hidden = true;
        }
      } catch (exception) {
        if (submitOpenId === subscriptionDropdownOpenCount) {
          error.textContent = exception.message;
        }
      } finally {
        if (submitButton) {
          submitButton.textContent = originalText;
          if (submitOpenId === subscriptionDropdownOpenCount) {
            submitButton.disabled = false;
          }
        }
      }
    });

    return container;
  }

  /**
   * Lee del DOM los datos de una tarjeta para guardarla en una lista.
   * @param {Element} card - Tarjeta de vídeo.
   * @returns {{id: string|null, title: string, channelName: string}} Datos del vídeo.
   */
  function getVideoDataFromCard(card) {
    let title = card.querySelector("#video-title")?.textContent.trim() ?? "";
    if (!title) {
      for (const link of card.querySelectorAll("a[href]")) {
        if (YouTubeGroupsWatched.extractVideoId(link.getAttribute("href"))) {
          title = link.getAttribute("title")?.trim() || link.textContent.trim();
          break;
        }
      }
    }

    return {
      id: findVideoId(card),
      title,
      channelName: getChannelFromCard(card)?.name ?? "",
    };
  }

  // Desplegable flotante único para guardar un vídeo en listas
  let playlistDropdown = null;
  let playlistDropdownOpenCount = 0;
  let playlistDropdownListenersAdded = false;

  function hidePlaylistDropdown() {
    const form = playlistDropdown?.querySelector(
      ".youtube-groups__playlist-dropdown-form",
    );
    if (form) {
      form.hidden = true;
    }
  }

  function getOrCreatePlaylistDropdown() {
    if (!playlistDropdown || !playlistDropdown.isConnected) {
      playlistDropdown = createPlaylistDropdown();
      document.body.appendChild(playlistDropdown);
    }

    // Cerrar al hacer clic fuera o al hacer scroll (posiciones obsoletas);
    // se registra una sola vez aunque el elemento se recree.
    if (!playlistDropdownListenersAdded) {
      playlistDropdownListenersAdded = true;
      document.addEventListener("mousedown", (event) => {
        if (playlistDropdown && !playlistDropdown.contains(event.target)) {
          hidePlaylistDropdown();
        }
      });
      window.addEventListener("scroll", hidePlaylistDropdown, {
        passive: true,
      });
    }

    return playlistDropdown;
  }

  /**
   * Pinta las casillas de las listas con textContent.
   * @param {Element} container - Contenedor de las casillas.
   * @param {Array} playlists - Listas guardadas.
   * @param {Set<string>} checkedIds - IDs de lista marcados.
   */
  function renderPlaylistChoices(container, playlists, checkedIds) {
    container.replaceChildren();
    if (playlists.length === 0) {
      const empty = document.createElement("p");
      empty.className = "youtube-groups__empty-choices";
      empty.textContent = "Aún no hay listas.";
      container.appendChild(empty);
      return;
    }

    for (const playlist of playlists) {
      const label = document.createElement("label");
      label.className = "youtube-groups__playlist-choice";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = playlist.id;
      input.checked = checkedIds.has(playlist.id);
      const text = document.createElement("span");
      text.textContent = playlist.name;
      label.append(input, text);
      container.appendChild(label);
    }
  }

  /**
   * Abre el desplegable para guardar un vídeo en listas.
   * @param {{id: string|null, title: string, channelName: string}} video - Datos del vídeo.
   * @param {Element} anchorButton - Botón junto al que se muestra.
   */
  function openPlaylistForm(video, anchorButton) {
    const dropdown = getOrCreatePlaylistDropdown();
    const form = dropdown.querySelector(
      ".youtube-groups__playlist-dropdown-form",
    );
    const choices = dropdown.querySelector(".youtube-groups__playlist-choices");
    const error = dropdown.querySelector(
      ".youtube-groups__playlist-dropdown-error",
    );
    const submitButton = form.querySelector("button[type='submit']");

    // Cada apertura invalida las respuestas pendientes de aperturas anteriores
    playlistDropdownOpenCount += 1;
    const openId = playlistDropdownOpenCount;

    error.textContent = "";
    choices.replaceChildren();
    submitButton.disabled = true;
    form.dataset.videoId = "";
    form.dataset.videoTitle = "";
    form.dataset.videoChannel = "";
    form.querySelector(".youtube-groups__playlist-dropdown-input").value = "";

    if (!video || !video.id) {
      error.textContent = "No se ha podido identificar el vídeo.";
      form.hidden = false;
      positionSubscriptionDropdown(dropdown, form, anchorButton);
      return;
    }

    YouTubeGroupsStorage.getPlaylists()
      .then((playlists) => {
        if (openId !== playlistDropdownOpenCount) {
          return;
        }

        renderPlaylistChoices(
          choices,
          playlists,
          new Set(
            YouTubeGroupsPlaylists.getVideoPlaylistIds(playlists, video.id),
          ),
        );
        form.dataset.videoId = video.id;
        form.dataset.videoTitle = video.title;
        form.dataset.videoChannel = video.channelName;
        submitButton.disabled = false;
        form.hidden = false;
        positionSubscriptionDropdown(dropdown, form, anchorButton);
      })
      .catch((exception) => {
        if (openId === playlistDropdownOpenCount) {
          error.textContent = exception.message;
          form.hidden = false;
          positionSubscriptionDropdown(dropdown, form, anchorButton);
        }
      });
  }

  function createPlaylistDropdown() {
    const container = document.createElement("div");
    container.className = "youtube-groups__playlist-dropdown";
    container.innerHTML = `
      <form class="youtube-groups__playlist-dropdown-form" hidden>
        <div class="youtube-groups__playlist-choices"></div>
        <div class="youtube-groups__playlist-new">
          <input class="youtube-groups__playlist-dropdown-input" type="text" placeholder="Nueva lista" maxlength="80">
          <button class="youtube-groups__playlist-dropdown-create action-button secondary-button" type="button">Crear</button>
        </div>
        <div class="youtube-groups__subscription-actions">
          <button class="youtube-groups__playlist-dropdown-cancel action-button secondary-button" type="button">Cancelar</button>
          <button class="youtube-groups__playlist-dropdown-save action-button primary-button" type="submit">Guardar</button>
        </div>
        <p class="youtube-groups__playlist-dropdown-error" aria-live="polite"></p>
      </form>
    `;

    const form = container.querySelector(
      ".youtube-groups__playlist-dropdown-form",
    );
    const choices = container.querySelector(
      ".youtube-groups__playlist-choices",
    );
    const input = container.querySelector(
      ".youtube-groups__playlist-dropdown-input",
    );
    const error = container.querySelector(
      ".youtube-groups__playlist-dropdown-error",
    );
    const createButton = container.querySelector(
      ".youtube-groups__playlist-dropdown-create",
    );

    // Los clics dentro del desplegable no deben llegar a YouTube
    container.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    container
      .querySelector(".youtube-groups__playlist-dropdown-cancel")
      .addEventListener("click", (event) => {
        event.preventDefault();
        form.hidden = true;
        error.textContent = "";
      });

    async function createFromInput() {
      error.textContent = "";
      const currentOpenId = playlistDropdownOpenCount;
      createButton.disabled = true;
      try {
        const checked = new Set(
          Array.from(
            form.querySelectorAll("input[type='checkbox']:checked"),
            (checkbox) => checkbox.value,
          ),
        );
        const created = await YouTubeGroupsPlaylists.createPlaylist(
          input.value,
        );
        checked.add(created.id);
        await renderPlaylistsSection();
        if (currentOpenId === playlistDropdownOpenCount) {
          const playlists = await YouTubeGroupsStorage.getPlaylists();
          if (currentOpenId === playlistDropdownOpenCount) {
            renderPlaylistChoices(choices, playlists, checked);
            input.value = "";
          }
        }
      } catch (exception) {
        if (currentOpenId === playlistDropdownOpenCount) {
          error.textContent = exception.message;
        }
      } finally {
        createButton.disabled = false;
      }
    }

    createButton.addEventListener("click", (event) => {
      event.preventDefault();
      createFromInput();
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        createFromInput();
      }
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      error.textContent = "";

      if (!form.dataset.videoId) {
        return;
      }

      const video = {
        id: form.dataset.videoId,
        title: form.dataset.videoTitle,
        channelName: form.dataset.videoChannel,
      };
      const submitOpenId = playlistDropdownOpenCount;
      const selectedIds = new Set(
        Array.from(
          form.querySelectorAll("input[type='checkbox']:checked"),
          (checkbox) => checkbox.value,
        ),
      );

      const submitButton = form.querySelector("button[type='submit']");
      const originalText = submitButton.textContent;
      submitButton.textContent = "Guardando...";
      submitButton.disabled = true;

      try {
        await YouTubeGroupsPlaylists.setVideoPlaylists(video, selectedIds);
        await renderPlaylistsSection();
        if (submitOpenId === playlistDropdownOpenCount) {
          form.hidden = true;
        }
      } catch (exception) {
        if (submitOpenId === playlistDropdownOpenCount) {
          error.textContent = exception.message;
        }
      } finally {
        submitButton.textContent = originalText;
        if (submitOpenId === playlistDropdownOpenCount) {
          submitButton.disabled = false;
        }
      }
    });

    return container;
  }

  // Un control por tarjeta; es idempotente porque insertarlo provoca una
  // mutación que vuelve a programar la tarjeta.
  function ensureChannelControl(card) {
    const pageType = YouTubeGroupsPages.getPageType(window.location.pathname);
    if (
      !card.isConnected ||
      !YouTubeGroupsPages.shouldShowCardControls(pageType)
    ) {
      return;
    }

    if (card.querySelector(".youtube-groups__subscription-control")) {
      return;
    }

    const channelLink = findChannelLink(card);
    if (!channelLink) {
      return;
    }

    // En búsqueda el control va tras el nombre del canal completo, en línea propia.
    const anchor =
      (pageType === "search" && channelLink.closest("ytd-channel-name")) ||
      channelLink;

    anchor.insertAdjacentElement(
      "afterend",
      createSubscriptionChannelControl(card),
    );
  }

  const CHANNEL_RESULT_SELECTOR = "ytd-channel-renderer";

  // Control "Añadir a grupo" en un resultado de canal de la búsqueda;
  // idempotente por el mismo motivo que ensureChannelControl.
  function ensureChannelResultControl(card) {
    const pageType = YouTubeGroupsPages.getPageType(window.location.pathname);
    if (
      !card.isConnected ||
      pageType !== "search" ||
      card.querySelector(".youtube-groups__subscription-control")
    ) {
      return;
    }

    let url = null;
    for (const link of card.querySelectorAll("a[href]")) {
      url = normalizeChannelUrl(link.href);
      if (url) {
        break;
      }
    }

    const nameElement =
      card.querySelector("ytd-channel-name #text") ||
      card.querySelector("#channel-title");
    const name = nameElement?.textContent.trim();
    if (!url || !name) {
      return;
    }

    const container = card.querySelector("#info") || card;
    container.appendChild(
      createSubscriptionChannelControl(card, {
        videoButtons: false,
        channel: { name, url },
      }),
    );
  }

  const CURRENT_VIDEO_OWNER_SELECTOR =
    "ytd-watch-metadata #owner, ytd-video-owner-renderer";

  function getCurrentVideoChannel() {
    if (window.location.pathname !== "/watch") {
      return null;
    }

    const owner = document.querySelector(CURRENT_VIDEO_OWNER_SELECTOR);
    return owner ? getChannelFromCard(owner) : null;
  }

  function detectCard(card) {
    if (!card.isConnected) {
      return;
    }

    // Saltar la tarjeta solo si su enlace de canal sigue siendo el mismo
    const known = detectedCards.get(card);
    if (known && card.contains(known.link) && known.link.href === known.href) {
      return;
    }

    const link = findChannelLink(card);
    if (!link) {
      // La tarjeta ya no tiene canal: borrar los datos del anterior
      detectedCards.delete(card);
      delete card.dataset.youtubeGroupsChannelName;
      delete card.dataset.youtubeGroupsChannelUrl;
      return;
    }

    const channel = {
      name: getChannelName(link),
      url: normalizeChannelUrl(link.href),
    };

    detectedCards.set(card, { link, href: link.href });
    card.dataset.youtubeGroupsChannelName = channel.name;
    card.dataset.youtubeGroupsChannelUrl = channel.url;

    // La visibilidad se aplica en cuanto se detecta la tarjeta
    applyCardVisibility(card);
  }

  /**
   * Indica si una tarjeta pasa el filtro activo. Sin grupo activo, sin canal
   * o sin canales del grupo todavía, pasa.
   * @param {Element} card - Tarjeta de vídeo.
   * @returns {boolean}
   */
  function cardMatchesFilter(card) {
    const channelUrl = card.dataset.youtubeGroupsChannelUrl;
    if (
      getActiveGroupId() === null ||
      !channelUrl ||
      activeGroupChannelUrls === null
    ) {
      return true;
    }
    return activeGroupChannelUrls.has(channelUrl);
  }

  /** Filtros avanzados activos (en memoria; se pierden al recargar). */
  const advancedFilters = { duration: "any", age: "any", views: "any" };

  /** Caché tarjeta -> { videoId, metadata } de los metadatos ya leídos. */
  const cardMetadataCache = new WeakMap();

  /**
   * Lee los textos visibles de una tarjeta: los `span` y `div` sin hijos
   * elemento, con 1 a 60 caracteres, fuera del título y fuera de los nodos
   * añadidos por la extensión.
   * @param {Element} card - Tarjeta de vídeo.
   * @returns {string[]} Textos recortados.
   */
  function getCardTexts(card) {
    const texts = [];
    for (const element of card.querySelectorAll("span, div")) {
      if (
        element.children.length > 0 ||
        element.closest('h3, #video-title, [class*="youtube-groups__"]')
      ) {
        continue;
      }
      const text = (element.textContent ?? "").trim();
      if (text.length >= 1 && text.length <= 60) {
        texts.push(text);
      }
    }
    return texts;
  }

  /**
   * Devuelve los metadatos de una tarjeta, con caché por ID de vídeo. Se
   * vuelven a leer mientras falte algún dato (YouTube pinta la duración tarde).
   * @param {Element} card - Tarjeta de vídeo.
   * @returns {{duration: number|null, age: number|null, views: number|null}}
   */
  function getCardMetadata(card) {
    const videoId = card.getAttribute(VIDEO_ID_ATTRIBUTE);
    const cached = cardMetadataCache.get(card);
    if (cached && cached.videoId === videoId) {
      return cached.metadata;
    }
    const metadata = YouTubeGroupsMetadata.extractCardMetadata(
      getCardTexts(card),
    );
    const complete = Object.values(metadata).every((value) => value !== null);
    if (complete) {
      cardMetadataCache.set(card, { videoId, metadata });
    } else {
      cardMetadataCache.delete(card);
    }
    return metadata;
  }

  /**
   * Indica si una tarjeta pasa los filtros avanzados (sin filtros, pasa).
   * @param {Element} card - Tarjeta de vídeo.
   * @returns {boolean}
   */
  function cardMatchesAdvancedFilters(card) {
    if (!YouTubeGroupsMetadata.hasActiveFilters(advancedFilters)) {
      return true;
    }
    return YouTubeGroupsMetadata.matchesAdvancedFilters(
      getCardMetadata(card),
      advancedFilters,
    );
  }

  /**
   * Único punto que pinta la visibilidad de una tarjeta: combina filtro,
   * visto y ajustes, y alterna las clases `hidden` y `dimmed`.
   * @param {Element} card - Tarjeta de vídeo.
   */
  function applyCardVisibility(card) {
    const visibility = YouTubeGroupsVisibility.getCardVisibility(
      {
        matchesFilter:
          cardMatchesFilter(card) && cardMatchesAdvancedFilters(card),
        isWatched: card.classList.contains(WATCHED_CLASS),
      },
      settings,
    );
    card.classList.toggle("youtube-groups--hidden", visibility === "hidden");
    card.classList.toggle("youtube-groups--dimmed", visibility === "dimmed");
  }

  function showAllVideoCards() {
    applyVisibilityToAllCards();
  }

  function filterAllDetectedCards() {
    applyVisibilityToAllCards();
  }

  async function refreshActiveGroupFilter() {
    const updateVersion = ++filterUpdateVersion;
    const activeId = getActiveGroupId();

    // Reset activeGroupChannelUrls when no group is active
    if (activeId === null) {
      activeGroupChannelUrls = null;
      showAllVideoCards();
      return;
    }

    // Con grupo activo no se toca el filtro actual hasta tener los grupos,
    // para no mostrar todas las tarjetas mientras tanto.
    try {
      const groups = await getGroups();
      if (
        updateVersion !== filterUpdateVersion ||
        activeId !== getActiveGroupId()
      ) {
        return;
      }

      // Canales del grupo o subgrupo activo y de sus descendientes
      const urls = YouTubeGroups.getGroupChannelUrls(groups, activeId);
      if (!urls) {
        console.warn(
          "[YouTube Groups][FILTER] Grupo activo no encontrado",
          activeId,
        );
        setActiveGroup(null);
        return;
      }

      activeGroupChannelUrls = urls;
      filterAllDetectedCards();
    } catch (error) {
      console.error(
        "[YouTube Groups][FILTER] No se pudo aplicar el filtro",
        error,
      );
    }
  }

  function scheduleCard(card) {
    if (card instanceof Element) {
      pendingCards.add(card);
    }

    if (!processingScheduled) {
      processingScheduled = true;
      requestAnimationFrame(processPendingCards);
    }
  }

  function processPendingCards() {
    processingScheduled = false;
    for (const card of pendingCards) {
      if (card.matches(CHANNEL_RESULT_SELECTOR)) {
        ensureChannelResultControl(card);
        continue;
      }

      detectCard(card);
      applyWatchedToCard(card);
      ensureChannelControl(card);
    }

    pendingCards.clear();
  }

  function scheduleCardsIn(node) {
    if (!(node instanceof Element)) {
      return;
    }

    scheduleContainingCard(node);

    const cardSelector = `${VIDEO_CARD_SELECTOR}, ${CHANNEL_RESULT_SELECTOR}`;

    if (node.matches(cardSelector)) {
      scheduleCard(node);
    }

    for (const card of node.querySelectorAll(cardSelector)) {
      scheduleCard(card);
    }
  }

  function scheduleContainingCard(element) {
    const containingCard = element.closest(
      `${VIDEO_CARD_SELECTOR}, ${CHANNEL_RESULT_SELECTOR}`,
    );
    if (containingCard) {
      scheduleCard(containingCard);
    }
  }

  function scanDocument() {
    scheduleCardsIn(document.documentElement);
  }

  let currentChannelUpdateScheduled = false;

  function nodeBelongsToCurrentVideoOwner(node) {
    return (
      node instanceof Element &&
      (node.matches(CURRENT_VIDEO_OWNER_SELECTOR) ||
        node.closest(CURRENT_VIDEO_OWNER_SELECTOR) ||
        node.querySelector(CURRENT_VIDEO_OWNER_SELECTOR))
    );
  }

  function scheduleCurrentChannelPanelUpdate() {
    if (
      currentChannelUpdateScheduled ||
      window.location.pathname !== "/watch"
    ) {
      return;
    }

    currentChannelUpdateScheduled = true;
    requestAnimationFrame(() => {
      currentChannelUpdateScheduled = false;
      const channel = getCurrentVideoChannel();
      const channelUrl = channel ? channel.url : null;
      if (channelUrl === renderedCurrentChannelUrl) {
        return;
      }

      getGroups()
        .then((groups) => renderCurrentChannelSection(groups))
        .catch((error) => {
          console.error(
            "[YouTube Groups] No se pudo actualizar el canal actual",
            error,
          );
        });
    });
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.target instanceof Element) {
        scheduleContainingCard(mutation.target);
        if (nodeBelongsToCurrentVideoOwner(mutation.target)) {
          scheduleCurrentChannelPanelUpdate();
        }
      }

      for (const node of mutation.addedNodes) {
        scheduleCardsIn(node);
        if (nodeBelongsToCurrentVideoOwner(node)) {
          scheduleCurrentChannelPanelUpdate();
        }
      }
    }
    if (!document.getElementById(GUIDE_SECTION_ID)?.isConnected) {
      scheduleGuideCheck();
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["href"],
  });

  // YouTube is a SPA: cards can be reutilizadas entre navegaciones internas.
  document.addEventListener("yt-navigate-finish", () => {
    detectedCards = new WeakMap();
    scanDocument();
    refreshActiveGroupFilter();
    renderGroupsPanel().catch((error) => {
      console.error(
        "[YouTube Groups] No se pudo actualizar el panel de grupos",
        error,
      );
    });
  });

  scanDocument();
  refreshActiveGroupFilter();
  renderGroupsPanel().catch((error) => {
    console.error(
      "[YouTube Groups] No se pudo cargar el panel de grupos",
      error,
    );
  });

  // Ensure all cards are filtered properly after initialization
  setTimeout(() => {
    filterAllDetectedCards();
  }, 100);

  // --- Icon Picker (singleton lazy) ---
  let iconPicker = null;
  let iconPickerListenersAdded = false;

  function getOrCreateIconPicker() {
    if (!iconPicker || !iconPicker.isConnected) {
      iconPicker = createIconPicker();
      document.body.appendChild(iconPicker);
    }
    // Los escuchadores globales se registran una sola vez: leen la variable
    // del singleton, así que sirven también para el elemento recreado.
    if (!iconPickerListenersAdded) {
      iconPickerListenersAdded = true;
      document.addEventListener("mousedown", (event) => {
        if (iconPicker && !iconPicker.contains(event.target)) {
          const form = iconPicker.querySelector(
            ".youtube-groups__icon-picker-form",
          );
          if (form) {
            form.hidden = true;
          }
        }
      });
      window.addEventListener(
        "scroll",
        () => {
          if (iconPicker) {
            const form = iconPicker.querySelector(
              ".youtube-groups__icon-picker-form",
            );
            if (form) {
              form.hidden = true;
            }
          }
        },
        { passive: true },
      );
    }
    return iconPicker;
  }

  function createIconPicker() {
    const container = document.createElement("div");
    container.className = "youtube-groups__icon-picker";
    container.innerHTML =
      '<form class="youtube-groups__icon-picker-form" hidden>' +
      '<div class="youtube-groups__icon-picker-preview"></div>' +
      '<div class="youtube-groups__icon-picker-section">' +
      '<p class="youtube-groups__icon-picker-label">Icono</p>' +
      '<div class="youtube-groups__icon-picker-grid"></div>' +
      "</div>" +
      '<div class="youtube-groups__icon-picker-section">' +
      '<p class="youtube-groups__icon-picker-label">Color</p>' +
      '<div class="youtube-groups__icon-picker-colors"></div>' +
      "</div>" +
      '<div class="youtube-groups__icon-picker-actions">' +
      '<button class="youtube-groups__icon-picker-cancel action-button secondary-button" type="button">Cancelar</button>' +
      '<button class="youtube-groups__icon-picker-save action-button primary-button" type="submit">Guardar</button>' +
      "</div>" +
      '<p class="youtube-groups__icon-picker-error" aria-live="polite"></p>' +
      "</form>";

    const form = container.querySelector(".youtube-groups__icon-picker-form");
    const error = container.querySelector(".youtube-groups__icon-picker-error");
    const preview = container.querySelector(
      ".youtube-groups__icon-picker-preview",
    );
    const iconGrid = container.querySelector(
      ".youtube-groups__icon-picker-grid",
    );
    const colorGrid = container.querySelector(
      ".youtube-groups__icon-picker-colors",
    );
    let selectedIconId = "";
    let selectedColorHex = "";

    function renderIconGrid(currentIconId) {
      iconGrid.replaceChildren();
      selectedIconId = currentIconId || "";
      const noIconBtn = document.createElement("button");
      noIconBtn.type = "button";
      noIconBtn.className =
        "youtube-groups__icon-picker-option" +
        (selectedIconId === "" ? " selected" : "");
      noIconBtn.textContent = "Sin icono";
      noIconBtn.addEventListener("click", () => {
        selectedIconId = "";
        updateIconGridSelection();
        updatePreview();
      });
      iconGrid.appendChild(noIconBtn);
      for (const icon of YouTubeGroupsIcons.ICON_SET) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className =
          "youtube-groups__icon-picker-option" +
          (selectedIconId === icon.id ? " selected" : "");
        btn.title = icon.label;
        const iconSvg = createIconSvg(icon.id, 20);
        if (iconSvg) {
          btn.append(iconSvg);
        }
        btn.addEventListener("click", () => {
          selectedIconId = icon.id;
          updateIconGridSelection();
          updatePreview();
        });
        iconGrid.appendChild(btn);
      }
    }
    function updateIconGridSelection() {
      const buttons = iconGrid.querySelectorAll(
        ".youtube-groups__icon-picker-option",
      );
      buttons.forEach((btn, index) => {
        if (index === 0) {
          btn.classList.toggle("selected", selectedIconId === "");
        } else {
          const iconId = YouTubeGroupsIcons.ICON_SET[index - 1].id;
          btn.classList.toggle("selected", selectedIconId === iconId);
        }
      });
    }
    function renderColorGrid(currentColorHex) {
      colorGrid.replaceChildren();
      selectedColorHex = currentColorHex || "";
      const noColorBtn = document.createElement("button");
      noColorBtn.type = "button";
      noColorBtn.className =
        "youtube-groups__icon-picker-color-option" +
        (selectedColorHex === "" ? " selected" : "");
      noColorBtn.textContent = "Heredar";
      noColorBtn.addEventListener("click", () => {
        selectedColorHex = "";
        updateColorGridSelection();
        updatePreview();
      });
      colorGrid.appendChild(noColorBtn);
      for (const color of YouTubeGroupsIcons.COLOR_SET) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className =
          "youtube-groups__icon-picker-color-option" +
          (selectedColorHex === color.hex ? " selected" : "");
        btn.style.backgroundColor = color.hex;
        btn.title = color.id;
        btn.addEventListener("click", () => {
          selectedColorHex = color.hex;
          updateColorGridSelection();
          updatePreview();
        });
        colorGrid.appendChild(btn);
      }
    }
    function updateColorGridSelection() {
      const buttons = colorGrid.querySelectorAll(
        ".youtube-groups__icon-picker-color-option",
      );
      buttons.forEach((btn, index) => {
        if (index === 0) {
          btn.classList.toggle("selected", selectedColorHex === "");
        } else {
          const hex = YouTubeGroupsIcons.COLOR_SET[index - 1].hex;
          btn.classList.toggle("selected", selectedColorHex === hex);
        }
      });
    }
    function updatePreview() {
      preview.replaceChildren();
      if (!selectedIconId) {
        const span = document.createElement("span");
        span.className = "youtube-groups__icon-picker-preview-empty";
        span.textContent = "Sin icono";
        preview.appendChild(span);
        return;
      }
      const previewSvg = createIconSvg(selectedIconId, 24);
      if (!previewSvg) return;
      const chip = document.createElement("span");
      chip.className = "youtube-groups__icon";
      if (selectedColorHex) {
        chip.style.color = selectedColorHex;
      }
      chip.append(previewSvg);
      preview.appendChild(chip);
    }
    container
      .querySelector(".youtube-groups__icon-picker-cancel")
      .addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        form.hidden = true;
        error.textContent = "";
      });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      error.textContent = "";
      const groupId = form.dataset.groupId;
      if (!groupId) {
        error.textContent = "No se pudo identificar el grupo.";
        return;
      }
      try {
        await YouTubeGroups.setGroupAppearance(
          groupId,
          selectedIconId,
          selectedColorHex,
        );
        form.hidden = true;
        renderGroupsPanel().catch((err) => {
          console.error("[YouTube Groups] Error re-renderizando panel", err);
        });
      } catch (exception) {
        error.textContent = exception.message;
      }
    });
    container._renderIconGrid = renderIconGrid;
    container._renderColorGrid = renderColorGrid;
    container._updatePreview = updatePreview;

    return container;
  }
  function openIconPicker(group, anchorButton) {
    const picker = getOrCreateIconPicker();
    const form = picker.querySelector(".youtube-groups__icon-picker-form");
    const error = picker.querySelector(".youtube-groups__icon-picker-error");
    const rect = anchorButton.getBoundingClientRect();
    const pickerWidth = 280;
    const pickerHeight = 350;
    let left = rect.left;
    let top = rect.bottom + 6;

    // Adjust position to keep picker within viewport
    if (top + pickerHeight > window.innerHeight) {
      top = rect.top - pickerHeight - 6;
    }

    if (left + pickerWidth > window.innerWidth) {
      left = window.innerWidth - pickerWidth - 6;
    }

    if (left < 6) {
      left = 6;
    }

    picker.style.left = left + "px";
    picker.style.top = top + "px";
    form.dataset.groupId = group.id;
    error.textContent = "";
    picker._renderIconGrid(group.icon || "");
    picker._renderColorGrid(group.color || "");
    picker._updatePreview();
    form.hidden = false;
  }

  /**
   * Aplica a la caché y a la interfaz los cambios que otra pestaña (o esta
   * misma) ha guardado en el almacenamiento (ADR 0006).
   * @param {Object} changes - Objeto `changes` de `storage.onChanged`.
   * @param {string} areaName - Área de almacenamiento del evento.
   */
  function handleStorageChange(changes, areaName) {
    const storage = YouTubeGroupsStorage;
    const keys = storage.getChangedKeys(changes, areaName);

    for (const name of keys) {
      const newValue = changes[storage.KEYS[name]].newValue;
      try {
        if (name === "watched") {
          watchedVideos = storage.readWatchedValue(newValue);
          watchedLoadError = null;
          watchedAppliedSeq = watchedWriteSeq;
          for (const card of document.querySelectorAll(VIDEO_CARD_SELECTOR)) {
            applyWatchedToCard(card);
          }
          renderCurrentVideoSection();
        } else if (name === "settings") {
          settings = YouTubeGroupsSettings.normalizeSettings(
            storage.readSettingsValue(newValue),
          );
          settingsLoaded = true;
          settingsLoadError = null;
          settingsAppliedSeq = settingsWriteSeq;
          syncSettingsControls();
          applyVisibilityToAllCards();
        } else if (name === "groups") {
          refreshActiveGroupFilter().catch((error) => {
            console.error(
              "[YouTube Groups] No se pudo refrescar el filtro",
              error,
            );
          });
          renderGroupsPanel().catch((error) => {
            console.error(
              "[YouTube Groups] No se pudo repintar los grupos",
              error,
            );
          });
        } else if (name === "playlists") {
          renderPlaylistsSection().catch((error) => {
            console.error(
              "[YouTube Groups] No se pudo repintar las listas",
              error,
            );
          });
          const modal = document.querySelector(
            ".youtube-groups__channel-list-modal--playlist",
          );
          if (modal) {
            const playlists = storage.readPlaylistsValue(newValue);
            const playlistId = modal.dataset.playlistId;
            if (playlists.some((item) => item.id === playlistId)) {
              openPlaylistVideosModal(playlistId).catch((error) => {
                console.error(
                  "[YouTube Groups] No se pudo repintar el modal",
                  error,
                );
              });
            } else {
              closePlaylistModal();
            }
          }
        }
      } catch (error) {
        console.error(
          "[YouTube Groups] No se pudo aplicar el cambio de " + name,
          error,
        );
      }
    }
  }

  browser.storage.onChanged.addListener(handleStorageChange);
})();
