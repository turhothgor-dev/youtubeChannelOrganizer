"use strict";

/**
 * Página de opciones: editor de grupos (esqueleto: tema, errores y recuento).
 */
(() => {
  const errorEl = document.getElementById("options-error");
  const summaryEl = document.getElementById("options-summary");
  const treeEl = document.getElementById("options-tree");

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
    const children = Array.isArray(group.subgroups) ? group.subgroups : [];
    const isCollapsed = children.length > 0 && collapsed.has(group.id);

    const item = document.createElement("li");
    item.className = "options__node";
    item.setAttribute("role", "none");

    const row = el("div", "options__row");
    row.setAttribute("role", "treeitem");
    row.setAttribute("aria-level", String(level));
    row.tabIndex = 0;
    row.dataset.groupId = group.id;
    if (children.length > 0) {
      row.setAttribute("aria-expanded", String(!isCollapsed));
    }

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
      name.addEventListener("dblclick", () =>
        startEdit("rename", group.id, null, group.name),
      );
      row.append(name);
    }
    const count = Array.isArray(group.channels) ? group.channels.length : 0;
    row.append(
      el(
        "span",
        "options__count",
        count === 1 ? "1 canal" : `${count} canales`,
      ),
    );
    const actions = el("span", "options__actions");
    actions.append(
      actionButton("Renombrar", () =>
        startEdit("rename", group.id, null, group.name),
      ),
      actionButton("Icono y color", (button) => editAppearance(group, button)),
      actionButton("+ Subgrupo", () => startEdit("create", null, group.id, "")),
    );
    row.append(actions);
    row.addEventListener("keydown", (event) => {
      if (event.target === row && event.key === "F2") {
        event.preventDefault();
        startEdit("rename", group.id, null, group.name);
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
    const focusedId =
      !inputFocused &&
      active &&
      treeEl.contains(active) &&
      active.closest("[data-group-id]")
        ? active.closest("[data-group-id]").dataset.groupId
        : null;

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
      summaryEl.textContent = `${countGroups(groups)} grupos`;
      for (const group of groups) {
        treeEl.append(buildNode(groups, group, 1));
      }
    }
    rendering = false;
    if (inputFocused && editing && editing.input) {
      editing.input.focus();
      editing.input.setSelectionRange(selection[0], selection[1]);
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

  document.getElementById("options-add-group").addEventListener("click", () => {
    startEdit("create", null, null, "");
  });

  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
  applyTheme(darkQuery.matches);
  darkQuery.addEventListener("change", (event) => applyTheme(event.matches));

  render();
})();
