/**
 * Ayudantes de DOM para iconos, marcas de grupo y controles. Sin estado ni
 * `ctx`: solo declara; no toca el DOM al cargar.
 */
const YouTubeGroupsIconsDom = (() => {
  /**
   * Crea el SVG de un icono sin usar innerHTML.
   * @param {string} iconId - Id del icono de ICON_SET.
   * @param {number} size - Lado en píxeles.
   * @returns {SVGElement|null} null si el icono no existe.
   */
  function createIconSvg(iconId, size) {
    const graphic = YouTubeGroupsIcons.getIconGraphic(iconId);
    if (!graphic) {
      return null;
    }
    const svgNs = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNs, "svg");
    svg.setAttribute("viewBox", graphic.viewBox);
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
    svg.setAttribute("aria-hidden", "true");
    for (const shape of graphic.shapes) {
      const element = document.createElementNS(svgNs, shape.tag);
      for (const [name, value] of Object.entries(shape.attrs)) {
        element.setAttribute(name, value);
      }
      svg.append(element);
    }
    return svg;
  }

  /**
   * Crea el SVG de un icono de interfaz (UI_ICON_PATHS) sin usar innerHTML.
   * @param {string} iconId - Id del icono de interfaz.
   * @param {number} size - Lado en píxeles.
   * @returns {SVGElement|null} null si el icono no existe.
   */
  function createUiIconSvg(iconId, size) {
    const iconPath = YouTubeGroupsIcons.getUiIconPath(iconId);
    if (!iconPath) {
      return null;
    }
    const svgNs = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNs, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
    svg.setAttribute("fill", "currentColor");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(svgNs, "path");
    path.setAttribute("d", iconPath);
    svg.append(path);
    return svg;
  }

  /**
   * Pinta un botón de tarjeta con glifo y etiqueta; `aria-label` lleva el texto completo.
   * @param {HTMLButtonElement} button - Botón de la tarjeta.
   * @param {string|null} glyph - Id de icono de interfaz, o texto si `isIcon` es false.
   * @param {string} label - Texto completo.
   * @param {boolean} [isIcon] - Si `glyph` es un id de icono (por defecto sí).
   */
  function setCardButtonContent(button, glyph, label, isIcon = true) {
    let glyphEl = button.querySelector(".youtube-groups__card-glyph");
    let labelEl = button.querySelector(".youtube-groups__card-label");
    if (!glyphEl || !labelEl) {
      button.textContent = "";
      glyphEl = document.createElement("span");
      glyphEl.className = "youtube-groups__card-glyph";
      labelEl = document.createElement("span");
      labelEl.className = "youtube-groups__card-label";
      button.append(glyphEl, labelEl);
    }
    // Solo se escribe lo que cambia: cada escritura muta el DOM y reprograma la tarjeta
    if (labelEl.textContent !== label) {
      labelEl.textContent = label;
    }
    if (button.getAttribute("aria-label") !== label) {
      button.setAttribute("aria-label", label);
    }
    if (glyph === null) {
      return;
    }
    const painted = (isIcon ? "icon:" : "text:") + glyph;
    if (glyphEl.getAttribute("data-youtube-groups-glyph") === painted) {
      return;
    }
    glyphEl.setAttribute("data-youtube-groups-glyph", painted);
    glyphEl.textContent = "";
    if (isIcon) {
      const svg = createUiIconSvg(glyph, 16);
      if (svg) {
        glyphEl.append(svg);
      }
    } else {
      glyphEl.textContent = glyph;
    }
  }

  /** Lado en píxeles de los iconos de grupo según el sitio donde se pintan. */
  const GROUP_ICON_SIZES = {
    guide: 24,
    choice: 15,
    pickerGrid: 20,
    pickerPreview: 24,
    formPreview: 18,
  };

  /**
   * Crea la marca de un grupo: el chip con su icono.
   * @param {Array<Object>} groups - Árbol de grupos.
   * @param {string} groupId - Id del grupo o subgrupo.
   * @param {number} size - Lado del icono en píxeles.
   * @returns {HTMLElement|null} null si no hay icono.
   */
  function createGroupMark(groups, groupId, size) {
    const appearance = YouTubeGroups.getGroupAppearance(groups, groupId);
    if (!appearance || !appearance.icon) {
      return null;
    }
    const svg = createIconSvg(appearance.icon, size);
    if (!svg) {
      return null;
    }
    const chip = document.createElement("span");
    chip.className = "youtube-groups__icon";
    chip.title = YouTubeGroupsIcons.getIconLabel(appearance.icon);
    chip.append(svg);
    return chip;
  }

  /** Lado en píxeles del avatar de canal según el sitio donde se pinta. */
  const AVATAR_SIZES = { guide: 20, editor: 24 };

  /**
   * Crea el avatar de un canal: círculo con la inicial y, encima, la imagen si
   * hay una URL permitida. Si la imagen falla, se quita y queda la inicial.
   * @param {string} name - Nombre del canal.
   * @param {string|null} src - URL de imagen ya normalizada, o null.
   * @param {number} size - Lado en píxeles.
   * @returns {HTMLElement} El contenedor del avatar.
   */
  function createChannelAvatar(name, src, size) {
    const avatar = document.createElement("span");
    avatar.className = "youtube-groups__avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.style.width = `${size}px`;
    avatar.style.height = `${size}px`;
    avatar.style.setProperty(
      "--yg-avatar-bg",
      YouTubeGroupsAvatars.getFallbackColor(name),
    );
    const initial = document.createElement("span");
    initial.className = "youtube-groups__avatar-initial";
    initial.textContent = YouTubeGroupsAvatars.getInitial(name);
    avatar.append(initial);
    if (
      typeof src === "string" &&
      YouTubeGroupsAvatars.normalizeAvatarUrl(src) === src
    ) {
      const img = document.createElement("img");
      img.className = "youtube-groups__avatar-img";
      img.alt = "";
      img.setAttribute("loading", "lazy");
      img.setAttribute("decoding", "async");
      img.setAttribute("referrerpolicy", "no-referrer");
      img.setAttribute("width", String(size));
      img.setAttribute("height", String(size));
      img.addEventListener("error", () => img.remove());
      img.src = src;
      avatar.append(img);
    }
    return avatar;
  }

  /**
   * Pinta o quita la banda de color en el borde derecho de un elemento.
   * @param {HTMLElement} element - Fila o caja del grupo.
   * @param {string|null} color - Color CSS; vacío o null quita la banda.
   */
  function setGroupBand(element, color) {
    element.classList.toggle("youtube-groups__group-band", Boolean(color));
    if (color) {
      element.style.setProperty("--yg-group-color", color);
    } else {
      element.style.removeProperty("--yg-group-color");
    }
  }

  /**
   * Pinta o quita el bullet del grupo como último hijo del elemento, con el
   * número de vídeos nuevos dentro si hay. Idempotente: solo escribe en el DOM
   * si algo cambia.
   * @param {HTMLElement} element - Botón principal del grupo.
   * @param {string|null} color - Color CSS; vacío o null, bullet gris si hay número.
   * @param {number} [count] - Vídeos nuevos; 0 no muestra número.
   */
  function setGroupBullet(element, color, count = 0) {
    const selector = ":scope > .youtube-groups__group-bullet";
    let bullet = element.querySelector(selector);
    const hasCount = count > 0;
    if (!color && !hasCount) {
      if (bullet) {
        bullet.remove();
      }
      return;
    }
    if (!bullet) {
      bullet = document.createElement("span");
      bullet.className = "youtube-groups__group-bullet";
      element.append(bullet);
    } else if (element.lastElementChild !== bullet) {
      element.append(bullet);
    }
    if (bullet.getAttribute("aria-hidden") !== "true") {
      bullet.setAttribute("aria-hidden", "true");
    }
    const currentColor = bullet.style.getPropertyValue("--yg-group-color");
    if (color) {
      if (currentColor !== color) {
        bullet.style.setProperty("--yg-group-color", color);
      }
    } else if (currentColor) {
      bullet.style.removeProperty("--yg-group-color");
    }
    if (
      bullet.classList.contains("youtube-groups__group-bullet--count") !==
      hasCount
    ) {
      bullet.classList.toggle("youtube-groups__group-bullet--count", hasCount);
    }
    const text = hasCount ? (count > 99 ? "99+" : String(count)) : "";
    if (bullet.textContent !== text) {
      bullet.textContent = text;
    }
    const textColor = hasCount
      ? YouTubeGroupsIcons.getContrastTextColor(color || "#909090")
      : "";
    if (bullet.style.getPropertyValue("--yg-bullet-text") !== textColor) {
      if (textColor) {
        bullet.style.setProperty("--yg-bullet-text", textColor);
      } else {
        bullet.style.removeProperty("--yg-bullet-text");
      }
    }
    const description = hasCount
      ? count === 1
        ? "1 vídeo nuevo"
        : `${count} vídeos nuevos`
      : "";
    if ((bullet.getAttribute("aria-description") || "") !== description) {
      if (description) {
        bullet.setAttribute("aria-description", description);
      } else {
        bullet.removeAttribute("aria-description");
      }
    }
  }

  /**
   * Impide que los eventos de un control lleguen a YouTube (enlace, atajos).
   * @param {HTMLElement} control Control sobre el que se instala el escudo.
   */
  function shieldControlEvents(control) {
    // Evitar que los clics sobre el control naveguen o abran otros menús de YouTube
    // El control puede ir dentro del enlace de la miniatura: ningún evento debe
    // llegar a él. Los botones deshabilitados dejan caer el clic aquí.
    for (const type of ["click", "auxclick"]) {
      control.addEventListener(type, (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
    }
    for (const type of [
      "mousedown",
      "mouseup",
      "pointerdown",
      "pointerup",
      "touchstart",
      "touchend",
      "dblclick",
    ]) {
      control.addEventListener(type, (event) => {
        event.stopPropagation();
      });
    }
  }

  return Object.freeze({
    createIconSvg,
    createUiIconSvg,
    setCardButtonContent,
    GROUP_ICON_SIZES,
    createGroupMark,
    AVATAR_SIZES,
    createChannelAvatar,
    setGroupBand,
    setGroupBullet,
    shieldControlEvents,
  });
})();
