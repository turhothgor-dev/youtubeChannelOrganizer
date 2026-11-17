"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { loadDom } = require("./helpers/load-dom");
const {
  CHANNEL_URL,
  makeGroup,
  groupsStore,
  flushLoose,
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

test("una tarjeta recibe un único control dentro de la miniatura", async () => {
  const dom = loadDom({ html: SUBSCRIPTION_CARD_HTML });
  await flushLoose(dom);

  const card = dom.document.querySelector("ytd-rich-item-renderer");
  assert.strictEqual(card.querySelectorAll(CONTROL).length, 1);
  const thumb = card.querySelector("ytd-thumbnail");
  assert.ok(thumb.hasAttribute("data-youtube-groups-thumb-host"));
  assert.ok(thumb.querySelector(CONTROL));

  // Una mutación en la tarjeta la reprocesa sin duplicar el control
  card.appendChild(dom.document.createElement("span"));
  await flushLoose(dom);
  assert.strictEqual(card.querySelectorAll(CONTROL).length, 1);
});

test("seleccionar otro grupo oculta la tarjeta y limpiar la selección la muestra", async () => {
  const dom = loadDom({
    html: GUIDE_HTML + SUBSCRIPTION_CARD_HTML,
    store: groupsStore([
      makeGroup("A", { channels: [{ name: "Canal", url: CHANNEL_URL }] }),
      makeGroup("B"),
    ]),
  });
  await flushLoose(dom);
  const card = dom.document.querySelector("ytd-rich-item-renderer");
  assert.ok(!card.classList.contains("youtube-groups--hidden"));

  clickGuideItem(dom.document, "B");
  await flushLoose(dom);
  assert.ok(card.classList.contains("youtube-groups--hidden"));

  dom.document.querySelector(".youtube-groups__guide-clear").click();
  await flushLoose(dom);
  assert.ok(!card.classList.contains("youtube-groups--hidden"));
});

test("un resultado de canal en búsqueda recibe solo Añadir a grupo", async () => {
  const dom = loadDom({
    url: "https://www.youtube.com/results?search_query=canal",
    html: CHANNEL_RESULT_HTML,
  });
  await flushLoose(dom);

  const result = dom.document.querySelector("ytd-channel-renderer");
  const controls = result.querySelectorAll(CONTROL);
  assert.strictEqual(controls.length, 1);
  assert.strictEqual(controls[0].querySelectorAll("button").length, 1);
  assert.strictEqual(
    controls[0].querySelector("button").textContent,
    "Añadir a grupo",
  );
});
