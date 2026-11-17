"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { loadDom, manifestScripts } = require("./helpers/load-dom");

const MODULES_ONLY = manifestScripts().filter((file) =>
  file.startsWith("modules/"),
);

test("cargar solo modules/ no cambia el body ni usa el almacenamiento", () => {
  const dom = loadDom({ scripts: MODULES_ONLY, html: "<p>hola</p>" });
  assert.strictEqual(dom.document.body.innerHTML, "<p>hola</p>");
  assert.deepStrictEqual(dom.calls, { get: 0, set: 0 });
  assert.ok(dom.global("YouTubeGroupsStorage"));
});

test("un set avisa a storage.onChanged", async () => {
  const dom = loadDom({ scripts: [] });
  const received = [];
  dom.browser.storage.onChanged.addListener((changes, area) =>
    received.push({ changes, area }),
  );
  await dom.browser.storage.local.set({ clave: 1 });
  await dom.flush();
  assert.strictEqual(received.length, 1);
  assert.strictEqual(received[0].area, "local");
  assert.deepStrictEqual(received[0].changes, {
    clave: { oldValue: undefined, newValue: 1 },
  });
});

test("flush ejecuta un requestAnimationFrame encadenado", async () => {
  const dom = loadDom({ scripts: [] });
  const order = [];
  dom.window.requestAnimationFrame(() => {
    order.push("a");
    dom.window.requestAnimationFrame(() => order.push("b"));
  });
  await dom.flush();
  assert.deepStrictEqual(order, ["a", "b"]);
});
