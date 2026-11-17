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

    row.append(el("span", "options__name", group.name));
    const count = Array.isArray(group.channels) ? group.channels.length : 0;
    row.append(
      el(
        "span",
        "options__count",
        count === 1 ? "1 canal" : `${count} canales`,
      ),
    );
    item.append(row);

    if (children.length > 0 && !isCollapsed) {
      const list = el("ul", "options__children");
      list.setAttribute("role", "group");
      for (const child of children) {
        list.append(buildNode(groups, child, level + 1));
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
    const focusedId =
      active && treeEl.contains(active) && active.closest("[data-group-id]")
        ? active.closest("[data-group-id]").dataset.groupId
        : null;

    treeEl.replaceChildren();
    if (groups.length === 0) {
      summaryEl.textContent = "Aún no hay grupos";
      return;
    }
    summaryEl.textContent = `${countGroups(groups)} grupos`;
    for (const group of groups) {
      treeEl.append(buildNode(groups, group, 1));
    }
    if (focusedId) {
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

  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
  applyTheme(darkQuery.matches);
  darkQuery.addEventListener("change", (event) => applyTheme(event.matches));

  render();
})();
