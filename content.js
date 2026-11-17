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
   * Contexto compartido entre los componentes de la interfaz. `state` reúne el
   * estado que leen o escriben varios componentes; los espacios de nombres son
   * un puente hacia las funciones que aún están en este fichero.
   */
  const ctx = {
    state: {
      /** Vídeos vistos en memoria; null hasta cargarlos (sin datos no se marca nada). */
      watchedVideos: null,
      /** Mensaje del error al leer los vistos; null si no ha fallado. */
      watchedLoadError: null,
      /** Número de la última operación de vistos iniciada. */
      watchedWriteSeq: 0,
      /** Número de la última operación de vistos cuyo resultado se aplicó. */
      watchedAppliedSeq: 0,
      /** Número de la última operación de ajustes iniciada. */
      settingsWriteSeq: 0,
      /** Número de la última operación de ajustes cuyo resultado se aplicó. */
      settingsAppliedSeq: 0,
      /** Ajustes en memoria; valores por defecto hasta cargar los guardados. */
      settings: YouTubeGroupsSettings.DEFAULT_SETTINGS,
      /** Si los ajustes guardados ya se han leído (habilita los selectores). */
      settingsLoaded: false,
      /** Mensaje del error al leer los ajustes; null si no ha fallado. */
      settingsLoadError: null,
      /** Claves de la selección activa (`[]` es "todos"). */
      activeSelection: [],
      /** Unión de los canales de la selección (`null` sin selección o cargando). */
      activeSelectionUrls: null,
      /** Filtros avanzados de la página de suscripciones. */
      advancedFilters: { duration: "any", age: "any", views: "any" },
    },
    setActiveSelection,
    refreshActiveSelection,
    handleGroupsRemoved,
    renderGroupsPanel,
    navigateToSubscriptions,
    panel: {
      createGroupsPanel,
      syncSettingsControls,
      renderPlaylistsSection,
      openPlaylistVideosModal,
      closePlaylistModal,
      renderCurrentChannelSection,
      renderCurrentVideoSection,
      scheduleCurrentChannelPanelUpdate,
    },
  };
  ctx.cards = YouTubeGroupsCards.create(ctx);
  ctx.watched = YouTubeGroupsWatchedUi.create(ctx);
  ctx.dropdowns = YouTubeGroupsDropdowns.create(ctx);
  ctx.player = YouTubeGroupsPlayer.create(ctx);
  ctx.guide = YouTubeGroupsGuideSection.create(ctx);

  getGroups().catch((error) => {
    console.error(
      "[YouTube Groups] No se pudo inicializar el almacenamiento",
      error,
    );
  });

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
      ctx.state.settings.panelCollapsed,
    );
    const collapseButton = panel.querySelector(
      ".youtube-groups__collapse-button",
    );
    collapseButton.textContent = ctx.state.settings.panelCollapsed ? "+" : "−";
    collapseButton.title = ctx.state.settings.panelCollapsed
      ? "Mostrar panel"
      : "Minimizar panel";
    collapseButton.setAttribute(
      "aria-expanded",
      String(!ctx.state.settings.panelCollapsed),
    );
    collapseButton.disabled = !ctx.state.settingsLoaded;
    watchedSelect.value = ctx.state.settings.watchedMode;
    outsideSelect.value = ctx.state.settings.outsideMode;
    autoMarkSelect.value = String(ctx.state.settings.autoMarkPercent);
    watchedSelect.disabled = !ctx.state.settingsLoaded;
    outsideSelect.disabled = !ctx.state.settingsLoaded;
    autoMarkSelect.disabled = !ctx.state.settingsLoaded;
    if (ctx.state.settingsLoadError !== null) {
      panel.querySelector(".youtube-groups__settings-error").textContent =
        "No se pudieron leer los ajustes: " + ctx.state.settingsLoadError;
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
      const value = ctx.state.advancedFilters[select.dataset.filter];
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
      ctx.state.settings = loaded;
      ctx.state.settingsLoaded = true;
      ctx.cards.applyVisibilityToAllCards();
      syncSettingsControls();
    })
    .catch((error) => {
      ctx.state.settingsLoadError = error.message;
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
    ctx.state.settingsWriteSeq += 1;
    const seq = ctx.state.settingsWriteSeq;
    try {
      const result = await YouTubeGroupsSettings.updateSettings({
        [key]: parse(select.value),
      });
      if (seq > ctx.state.settingsAppliedSeq) {
        ctx.state.settingsAppliedSeq = seq;
        ctx.state.settings = result.settings;
        ctx.cards.applyVisibilityToAllCards();
      }
    } catch (error) {
      select.value = String(ctx.state.settings[key]);
      errorElement.textContent =
        "No se pudo guardar el ajuste: " + error.message;
      console.error("[YouTube Groups] No se pudo guardar el ajuste", error);
    } finally {
      select.disabled = false;
    }
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
    const videoId = ctx.watched.getCurrentVideoId();
    section.hidden = !videoId;
    if (!videoId) {
      return;
    }
    const isWatched =
      ctx.state.watchedVideos !== null &&
      YouTubeGroupsWatched.isVideoWatched(ctx.state.watchedVideos, videoId);
    ctx.watched.updateWatchedButton(
      section.querySelector(".youtube-groups__current-video-button"),
      videoId,
      isWatched,
    );
  }

  ctx.watched.start();

  const GROUPS_PANEL_ID = "youtube-groups-panel";
  let filterUpdateVersion = 0;

  /**
   * Cambia la selección activa y la aplica. No hace nada si es igual,
   * elemento a elemento.
   * @param {unknown} selection - Selección (se normaliza).
   */
  function setActiveSelection(selection) {
    const next = YouTubeGroupsFilter.normalizeSelection(selection);
    if (
      next.length === ctx.state.activeSelection.length &&
      next.every((key, index) => key === ctx.state.activeSelection[index])
    ) {
      return;
    }

    ctx.state.activeSelection = next;
    // Sin selección, no quedan URLs de una selección anterior
    if (next.length === 0) {
      ctx.state.activeSelectionUrls = null;
    }

    refreshActiveSelection();

    renderGroupsPanel().catch((error) => {
      console.error(
        "[YouTube Groups] No se pudo actualizar el filtro activo",
        error,
      );
    });
  }

  /**
   * Reacciona a que se hayan quitado grupos: reaplica la selección, que
   * descarta los elementos que ya no existen.
   * @returns {Promise<void>}
   */
  async function handleGroupsRemoved() {
    await refreshActiveSelection();
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
      appendSection(
        "URL no válidas",
        analysis.invalid,
        (item) =>
          describeChannel(item) +
          " " +
          (item.fixedUrl ? "→ " + item.fixedUrl : "(se quitará)"),
      );
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
        await YouTubeGroups.cleanupGroups(getChosen());
        await handleGroupsRemoved();
        await renderGroupsPanel();
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
          </div>
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
            <button class="youtube-groups__play-visible action-button secondary-button" type="button">Reproducir lo visible</button>
            <p class="youtube-groups__play-visible-message" aria-live="polite"></p>
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
                <span>Corregir URL no válidas</span>
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
        `;

    panel
      .querySelector(".youtube-groups__current-video-button")
      .addEventListener("click", (event) => {
        ctx.watched.toggleCurrentVideoWatched(event.currentTarget);
      });

    const playVisibleMessage = panel.querySelector(
      ".youtube-groups__play-visible-message",
    );
    panel
      .querySelector(".youtube-groups__play-visible")
      .addEventListener("click", () => {
        playVisibleMessage.textContent = "";
        const entries = [];
        for (const card of document.querySelectorAll(
          ctx.cards.VIDEO_CARD_SELECTOR,
        )) {
          const id = card.getAttribute(ctx.cards.VIDEO_ID_ATTRIBUTE);
          if (!id) {
            continue;
          }
          entries.push({
            id,
            visible: card.checkVisibility(),
            hidden: card.classList.contains("youtube-groups--hidden"),
            dimmed: card.classList.contains("youtube-groups--dimmed"),
            watched: card.classList.contains(ctx.cards.WATCHED_CLASS),
          });
        }
        const url = YouTubeGroupsPlaylists.buildWatchVideosUrl(
          YouTubeGroupsPlaylists.selectQueueIds(entries),
        );
        if (url) {
          window.location.assign(url);
        } else {
          playVisibleMessage.textContent = "No hay vídeos visibles sin ver.";
        }
      });

    panel
      .querySelector(".youtube-groups__current-playlist-button")
      .addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        ctx.dropdowns.openPlaylistForm(
          ctx.watched.getCurrentWatchVideoData(),
          event.currentTarget,
        );
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
        ctx.state.settingsWriteSeq += 1;
        const seq = ctx.state.settingsWriteSeq;
        try {
          const result = await YouTubeGroupsSettings.updateSettings({
            panelCollapsed: !ctx.state.settings.panelCollapsed,
          });
          if (seq > ctx.state.settingsAppliedSeq) {
            ctx.state.settingsAppliedSeq = seq;
            ctx.state.settings = result.settings;
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
        ctx.state.advancedFilters[key] = select.value;
        syncFiltersControls(panel);
        ctx.cards.applyVisibilityToAllCards();
      });
    }
    panel
      .querySelector(".youtube-groups__filters-reset")
      .addEventListener("click", () => {
        for (const key of Object.keys(ctx.state.advancedFilters)) {
          ctx.state.advancedFilters[key] = "any";
        }
        syncFiltersControls(panel);
        ctx.cards.applyVisibilityToAllCards();
      });
    syncFiltersControls(panel);

    const currentChannelForm = panel.querySelector(
      ".youtube-groups__channel-groups-form",
    );
    const currentChannelError = panel.querySelector(
      ".youtube-groups__channel-error",
    );

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

    currentChannelForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      currentChannelError.textContent = "";

      const channel = ctx.cards.getCurrentVideoChannel();
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
        await refreshActiveSelection();

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
   * @param {{ onlyIfOpen?: boolean }} [options] - Con `onlyIfOpen`, no hace nada
   *   si el modal de esa lista ya no está abierto.
   */
  async function openPlaylistVideosModal(
    playlistId,
    { onlyIfOpen = false } = {},
  ) {
    const playlists = await YouTubeGroupsStorage.getPlaylists();
    const playlist = playlists.find((item) => item.id === playlistId);
    if (onlyIfOpen) {
      const openModal = document.querySelector(
        ".youtube-groups__channel-list-modal--playlist",
      );
      if (!openModal || openModal.dataset.playlistId !== playlistId) {
        return;
      }
    }
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

  /**
   * Pide un nuevo nombre y renombra un grupo o subgrupo.
   *
   * Sin uso a propósito: la usará la pantalla de edición de grupos, ver
   * ROADMAP.md.
   *
   * @param {{ id: string, name: string }} group - Grupo o subgrupo a renombrar.
   * @returns {Promise<void>}
   */
  async function promptRenameGroup(group) {
    const newName = prompt("Nuevo nombre del grupo:", group.name);
    if (newName === null) {
      return;
    }
    try {
      await renameGroup(group.id, newName);
      await renderGroupsPanel();
    } catch (exception) {
      alert(exception.message);
    }
  }

  /**
   * Pide confirmación y elimina un grupo o subgrupo.
   *
   * Sin uso a propósito: la usará la pantalla de edición de grupos, ver
   * ROADMAP.md.
   *
   * @param {{ id: string, name: string }} group - Grupo o subgrupo a eliminar.
   * @returns {Promise<void>}
   */
  async function confirmDeleteGroup(group) {
    if (
      !confirm(
        `¿Estás seguro de que quieres eliminar el grupo "${group.name}"?`,
      )
    ) {
      return;
    }
    try {
      await deleteGroup(group.id);
      await handleGroupsRemoved();
      await renderGroupsPanel();
    } catch (exception) {
      alert(exception.message);
    }
  }

  async function renderGroupsPanel() {
    const panel = createGroupsPanel();
    if (!panel) {
      return;
    }

    const groups = await getGroups();
    ctx.cards.refreshChannelNameIndex(groups);

    renderCurrentChannelSection(groups);
    renderCurrentVideoSection();
    ctx.guide.renderGuideSection(groups);
  }

  /**
   * Lleva a `/feed/subscriptions` conservando la selección por si la página
   * se recarga entera (ADR 0009).
   * @param {string[]} selection - Selección ya elegida.
   */
  function navigateToSubscriptions(selection) {
    try {
      sessionStorage.setItem(
        YouTubeGroupsFilter.PENDING_FILTER_KEY,
        YouTubeGroupsFilter.serializePendingSelection(selection, Date.now()),
      );
    } catch (error) {
      console.warn(
        "[YouTube Groups] No se pudo guardar la selección pendiente",
        error,
      );
    }

    const link = document.querySelector(
      'ytd-guide-renderer a[href="/feed/subscriptions"], ytd-mini-guide-renderer a[href="/feed/subscriptions"]',
    );
    if (link) {
      link.click();
    } else {
      window.location.assign("/feed/subscriptions");
    }
  }

  /**
   * Lee y borra el filtro pendiente; lo aplica si estamos en suscripciones.
   */
  function consumePendingFilter() {
    let text = null;
    try {
      text = sessionStorage.getItem(YouTubeGroupsFilter.PENDING_FILTER_KEY);
      sessionStorage.removeItem(YouTubeGroupsFilter.PENDING_FILTER_KEY);
    } catch (error) {
      return;
    }

    if (
      YouTubeGroupsPages.getPageType(window.location.pathname) !==
      "subscriptions"
    ) {
      return;
    }

    const pending = YouTubeGroupsFilter.parsePendingSelection(text, Date.now());
    if (pending) {
      setActiveSelection(pending);
    }
  }

  /** Borra el filtro pendiente de `sessionStorage`. */
  function clearPendingFilter() {
    try {
      sessionStorage.removeItem(YouTubeGroupsFilter.PENDING_FILTER_KEY);
    } catch (error) {
      // sessionStorage no disponible: nada que borrar
    }
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

    const channel = ctx.cards.getCurrentVideoChannel();
    renderedCurrentChannelUrl = channel ? channel.url : null;
    currentChannelSection.hidden = !channel;
    currentChannelForm.hidden = true;
    currentChannelGroups.replaceChildren();

    if (!channel) {
      return;
    }

    currentChannelName.textContent = channel.name;

    ctx.dropdowns.renderChannelGroupChoices(
      currentChannelGroups,
      groups,
      channel.url,
      "youtube-groups__group-choice",
    );
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

  async function refreshActiveSelection() {
    const updateVersion = ++filterUpdateVersion;
    const selection = ctx.state.activeSelection;

    // Sin selección no hay URLs que aplicar
    if (selection.length === 0) {
      ctx.state.activeSelectionUrls = null;
      ctx.cards.showAllVideoCards();
      return;
    }

    // Con selección no se toca el filtro actual hasta tener los grupos,
    // para no mostrar todas las tarjetas mientras tanto.
    try {
      const groups = await getGroups();
      if (
        updateVersion !== filterUpdateVersion ||
        selection !== ctx.state.activeSelection
      ) {
        return;
      }

      // Unión de los canales de lo seleccionado que sigue existiendo
      const resolved = YouTubeGroupsFilter.resolveSelection(groups, selection);
      if (resolved.selection.length !== selection.length) {
        console.warn(
          "[YouTube Groups][FILTER] Elementos del filtro no encontrados",
          selection.filter((key) => !resolved.selection.includes(key)),
        );
        // El cambio de selección dispara su propio refresco (con lo que
        // queda, o mostrando todo si no queda nada).
        setActiveSelection(resolved.selection);
        return;
      }

      ctx.state.activeSelectionUrls = resolved.urls;
      ctx.cards.filterAllDetectedCards();
    } catch (error) {
      console.error(
        "[YouTube Groups][FILTER] No se pudo aplicar el filtro",
        error,
      );
    }
  }

  let currentChannelUpdateScheduled = false;

  function scheduleCurrentChannelPanelUpdate() {
    const pageType = YouTubeGroupsPages.getPageType(window.location.pathname);
    if (
      currentChannelUpdateScheduled ||
      (pageType !== "watch" && pageType !== "shorts")
    ) {
      return;
    }

    currentChannelUpdateScheduled = true;
    requestAnimationFrame(() => {
      currentChannelUpdateScheduled = false;
      // El canal del vídeo llega tarde: el control del reproductor lo recalcula
      ctx.player.syncPlayerControl();
      const channel = ctx.cards.getCurrentVideoChannel();
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

  ctx.guide.start();

  ctx.player.start();

  const observer = new MutationObserver((mutations) => {
    ctx.guide.noteMutations(mutations);
    ctx.player.noteMutations();
    for (const mutation of mutations) {
      if (mutation.target instanceof Element) {
        ctx.cards.scheduleContainingCard(mutation.target);
        if (
          ctx.cards.nodeBelongsToCurrentVideoOwner(mutation.target) ||
          mutation.target.localName === "ytd-reel-video-renderer"
        ) {
          scheduleCurrentChannelPanelUpdate();
        }
      }

      for (const node of mutation.addedNodes) {
        ctx.cards.scheduleCardsIn(node);
        if (ctx.cards.nodeBelongsToCurrentVideoOwner(node)) {
          scheduleCurrentChannelPanelUpdate();
        }
      }
    }
    ctx.guide.checkPlacement();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["href", "is-active"],
  });

  // YouTube is a SPA: cards can be reutilizadas entre navegaciones internas.
  document.addEventListener("yt-navigate-finish", () => {
    clearPendingFilter();
    ctx.cards.resetDetectedCards();
    ctx.cards.scanDocument();
    refreshActiveSelection();
    renderGroupsPanel().catch((error) => {
      console.error(
        "[YouTube Groups] No se pudo actualizar el panel de grupos",
        error,
      );
    });
  });

  ctx.cards.scanDocument();
  consumePendingFilter();
  refreshActiveSelection();
  renderGroupsPanel().catch((error) => {
    console.error(
      "[YouTube Groups] No se pudo cargar el panel de grupos",
      error,
    );
  });

  // Ensure all cards are filtered properly after initialization
  setTimeout(() => {
    ctx.cards.filterAllDetectedCards();
  }, 100);

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
          ctx.state.watchedVideos = storage.readWatchedValue(newValue);
          ctx.state.watchedLoadError = null;
          ctx.state.watchedAppliedSeq = ctx.state.watchedWriteSeq;
          for (const card of document.querySelectorAll(
            ctx.cards.VIDEO_CARD_SELECTOR,
          )) {
            ctx.watched.applyWatchedToCard(card);
          }
          renderCurrentVideoSection();
        } else if (name === "settings") {
          ctx.state.settings = YouTubeGroupsSettings.normalizeSettings(
            storage.readSettingsValue(newValue),
          );
          ctx.state.settingsLoaded = true;
          ctx.state.settingsLoadError = null;
          ctx.state.settingsAppliedSeq = ctx.state.settingsWriteSeq;
          syncSettingsControls();
          ctx.cards.applyVisibilityToAllCards();
        } else if (name === "groups") {
          refreshActiveSelection().catch((error) => {
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
              openPlaylistVideosModal(playlistId, {
                onlyIfOpen: true,
              }).catch((error) => {
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
