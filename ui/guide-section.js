/**
 * Sección "YouTube Groups" de la guía lateral de YouTube y guía fija en
 * suscripciones. Se crea con `create(ctx)`; no toca el DOM hasta `start()`.
 */
const YouTubeGroupsGuideSection = (() => {
  const { getGroups } = YouTubeGroupsStorage;
  const { createGroup, createSubGroup } = YouTubeGroups;
  const { createIconSvg, GROUP_ICON_SIZES, createGroupMark, setGroupBand } =
    YouTubeGroupsIconsDom;
  const { openIconPicker } = YouTubeGroupsIconPicker;

  /**
   * Crea el componente de la guía.
   * @param {Object} ctx - Contexto compartido de `content.js`.
   * @returns {Readonly<Object>} API: `renderGuideSection`, `noteMutations`,
   *   `checkPlacement` y `start`.
   */
  function create(ctx) {
    const GUIDE_SECTIONS_SELECTOR = "ytd-guide-renderer #sections";
    const GUIDE_SECTION_ID = "youtube-groups-guide";

    /** Si ya hay una comprobación de la guía programada para el próximo frame. */
    let guideCheckScheduled = false;

    /** Estado en memoria de la guía: columna actual y listas de canales. */
    let guidePath = [];
    const guideChannelOverrides = new Map();
    /** Últimos grupos pintados en la guía (para los botones de navegación). */
    let guideGroups = [];

    /**
     * Añade o quita un elemento de la selección desde la guía.
     * @param {Object} filter - Filtro pulsado.
     */
    function toggleSelectionItem(filter) {
      const previous = ctx.state.activeSelection;
      const next = YouTubeGroupsFilter.toggleSelection(
        guideGroups,
        previous,
        filter,
      );
      ctx.setActiveSelection(next);

      const pageType = YouTubeGroupsPages.getPageType(window.location.pathname);
      if (
        YouTubeGroupsFilter.shouldNavigateOnSelect(pageType, previous, next)
      ) {
        ctx.navigateToSubscriptions(next);
      }
    }

    /**
     * Crea un botón de la sección "YouTube Groups" de la guía lateral.
     * @param {string} label - Texto del botón.
     * @param {boolean} pressed - Si es el filtro activo.
     * @param {HTMLElement|null} mark - Marca del grupo, si la tiene.
     * @param {function(): void} onClick - Acción al pulsar.
     * @param {string} [extraClass] - Clase adicional.
     * @returns {HTMLButtonElement} Botón creado.
     */
    function createGuideButton(label, pressed, mark, onClick, extraClass) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "youtube-groups__guide-item";
      if (extraClass) {
        button.classList.add(extraClass);
      }
      button.setAttribute("aria-pressed", String(pressed));
      if (mark) {
        button.append(mark);
      }
      const name = document.createElement("span");
      name.className = "youtube-groups__guide-name";
      name.textContent = label;
      button.append(name);
      button.addEventListener("click", onClick);
      return button;
    }

    /**
     * Crea la fila de un grupo en la columna de la guía: botón de desplegar,
     * botón principal y su lista de canales.
     * @param {Array<Object>} groups - Árbol de grupos.
     * @param {Object} item - Elemento de `getGuideColumn`.
     * @param {number} depth - Profundidad de la columna.
     * @returns {HTMLElement} Contenedor de la fila.
     */
    function createGuideRow(groups, item, depth) {
      const wrapper = document.createElement("div");
      wrapper.className = "youtube-groups__guide-group";

      const row = document.createElement("div");
      row.className = "youtube-groups__guide-row";

      const list = document.createElement("div");
      list.className = "youtube-groups__guide-channels";
      list.hidden = !YouTubeGroupsGuide.isChannelListOpen(
        guideChannelOverrides,
        item,
        depth,
        ctx.state.activeSelection,
      );

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "youtube-groups__guide-toggle";
      toggle.setAttribute("aria-expanded", String(!list.hidden));
      toggle.setAttribute("aria-label", `Canales de ${item.name}`);
      toggle.textContent = list.hidden ? "▸" : "▾";
      toggle.hidden = item.channels.length === 0;
      toggle.addEventListener("click", () => {
        list.hidden = !list.hidden;
        guideChannelOverrides.set(item.id, !list.hidden);
        toggle.setAttribute("aria-expanded", String(!list.hidden));
        toggle.textContent = list.hidden ? "▸" : "▾";
      });

      const main = createGuideButton(
        `${item.name} (${item.channels.length})`,
        ctx.state.activeSelection.includes(`group:${item.id}`),
        createGroupMark(groups, item.id, GROUP_ICON_SIZES.guide),
        () => toggleSelectionItem({ type: "group", id: item.id }),
      );
      row.append(toggle, main);
      const rowAppearance = YouTubeGroups.getGroupAppearance(groups, item.id);
      setGroupBand(row, rowAppearance ? rowAppearance.color : null);

      const enter = document.createElement("button");
      enter.type = "button";
      enter.className = "youtube-groups__guide-enter";
      enter.setAttribute("aria-label", `Ver subgrupos de ${item.name}`);
      enter.textContent = "›";
      enter.addEventListener("click", () => {
        guidePath = YouTubeGroupsGuide.enterGuideGroup(
          groups,
          guidePath,
          item.id,
        );
        renderGuideSection(groups, "forward");
      });
      row.append(enter);

      for (const channel of item.channels) {
        const channelButton = createGuideButton(
          channel.name,
          ctx.state.activeSelection.includes(
            YouTubeGroupsFilter.getFilterKey({
              type: "channel",
              containerId: item.id,
              url: channel.url,
            }),
          ),
          null,
          () =>
            toggleSelectionItem({
              type: "channel",
              containerId: item.id,
              url: channel.url,
              name: channel.name,
            }),
          "youtube-groups__guide-channel",
        );
        channelButton.title = channel.url;
        list.append(channelButton);
      }

      wrapper.append(row, list);
      return wrapper;
    }

    /** Destino del formulario de crear pintado por última vez (para vaciarlo al cambiar). */
    let guideRenderedTargetKey = null;

    /** Destino actual del botón de crear (ver `getCreateTarget`). */
    let guideCreateTarget = {
      parentId: null,
      parentName: null,
      label: "+ Grupo",
      title: "Crear grupo",
    };

    /**
     * Pasa a la columna del grupo padre tras crear un subgrupo, con animación,
     * si no se estaba ya en ella.
     * @param {string} parentId - Id del grupo padre.
     */
    async function showParentColumn(parentId) {
      const groups = await getGroups();
      const nextPath = YouTubeGroupsGuide.findGuidePath(groups, parentId);
      if (
        nextPath &&
        nextPath.join("/") !==
          YouTubeGroupsGuide.normalizeGuidePath(groups, guidePath).join("/")
      ) {
        guidePath = nextPath;
        renderGuideSection(groups, "forward");
      }
    }

    /**
     * Oculta y vacía el formulario de crear de la guía.
     * @param {Element} section - Sección de la guía.
     */
    function resetGuideCreateForm(section) {
      const form = section.querySelector(".youtube-groups__guide-form");
      if (!form) {
        return;
      }
      form.reset();
      if (form._resetAppearance) {
        form._resetAppearance();
      }
      form.hidden = true;
      form.querySelector(".youtube-groups__guide-form-error").textContent = "";
    }

    /**
     * Crea el formulario de crear grupo o subgrupo de la guía (oculto). Crea
     * en el destino de `guideCreateTarget`: un grupo en la raíz o un subgrupo
     * de su `parentId`.
     * @returns {HTMLFormElement} Formulario.
     */
    function createGuideCreateForm() {
      const form = document.createElement("form");
      form.className = "youtube-groups__guide-form";
      form.hidden = true;

      const input = document.createElement("input");
      input.type = "text";
      input.maxLength = 80;
      input.className = "youtube-groups__guide-form-input";
      input.setAttribute("aria-label", "Nombre");
      // Evita que salten los atajos de teclado de YouTube
      input.addEventListener("keydown", (event) => event.stopPropagation());

      // Icono y color elegidos (no se escriben hasta pulsar "Guardar")
      let appearance = { iconId: "", colorHex: "" };

      const iconButton = document.createElement("button");
      iconButton.type = "button";
      iconButton.className = "youtube-groups__guide-form-icon";
      const iconPreview = document.createElement("span");
      iconPreview.className = "youtube-groups__guide-form-icon-preview";
      const iconLabel = document.createElement("span");
      iconLabel.textContent = "Icono";
      iconButton.append(iconPreview, iconLabel);

      function paintAppearance() {
        iconPreview.replaceChildren();
        setGroupBand(iconButton, appearance.colorHex);
        const svg = appearance.iconId
          ? createIconSvg(appearance.iconId, GROUP_ICON_SIZES.formPreview)
          : null;
        if (svg) {
          iconPreview.append(svg);
        }
      }
      iconButton.addEventListener("click", () => {
        openIconPicker(appearance, iconButton, (choice) => {
          appearance = choice;
          paintAppearance();
        });
      });
      // Lo usa resetGuideCreateForm para descartar la elección
      form._resetAppearance = () => {
        appearance = { iconId: "", colorHex: "" };
        paintAppearance();
      };

      const actions = document.createElement("div");
      actions.className = "youtube-groups__guide-form-actions";

      const save = document.createElement("button");
      save.type = "submit";
      save.className = "youtube-groups__guide-form-save";
      save.textContent = "Guardar";

      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "youtube-groups__guide-form-cancel";
      cancel.textContent = "Cancelar";
      cancel.addEventListener("click", () => {
        form.reset();
        form._resetAppearance();
        form.hidden = true;
        error.textContent = "";
      });

      actions.append(save, cancel);

      const error = document.createElement("p");
      error.className = "youtube-groups__guide-form-error";
      error.setAttribute("aria-live", "polite");

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        error.textContent = "";
        const parentId = guideCreateTarget.parentId;
        const kind = parentId ? "subgroup" : "group";
        const message = YouTubeGroups.validateGroupName(input.value, kind);
        if (message) {
          error.textContent = message;
          return;
        }
        try {
          const created = parentId
            ? await createSubGroup(parentId, input.value)
            : await createGroup(input.value);
          if (appearance.iconId || appearance.colorHex) {
            try {
              await YouTubeGroups.setGroupAppearance(
                created.id,
                appearance.iconId,
                appearance.colorHex,
              );
            } catch (exception) {
              // El grupo ya existe: se avisa y se deja el formulario abierto
              error.textContent =
                "El grupo se creó sin icono: " + exception.message;
              form.reset();
              form._resetAppearance();
              await ctx.renderGroupsPanel();
              if (parentId) {
                await showParentColumn(parentId);
              }
              return;
            }
          }
          form.reset();
          form._resetAppearance();
          form.hidden = true;
          await ctx.renderGroupsPanel();
          if (parentId) {
            await showParentColumn(parentId);
          }
        } catch (exception) {
          error.textContent = exception.message;
        }
      });

      form.append(input, iconButton, actions, error);
      return form;
    }

    /**
     * Sección de la guía tras la que va la nuestra: la anterior a "Más de
     * YouTube", o la primera si no se encuentra.
     * @param {Element} container - Contenedor `#sections` de la guía.
     * @returns {Element|null} Sección que debe quedar justo antes de la nuestra
     *   (`null` si la nuestra debe ir la primera).
     */
    function findGuideAnchor(container) {
      const sections = Array.from(
        container.querySelectorAll(":scope > ytd-guide-section-renderer"),
      );
      const hrefs = sections.map((section) =>
        Array.from(section.querySelectorAll("a[href]")).map((a) =>
          a.getAttribute("href"),
        ),
      );
      const index = YouTubeGroupsGuide.findGuideInsertionIndex(hrefs);
      if (index > 0) {
        return sections[index - 1];
      }
      if (index === 0) {
        return null;
      }
      return sections[0] || null;
    }

    // Última ancla calculada (`{ container, anchor }`) o `null` si está invalidada.
    let guideAnchorCache = null;

    /** Invalida el ancla en caché: se recalculará en la próxima consulta. */
    function invalidateGuideAnchor() {
      guideAnchorCache = null;
    }

    /**
     * Ancla de la sección con caché: solo recorre los enlaces de la guía si la
     * caché está invalidada, es de otro contenedor o el ancla ya no es hija suya.
     * @param {Element} container - Contenedor `#sections` de la guía.
     * @returns {Element|null} Igual que `findGuideAnchor`.
     */
    function getGuideAnchor(container) {
      if (
        guideAnchorCache &&
        guideAnchorCache.container === container &&
        (guideAnchorCache.anchor === null ||
          guideAnchorCache.anchor.parentElement === container)
      ) {
        return guideAnchorCache.anchor;
      }
      const anchor = findGuideAnchor(container);
      guideAnchorCache = { container, anchor };
      return anchor;
    }

    /**
     * Indica si la sección está conectada y justo en su posición de la guía.
     * @param {Element} [container] - Contenedor `#sections` (se busca si falta).
     * @returns {boolean} `true` si no hace falta pintarla ni moverla.
     */
    function isGuideSectionInPlace(container) {
      const section = document.getElementById(GUIDE_SECTION_ID);
      const sections =
        container || document.querySelector(GUIDE_SECTIONS_SELECTOR);
      if (!section?.isConnected || !sections) {
        return false;
      }
      const anchor = getGuideAnchor(sections);
      return anchor
        ? section.parentElement === sections &&
            anchor.nextElementSibling === section
        : section.parentElement === sections &&
            sections.firstElementChild === section;
    }

    /**
     * Pinta la sección "YouTube Groups" en la guía de YouTube, antes de "Más de
     * YouTube". Si la guía no existe, no hace nada; si la sección ya existe, la
     * reutiliza y solo la mueve si no está en su sitio.
     * @param {Array<Object>} groups - Árbol de grupos.
     * @param {string} [direction] - "forward" o "back" para animar el cambio de columna.
     */
    function renderGuideSection(groups, direction) {
      const container = document.querySelector(GUIDE_SECTIONS_SELECTOR);
      if (!container) {
        return;
      }
      let section = document.getElementById(GUIDE_SECTION_ID);
      if (!section) {
        section = document.createElement("div");
        section.id = GUIDE_SECTION_ID;
        section.className = "youtube-groups__guide";
      }
      if (!isGuideSectionInPlace(container)) {
        const anchor = getGuideAnchor(container);
        if (anchor) {
          anchor.after(section);
        } else {
          container.prepend(section);
        }
      }

      guidePath = YouTubeGroupsGuide.normalizeGuidePath(groups, guidePath);
      const column = YouTubeGroupsGuide.getGuideColumn(groups, guidePath);

      // Cabecera, botón de crear y contenedor: se crean una vez con la sección
      let viewport = section.querySelector(".youtube-groups__guide-viewport");
      if (!viewport) {
        const header = document.createElement("div");
        header.className = "youtube-groups__guide-header";

        const back = document.createElement("button");
        back.type = "button";
        back.className = "youtube-groups__guide-back";
        back.setAttribute("aria-label", "Volver");
        back.textContent = "‹";
        back.addEventListener("click", () => {
          guidePath = YouTubeGroupsGuide.leaveGuideGroup(guidePath);
          renderGuideSection(guideGroups, "back");
        });

        const title = document.createElement("h3");
        title.className = "youtube-groups__guide-title";

        const edit = document.createElement("button");
        edit.type = "button";
        edit.className = "youtube-groups__guide-edit";
        edit.title = "Editar grupos";
        edit.setAttribute("aria-label", "Editar grupos");
        edit.textContent = "✎";
        edit.addEventListener("click", () => {
          browser.runtime
            .sendMessage({ type: "youtube-groups:open-editor" })
            .catch((error) => {
              console.error(
                "[YouTube Groups] No se pudo abrir el editor de grupos",
                error,
              );
            });
        });

        header.append(back, title, edit);

        const create = document.createElement("button");
        create.type = "button";
        create.className = "youtube-groups__guide-create";

        const form = createGuideCreateForm();
        create.addEventListener("click", () => {
          form.hidden = !form.hidden;
          if (!form.hidden) {
            form.querySelector("input").focus();
          }
        });

        const clear = document.createElement("button");
        clear.type = "button";
        clear.className = "youtube-groups__guide-clear";
        clear.hidden = true;
        clear.addEventListener("click", () => ctx.setActiveSelection([]));

        viewport = document.createElement("div");
        viewport.className = "youtube-groups__guide-viewport";

        section.replaceChildren(header, create, form, clear, viewport);
      }
      guideGroups = groups;

      // Al cambiar el destino de crear, el formulario se oculta y se vacía
      guideCreateTarget = YouTubeGroupsGuide.getCreateTarget(
        groups,
        guidePath,
        ctx.state.activeSelection,
      );
      const targetKey = guideCreateTarget.parentId ?? "";
      if (targetKey !== guideRenderedTargetKey) {
        guideRenderedTargetKey = targetKey;
        resetGuideCreateForm(section);
      }

      const back = section.querySelector(".youtube-groups__guide-back");
      const title = section.querySelector(".youtube-groups__guide-title");
      const create = section.querySelector(".youtube-groups__guide-create");
      back.hidden = !column.parent;
      title.textContent = column.parent ? column.parent.name : "YouTube Groups";
      create.textContent = guideCreateTarget.label;
      create.title = guideCreateTarget.title;
      create.setAttribute("aria-label", guideCreateTarget.title);

      const clear = section.querySelector(".youtube-groups__guide-clear");
      clear.hidden = ctx.state.activeSelection.length === 0;
      clear.textContent = `Limpiar selección (${ctx.state.activeSelection.length})`;

      const list = document.createElement("div");
      list.className = "youtube-groups__guide-column";
      if (column.items.length === 0) {
        const empty = document.createElement("p");
        empty.className = "youtube-groups__guide-empty";
        empty.textContent = column.parent
          ? "Sin subgrupos"
          : "Aún no hay grupos";
        list.append(empty);
      }
      for (const item of column.items) {
        list.append(createGuideRow(groups, item, column.path.length));
      }

      const previous = viewport.lastElementChild;
      const animate =
        direction &&
        previous &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!animate) {
        viewport.replaceChildren(list);
        return;
      }
      // Deja solo la última columna como saliente y desliza las dos
      while (viewport.firstElementChild !== previous) {
        viewport.firstElementChild.remove();
      }
      const forward = direction === "forward";
      previous.classList.add(
        forward
          ? "youtube-groups__guide-column--out-left"
          : "youtube-groups__guide-column--out-right",
      );
      list.classList.add(
        forward
          ? "youtube-groups__guide-column--in-right"
          : "youtube-groups__guide-column--in-left",
      );
      viewport.append(list);
      const removePrevious = () => previous.remove();
      previous.addEventListener("animationend", removePrevious, { once: true });
      setTimeout(removePrevious, 300);
    }

    /**
     * Lee los grupos y pinta la sección en la guía de YouTube.
     */
    function paintGuideSection() {
      getGroups()
        .then((groups) => renderGuideSection(groups))
        .catch((error) => {
          console.error(
            "[YouTube Groups] No se pudo pintar la guía lateral",
            error,
          );
        });
    }

    /**
     * Programa, como mucho una vez por frame, el pintado de la sección de la
     * guía cuando falta o no está en su sitio. Solo lee los grupos si hay guía.
     */
    function scheduleGuideCheck() {
      if (guideCheckScheduled) {
        return;
      }
      guideCheckScheduled = true;
      requestAnimationFrame(() => {
        guideCheckScheduled = false;
        if (
          !document.querySelector(GUIDE_SECTIONS_SELECTOR) ||
          isGuideSectionInPlace()
        ) {
          return;
        }
        paintGuideSection();
      });
    }

    const GUIDE_PINNED_CLASS = "youtube-groups--guide-pinned";
    const GUIDE_BUTTON_SELECTOR = "ytd-masthead #guide-button";
    let guidePinPath = null;
    let guidePinScheduled = false;

    /**
     * Pone o quita la clase que fuerza la guía de YouTube abierta y fija, solo
     * en suscripciones (ADR 0010 y 0012). Es idempotente.
     *
     * @param {string} [pathname] Ruta con la que decidir (por defecto, la
     *   actual; en yt-navigate-start, la de destino). La ruta que se recuerda
     *   para el observer es siempre la actual.
     */
    function syncGuidePin(pathname = window.location.pathname) {
      guidePinPath = window.location.pathname;
      const pinned = YouTubeGroupsPages.shouldPinGuide(
        YouTubeGroupsPages.getPageType(pathname),
        window.innerWidth,
        document.fullscreenElement !== null,
      );
      document.documentElement.classList.toggle(GUIDE_PINNED_CLASS, pinned);
    }

    /** Recalcula la guía fija como mucho una vez por frame. */
    function scheduleGuidePinSync() {
      if (guidePinScheduled) {
        return;
      }
      guidePinScheduled = true;
      requestAnimationFrame(() => {
        guidePinScheduled = false;
        syncGuidePin();
      });
    }

    /**
     * Registra los escuchadores de la guía fija y hace la primera
     * sincronización. `content.js` lo llama en el punto donde antes estaban
     * estas líneas.
     */
    function start() {
      // Con la guía fija, ☰ no hace nada: se detiene el clic antes de que
      // YouTube cambie su estado interno.
      document.addEventListener(
        "click",
        (event) => {
          if (
            document.documentElement.classList.contains(GUIDE_PINNED_CLASS) &&
            event.target instanceof Element &&
            event.target.closest(GUIDE_BUTTON_SELECTOR)
          ) {
            event.stopPropagation();
            event.preventDefault();
          }
        },
        true,
      );

      document.addEventListener("yt-navigate-start", (event) => {
        let destination = null;
        try {
          destination = YouTubeGroupsPages.getNavigationPathname(
            event.detail?.url,
            window.location.origin,
          );
        } catch {
          // detail puede ser inaccesible desde el content script.
        }
        syncGuidePin(destination ?? window.location.pathname);
      });
      document.addEventListener("yt-navigate-finish", () => syncGuidePin());
      window.addEventListener("popstate", () => syncGuidePin());
      document.addEventListener("fullscreenchange", () => syncGuidePin());
      window.addEventListener("resize", scheduleGuidePinSync);
      syncGuidePin();
    }

    /**
     * Parte del observer de mutaciones que atañe a la guía: resincroniza la
     * guía fija si cambió la ruta e invalida el ancla en caché si cambia algo
     * de la guía que no sea nuestra sección.
     * @param {MutationRecord[]} mutations - Mutaciones del observer.
     */
    function noteMutations(mutations) {
      if (window.location.pathname !== guidePinPath) {
        syncGuidePin();
      }
      // Si cambia algo de la guía que no sea nuestra sección, el ancla en caché
      // puede haber dejado de valer (secciones nuevas o con enlaces tardíos).
      const guideSections = document.querySelector(GUIDE_SECTIONS_SELECTOR);
      if (guideSections) {
        const ourSection = document.getElementById(GUIDE_SECTION_ID);
        if (
          mutations.some(
            (mutation) =>
              guideSections.contains(mutation.target) &&
              !ourSection?.contains(mutation.target),
          )
        ) {
          invalidateGuideAnchor();
        }
      }
    }

    /**
     * Final del observer de mutaciones: reprograma el pintado de la sección si
     * ya no está en su sitio.
     */
    function checkPlacement() {
      if (!isGuideSectionInPlace()) {
        scheduleGuideCheck();
      }
    }

    return Object.freeze({
      renderGuideSection,
      noteMutations,
      checkPlacement,
      start,
    });
  }

  return Object.freeze({ create });
})();
