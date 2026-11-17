"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { loadDom, manifestScripts } = require("./helpers/load-dom");
const {
  CHANNEL_URL,
  makeGroup,
  groupsStore,
  GUIDE_HTML,
  SUBSCRIPTION_CARD_HTML,
  CHANNEL_RESULT_HTML,
} = require("./helpers/youtube-fixtures");

const CONTROL = ".youtube-groups__subscription-control";

/**
 * Pulsa el botón de la guía cuyo nombre empieza por `text`.
 * @param {Document} document - Documento.
 * @param {string} text - Principio del nombre.
 */
function clickGuideItem(document, text) {
  const button = Array.from(
    document.querySelectorAll(".youtube-groups__guide-item"),
  ).find((item) => item.textContent.trim().startsWith(text));
  assert.ok(button, `no hay botón de guía "${text}"`);
  button.click();
}

/**
 * Crea el componente de tarjetas solo, con un contexto mínimo.
 * @param {Object} dom - Resultado de `loadDom`.
 * @returns {Object} API del componente.
 */
function createCards(dom) {
  const Cards = dom.global("YouTubeGroupsCards");
  return Cards.create({
    state: {
      settings: dom.global("YouTubeGroupsSettings").DEFAULT_SETTINGS,
      activeSelection: [],
      activeSelectionUrls: null,
      advancedFilters: { duration: "any", age: "any", views: "any" },
      watchedVideos: null,
    },
    watched: {
      applyWatchedToCard() {},
      updateWatchedButton() {},
      toggleVideoWatched() {},
    },
    dropdowns: {},
  });
}

test("YouTubeGroupsCards.create no toca el DOM", () => {
  const scripts = manifestScripts().filter((file) => file !== "content.js");
  const dom = loadDom({ html: SUBSCRIPTION_CARD_HTML, scripts });
  const before = dom.document.body.innerHTML;

  assert.strictEqual(
    typeof dom.global("YouTubeGroupsCards").create,
    "function",
  );
  const cards = createCards(dom);

  assert.strictEqual(dom.document.body.innerHTML, before);
  assert.strictEqual(typeof cards.scanDocument, "function");
  assert.strictEqual(typeof cards.resetDetectedCards, "function");
});

test("resetDetectedCards y scanDocument vuelven a procesar una tarjeta cuyo enlace de canal ha cambiado", async () => {
  const scripts = manifestScripts().filter((file) => file !== "content.js");
  const dom = loadDom({ html: SUBSCRIPTION_CARD_HTML, scripts });
  const cards = createCards(dom);
  const card = dom.document.querySelector("ytd-rich-item-renderer");

  cards.scanDocument();
  await dom.flush();
  assert.strictEqual(card.dataset.youtubeGroupsChannelUrl, CHANNEL_URL);

  // YouTube reutiliza la tarjeta para otro canal
  card.querySelector("ytd-channel-name a").setAttribute("href", "/@otro");
  cards.resetDetectedCards();
  cards.scanDocument();
  await dom.flush();
  assert.strictEqual(
    card.dataset.youtubeGroupsChannelUrl,
    "https://www.youtube.com/@otro",
  );
});

test("una tarjeta recibe un único control dentro de la miniatura", async () => {
  const dom = loadDom({ html: SUBSCRIPTION_CARD_HTML });
  await dom.flush();

  const card = dom.document.querySelector("ytd-rich-item-renderer");
  assert.strictEqual(card.querySelectorAll(CONTROL).length, 1);
  const thumb = card.querySelector("ytd-thumbnail");
  assert.ok(thumb.hasAttribute("data-youtube-groups-thumb-host"));
  assert.ok(thumb.querySelector(CONTROL));

  // Una mutación en la tarjeta la reprocesa sin duplicar el control
  card.appendChild(dom.document.createElement("span"));
  await dom.flush();
  assert.strictEqual(card.querySelectorAll(CONTROL).length, 1);
});

for (const [nombre, store] of [
  ["sin vistos", undefined],
  [
    "con el vídeo visto",
    {
      youtubeWatched: { version: 1, videos: { abc123DEF45: { watchedAt: 1 } } },
    },
  ],
]) {
  test(`una tarjeta con botones se estabiliza y reprocesarla no muta el DOM (${nombre})`, async () => {
    const dom = loadDom({ html: SUBSCRIPTION_CARD_HTML, store });
    await dom.flush();

    const card = dom.document.querySelector("ytd-rich-item-renderer");
    card.appendChild(dom.document.createElement("span"));
    const observer = new dom.window.MutationObserver(() => {});
    observer.observe(card, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
    observer.takeRecords();
    await dom.flush();

    assert.strictEqual(observer.takeRecords().length, 0);
    observer.disconnect();
  });
}

test("seleccionar otro grupo oculta la tarjeta y limpiar la selección la muestra", async () => {
  const dom = loadDom({
    html: GUIDE_HTML + SUBSCRIPTION_CARD_HTML,
    store: groupsStore([
      makeGroup("A", { channels: [{ name: "Canal", url: CHANNEL_URL }] }),
      makeGroup("B"),
    ]),
  });
  await dom.flush();
  const card = dom.document.querySelector("ytd-rich-item-renderer");
  assert.ok(!card.classList.contains("youtube-groups--hidden"));

  clickGuideItem(dom.document, "B");
  await dom.flush();
  assert.ok(card.classList.contains("youtube-groups--hidden"));

  dom.document.querySelector(".youtube-groups__guide-clear").click();
  await dom.flush();
  assert.ok(!card.classList.contains("youtube-groups--hidden"));
});

const STRIPE_CLASS = "youtube-groups--group-stripe";
const STRIPE_PROPERTY = "--yg-group-stripe";
const CHANNEL = { name: "Canal", url: CHANNEL_URL };

test("la tarjeta de un canal de un grupo con color recibe la línea de color", async () => {
  const dom = loadDom({
    html: SUBSCRIPTION_CARD_HTML,
    store: groupsStore([
      makeGroup("A", { channels: [CHANNEL], color: "#2196F3" }),
    ]),
  });
  await dom.flush();
  const card = dom.document.querySelector("ytd-rich-item-renderer");

  assert.ok(card.classList.contains(STRIPE_CLASS));
  assert.strictEqual(
    card.style.getPropertyValue(STRIPE_PROPERTY),
    "linear-gradient(to right, #2196f3 0% 100%)",
  );
});

test("un canal en dos grupos con colores distintos da dos segmentos", async () => {
  const dom = loadDom({
    html: SUBSCRIPTION_CARD_HTML,
    store: groupsStore([
      makeGroup("A", { channels: [CHANNEL], color: "#2196f3" }),
      makeGroup("B", { channels: [CHANNEL], color: "#f44336" }),
    ]),
  });
  await dom.flush();
  const card = dom.document.querySelector("ytd-rich-item-renderer");

  assert.strictEqual(
    card.style.getPropertyValue(STRIPE_PROPERTY),
    "linear-gradient(to right, #2196f3 0% 50%, #f44336 50% 100%)",
  );
});

test("un canal en un grupo sin color no recibe la línea", async () => {
  const dom = loadDom({
    html: SUBSCRIPTION_CARD_HTML,
    store: groupsStore([makeGroup("A", { channels: [CHANNEL] })]),
  });
  await dom.flush();
  const card = dom.document.querySelector("ytd-rich-item-renderer");

  assert.ok(!card.classList.contains(STRIPE_CLASS));
  assert.strictEqual(card.style.getPropertyValue(STRIPE_PROPERTY), "");
});

test("fuera de suscripciones la tarjeta no recibe la línea", async () => {
  const dom = loadDom({
    url: "https://www.youtube.com/",
    html: SUBSCRIPTION_CARD_HTML,
    store: groupsStore([
      makeGroup("A", { channels: [CHANNEL], color: "#2196f3" }),
    ]),
  });
  await dom.flush();
  const card = dom.document.querySelector("ytd-rich-item-renderer");

  assert.ok(!card.classList.contains(STRIPE_CLASS));
  assert.strictEqual(card.style.getPropertyValue(STRIPE_PROPERTY), "");
});

test("reprocesar una tarjeta con línea no produce mutaciones de atributos", async () => {
  const dom = loadDom({
    html: SUBSCRIPTION_CARD_HTML,
    store: groupsStore([
      makeGroup("A", { channels: [CHANNEL], color: "#2196f3" }),
    ]),
  });
  await dom.flush();
  const card = dom.document.querySelector("ytd-rich-item-renderer");
  assert.ok(card.classList.contains(STRIPE_CLASS));

  card.appendChild(dom.document.createElement("span"));
  const observer = new dom.window.MutationObserver(() => {});
  observer.observe(card, { attributes: true });
  observer.takeRecords();
  await dom.flush();

  assert.strictEqual(observer.takeRecords().length, 0);
  observer.disconnect();
});

test("cambiar el color del grupo actualiza la línea y los botones y el filtro siguen", async () => {
  const dom = loadDom({
    html: GUIDE_HTML + SUBSCRIPTION_CARD_HTML,
    store: groupsStore([
      makeGroup("A", { channels: [CHANNEL], color: "#2196f3" }),
      makeGroup("B"),
    ]),
  });
  await dom.flush();
  const card = dom.document.querySelector("ytd-rich-item-renderer");
  assert.ok(card.querySelector(CONTROL));

  await dom.browser.storage.local.set(
    groupsStore([
      makeGroup("A", { channels: [CHANNEL], color: "#4caf50" }),
      makeGroup("B"),
    ]),
  );
  await dom.flush();
  assert.strictEqual(
    card.style.getPropertyValue(STRIPE_PROPERTY),
    "linear-gradient(to right, #4caf50 0% 100%)",
  );
  assert.ok(card.querySelector(CONTROL));

  clickGuideItem(dom.document, "B");
  await dom.flush();
  assert.ok(card.classList.contains("youtube-groups--hidden"));
});

test("un resultado de canal en búsqueda recibe solo Añadir a grupo", async () => {
  const dom = loadDom({
    url: "https://www.youtube.com/results?search_query=canal",
    html: CHANNEL_RESULT_HTML,
  });
  await dom.flush();

  const result = dom.document.querySelector("ytd-channel-renderer");
  const controls = result.querySelectorAll(CONTROL);
  assert.strictEqual(controls.length, 1);
  assert.strictEqual(controls[0].querySelectorAll("button").length, 1);
  assert.strictEqual(
    controls[0].querySelector("button").textContent,
    "Añadir a grupo",
  );
});
