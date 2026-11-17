"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { loadDom, manifestScripts } = require("./helpers/load-dom");
const { VIDEO_ID, WATCH_PAGE_HTML } = require("./helpers/youtube-fixtures");

const PLAYER_CONTROL = ".youtube-groups__player-actions";

/**
 * Carga /watch con el vídeo pausado (el valor por defecto de jsdom).
 * @returns {Promise<Object>} El resultado de loadDom, ya estabilizado.
 */
async function loadWatch() {
  const dom = loadDom({
    url: `https://www.youtube.com/watch?v=${VIDEO_ID}`,
    html: WATCH_PAGE_HTML,
  });
  // jsdom no tiene `document.fullscreenElement` (undefined, no null): sin
  // pantalla completa; `fullscreenchange` recalcula el control.
  Object.defineProperty(dom.document, "fullscreenElement", { value: null });
  dom.document.dispatchEvent(new dom.window.Event("fullscreenchange"));
  await dom.flush();
  return dom;
}

test("con el vídeo pausado hay un único control visible dentro del reproductor", async () => {
  const dom = await loadWatch();
  const player = dom.document.querySelector("#movie_player");

  const controls = dom.document.querySelectorAll(PLAYER_CONTROL);
  assert.strictEqual(controls.length, 1);
  assert.strictEqual(controls[0].parentElement, player);
  assert.strictEqual(controls[0].hidden, false);
});

test("un play oculta el control", async () => {
  const dom = await loadWatch();
  const video = dom.document.querySelector("video");
  // jsdom no implementa la reproducción: se fija `paused` a mano
  Object.defineProperty(video, "paused", { value: false });

  video.dispatchEvent(new dom.window.Event("play"));
  await dom.flush();

  assert.strictEqual(dom.document.querySelectorAll(PLAYER_CONTROL).length, 1);
  assert.strictEqual(dom.document.querySelector(PLAYER_CONTROL).hidden, true);
});

test("YouTubeGroupsPlayer.create es una función y crearlo no toca el DOM", () => {
  const scripts = manifestScripts().filter((file) => file !== "content.js");
  const dom = loadDom({
    url: `https://www.youtube.com/watch?v=${VIDEO_ID}`,
    html: WATCH_PAGE_HTML,
    scripts,
  });
  const before = dom.document.body.innerHTML;
  const Player = dom.global("YouTubeGroupsPlayer");

  assert.strictEqual(typeof Player.create, "function");
  const player = Player.create({ state: {} });

  assert.strictEqual(dom.document.body.innerHTML, before);
  assert.strictEqual(typeof player.start, "function");
  assert.strictEqual(typeof player.noteMutations, "function");
});

test("yt-navigate-start oculta el control", async () => {
  const dom = await loadWatch();
  assert.strictEqual(dom.document.querySelector(PLAYER_CONTROL).hidden, false);

  dom.document.dispatchEvent(new dom.window.Event("yt-navigate-start"));

  assert.strictEqual(dom.document.querySelector(PLAYER_CONTROL).hidden, true);
});
