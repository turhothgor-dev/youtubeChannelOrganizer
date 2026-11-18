"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { loadModules, plain } = require("./helpers/load-modules");
const { makeGroup, groupsStore } = require("./helpers/youtube-fixtures");

const FOO = "https://www.youtube.com/@Foo";
const FOO_KEY = "https://www.youtube.com/@foo";
const BAR = "https://www.youtube.com/@Bar";
const V1 = "aaaaaaaaaaa";
const V2 = "bbbbbbbbbbb";
const V3 = "ccccccccccc";
const NOW = 1_000_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

const groups = [
  makeGroup("A", { channels: [{ name: "Foo", url: FOO }] }),
  makeGroup("B"),
];

function item(channelUrl, seenAt, ageSeconds = null) {
  return { channelUrl, seenAt, ageSeconds };
}

test("normalizeNewVideos descarta lo no válido", () => {
  const { YouTubeGroupsNewVideos: N } = loadModules();

  assert.deepStrictEqual(plain(N.normalizeNewVideos(null)), {
    since: null,
    videos: {},
    visits: {},
  });
  const result = N.normalizeNewVideos({
    since: 5,
    videos: {
      [V1]: { channel: FOO_KEY, seenAt: 10, publishedBefore: null },
      corto: { channel: FOO_KEY, seenAt: 10, publishedBefore: null },
      [V2]: { channel: FOO, seenAt: 10, publishedBefore: null },
      [V3]: { channel: FOO_KEY, seenAt: Infinity, publishedBefore: null },
    },
    visits: { A: 3, B: "ayer", C: NaN },
  });
  assert.deepStrictEqual(Object.keys(result.videos), [V1]);
  assert.deepStrictEqual(plain(result.visits), { A: 3 });
  assert.strictEqual(result.since, 5);
});

test("el primer lote fija since y solo añade canales agrupados", () => {
  const { YouTubeGroupsNewVideos: N, YouTubeGroups: G } = loadModules();
  const batch = new Map([
    [V1, item("https://www.youtube.com/@foo", NOW, 7200)],
    [V2, item(BAR, NOW, 60)],
    [V3, item(FOO, NOW)],
  ]);

  const { state, changed } = N.applyFeedBatch(null, batch, {
    now: NOW,
    groups,
  });

  assert.ok(changed);
  assert.strictEqual(state.since, NOW);
  assert.deepStrictEqual(Object.keys(state.videos).sort(), [V1, V3]);
  assert.strictEqual(G.getChannelKey(FOO), FOO_KEY);
  assert.deepStrictEqual(plain(state.videos[V1]), {
    channel: FOO_KEY,
    seenAt: NOW,
    publishedBefore: NOW - 7_200_000,
  });
  assert.strictEqual(state.videos[V3].publishedBefore, null);
});

test("un vídeo repetido no cambia seenAt y completa publishedBefore", () => {
  const { YouTubeGroupsNewVideos: N } = loadModules();
  const first = N.applyFeedBatch(null, new Map([[V1, item(FOO, NOW)]]), {
    now: NOW,
    groups,
  });

  const second = N.applyFeedBatch(
    first.state,
    new Map([[V1, item(FOO, NOW + 1000, 3600)]]),
    { now: NOW + 1000, groups },
  );

  assert.strictEqual(second.state.videos[V1].seenAt, NOW);
  assert.strictEqual(
    second.state.videos[V1].publishedBefore,
    NOW + 1000 - 3_600_000,
  );
  assert.ok(second.changed);

  const third = N.applyFeedBatch(
    second.state,
    new Map([[V1, item(FOO, NOW + 2000, 10)]]),
    { now: NOW + 2000, groups },
  );
  assert.strictEqual(
    third.state.videos[V1].publishedBefore,
    second.state.videos[V1].publishedBefore,
  );
  assert.strictEqual(third.changed, false);
});

test("ackGroupIds pone visitas solo de grupos existentes", () => {
  const { YouTubeGroupsNewVideos: N } = loadModules();

  const { state } = N.applyFeedBatch(null, new Map(), {
    now: NOW,
    ackGroupIds: ["A", "fantasma"],
    groups,
  });

  assert.deepStrictEqual(plain(state.visits), { A: NOW });
});

test("poda por antigüedad, canal no agrupado, tope y visitas huérfanas", () => {
  const { YouTubeGroupsNewVideos: N } = loadModules();
  const stored = {
    since: 1,
    videos: {
      [V1]: { channel: FOO_KEY, seenAt: NOW - 31 * DAY, publishedBefore: null },
      [V2]: {
        channel: "https://www.youtube.com/@bar",
        seenAt: NOW,
        publishedBefore: null,
      },
      [V3]: { channel: FOO_KEY, seenAt: NOW - DAY, publishedBefore: null },
    },
    visits: { A: 5, borrado: 6 },
  };

  const { state } = N.applyFeedBatch(stored, new Map(), { now: NOW, groups });

  assert.deepStrictEqual(Object.keys(state.videos), [V3]);
  assert.deepStrictEqual(plain(state.visits), { A: 5 });

  const many = {};
  for (let i = 0; i < 1005; i += 1) {
    many[`v${String(i).padStart(10, "0")}`] = {
      channel: FOO_KEY,
      seenAt: NOW - i,
      publishedBefore: null,
    };
  }
  const capped = N.applyFeedBatch(
    { since: 1, videos: many, visits: {} },
    null,
    {
      now: NOW,
      groups,
    },
  ).state;
  const ids = Object.keys(capped.videos);
  assert.strictEqual(ids.length, 1000);
  assert.ok(ids.includes("v0000000000"));
  assert.ok(!ids.includes("v0000001004"));
});

test("changed es false sin cambios y no muta la entrada", () => {
  const { YouTubeGroupsNewVideos: N } = loadModules();
  const stored = {
    since: 1,
    videos: {
      [V1]: { channel: FOO_KEY, seenAt: NOW, publishedBefore: null },
    },
    visits: { A: 2 },
  };
  const snapshot = structuredClone(stored);
  const batch = new Map([[V2, item(FOO, NOW, 5)]]);

  const same = N.applyFeedBatch(stored, new Map([[V1, item(FOO, NOW)]]), {
    now: NOW,
    groups,
  });
  assert.strictEqual(same.changed, false);

  N.applyFeedBatch(stored, batch, { now: NOW, ackGroupIds: ["A"], groups });
  assert.deepStrictEqual(plain(stored), snapshot);
});

test("acknowledgeGroups devuelve un estado nuevo con las visitas", () => {
  const { YouTubeGroupsNewVideos: N } = loadModules();
  const stored = { since: 1, videos: {}, visits: { A: 2 } };

  const result = N.acknowledgeGroups(stored, ["A", "B"], NOW);

  assert.deepStrictEqual(plain(result.visits), { A: NOW, B: NOW });
  assert.deepStrictEqual(plain(stored.visits), { A: 2 });
});

test("saveFeedBatch escribe una vez y nada si no cambia", async () => {
  const {
    YouTubeGroupsNewVideos: N,
    store,
    calls,
  } = loadModules(groupsStore(groups));
  const seenAt = Date.now();
  const batch = new Map([[V1, item(FOO, seenAt, 60)]]);

  const first = await N.saveFeedBatch(batch);
  assert.ok(first.changed);
  assert.strictEqual(calls.set, 1);
  assert.strictEqual(store.youtubeNewVideos.version, 1);
  assert.ok(store.youtubeNewVideos.videos[V1]);

  const second = await N.saveFeedBatch(batch);
  assert.strictEqual(second.changed, false);
  assert.strictEqual(calls.set, 1);
});

const X = { name: "X", url: "https://www.youtube.com/@X" };
const X_KEY = "https://www.youtube.com/@x";
const countGroups = [
  makeGroup("A", { subgroups: [makeGroup("A1", { channels: [X] })] }),
  makeGroup("B", { channels: [X] }),
];

function video(seenAt, publishedBefore = seenAt, channel = X_KEY) {
  return { channel, seenAt, publishedBefore };
}

test("countNewVideos cuenta en el subárbol y se pone a 0 al visitar", () => {
  const { YouTubeGroupsNewVideos: N } = loadModules();
  const state = { since: 100, videos: { [V1]: video(200) }, visits: {} };

  const sorted = [...N.countNewVideos(state, countGroups, {})].sort();
  assert.deepStrictEqual(plain(sorted), [
    ["A", 1],
    ["A1", 1],
    ["B", 1],
  ]);
  const visitedA1 = N.acknowledgeGroups(state, ["A1"], 300);
  assert.strictEqual(N.countNewVideos(visitedA1, countGroups, {}).size, 0);
  const visitedA = N.acknowledgeGroups(state, ["A"], 300);
  assert.strictEqual(N.countNewVideos(visitedA, countGroups, {}).size, 0);
});

test("countNewVideos no cuenta vistos ni anteriores a la visita o a since", () => {
  const { YouTubeGroupsNewVideos: N } = loadModules();
  const base = { since: 100, visits: {} };

  const watched = { ...base, videos: { [V1]: video(200) } };
  assert.strictEqual(
    N.countNewVideos(watched, countGroups, { [V1]: { t: 1 } }).size,
    0,
  );
  const old = { ...base, videos: { [V1]: video(200, 150) } };
  assert.strictEqual(N.countNewVideos(old, countGroups, {}).get("B"), 1);
  const published = { since: 100, visits: { B: 180 }, videos: old.videos };
  assert.strictEqual(N.countNewVideos(published, countGroups, {}).size, 0);
  const beforeSince = { ...base, videos: { [V1]: video(200, 90) } };
  assert.strictEqual(N.countNewVideos(beforeSince, countGroups, {}).size, 0);
  const seenBefore = { ...base, videos: { [V1]: video(90) } };
  assert.strictEqual(N.countNewVideos(seenBefore, countGroups, {}).size, 0);
});

test("countNewVideos no cuenta un vídeo sin edad legible", () => {
  const { YouTubeGroupsNewVideos: N } = loadModules();
  const state = {
    since: 100,
    videos: { [V1]: video(200, null) },
    visits: {},
  };
  assert.strictEqual(N.countNewVideos(state, countGroups, {}).size, 0);
});

test("countNewVideos cuenta una vez un vídeo y omite grupos sin nuevos", () => {
  const { YouTubeGroupsNewVideos: N } = loadModules();
  const y = { name: "Y", url: "https://www.youtube.com/@Y" };
  const groupsTwo = [
    makeGroup("A", { channels: [X, y] }),
    makeGroup("B", { channels: [y] }),
  ];
  const state = {
    since: 100,
    videos: {
      [V1]: video(200),
      [V2]: video(200, 200, "https://www.youtube.com/@y"),
    },
    visits: {},
  };
  const counts = N.countNewVideos(state, groupsTwo, {});
  assert.strictEqual(counts.get("A"), 2);
  assert.strictEqual(counts.get("B"), 1);
  const empty = N.countNewVideos({ since: 100 }, groupsTwo, {});
  assert.strictEqual(empty.size, 0);
});
