/**
 * Desplegables flotantes de suscripción a grupos y de listas, y el árbol de
 * casillas de grupos. Se crea con `create(ctx)`; no toca el DOM al crearse.
 */
const YouTubeGroupsDropdowns = (() => {
  const { getGroups } = YouTubeGroupsStorage;
  const { setChannelGroups } = YouTubeGroups;
  const { GROUP_ICON_SIZES, createGroupMark, setGroupBand } =
    YouTubeGroupsIconsDom;
  const { hideIconPicker } = YouTubeGroupsIconPicker;

  /**
   * Crea el componente de los desplegables.
   * @param {Object} ctx - Contexto compartido de `content.js`.
   * @returns {Readonly<Object>} API: `renderChannelGroupChoices`,
   *   `openSubscriptionGroupsForm`, `hideSubscriptionDropdown`,
   *   `openPlaylistForm` y `hidePlaylistDropdown`.
   */
  function create(ctx) {
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

          const labelAppearance = YouTubeGroups.getGroupAppearance(
            groups,
            group.id,
          );
          setGroupBand(label, labelAppearance ? labelAppearance.color : null);

          const mark = createGroupMark(
            groups,
            group.id,
            GROUP_ICON_SIZES.choice,
          );
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
            hideSubscriptionDropdown();
          }
        });

        // Cerrar dropdown al hacer scroll para evitar posiciones obsoletas
        window.addEventListener("scroll", hideSubscriptionDropdown, {
          passive: true,
        });
      }

      return subscriptionDropdown;
    }

    function hideSubscriptionDropdown() {
      const form = subscriptionDropdown?.querySelector(
        ".youtube-groups__subscription-groups-form",
      );
      if (form) {
        form.hidden = true;
      }
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
      hidePlaylistDropdown();
      hideIconPicker();
      const dropdown = getOrCreateSubscriptionDropdown();
      const form = dropdown.querySelector(
        ".youtube-groups__subscription-groups-form",
      );
      const groupsContainer = dropdown.querySelector(
        ".youtube-groups__subscription-groups",
      );
      const error = dropdown.querySelector(
        ".youtube-groups__subscription-error",
      );

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
          await ctx.renderGroupsPanel();
          await ctx.refreshActiveSelection();
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
      hideSubscriptionDropdown();
      hideIconPicker();
      const dropdown = getOrCreatePlaylistDropdown();
      const form = dropdown.querySelector(
        ".youtube-groups__playlist-dropdown-form",
      );
      const choices = dropdown.querySelector(
        ".youtube-groups__playlist-choices",
      );
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
          await ctx.panel.renderPlaylistsSection();
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
          await ctx.panel.renderPlaylistsSection();
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

    return Object.freeze({
      renderChannelGroupChoices,
      openSubscriptionGroupsForm,
      hideSubscriptionDropdown,
      openPlaylistForm,
      hidePlaylistDropdown,
    });
  }

  return Object.freeze({ create });
})();
