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

    const watchedButton = card.querySelector(".youtube-groups__watched-button");
    if (watchedButton) {
      updateWatchedButton(watchedButton, videoId, isWatched);
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
    button.disabled = !videoId;
  }

  /**
   * Alterna el estado de visto de un vídeo y reaplica la marca a sus tarjetas.
   * Si falla el guardado, el estado no cambia y el botón recibe el error en `title`.
   * @param {string|null} videoId - ID del vídeo.
   * @param {HTMLButtonElement} button - Botón pulsado.
   * @returns {Promise<void>}
   */
  async function toggleVideoWatched(videoId, button) {
    if (!videoId || watchedVideos === null) {
      return;
    }
    try {
      const result = await YouTubeGroupsWatched.setVideoWatched(
        videoId,
        !YouTubeGroupsWatched.isVideoWatched(watchedVideos, videoId),
      );
      watchedVideos = result.videos;
      button.removeAttribute("title");
      for (const card of document.querySelectorAll(VIDEO_CARD_SELECTOR)) {
        if (card.getAttribute(VIDEO_ID_ATTRIBUTE) === videoId) {
          applyWatchedToCard(card);
        }
      }
    } catch (error) {
      button.title = "No se pudo guardar: " + error.message;
      console.error("[YouTube Groups] No se pudo guardar el visto", error);
    }
  }

  YouTubeGroupsStorage.getWatchedVideos()
    .then((videos) => {
      watchedVideos = videos;
      for (const card of document.querySelectorAll(VIDEO_CARD_SELECTOR)) {
        applyWatchedToCard(card);
      }
    })
    .catch((error) => {
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

  const SUBSCRIPTIONS_PATH = "/feed/subscriptions";

  function createSubscriptionChannelControl(card) {
    const control = document.createElement("span");
    control.className = "youtube-groups__subscription-control";

    const button = document.createElement("button");
    button.className =
      "youtube-groups__subscription-add-button action-button primary-button";
    button.type = "button";
    button.textContent = "Añadir a grupo";
    control.appendChild(button);

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
      toggleVideoWatched(findVideoId(card), watchedButton);
    });

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
      openSubscriptionGroupsForm(getChannelFromCard(card), button);
    });

    return control;
  }

  // Dropdown flotante único, anclado a document.body para evitar que YouTube
  // recorte el selector dentro del flujo de la tarjeta (overflow).
  let subscriptionDropdown = null;
  let subscriptionDropdownOpenCount = 0;

  function getOrCreateSubscriptionDropdown() {
    if (!subscriptionDropdown || !subscriptionDropdown.isConnected) {
      subscriptionDropdown = createSubscriptionDropdown();
      document.body.appendChild(subscriptionDropdown);

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

  function shouldShowChannelControls() {
    const { pathname } = window.location;
    return pathname === SUBSCRIPTIONS_PATH || pathname === "/";
  }

  // Un control por tarjeta; es idempotente porque insertarlo provoca una
  // mutación que vuelve a programar la tarjeta.
  function ensureChannelControl(card) {
    if (!card.isConnected || !shouldShowChannelControls()) {
      return;
    }

    if (card.querySelector(".youtube-groups__subscription-control")) {
      return;
    }

    const channelLink = findChannelLink(card);
    if (!channelLink) {
      return;
    }

    channelLink.insertAdjacentElement(
      "afterend",
      createSubscriptionChannelControl(card),
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

    // Apply filter immediately when detecting card
    applyFilterToCard(card, channel);
  }

  function setCardVisibility(card, isVisible) {
    // Always apply the CSS class for filtering
    card.classList.toggle("youtube-groups--filtered-out", !isVisible);

    // Also manage display property for better compatibility
    if (isVisible) {
      card.style.display = "";
    } else {
      card.style.display = "none";
    }
  }

  function applyFilterToCard(card, detectedChannel = null) {
    const channelUrl =
      detectedChannel?.url ?? card.dataset.youtubeGroupsChannelUrl;

    // If no active group is selected (null), show all cards
    if (getActiveGroupId() === null) {
      setCardVisibility(card, true);
      return;
    }

    // If we don't have channel info, show card
    if (!channelUrl) {
      setCardVisibility(card, true);
      return;
    }

    // If we don't have active group channels yet, show card (will be filtered later)
    if (activeGroupChannelUrls === null) {
      setCardVisibility(card, true);
      return;
    }

    // Check if the channel is in the active group using exact match
    const isVisible = activeGroupChannelUrls.has(channelUrl);

    setCardVisibility(card, isVisible);
  }

  function showAllVideoCards() {
    for (const card of document.querySelectorAll(VIDEO_CARD_SELECTOR)) {
      setCardVisibility(card, true);
    }
  }

  function filterAllDetectedCards() {
    for (const card of document.querySelectorAll(VIDEO_CARD_SELECTOR)) {
      applyFilterToCard(card);
    }
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

    if (node.matches(VIDEO_CARD_SELECTOR)) {
      scheduleCard(node);
    }

    for (const card of node.querySelectorAll(VIDEO_CARD_SELECTOR)) {
      scheduleCard(card);
    }
  }

  function scheduleContainingCard(element) {
    const containingCard = element.closest(VIDEO_CARD_SELECTOR);
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

  function getOrCreateIconPicker() {
    if (!iconPicker || !iconPicker.isConnected) {
      iconPicker = createIconPicker();
      document.body.appendChild(iconPicker);
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
})();
