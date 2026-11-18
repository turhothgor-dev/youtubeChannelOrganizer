"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { loadDom, manifestScripts } = require("./helpers/load-dom");
const { makeGroup, groupsStore } = require("./helpers/youtube-fixtures");

const YT = "https://www.youtube.com";
const V1 = "aaaaaaaaaaa";
const V2 = "bbbbbbbbbbb";
const V3 = "ccccccccccc";
const DAY = 24 * 60 * 60 * 1000;
const TWO_HOURS = 2 * 60 * 60 * 1000;

const GROUPS = [
  makeGroup("A", { channels: [{ name: "Uno", url: `${YT}/@uno` }] }),
];

/** Tarjeta de suscripciones "hace 2 horas" de un canal. */
function cardHtml(videoId, handle) {
  return `
  <ytd-rich-item-renderer>
    <a id="thumbnail" href="/watch?v=${videoId}"><img src="x.jpg"></a>
    <a id="video-title" href="/watch?v=${videoId}">Vídeo</a>
    <ytd-channel-name><a href="/@${handle}">${handle}</a></ytd-channel-name>
    <div id="metadata"><span>hace 2 horas</span></div>
  </ytd-rich-item-renderer>`;
}

/**
 * Carga la página sin `content.js` y crea el recolector con las piezas reales.
 * @param {Object} [options] - html, url, store.
 * @returns {Object} dom y ctx.
 */
function setup({ html = "", url, store = {} } = {}) {
  const scripts = manifestScripts().filter((file) => file !== "content.js");
  const dom = loadDom({
    html,
    url,
    scripts,
    store: { ...groupsStore(GROUPS), ...store },
  });
  const ctx = {
    state: {
      avatars: {},
      watchedVideos: {},
      activeSelection: [],
      newVideoCounts: new Map(),
    },
    avatars: { noteCard() {} },
    dropdowns: {},
  };
  ctx.state.settings = dom.global("YouTubeGroupsSettings").DEFAULT_SETTINGS;
  ctx.newVideos = dom.global("YouTubeGroupsNewVideosUi").create(ctx);
  ctx.watched = dom.global("YouTubeGroupsWatchedUi").create(ctx);
  ctx.cards = dom.global("YouTubeGroupsCards").create(ctx);
  ctx.newVideos.setGroups(GROUPS);
  return { dom, ctx };
}

async function process(dom, ctx) {
  ctx.cards.scanDocument();
  await dom.flush();
  await ctx.newVideos.flushPending();
  await dom.flush();
}

test("guarda solo el vídeo del canal agrupado, con publishedBefore", async () => {
  const { dom, ctx } = setup({
    html: cardHtml(V1, "uno") + cardHtml(V2, "otro"),
  });

  await process(dom, ctx);

  const { videos } = dom.store.youtubeNewVideos;
  assert.deepStrictEqual(Object.keys(videos), [V1]);
  assert.strictEqual(videos[V1].channel, `${YT}/@uno`);
  assert.strictEqual(videos[V1].publishedBefore, videos[V1].seenAt - TWO_HOURS);
});

test("reprocesar la tarjeta no vuelve a escribir y no hay bucle", async () => {
  const { dom, ctx } = setup({ html: cardHtml(V1, "uno") });
  await process(dom, ctx);
  const writes = dom.calls.set;

  await process(dom, ctx);
  await process(dom, ctx);

  assert.strictEqual(dom.calls.set, writes);
});

test("en /feed/channels no se anota nada", async () => {
  const { dom, ctx } = setup({
    url: `${YT}/feed/channels`,
    html: cardHtml(V1, "uno"),
  });

  await process(dom, ctx);

  assert.strictEqual(dom.store.youtubeNewVideos, undefined);
  assert.strictEqual(dom.calls.set, 0);
});

test("cuenta, se pone a 0 al seleccionar y no cuenta lo nuevo con el grupo seleccionado", async () => {
  const { dom, ctx } = setup({
    html: cardHtml(V1, "uno"),
    store: {
      youtubeNewVideos: {
        version: 1,
        since: Date.now() - DAY,
        videos: {},
        visits: {},
      },
    },
  });
  ctx.newVideos.start();
  await dom.flush();

  await process(dom, ctx);
  assert.strictEqual(ctx.state.newVideoCounts.get("A"), 1);

  ctx.state.activeSelection = ["group:A"];
  ctx.state.activeSelectionUrls = new Set([`${YT}/@uno`]);
  ctx.newVideos.acknowledgeSelection(["group:A"]);
  assert.strictEqual(ctx.state.newVideoCounts.size, 0);

  dom.document.body.insertAdjacentHTML("beforeend", cardHtml(V3, "uno"));
  await process(dom, ctx);

  assert.ok(Number.isFinite(dom.store.youtubeNewVideos.visits.A));
  assert.ok(Object.hasOwn(dom.store.youtubeNewVideos.videos, V3));
  assert.strictEqual(ctx.state.newVideoCounts.size, 0);
});
