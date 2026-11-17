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

test("la banda de color va en el botón del grupo, no en la fila", async () => {
  const groups = [
    makeGroup("A", { subgroups: [makeGroup("A1")] }),
    makeGroup("B"),
  ];
  groups[0].color = "#2196F3";
  const dom = await loadWithGuide({ store: groupsStore(groups) });
  const band = "youtube-groups__group-band";

  const rows = dom.document.querySelectorAll(
    `${GUIDE} .youtube-groups__guide-row`,
  );
  assert.strictEqual(rows.length, 2);
  const [rowA, rowB] = rows;
  const buttonA = rowA.querySelector(".youtube-groups__guide-item");
  assert.ok(buttonA.classList.contains(band));
  assert.strictEqual(
    buttonA.style.getPropertyValue("--yg-group-color"),
    "#2196F3",
  );
  assert.strictEqual(rowA.classList.contains(band), false);
  assert.strictEqual(
    rowB.querySelector(".youtube-groups__guide-item").classList.contains(band),
    false,
  );

  dom.document.querySelector(".youtube-groups__guide-enter").click();
  await dom.flush();
  const inner = dom.document
    .querySelector(`${GUIDE} .youtube-groups__guide-viewport`)
    .lastElementChild.querySelector(".youtube-groups__guide-item");
  assert.ok(inner.classList.contains(band));
  assert.strictEqual(
    inner.style.getPropertyValue("--yg-group-color"),
    "#2196F3",
  );
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
