"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { loadDom, manifestScripts } = require("./helpers/load-dom");
const {
  CHANNEL_URL,
  makeGroup,
  groupsStore,
  GUIDE_HTML,
} = require("./helpers/youtube-fixtures");

const MENU = "#youtube-groups-menu";
const GEAR = ".youtube-groups__guide-menu-button";

/**
 * Carga una página con la guía, la estabiliza y abre el menú con el engranaje.
 * @param {Object} [options] - Opciones de loadDom (store...).
 * @returns {Promise<Object>} loadDom con `gear` y `menu`.
 */
async function loadWithMenu(options = {}) {
  const dom = loadDom({ html: GUIDE_HTML, ...options });
  await dom.flush();
  const gear = dom.document.querySelector(GEAR);
  gear.click();
  await dom.flush();
  return { ...dom, gear, menu: dom.document.querySelector(MENU) };
}

test("YouTubeGroupsPanel.create no toca el DOM", () => {
  const scripts = manifestScripts().filter((file) => file !== "content.js");
  const dom = loadDom({ scripts });
  const before = dom.document.body.innerHTML;

  const Panel = dom.global("YouTubeGroupsPanel");
  assert.strictEqual(typeof Panel.create, "function");
  const panel = Panel.create({ state: {} });

  assert.strictEqual(dom.document.body.innerHTML, before);
  for (const name of ["toggleMenu", "openMenu", "closeMenu", "isMenuOpen"]) {
    assert.strictEqual(typeof panel[name], "function", name);
  }
  assert.strictEqual(panel.createGroupsPanel, undefined);
});

test("tras cargar no hay panel flotante ni menú", async () => {
  const dom = loadDom({ html: GUIDE_HTML });
  await dom.flush();

  assert.strictEqual(dom.document.querySelector("#youtube-groups-panel"), null);
  assert.strictEqual(dom.document.querySelector(MENU), null);
});

test("el engranaje crea un único menú en body, visible y colocado", async () => {
  const { document, gear, menu } = await loadWithMenu();

  assert.strictEqual(document.querySelectorAll(MENU).length, 1);
  assert.strictEqual(menu.parentElement, document.body);
  assert.strictEqual(menu.hidden, false);
  assert.strictEqual(gear.getAttribute("aria-expanded"), "true");
  assert.deepStrictEqual(
    Array.from(
      menu.querySelectorAll(":scope > details > summary"),
      (summary) => summary.textContent,
    ),
    ["Listas", "Filtros", "Limpieza", "Ajustes"],
  );
  assert.match(menu.style.left, /^\d+px$/);
  assert.match(menu.style.top, /^\d+px$/);
});

test("el menú no tiene Canal actual ni Vídeo actual", async () => {
  const { menu } = await loadWithMenu();

  assert.strictEqual(
    menu.querySelector(".youtube-groups__current-channel"),
    null,
  );
  assert.strictEqual(
    menu.querySelector(".youtube-groups__current-video"),
    null,
  );
});

test("Escape cierra el menú y devuelve el foco al engranaje", async () => {
  const { document, window, gear, menu } = await loadWithMenu();

  document.dispatchEvent(
    new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );

  assert.strictEqual(menu.hidden, true);
  assert.strictEqual(gear.getAttribute("aria-expanded"), "false");
  assert.strictEqual(document.activeElement, gear);
});

test("Escape no cierra el menú con un modal de lista abierto y sí lo hace con preventDefault sin él", async () => {
  const { document, window, menu } = await loadWithMenu();
  const modal = document.createElement("div");
  modal.className = "youtube-groups__channel-list-modal";
  document.body.appendChild(modal);

  const withModal = new window.KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: true,
    cancelable: true,
  });
  document.dispatchEvent(withModal);
  assert.strictEqual(menu.hidden, false);
  assert.strictEqual(withModal.defaultPrevented, false);

  modal.remove();
  const withoutModal = new window.KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: true,
    cancelable: true,
  });
  document.dispatchEvent(withoutModal);
  assert.strictEqual(menu.hidden, true);
  assert.strictEqual(withoutModal.defaultPrevented, true);
});

test("pointerdown fuera cierra el menú y dentro no", async () => {
  const { document, window, menu } = await loadWithMenu();

  menu
    .querySelector("summary")
    .dispatchEvent(new window.Event("pointerdown", { bubbles: true }));
  assert.strictEqual(menu.hidden, false);

  document.body.dispatchEvent(
    new window.Event("pointerdown", { bubbles: true }),
  );
  assert.strictEqual(menu.hidden, true);
});

test("el engranaje otra vez cierra el menú y reabrir reutiliza el elemento", async () => {
  const { document, window, gear, menu } = await loadWithMenu();
  const select = menu.querySelector('[data-filter="duration"]');
  select.value = "short";
  select.dispatchEvent(new window.Event("change"));

  gear.click();
  assert.strictEqual(menu.hidden, true);

  gear.click();
  assert.strictEqual(menu.hidden, false);
  assert.strictEqual(document.querySelectorAll(MENU).length, 1);
  assert.strictEqual(document.querySelector(MENU), menu);
  assert.strictEqual(
    menu.querySelector(".youtube-groups__filters summary").textContent,
    "Filtros (1)",
  );
});

test("yt-navigate-start cierra el menú", async () => {
  const { document, window, menu } = await loadWithMenu();

  document.dispatchEvent(new window.Event("yt-navigate-start"));

  assert.strictEqual(menu.hidden, true);
});

test("Analizar en Limpieza lista un canal repetido", async () => {
  const store = groupsStore([
    makeGroup("A", {
      channels: [
        { name: "Canal", url: CHANNEL_URL },
        { name: "Canal", url: CHANNEL_URL },
      ],
    }),
  ]);
  const { flush, menu } = await loadWithMenu({ store });
  menu.querySelector(".youtube-groups__cleanup-analyze").click();
  await flush();

  assert.strictEqual(
    menu.querySelector(".youtube-groups__cleanup-result").hidden,
    false,
  );
  assert.match(
    menu.querySelector(".youtube-groups__cleanup-report").textContent,
    /Canales repetidos: 1/,
  );
});

test("cambiar Vídeos vistos a Ocultar guarda watchedMode", async () => {
  const { window, flush, store, menu } = await loadWithMenu();
  const select = menu.querySelector(".youtube-groups__watched-mode-select");
  select.value = "hide";
  select.dispatchEvent(new window.Event("change"));
  await flush();

  assert.strictEqual(store.youtubeSettings.settings.watchedMode, "hide");
});
