"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { loadDom } = require("./helpers/load-dom");

const PANEL = "#youtube-groups-panel";

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
