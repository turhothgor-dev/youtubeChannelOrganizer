"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { loadDom, manifestScripts } = require("./helpers/load-dom");
const {
  CHANNEL_URL,
  makeGroup,
  groupsStore,
} = require("./helpers/youtube-fixtures");

const PANEL = "#youtube-groups-panel";

test("YouTubeGroupsPanel.create no toca el DOM", () => {
  const scripts = manifestScripts().filter((file) => file !== "content.js");
  const dom = loadDom({ scripts });
  const before = dom.document.body.innerHTML;

  const Panel = dom.global("YouTubeGroupsPanel");
  assert.strictEqual(typeof Panel.create, "function");
  const panel = Panel.create({ state: {} });

  assert.strictEqual(dom.document.body.innerHTML, before);
  assert.strictEqual(typeof panel.createGroupsPanel, "function");
  assert.strictEqual(typeof panel.renderCurrentVideoSection, "function");
  assert.strictEqual(
    typeof panel.scheduleCurrentChannelPanelUpdate,
    "function",
  );
});

test("Analizar en Limpieza lista un canal repetido", async () => {
  const store = groupsStore([
    makeGroup("A", {
      channels: [
        { name: "Canal", url: CHANNEL_URL },
        { name: "Canal", url: CHANNEL_URL },
      ],
    }),
  ]);
  const dom = loadDom({ store });
  await dom.flush();
  const panel = dom.document.querySelector(PANEL);
  panel.querySelector(".youtube-groups__cleanup-analyze").click();
  await dom.flush();

  assert.strictEqual(
    panel.querySelector(".youtube-groups__cleanup-result").hidden,
    false,
  );
  assert.match(
    panel.querySelector(".youtube-groups__cleanup-report").textContent,
    /Canales repetidos: 1/,
  );
});

test("cambiar Duración en Filtros pone Filtros (1)", async () => {
  const dom = loadDom();
  await dom.flush();
  const panel = dom.document.querySelector(PANEL);
  const select = panel.querySelector('[data-filter="duration"]');
  select.value = "short";
  select.dispatchEvent(new dom.window.Event("change"));

  assert.strictEqual(
    panel.querySelector(".youtube-groups__filters summary").textContent,
    "Filtros (1)",
  );
});

test("el panel se crea una vez, minimizado, y no se duplica al navegar", async () => {
  const dom = loadDom();
  await dom.flush();
  assert.strictEqual(dom.document.querySelectorAll(PANEL).length, 1);
  assert.ok(
    dom.document
      .querySelector(PANEL)
      .classList.contains("youtube-groups--collapsed"),
  );

  dom.document.dispatchEvent(new dom.window.Event("yt-navigate-finish"));
  await dom.flush();
  assert.strictEqual(dom.document.querySelectorAll(PANEL).length, 1);
});

test("minimizar el panel guarda panelCollapsed y quita la clase", async () => {
  const dom = loadDom();
  await dom.flush();
  const panel = dom.document.querySelector(PANEL);
  panel.querySelector(".youtube-groups__collapse-button").click();
  await dom.flush();

  assert.strictEqual(dom.store.youtubeSettings.settings.panelCollapsed, false);
  assert.ok(!panel.classList.contains("youtube-groups--collapsed"));
});
