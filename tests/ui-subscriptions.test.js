"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { loadDom, manifestScripts } = require("./helpers/load-dom");

const GUIDE = `
  <ytd-guide-renderer><div id="sections">
    <ytd-guide-section-renderer id="you">
      <ytd-guide-entry-renderer><a href="/@propio" title="Mi canal"></a></ytd-guide-entry-renderer>
    </ytd-guide-section-renderer>
    <ytd-guide-section-renderer id="subs">
      <ytd-guide-entry-renderer><a href="/feed/channels" title="Todas las suscripciones"></a></ytd-guide-entry-renderer>
      <ytd-guide-entry-renderer><a href="/@uno" title="Uno"></a></ytd-guide-entry-renderer>
      <ytd-guide-entry-renderer><a href="/@dos"><span class="title">Dos</span></a></ytd-guide-entry-renderer>
    </ytd-guide-section-renderer>
    <div id="youtube-groups-guide"><span id="own">x</span></div>
  </div></ytd-guide-renderer>`;

const NO_SUBS_GUIDE = `
  <ytd-guide-renderer><div id="sections">
    <ytd-guide-section-renderer>
      <ytd-guide-entry-renderer><a href="/@propio" title="Mi canal"></a></ytd-guide-entry-renderer>
    </ytd-guide-section-renderer>
  </div></ytd-guide-renderer>`;

/**
 * Carga la página sin `content.js` y crea el recolector con un contexto mínimo.
 * @param {string} html - HTML de la página.
 * @returns {Object} dom y ctx.
 */
function setup(html) {
  const scripts = manifestScripts().filter((file) => file !== "content.js");
  const dom = loadDom({ html, scripts });
  const ctx = { state: { avatars: {} } };
  ctx.cards = dom.global("YouTubeGroupsCards").create({
    ...ctx,
    avatars: { noteCard() {} },
    watched: {},
    dropdowns: {},
  });
  ctx.subscriptions = dom.global("YouTubeGroupsSubscriptionsUi").create(ctx);
  return { dom, ctx };
}

test("lee solo la sección con /feed/channels y guarda los dos canales con nombre", async () => {
  const { dom, ctx } = setup(GUIDE);

  ctx.subscriptions.readGuide();
  await ctx.subscriptions.flushPending();

  const channels = dom.store.youtubeSubscriptions.channels;
  assert.deepStrictEqual(Object.keys(channels).sort(), [
    "https://www.youtube.com/@dos",
    "https://www.youtube.com/@uno",
  ]);
  assert.strictEqual(channels["https://www.youtube.com/@uno"].name, "Uno");
  assert.strictEqual(channels["https://www.youtube.com/@dos"].name, "Dos");
});

test("sin sección con /feed/channels no se escribe", async () => {
  const { dom, ctx } = setup(NO_SUBS_GUIDE);

  ctx.subscriptions.readGuide();
  await ctx.subscriptions.flushPending();

  assert.strictEqual(dom.calls.set, 0);
});

test("una mutación en #youtube-groups-guide no programa lectura; en otra sección sí", () => {
  const { dom, ctx } = setup(GUIDE);
  const own = dom.document.getElementById("own");
  const other = dom.document.getElementById("subs");

  assert.strictEqual(
    ctx.subscriptions.noteMutations([{ target: own, addedNodes: [] }]),
    false,
  );
  assert.strictEqual(
    ctx.subscriptions.noteMutations([{ target: other, addedNodes: [] }]),
    true,
  );
});

test("volver a leer lo mismo no escribe", async () => {
  const { dom, ctx } = setup(GUIDE);

  ctx.subscriptions.readGuide();
  await ctx.subscriptions.flushPending();
  const writes = dom.calls.set;
  assert.strictEqual(writes, 1);

  ctx.subscriptions.readGuide();
  await ctx.subscriptions.flushPending();
  assert.strictEqual(dom.calls.set, writes);
});
