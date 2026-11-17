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

const CSS_FILES = [
  "ui/panel.css",
  "ui/cards.css",
  "ui/dropdowns.css",
  "ui/buttons.css",
  "ui/icons.css",
  "ui/icon-picker.css",
  "ui/guide-section.css",
  "ui/fullscreen.css",
];

// Reglas (`{`) que tenía content.css en el commit anterior a partirlo (T13).
const RULES_IN_ORIGINAL_CONTENT_CSS = 216;

test("css lista los ocho ficheros de ui/ en orden, existen y no hay content.css", () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"),
  );
  assert.deepStrictEqual(manifest.content_scripts[0].css, CSS_FILES);
  for (const file of CSS_FILES) {
    assert.ok(fs.existsSync(path.join(ROOT, file)), file);
  }
  assert.ok(!fs.existsSync(path.join(ROOT, "content.css")));
});

test("los ficheros CSS suman las reglas de content.css", () => {
  let rules = 0;
  for (const file of CSS_FILES) {
    const css = fs.readFileSync(path.join(ROOT, file), "utf8");
    rules += css.split("{").length - 1;
  }
  assert.strictEqual(rules, RULES_IN_ORIGINAL_CONTENT_CSS);
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

test("los ui/*.js se cargan en el orden de sus dependencias", () => {
  assert.deepStrictEqual(
    manifestScripts().filter((f) => f.startsWith("ui/")),
    [
      "ui/icons-dom.js",
      "ui/icon-picker.js",
      "ui/dropdowns.js",
      "ui/player.js",
      "ui/watched.js",
      "ui/cards.js",
      "ui/guide-section.js",
      "ui/panel.js",
    ],
  );
});
