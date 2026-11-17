"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { loadModules } = require("./helpers/load-modules");

const { YouTubeGroupsIcons: Icons, YouTubeGroupsFxemoji: Fxemoji } =
  loadModules();

test("los ids de ICON_SET y COLOR_SET son únicos y las etiquetas no están vacías", () => {
  const iconIds = Icons.ICON_SET.map((icon) => icon.id);
  assert.equal(new Set(iconIds).size, iconIds.length);
  for (const icon of Icons.ICON_SET) {
    assert.ok(icon.label.length > 0, `etiqueta vacía en ${icon.id}`);
  }
  const colorIds = Icons.COLOR_SET.map((color) => color.id);
  assert.equal(new Set(colorIds).size, colorIds.length);
});

test("todo id de ICON_SET tiene gráfico", () => {
  for (const icon of Icons.ICON_SET) {
    const graphic = Icons.getIconGraphic(icon.id);
    assert.ok(graphic, `${icon.id} sin gráfico`);
    assert.ok(graphic.viewBox.length > 0, `${icon.id} sin viewBox`);
    assert.ok(graphic.shapes.length > 0, `${icon.id} sin formas`);
  }
});

test("el codepoint de cada entrada de ICON_SET coincide con el de YouTubeGroupsFxemoji.ICONS", () => {
  for (const icon of Icons.ICON_SET) {
    const data = Fxemoji.ICONS[icon.id];
    assert.ok(data, `${icon.id} sin datos de fxemoji`);
    assert.equal(icon.codepoint, data.codepoint, icon.id);
  }
});

test("los ids guardados por la versión anterior siguen siendo válidos", () => {
  const storedIds = [
    "tech",
    "music",
    "news",
    "gaming",
    "sports",
    "education",
    "food",
    "travel",
    "art",
    "science",
    "movie",
    "default",
  ];
  for (const id of storedIds) {
    assert.equal(Icons.isValidIconId(id), true, id);
    assert.notEqual(Icons.getIconGraphic(id), null, id);
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

test("isValidIconId y getIconGraphic", () => {
  assert.equal(Icons.isValidIconId(""), true);
  assert.equal(Icons.isValidIconId("tech"), true);
  assert.equal(Icons.isValidIconId("nope"), false);
  assert.equal(Icons.getIconGraphic("nope"), null);
});

test("getUiIconPath devuelve rutas de interfaz sin mezclarlas con ICON_SET", () => {
  const ids = [
    "eye",
    "check",
    "playlist-add",
    "settings",
    "recycle",
    "add",
    "edit",
    "arrow-up",
    "arrow-down",
    "palette",
    "delete",
    "swap",
  ];
  for (const id of ids) {
    const path = Icons.getUiIconPath(id);
    assert.equal(typeof path, "string", id);
    assert.ok(path.length > 0, id);
    assert.match(path, /^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]+$/, id);
    assert.equal(Icons.isValidIconId(id), false, id);
    assert.equal(Icons.getIconGraphic(id), null, id);
  }
  assert.equal(Icons.getUiIconPath("x"), null);
  assert.equal(Icons.ICON_SET.length, 12);
});
