"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { loadDom, manifestScripts } = require("./helpers/load-dom");
const {
  makeGroup,
  groupsStore,
  flushLoose,
  GUIDE_HTML,
} = require("./helpers/youtube-fixtures");

/** Carga los scripts del manifiesto sin content.js y devuelve el componente. */
function loadIconsDom() {
  const scripts = manifestScripts().filter((file) => file !== "content.js");
  const dom = loadDom({ scripts });
  return { dom, icons: dom.global("YouTubeGroupsIconsDom") };
}

test("createIconSvg da un svg con viewBox y el tamaño pedido, y null si el id no existe", () => {
  const { icons } = loadIconsDom();

  const svg = icons.createIconSvg("tech", 30);
  assert.ok(svg);
  assert.ok(svg.getAttribute("viewBox"));
  assert.strictEqual(svg.getAttribute("width"), "30");
  assert.strictEqual(svg.getAttribute("height"), "30");
  assert.strictEqual(icons.createIconSvg("no-existe", 30), null);
});

test("setGroupBand pone y quita la clase y la variable", () => {
  const { dom, icons } = loadIconsDom();
  const element = dom.document.createElement("div");

  icons.setGroupBand(element, "#2196F3");
  assert.ok(element.classList.contains("youtube-groups__group-band"));
  assert.strictEqual(
    element.style.getPropertyValue("--yg-group-color"),
    "#2196F3",
  );

  icons.setGroupBand(element, null);
  assert.strictEqual(
    element.classList.contains("youtube-groups__group-band"),
    false,
  );
  assert.strictEqual(element.style.getPropertyValue("--yg-group-color"), "");
});

test("setCardButtonContent dos veces no duplica glifo ni etiqueta", () => {
  const { dom, icons } = loadIconsDom();
  const button = dom.document.createElement("button");

  icons.setCardButtonContent(button, "+G", "Añadir a grupo", false);
  icons.setCardButtonContent(button, "+G", "Añadir a grupo", false);

  assert.strictEqual(
    button.querySelectorAll(".youtube-groups__card-glyph").length,
    1,
  );
  assert.strictEqual(
    button.querySelectorAll(".youtube-groups__card-label").length,
    1,
  );
  assert.strictEqual(button.getAttribute("aria-label"), "Añadir a grupo");
});

test("shieldControlEvents impide que un click llegue al padre", () => {
  const { dom, icons } = loadIconsDom();
  const parent = dom.document.createElement("div");
  const control = dom.document.createElement("button");
  parent.append(control);
  dom.document.body.append(parent);
  let reached = false;
  parent.addEventListener("click", () => {
    reached = true;
  });

  icons.shieldControlEvents(control);
  control.dispatchEvent(
    new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }),
  );

  assert.strictEqual(reached, false);
});

// A través de la guía.

test("la marca de un grupo con icono es un .youtube-groups__icon con un svg de 27 px", async () => {
  const dom = loadDom({
    html: GUIDE_HTML,
    store: groupsStore([makeGroup("A"), { ...makeGroup("B"), icon: "tech" }]),
  });
  await flushLoose(dom);

  const rows = dom.document.querySelectorAll(".youtube-groups__guide-row");
  assert.strictEqual(rows[0].querySelector(".youtube-groups__icon"), null);
  const svg = rows[1].querySelector(".youtube-groups__icon > svg");
  assert.ok(svg);
  assert.strictEqual(svg.getAttribute("width"), "27");
  assert.strictEqual(svg.getAttribute("height"), "27");
});

test("la fila con color tiene la banda y --yg-group-color", async () => {
  const dom = loadDom({
    html: GUIDE_HTML,
    store: groupsStore([
      makeGroup("A"),
      { ...makeGroup("B"), color: "#2196F3" },
    ]),
  });
  await flushLoose(dom);

  const rows = dom.document.querySelectorAll(".youtube-groups__guide-row");
  assert.strictEqual(
    rows[0].classList.contains("youtube-groups__group-band"),
    false,
  );
  assert.strictEqual(
    rows[1].classList.contains("youtube-groups__group-band"),
    true,
  );
  assert.strictEqual(
    rows[1].style.getPropertyValue("--yg-group-color"),
    "#2196F3",
  );
});
