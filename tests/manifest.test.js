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

function readManifest() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
}

test("options_ui y background apuntan a ficheros existentes, sin permisos nuevos", () => {
  const manifest = readManifest();
  assert.strictEqual(manifest.options_ui.open_in_tab, true);
  assert.ok(fs.existsSync(path.join(ROOT, manifest.options_ui.page)));
  assert.deepStrictEqual(manifest.background.scripts, ["background.js"]);
  assert.ok(fs.existsSync(path.join(ROOT, "background.js")));
  assert.deepStrictEqual(manifest.permissions, ["storage"]);
});

test("options.html carga ficheros existentes, sin scripts en línea y en orden", () => {
  const manifest = readManifest();
  const pageFile = path.join(ROOT, manifest.options_ui.page);
  const html = fs.readFileSync(pageFile, "utf8");
  const resolve = (ref) =>
    ref.startsWith("/")
      ? path.join(ROOT, ref)
      : path.join(path.dirname(pageFile), ref);

  const scriptTags = [...html.matchAll(/<script\b([^>]*)>/g)];
  const scripts = scriptTags.map((m) => /src="([^"]+)"/.exec(m[1])?.[1]);
  assert.ok(scripts.every(Boolean), "script sin src (en línea)");
  assert.ok(
    !/<script\b[^>]*>\s*\S/.test(
      html.replace(/<script\b[^>]*src=[^>]*><\/script>/g, ""),
    ),
  );
  for (const ref of scripts) {
    assert.ok(fs.existsSync(resolve(ref)), ref);
  }
  const hrefs = [...html.matchAll(/<link\b[^>]*href="([^"]+)"/g)].map(
    (m) => m[1],
  );
  for (const ref of hrefs) {
    assert.ok(fs.existsSync(resolve(ref)), ref);
  }

  assert.strictEqual(scripts[scripts.length - 1], "options.js");
  const shared = scripts.slice(0, -1).map((ref) => ref.replace(/^\//, ""));
  const contentOrder = manifest.content_scripts[0].js;
  const sharedInContent = shared.filter((f) => contentOrder.includes(f));
  assert.deepStrictEqual(
    sharedInContent,
    contentOrder.filter((f) => shared.includes(f)),
  );
});

test("los ui/*.js se cargan en el orden de sus dependencias", () => {
  assert.deepStrictEqual(
    manifestScripts().filter((f) => f.startsWith("ui/")),
    [
      "ui/icons-dom.js",
      "ui/icon-picker.js",
      "ui/avatars.js",
      "ui/subscriptions.js",
      "ui/dropdowns.js",
      "ui/player.js",
      "ui/watched.js",
      "ui/cards.js",
      "ui/guide-section.js",
      "ui/panel.js",
    ],
  );
});
