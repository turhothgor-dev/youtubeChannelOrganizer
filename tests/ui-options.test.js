"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { loadOptionsDom } = require("./helpers/load-dom");
const { makeGroup, groupsStore } = require("./helpers/youtube-fixtures");

test("el editor pinta el árbol de grupos y el resumen", async () => {
  const store = groupsStore([
    makeGroup("a", { name: "A", subgroups: [makeGroup("a1", { name: "A1" })] }),
    makeGroup("b", { name: "B" }),
  ]);
  const dom = loadOptionsDom({ store });
  await dom.flush();

  const rows = [...dom.document.querySelectorAll('[role="treeitem"]')];
  assert.strictEqual(rows.length, 3);
  assert.deepStrictEqual(
    rows.map((row) => row.querySelector(".options__name").textContent),
    ["A", "A1", "B"],
  );
  assert.strictEqual(
    dom.document.getElementById("options-summary").textContent,
    "3 grupos",
  );
});

/**
 * Carga el editor con A (subgrupo A1) y B.
 * @returns {Promise<Object>} DOM cargado.
 */
async function loadEditor() {
  const store = groupsStore([
    makeGroup("a", { name: "A", subgroups: [makeGroup("a1", { name: "A1" })] }),
    makeGroup("b", { name: "B" }),
  ]);
  const dom = loadOptionsDom({ store });
  await dom.flush();
  return dom;
}

/**
 * Devuelve la fila del árbol con ese nombre.
 * @param {Object} dom - DOM cargado.
 * @param {string} name - Nombre del grupo.
 * @returns {Element} Fila.
 */
function rowOf(dom, name) {
  return [...dom.document.querySelectorAll('[role="treeitem"]')].find(
    (row) => row.querySelector(".options__name").textContent === name,
  );
}

test("las acciones de fila son solo icono y siguen el orden previsto", async () => {
  const dom = await loadEditor();
  const buttons = [
    ...rowOf(dom, "A").querySelectorAll(".options__actions button"),
  ];
  assert.deepStrictEqual(
    buttons.map((b) => b.getAttribute("aria-label")),
    [
      "Subir",
      "Bajar",
      "Renombrar",
      "Icono y color",
      "Eliminar",
      "Mover a…",
      "Añadir subgrupo",
    ],
  );
  for (const button of buttons) {
    assert.strictEqual(button.title, button.getAttribute("aria-label"));
    assert.ok(button.querySelector("svg"));
    assert.strictEqual(button.textContent, "");
  }
  assert.strictEqual(buttons[0].disabled, true);
});

test("Bajar mueve A tras B", async () => {
  const dom = await loadEditor();
  rowOf(dom, "A").querySelector('[aria-label="Bajar"]').click();
  // La escritura notifica a onChanged en un turno posterior.
  await dom.flush();
  await dom.flush();
  const names = [...dom.document.querySelectorAll(".options__name")].map(
    (n) => n.textContent,
  );
  assert.deepStrictEqual(names, ["B", "A", "A1"]);
});

test("Renombrar abre el campo con el nombre", async () => {
  const dom = await loadEditor();
  rowOf(dom, "A").querySelector('[aria-label="Renombrar"]').click();
  await dom.flush();
  const input = dom.document.querySelector(".options__editor input");
  assert.strictEqual(input.value, "A");
});

test("Añadir subgrupo abre un campo de creación dentro de A", async () => {
  const dom = await loadEditor();
  rowOf(dom, "A").querySelector('[aria-label="Añadir subgrupo"]').click();
  await dom.flush();
  const input = dom.document.querySelector(".options__editor input");
  assert.ok(input);
  assert.strictEqual(input.value, "");
  assert.ok(rowOf(dom, "A").parentElement.contains(input));
});

test("Eliminar quita A y muestra el aviso con Deshacer", async () => {
  const dom = await loadEditor();
  rowOf(dom, "A").querySelector('[aria-label="Eliminar"]').click();
  await dom.flush();
  await dom.flush();
  assert.strictEqual(rowOf(dom, "A"), undefined);
  const notice = dom.document.querySelector(".options__notice");
  assert.ok(notice.textContent.includes("Deshacer"));
});

test("con búsqueda no hay Subir, Bajar ni Mover a…", async () => {
  const dom = await loadEditor();
  const search = dom.document.getElementById("options-search");
  search.value = "a1";
  search.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  await dom.flush();
  const labels = [
    ...rowOf(dom, "A1").querySelectorAll(".options__actions button"),
  ].map((b) => b.getAttribute("aria-label"));
  assert.deepStrictEqual(labels, [
    "Renombrar",
    "Icono y color",
    "Eliminar",
    "Añadir subgrupo",
  ]);
});

test("F2 sobre la fila abre renombrar", async () => {
  const dom = await loadEditor();
  rowOf(dom, "A").dispatchEvent(
    new dom.window.KeyboardEvent("keydown", { key: "F2", bubbles: true }),
  );
  await dom.flush();
  assert.ok(dom.document.querySelector(".options__editor input"));
});
