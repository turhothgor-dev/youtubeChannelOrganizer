(() => {
  "use strict";

  console.log("[YouTube Groups] content.js cargado");

  const VIDEO_CARD_SELECTOR = [
    "ytd-rich-item-renderer",
    "ytd-video-renderer",
    "ytd-grid-video-renderer",
    "ytd-compact-video-renderer",
    "ytd-playlist-video-renderer"
  ].join(", ");

  const STORAGE_KEY = "youtubeGroups";
  let groupsInitializationPromise = null;

  // browser.storage.local guarda: { version: 1, groups: [{ id, name, channels: [{ name, url }] }] }.
  // La versión permite ampliar la estructura sin cambiar la clave de almacenamiento.
  async function getGroups() {
    const stored = await browser.storage.local.get(STORAGE_KEY);
    const data = stored[STORAGE_KEY];

    if (!data || !Array.isArray(data.groups)) {
      if (!groupsInitializationPromise) {
        const emptyGroups = [];
        groupsInitializationPromise = saveGroups(emptyGroups)
          .then(() => emptyGroups)
          .finally(() => {
            groupsInitializationPromise = null;
          });
      }

      return groupsInitializationPromise;
    }

    return data.groups;
  }

  async function saveGroups(groups) {
    if (!Array.isArray(groups)) {
      throw new TypeError("Los grupos deben ser un array.");
    }

    await browser.storage.local.set({
      [STORAGE_KEY]: {
        version: 1,
        groups
      }
    });
  }

  async function createGroup(name) {
    const groupName = name.trim();
    if (!groupName) {
      throw new Error("El nombre del grupo no puede estar vacío.");
    }

    const groups = await getGroups();
    const group = {
      id: crypto.randomUUID(),
      name: groupName,
      channels: []
    };

    groups.push(group);
    await saveGroups(groups);
    return group;
  }

  async function deleteGroup(groupId) {
    const groups = await getGroups();
    const groupIndex = groups.findIndex((item) => item.id === groupId);
    
    if (groupIndex === -1) {
      throw new Error("No existe el grupo indicado.");
    }

    // Remove the group
    groups.splice(groupIndex, 1);
    await saveGroups(groups);
    
    // If this was the active group, clear the active group filter
    if (getActiveGroupId() === groupId) {
      setActiveGroup(null);
    }
    
    return true;
  }

  async function addChannelToGroup(groupId, channel) {
    const channelName = channel?.name?.trim();
    const channelUrl = channel?.url?.trim();
    if (!channelName || !channelUrl) {
      throw new Error("El canal debe incluir nombre y URL.");
    }

    const groups = await getGroups();
    const group = groups.find((item) => item.id === groupId);
    if (!group) {
      throw new Error("No existe el grupo indicado.");
    }

    if (!group.channels.some((item) => item.url === channelUrl)) {
      group.channels.push({ name: channelName, url: channelUrl });
      await saveGroups(groups);
    }

    return group;
  }

  async function removeChannelFromGroup(groupId, channelUrl) {
    const normalizedChannelUrl = channelUrl?.trim();
    if (!normalizedChannelUrl) {
      throw new Error("La URL del canal es obligatoria.");
    }

    const groups = await getGroups();
    const group = groups.find((item) => item.id === groupId);
    if (!group) {
      throw new Error("No existe el grupo indicado.");
    }

    const remainingChannels = group.channels.filter((item) => item.url !== normalizedChannelUrl);
    if (remainingChannels.length !== group.channels.length) {
      group.channels = remainingChannels;
      await saveGroups(groups);
    }

    return group;
  }

  getGroups().catch((error) => {
    console.error("[YouTube Groups] No se pudo inicializar el almacenamiento", error);
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

    console.log("[YouTube Groups][FILTER] grupo activo cambiado", group?.name ?? "Todos");
    refreshActiveGroupFilter();
    renderGroupsPanel().catch((error) => {
      console.error("[YouTube Groups] No se pudo actualizar el grupo activo", error);
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
        <button class="youtube-groups__create-button" type="button">Crear grupo</button>
      </div>
      <div class="youtube-groups__options" role="listbox" aria-label="Grupos"></div>
      <section class="youtube-groups__current-channel" hidden>
        <h3 class="youtube-groups__section-title">Canal actual</h3>
        <p class="youtube-groups__channel-name"></p>
        <button class="youtube-groups__add-channel-button" type="button">Añadir a un grupo</button>
        <form class="youtube-groups__channel-groups-form" hidden>
          <div class="youtube-groups__channel-groups" aria-label="Seleccionar grupos"></div>
          <div class="youtube-groups__form-actions">
            <button class="youtube-groups__cancel-channel-button" type="button">Cancelar</button>
            <button class="youtube-groups__confirm-channel-button" type="submit">Guardar</button>
          </div>
          <p class="youtube-groups__channel-error" aria-live="polite"></p>
        </form>
      </section>
      <form class="youtube-groups__form" hidden>
        <input class="youtube-groups__input" type="text" name="groupName" placeholder="Nombre del grupo" maxlength="80" required>
        <div class="youtube-groups__form-actions">
          <button class="youtube-groups__cancel-button" type="button">Cancelar</button>
          <button class="youtube-groups__confirm-button" type="submit">Guardar</button>
        </div>
        <p class="youtube-groups__error" aria-live="polite"></p>
      </form>
    `;

    const form = panel.querySelector(".youtube-groups__form");
    const input = panel.querySelector(".youtube-groups__input");
    const error = panel.querySelector(".youtube-groups__error");
    const currentChannelForm = panel.querySelector(".youtube-groups__channel-groups-form");
    const currentChannelError = panel.querySelector(".youtube-groups__channel-error");

    panel.querySelector(".youtube-groups__create-button").addEventListener("click", () => {
      form.hidden = false;
      error.textContent = "";
      input.focus();
    });

    panel.querySelector(".youtube-groups__cancel-button").addEventListener("click", () => {
      form.reset();
      form.hidden = true;
      error.textContent = "";
    });

    panel.querySelector(".youtube-groups__add-channel-button").addEventListener("click", () => {
      currentChannelForm.hidden = false;
      currentChannelError.textContent = "";
    });

    panel.querySelector(".youtube-groups__cancel-channel-button").addEventListener("click", () => {
      currentChannelForm.hidden = true;
      currentChannelError.textContent = "";
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      error.textContent = "";

      try {
        await createGroup(input.value);
        form.reset();
        form.hidden = true;
        await renderGroupsPanel();
      } catch (exception) {
        error.textContent = exception.message;
      }
    });

    currentChannelForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      currentChannelError.textContent = "";

      const channel = getCurrentVideoChannel();
      const selectedGroupIds = new Set(
        Array.from(currentChannelForm.querySelectorAll("input:checked"), (input) => input.value)
      );

      if (!channel) {
        currentChannelError.textContent = "No se ha podido identificar el canal actual.";
        return;
      }

      try {
        const groups = await getGroups();
        const groupsToAdd = groups.filter((group) => (
          selectedGroupIds.has(group.id) && !group.channels.some((item) => item.url === channel.url)
        ));
        const groupsToRemove = groups.filter((group) => (
          !selectedGroupIds.has(group.id) && group.channels.some((item) => item.url === channel.url)
        ));

        for (const group of groupsToAdd) {
          await addChannelToGroup(group.id, channel);
        }

        for (const group of groupsToRemove) {
          await removeChannelFromGroup(group.id, channel.url);
        }

        await renderGroupsPanel();
        await refreshActiveGroupFilter();
      } catch (exception) {
        currentChannelError.textContent = exception.message;
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
    const currentChannelSection = panel.querySelector(".youtube-groups__current-channel");
    const currentChannelName = panel.querySelector(".youtube-groups__channel-name");
    const currentChannelGroups = panel.querySelector(".youtube-groups__channel-groups");
    const currentChannelForm = panel.querySelector(".youtube-groups__channel-groups-form");
    
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

    for (const group of groups) {
      const groupOption = document.createElement("button");
      groupOption.type = "button";
      groupOption.className = "youtube-groups__option";
      groupOption.textContent = group.name;
      groupOption.setAttribute("aria-pressed", String(getActiveGroupId() === group.id));
      
      // Add edit button
      const editButton = document.createElement("button");
      editButton.className = "youtube-groups__edit-button";
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
      
      // Add delete button - only for user-created groups (not "Todos")
      const deleteButton = document.createElement("button");
      deleteButton.className = "youtube-groups__delete-button";
      deleteButton.textContent = "Eliminar";
      deleteButton.setAttribute("aria-label", `Eliminar grupo ${group.name}`);
      deleteButton.addEventListener("click", async (event) => {
        event.stopPropagation();
        if (confirm(`¿Estás seguro de que quieres eliminar el grupo "${group.name}"?`)) {
          try {
            await deleteGroup(group.id);
            await renderGroupsPanel();
          } catch (exception) {
            alert(exception.message);
          }
        }
      });
      
      // Add view channels button - only for user-created groups (not "Todos")
      const viewChannelsButton = document.createElement("button");
      viewChannelsButton.className = "youtube-groups__view-channels-button";
      viewChannelsButton.textContent = "Ver canales";
      viewChannelsButton.setAttribute("aria-label", `Ver canales del grupo ${group.name}`);
      // In the "Ver canales" button click handler:
      viewChannelsButton.addEventListener("click", async (event) => {
        event.stopPropagation();
        try {
          const groupsData = await getGroups();
          const targetGroup = groupsData.find(g => g.id === group.id);
          if (targetGroup && targetGroup.channels && targetGroup.channels.length > 0) {
            console.log("[YouTube Groups][VIEW CHANNELS] Grupo:", targetGroup.name, "Canales:", targetGroup.channels.length);
            
            // Check if modal already exists
            const existingModal = document.querySelector(".youtube-groups__channel-list-modal");
            if (existingModal) {
              document.body.removeChild(existingModal);
            }
            
            let channelListHtml = `<h4>Canales en "${targetGroup.name}" (${targetGroup.channels.length})</h4><ul>`;
            for (const channel of targetGroup.channels) {
              channelListHtml += `<li><strong>${channel.name}</strong><br>${channel.url}</li>`;
            }
            channelListHtml += "</ul>";
            
            // Create a simple modal-like display
            const modal = document.createElement("div");
            modal.className = "youtube-groups__channel-list-modal";
            modal.innerHTML = `
              <div class="youtube-groups__channel-list-content">
                <div class="youtube-groups__channel-list-header">
                  <h3>Lista de Canales</h3>
                  <button class="youtube-groups__close-channels-button" type="button">×</button>
                </div>
                ${channelListHtml}
              </div>
            `;
            
            document.body.appendChild(modal);
            
            // Add close functionality
            modal.querySelector(".youtube-groups__close-channels-button").addEventListener("click", () => {
              document.body.removeChild(modal);
            });
            
            // Close when clicking outside
            modal.addEventListener("click", (event) => {
              if (event.target === modal) {
                document.body.removeChild(modal);
              }
            });
          } else {
            console.log("[YouTube Groups][VIEW CHANNELS] Grupo:", targetGroup.name, "Sin canales");
            alert(`El grupo "${targetGroup.name}" no tiene canales.`);
          }
        } catch (exception) {
          console.error("[YouTube Groups][VIEW CHANNELS] Error mostrando canales:", exception);
          alert("Error al mostrar los canales del grupo.");
        }
      });
      
      groupOption.appendChild(editButton);
      groupOption.appendChild(deleteButton);
      groupOption.appendChild(viewChannelsButton);
      groupOption.addEventListener("click", () => setActiveGroup(group));
      options.append(groupOption);
    }

    // Now handle current channel section AFTER groups are rendered
    const channel = getCurrentVideoChannel();
    currentChannelSection.hidden = !channel;
    currentChannelForm.hidden = true;
    currentChannelGroups.replaceChildren();

    if (!channel) {
      return;
    }

    currentChannelName.textContent = channel.name;

    for (const group of groups) {
      const label = document.createElement("label");
      label.className = "youtube-groups__group-choice";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = group.id;
      checkbox.checked = group.channels.some((item) => item.url === channel.url);

      const groupName = document.createElement("span");
      groupName.textContent = group.name;

      label.append(checkbox, groupName);
      currentChannelGroups.append(label);
    }
  }

  async function renameGroup(groupId, newName) {
    const groups = await getGroups();
    const group = groups.find((item) => item.id === groupId);
    if (!group) {
      throw new Error("No existe el grupo indicado.");
    }

    const newGroupName = newName.trim();
    if (!newGroupName) {
      throw new Error("El nombre del grupo no puede estar vacío.");
    }

    group.name = newGroupName;
    await saveGroups(groups);
    return group;
  }

  let detectedCards = new WeakSet();
  let loggedChannelUrls = new Set();
  const pendingCards = new Set();
  let processingScheduled = false;

  function normalizeChannelUrl(href) {
    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin) {
      return null;
    }

    const match = url.pathname.match(/^(\/@[^/]+|\/channel\/[^/]+|\/c\/[^/]+|\/user\/[^/]+)\/?$/);

    if (!match) {
      return null;
    }

    const cleanUrl = new URL(match[1], url.origin);
    cleanUrl.search = "";
    cleanUrl.hash = "";
    return cleanUrl.href;
  }

  function getChannelName(link) {
    return link.textContent.trim() || link.getAttribute("aria-label")?.trim() || link.getAttribute("title")?.trim() || "";
  }

  function getChannelFromCard(card) {
    const links = card.querySelectorAll("a[href]");

    for (const link of links) {
      const name = getChannelName(link);
      const url = normalizeChannelUrl(link.href);

      if (name && url) {
        return { name, url };
      }
    }

    return null;
  }

  const SUBSCRIPTIONS_PATH = "/feed/subscriptions";
  const SUBSCRIPTIONS_CANDIDATE_SELECTOR = [
    VIDEO_CARD_SELECTOR,
    "ytd-channel-renderer"
  ].join(", ");
  let subscriptionsPageLogged = false;
  let subscriptionCandidateCount = null;
  let subscriptionNoChannelLogged = false;
  let subscriptionScanScheduled = false;
  let subscriptionChannelUrls = new Set();
  let subscriptionChannelControls = new Map();

  function isSubscriptionsPage() {
    return window.location.pathname === SUBSCRIPTIONS_PATH;
  }

  function resetSubscriptionsDiagnostics() {
    subscriptionsPageLogged = false;
    subscriptionCandidateCount = null;
    subscriptionNoChannelLogged = false;
    subscriptionScanScheduled = false;
    subscriptionChannelUrls = new Set();
    subscriptionChannelControls = new Map();
  }

  function scanSubscriptionsPage() {
    subscriptionScanScheduled = false;
    if (!isSubscriptionsPage()) {
      return;
    }

    if (!subscriptionsPageLogged) {
      subscriptionsPageLogged = true;
      console.log("[YouTube Groups][SUBSCRIPTIONS] Página de suscripciones detectada");
    }

    const candidates = document.querySelectorAll(SUBSCRIPTIONS_CANDIDATE_SELECTOR);
    if (subscriptionCandidateCount !== candidates.length) {
      subscriptionCandidateCount = candidates.length;
      console.log("[YouTube Groups][SUBSCRIPTIONS] Elementos candidatos encontrados", candidates.length);
    }

    for (const candidate of candidates) {
      const channel = getChannelFromCard(candidate);
      if (!channel) {
        continue;
      }

      if (!subscriptionChannelUrls.has(channel.url)) {
        subscriptionChannelUrls.add(channel.url);
        if (subscriptionChannelUrls.size <= 10) {
          console.log("[YouTube Groups][SUBSCRIPTIONS] Canal detectado", {
            channelName: channel.name,
            channelUrl: channel.url
          });
        }
      }

      addSubscriptionChannelControl(candidate, channel);
    }

    if (subscriptionChannelUrls.size === 0 && !subscriptionNoChannelLogged) {
      subscriptionNoChannelLogged = true;
      console.log("[YouTube Groups][SUBSCRIPTIONS] No se han detectado canales", {
        candidateSelector: SUBSCRIPTIONS_CANDIDATE_SELECTOR,
        candidatesFound: candidates.length
      });
    }
  }

  function scheduleSubscriptionsScan() {
    if (!isSubscriptionsPage() || subscriptionScanScheduled) {
      return;
    }

    subscriptionScanScheduled = true;
    requestAnimationFrame(scanSubscriptionsPage);
  }

  function getChannelLinkFromCard(card, channelUrl) {
    return Array.from(card.querySelectorAll("a[href]")).find((link) => (
      normalizeChannelUrl(link.href) === channelUrl
    ));
  }

  function createSubscriptionChannelControl(channel) {
    const control = document.createElement("span");
    control.className = "youtube-groups__subscription-control";
    control.dataset.youtubeGroupsSubscriptionChannelUrl = channel.url;
    control.innerHTML = `
      <button class="youtube-groups__subscription-add-button" type="button">Añadir a grupo</button>
      <form class="youtube-groups__subscription-groups-form" hidden>
        <div class="youtube-groups__subscription-groups"></div>
        <div class="youtube-groups__subscription-actions">
          <button class="youtube-groups__subscription-cancel-button" type="button">Cancelar</button>
          <button class="youtube-groups__subscription-save-button" type="submit">Guardar</button>
        </div>
        <p class="youtube-groups__subscription-error" aria-live="polite"></p>
      </form>
    `;

    control.addEventListener("mousedown", (event) => {
      event.stopPropagation();
    });

    control.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    const form = control.querySelector(".youtube-groups__subscription-groups-form");
    const groupsContainer = control.querySelector(".youtube-groups__subscription-groups");
    const error = control.querySelector(".youtube-groups__subscription-error");

    control.querySelector(".youtube-groups__subscription-add-button").addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      error.textContent = "";
      groupsContainer.replaceChildren();

      try {
        const groups = await getGroups();
        for (const group of groups) {
          const label = document.createElement("label");
          label.className = "youtube-groups__subscription-group-choice";

          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.value = group.id;
          checkbox.checked = group.channels.some((item) => item.url === channel.url);

          const groupName = document.createElement("span");
          groupName.textContent = group.name;

          label.append(checkbox, groupName);
          groupsContainer.append(label);
        }

        form.hidden = false;
        console.log("[YouTube Groups][SUBSCRIPTIONS-UI] Selector de grupos abierto", {
          channelName: channel.name,
          channelUrl: channel.url
        });
      } catch (exception) {
        error.textContent = exception.message;
      }
    });

    control.querySelector(".youtube-groups__subscription-cancel-button").addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      form.hidden = true;
      error.textContent = "";
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      error.textContent = "";

      const selectedGroupIds = new Set(
        Array.from(form.querySelectorAll("input:checked"), (input) => input.value)
      );

      try {
        const groups = await getGroups();
        const groupsToAdd = groups.filter((group) => (
          selectedGroupIds.has(group.id) && !group.channels.some((item) => item.url === channel.url)
        ));
        const groupsToRemove = groups.filter((group) => (
          !selectedGroupIds.has(group.id) && group.channels.some((item) => item.url === channel.url)
        ));

        for (const group of groupsToAdd) {
          await addChannelToGroup(group.id, channel);
        }

        for (const group of groupsToRemove) {
          await removeChannelFromGroup(group.id, channel.url);
        }

        await refreshActiveGroupFilter();
        form.hidden = true;
        console.log("[YouTube Groups][SUBSCRIPTIONS-UI] Cambios guardados", {
          channelName: channel.name,
          channelUrl: channel.url,
          addedGroupIds: groupsToAdd.map((group) => group.id),
          removedGroupIds: groupsToRemove.map((group) => group.id)
        });
      } catch (exception) {
        error.textContent = exception.message;
      }
    });

    return control;
  }

  function addSubscriptionChannelControl(card, channel) {
    const existingControl = subscriptionChannelControls.get(channel.url) ?? Array.from(
      document.querySelectorAll(".youtube-groups__subscription-control")
    ).find((control) => control.dataset.youtubeGroupsSubscriptionChannelUrl === channel.url);
    if (existingControl?.isConnected) {
      subscriptionChannelControls.set(channel.url, existingControl);
      return;
    }

    const channelLink = getChannelLinkFromCard(card, channel.url);
    if (!channelLink) {
      return;
    }

    const control = createSubscriptionChannelControl(channel);
    channelLink.insertAdjacentElement("afterend", control);
    subscriptionChannelControls.set(channel.url, control);
    console.log("[YouTube Groups][SUBSCRIPTIONS-UI] Control añadido al canal", {
      channelName: channel.name,
      channelUrl: channel.url
    });
  }

  const CURRENT_VIDEO_OWNER_SELECTOR = "ytd-watch-metadata #owner, ytd-video-owner-renderer";

  function getCurrentVideoChannel() {
    if (window.location.pathname !== "/watch") {
      return null;
    }

    const owner = document.querySelector(CURRENT_VIDEO_OWNER_SELECTOR);
    return owner ? getChannelFromCard(owner) : null;
  }

  function detectCard(card) {
    if (detectedCards.has(card) || !card.isConnected) {
      return;
    }

    const channel = getChannelFromCard(card);
    if (!channel) {
      return;
    }

    detectedCards.add(card);
    card.dataset.youtubeGroupsChannelName = channel.name;
    card.dataset.youtubeGroupsChannelUrl = channel.url;

    applyFilterToCard(card, channel);

    if (!loggedChannelUrls.has(channel.url)) {
      loggedChannelUrls.add(channel.url);
      console.debug("[YouTube Groups] Canal detectado correctamente", {
        channelName: channel.name,
        channelUrl: channel.url
      });
    }
  }

  function setCardVisibility(card, isVisible) {
    card.classList.toggle("youtube-groups--filtered-out", !isVisible);
  }

  function applyFilterToCard(card, detectedChannel = null) {
    const channelUrl = detectedChannel?.url ?? card.dataset.youtubeGroupsChannelUrl;

    if (getActiveGroupId() === null || activeGroupChannelUrls === null || !channelUrl) {
      setCardVisibility(card, true);
      return;
    }

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
    activeGroupChannelUrls = null;
    showAllVideoCards();

    if (activeId === null) {
      return;
    }

    try {
      const groups = await getGroups();
      if (updateVersion !== filterUpdateVersion || activeId !== getActiveGroupId()) {
        return;
      }

      const activeGroup = groups.find((group) => group.id === activeId);
      activeGroupChannelUrls = new Set(activeGroup?.channels.map((channel) => channel.url) ?? []);
      filterAllDetectedCards();
    } catch (error) {
      console.error("[YouTube Groups][FILTER] No se pudo aplicar el filtro", error);
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

  function clearDetectedChannelData() {
    for (const card of document.querySelectorAll(VIDEO_CARD_SELECTOR)) {
      delete card.dataset.youtubeGroupsChannelName;
      delete card.dataset.youtubeGroupsChannelUrl;
    }
  }

  let currentChannelUpdateScheduled = false;

  function nodeBelongsToCurrentVideoOwner(node) {
    return node instanceof Element && (
      node.matches(CURRENT_VIDEO_OWNER_SELECTOR) ||
      node.closest(CURRENT_VIDEO_OWNER_SELECTOR) ||
      node.querySelector(CURRENT_VIDEO_OWNER_SELECTOR)
    );
  }

  function scheduleCurrentChannelPanelUpdate() {
    if (currentChannelUpdateScheduled || window.location.pathname !== "/watch") {
      return;
    }

    currentChannelUpdateScheduled = true;
    requestAnimationFrame(() => {
      currentChannelUpdateScheduled = false;
      renderGroupsPanel().catch((error) => {
        console.error("[YouTube Groups] No se pudo actualizar el canal actual", error);
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

    scheduleSubscriptionsScan();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  // YouTube is a SPA: cards can be reutilizadas entre navegaciones internas.
  document.addEventListener("yt-navigate-finish", () => {
    detectedCards = new WeakSet();
    loggedChannelUrls = new Set();
    resetSubscriptionsDiagnostics();
    clearDetectedChannelData();
    scanDocument();
    scheduleSubscriptionsScan();
    refreshActiveGroupFilter();
    renderGroupsPanel().catch((error) => {
      console.error("[YouTube Groups] No se pudo actualizar el panel de grupos", error);
    });
  });

  scanDocument();
  scheduleSubscriptionsScan();
  refreshActiveGroupFilter();
  renderGroupsPanel().catch((error) => {
    console.error("[YouTube Groups] No se pudo cargar el panel de grupos", error);
  });
})();
