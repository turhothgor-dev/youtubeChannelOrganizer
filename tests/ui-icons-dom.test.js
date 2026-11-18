"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { loadDom, manifestScripts } = require("./helpers/load-dom");
const {
  makeGroup,
  groupsStore,
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

test("setCardButtonContent con los mismos datos no muta el botón", () => {
  const { dom, icons } = loadIconsDom();
  const casos = [
    ["eye", "Marcar visto", true],
    ["+G", "Añadir a grupo", false],
  ];
  for (const [glyph, label, isIcon] of casos) {
    const button = dom.document.createElement("button");
    icons.setCardButtonContent(button, glyph, label, isIcon);

    const observer = new dom.window.MutationObserver(() => {});
    observer.observe(button, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
    icons.setCardButtonContent(button, glyph, label, isIcon);

    assert.strictEqual(observer.takeRecords().length, 0, label);
    observer.disconnect();
  }
});

test("setCardButtonContent cambia el glifo y la etiqueta cuando cambian", () => {
  const { dom, icons } = loadIconsDom();
  const button = dom.document.createElement("button");

  icons.setCardButtonContent(button, "eye", "Marcar visto");
  icons.setCardButtonContent(button, "check", "Visto");

  const glyphEl = button.querySelector(".youtube-groups__card-glyph");
  assert.strictEqual(
    button.querySelector(".youtube-groups__card-label").textContent,
    "Visto",
  );
  assert.strictEqual(button.getAttribute("aria-label"), "Visto");
  assert.strictEqual(glyphEl.querySelectorAll("svg").length, 1);
  assert.strictEqual(
    glyphEl.getAttribute("data-youtube-groups-glyph"),
    "icon:check",
  );

  // Con glyph null se conserva el glifo anterior
  icons.setCardButtonContent(button, null, "Guardando");
  assert.strictEqual(glyphEl.querySelectorAll("svg").length, 1);
  assert.strictEqual(
    glyphEl.getAttribute("data-youtube-groups-glyph"),
    "icon:check",
  );
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

test("createChannelAvatar con URL válida pinta el img y la inicial debajo", () => {
  const { icons } = loadIconsDom();
  const src = "https://yt3.ggpht.com/ytc/AbC=s88-c-k-c0x00ffffff-no-rj";

  const avatar = icons.createChannelAvatar("Álvaro", src, 20);

  assert.strictEqual(avatar.getAttribute("aria-hidden"), "true");
  assert.strictEqual(avatar.className, "youtube-groups__avatar");
  assert.strictEqual(avatar.style.width, "20px");
  assert.strictEqual(avatar.style.height, "20px");
  assert.ok(avatar.style.getPropertyValue("--yg-avatar-bg"));
  const initial = avatar.querySelector(".youtube-groups__avatar-initial");
  assert.strictEqual(initial.textContent, "Á");
  const img = avatar.querySelector("img.youtube-groups__avatar-img");
  assert.ok(img);
  assert.strictEqual(img.getAttribute("alt"), "");
  assert.strictEqual(img.getAttribute("loading"), "lazy");
  assert.strictEqual(img.getAttribute("referrerpolicy"), "no-referrer");
  assert.strictEqual(img.getAttribute("width"), "20");
  assert.strictEqual(img.getAttribute("height"), "20");
  assert.strictEqual(img.getAttribute("src"), src);
  assert.ok(initial.compareDocumentPosition(img) & 4, "el img va después");
});

test("createChannelAvatar sin URL o con URL no permitida solo pinta la inicial", () => {
  const { icons } = loadIconsDom();

  for (const src of [null, "https://evil.com/a.png"]) {
    const avatar = icons.createChannelAvatar("Foo", src, 20);
    assert.strictEqual(avatar.querySelector("img"), null);
    assert.strictEqual(
      avatar.querySelector(".youtube-groups__avatar-initial").textContent,
      "F",
    );
    assert.ok(avatar.style.getPropertyValue("--yg-avatar-bg"));
  }
});

test("createChannelAvatar quita el img si falla la carga", () => {
  const { dom, icons } = loadIconsDom();
  const avatar = icons.createChannelAvatar(
    "Foo",
    "https://yt3.ggpht.com/a=s88-c-k-c0x00ffffff-no-rj",
    24,
  );

  avatar.querySelector("img").dispatchEvent(new dom.window.Event("error"));

  assert.strictEqual(avatar.querySelector("img"), null);
  assert.ok(avatar.querySelector(".youtube-groups__avatar-initial"));
});

test("createChannelAvatar pinta el nombre como texto", () => {
  const { icons } = loadIconsDom();

  const avatar = icons.createChannelAvatar("<b>x</b>", null, 20);

  assert.strictEqual(avatar.querySelector("b"), null);
  assert.strictEqual(
    avatar.querySelector(".youtube-groups__avatar-initial").textContent,
    "<",
  );
});

// A través de la guía.

test("GROUP_ICON_SIZES vale exactamente los tamaños acordados", () => {
  const { icons } = loadIconsDom();

  assert.deepStrictEqual(JSON.parse(JSON.stringify(icons.GROUP_ICON_SIZES)), {
    guide: 24,
    choice: 15,
    pickerGrid: 20,
    pickerPreview: 24,
    formPreview: 18,
  });
});

test("la marca de un grupo con icono es un .youtube-groups__icon con un svg de 24 px", async () => {
  const dom = loadDom({
    html: GUIDE_HTML,
    store: groupsStore([makeGroup("A"), { ...makeGroup("B"), icon: "tech" }]),
  });
  await dom.flush();

  const rows = dom.document.querySelectorAll(".youtube-groups__guide-row");
  assert.strictEqual(rows[0].querySelector(".youtube-groups__icon"), null);
  const svg = rows[1].querySelector(".youtube-groups__icon > svg");
  assert.ok(svg);
  assert.strictEqual(svg.getAttribute("width"), "24");
  assert.strictEqual(svg.getAttribute("height"), "24");
});

test("el botón del grupo con color tiene la banda y --yg-group-color", async () => {
  const dom = loadDom({
    html: GUIDE_HTML,
    store: groupsStore([
      makeGroup("A"),
      { ...makeGroup("B"), color: "#2196F3" },
    ]),
  });
  await dom.flush();

  const buttons = dom.document.querySelectorAll(
    ".youtube-groups__guide-row .youtube-groups__guide-item",
  );
  assert.strictEqual(
    buttons[0].classList.contains("youtube-groups__group-band"),
    false,
  );
  assert.strictEqual(
    buttons[1].classList.contains("youtube-groups__group-band"),
    true,
  );
  assert.strictEqual(
    buttons[1].style.getPropertyValue("--yg-group-color"),
    "#2196F3",
  );
});
