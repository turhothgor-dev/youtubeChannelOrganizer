"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { loadDom, manifestScripts } = require("./helpers/load-dom");
const {
  CHANNEL_URL,
  makeGroup,
  groupsStore,
} = require("./helpers/youtube-fixtures");

const SUFFIX = "=s88-c-k-c0x00ffffff-no-rj";
const IMG_A = "https://yt3.ggpht.com/aaa";
const IMG_B = "https://yt3.ggpht.com/bbb";
const KEY = CHANNEL_URL;

/**
 * Tarjeta de suscripciones con los avatares indicados.
 * @param {string} handle - Handle del canal.
 * @param {string[]} imgs - URLs de las imágenes de avatar.
 * @returns {string} HTML.
 */
function card(handle, imgs) {
  const avatars = imgs
    .map(
      (src) => `<yt-avatar-shape><img src="${src}=s68-c-k"></yt-avatar-shape>`,
    )
    .join("");
  return `
    <ytd-rich-item-renderer>
      <ytd-thumbnail><a href="/watch?v=abc123DEF45"><img src="x.jpg"></a></ytd-thumbnail>
      ${avatars}
      <ytd-channel-name><a href="/@${handle}">${handle}</a></ytd-channel-name>
    </ytd-rich-item-renderer>`;
}

/**
 * Carga la página sin `content.js` y crea el recolector y las tarjetas con un
 * contexto mínimo.
 * @param {Object} options - html, url, groups (canales agrupados), store.
 * @returns {Object} dom, ctx y la lista de grupos.
 */
function setup({ html, url, handles = ["canal"], grouped = true }) {
  const scripts = manifestScripts().filter((file) => file !== "content.js");
  const groups = [
    makeGroup("A", {
      channels: handles.map((h) => ({
        name: h,
        url: `https://www.youtube.com/@${h}`,
      })),
    }),
  ];
  const dom = loadDom({ html, url, scripts, store: groupsStore(groups) });
  const ctx = {
    state: {
      settings: dom.global("YouTubeGroupsSettings").DEFAULT_SETTINGS,
      activeSelection: [],
      activeSelectionUrls: null,
      advancedFilters: { duration: "any", age: "any", views: "any" },
      watchedVideos: null,
      avatars: {},
    },
    watched: {
      applyWatchedToCard() {},
      updateWatchedButton() {},
      toggleVideoWatched() {},
    },
    dropdowns: {},
  };
  ctx.avatars = dom.global("YouTubeGroupsAvatarsUi").create(ctx);
  ctx.cards = dom.global("YouTubeGroupsCards").create(ctx);
  ctx.avatars.setGroupedChannels(grouped ? groups : []);
  return { dom, ctx, groups };
}

test("una tarjeta de canal agrupado con avatar se guarda una vez, normalizada", async () => {
  const { dom, ctx } = setup({ html: card("canal", [IMG_A]) });

  ctx.cards.scanDocument();
  await dom.flush();
  await ctx.avatars.flushPending();

  assert.strictEqual(dom.calls.set, 1);
  assert.deepStrictEqual(dom.store.youtubeAvatars, {
    version: 1,
    avatars: { [KEY]: IMG_A + SUFFIX },
  });

  // La misma tarjeta otra vez: nada nuevo
  ctx.state.avatars = dom.store.youtubeAvatars.avatars;
  ctx.cards.resetDetectedCards();
  ctx.cards.scanDocument();
  await dom.flush();
  await ctx.avatars.flushPending();
  assert.strictEqual(dom.calls.set, 1);
});

test("una tarjeta con dos avatares distintos no guarda nada", async () => {
  const { dom, ctx } = setup({ html: card("canal", [IMG_A, IMG_B]) });

  ctx.cards.scanDocument();
  await dom.flush();
  await ctx.avatars.flushPending();

  assert.strictEqual(dom.calls.set, 0);
});

test("un canal no agrupado no guarda nada y, al agruparlo, se guarda sin ver la tarjeta de nuevo", async () => {
  const { dom, ctx, groups } = setup({
    html: card("canal", [IMG_A]),
    grouped: false,
  });

  ctx.cards.scanDocument();
  await dom.flush();
  await ctx.avatars.flushPending();
  assert.strictEqual(dom.calls.set, 0);

  ctx.avatars.setGroupedChannels(groups);
  await ctx.avatars.flushPending();
  assert.strictEqual(dom.calls.set, 1);
  assert.strictEqual(dom.store.youtubeAvatars.avatars[KEY], IMG_A + SUFFIX);
});

test("un canal solo suscrito se guarda al conocer la suscripción", async () => {
  const { dom, ctx } = setup({
    html: card("canal", [IMG_A]),
    grouped: false,
  });

  ctx.cards.scanDocument();
  await dom.flush();
  await ctx.avatars.flushPending();
  assert.strictEqual(dom.calls.set, 0);

  ctx.avatars.setGroupedChannels([], {
    [KEY]: { name: "canal", url: KEY, firstSeen: 1 },
  });
  await ctx.avatars.flushPending();
  assert.strictEqual(dom.calls.set, 1);
  assert.strictEqual(dom.store.youtubeAvatars.avatars[KEY], IMG_A + SUFFIX);
});

test("varias tarjetas de canales agrupados dan una sola escritura", async () => {
  const { dom, ctx } = setup({
    html: card("canal", [IMG_A]) + card("otro", [IMG_B]),
    handles: ["canal", "otro"],
  });

  ctx.cards.scanDocument();
  await dom.flush();
  await ctx.avatars.flushPending();

  assert.strictEqual(dom.calls.set, 1);
  assert.strictEqual(Object.keys(dom.store.youtubeAvatars.avatars).length, 2);
});

test("un resultado de canal se captura", async () => {
  const { dom, ctx } = setup({
    url: "https://www.youtube.com/results?search_query=x",
    html: `<ytd-channel-renderer>
      <yt-img-shadow id="avatar"><img src="${IMG_A}=s176-c-k"></yt-img-shadow>
      <a id="main-link" href="/@canal"><ytd-channel-name><span id="text">Canal</span></ytd-channel-name></a>
    </ytd-channel-renderer>`,
  });

  ctx.cards.scanDocument();
  await dom.flush();
  await ctx.avatars.flushPending();

  assert.strictEqual(dom.store.youtubeAvatars.avatars[KEY], IMG_A + SUFFIX);
});

test("una entrada de suscripción de la guía se captura con scanPage", async () => {
  const { dom, ctx } = setup({
    html: `<ytd-guide-entry-renderer>
      <a href="/@canal"><yt-img-shadow><img src="${IMG_A}=s48-c-k"></yt-img-shadow><span>Canal</span></a>
    </ytd-guide-entry-renderer>`,
  });

  ctx.avatars.scheduleScan({ guide: true });
  await dom.flush();
  await ctx.avatars.flushPending();

  assert.strictEqual(dom.store.youtubeAvatars.avatars[KEY], IMG_A + SUFFIX);
});

test("la guía solo se escanea al pedirlo o si una mutación la toca", async () => {
  const { dom, ctx } = setup({
    html: `<ytd-guide-renderer><ytd-guide-entry-renderer id="e">
      <a href="/@canal"><yt-img-shadow><img src="${IMG_A}=s48-c-k"></yt-img-shadow></a>
    </ytd-guide-entry-renderer></ytd-guide-renderer><div id="other"></div>`,
  });
  const document = dom.window.document;

  // Mutación fuera de la guía: no se lee
  ctx.avatars.noteMutations([
    { target: document.getElementById("other"), addedNodes: [] },
  ]);
  await dom.flush();
  await ctx.avatars.flushPending();
  assert.strictEqual(dom.calls.set, 0);

  // Mutación dentro de la guía: se lee
  ctx.avatars.noteMutations([
    { target: document.getElementById("e"), addedNodes: [] },
  ]);
  await dom.flush();
  await ctx.avatars.flushPending();
  assert.strictEqual(dom.store.youtubeAvatars.avatars[KEY], IMG_A + SUFFIX);
});

test("un fallo del recolector no deja la tarjeta sin controles", async () => {
  const { dom, ctx } = setup({ html: card("canal", [IMG_A]) });
  const original = ctx.avatars.noteCard;
  const errors = [];
  const consoleError = dom.window.console.error;
  dom.window.console.error = (...args) => errors.push(args);
  ctx.avatars = {
    ...ctx.avatars,
    noteCard() {
      throw new Error("boom");
    },
  };
  assert.ok(original);

  ctx.cards.scanDocument();
  await dom.flush();
  dom.window.console.error = consoleError;

  assert.ok(
    dom.window.document.querySelector(".youtube-groups__subscription-control"),
  );
  assert.strictEqual(errors.length, 1);
});

test("en una página de canal se guarda el avatar de la cabecera, no el banner", async () => {
  const { dom, ctx } = setup({
    url: "https://www.youtube.com/@canal/videos",
    html: `<yt-page-header-renderer>
      <div class="banner"><yt-img-shadow><img src="${IMG_B}=w1060-fcrop64"></yt-img-shadow></div>
      <yt-avatar-shape><img src="${IMG_A}=s160-c-k"></yt-avatar-shape>
    </yt-page-header-renderer>`,
  });

  ctx.avatars.scanPage();
  await ctx.avatars.flushPending();

  assert.strictEqual(dom.store.youtubeAvatars.avatars[KEY], IMG_A + SUFFIX);
});

test("un avatar guardado y visto distinto se actualiza una vez por sesión", async () => {
  const { dom, ctx } = setup({ html: card("canal", [IMG_A]) });
  ctx.state.avatars = { [KEY]: IMG_B + SUFFIX };
  dom.store.youtubeAvatars = { version: 1, avatars: { [KEY]: IMG_B + SUFFIX } };

  ctx.cards.scanDocument();
  await dom.flush();
  await ctx.avatars.flushPending();
  assert.strictEqual(dom.calls.set, 1);
  assert.strictEqual(dom.store.youtubeAvatars.avatars[KEY], IMG_A + SUFFIX);

  // Otro avatar visto después, aunque el guardado siga siendo el viejo
  ctx.avatars.noteAvatar(CHANNEL_URL, IMG_B);
  await ctx.avatars.flushPending();
  assert.strictEqual(dom.calls.set, 1);
});
