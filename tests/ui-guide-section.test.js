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

const GUIDE = "#youtube-groups-guide";

/**
 * Grupos de prueba: A (con un canal y el subgrupo A1) y B.
 * @returns {Object} Valor para la opción `store` de loadDom.
 */
function guideStore() {
  return groupsStore([
    makeGroup("A", {
      channels: [{ name: "Canal", url: CHANNEL_URL }],
      subgroups: [makeGroup("A1")],
    }),
    makeGroup("B"),
  ]);
}

/**
 * Carga una página con la guía y los grupos de prueba.
 * @param {Object} [options] - Opciones de loadDom (url, store...).
 * @returns {Promise<Object>} El resultado de loadDom, ya estabilizado.
 */
async function loadWithGuide(options = {}) {
  const dom = loadDom({ html: GUIDE_HTML, store: guideStore(), ...options });
  await dom.flush();
  return dom;
}

/**
 * Textos de los botones principales de las filas de la columna visible (la
 * última: durante la animación la saliente sigue en el DOM).
 * @param {Object} dom - Resultado de loadDom.
 * @returns {string[]} Textos de los nombres.
 */
function rowNames(dom) {
  const column = dom.document.querySelector(
    `${GUIDE} .youtube-groups__guide-viewport`,
  ).lastElementChild;
  return Array.from(
    column.querySelectorAll(
      ".youtube-groups__guide-row .youtube-groups__guide-name",
    ),
  ).map((name) => name.textContent);
}

test("hay una única sección justo antes de la sección Más de YouTube", async () => {
  const dom = await loadWithGuide();

  assert.strictEqual(dom.document.querySelectorAll(GUIDE).length, 1);
  const guide = dom.document.querySelector(GUIDE);
  const sections = dom.document.querySelector("#sections");
  assert.strictEqual(guide.parentElement, sections);
  assert.strictEqual(
    guide.nextElementSibling.querySelector("a").getAttribute("href"),
    "https://music.youtube.com/",
  );
  assert.strictEqual(
    guide.previousElementSibling.querySelector("a").getAttribute("href"),
    "/feed/subscriptions",
  );
});

test("añadir un nodo a #sections no duplica ni mueve la sección", async () => {
  const dom = await loadWithGuide();
  const sections = dom.document.querySelector("#sections");
  const before = Array.from(sections.children).indexOf(
    dom.document.querySelector(GUIDE),
  );

  const extra = dom.document.createElement("div");
  sections.append(extra);
  await dom.flush();

  assert.strictEqual(dom.document.querySelectorAll(GUIDE).length, 1);
  assert.strictEqual(
    Array.from(sections.children).indexOf(dom.document.querySelector(GUIDE)),
    before,
  );
});

test('la fila de A muestra "A (n)"; "›" entra en A y "‹" vuelve', async () => {
  const dom = await loadWithGuide();
  assert.deepStrictEqual(rowNames(dom), ["A (1)", "B (0)"]);

  dom.document.querySelector(".youtube-groups__guide-enter").click();
  await dom.flush();
  assert.deepStrictEqual(rowNames(dom), ["A1 (0)"]);
  assert.strictEqual(
    dom.document.querySelector(".youtube-groups__guide-back").hidden,
    false,
  );

  dom.document.querySelector(".youtube-groups__guide-back").click();
  await dom.flush();
  assert.deepStrictEqual(rowNames(dom), ["A (1)", "B (0)"]);
});

const UNGROUPED = `${GUIDE} .youtube-groups__guide-item--ungrouped`;

/**
 * Suscripciones conocidas de prueba: dos sin grupo y una (CHANNEL_URL) en A.
 * @returns {Object} Contenido de `youtubeSubscriptions`.
 */
function subscriptionsStore() {
  const entry = (name, url) => ({ name, url, firstSeen: 1 });
  return {
    version: 1,
    channels: {
      [CHANNEL_URL]: entry("Canal", CHANNEL_URL),
      "https://www.youtube.com/@uno": entry(
        "Uno",
        "https://www.youtube.com/@uno",
      ),
      "https://www.youtube.com/@dos": entry(
        "Dos",
        "https://www.youtube.com/@dos",
      ),
    },
  };
}

test('la entrada "Sin grupo" va al final de la raíz, con icono y sin bullet ni desplegables', async () => {
  const dom = await loadWithGuide();
  const button = dom.document.querySelector(UNGROUPED);
  assert.ok(button);
  assert.strictEqual(button.getAttribute("aria-pressed"), "false");
  assert.strictEqual(button.hasAttribute("data-group-id"), false);
  const svg = button.querySelector("svg");
  assert.ok(svg);
  assert.strictEqual(svg.getAttribute("aria-hidden"), "true");

  const wrapper = button.parentElement;
  assert.strictEqual(wrapper.querySelector("button + button"), null);
  assert.strictEqual(
    wrapper.querySelector(
      ".youtube-groups__guide-toggle, .youtube-groups__guide-enter",
    ),
    null,
  );
  assert.strictEqual(wrapper.parentElement.lastElementChild, wrapper);
  assert.strictEqual(
    wrapper.previousElementSibling.classList.contains(
      "youtube-groups__guide-group",
    ),
    true,
  );
  assert.strictEqual(button.textContent, "Sin grupo");
});

test('"Sin grupo (N)" cuenta las suscripciones conocidas sin grupo y se actualiza', async () => {
  const store = guideStore();
  store.youtubeSubscriptions = subscriptionsStore();
  const dom = await loadWithGuide({ store });
  const button = () => dom.document.querySelector(UNGROUPED);
  assert.strictEqual(button().textContent, "Sin grupo (2)");
  assert.ok(button().title.includes("2 suscripciones conocidas sin grupo"));

  const channels = subscriptionsStore().channels;
  channels["https://www.youtube.com/@tres"] = {
    name: "Tres",
    url: "https://www.youtube.com/@tres",
    firstSeen: 1,
  };
  await dom.browser.storage.local.set({
    youtubeSubscriptions: { version: 1, channels },
  });
  await dom.flush();
  assert.strictEqual(button().textContent, "Sin grupo (3)");
});

test('"Sin grupo" no aparece en una subcolumna y vuelve al regresar', async () => {
  const dom = await loadWithGuide();
  dom.document.querySelector(".youtube-groups__guide-enter").click();
  await dom.flush();
  const column = dom.document.querySelector(
    `${GUIDE} .youtube-groups__guide-viewport`,
  ).lastElementChild;
  assert.strictEqual(
    column.querySelector(".youtube-groups__guide-item--ungrouped"),
    null,
  );

  dom.document.querySelector(".youtube-groups__guide-back").click();
  await dom.flush();
  assert.ok(dom.document.querySelector(UNGROUPED));
});

test('sin grupos, "Sin grupo" aparece tras "Aún no hay grupos"', async () => {
  const dom = await loadWithGuide({ store: groupsStore([]) });
  const column = dom.document.querySelector(
    `${GUIDE} .youtube-groups__guide-column`,
  );
  assert.strictEqual(
    column.firstElementChild.className,
    "youtube-groups__guide-empty",
  );
  assert.strictEqual(
    column.lastElementChild,
    dom.document.querySelector(UNGROUPED).parentElement,
  );
});

test('pulsar "Sin grupo" es excluyente con los grupos y al repetir se desmarca', async () => {
  const dom = await loadWithGuide({
    url: "https://www.youtube.com/feed/subscriptions",
  });
  const pressed = (selector) =>
    dom.document.querySelector(selector).getAttribute("aria-pressed");
  const clear = dom.document.querySelector(".youtube-groups__guide-clear");

  dom.document.querySelector(UNGROUPED).click();
  await dom.flush();
  assert.strictEqual(pressed(UNGROUPED), "true");
  assert.strictEqual(clear.getAttribute("aria-label"), "Limpiar selección (1)");

  dom.document.querySelector('[data-group-id="A"]').click();
  await dom.flush();
  assert.strictEqual(pressed(UNGROUPED), "false");
  assert.strictEqual(pressed('[data-group-id="A"]'), "true");

  dom.document.querySelector(UNGROUPED).click();
  await dom.flush();
  assert.strictEqual(pressed(UNGROUPED), "true");
  assert.strictEqual(pressed('[data-group-id="A"]'), "false");

  dom.document.querySelector(UNGROUPED).click();
  await dom.flush();
  assert.strictEqual(pressed(UNGROUPED), "false");
  assert.strictEqual(clear.getAttribute("aria-label"), "Limpiar selección");
});

test('pulsar "Sin grupo" en inicio guarda el filtro pendiente para ir a suscripciones', async () => {
  const dom = await loadWithGuide({ url: "https://www.youtube.com/" });
  dom.document.querySelector(UNGROUPED).click();
  await dom.flush();

  const pending = JSON.parse(
    dom.window.sessionStorage.getItem("youtubeGroupsPendingFilter"),
  );
  assert.deepStrictEqual(pending.selection, ["ungrouped"]);
});

test("el color del grupo es un bullet en su botón principal, sin banda", async () => {
  const groups = [
    makeGroup("A", { subgroups: [makeGroup("A1")] }),
    makeGroup("B"),
  ];
  groups[0].color = "#2196F3";
  const dom = await loadWithGuide({ store: groupsStore(groups) });
  const band = "youtube-groups__group-band";
  const bulletSel = ".youtube-groups__group-bullet";

  const rows = dom.document.querySelectorAll(
    `${GUIDE} .youtube-groups__guide-row`,
  );
  assert.strictEqual(rows.length, 2);
  const [rowA, rowB] = rows;
  const buttonA = rowA.querySelector(".youtube-groups__guide-item");
  const bulletA = buttonA.querySelector(bulletSel);
  assert.ok(bulletA);
  assert.strictEqual(buttonA.lastElementChild, bulletA);
  assert.strictEqual(
    bulletA.style.getPropertyValue("--yg-group-color"),
    "#2196F3",
  );
  assert.strictEqual(buttonA.getAttribute("data-group-id"), groups[0].id);
  assert.strictEqual(buttonA.classList.contains(band), false);
  assert.strictEqual(rowA.classList.contains(band), false);
  assert.strictEqual(
    rowB.querySelector(".youtube-groups__guide-item").querySelector(bulletSel),
    null,
  );
  assert.deepStrictEqual(rowNames(dom), ["A (0)", "B (0)"]);

  dom.document.querySelector(".youtube-groups__guide-enter").click();
  await dom.flush();
  const inner = dom.document
    .querySelector(`${GUIDE} .youtube-groups__guide-viewport`)
    .lastElementChild.querySelector(".youtube-groups__guide-item");
  const innerBullet = inner.querySelector(bulletSel);
  assert.ok(innerBullet);
  assert.strictEqual(
    innerBullet.style.getPropertyValue("--yg-group-color"),
    "#2196F3",
  );
});

test("el bullet muestra los vídeos nuevos, baja sin rehacer la fila y se vacía al seleccionar", async () => {
  const OTHER_URL = "https://www.youtube.com/@otro";
  const ids = ["aaaaaaaaaaa", "bbbbbbbbbbb", "ccccccccccc"];
  const groups = [
    makeGroup("A", {
      channels: [{ name: "Canal", url: CHANNEL_URL }],
      subgroups: [
        makeGroup("A1", { channels: [{ name: "Canal", url: CHANNEL_URL }] }),
      ],
    }),
    makeGroup("B", { channels: [{ name: "Otro", url: OTHER_URL }] }),
  ];
  groups[0].color = "#2196F3";
  const now = Date.now();
  const store = groupsStore(groups);
  store.youtubeNewVideos = {
    version: 1,
    since: now - 1000,
    videos: {
      [ids[0]]: { channel: CHANNEL_URL, seenAt: now, publishedBefore: now },
      [ids[1]]: { channel: CHANNEL_URL, seenAt: now, publishedBefore: now },
      [ids[2]]: { channel: OTHER_URL, seenAt: now, publishedBefore: now },
    },
    visits: {},
  };
  const dom = await loadWithGuide({ store });
  const bulletOf = (groupId) =>
    dom.document.querySelector(
      `${GUIDE} [data-group-id="${groupId}"] .youtube-groups__group-bullet`,
    );

  assert.strictEqual(bulletOf("A").textContent, "2");
  assert.strictEqual(bulletOf("B").textContent, "1");
  assert.strictEqual(
    bulletOf("B").style.getPropertyValue("--yg-group-color"),
    "",
  );

  const row = dom.document.querySelector(".youtube-groups__guide-row");
  await dom.browser.storage.local.set({
    youtubeWatched: { version: 1, videos: { [ids[0]]: 1 } },
  });
  await dom.flush();
  assert.strictEqual(bulletOf("A").textContent, "1");
  assert.ok(row.isConnected);
  assert.strictEqual(
    dom.document.querySelector(".youtube-groups__guide-row"),
    row,
  );

  dom.document.querySelector(".youtube-groups__guide-enter").click();
  await dom.flush();
  assert.strictEqual(bulletOf("A1").textContent, "1");

  dom.document.querySelector(".youtube-groups__guide-back").click();
  await dom.flush();
  dom.document.querySelector('[data-group-id="A"]').click();
  await dom.flush();
  assert.strictEqual(bulletOf("A").textContent, "");
  assert.strictEqual(
    bulletOf("A").classList.contains("youtube-groups__group-bullet--count"),
    false,
  );
});

test("crear y editar son iconos a la derecha del título, dentro de la cabecera", async () => {
  const dom = await loadWithGuide();
  const header = dom.document.querySelector(
    `${GUIDE} .youtube-groups__guide-header`,
  );
  const children = Array.from(header.children).map((child) => child.className);
  assert.deepStrictEqual(children, [
    "youtube-groups__guide-back",
    "youtube-groups__guide-title",
    "youtube-groups__guide-create",
    "youtube-groups__guide-edit",
  ]);
  for (const selector of [
    ".youtube-groups__guide-create",
    ".youtube-groups__guide-edit",
  ]) {
    const button = header.querySelector(selector);
    assert.strictEqual(button.textContent, "");
    assert.strictEqual(button.children.length, 1);
    assert.strictEqual(button.firstElementChild.tagName.toLowerCase(), "svg");
  }
  const create = header.querySelector(".youtube-groups__guide-create");
  assert.strictEqual(create.getAttribute("aria-label"), "Crear grupo");
  assert.strictEqual(create.title, "Crear grupo");

  dom.document.querySelector(".youtube-groups__guide-item").click();
  await dom.flush();
  const after = dom.document.querySelector(".youtube-groups__guide-create");
  assert.strictEqual(after.getAttribute("aria-label"), "Crear subgrupo en «A»");
  assert.strictEqual(after.title, "Crear subgrupo en «A»");
});

test("el pie de la guía tiene Limpiar selección de icono, deshabilitado sin selección", async () => {
  const dom = await loadWithGuide();
  const guide = dom.document.querySelector(GUIDE);
  const footer = guide.querySelector(".youtube-groups__guide-footer");
  assert.strictEqual(guide.lastElementChild, footer);
  assert.strictEqual(
    footer.previousElementSibling.className,
    "youtube-groups__guide-viewport",
  );
  const clear = footer.querySelector(".youtube-groups__guide-clear");
  const badge = clear.querySelector(".youtube-groups__guide-badge");
  assert.strictEqual(clear.hidden, false);
  assert.strictEqual(clear.disabled, true);
  assert.strictEqual(clear.getAttribute("aria-label"), "Limpiar selección");
  assert.strictEqual(clear.title, "Limpiar selección");
  assert.strictEqual(badge.hidden, true);

  dom.document.querySelector(".youtube-groups__guide-item").click();
  await dom.flush();
  assert.strictEqual(clear.disabled, false);
  assert.strictEqual(clear.getAttribute("aria-label"), "Limpiar selección (1)");
  assert.strictEqual(badge.hidden, false);
  assert.strictEqual(badge.textContent, "1");

  clear.click();
  await dom.flush();
  assert.strictEqual(clear.disabled, true);
  assert.strictEqual(badge.hidden, true);
  assert.strictEqual(clear.getAttribute("aria-label"), "Limpiar selección");
});

test('"+ Grupo" con un nombre crea el grupo en el almacenamiento y aparece la fila', async () => {
  const dom = await loadWithGuide();
  dom.document.querySelector(".youtube-groups__guide-create").click();
  const form = dom.document.querySelector(".youtube-groups__guide-form");
  assert.strictEqual(form.hidden, false);

  form.querySelector("input").value = "Nuevo";
  form.querySelector("button[type='submit']").click();
  await dom.flush();

  assert.deepStrictEqual(
    dom.store.youtubeGroups.groups.map((group) => group.name),
    ["A", "B", "Nuevo"],
  );
  assert.deepStrictEqual(rowNames(dom), ["A (1)", "B (0)", "Nuevo (0)"]);
});

test("un nombre de un carácter muestra el error y no escribe", async () => {
  const dom = await loadWithGuide();
  dom.document.querySelector(".youtube-groups__guide-create").click();
  const form = dom.document.querySelector(".youtube-groups__guide-form");

  form.querySelector("input").value = "X";
  form.querySelector("button[type='submit']").click();
  await dom.flush();

  assert.strictEqual(
    form.querySelector(".youtube-groups__guide-form-error").textContent,
    "El nombre del grupo debe tener al menos 2 caracteres",
  );
  assert.strictEqual(dom.store.youtubeGroups.groups.length, 2);
});

/**
 * Carga una página con la guía y simula que no hay pantalla completa (jsdom
 * no tiene `document.fullscreenElement`: `undefined` cuenta como pantalla
 * completa); `fullscreenchange` recalcula la guía fija.
 * @param {string} url - URL de la página.
 * @returns {Promise<Object>} El resultado de loadDom, ya estabilizado.
 */
async function loadPinned(url) {
  const dom = loadDom({ url, html: GUIDE_HTML, store: guideStore() });
  Object.defineProperty(dom.document, "fullscreenElement", { value: null });
  dom.document.dispatchEvent(new dom.window.Event("fullscreenchange"));
  await dom.flush();
  return dom;
}

test("YouTubeGroupsGuideSection.create no toca el DOM ni fija la guía hasta start()", () => {
  const scripts = manifestScripts().filter((file) => file !== "content.js");
  const dom = loadDom({
    url: "https://www.youtube.com/feed/subscriptions",
    html: GUIDE_HTML,
    scripts,
  });
  const before = dom.document.body.innerHTML;
  const pinnedClass = "youtube-groups--guide-pinned";

  const Guide = dom.global("YouTubeGroupsGuideSection");
  assert.strictEqual(typeof Guide.create, "function");
  const guide = Guide.create({
    state: { activeSelection: [] },
    setActiveSelection() {},
    navigateToSubscriptions() {},
    renderGroupsPanel: async () => {},
  });

  assert.strictEqual(dom.document.body.innerHTML, before);
  assert.strictEqual(
    dom.document.documentElement.classList.contains(pinnedClass),
    false,
  );
  assert.strictEqual(typeof guide.renderGuideSection, "function");
  assert.strictEqual(typeof guide.noteMutations, "function");
  assert.strictEqual(typeof guide.checkPlacement, "function");

  Object.defineProperty(dom.document, "fullscreenElement", { value: null });
  guide.start();
  assert.strictEqual(
    dom.document.documentElement.classList.contains(pinnedClass),
    true,
  );
});

test("la guía muestra el avatar guardado de un canal y repinta al cambiar youtubeAvatars", async () => {
  const otherUrl = "https://www.youtube.com/@otro";
  const avatarUrl = "https://yt3.ggpht.com/abc=s88-c-k-c0x00ffffff-no-rj";
  const otherAvatarUrl = "https://yt3.ggpht.com/def=s88-c-k-c0x00ffffff-no-rj";
  const store = groupsStore([
    makeGroup("A", {
      channels: [
        { name: "Canal", url: CHANNEL_URL },
        { name: "Otro", url: otherUrl },
      ],
    }),
  ]);
  store.youtubeAvatars = {
    version: 1,
    avatars: { [CHANNEL_URL]: avatarUrl },
  };
  const dom = await loadWithGuide({ store });

  const rows = () =>
    Array.from(
      dom.document.querySelectorAll(`${GUIDE} .youtube-groups__guide-channel`),
    );
  assert.strictEqual(rows().length, 2);
  const [first, second] = rows();
  assert.strictEqual(
    first.querySelector("img.youtube-groups__avatar-img").getAttribute("src"),
    avatarUrl,
  );
  assert.strictEqual(second.querySelector("img"), null);
  assert.ok(second.querySelector(".youtube-groups__avatar-initial"));
  assert.strictEqual(
    first.querySelector(".youtube-groups__guide-name").textContent,
    "Canal",
  );
  assert.strictEqual(first.title, CHANNEL_URL);

  await dom.browser.storage.local.set({
    youtubeAvatars: {
      version: 1,
      avatars: { [CHANNEL_URL]: avatarUrl, [otherUrl]: otherAvatarUrl },
    },
  });
  await dom.flush();

  assert.strictEqual(
    rows()[1]
      .querySelector("img.youtube-groups__avatar-img")
      .getAttribute("src"),
    otherAvatarUrl,
  );
});

test("el engranaje del pie abre y cierra el menú y refleja aria-expanded", async () => {
  const dom = await loadWithGuide();
  const gear = dom.document.querySelector(
    `${GUIDE} .youtube-groups__guide-footer .youtube-groups__guide-menu-button`,
  );
  assert.strictEqual(gear.getAttribute("aria-label"), "Opciones");
  assert.strictEqual(gear.getAttribute("aria-haspopup"), "dialog");
  assert.strictEqual(gear.getAttribute("aria-controls"), "youtube-groups-menu");
  assert.strictEqual(gear.getAttribute("aria-expanded"), "false");
  assert.strictEqual(gear.textContent, "");

  gear.click();
  assert.strictEqual(gear.getAttribute("aria-expanded"), "true");
  gear.click();
  assert.strictEqual(gear.getAttribute("aria-expanded"), "false");
});

test("en suscripciones la guía está fija en <html> y en inicio no", async () => {
  const pinned = await loadPinned("https://www.youtube.com/feed/subscriptions");
  assert.strictEqual(
    pinned.document.documentElement.classList.contains(
      "youtube-groups--guide-pinned",
    ),
    true,
  );

  const home = await loadPinned("https://www.youtube.com/");
  assert.strictEqual(
    home.document.documentElement.classList.contains(
      "youtube-groups--guide-pinned",
    ),
    false,
  );
});
