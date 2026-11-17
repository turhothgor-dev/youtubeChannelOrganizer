"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { loadDom } = require("./helpers/load-dom");
const {
  CHANNEL_URL,
  makeGroup,
  groupsStore,
  flushLoose,
  SUBSCRIPTION_CARD_HTML,
} = require("./helpers/youtube-fixtures");

const SUBSCRIPTION_DROPDOWN = ".youtube-groups__subscription-dropdown";
const SUBSCRIPTION_FORM = ".youtube-groups__subscription-groups-form";
const PLAYLIST_DROPDOWN = ".youtube-groups__playlist-dropdown";
const PLAYLIST_FORM = ".youtube-groups__playlist-dropdown-form";

/**
 * Carga una página de suscripciones con una tarjeta y los grupos A y B.
 * @returns {Promise<Object>} El resultado de loadDom, ya estabilizado.
 */
async function loadWithCard() {
  const dom = loadDom({
    html: SUBSCRIPTION_CARD_HTML,
    store: groupsStore([makeGroup("A"), makeGroup("B")]),
  });
  await flushLoose(dom);
  return dom;
}

test('"+G" abre un único desplegable con una casilla por grupo y no se duplica', async () => {
  const dom = await loadWithCard();
  const addButton = dom.document.querySelector(
    ".youtube-groups__subscription-add-button",
  );

  addButton.click();
  await flushLoose(dom);
  addButton.click();
  await flushLoose(dom);

  assert.strictEqual(
    dom.document.querySelectorAll(SUBSCRIPTION_DROPDOWN).length,
    1,
  );
  const form = dom.document.querySelector(SUBSCRIPTION_FORM);
  assert.strictEqual(form.hidden, false);
  assert.strictEqual(form.querySelectorAll("input[type='checkbox']").length, 2);
});

test("marcar B y Guardar añade el canal a B en el almacenamiento", async () => {
  const dom = await loadWithCard();
  dom.document
    .querySelector(".youtube-groups__subscription-add-button")
    .click();
  await flushLoose(dom);

  const form = dom.document.querySelector(SUBSCRIPTION_FORM);
  const checkboxB = Array.from(form.querySelectorAll("input")).find(
    (input) => input.value === "B",
  );
  checkboxB.checked = true;
  form.querySelector("button[type='submit']").click();
  await flushLoose(dom);

  const groups = dom.store.youtubeGroups.groups;
  assert.deepStrictEqual(
    groups.find((group) => group.id === "B").channels.map((c) => c.url),
    [CHANNEL_URL],
  );
  assert.strictEqual(
    groups.find((group) => group.id === "A").channels.length,
    0,
  );
  assert.strictEqual(form.hidden, true);
});

test('"Lista" abre el desplegable de listas, "Crear" crea la lista y la deja marcada', async () => {
  const dom = await loadWithCard();
  dom.document.querySelector(".youtube-groups__playlist-button").click();
  await flushLoose(dom);

  assert.strictEqual(
    dom.document.querySelectorAll(PLAYLIST_DROPDOWN).length,
    1,
  );
  const form = dom.document.querySelector(PLAYLIST_FORM);
  assert.strictEqual(form.hidden, false);

  dom.document.querySelector(".youtube-groups__playlist-dropdown-input").value =
    "Ver luego";
  dom.document
    .querySelector(".youtube-groups__playlist-dropdown-create")
    .click();
  await flushLoose(dom);

  const playlists = dom.store.youtubePlaylists.playlists;
  assert.deepStrictEqual(
    playlists.map((playlist) => playlist.name),
    ["Ver luego"],
  );
  const checkbox = form.querySelector("input[type='checkbox']");
  assert.strictEqual(checkbox.value, playlists[0].id);
  assert.strictEqual(checkbox.checked, true);
});

test("abrir un desplegable oculta el otro", async () => {
  const dom = await loadWithCard();
  const addButton = dom.document.querySelector(
    ".youtube-groups__subscription-add-button",
  );
  const listButton = dom.document.querySelector(
    ".youtube-groups__playlist-button",
  );

  addButton.click();
  await flushLoose(dom);
  assert.strictEqual(
    dom.document.querySelector(SUBSCRIPTION_FORM).hidden,
    false,
  );

  listButton.click();
  await flushLoose(dom);
  assert.strictEqual(
    dom.document.querySelector(SUBSCRIPTION_FORM).hidden,
    true,
  );
  assert.strictEqual(dom.document.querySelector(PLAYLIST_FORM).hidden, false);

  addButton.click();
  await flushLoose(dom);
  assert.strictEqual(dom.document.querySelector(PLAYLIST_FORM).hidden, true);
  assert.strictEqual(
    dom.document.querySelector(SUBSCRIPTION_FORM).hidden,
    false,
  );
});
