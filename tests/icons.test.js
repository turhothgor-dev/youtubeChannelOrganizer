"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { loadModules } = require("./helpers/load-modules");

const { YouTubeGroupsIcons: Icons } = loadModules();

test("los ids de ICON_SET y COLOR_SET son únicos y las etiquetas no están vacías", () => {
  const iconIds = Icons.ICON_SET.map((icon) => icon.id);
  assert.equal(new Set(iconIds).size, iconIds.length);
  for (const icon of Icons.ICON_SET) {
    assert.ok(icon.label.length > 0, `etiqueta vacía en ${icon.id}`);
  }
  const colorIds = Icons.COLOR_SET.map((color) => color.id);
  assert.equal(new Set(colorIds).size, colorIds.length);
});

test("toda ruta de ICON_SET es una ruta SVG con cierre", () => {
  for (const icon of Icons.ICON_SET) {
    assert.match(icon.path, /^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]+$/, icon.id);
    assert.match(icon.path, /[zZ]/, `${icon.id} sin cierre`);
  }
});

test("isValidColor acepta vacío y #rrggbb, y rechaza el resto", () => {
  for (const valid of ["", "#2196F3", "#abcdef"]) {
    assert.equal(Icons.isValidColor(valid), true, valid);
  }
  for (const invalid of ["#abc", "2196F3", "#12345g", "red"]) {
    assert.equal(Icons.isValidColor(invalid), false, invalid);
  }
});

test("todos los colores de COLOR_SET son válidos", () => {
  for (const color of Icons.COLOR_SET) {
    assert.equal(Icons.isValidColor(color.hex), true, color.id);
  }
});

test("isValidIconId y getIconPath", () => {
  assert.equal(Icons.isValidIconId(""), true);
  assert.equal(Icons.isValidIconId("tech"), true);
  assert.equal(Icons.isValidIconId("nope"), false);
  assert.equal(Icons.getIconPath("nope"), null);
});
