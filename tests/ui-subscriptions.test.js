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

const CHANNELS_URL = "https://www.youtube.com/feed/channels";
const YT = "https://www.youtube.com";

/**
 * Renderer de canal de /feed/channels.
 * @param {string} handle - Handle sin arroba; vacío = sin enlace.
 * @param {string} name - Nombre visible.
 * @returns {string} HTML.
 */
function renderer(handle, name) {
  const link = handle ? `<a href="/@${handle}"></a>` : "";
  return `<ytd-channel-renderer>${link}<ytd-channel-name><div id="text">${name}</div></ytd-channel-name></ytd-channel-renderer>`;
}

const CONTINUATION =
  "<ytd-continuation-item-renderer></ytd-continuation-item-renderer>";

/**
 * Prepara la página de canales con un reloj falso.
 * @param {string} body - HTML dentro de `ytd-browse`.
 * @param {Object} [options] - `url` y `store`.
 * @returns {Object} dom, ctx y el reloj (`advance`).
 */
function setupChannels(body, { url = CHANNELS_URL, store } = {}) {
  const scripts = manifestScripts().filter((file) => file !== "content.js");
  const dom = loadDom({
    url,
    html: `<ytd-browse>${body}</ytd-browse>`,
    scripts,
    store,
  });
  const timers = [];
  let now = 0;
  let nextId = 1;
  dom.window.setTimeout = (fn, delay) => {
    const id = nextId++;
    timers.push({ id, fn, at: now + delay });
    return id;
  };
  dom.window.clearTimeout = (id) => {
    const index = timers.findIndex((timer) => timer.id === id);
    if (index !== -1) {
      timers.splice(index, 1);
    }
  };
  const ctx = { state: { avatars: {} } };
  ctx.avatars = { noteCard() {} };
  ctx.watched = {};
  ctx.dropdowns = {};
  ctx.cards = dom.global("YouTubeGroupsCards").create(ctx);
  ctx.subscriptions = dom.global("YouTubeGroupsSubscriptionsUi").create(ctx);
  const clock = {
    advance(ms) {
      now += ms;
      for (const timer of timers.filter((item) => item.at <= now)) {
        timers.splice(timers.indexOf(timer), 1);
        timer.fn();
      }
    },
  };
  return { dom, ctx, clock };
}

/**
 * Procesa las tarjetas pendientes y la comprobación de la lista.
 * @param {Object} dom - Resultado de `loadDom`.
 * @param {Object} ctx - Contexto.
 * @returns {Promise<void>}
 */
async function scan(dom, ctx) {
  ctx.cards.scanDocument();
  ctx.subscriptions.scheduleChannelsCheck();
  await dom.flush();
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

const THIRD = {
  name: "Tres",
  url: `${YT}/@tres`,
  firstSeen: 1,
};

test("en /feed/channels anota y guarda los canales sin borrar con continuación", async () => {
  const { dom, ctx, clock } = setupChannels(
    renderer("uno", "Uno") + renderer("dos", "Dos") + CONTINUATION,
    {
      store: {
        youtubeSubscriptions: {
          version: 1,
          channels: { [`${YT}/@tres`]: THIRD },
        },
      },
    },
  );

  await scan(dom, ctx);
  clock.advance(10000);
  await settle();
  await ctx.subscriptions.flushPending();

  const channels = dom.store.youtubeSubscriptions.channels;
  assert.deepStrictEqual(Object.keys(channels).sort(), [
    `${YT}/@dos`,
    `${YT}/@tres`,
    `${YT}/@uno`,
  ]);
  assert.strictEqual(channels[`${YT}/@uno`].name, "Uno");
});

test("con la lista completa, a los 3 s se borra lo no visto", async () => {
  const { dom, ctx, clock } = setupChannels(
    renderer("uno", "Uno") + renderer("dos", "Dos") + CONTINUATION,
    {
      store: {
        youtubeSubscriptions: {
          version: 1,
          channels: { [`${YT}/@tres`]: THIRD },
        },
      },
    },
  );
  await scan(dom, ctx);
  dom.document.querySelector("ytd-continuation-item-renderer").remove();

  await scan(dom, ctx);
  clock.advance(2999);
  await settle();
  assert.ok(`${YT}/@tres` in dom.store.youtubeSubscriptions.channels);

  clock.advance(1);
  await settle();
  await settle();

  assert.deepStrictEqual(
    Object.keys(dom.store.youtubeSubscriptions.channels).sort(),
    [`${YT}/@dos`, `${YT}/@uno`],
  );
});

test("si aparece otro canal antes de 3 s, el plazo vuelve a empezar", async () => {
  const { dom, ctx, clock } = setupChannels(renderer("uno", "Uno"), {
    store: {
      youtubeSubscriptions: {
        version: 1,
        channels: { [`${YT}/@tres`]: THIRD },
      },
    },
  });
  await scan(dom, ctx);
  clock.advance(2000);
  dom.document
    .querySelector("ytd-browse")
    .insertAdjacentHTML("beforeend", renderer("dos", "Dos"));
  await scan(dom, ctx);

  clock.advance(2000);
  await settle();
  await settle();
  assert.ok(`${YT}/@tres` in dom.store.youtubeSubscriptions.channels);

  clock.advance(1000);
  await settle();
  await settle();
  assert.strictEqual(
    `${YT}/@tres` in dom.store.youtubeSubscriptions.channels,
    false,
  );
});

test("con un renderer sin URL no se reconcilia", async () => {
  const { dom, ctx, clock } = setupChannels(
    renderer("uno", "Uno") + renderer("", "Sin enlace"),
    {
      store: {
        youtubeSubscriptions: {
          version: 1,
          channels: { [`${YT}/@tres`]: THIRD },
        },
      },
    },
  );
  await scan(dom, ctx);
  clock.advance(10000);
  await settle();
  await settle();

  assert.ok(`${YT}/@tres` in dom.store.youtubeSubscriptions.channels);
});

test("en otra página no se reconcilia nunca", async () => {
  const { dom, ctx, clock } = setupChannels(renderer("uno", "Uno"), {
    url: "https://www.youtube.com/feed/subscriptions",
    store: {
      youtubeSubscriptions: {
        version: 1,
        channels: { [`${YT}/@tres`]: THIRD },
      },
    },
  });
  await scan(dom, ctx);
  clock.advance(10000);
  await settle();
  await settle();
  await ctx.subscriptions.flushPending();

  assert.deepStrictEqual(Object.keys(dom.store.youtubeSubscriptions.channels), [
    `${YT}/@tres`,
  ]);
});

test("reconciliar dos veces en la misma visita no vuelve a escribir", async () => {
  const { dom, ctx, clock } = setupChannels(renderer("uno", "Uno"));
  await scan(dom, ctx);
  clock.advance(3000);
  await settle();
  await settle();
  await ctx.subscriptions.flushPending();
  const writes = dom.calls.set;
  assert.ok(writes >= 1);

  await scan(dom, ctx);
  clock.advance(10000);
  await settle();
  await settle();

  assert.strictEqual(dom.calls.set, writes);
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
