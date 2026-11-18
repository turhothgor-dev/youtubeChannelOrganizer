"use strict";

/**
 * Bandeja "Suscripciones sin grupo" del editor: lista las suscripciones
 * conocidas que no están en ningún grupo. No usa innerHTML con datos.
 */
const YouTubeGroupsUnclassified = (() => {
  const EMPTY_TEXT =
    "Aún no se conoce ninguna suscripción. Abre YouTube con la guía " +
    "desplegada o visita «Todas las suscripciones» (youtube.com/feed/channels) " +
    "y baja hasta el final para leerlas todas.";
  const ALL_CLASSIFIED_TEXT =
    "Todas las suscripciones conocidas están en algún grupo.";
  const NO_MATCH_TEXT =
    "Ninguna suscripción sin grupo coincide con la búsqueda.";

  /**
   * Crea un elemento con clase y texto opcional.
   * @param {string} tag - Etiqueta.
   * @param {string} className - Clase CSS.
   * @param {string} [text] - Texto.
   * @returns {HTMLElement} Elemento.
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
   * Crea la bandeja dentro de un contenedor.
   * @param {HTMLElement} container - Sección donde se pinta.
   * @returns {{render: Function}} Componente.
   */
  function create(container) {
    const selected = new Set();
    let lastData = null;
    let adding = false;
    let target = "";
    let busy = false;
    let notice = "";
    let errorText = "";

    /**
     * Texto del aviso tras añadir.
     * @param {string} name - Nombre del grupo.
     * @param {number} added - Canales añadidos.
     * @param {number} skipped - Canales que ya estaban.
     * @returns {string} Aviso.
     */
    function buildNotice(name, added, skipped) {
      let text =
        added === 1 ? `1 añadido a «${name}»` : `${added} añadidos a «${name}»`;
      if (skipped === 1) {
        text += "; 1 ya estaba";
      } else if (skipped > 1) {
        text += `; ${skipped} ya estaban`;
      }
      return text;
    }

    /**
     * Pinta la bandeja.
     * @param {Object} data - Datos.
     * @param {Array<Object>} data.groups - Árbol de grupos.
     * @param {Object} data.subscriptions - Mapa de suscripciones conocidas.
     * @param {Object} data.avatars - Avatares (clave de canal → URL).
     * @param {string} data.query - Texto del buscador.
     * @returns {void}
     */
    function render(data) {
      lastData = data;
      const { groups, subscriptions, avatars, query } = data;
      const all = YouTubeGroupsSubscriptions.getUnclassifiedSubscriptions(
        subscriptions,
        groups,
      );
      const allUrls = new Set(all.map((item) => item.url));
      for (const url of [...selected]) {
        if (!allUrls.has(url)) {
          selected.delete(url);
        }
      }
      const needle = YouTubeGroupsEditor.normalizeSearchText(query || "");
      if (selected.size === 0) {
        adding = false;
      }
      const items = needle
        ? all.filter(
            (item) =>
              YouTubeGroupsEditor.normalizeSearchText(item.name).includes(
                needle,
              ) ||
              YouTubeGroupsEditor.normalizeSearchText(item.url).includes(
                needle,
              ),
          )
        : all;

      container.replaceChildren();
      const title = el(
        "h2",
        "options__channels-title",
        `Suscripciones sin grupo (${all.length})`,
      );
      title.id = "options-unclassified-title";
      container.append(title);
      if (notice) {
        const status = el("p", "options__channels-summary", notice);
        status.setAttribute("role", "status");
        container.append(status);
      }
      if (errorText) {
        const alert = el("p", "options__error", errorText);
        alert.setAttribute("role", "alert");
        container.append(alert);
      }

      if (items.length === 0) {
        const known = Object.keys(
          YouTubeGroupsSubscriptions.normalizeSubscriptions(subscriptions),
        ).length;
        const text =
          known === 0
            ? EMPTY_TEXT
            : all.length === 0
              ? ALL_CLASSIFIED_TEXT
              : NO_MATCH_TEXT;
        container.append(el("p", "options__channels-summary", text));
        return;
      }

      const bar = el("div", "options__channels-bar");
      const selectAll = document.createElement("input");
      selectAll.type = "checkbox";
      selectAll.setAttribute("aria-label", "Seleccionar todo");
      const selectAllLabel = el("label", "options__select-all");
      selectAllLabel.append(selectAll, " Seleccionar todo");
      const addButton = document.createElement("button");
      addButton.type = "button";
      bar.append(selectAllLabel, addButton);

      const checkboxes = [];
      const refresh = () => {
        const visibleSelected = items.filter((item) =>
          selected.has(item.url),
        ).length;
        selectAll.checked = visibleSelected === items.length;
        selectAll.indeterminate =
          visibleSelected > 0 && visibleSelected < items.length;
        selectAll.disabled = busy;
        addButton.textContent = `Añadir a… (${selected.size})`;
        addButton.disabled = busy || selected.size === 0 || adding;
        for (const box of checkboxes) {
          box.disabled = busy;
        }
      };

      selectAll.addEventListener("change", () => {
        for (const item of items) {
          if (selectAll.checked) {
            selected.add(item.url);
          } else {
            selected.delete(item.url);
          }
        }
        for (const box of checkboxes) {
          box.checked = selectAll.checked;
        }
        refresh();
      });
      addButton.addEventListener("click", () => {
        adding = true;
        target = "";
        render(lastData);
        const select = container.querySelector(".options__transfer-select");
        if (select) {
          select.focus();
        }
      });

      if (adding && selected.size > 0) {
        const wrapper = el("span", "options__transfer");
        const select = document.createElement("select");
        select.className = "options__transfer-select";
        select.setAttribute("aria-label", "Añadir a");
        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "Elige un grupo";
        select.append(placeholder);
        for (const group of YouTubeGroups.flattenGroups(groups)) {
          const option = document.createElement("option");
          option.value = group.id;
          option.textContent = "  ".repeat(group.level) + group.name;
          select.append(option);
        }
        select.value = target;
        if (select.value !== target) {
          target = "";
          select.value = "";
        }
        select.disabled = busy;
        const confirm = document.createElement("button");
        confirm.type = "button";
        confirm.textContent = "Añadir";
        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.textContent = "Cancelar";
        cancel.disabled = busy;
        const updateConfirm = () => {
          confirm.disabled = busy || select.value === "";
        };
        updateConfirm();
        const close = () => {
          adding = false;
          target = "";
          render(lastData);
        };
        select.addEventListener("change", () => {
          target = select.value;
          updateConfirm();
        });
        select.addEventListener("keydown", (event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            close();
          }
        });
        cancel.addEventListener("click", close);
        confirm.addEventListener("click", async () => {
          const groupId = select.value;
          const group = YouTubeGroups.flattenGroups(groups).find(
            (candidate) => candidate.id === groupId,
          );
          if (!group) {
            return;
          }
          const channels = all
            .filter((item) => selected.has(item.url))
            .map((item) => ({ name: item.name, url: item.url }));
          busy = true;
          notice = "";
          errorText = "";
          render(lastData);
          try {
            const result = await YouTubeGroupsEditor.addChannelsAndSave(
              groupId,
              channels,
            );
            notice = buildNotice(group.name, result.added, result.skipped);
            selected.clear();
            adding = false;
            target = "";
          } catch (error) {
            console.error(error);
            errorText = "No se pudieron añadir los canales.";
          }
          busy = false;
          render(lastData);
        });
        wrapper.append(select, confirm, cancel);
        bar.append(wrapper);
      }
      container.append(bar);

      const list = el("ul", "options__channel-list");
      for (const item of items) {
        const row = el("li", "options__channel");
        const box = document.createElement("input");
        box.type = "checkbox";
        box.checked = selected.has(item.url);
        box.dataset.url = item.url;
        box.setAttribute("aria-label", `Seleccionar ${item.name}`);
        box.addEventListener("change", () => {
          if (box.checked) {
            selected.add(item.url);
          } else {
            selected.delete(item.url);
          }
          notice = "";
          refresh();
        });
        checkboxes.push(box);
        const avatar = YouTubeGroupsIconsDom.createChannelAvatar(
          item.name,
          YouTubeGroupsAvatars.getAvatarFor(avatars, item.url),
          YouTubeGroupsIconsDom.AVATAR_SIZES.editor,
        );
        const text = el("span", "options__channel-text");
        const link = el("a", "options__channel-link", item.name);
        link.href = item.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        text.append(link, el("span", "options__channel-url", item.url));
        row.append(box, avatar, text);
        list.append(row);
      }
      container.append(list);
      refresh();
    }

    return { render };
  }

  return Object.freeze({ create });
})();
