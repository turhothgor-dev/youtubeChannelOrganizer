/**
 * Botones sobre el reproductor de /watch (solo con el vídeo parado). Se crea
 * con `create(ctx)`; no toca el DOM hasta `start()`.
 */
const YouTubeGroupsPlayer = (() => {
  const { setCardButtonContent, shieldControlEvents } = YouTubeGroupsIconsDom;

  /**
   * Crea el componente del reproductor.
   * @param {Object} ctx - Contexto compartido de `content.js`.
   * @returns {Readonly<Object>} API: `syncPlayerControl`,
   *   `schedulePlayerControlSync`, `noteMutations` y `start`.
   */
  function create(ctx) {
    // --- Botones sobre el reproductor de /watch (solo con el vídeo parado) ---
    const PLAYER_SELECTOR = "#movie_player";
    const PLAYER_CONTROL_CLASS = "youtube-groups__player-actions";
    let playerControlScheduled = false;
    // Entre yt-navigate-start y yt-navigate-finish el control permanece oculto
    let playerNavigating = false;
    // Referencia al control, para que el observer no consulte el DOM en cada mutación
    let playerControl = null;

    /**
     * Crea la columna de botones del reproductor, con el aspecto de las
     * miniaturas. Actúa siempre sobre el vídeo y el canal actuales.
     * @returns {HTMLElement} Control con los botones +G, visto y lista.
     */
    function createPlayerControl() {
      const control = document.createElement("span");
      control.className =
        "youtube-groups__subscription-control youtube-groups__card-actions--overlay " +
        PLAYER_CONTROL_CLASS;
      shieldControlEvents(control);
      // Espacio o Intro sobre un botón no deben llegar a los atajos del
      // reproductor (Firefox activa el botón con Espacio en keyup)
      for (const type of ["keydown", "keyup"]) {
        control.addEventListener(type, (event) => {
          event.stopPropagation();
        });
      }

      const addButton = document.createElement("button");
      addButton.className =
        "youtube-groups__subscription-add-button action-button primary-button";
      addButton.type = "button";
      setCardButtonContent(addButton, "+G", "Añadir a grupo", false);
      addButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        ctx.dropdowns.openSubscriptionGroupsForm(
          ctx.cards.getCurrentVideoChannel(),
          addButton,
        );
      });
      control.appendChild(addButton);

      const watchedButton = document.createElement("button");
      watchedButton.className =
        "youtube-groups__watched-button action-button secondary-button";
      watchedButton.type = "button";
      setCardButtonContent(watchedButton, null, "Marcar visto");
      watchedButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        ctx.watched.toggleCurrentVideoWatched(watchedButton);
      });
      control.appendChild(watchedButton);

      const playlistButton = document.createElement("button");
      playlistButton.className =
        "youtube-groups__playlist-button action-button secondary-button";
      playlistButton.type = "button";
      setCardButtonContent(playlistButton, "playlist-add", "Lista");
      playlistButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        ctx.dropdowns.openPlaylistForm(
          ctx.watched.getCurrentWatchVideoData(),
          playlistButton,
        );
      });
      control.appendChild(playlistButton);

      return control;
    }

    /**
     * Muestra, oculta o actualiza el control sobre `#movie_player`. Es
     * idempotente: reutiliza un único control, lo reubica si YouTube recrea el
     * reproductor y borra los duplicados.
     */
    function syncPlayerControl() {
      const controls = Array.from(
        document.querySelectorAll("." + PLAYER_CONTROL_CLASS),
      );
      const pageType = YouTubeGroupsPages.getPageType(window.location.pathname);
      const player =
        pageType === "watch" ? document.querySelector(PLAYER_SELECTOR) : null;
      if (!player || playerNavigating) {
        for (const existing of controls) {
          existing.hidden = true;
        }
        return;
      }

      let control = controls.find((existing) => player.contains(existing));
      if (!control) {
        control = controls[0] ?? createPlayerControl();
      }
      for (const existing of controls) {
        if (existing !== control) {
          existing.remove();
        }
      }
      if (control.parentElement !== player) {
        player.appendChild(control);
      }
      playerControl = control;

      const video = player.querySelector("video");
      control.hidden = !YouTubeGroupsPages.shouldShowPlayerControls({
        pageType,
        paused: video ? video.paused : true,
        fullscreen: document.fullscreenElement !== null,
        adShowing: player.classList.contains("ad-showing"),
      });
      if (control.hidden) {
        return;
      }

      const addButton = control.querySelector(
        ".youtube-groups__subscription-add-button",
      );
      const rawId = ctx.watched.getCurrentVideoId();
      const videoId =
        rawId && ctx.watched.isWatchPageInSync(rawId) ? rawId : null;
      // Sin sincronizar, el canal podría ser el del vídeo anterior
      if ((!rawId || videoId) && ctx.cards.getCurrentVideoChannel()) {
        addButton.disabled = false;
        addButton.removeAttribute("title");
      } else {
        addButton.disabled = true;
        addButton.title = "No se pudo identificar el canal";
      }

      ctx.watched.updateWatchedButton(
        control.querySelector(".youtube-groups__watched-button"),
        videoId,
        Boolean(videoId) &&
          ctx.state.watchedVideos !== null &&
          YouTubeGroupsWatched.isVideoWatched(ctx.state.watchedVideos, videoId),
      );
      control.querySelector(".youtube-groups__playlist-button").disabled =
        !videoId;
    }

    /** Recalcula el control del reproductor como mucho una vez por frame. */
    function schedulePlayerControlSync() {
      if (playerControlScheduled) {
        return;
      }
      playerControlScheduled = true;
      requestAnimationFrame(() => {
        playerControlScheduled = false;
        syncPlayerControl();
      });
    }

    /**
     * Registra los escuchadores del reproductor y hace la primera sincronización.
     * `content.js` lo llama en el punto donde antes estaban estas líneas.
     */
    function start() {
      // Los eventos de medios no burbujean: se escuchan en captura sobre document
      for (const type of ["play", "pause", "ended"]) {
        document.addEventListener(
          type,
          (event) => {
            if (
              event.target instanceof HTMLVideoElement &&
              event.target.closest(PLAYER_SELECTOR)
            ) {
              schedulePlayerControlSync();
            }
          },
          true,
        );
      }
      document.addEventListener("yt-navigate-start", () => {
        // Evita enseñar los botones del vídeo anterior durante la carga:
        // syncPlayerControl los mantiene ocultos hasta yt-navigate-finish
        playerNavigating = true;
        for (const existing of document.querySelectorAll(
          "." + PLAYER_CONTROL_CLASS,
        )) {
          existing.hidden = true;
        }
      });
      document.addEventListener("yt-navigate-finish", () => {
        playerNavigating = false;
        schedulePlayerControlSync();
      });
      document.addEventListener("fullscreenchange", schedulePlayerControlSync);
      syncPlayerControl();
    }

    /**
     * Parte del observer de mutaciones que atañe al reproductor: reprograma la
     * sincronización si el control ya no está dentro de `#movie_player`.
     */
    function noteMutations() {
      if (
        YouTubeGroupsPages.getPageType(window.location.pathname) === "watch"
      ) {
        const player = document.querySelector(PLAYER_SELECTOR);
        if (
          player &&
          !(
            playerControl &&
            playerControl.isConnected &&
            playerControl.parentElement === player
          )
        ) {
          schedulePlayerControlSync();
        }
      }
    }

    return Object.freeze({
      syncPlayerControl,
      schedulePlayerControlSync,
      noteMutations,
      start,
    });
  }

  return Object.freeze({ create });
})();
