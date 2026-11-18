"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { loadModules, plain } = require("./helpers/load-modules");

const FOO = "https://www.youtube.com/@Foo";
const FOO_KEY = "https://www.youtube.com/@foo";
const BAR = "https://www.youtube.com/@Bar";
const BAR_KEY = "https://www.youtube.com/@bar";

function entry(name, url, firstSeen) {
  return { name, url, firstSeen };
}

test("normalizeSubscriptions descarta las entradas no válidas", () => {
  const { YouTubeGroupsSubscriptions: S } = loadModules();
  const good = entry("Foo", FOO, 10);

  const result = S.normalizeSubscriptions({
    [FOO_KEY]: good,
    [BAR]: entry("Bar", BAR, 10), // clave que no es getChannelKey
    "https://www.youtube.com/@baz": entry(
      "Baz",
      "https://www.youtube.com/watch?v=1",
      10,
    ),
    "https://www.youtube.com/@sin-nombre": entry(
      "  ",
      "https://www.youtube.com/@sin-nombre",
      10,
    ),
    "https://www.youtube.com/@fecha": entry(
      "Fecha",
      "https://www.youtube.com/@fecha",
      "ayer",
    ),
    "https://www.youtube.com/@nulo": null,
  });

  assert.deepStrictEqual(plain(result), { [FOO_KEY]: good });
  assert.deepStrictEqual(plain(S.normalizeSubscriptions(null)), {});
  assert.deepStrictEqual(plain(S.normalizeSubscriptions([])), {});
});

test("mergeSubscriptions añade con firstSeen = now", () => {
  const { YouTubeGroupsSubscriptions: S } = loadModules();

  const { channels, changed } = S.mergeSubscriptions(
    {},
    new Map([[FOO_KEY, { name: "Foo", url: FOO }]]),
    { now: 50 },
  );

  assert.strictEqual(changed, true);
  assert.deepStrictEqual(plain(channels), {
    [FOO_KEY]: entry("Foo", FOO, 50),
  });
});

test("mergeSubscriptions actualiza el nombre sin tocar firstSeen", () => {
  const { YouTubeGroupsSubscriptions: S } = loadModules();

  const { channels, changed } = S.mergeSubscriptions(
    { [FOO_KEY]: entry("Foo", FOO, 10) },
    { [FOO_KEY]: { name: "Foo Nuevo", url: FOO } },
    { now: 99 },
  );

  assert.strictEqual(changed, true);
  assert.deepStrictEqual(plain(channels), {
    [FOO_KEY]: entry("Foo Nuevo", FOO, 10),
  });
});

test("mergeSubscriptions no cambia nada con lo mismo", () => {
  const { YouTubeGroupsSubscriptions: S } = loadModules();

  const { changed } = S.mergeSubscriptions(
    { [FOO_KEY]: entry("Foo", FOO, 10) },
    { [FOO_KEY]: { name: "Foo", url: FOO } },
    { now: 99 },
  );

  assert.strictEqual(changed, false);
});

test("mergeSubscriptions con reconcileKeys borra lo no visto", () => {
  const { YouTubeGroupsSubscriptions: S } = loadModules();
  const stored = {
    [FOO_KEY]: entry("Foo", FOO, 10),
    [BAR_KEY]: entry("Bar", BAR, 20),
  };

  const { channels, changed } = S.mergeSubscriptions(stored, new Map(), {
    now: 99,
    reconcileKeys: new Set([FOO_KEY]),
  });

  assert.strictEqual(changed, true);
  assert.deepStrictEqual(plain(channels), {
    [FOO_KEY]: entry("Foo", FOO, 10),
  });

  const sin = S.mergeSubscriptions(stored, new Map(), { now: 99 });
  assert.strictEqual(sin.changed, false);
});

test("mergeSubscriptions no muta la entrada", () => {
  const { YouTubeGroupsSubscriptions: S } = loadModules();
  const stored = { [FOO_KEY]: entry("Foo", FOO, 10) };
  const observed = { [FOO_KEY]: { name: "Otro", url: FOO } };
  const storedCopy = structuredClone(stored);
  const observedCopy = structuredClone(observed);

  S.mergeSubscriptions(stored, observed, {
    now: 99,
    reconcileKeys: [],
  });

  assert.deepStrictEqual(stored, storedCopy);
  assert.deepStrictEqual(observed, observedCopy);
});

test("getUnclassifiedSubscriptions excluye grupos y subgrupos y ordena", () => {
  const { YouTubeGroupsSubscriptions: S } = loadModules();
  const channels = {
    [FOO_KEY]: entry("Foo", FOO, 10),
    [BAR_KEY]: entry("Bar", BAR, 10),
    "https://www.youtube.com/@zeta": entry(
      "Zeta",
      "https://www.youtube.com/@zeta",
      30,
    ),
    "https://www.youtube.com/@agrupado": entry(
      "Agrupado",
      "https://www.youtube.com/@agrupado",
      40,
    ),
    "https://www.youtube.com/@sub": entry(
      "Sub",
      "https://www.youtube.com/@sub",
      50,
    ),
  };
  const groups = [
    {
      id: "a",
      name: "A",
      channels: [
        { name: "Agrupado", url: "https://www.youtube.com/@AGRUPADO" },
      ],
      subgroups: [
        {
          id: "a1",
          name: "A1",
          channels: [{ name: "Sub", url: "https://www.youtube.com/@sub" }],
          subgroups: [],
        },
      ],
    },
  ];

  const result = S.getUnclassifiedSubscriptions(channels, groups);

  assert.deepStrictEqual(plain(result.map((item) => item.name)), [
    "Zeta",
    "Bar",
    "Foo",
  ]);
  assert.strictEqual(result[0].key, "https://www.youtube.com/@zeta");
});

test("findSubscriptionSectionIndex encuentra /feed/channels", () => {
  const { YouTubeGroupsSubscriptions: S } = loadModules();

  assert.strictEqual(
    S.findSubscriptionSectionIndex([
      ["/feed/you", "/@propio"],
      ["/@uno", "/feed/channels"],
    ]),
    1,
  );
  assert.strictEqual(
    S.findSubscriptionSectionIndex([["https://www.youtube.com/feed/channels"]]),
    0,
  );
  assert.strictEqual(
    S.findSubscriptionSectionIndex([["/feed/subscriptions"], ["/@uno"]]),
    -1,
  );
  assert.strictEqual(S.findSubscriptionSectionIndex(null), -1);
});

test("isChannelListComplete según los tres datos", () => {
  const { YouTubeGroupsSubscriptions: S } = loadModules();

  assert.strictEqual(
    S.isChannelListComplete({
      channelCount: 2,
      notedCount: 2,
      hasContinuation: false,
    }),
    true,
  );
  assert.strictEqual(
    S.isChannelListComplete({
      channelCount: 0,
      notedCount: 0,
      hasContinuation: false,
    }),
    false,
  );
  assert.strictEqual(
    S.isChannelListComplete({
      channelCount: 2,
      notedCount: 1,
      hasContinuation: false,
    }),
    false,
  );
  assert.strictEqual(
    S.isChannelListComplete({
      channelCount: 2,
      notedCount: 2,
      hasContinuation: true,
    }),
    false,
  );
});

test("saveObservedSubscriptions escribe una vez y no si no cambia", async () => {
  const { YouTubeGroupsSubscriptions: S, store, calls } = loadModules();
  const observed = new Map([[FOO_KEY, { name: "Foo", url: FOO }]]);

  const first = await S.saveObservedSubscriptions(observed);
  assert.strictEqual(first.changed, true);
  assert.strictEqual(calls.set, 1);
  assert.strictEqual(store.youtubeSubscriptions.version, 1);
  assert.deepStrictEqual(Object.keys(store.youtubeSubscriptions.channels), [
    FOO_KEY,
  ]);

  const second = await S.saveObservedSubscriptions(observed);
  assert.strictEqual(second.changed, false);
  assert.strictEqual(calls.set, 1);

  const third = await S.saveObservedSubscriptions(new Map(), {
    reconcileKeys: [],
  });
  assert.strictEqual(third.changed, true);
  assert.strictEqual(calls.set, 2);
});
