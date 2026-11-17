/**
 * Selector de iconos y colores de grupo. Sin `ctx`: solo declara; no toca el
 * DOM al cargar (el selector se crea al abrirlo por primera vez).
 */
const YouTubeGroupsIconPicker = (() => {
  const { createIconSvg, GROUP_ICON_SIZES, setGroupBand } =
    YouTubeGroupsIconsDom;

  // --- Icon Picker (singleton lazy) ---
  let iconPicker = null;
  let iconPickerListenersAdded = false;

  function getOrCreateIconPicker() {
    if (!iconPicker || !iconPicker.isConnected) {
      iconPicker = createIconPicker();
      document.body.appendChild(iconPicker);
    }
    // Los escuchadores globales se registran una sola vez: leen la variable
    // del singleton, así que sirven también para el elemento recreado.
    if (!iconPickerListenersAdded) {
      iconPickerListenersAdded = true;
      document.addEventListener("mousedown", (event) => {
        if (iconPicker && !iconPicker.contains(event.target)) {
          hideIconPicker();
        }
      });
      window.addEventListener("scroll", hideIconPicker, { passive: true });
    }
    return iconPicker;
  }

  /** Oculta del todo el selector de iconos (contenedor y formulario). */
  function hideIconPicker() {
    if (!iconPicker) {
      return;
    }
    iconPicker.hidden = true;
    const form = iconPicker.querySelector(".youtube-groups__icon-picker-form");
    if (form) {
      form.hidden = true;
    }
  }

  function createIconPicker() {
    const container = document.createElement("div");
    container.className = "youtube-groups__icon-picker";
    container.hidden = true;
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
        const iconSvg = createIconSvg(icon.id, GROUP_ICON_SIZES.pickerGrid);
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
      setGroupBand(preview, selectedColorHex);
      if (!selectedIconId) {
        const span = document.createElement("span");
        span.className = "youtube-groups__icon-picker-preview-empty";
        span.textContent = "Sin icono";
        preview.appendChild(span);
        return;
      }
      const previewSvg = createIconSvg(
        selectedIconId,
        GROUP_ICON_SIZES.pickerPreview,
      );
      if (!previewSvg) return;
      const chip = document.createElement("span");
      chip.className = "youtube-groups__icon";
      chip.append(previewSvg);
      preview.appendChild(chip);
    }
    container
      .querySelector(".youtube-groups__icon-picker-cancel")
      .addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        hideIconPicker();
        error.textContent = "";
      });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      error.textContent = "";
      const onSave = container._onSave;
      if (typeof onSave !== "function") {
        error.textContent = "No se pudo guardar la elección.";
        return;
      }
      try {
        await onSave({ iconId: selectedIconId, colorHex: selectedColorHex });
        hideIconPicker();
      } catch (exception) {
        error.textContent = exception.message;
      }
    });
    container._renderIconGrid = renderIconGrid;
    container._renderColorGrid = renderColorGrid;
    container._updatePreview = updatePreview;

    return container;
  }
  /**
   * Abre el selector de iconos junto a un botón.
   * @param {{iconId: string, colorHex: string}} initial - Elección de partida.
   * @param {Element} anchorButton - Botón junto al que se abre.
   * @param {function({iconId: string, colorHex: string}): (void|Promise<void>)} onSave
   *   Se llama al pulsar "Guardar"; si lanza, el selector sigue abierto con el error.
   */
  function openIconPicker(initial, anchorButton, onSave) {
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
    picker._onSave = onSave;
    error.textContent = "";
    picker._renderIconGrid((initial && initial.iconId) || "");
    picker._renderColorGrid((initial && initial.colorHex) || "");
    picker._updatePreview();
    picker.hidden = false;
    form.hidden = false;
  }

  return Object.freeze({ openIconPicker, hideIconPicker });
})();
