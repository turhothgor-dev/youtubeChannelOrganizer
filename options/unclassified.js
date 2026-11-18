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
    /**
     * Pinta la bandeja.
     * @param {Object} data - Datos.
     * @param {Array<Object>} data.groups - Árbol de grupos.
     * @param {Object} data.subscriptions - Mapa de suscripciones conocidas.
     * @param {Object} data.avatars - Avatares (clave de canal → URL).
     * @param {string} data.query - Texto del buscador.
     * @returns {void}
     */
    function render({ groups, subscriptions, avatars, query }) {
      const all = YouTubeGroupsSubscriptions.getUnclassifiedSubscriptions(
        subscriptions,
        groups,
      );
      const needle = YouTubeGroupsEditor.normalizeSearchText(query || "");
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

      const list = el("ul", "options__channel-list");
      for (const item of items) {
        const row = el("li", "options__channel");
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
        row.append(avatar, text);
        list.append(row);
      }
      container.append(list);
    }

    return { render };
  }

  return Object.freeze({ create });
})();
