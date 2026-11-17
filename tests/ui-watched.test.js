"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { loadDom } = require("./helpers/load-dom");
const {
  VIDEO_ID,
  flushLoose,
  SUBSCRIPTION_CARD_HTML,
  WATCH_PAGE_HTML,
} = require("./helpers/youtube-fixtures");

const WATCHED_CLASS = "youtube-groups--watched";

test("Marcar visto guarda el ID y marca la tarjeta", async () => {
  const dom = loadDom({ html: SUBSCRIPTION_CARD_HTML });
  await flushLoose(dom);
  const card = dom.document.querySelector("ytd-rich-item-renderer");
  assert.ok(!card.classList.contains(WATCHED_CLASS));

  card.querySelector(".youtube-groups__watched-button").click();
  await flushLoose(dom);

  assert.ok(Object.hasOwn(dom.store.youtubeWatched.videos, VIDEO_ID));
  assert.ok(card.classList.contains(WATCHED_CLASS));
});

test("con autoMarkPercent 50, un timeupdate pasada la mitad marca el vídeo", async () => {
  const dom = loadDom({
    url: `https://www.youtube.com/watch?v=${VIDEO_ID}`,
    html: WATCH_PAGE_HTML,
    store: {
      youtubeSettings: { version: 1, settings: { autoMarkPercent: 50 } },
    },
  });
  await flushLoose(dom);
  const video = dom.document.querySelector("video");
  // jsdom no implementa la reproducción: se fijan los valores a mano
  Object.defineProperty(video, "currentTime", { value: 60 });
  Object.defineProperty(video, "duration", { value: 100 });

  video.dispatchEvent(new dom.window.Event("timeupdate"));
  await flushLoose(dom);

  assert.ok(Object.hasOwn(dom.store.youtubeWatched.videos, VIDEO_ID));
});

test("sin llegar al porcentaje, un timeupdate no marca el vídeo", async () => {
  const dom = loadDom({
    url: `https://www.youtube.com/watch?v=${VIDEO_ID}`,
    html: WATCH_PAGE_HTML,
    store: {
      youtubeSettings: { version: 1, settings: { autoMarkPercent: 50 } },
    },
  });
  await flushLoose(dom);
  const video = dom.document.querySelector("video");
  Object.defineProperty(video, "currentTime", { value: 10 });
  Object.defineProperty(video, "duration", { value: 100 });

  video.dispatchEvent(new dom.window.Event("timeupdate"));
  await flushLoose(dom);

  assert.strictEqual(dom.store.youtubeWatched, undefined);
});

test("un cambio de watched desde onChanged actualiza la tarjeta", async () => {
  const dom = loadDom({ html: SUBSCRIPTION_CARD_HTML });
  await flushLoose(dom);
  const card = dom.document.querySelector("ytd-rich-item-renderer");
  assert.ok(!card.classList.contains(WATCHED_CLASS));

  // Como si otra pestaña hubiera marcado el vídeo
  await dom.browser.storage.local.set({
    youtubeWatched: { version: 1, videos: { [VIDEO_ID]: { watchedAt: 1 } } },
  });
  await flushLoose(dom);

  assert.ok(card.classList.contains(WATCHED_CLASS));
});
