"use strict";

/**
 * Página de opciones: editor de grupos. Pinta el árbol y permite renombrar en
 * línea, cambiar icono y color, crear grupos y subgrupos, subir, bajar, mover
 * (selector y arrastrar y soltar) y eliminar con "Deshacer".
 */
(() => {
  const errorEl = document.getElementById("options-error");
  const summaryEl = document.getElementById("options-summary");
  const treeEl = document.getElementById("options-tree");
  const channelsEl = document.getElementById("options-channels");

  /**
   * Aplica el atributo `dark` en <html> según el tema del sistema.
   * @param {boolean} isDark - Si el tema es oscuro.
   * @returns {void}
   */
  function applyTheme(isDark) {
    document.documentElement.toggleAttribute("dark", isDark);
  }

  /**
   * Muestra u oculta el mensaje de error de la cabecera.
   * @param {string} message - Texto del error; vacío lo oculta.
   * @returns {void}
   */
  function showError(message) {
    errorEl.textContent = message;
    errorEl.hidden = !message;
  }

  /**
   * Cuenta todos los grupos y subgrupos del árbol.
   * @param {Array<Object>} groups - Árbol de grupos.
   * @returns {number} Número total de nodos.
   */
  function countGroups(groups) {
    return groups.reduce(
      (total, group) =>
        total +
        1 +
        (Array.isArray(group.subgroups) ? countGroups(group.subgroups) : 0),
      0,
    );
  }

  /** Ids de los nodos plegados (se conservan entre repintados). */
  const collapsed = new Set();
  /** Último árbol leído. */
  let currentGroups = [];
  /**
   * Edición en línea en curso (renombrar o crear), o `null`.
   * @type {null|{kind: "rename"|"create", groupId: string|null,
   *   parentId: string|null, value: string, error: string,
   *   input: HTMLInputElement|null, errorEl: HTMLElement|null,
   *   submitting: boolean}}
   */
  let editing = null;
  /** Indica que el árbol se está repintando (los `blur` se ignoran). */
  let rendering = false;

  /**
   * Busca un grupo por id en todo el árbol.
   * @param {Array<Object>} groups - Árbol de grupos.
   * @param {string} id - Id buscado.
   * @returns {Object|null} Grupo o `null`.
   */
  function findGroup(groups, id) {
    for (const group of groups) {
      if (group.id === id) {
        return group;
      }
      const found = findGroup(group.subgroups || [], id);
      if (found) {
        return found;
      }
    }
    return null;
  }

  /**
   * Muestra un error junto al campo de edición en línea.
   * @param {string} message - Texto del error.
   * @returns {void}
   */
  function setEditError(message) {
    if (!editing) {
      return;
    }
    editing.error = message;
    if (editing.errorEl) {
      editing.errorEl.textContent = message;
      editing.errorEl.hidden = !message;
    }
  }

  /**
   * Cancela la edición en línea y devuelve el foco a la fila, si la hay.
   * @returns {void}
   */
  function cancelEdit() {
    const previous = editing;
    editing = null;
    renderTree(currentGroups);
    if (previous && previous.groupId) {
      focusRow(previous.groupId);
    }
  }

  /**
   * Guarda la edición en línea (renombrar o crear). Si el nombre no es válido
   * o la escritura falla, el campo sigue abierto con el error.
   * @returns {Promise<void>}
   */
  async function submitEdit() {
    const current = editing;
    if (!current || current.submitting) {
      return;
    }
    const target =
      current.kind === "rename"
        ? findGroup(currentGroups, current.groupId)
        : null;
    if (current.kind === "rename" && !target) {
      cancelEdit();
      return;
    }
    const isSub =
      current.kind === "rename"
        ? target.type === "subgroup"
        : current.parentId !== null;
    const message = YouTubeGroups.validateGroupName(
      current.value,
      isSub ? "subgroup" : "group",
    );
    if (message) {
      setEditError(message);
      return;
    }
    current.submitting = true;
    try {
      if (current.kind === "rename") {
        if (current.value.trim() !== target.name) {
          await YouTubeGroups.renameGroup(current.groupId, current.value);
        }
      } else if (current.parentId === null) {
        await YouTubeGroups.createGroup(current.value);
      } else {
        await YouTubeGroups.createSubGroup(current.parentId, current.value);
      }
      if (editing === current) {
        editing = null;
        renderTree(currentGroups);
        if (current.groupId) {
          focusRow(current.groupId);
        }
      }
    } catch (error) {
      setEditError(error.message || "No se pudo guardar.");
    } finally {
      current.submitting = false;
    }
  }

  /**
   * Abre la edición en línea.
   * @param {"rename"|"create"} kind - Tipo de edición.
   * @param {string|null} groupId - Grupo que se renombra.
   * @param {string|null} parentId - Padre del grupo que se crea (`null` = primer nivel).
   * @param {string} value - Texto inicial.
   * @returns {void}
   */
  function startEdit(kind, groupId, parentId, value) {
    editing = {
      kind,
      groupId,
      parentId,
      value,
      error: "",
      input: null,
      errorEl: null,
      submitting: false,
    };
    if (parentId) {
      collapsed.delete(parentId);
    }
    renderTree(currentGroups);
    if (editing && editing.input) {
      editing.input.focus();
      editing.input.select();
    }
  }

  /**
   * Crea el campo de edición en línea (Intro o perder el foco guardan,
   * Escape cancela).
   * @returns {HTMLElement} Contenedor con el campo y su error.
   */
  function buildEditor() {
    const current = editing;
    const wrapper = el("span", "options__editor");
    const input = document.createElement("input");
    input.type = "text";
    input.className = "options__input";
    input.value = current.value;
    input.setAttribute(
      "aria-label",
      current.kind === "rename" ? "Nuevo nombre" : "Nombre del grupo nuevo",
    );
    const errorEl = el("span", "options__field-error", current.error);
    errorEl.setAttribute("role", "alert");
    errorEl.hidden = !current.error;
    current.input = input;
    current.errorEl = errorEl;

    input.addEventListener("input", () => {
      current.value = input.value;
    });
    input.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.key === "Enter") {
        event.preventDefault();
        submitEdit();
      } else if (event.key === "Escape") {
        event.preventDefault();
        cancelEdit();
      }
    });
    input.addEventListener("blur", () => {
      if (!rendering && editing === current) {
        submitEdit();
      }
    });
    wrapper.append(input, errorEl);
    return wrapper;
  }

  /**
   * Crea un botón de acción de fila.
   * @param {string} label - Texto visible y `aria-label`.
   * @param {function(HTMLButtonElement): void} onClick - Acción.
   * @returns {HTMLButtonElement} Botón.
   */
  function actionButton(label, onClick) {
    const button = el("button", "options__action", label);
    button.type = "button";
    button.setAttribute("aria-label", label);
    button.addEventListener("click", () => onClick(button));
    return button;
  }

  /**
   * Abre el selector de icono y color de un grupo.
   * @param {Object} group - Grupo.
   * @param {HTMLButtonElement} button - Botón al que se ancla el selector.
   * @returns {void}
   */
  function editAppearance(group, button) {
    YouTubeGroupsIconPicker.openIconPicker(
      { iconId: group.icon || "", colorHex: group.color || "" },
      button,
      (choice) =>
        YouTubeGroups.setGroupAppearance(
          group.id,
          choice.iconId,
          choice.colorHex,
        ),
    );
  }

  /**
   * Selector "Mover a…" abierto, o `null`.
   * `value` es `null` si aún no se ha elegido destino y `""` para "Primer nivel".
   * @type {null|{groupId: string, value: string|null}}
   */
  let moving = null;

  /**
   * Mueve un grupo a un lugar y deja el foco en su fila.
   * @param {Object} group - Grupo a mover.
   * @param {string|null} parentId - Nuevo padre (`null` = primer nivel).
   * @param {number} index - Posición en la lista de destino.
   * @returns {Promise<void>}
   */
  async function moveTo(group, parentId, index) {
    try {
      if (parentId) {
        collapsed.delete(parentId);
      }
      await YouTubeGroupsEditor.moveGroupAndSave(group.id, parentId, index);
      showError("");
    } catch (error) {
      console.error(error);
      showError(error.message || "No se pudo mover.");
    }
    if (moving && moving.groupId === group.id) {
      moving = null;
    }
    renderTree(currentGroups);
    focusRow(group.id);
  }

  /**
   * Sube o baja un grupo entre sus hermanos.
   * @param {Object} group - Grupo a mover.
   * @param {number} delta - `-1` sube, `1` baja.
   * @returns {Promise<void>}
   */
  async function moveSibling(group, delta) {
    const place = YouTubeGroupsEditor.getSiblingMove(
      currentGroups,
      group.id,
      delta,
    );
    if (place) {
      await moveTo(group, place.parentId, place.index);
    }
  }

  /**
   * Abre el selector "Mover a…" de un grupo.
   * @param {Object} group - Grupo a mover.
   * @returns {void}
   */
  function startMove(group) {
    moving = { groupId: group.id, value: null };
    renderTree(currentGroups);
    const select = treeEl.querySelector(".options__move-select");
    if (select) {
      select.focus();
    }
  }

  /**
   * Cierra el selector "Mover a…" y devuelve el foco a la fila.
   * @param {string} groupId - Grupo del selector.
   * @returns {void}
   */
  function cancelMove(groupId) {
    moving = null;
    renderTree(currentGroups);
    focusRow(groupId);
  }

  /**
   * Crea el selector "Mover a…" con sus botones.
   * @param {Object} group - Grupo a mover.
   * @returns {HTMLElement|null} Contenedor del selector, o `null` si el
   *   destino elegido ya no existe (se cancela).
   */
  function buildMoveControl(group) {
    const wrapper = el("span", "options__move");
    const select = document.createElement("select");
    select.className = "options__move-select";
    select.setAttribute("aria-label", "Mover a");
    const targets = YouTubeGroupsEditor.getMoveTargets(currentGroups, group.id);
    let initial = "";
    for (const target of targets) {
      const option = document.createElement("option");
      option.value = target.id === null ? "" : target.id;
      option.textContent =
        "  ".repeat(target.level) +
        target.name +
        (target.current ? " (actual)" : "");
      select.append(option);
      if (target.current) {
        initial = option.value;
      }
    }
    select.value = moving.value !== null ? moving.value : initial;
    if (select.value !== (moving.value !== null ? moving.value : initial)) {
      // El destino elegido ya no existe: se cancela el selector.
      moving = null;
      return null;
    }
    moving.value = select.value;
    select.addEventListener("change", () => {
      moving.value = select.value;
    });
    select.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.key === "Escape") {
        event.preventDefault();
        cancelMove(group.id);
      }
    });
    const confirm = actionButton("Mover", () => {
      const parentId = select.value === "" ? null : select.value;
      const target = parentId ? findGroup(currentGroups, parentId) : null;
      const siblings = parentId
        ? target
          ? target.subgroups || []
          : []
        : currentGroups;
      // Índice relativo a la lista de destino sin el grupo movido.
      moveTo(
        group,
        parentId,
        siblings.filter((item) => item.id !== group.id).length,
      );
    });
    const cancel = actionButton("Cancelar", () => cancelMove(group.id));
    wrapper.append(select, confirm, cancel);
    return wrapper;
  }

  /** Aviso de borrado (`role="status"`), creado en el primer uso. */
  let noticeEl = null;
  /** Temporizador que oculta el aviso. */
  let noticeTimer = null;

  /**
   * Oculta el aviso de borrado.
   * @returns {void}
   */
  function hideNotice() {
    clearTimeout(noticeTimer);
    noticeTimer = null;
    if (noticeEl) {
      noticeEl.replaceChildren();
      noticeEl.hidden = true;
    }
  }

  /**
   * Muestra un aviso, con botón "Deshacer" opcional, durante 10 s.
   * @param {string} message - Texto del aviso.
   * @param {function(): void} [onUndo] - Acción de "Deshacer".
   * @param {boolean} [focusUndo] - Si el foco pasa a "Deshacer".
   * @returns {void}
   */
  function showNotice(message, onUndo, focusUndo) {
    if (!noticeEl) {
      noticeEl = el("div", "options__notice");
      noticeEl.setAttribute("role", "status");
      summaryEl.before(noticeEl);
    }
    hideNotice();
    noticeEl.hidden = false;
    noticeEl.append(el("span", "options__notice-text", message));
    if (onUndo) {
      const undo = el("button", "options__action", "Deshacer");
      undo.type = "button";
      undo.addEventListener("click", onUndo);
      noticeEl.append(undo);
      if (focusUndo) {
        undo.focus();
      }
    }
    noticeTimer = setTimeout(hideNotice, 10000);
  }

  /**
   * Restaura el último grupo borrado.
   * @param {Object} snapshot - Instantánea de `deleteGroupAndSnapshot`.
   * @returns {Promise<void>}
   */
  async function undoDelete(snapshot) {
    try {
      const result = await YouTubeGroupsEditor.restoreGroupAndSave(snapshot);
      showError("");
      showNotice(
        !result.restored
          ? "Ya estaba restaurado"
          : result.atRoot
            ? "Restaurado en el primer nivel (su grupo padre ya no existe)"
            : `Restaurado «${snapshot.group.name}»`,
      );
    } catch (error) {
      console.error(error);
      showError(error.message || "No se pudo restaurar.");
    }
  }

  /**
   * Elimina un grupo sin preguntar y avisa con la opción de deshacer.
   * @param {Object} group - Grupo a eliminar.
   * @returns {Promise<void>}
   */
  async function deleteGroup(group) {
    try {
      const { snapshot, summary } =
        await YouTubeGroupsEditor.deleteGroupAndSnapshot(group.id);
      showError("");
      const parts = [];
      if (summary && summary.subgroups > 0) {
        parts.push(
          summary.subgroups === 1
            ? "1 subgrupo"
            : `${summary.subgroups} subgrupos`,
        );
      }
      if (summary && summary.channels > 0) {
        parts.push(
          summary.channels === 1 ? "1 canal" : `${summary.channels} canales`,
        );
      }
      showNotice(
        `Eliminado «${group.name}»${parts.length ? `, con ${parts.join(" y ")}` : ""}`,
        () => undoDelete(snapshot),
        true,
      );
    } catch (error) {
      console.error(error);
      showError(error.message || "No se pudo eliminar.");
    }
  }

  /** Texto de la búsqueda activa (vacío = sin búsqueda). */
  let searchQuery = "";
  /**
   * Resultado de la búsqueda sobre el último árbol, o `null` sin búsqueda.
   * @type {null|{groupIds: string[], channelMatches: Object, visibleIds: string[]}}
   */
  let searchResult = null;

  /** Id del grupo seleccionado (su lista de canales se ve en el panel), o `null`. */
  let selectedId = null;
  /** URL de los canales marcados en el panel. */
  const selectedUrls = new Set();

  /**
   * Marca en el árbol la fila del grupo seleccionado.
   * @returns {void}
   */
  function markSelectedRow() {
    for (const row of treeEl.querySelectorAll("[data-group-id]")) {
      row.setAttribute(
        "aria-selected",
        String(row.dataset.groupId === selectedId),
      );
    }
  }

  /**
   * Selecciona un grupo, vacía la selección de canales y repinta el panel.
   * @param {string} groupId - Id del grupo.
   * @returns {void}
   */
  function selectGroup(groupId) {
    if (selectedId !== groupId) {
      selectedId = groupId;
      selectedUrls.clear();
      transfer = null;
    }
    markSelectedRow();
    renderChannels();
  }

  /**
   * Restaura canales quitados de un grupo.
   * @param {string} groupId - Id del grupo.
   * @param {Array<{channel: Object, index: number}>} removed - Quitados.
   * @returns {Promise<void>}
   */
  async function undoRemoveChannels(groupId, removed) {
    try {
      const result = await YouTubeGroupsEditor.restoreChannelsAndSave(
        groupId,
        removed,
      );
      showError("");
      showNotice(
        !result.restored
          ? "Ya estaban restaurados"
          : result.restored === 1
            ? "Restaurado 1 canal"
            : `Restaurados ${result.restored} canales`,
      );
    } catch (error) {
      console.error(error);
      showError(error.message || "No se pudo restaurar.");
    }
  }

  /**
   * Quita del grupo los canales marcados, sin preguntar, y avisa con "Deshacer".
   * @param {Object} group - Grupo seleccionado.
   * @returns {Promise<void>}
   */
  async function removeSelectedChannels(group) {
    const urls = [...selectedUrls];
    if (urls.length === 0) {
      return;
    }
    try {
      const { removed } = await YouTubeGroupsEditor.removeChannelsAndSave(
        group.id,
        urls,
      );
      selectedUrls.clear();
      showError("");
      if (removed.length > 0) {
        showNotice(
          removed.length === 1
            ? `Quitado 1 canal de «${group.name}»`
            : `Quitados ${removed.length} canales de «${group.name}»`,
          () => undoRemoveChannels(group.id, removed),
          true,
        );
      }
      renderChannels();
    } catch (error) {
      console.error(error);
      showError(error.message || "No se pudo quitar.");
    }
  }

  /**
   * Selector de destino de "Copiar a…" / "Mover a…" abierto, o `null`.
   * `value` es el id de destino elegido (`""` si aún no hay).
   * @type {null|{mode: "copy"|"move", value: string}}
   */
  let transfer = null;

  /**
   * Abre el selector de destino para copiar o mover los canales marcados.
   * @param {"copy"|"move"} mode - Copiar o mover.
   * @returns {void}
   */
  function startTransfer(mode) {
    transfer = { mode, value: "" };
    renderChannels();
    const select = channelsEl.querySelector(".options__transfer-select");
    if (select) {
      select.focus();
    }
  }

  /**
   * Copia o mueve los canales marcados al grupo elegido y avisa del resultado.
   * @param {Object} group - Grupo de origen.
   * @param {"copy"|"move"} mode - Copiar o mover.
   * @param {string} toId - Id del grupo de destino.
   * @returns {Promise<void>}
   */
  async function runTransfer(group, mode, toId) {
    const urls = [...selectedUrls];
    const target = findGroup(currentGroups, toId);
    if (urls.length === 0 || !target) {
      return;
    }
    try {
      const { added, skipped } =
        await YouTubeGroupsEditor.transferChannelsAndSave(
          group.id,
          urls,
          toId,
          mode,
        );
      transfer = null;
      selectedUrls.clear();
      showError("");
      const done =
        mode === "copy"
          ? added === 1
            ? "1 copiado"
            : `${added} copiados`
          : added === 1
            ? "1 movido"
            : `${added} movidos`;
      const extra =
        skipped === 0
          ? ""
          : skipped === 1
            ? "; 1 ya estaba"
            : `; ${skipped} ya estaban`;
      showNotice(`${done} a «${target.name}»${extra}`);
      renderChannels();
    } catch (error) {
      console.error(error);
      showError(error.message || "No se pudo copiar o mover.");
    }
  }

  /**
   * Crea el selector de destino con su botón de confirmar y de cancelar.
   * @param {Object} group - Grupo de origen (se excluye del selector).
   * @returns {HTMLElement} Contenedor del selector.
   */
  function buildTransferControl(group) {
    const mode = transfer.mode;
    const wrapper = el("span", "options__transfer");
    const select = document.createElement("select");
    select.className = "options__transfer-select";
    select.setAttribute("aria-label", mode === "copy" ? "Copiar a" : "Mover a");
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Elige un grupo";
    select.append(placeholder);
    for (const target of YouTubeGroups.flattenGroups(currentGroups)) {
      if (target.id === group.id) {
        continue;
      }
      const option = document.createElement("option");
      option.value = target.id;
      option.textContent = "  ".repeat(target.level) + target.name;
      select.append(option);
    }
    select.value = transfer.value;
    if (select.value !== transfer.value) {
      // El destino elegido ya no existe.
      transfer.value = "";
      select.value = "";
    }
    const confirm = actionButton(mode === "copy" ? "Copiar" : "Mover", () =>
      runTransfer(group, mode, select.value),
    );
    confirm.classList.add("options__transfer-confirm");
    const updateConfirm = () => {
      confirm.disabled = select.value === "" || selectedUrls.size === 0;
    };
    select.addEventListener("change", () => {
      transfer.value = select.value;
      updateConfirm();
    });
    select.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        transfer = null;
        renderChannels();
      }
    });
    const cancel = actionButton("Cancelar", () => {
      transfer = null;
      renderChannels();
    });
    updateConfirm();
    wrapper.append(select, confirm, cancel);
    return wrapper;
  }

  /**
   * Repinta el panel de canales del grupo seleccionado, conservando las
   * casillas marcadas que sigan existiendo y el foco en una casilla.
   * @returns {void}
   */
  function renderChannels() {
    const active = document.activeElement;
    const focusedUrl =
      active && channelsEl.contains(active) && active.dataset
        ? active.dataset.url || null
        : null;
    const group = selectedId ? findGroup(currentGroups, selectedId) : null;
    channelsEl.replaceChildren();
    if (!group) {
      selectedId = null;
      selectedUrls.clear();
      transfer = null;
      channelsEl.append(el("p", "options__channels-summary", "Elige un grupo"));
      return;
    }
    const allChannels = Array.isArray(group.channels) ? group.channels : [];
    const matchUrls =
      searchResult && searchResult.channelMatches[group.id]
        ? new Set(searchResult.channelMatches[group.id])
        : null;
    const channels = matchUrls
      ? allChannels.filter((channel) => matchUrls.has(channel.url))
      : allChannels;
    const existing = new Set(channels.map((channel) => channel.url));
    for (const url of [...selectedUrls]) {
      if (!existing.has(url)) {
        selectedUrls.delete(url);
      }
    }

    channelsEl.append(
      el("h2", "options__channels-title", `Canales de «${group.name}»`),
    );
    const own = matchUrls
      ? `${channels.length} de ${allChannels.length} canales`
      : channels.length === 1
        ? "1 canal"
        : `${channels.length} canales`;
    const summary = YouTubeGroupsEditor.summarizeSubtree(
      currentGroups,
      group.id,
    );
    const ownKeys = new Set(
      allChannels.map((channel) => YouTubeGroups.getChannelKey(channel.url)),
    );
    const more = summary ? Math.max(0, summary.channels - ownKeys.size) : 0;
    channelsEl.append(
      el(
        "p",
        "options__channels-summary",
        more > 0 ? `${own} · ${more} más en subgrupos` : own,
      ),
    );
    if (channels.length === 0) {
      channelsEl.append(
        el(
          "p",
          "options__channels-summary",
          "Este grupo no tiene canales propios",
        ),
      );
      return;
    }

    const bar = el("div", "options__channels-bar");
    const allLabel = el("label", "options__select-all");
    const allBox = document.createElement("input");
    allBox.type = "checkbox";
    allLabel.append(allBox, " Seleccionar todo");
    const removeButton = actionButton("Quitar", () =>
      removeSelectedChannels(group),
    );
    const copyButton = actionButton("Copiar a…", () => startTransfer("copy"));
    const moveButton = actionButton("Mover a…", () => startTransfer("move"));
    bar.append(allLabel, removeButton, copyButton, moveButton);
    if (transfer) {
      bar.append(buildTransferControl(group));
    }
    channelsEl.append(bar);

    const list = el("ul", "options__channel-list");
    const boxes = [];
    const updateAll = () => {
      allBox.checked = selectedUrls.size === channels.length;
      allBox.indeterminate =
        selectedUrls.size > 0 && selectedUrls.size < channels.length;
      removeButton.textContent = `Quitar (${selectedUrls.size})`;
      removeButton.setAttribute("aria-label", removeButton.textContent);
      removeButton.disabled = selectedUrls.size === 0;
      copyButton.disabled = selectedUrls.size === 0;
      moveButton.disabled = selectedUrls.size === 0;
      const confirmButton = bar.querySelector(".options__transfer-confirm");
      if (confirmButton) {
        confirmButton.disabled = selectedUrls.size === 0;
      }
    };
    for (const channel of channels) {
      const item = el("li", "options__channel");
      const box = document.createElement("input");
      box.type = "checkbox";
      box.dataset.url = channel.url;
      box.checked = selectedUrls.has(channel.url);
      box.setAttribute("aria-label", `Seleccionar ${channel.name}`);
      box.addEventListener("change", () => {
        if (box.checked) {
          selectedUrls.add(channel.url);
        } else {
          selectedUrls.delete(channel.url);
        }
        updateAll();
      });
      boxes.push(box);
      const text = el("span", "options__channel-text");
      const link = el(
        "a",
        "options__channel-link",
        channel.name || channel.url,
      );
      link.href = channel.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      text.append(link, el("span", "options__channel-url", channel.url));
      item.append(box, text);
      list.append(item);
    }
    allBox.addEventListener("change", () => {
      selectedUrls.clear();
      if (allBox.checked) {
        for (const channel of channels) {
          selectedUrls.add(channel.url);
        }
      }
      for (const box of boxes) {
        box.checked = allBox.checked;
      }
      updateAll();
    });
    updateAll();
    channelsEl.append(list);
    if (focusedUrl) {
      const box = boxes.find((item) => item.dataset.url === focusedUrl);
      if (box) {
        box.focus();
      }
    }
  }

  /** Id del grupo que se arrastra, o `null`. */
  let draggingId = null;
  const DROP_CLASSES = [
    "options__row--drop-before",
    "options__row--drop-after",
    "options__row--drop-inside",
  ];

  /**
   * Quita el indicador de posición de todas las filas.
   * @returns {void}
   */
  function clearDropIndicator() {
    for (const row of treeEl.querySelectorAll(".options__row")) {
      row.classList.remove(...DROP_CLASSES);
    }
  }

  /**
   * Muestra el indicador de posición en una fila.
   * @param {HTMLElement} row - Fila destino.
   * @param {"before"|"after"|"inside"} zone - Zona de suelta.
   * @returns {void}
   */
  function showDropIndicator(row, zone) {
    clearDropIndicator();
    row.classList.add(`options__row--drop-${zone}`);
  }

  /**
   * Calcula el lugar de suelta sobre una fila: cuarto superior = antes,
   * inferior = después, centro = dentro.
   * @param {HTMLElement} row - Fila destino.
   * @param {string} targetId - Id del grupo destino.
   * @param {DragEvent} event - Evento de arrastre.
   * @returns {null|{parentId: string|null, index: number, zone: string}}
   *   Lugar válido o `null`.
   */
  function dropPlaceFor(row, targetId, event) {
    const rect = row.getBoundingClientRect();
    const ratio =
      rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0.5;
    const zone = ratio < 0.25 ? "before" : ratio > 0.75 ? "after" : "inside";
    const place = YouTubeGroupsEditor.getDropPosition(
      currentGroups,
      draggingId,
      targetId,
      zone,
    );
    return place ? { ...place, zone } : null;
  }

  /**
   * Crea la fila-campo para un grupo nuevo.
   * @returns {HTMLLIElement} Nodo con el campo de edición.
   */
  function buildCreateNode() {
    const item = document.createElement("li");
    item.className = "options__node";
    item.setAttribute("role", "none");
    const row = el("div", "options__row");
    row.append(buildEditor());
    item.append(row);
    return item;
  }

  /**
   * Crea un elemento con clase y texto opcionales.
   * @param {string} tag - Etiqueta.
   * @param {string} className - Clase CSS.
   * @param {string} [text] - Texto.
   * @returns {HTMLElement} Elemento creado.
   */
  function el(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) {
      node.textContent = text;
    }
    return node;
  }

  /**
   * Crea el elemento de lista de un grupo y, recursivamente, el de sus subgrupos.
   * @param {Array<Object>} groups - Árbol completo.
   * @param {Object} group - Grupo a pintar.
   * @param {number} level - Nivel de anidación (1 = primer nivel).
   * @returns {HTMLLIElement} Nodo del árbol.
   */
  function buildNode(groups, group, level) {
    const searching = searchResult !== null;
    const visible = searching ? new Set(searchResult.visibleIds) : null;
    const children = (
      Array.isArray(group.subgroups) ? group.subgroups : []
    ).filter((child) => !visible || visible.has(child.id));
    const isCollapsed =
      !searching && children.length > 0 && collapsed.has(group.id);

    const item = document.createElement("li");
    item.className = "options__node";
    item.setAttribute("role", "none");

    const row = el("div", "options__row");
    row.setAttribute("role", "treeitem");
    row.setAttribute("aria-level", String(level));
    row.tabIndex = 0;
    row.dataset.groupId = group.id;
    row.setAttribute("aria-selected", String(group.id === selectedId));
    if (children.length > 0) {
      row.setAttribute("aria-expanded", String(!isCollapsed));
    }

    const handle = el("span", "options__handle", "⠿");
    handle.setAttribute("aria-hidden", "true");
    handle.title = "Arrastrar para mover";
    handle.draggable = !editing && !searching;
    handle.hidden = searching;
    handle.addEventListener("dragstart", (event) => {
      draggingId = group.id;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", group.id);
      event.dataTransfer.setDragImage(row, 0, 0);
    });
    handle.addEventListener("dragend", () => {
      draggingId = null;
      clearDropIndicator();
    });
    row.addEventListener("dragover", (event) => {
      const place = draggingId ? dropPlaceFor(row, group.id, event) : null;
      if (!place) {
        clearDropIndicator();
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      showDropIndicator(row, place.zone);
    });
    row.addEventListener("dragleave", (event) => {
      if (!row.contains(event.relatedTarget)) {
        row.classList.remove(...DROP_CLASSES);
      }
    });
    row.addEventListener("drop", (event) => {
      const place = draggingId ? dropPlaceFor(row, group.id, event) : null;
      const dragged = draggingId ? findGroup(currentGroups, draggingId) : null;
      draggingId = null;
      clearDropIndicator();
      if (!place || !dragged) {
        return;
      }
      event.preventDefault();
      moveTo(dragged, place.parentId, place.index);
    });
    row.append(handle);

    const toggle = el("button", "options__toggle");
    toggle.type = "button";
    if (children.length > 0) {
      toggle.textContent = isCollapsed ? "▸" : "▾";
      toggle.setAttribute("aria-label", isCollapsed ? "Desplegar" : "Plegar");
      toggle.addEventListener("click", () => {
        if (collapsed.has(group.id)) {
          collapsed.delete(group.id);
        } else {
          collapsed.add(group.id);
        }
        renderTree(currentGroups);
        focusRow(group.id);
      });
    } else {
      toggle.disabled = true;
      toggle.tabIndex = -1;
      toggle.setAttribute("aria-hidden", "true");
    }
    row.append(toggle);

    const appearance = YouTubeGroups.getGroupAppearance(groups, group.id);
    if (appearance && appearance.icon) {
      const svg = YouTubeGroupsIconsDom.createIconSvg(
        appearance.icon,
        YouTubeGroupsIconsDom.GROUP_ICON_SIZES.choice,
      );
      if (svg) {
        const chip = el("span", "youtube-groups__icon");
        chip.append(svg);
        row.append(chip);
      }
    }
    YouTubeGroupsIconsDom.setGroupBand(row, appearance ? appearance.color : "");

    const isRenaming =
      editing && editing.kind === "rename" && editing.groupId === group.id;
    if (isRenaming) {
      row.append(buildEditor());
    } else {
      const name = el("span", "options__name", group.name);
      name.addEventListener("click", () => selectGroup(group.id));
      name.addEventListener("dblclick", () =>
        startEdit("rename", group.id, null, group.name),
      );
      row.append(name);
    }
    const count = Array.isArray(group.channels) ? group.channels.length : 0;
    const matched =
      searching && searchResult.channelMatches[group.id]
        ? searchResult.channelMatches[group.id].length
        : 0;
    if (searching && searchResult.groupIds.includes(group.id)) {
      row.classList.add("options__row--match");
    }
    row.append(
      el(
        "span",
        "options__count",
        (count === 1 ? "1 canal" : `${count} canales`) +
          (matched > 0
            ? ` · ${matched === 1 ? "1 canal" : `${matched} canales`}`
            : ""),
      ),
    );
    const actions = el("span", "options__actions");
    const upButton = actionButton("Subir", () => moveSibling(group, -1));
    upButton.disabled = !YouTubeGroupsEditor.getSiblingMove(
      groups,
      group.id,
      -1,
    );
    const downButton = actionButton("Bajar", () => moveSibling(group, 1));
    downButton.disabled = !YouTubeGroupsEditor.getSiblingMove(
      groups,
      group.id,
      1,
    );
    actions.append(
      actionButton("Renombrar", () =>
        startEdit("rename", group.id, null, group.name),
      ),
      actionButton("Icono y color", (button) => editAppearance(group, button)),
      actionButton("+ Subgrupo", () => startEdit("create", null, group.id, "")),
    );
    if (!searching) {
      actions.append(
        upButton,
        downButton,
        actionButton("Mover a…", () => startMove(group)),
      );
    }
    actions.append(actionButton("Eliminar", () => deleteGroup(group)));
    row.append(actions);
    if (moving && moving.groupId === group.id) {
      const control = buildMoveControl(group);
      if (control) {
        row.append(control);
      }
    }
    row.addEventListener("keydown", (event) => {
      if (event.target !== row) {
        return;
      }
      if (
        event.altKey &&
        (event.key === "ArrowUp" || event.key === "ArrowDown")
      ) {
        if (searching) {
          return;
        }
        event.preventDefault();
        moveSibling(group, event.key === "ArrowUp" ? -1 : 1);
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectGroup(group.id);
      } else if (event.key === "F2") {
        event.preventDefault();
        startEdit("rename", group.id, null, group.name);
      } else if (event.key === "Delete") {
        event.preventDefault();
        deleteGroup(group);
      }
    });
    item.append(row);

    const creatingHere =
      editing && editing.kind === "create" && editing.parentId === group.id;
    if ((children.length > 0 && !isCollapsed) || creatingHere) {
      const list = el("ul", "options__children");
      list.setAttribute("role", "group");
      for (const child of children) {
        list.append(buildNode(groups, child, level + 1));
      }
      if (creatingHere) {
        list.append(buildCreateNode());
      }
      item.append(list);
    }
    return item;
  }

  /**
   * Da el foco a la fila de un grupo, si existe.
   * @param {string} groupId - Id del grupo.
   * @returns {void}
   */
  function focusRow(groupId) {
    for (const row of treeEl.querySelectorAll("[data-group-id]")) {
      if (row.dataset.groupId === groupId) {
        row.focus();
        return;
      }
    }
  }

  /**
   * Repinta el árbol conservando la fila con el foco.
   * @param {Array<Object>} groups - Árbol de grupos.
   * @returns {void}
   */
  function renderTree(groups) {
    currentGroups = groups;
    const active = document.activeElement;
    const inputFocused = Boolean(
      editing && editing.input && active === editing.input,
    );
    const selection = inputFocused
      ? [editing.input.selectionStart, editing.input.selectionEnd]
      : null;
    const selectFocused = Boolean(
      active &&
      active.classList &&
      active.classList.contains("options__move-select"),
    );
    const focusedId =
      !inputFocused &&
      !selectFocused &&
      active &&
      treeEl.contains(active) &&
      active.closest("[data-group-id]")
        ? active.closest("[data-group-id]").dataset.groupId
        : null;
    // Un repintado nuevo anula cualquier arrastre en curso.
    draggingId = null;

    searchResult = YouTubeGroupsEditor.searchGroups(groups, searchQuery);
    if (moving && (searchResult || !findGroup(groups, moving.groupId))) {
      moving = null;
    }
    // Si el grupo que se renombra o al que se añade un subgrupo ya no existe, se cancela.
    if (editing) {
      const missingId =
        editing.kind === "rename" ? editing.groupId : editing.parentId;
      if (missingId && !findGroup(groups, missingId)) {
        editing = null;
      }
    }

    rendering = true;
    treeEl.replaceChildren();
    if (editing && editing.kind === "create" && editing.parentId === null) {
      treeEl.append(buildCreateNode());
    }
    if (groups.length === 0) {
      summaryEl.textContent = "Aún no hay grupos";
    } else {
      const total = countGroups(groups);
      summaryEl.textContent = total === 1 ? "1 grupo" : `${total} grupos`;
      if (searchResult && searchResult.visibleIds.length === 0) {
        summaryEl.textContent = "Sin resultados";
      }
      const visible = searchResult ? new Set(searchResult.visibleIds) : null;
      for (const group of groups) {
        if (!visible || visible.has(group.id)) {
          treeEl.append(buildNode(groups, group, 1));
        }
      }
    }
    rendering = false;
    renderChannels();
    if (inputFocused && editing && editing.input) {
      editing.input.focus();
      editing.input.setSelectionRange(selection[0], selection[1]);
    } else if (selectFocused && moving) {
      const select = treeEl.querySelector(".options__move-select");
      if (select) {
        select.focus();
      }
    } else if (focusedId) {
      focusRow(focusedId);
    }
  }

  /**
   * Lee los grupos y pinta el árbol.
   * @returns {Promise<void>}
   */
  async function render() {
    try {
      renderTree(await YouTubeGroupsStorage.getGroups());
      showError("");
    } catch (error) {
      console.error(error);
      showError("No se pudieron leer los grupos.");
    }
  }

  browser.storage.onChanged.addListener((changes, areaName) => {
    if (
      !YouTubeGroupsStorage.getChangedKeys(changes, areaName).includes("groups")
    ) {
      return;
    }
    renderTree(
      YouTubeGroupsStorage.readGroupsValue(
        changes[YouTubeGroupsStorage.KEYS.groups].newValue,
      ),
    );
  });

  // Si el arrastre termina fuera de una fila, se limpia el estado.
  for (const type of ["dragend", "drop"]) {
    document.addEventListener(type, () => {
      draggingId = null;
      clearDropIndicator();
    });
  }

  const searchEl = document.getElementById("options-search");
  searchEl.addEventListener("input", () => {
    searchQuery = searchEl.value;
    selectedUrls.clear();
    transfer = null;
    renderTree(currentGroups);
  });
  searchEl.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && searchEl.value !== "") {
      event.preventDefault();
      searchEl.value = "";
      searchQuery = "";
      selectedUrls.clear();
      transfer = null;
      renderTree(currentGroups);
    }
  });

  document.getElementById("options-add-group").addEventListener("click", () => {
    startEdit("create", null, null, "");
  });

  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
  applyTheme(darkQuery.matches);
  darkQuery.addEventListener("change", (event) => applyTheme(event.matches));

  render();
})();
