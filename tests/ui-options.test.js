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
