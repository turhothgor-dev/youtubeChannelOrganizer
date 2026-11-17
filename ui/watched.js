/**
 * Estado de visto de los vídeos: botones, marcado de tarjetas y marcado
 * automático. Se crea con `create(ctx)`; no toca el DOM ni registra
 * escuchadores hasta `start()`.
 */
const YouTubeGroupsWatchedUi = (() => {
  const { setCardButtonContent } = YouTubeGroupsIconsDom;

  /**
   * Crea el componente de vistos.
   * @param {Object} ctx - Contexto compartido de `content.js`.
   * @returns {Readonly<Object>} API: `applyWatchedToCard`,
   *   `updateWatchedButton`, `toggleVideoWatched`, `getCurrentVideoId`,
   *   `isWatchPageInSync`, `getCurrentWatchVideoData`,
   *   `toggleCurrentVideoWatched` y `start`.
   */
  function create(ctx) {
    /** IDs de vídeo cuyo cambio de visto se está guardando. */
    const savingWatchedIds = new Set();

    /** IDs que el marcado automático ya no debe volver a intentar en esta pestaña. */
    const autoMarkHandledIds = new Set();

    /** ID de vídeo del que se ha visto el inicio (`currentTime < 1`); en Shorts habilita el marcado. */
    let autoMarkArmedId = null;

    /**
     * Guarda el ID del vídeo en la tarjeta y marca si está visto.
     * Se reevalúa en cada procesado: YouTube puede reutilizar tarjetas.
     * @param {Element} card - Tarjeta de vídeo.
     */
    function applyWatchedToCard(card) {
      const videoId = ctx.cards.findVideoId(card);
      if (videoId) {
        if (card.getAttribute(ctx.cards.VIDEO_ID_ATTRIBUTE) !== videoId) {
          card.setAttribute(ctx.cards.VIDEO_ID_ATTRIBUTE, videoId);
        }
      } else {
        card.removeAttribute(ctx.cards.VIDEO_ID_ATTRIBUTE);
      }
      const isWatched =
        Boolean(videoId) &&
        ctx.state.watchedVideos !== null &&
        YouTubeGroupsWatched.isVideoWatched(ctx.state.watchedVideos, videoId);
      card.classList.toggle(ctx.cards.WATCHED_CLASS, isWatched);
      ctx.cards.applyCardVisibility(card);

      const watchedButton = card.querySelector(
        ".youtube-groups__watched-button",
      );
      if (watchedButton) {
        updateWatchedButton(watchedButton, videoId, isWatched);
      }

      const playlistButton = card.querySelector(
        ".youtube-groups__playlist-button",
      );
      if (playlistButton) {
        if (playlistButton.disabled !== !videoId) {
          playlistButton.disabled = !videoId;
        }
      }
    }

    /**
     * Pone el texto, el estado y la disponibilidad de un botón de visto.
     * @param {HTMLButtonElement} button - Botón "Marcar visto".
     * @param {string|null} videoId - ID del vídeo, o null si no se conoce.
     * @param {boolean} isWatched - Si el vídeo está visto.
     */
    function updateWatchedButton(button, videoId, isWatched) {
      const state = YouTubeGroupsWatched.getWatchedButtonState({
        videoId,
        isWatched,
        loaded: ctx.state.watchedVideos !== null,
        saving: Boolean(videoId) && savingWatchedIds.has(videoId),
      });
      if (button.querySelector(".youtube-groups__card-label")) {
        setCardButtonContent(button, state.glyph, state.label);
      } else {
        // Botón del panel: texto plano, como antes
        button.textContent = isWatched ? "✓ Visto" : "Marcar visto";
      }
      if (button.getAttribute("aria-pressed") !== String(state.pressed)) {
        button.setAttribute("aria-pressed", String(state.pressed));
      }
      if (button.disabled !== state.disabled) {
        button.disabled = state.disabled;
      }
      if (ctx.state.watchedLoadError !== null) {
        const title =
          "No se pudieron leer los vistos: " + ctx.state.watchedLoadError;
        if (button.title !== title) {
          button.title = title;
        }
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
      if (
        !videoId ||
        ctx.state.watchedVideos === null ||
        savingWatchedIds.has(videoId)
      ) {
        return;
      }
      savingWatchedIds.add(videoId);
      refreshWatchedUi(videoId, card);
      ctx.state.watchedWriteSeq += 1;
      const seq = ctx.state.watchedWriteSeq;
      try {
        const result = await YouTubeGroupsWatched.setVideoWatched(
          videoId,
          !YouTubeGroupsWatched.isVideoWatched(
            ctx.state.watchedVideos,
            videoId,
          ),
        );
        if (seq > ctx.state.watchedAppliedSeq) {
          ctx.state.watchedAppliedSeq = seq;
          ctx.state.watchedVideos = result.videos;
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
      for (const card of document.querySelectorAll(
        ctx.cards.VIDEO_CARD_SELECTOR,
      )) {
        if (
          card !== pressedCard &&
          card.getAttribute(ctx.cards.VIDEO_ID_ATTRIBUTE) === videoId
        ) {
          applyWatchedToCard(card);
        }
      }
      ctx.panel.renderCurrentVideoSection();
      ctx.player.schedulePlayerControlSync();
    }

    /**
     * Devuelve el ID del vídeo abierto, solo en páginas /watch y /shorts.
     * @returns {string|null} ID de 11 caracteres o null.
     */
    function getCurrentVideoId() {
      const pageType = YouTubeGroupsPages.getPageType(window.location.pathname);
      if (pageType !== "watch" && pageType !== "shorts") {
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
      if (
        YouTubeGroupsPages.getPageType(window.location.pathname) !== "watch"
      ) {
        return true;
      }
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
      const videoId = getCurrentVideoId();
      if (videoId && !isWatchPageInSync(videoId)) {
        return { id: null, title: "", channelName: "" };
      }
      const isShorts =
        YouTubeGroupsPages.getPageType(window.location.pathname) === "shorts";
      let title = isShorts
        ? ""
        : (document
            .querySelector("ytd-watch-metadata h1")
            ?.textContent.trim() ?? "");
      if (!title) {
        title = document.title.replace(/ - YouTube$/, "").trim();
      }

      return {
        id: videoId,
        title,
        channelName: ctx.cards.getCurrentVideoChannel()?.name ?? "",
      };
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
      ctx.state.watchedWriteSeq += 1;
      const seq = ctx.state.watchedWriteSeq;
      try {
        const result = await YouTubeGroupsWatched.setVideoWatched(
          videoId,
          true,
        );
        if (seq > ctx.state.watchedAppliedSeq) {
          ctx.state.watchedAppliedSeq = seq;
          ctx.state.watchedVideos = result.videos;
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
      if (!ctx.state.settingsLoaded) {
        return;
      }
      if (ctx.state.settings.autoMarkPercent === 0) {
        return;
      }
      const video = event.target;
      if (!(video instanceof HTMLVideoElement)) {
        return;
      }
      const player = video.closest("#movie_player, #shorts-player");
      if (!player || player.classList.contains("ad-showing")) {
        return;
      }
      const videoId = getCurrentVideoId();
      if (!videoId) {
        return;
      }
      if (!isWatchPageInSync(videoId)) {
        return;
      }
      autoMarkArmedId = YouTubeGroupsWatched.updateAutoMarkArm(
        autoMarkArmedId,
        videoId,
        video.currentTime,
      );
      if (
        YouTubeGroupsPages.getPageType(window.location.pathname) === "shorts" &&
        autoMarkArmedId !== videoId
      ) {
        return;
      }
      if (
        ctx.state.watchedVideos === null ||
        YouTubeGroupsWatched.isVideoWatched(ctx.state.watchedVideos, videoId) ||
        savingWatchedIds.has(videoId) ||
        autoMarkHandledIds.has(videoId)
      ) {
        return;
      }
      if (
        !YouTubeGroupsWatched.shouldAutoMark(
          video.currentTime,
          video.duration,
          ctx.state.settings.autoMarkPercent,
        )
      ) {
        return;
      }
      autoMarkHandledIds.add(videoId);
      markVideoWatched(videoId);
    }

    /**
     * Alterna visto/no visto del vídeo actual y evita que el marcado automático
     * lo revierta.
     * @param {HTMLElement} button Botón que lanza la acción.
     */
    function toggleCurrentVideoWatched(button) {
      const videoId = getCurrentVideoId();
      if (videoId) {
        autoMarkHandledIds.add(videoId);
      }
      toggleVideoWatched(videoId, button);
    }

    /**
     * Registra el escuchador de `timeupdate` y lee los vistos guardados.
     * Se llama una vez, desde `content.js`.
     */
    function start() {
      document.addEventListener("timeupdate", handleVideoProgress, true);

      YouTubeGroupsStorage.getWatchedVideos()
        .then((videos) => {
          ctx.state.watchedVideos = videos;
          for (const card of document.querySelectorAll(
            ctx.cards.VIDEO_CARD_SELECTOR,
          )) {
            applyWatchedToCard(card);
          }
          ctx.panel.renderCurrentVideoSection();
        })
        .catch((error) => {
          ctx.state.watchedLoadError = error.message;
          for (const card of document.querySelectorAll(
            ctx.cards.VIDEO_CARD_SELECTOR,
          )) {
            applyWatchedToCard(card);
          }
          ctx.panel.renderCurrentVideoSection();
          console.error(
            "[YouTube Groups] No se pudieron leer los vistos",
            error,
          );
        });
    }

    return Object.freeze({
      applyWatchedToCard,
      updateWatchedButton,
      toggleVideoWatched,
      getCurrentVideoId,
      isWatchPageInSync,
      getCurrentWatchVideoData,
      toggleCurrentVideoWatched,
      start,
    });
  }

  return Object.freeze({ create });
})();
