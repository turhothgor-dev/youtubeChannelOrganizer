"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { manifestScripts } = require("./helpers/load-dom");

const ROOT = path.resolve(__dirname, "..");

test("todos los scripts de content_scripts existen", () => {
  for (const file of manifestScripts()) {
    assert.ok(fs.existsSync(path.join(ROOT, file)), file);
  }
});

test("modules/* va antes que ui/* y content.js es el último", () => {
  const scripts = manifestScripts();
  assert.strictEqual(scripts[scripts.length - 1], "content.js");
  const lastModule = scripts
    .map((f) => f.startsWith("modules/"))
    .lastIndexOf(true);
  const firstUi = scripts.findIndex((f) => f.startsWith("ui/"));
  if (firstUi !== -1) {
    assert.ok(lastModule < firstUi);
  }
});
