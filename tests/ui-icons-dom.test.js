"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { loadDom } = require("./helpers/load-dom");
const {
  makeGroup,
  groupsStore,
  flushLoose,
  GUIDE_HTML,
} = require("./helpers/youtube-fixtures");

// Por ahora, a través de la guía; en T5 se prueba el componente directamente.

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
