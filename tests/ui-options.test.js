"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { loadOptionsDom } = require("./helpers/load-dom");
const { makeGroup, groupsStore } = require("./helpers/youtube-fixtures");

test("el editor pinta el árbol de grupos y el resumen", async () => {
  const store = groupsStore([
    makeGroup("a", { name: "A", subgroups: [makeGroup("a1", { name: "A1" })] }),
    makeGroup("b", { name: "B" }),
  ]);
  const dom = loadOptionsDom({ store });
  await dom.flush();

  const rows = [...dom.document.querySelectorAll('[role="treeitem"]')];
  assert.strictEqual(rows.length, 3);
  assert.deepStrictEqual(
    rows.map((row) => row.querySelector(".options__name").textContent),
    ["A", "A1", "B"],
  );
  assert.strictEqual(
    dom.document.getElementById("options-summary").textContent,
    "3 grupos",
  );
});

/**
 * Carga el editor con A (subgrupo A1) y B.
 * @returns {Promise<Object>} DOM cargado.
 */
async function loadEditor() {
  const store = groupsStore([
    makeGroup("a", { name: "A", subgroups: [makeGroup("a1", { name: "A1" })] }),
    makeGroup("b", { name: "B" }),
  ]);
  const dom = loadOptionsDom({ store });
  await dom.flush();
  return dom;
}

/**
 * Devuelve la fila del árbol con ese nombre.
 * @param {Object} dom - DOM cargado.
 * @param {string} name - Nombre del grupo.
 * @returns {Element} Fila.
 */
function rowOf(dom, name) {
  return [...dom.document.querySelectorAll('[role="treeitem"]')].find(
    (row) => row.querySelector(".options__name").textContent === name,
  );
}

test("las acciones de fila son solo icono y siguen el orden previsto", async () => {
  const dom = await loadEditor();
  const buttons = [
    ...rowOf(dom, "A").querySelectorAll(".options__actions button"),
  ];
  assert.deepStrictEqual(
    buttons.map((b) => b.getAttribute("aria-label")),
    [
      "Subir",
      "Bajar",
      "Renombrar",
      "Icono y color",
      "Eliminar",
      "Mover a…",
      "Añadir subgrupo",
    ],
  );
  for (const button of buttons) {
    assert.strictEqual(button.title, button.getAttribute("aria-label"));
    assert.ok(button.querySelector("svg"));
    assert.strictEqual(button.textContent, "");
  }
  assert.strictEqual(buttons[0].disabled, true);
});

test("Bajar mueve A tras B", async () => {
  const dom = await loadEditor();
  rowOf(dom, "A").querySelector('[aria-label="Bajar"]').click();
  // La escritura notifica a onChanged en un turno posterior.
  await dom.flush();
  await dom.flush();
  const names = [...dom.document.querySelectorAll(".options__name")].map(
    (n) => n.textContent,
  );
  assert.deepStrictEqual(names, ["B", "A", "A1"]);
});

test("Renombrar abre el campo con el nombre", async () => {
  const dom = await loadEditor();
  rowOf(dom, "A").querySelector('[aria-label="Renombrar"]').click();
  await dom.flush();
  const input = dom.document.querySelector(".options__editor input");
  assert.strictEqual(input.value, "A");
});

test("Añadir subgrupo abre un campo de creación dentro de A", async () => {
  const dom = await loadEditor();
  rowOf(dom, "A").querySelector('[aria-label="Añadir subgrupo"]').click();
  await dom.flush();
  const input = dom.document.querySelector(".options__editor input");
  assert.ok(input);
  assert.strictEqual(input.value, "");
  assert.ok(rowOf(dom, "A").parentElement.contains(input));
});

test("Eliminar quita A y muestra el aviso con Deshacer", async () => {
  const dom = await loadEditor();
  rowOf(dom, "A").querySelector('[aria-label="Eliminar"]').click();
  await dom.flush();
  await dom.flush();
  assert.strictEqual(rowOf(dom, "A"), undefined);
  const notice = dom.document.querySelector(".options__notice");
  assert.ok(notice.textContent.includes("Deshacer"));
});

test("con búsqueda no hay Subir, Bajar ni Mover a…", async () => {
  const dom = await loadEditor();
  const search = dom.document.getElementById("options-search");
  search.value = "a1";
  search.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  await dom.flush();
  const labels = [
    ...rowOf(dom, "A1").querySelectorAll(".options__actions button"),
  ].map((b) => b.getAttribute("aria-label"));
  assert.deepStrictEqual(labels, [
    "Renombrar",
    "Icono y color",
    "Eliminar",
    "Añadir subgrupo",
  ]);
});

test("F2 sobre la fila abre renombrar", async () => {
  const dom = await loadEditor();
  rowOf(dom, "A").dispatchEvent(
    new dom.window.KeyboardEvent("keydown", { key: "F2", bubbles: true }),
  );
  await dom.flush();
  assert.ok(dom.document.querySelector(".options__editor input"));
});

test("sin grupo seleccionado el panel de canales invita a elegir grupo o subgrupo, y el selector de copiar conserva su texto", async () => {
  const store = groupsStore([
    makeGroup("a", {
      name: "A",
      channels: [{ name: "Canal", url: "https://www.youtube.com/@canal" }],
    }),
    makeGroup("b", { name: "B" }),
  ]);
  const dom = loadOptionsDom({ store });
  await dom.flush();
  const panel = dom.document.getElementById("options-channels");
  assert.strictEqual(
    panel.textContent,
    "Elige un grupo o subgrupo para ver sus canales",
  );

  rowOf(dom, "A").querySelector(".options__name").click();
  await dom.flush();
  panel.querySelector("input[data-url]").click();
  await dom.flush();
  [...panel.querySelectorAll("button")]
    .find((b) => b.textContent === "Copiar a…")
    .click();
  await dom.flush();
  const select = panel.querySelector(".options__transfer-select");
  assert.strictEqual(select.options[0].textContent, "Elige un grupo");
});

const YT = "https://www.youtube.com";

/**
 * Crea el valor de `youtubeSubscriptions` a partir de [handle, nombre, firstSeen].
 * @param {Array<Array>} entries - Suscripciones.
 * @returns {Object} Valor guardado.
 */
function subscriptionsValue(entries) {
  const channels = {};
  for (const [handle, name, firstSeen] of entries) {
    channels[`${YT}/@${handle}`] = {
      name,
      url: `${YT}/@${handle}`,
      firstSeen,
    };
  }
  return { version: 1, channels };
}

/**
 * Carga el editor con A (subgrupo A1 con "uno") y tres suscripciones.
 * @param {Object} [extra] - Claves extra del almacenamiento.
 * @returns {Promise<Object>} DOM cargado.
 */
async function loadWithSubscriptions(extra = {}) {
  const store = groupsStore([
    makeGroup("a", {
      name: "A",
      subgroups: [
        makeGroup("a1", {
          name: "A1",
          channels: [{ name: "Uno", url: `${YT}/@uno` }],
        }),
      ],
    }),
  ]);
  store.youtubeSubscriptions = subscriptionsValue([
    ["uno", "Uno", 100],
    ["dos", "Dos", 200],
    ["tres", "Tres", 300],
  ]);
  Object.assign(store, extra);
  const dom = loadOptionsDom({ store });
  await dom.flush();
  return dom;
}

test("la bandeja lista las suscripciones sin grupo, las más recientes primero", async () => {
  const dom = await loadWithSubscriptions();
  const section = dom.document.getElementById("options-unclassified");
  assert.strictEqual(
    section.querySelector("h2").textContent,
    "Suscripciones sin grupo (2)",
  );
  const links = [...section.querySelectorAll("a")];
  assert.deepStrictEqual(
    links.map((a) => a.textContent),
    ["Tres", "Dos"],
  );
  assert.strictEqual(links[0].getAttribute("target"), "_blank");
  assert.strictEqual(
    section.querySelectorAll(".youtube-groups__avatar-initial").length,
    2,
  );
});

test("la bandeja explica los casos vacíos", async () => {
  const none = loadOptionsDom({ store: groupsStore([]) });
  await none.flush();
  assert.ok(
    none.document
      .getElementById("options-unclassified")
      .textContent.includes("Aún no se conoce ninguna suscripción."),
  );

  const store = groupsStore([
    makeGroup("a", {
      name: "A",
      channels: [{ name: "Uno", url: `${YT}/@uno` }],
    }),
  ]);
  store.youtubeSubscriptions = subscriptionsValue([["uno", "Uno", 1]]);
  const all = loadOptionsDom({ store });
  await all.flush();
  assert.ok(
    all.document
      .getElementById("options-unclassified")
      .textContent.includes(
        "Todas las suscripciones conocidas están en algún grupo.",
      ),
  );
});

test("el buscador filtra la bandeja y sin coincidencias lo dice", async () => {
  const dom = await loadWithSubscriptions();
  const section = dom.document.getElementById("options-unclassified");
  const search = dom.document.getElementById("options-search");
  search.value = "dos";
  search.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  await dom.flush();
  assert.deepStrictEqual(
    [...section.querySelectorAll("a")].map((a) => a.textContent),
    ["Dos"],
  );
  search.value = "zzz";
  search.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  await dom.flush();
  assert.ok(
    section.textContent.includes(
      "Ninguna suscripción sin grupo coincide con la búsqueda.",
    ),
  );
});

test("un cambio de youtubeSubscriptions añade la suscripción sin recargar", async () => {
  const dom = await loadWithSubscriptions();
  const value = subscriptionsValue([
    ["uno", "Uno", 100],
    ["dos", "Dos", 200],
    ["tres", "Tres", 300],
    ["cuatro", "Cuatro", 400],
  ]);
  await dom.browser.storage.local.set({ youtubeSubscriptions: value });
  await dom.flush();
  const section = dom.document.getElementById("options-unclassified");
  assert.strictEqual(
    section.querySelector("h2").textContent,
    "Suscripciones sin grupo (3)",
  );
  assert.strictEqual(section.querySelector("a").textContent, "Cuatro");
});

test("el nombre del grupo lleva el nombre completo en el title", async () => {
  const longName = "Ciencia y tecnología divulgativa";
  const store = groupsStore([makeGroup("c", { name: longName })]);
  const dom = loadOptionsDom({ store });
  await dom.flush();
  const name = dom.document.querySelector(".options__name");
  assert.strictEqual(name.getAttribute("title"), longName);
});
