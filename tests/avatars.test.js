"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { loadModules, plain } = require("./helpers/load-modules");

const SUFFIX = "=s88-c-k-c0x00ffffff-no-rj";

test("normalizeAvatarUrl normaliza tamaño, query y fragmento", () => {
  const { YouTubeGroupsAvatars: A } = loadModules();

  assert.strictEqual(
    A.normalizeAvatarUrl(
      "https://yt3.ggpht.com/ytc/AbC=s68-c-k-c0x00ffffff-no-rj?x=1#y",
    ),
    `https://yt3.ggpht.com/ytc/AbC${SUFFIX}`,
  );
  assert.strictEqual(
    A.normalizeAvatarUrl("//yt3.ggpht.com/a=s48"),
    `https://yt3.ggpht.com/a${SUFFIX}`,
  );
  assert.strictEqual(
    A.normalizeAvatarUrl("https://yt3.googleusercontent.com/x=s100"),
    `https://yt3.googleusercontent.com/x${SUFFIX}`,
  );
  assert.strictEqual(
    A.normalizeAvatarUrl("https://yt3.ggpht.com/sin-igual"),
    "https://yt3.ggpht.com/sin-igual",
  );
});

test("normalizeAvatarUrl es idempotente", () => {
  const { YouTubeGroupsAvatars: A } = loadModules();
  const once = A.normalizeAvatarUrl("https://yt3.ggpht.com/a=s48-c");

  assert.strictEqual(A.normalizeAvatarUrl(once), once);
});

test("normalizeAvatarUrl rechaza lo que no es un avatar permitido", () => {
  const { YouTubeGroupsAvatars: A } = loadModules();
  const rejected = [
    "http://yt3.ggpht.com/a",
    "data:image/png;base64,AAAA",
    "https://i.ytimg.com/vi/x/hq.jpg",
    "https://yt3.ggpht.com.evil.com/a",
    "https://u:p@yt3.ggpht.com/a",
    "https://yt3.ggpht.com:8443/a",
    "https://yt3.ggpht.com/",
    "no es una url",
    null,
    undefined,
    42,
    `https://yt3.ggpht.com/${"a".repeat(2048)}`,
  ];

  for (const value of rejected) {
    assert.strictEqual(A.normalizeAvatarUrl(value), null, String(value));
  }
});

test("isValidAvatarKey solo acepta claves de canal ya normalizadas", () => {
  const { YouTubeGroupsAvatars: A, YouTubeGroups: G } = loadModules();

  assert.strictEqual(
    A.isValidAvatarKey(G.getChannelKey("https://www.youtube.com/@Foo")),
    true,
  );
  assert.strictEqual(A.isValidAvatarKey("https://www.youtube.com/@Foo"), false);
  assert.strictEqual(A.isValidAvatarKey("https://evil.com/@a"), false);
  assert.strictEqual(A.isValidAvatarKey(42), false);
  assert.strictEqual(A.isValidAvatarKey("nada"), false);
});

test("getAvatarFor busca por clave y descarta valores no normalizados", () => {
  const { YouTubeGroupsAvatars: A } = loadModules();
  const good = `https://yt3.ggpht.com/a${SUFFIX}`;

  assert.strictEqual(
    A.getAvatarFor(
      { "https://www.youtube.com/@foo": good },
      "https://www.youtube.com/@Foo",
    ),
    good,
  );
  assert.strictEqual(
    A.getAvatarFor(
      { "https://www.youtube.com/@foo": "https://yt3.ggpht.com/a=s48" },
      "https://www.youtube.com/@Foo",
    ),
    null,
  );
  assert.strictEqual(A.getAvatarFor({}, "https://www.youtube.com/@foo"), null);
});

const GROUPS = [
  {
    id: "a",
    channels: [{ name: "Foo", url: "https://www.youtube.com/@Foo" }],
    subgroups: [
      {
        id: "a1",
        channels: [{ name: "Bar", url: "https://www.youtube.com/@bar" }],
        subgroups: [],
      },
    ],
  },
];
const FOO = "https://www.youtube.com/@foo";
const BAR = "https://www.youtube.com/@bar";
const BAZ = "https://www.youtube.com/@baz";
const img = (n) => `https://yt3.ggpht.com/${n}${SUFFIX}`;

test("getGroupedChannelKeys recorre todos los niveles", () => {
  const { YouTubeGroupsAvatars: A } = loadModules();

  assert.deepStrictEqual([...A.getGroupedChannelKeys(GROUPS)].sort(), [
    BAR,
    FOO,
  ]);
});

test("mergeAvatars añade, cambia y poda sin mutar", () => {
  const { YouTubeGroupsAvatars: A } = loadModules();
  const stored = { [FOO]: img("old"), [BAZ]: img("baz") };
  const snapshot = structuredClone(stored);

  const result = A.mergeAvatars(
    stored,
    new Map([
      [FOO, "https://yt3.ggpht.com/new=s48"],
      [BAR, img("bar")],
    ]),
    GROUPS,
  );

  assert.deepStrictEqual(plain(result), {
    avatars: { [FOO]: img("new"), [BAR]: img("bar") },
    changed: true,
  });
  assert.deepStrictEqual(stored, snapshot);
});

test("mergeAvatars ignora observados no agrupados o no válidos", () => {
  const { YouTubeGroupsAvatars: A } = loadModules();
  const stored = { [FOO]: img("foo") };

  const result = A.mergeAvatars(
    stored,
    { [BAZ]: img("baz"), [BAR]: "https://evil.com/a.png" },
    GROUPS,
  );

  assert.deepStrictEqual(plain(result), { avatars: stored, changed: false });
});

test("mergeAvatars conserva las entradas de subgrupos y descarta las no válidas", () => {
  const { YouTubeGroupsAvatars: A } = loadModules();

  const result = A.mergeAvatars(
    { [BAR]: img("bar"), [FOO]: "https://yt3.ggpht.com/sin-normalizar=s48" },
    {},
    GROUPS,
  );

  assert.deepStrictEqual(plain(result), {
    avatars: { [BAR]: img("bar") },
    changed: true,
  });
});

test("getInitial y getFallbackColor", () => {
  const { YouTubeGroupsAvatars: A } = loadModules();

  assert.strictEqual(A.getInitial("  @álvaro"), "Á");
  assert.strictEqual(A.getInitial("😀x"), "😀");
  assert.strictEqual(A.getInitial(""), "?");
  assert.strictEqual(A.getInitial("@"), "?");
  assert.match(A.getFallbackColor("Foo"), /^hsl\(\d+ 45% 40%\)$/);
  assert.strictEqual(A.getFallbackColor("Foo"), A.getFallbackColor(" Foo "));
});

test("saveObservedAvatars escribe una vez y no repite lo mismo", async () => {
  const {
    YouTubeGroupsAvatars: A,
    store,
    calls,
  } = loadModules({
    youtubeGroups: { version: 1, groups: GROUPS },
  });
  const observed = { [FOO]: img("foo"), [BAZ]: img("baz") };

  const first = await A.saveObservedAvatars(observed);
  const setsAfterFirst = calls.set;
  const second = await A.saveObservedAvatars(observed);

  assert.deepStrictEqual(plain(first), { changed: true });
  assert.deepStrictEqual(plain(second), { changed: false });
  assert.strictEqual(calls.set, setsAfterFirst);
  assert.deepStrictEqual(plain(store.youtubeAvatars), {
    version: 1,
    avatars: { [FOO]: img("foo") },
  });
});
