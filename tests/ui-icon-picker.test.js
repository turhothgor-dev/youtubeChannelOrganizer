"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { loadDom, manifestScripts } = require("./helpers/load-dom");
const {
  makeGroup,
  groupsStore,
  flushLoose,
  GUIDE_HTML,
} = require("./helpers/youtube-fixtures");

const PICKER = ".youtube-groups__icon-picker";
const PICKER_FORM = ".youtube-groups__icon-picker-form";
const FORM_PREVIEW = ".youtube-groups__guide-form-icon-preview";

/**
 * Carga la guía con un grupo y abre el formulario de crear.
 * @returns {Promise<Object>} El resultado de loadDom, ya estabilizado.
 */
async function loadWithGuideForm() {
  const dom = loadDom({
    html: GUIDE_HTML,
    store: groupsStore([makeGroup("A")]),
  });
  await flushLoose(dom);
  dom.document.querySelector(".youtube-groups__guide-create").click();
  return dom;
}

test('el botón "Icono" abre un único selector visible y no se duplica', async () => {
  const dom = await loadWithGuideForm();
  const iconButton = dom.document.querySelector(
    ".youtube-groups__guide-form-icon",
  );

  iconButton.click();
  iconButton.click();

  assert.strictEqual(dom.document.querySelectorAll(PICKER).length, 1);
  assert.strictEqual(dom.document.querySelector(PICKER).hidden, false);
  assert.strictEqual(dom.document.querySelector(PICKER_FORM).hidden, false);
});

test('elegir un icono y "Guardar" lo pone en la vista previa y oculta el selector', async () => {
  const dom = await loadWithGuideForm();
  dom.document.querySelector(".youtube-groups__guide-form-icon").click();
  assert.strictEqual(
    dom.document.querySelector(FORM_PREVIEW).children.length,
    0,
  );

  // El primer botón es "Sin icono"; el segundo, el primer icono del conjunto
  const options = dom.document.querySelectorAll(
    ".youtube-groups__icon-picker-option",
  );
  options[1].click();
  dom.document.querySelector(".youtube-groups__icon-picker-save").click();
  await flushLoose(dom);

  assert.ok(dom.document.querySelector(`${FORM_PREVIEW} svg`));
  assert.strictEqual(dom.document.querySelector(PICKER).hidden, true);
  assert.strictEqual(dom.document.querySelector(PICKER_FORM).hidden, true);
});

test('"Cancelar" oculta el selector sin cambiar la vista previa', async () => {
  const dom = await loadWithGuideForm();
  dom.document.querySelector(".youtube-groups__guide-form-icon").click();
  dom.document
    .querySelectorAll(".youtube-groups__icon-picker-option")[1]
    .click();

  dom.document.querySelector(".youtube-groups__icon-picker-cancel").click();

  assert.strictEqual(dom.document.querySelector(PICKER).hidden, true);
  assert.strictEqual(dom.document.querySelector(PICKER_FORM).hidden, true);
  assert.strictEqual(
    dom.document.querySelector(FORM_PREVIEW).children.length,
    0,
  );
});

/** Carga los scripts del manifiesto sin content.js y devuelve el componente. */
function loadIconPicker() {
  const scripts = manifestScripts().filter((file) => file !== "content.js");
  const dom = loadDom({ scripts });
  return { dom, picker: dom.global("YouTubeGroupsIconPicker") };
}

test("openIconPicker abre el selector y Guardar llama a onSave con la elección", async () => {
  const { dom, picker } = loadIconPicker();
  const anchor = dom.document.createElement("button");
  dom.document.body.appendChild(anchor);
  const saved = [];

  picker.openIconPicker({ iconId: "", colorHex: "" }, anchor, (choice) => {
    saved.push(choice);
  });
  assert.strictEqual(dom.document.querySelector(PICKER).hidden, false);

  dom.document
    .querySelectorAll(".youtube-groups__icon-picker-option")[1]
    .click();
  dom.document.querySelector(".youtube-groups__icon-picker-save").click();
  await flushLoose(dom);

  assert.strictEqual(saved.length, 1);
  assert.ok(saved[0].iconId);
  assert.strictEqual(saved[0].colorHex, "");
  assert.strictEqual(dom.document.querySelector(PICKER).hidden, true);
});

test("si onSave lanza, el error se muestra y el selector sigue abierto", async () => {
  const { dom, picker } = loadIconPicker();
  const anchor = dom.document.createElement("button");
  dom.document.body.appendChild(anchor);

  picker.openIconPicker({}, anchor, () => {
    throw new Error("Fallo al guardar");
  });
  dom.document.querySelector(".youtube-groups__icon-picker-save").click();
  await flushLoose(dom);

  assert.strictEqual(
    dom.document.querySelector(".youtube-groups__icon-picker-error")
      .textContent,
    "Fallo al guardar",
  );
  assert.strictEqual(dom.document.querySelector(PICKER).hidden, false);
});

test("hideIconPicker oculta el selector", () => {
  const { dom, picker } = loadIconPicker();
  const anchor = dom.document.createElement("button");
  dom.document.body.appendChild(anchor);
  picker.openIconPicker({}, anchor, () => {});

  picker.hideIconPicker();

  assert.strictEqual(dom.document.querySelector(PICKER).hidden, true);
  assert.strictEqual(dom.document.querySelector(PICKER_FORM).hidden, true);
});
