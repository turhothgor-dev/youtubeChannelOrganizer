/**
 * Menú de opciones "YouTube Groups" (ADR 0017): canal y vídeo actuales, listas,
 * filtros, limpieza, ajustes y copia de seguridad. Se crea con `create(ctx)`;
 * no toca el DOM hasta que se abre por primera vez con `openMenu`/`toggleMenu`.
 */
const YouTubeGroupsPanel = (() => {
  const { getGroups } = YouTubeGroupsStorage;
  const { setChannelGroups } = YouTubeGroups;

  /**
   * Crea el componente del menú.
   * @param {Object} ctx - Contexto compartido de `content.js`.
   * @returns {Readonly<Object>} API: `toggleMenu`, `openMenu`, `closeMenu`,
   *   `isMenuOpen`, `syncSettingsControls`, `renderPlaylistsSection`,
   *   `openPlaylistVideosModal`, `closePlaylistModal`,
   *   `renderCurrentChannelSection`, `renderCurrentVideoSection` y
   *   `scheduleCurrentChannelPanelUpdate`.
   */
  function create(ctx) {
    const GROUPS_PANEL_ID = "youtube-groups-menu";

    // URL del canal pintado por última vez en la sección "Canal actual".
    let renderedCurrentChannelUrl = null;

    let currentChannelUpdateScheduled = false;

    /** Engranaje con el que se abrió el menú (para el foco y `aria-expanded`). */
    let menuAnchor = null;

    /**
     * Refleja los ajustes en los selectores de la sección "Ajustes" del menú.
     * Los selectores quedan deshabilitados hasta cargar los ajustes.
     * @param {Element|null} [panel] - Menú; por defecto, el que hay en el documento.
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
      const invalidBox = panel.querySelector(
        ".youtube-groups__cleanup-invalid",
      );
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
        appendSection(
          "Canales repetidos",
          analysis.duplicates,
          describeChannel,
        );
        appendSection(
          "URL no válidas",
          analysis.invalid,
          (item) =>
            describeChannel(item) +
            " " +
            (item.fixedUrl ? "→ " + item.fixedUrl : "(se quitará)"),
        );
        appendSection(
          "Grupos vacíos",
          analysis.emptyGroups,
          (item) => item.name,
        );
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
          await ctx.handleGroupsRemoved();
          await ctx.renderGroupsPanel();
          await analyze();
          message.textContent = "Limpieza hecha.";
        } catch (error) {
          message.textContent = "No se pudo limpiar: " + error.message;
          console.error("[YouTube Groups] No se pudo limpiar", error);
          syncApplyButton();
        }
      });
    }

    /**
     * Crea el menú (oculto) y lo añade a `body`. Si ya existe, lo devuelve.
     * @returns {HTMLElement|null} Menú, o `null` si aún no hay `body`.
     */
    function createMenu() {
      const existingPanel = document.getElementById(GROUPS_PANEL_ID);
      if (existingPanel) {
        return existingPanel;
      }

      if (!document.body) {
        return null;
      }

      const panel = document.createElement("div");
      panel.id = GROUPS_PANEL_ID;
      panel.className = "youtube-groups__menu";
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-label", "Opciones de YouTube Groups");
      panel.tabIndex = -1;
      panel.hidden = true;
      panel.innerHTML = `
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
              "youtube-groups-" +
              new Date().toISOString().slice(0, 10) +
              ".json";
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
          await ctx.renderGroupsPanel();
          await ctx.refreshActiveSelection();

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
      renderPlaylistsSection();
      return panel;
    }

    /**
     * Indica si el menú existe y está visible.
     * @returns {boolean} `true` si está abierto.
     */
    function isMenuOpen() {
      const menu = document.getElementById(GROUPS_PANEL_ID);
      return menu !== null && !menu.hidden;
    }

    /**
     * Coloca el menú a la derecha del engranaje (o dentro de la ventana).
     * @param {HTMLElement} menu - Menú visible.
     * @param {Element} anchor - Engranaje.
     */
    function positionMenu(menu, anchor) {
      const rect = anchor.getBoundingClientRect();
      const size = menu.getBoundingClientRect();
      const position = YouTubeGroupsGuide.getMenuPosition(
        rect,
        { width: size.width, height: size.height },
        { width: window.innerWidth, height: window.innerHeight },
      );
      menu.style.left = position.left + "px";
      menu.style.top = position.top + "px";
    }

    function onMenuKeydown(event) {
      if (event.key !== "Escape" || !isMenuOpen()) {
        return;
      }
      const anchor = menuAnchor;
      closeMenu();
      if (anchor?.isConnected) {
        anchor.focus();
      }
    }

    function onMenuPointerDown(event) {
      const menu = document.getElementById(GROUPS_PANEL_ID);
      const target = event.target;
      if (
        !menu ||
        !(target instanceof Node) ||
        menu.contains(target) ||
        menuAnchor?.contains(target) ||
        (target instanceof Element &&
          target.closest(".youtube-groups__channel-list-modal"))
      ) {
        return;
      }
      closeMenu();
    }

    /** Cierra el menú, si está abierto, conservando el estado de sus secciones. */
    function closeMenu() {
      const menu = document.getElementById(GROUPS_PANEL_ID);
      if (!menu || menu.hidden) {
        return;
      }
      menu.hidden = true;
      menuAnchor?.setAttribute("aria-expanded", "false");
      document.removeEventListener("keydown", onMenuKeydown, true);
      document.removeEventListener("pointerdown", onMenuPointerDown, true);
      document.removeEventListener("yt-navigate-start", closeMenu);
      window.removeEventListener("resize", closeMenu);
    }

    /**
     * Abre el menú junto al engranaje (lo crea la primera vez).
     * @param {Element} anchor - Engranaje que lo abre.
     */
    function openMenu(anchor) {
      if (!anchor?.isConnected) {
        closeMenu();
        return;
      }
      const isNew = document.getElementById(GROUPS_PANEL_ID) === null;
      const menu = createMenu();
      if (!menu) {
        return;
      }
      if (isNew) {
        getGroups()
          .then((groups) => renderCurrentChannelSection(groups))
          .catch((error) => {
            console.error(
              "[YouTube Groups] No se pudo pintar el canal actual",
              error,
            );
          });
        renderCurrentVideoSection();
      }
      if (menuAnchor && menuAnchor !== anchor) {
        menuAnchor.setAttribute("aria-expanded", "false");
      }
      menuAnchor = anchor;
      if (menu.hidden) {
        document.addEventListener("keydown", onMenuKeydown, true);
        document.addEventListener("pointerdown", onMenuPointerDown, true);
        document.addEventListener("yt-navigate-start", closeMenu);
        window.addEventListener("resize", closeMenu);
      }
      menu.hidden = false;
      positionMenu(menu, anchor);
      anchor.setAttribute("aria-expanded", "true");
      menu.focus();
    }

    /**
     * Abre el menú si está cerrado y lo cierra si está abierto.
     * @param {Element} anchor - Engranaje pulsado.
     */
    function toggleMenu(anchor) {
      if (isMenuOpen()) {
        closeMenu();
      } else {
        openMenu(anchor);
      }
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
      const listElement = panel?.querySelector(
        ".youtube-groups__playlist-list",
      );
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

    return Object.freeze({
      toggleMenu,
      openMenu,
      closeMenu,
      isMenuOpen,
      syncSettingsControls,
      renderPlaylistsSection,
      openPlaylistVideosModal,
      closePlaylistModal,
      renderCurrentChannelSection,
      renderCurrentVideoSection,
      scheduleCurrentChannelPanelUpdate,
    });
  }

  return Object.freeze({ create });
})();
