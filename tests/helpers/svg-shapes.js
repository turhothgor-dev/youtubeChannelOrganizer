"use strict";

const ALLOWED_TAGS = new Set([
  "path",
  "circle",
  "ellipse",
  "rect",
  "polygon",
  "polyline",
]);

const ALLOWED_ATTRS = new Set([
  "d",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "x",
  "y",
  "width",
  "height",
  "points",
  "fill",
  "fill-rule",
  "opacity",
]);

/**
 * Extrae el viewBox y las formas de un SVG de fxemoji.
 * Ignora prólogo XML, DOCTYPE y comentarios, y aplana los <g> (solo admiten `id`).
 * Falla con cualquier etiqueta o atributo fuera de la lista blanca.
 * Los espacios en blanco de los valores se normalizan a un solo espacio.
 * @param {string} text - Contenido del fichero SVG
 * @returns {{ viewBox: string, shapes: Array<{ tag: string, attrs: Object<string, string> }> }}
 */
function parseSvgShapes(text) {
  const clean = text
    .replace(/<\?[\s\S]*?\?>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!DOCTYPE[^>]*>/gi, "");

  let viewBox = null;
  const shapes = [];
  const tagPattern = /<(\/?)([a-zA-Z][\w:-]*)([^>]*?)(\/?)>/g;
  let match;
  while ((match = tagPattern.exec(clean)) !== null) {
    const [, closing, tag, rawAttrs] = match;
    const attrs = {};
    const attrPattern = /([\w:-]+)\s*=\s*"([^"]*)"/g;
    let attr;
    while ((attr = attrPattern.exec(rawAttrs)) !== null) {
      attrs[attr[1]] = attr[2].trim().replace(/\s+/g, " ");
    }

    if (tag === "svg") {
      if (!closing) viewBox = attrs.viewBox ?? null;
    } else if (tag === "g") {
      for (const name of Object.keys(attrs)) {
        if (name !== "id") throw new Error(`atributo <g ${name}> no admitido`);
      }
    } else if (ALLOWED_TAGS.has(tag)) {
      if (closing) continue;
      for (const name of Object.keys(attrs)) {
        if (!ALLOWED_ATTRS.has(name)) {
          throw new Error(`atributo ${name} no admitido en <${tag}>`);
        }
      }
      shapes.push({ tag, attrs });
    } else {
      throw new Error(`etiqueta <${tag}> no admitida`);
    }
  }

  if (viewBox === null) throw new Error("el SVG no tiene viewBox");
  return { viewBox, shapes };
}

module.exports = { parseSvgShapes, ALLOWED_TAGS, ALLOWED_ATTRS };
