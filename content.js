(() => {
  "use strict";

  console.log("[YouTube Groups] content.js cargado");

  const { getGroups, saveGroups, getAvatars } = YouTubeGroupsStorage;

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
   * estado que leen o escriben varios componentes; los espacios de nombres
   * (`cards`, `watched`, `dropdowns`, `player`, `guide`, `panel`) son las API de
   * los componentes de `ui/`.
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
      /** Filtros avanzados activos (en memoria; se pierden al recargar). */
      advancedFilters: { duration: "any", age: "any", views: "any" },
      /** Avatares de canal guardados (`clave de canal` → URL de imagen). */
      avatars: {},
    },
    setActiveSelection,
    refreshActiveSelection,
    handleGroupsRemoved,
    renderGroupsPanel,
    navigateToSubscriptions,
  };
  ctx.avatars = YouTubeGroupsAvatarsUi.create(ctx);
  ctx.cards = YouTubeGroupsCards.create(ctx);
  ctx.watched = YouTubeGroupsWatchedUi.create(ctx);
  ctx.dropdowns = YouTubeGroupsDropdowns.create(ctx);
  ctx.player = YouTubeGroupsPlayer.create(ctx);
  ctx.guide = YouTubeGroupsGuideSection.create(ctx);
  ctx.panel = YouTubeGroupsPanel.create(ctx);

  getGroups().catch((error) => {
    console.error(
      "[YouTube Groups] No se pudo inicializar el almacenamiento",
      error,
    );
  });

  YouTubeGroupsSettings.getSettings()
    .then((loaded) => {
      ctx.state.settings = loaded;
      ctx.state.settingsLoaded = true;
      ctx.cards.applyVisibilityToAllCards();
      ctx.panel.syncSettingsControls();
    })
    .catch((error) => {
      ctx.state.settingsLoadError = error.message;
      ctx.panel.syncSettingsControls();
      console.error("[YouTube Groups] No se pudieron leer los ajustes", error);
    });

  ctx.watched.start();

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

  async function renderGroupsPanel() {
    const [groups, avatars] = await Promise.all([getGroups(), getAvatars()]);
    ctx.state.avatars = avatars;
    ctx.avatars.setGroupedChannels(groups);
    ctx.avatars.scheduleScan({ guide: true });
    ctx.cards.refreshChannelNameIndex(groups);

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
          ctx.player.schedulePlayerControlSync();
        }
      }

      for (const node of mutation.addedNodes) {
        ctx.cards.scheduleCardsIn(node);
        if (ctx.cards.nodeBelongsToCurrentVideoOwner(node)) {
          ctx.player.schedulePlayerControlSync();
        }
      }
    }
    ctx.guide.checkPlacement();
    ctx.avatars.noteMutations(mutations);
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
        } else if (name === "settings") {
          ctx.state.settings = YouTubeGroupsSettings.normalizeSettings(
            storage.readSettingsValue(newValue),
          );
          ctx.state.settingsLoaded = true;
          ctx.state.settingsLoadError = null;
          ctx.state.settingsAppliedSeq = ctx.state.settingsWriteSeq;
          ctx.panel.syncSettingsControls();
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
        } else if (name === "avatars") {
          renderGroupsPanel().catch((error) => {
            console.error(
              "[YouTube Groups] No se pudo repintar los avatares",
              error,
            );
          });
        } else if (name === "playlists") {
          ctx.panel.renderPlaylistsSection().catch((error) => {
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
              ctx.panel
                .openPlaylistVideosModal(playlistId, {
                  onlyIfOpen: true,
                })
                .catch((error) => {
                  console.error(
                    "[YouTube Groups] No se pudo repintar el modal",
                    error,
                  );
                });
            } else {
              ctx.panel.closePlaylistModal();
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
