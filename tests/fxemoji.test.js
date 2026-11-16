"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadModules, plain } = require("./helpers/load-modules");
const {
  parseSvgShapes,
  ALLOWED_TAGS,
  ALLOWED_ATTRS,
} = require("./helpers/svg-shapes");

const { YouTubeGroupsFxemoji: Fxemoji } = loadModules();
const SVG_DIR = path.resolve(__dirname, "..", "third_party", "fxemoji");

// Ids de icono de grupo (decisión 2 del plan, con los cambios aprobados).
const EXPECTED_IDS = [
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

test("parseSvgShapes aplana <g>, ignora prólogo y comentarios y normaliza espacios", () => {
  const svg = `<?xml version="1.0"?>
<!-- comentario -->
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg viewBox="0 0 512 512"><g id="a"><path fill="#112233" d="M0,0
	l1,1z"/></g><circle fill="none" cx="1" cy="2" r="3"/></svg>`;
  assert.deepEqual(parseSvgShapes(svg), {
    viewBox: "0 0 512 512",
    shapes: [
      { tag: "path", attrs: { fill: "#112233", d: "M0,0 l1,1z" } },
      { tag: "circle", attrs: { fill: "none", cx: "1", cy: "2", r: "3" } },
    ],
  });
});

test("parseSvgShapes falla con etiquetas o atributos fuera de la lista blanca", () => {
  const wrap = (body) => `<svg viewBox="0 0 1 1">${body}</svg>`;
  for (const body of [
    "<style>.a{}</style>",
    '<text x="1">a</text>',
    '<use xlink:href="#a"/>',
    '<linearGradient id="g"/>',
    '<path d="M0,0z" transform="scale(2)"/>',
    '<path d="M0,0z" class="a"/>',
    '<g transform="scale(2)"><path d="M0,0z"/></g>',
  ]) {
    assert.throws(() => parseSvgShapes(wrap(body)), body);
  }
  assert.throws(() => parseSvgShapes('<path d="M0,0z"/>'), /viewBox/);
});

test("hay una entrada de fxemoji por cada id de icono de grupo", () => {
  assert.deepEqual(Object.keys(Fxemoji.ICONS).sort(), [...EXPECTED_IDS].sort());
});

test("cada entrada coincide en viewBox y formas con su SVG de third_party/fxemoji", () => {
  for (const [id, icon] of Object.entries(Fxemoji.ICONS)) {
    assert.ok(
      icon.file.startsWith(`u${icon.codepoint}-`),
      `${id}: el fichero no corresponde al codepoint`,
    );
    const expected = parseSvgShapes(
      fs.readFileSync(path.join(SVG_DIR, icon.file), "utf8"),
    );
    assert.equal(icon.viewBox, expected.viewBox, `${id}: viewBox`);
    assert.deepEqual(plain(icon.shapes), expected.shapes, `${id}: formas`);
  }
});

test("las formas usan solo etiquetas y atributos de la lista blanca, con fill #rrggbb o none", () => {
  for (const [id, icon] of Object.entries(Fxemoji.ICONS)) {
    assert.ok(icon.shapes.length > 0, `${id}: sin formas`);
    for (const shape of icon.shapes) {
      assert.ok(ALLOWED_TAGS.has(shape.tag), `${id}: etiqueta ${shape.tag}`);
      for (const name of Object.keys(shape.attrs)) {
        assert.ok(ALLOWED_ATTRS.has(name), `${id}: atributo ${name}`);
      }
      assert.match(shape.attrs.fill, /^(#[0-9A-Fa-f]{6}|none)$/, `${id}: fill`);
    }
  }
});

test("ICONS está congelado en profundidad", () => {
  assert.ok(Object.isFrozen(Fxemoji.ICONS));
  assert.ok(Object.isFrozen(Fxemoji.ICONS.tech));
  assert.ok(Object.isFrozen(Fxemoji.ICONS.tech.shapes[0].attrs));
});
