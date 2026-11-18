"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { loadModules, plain } = require("./helpers/load-modules");

test("getGroups sin datos devuelve [] y escribe el formato versión 1", async () => {
  const { YouTubeGroupsStorage, store, calls } = loadModules();

  const groups = await YouTubeGroupsStorage.getGroups();

  assert.deepStrictEqual(plain(groups), []);
  assert.strictEqual(calls.set, 1);
  assert.deepStrictEqual(plain(store.youtubeGroups), {
    version: 1,
    groups: [],
  });
});

test("getWatchedVideos sin datos devuelve {} y no escribe", async () => {
  const { YouTubeGroupsStorage, calls } = loadModules();

  const videos = await YouTubeGroupsStorage.getWatchedVideos();

  assert.deepStrictEqual(plain(videos), {});
  assert.strictEqual(calls.set, 0);
});

test("getWatchedVideos con datos corruptos devuelve {}", async () => {
  for (const corrupt of [[], null]) {
    const { YouTubeGroupsStorage, store, calls } = loadModules();
    store.youtubeWatched = { version: 1, videos: corrupt };

    const videos = await YouTubeGroupsStorage.getWatchedVideos();

    assert.deepStrictEqual(plain(videos), {});
    assert.strictEqual(calls.set, 0);
  }
});

test("saveWatchedVideos y getWatchedVideos conservan el mapa con version 1", async () => {
  const { YouTubeGroupsStorage, store } = loadModules();
  const map = { dQw4w9WgXcQ: { watchedAt: 1794672642000 } };

  await YouTubeGroupsStorage.saveWatchedVideos(map);
  const videos = await YouTubeGroupsStorage.getWatchedVideos();

  assert.deepStrictEqual(plain(videos), map);
  assert.strictEqual(store.youtubeWatched.version, 1);
});

test("saveWatchedVideos con algo que no es un objeto plano lanza TypeError", async () => {
  const { YouTubeGroupsStorage } = loadModules();

  for (const invalid of [[], null, 5]) {
    await assert.rejects(
      () => YouTubeGroupsStorage.saveWatchedVideos(invalid),
      (error) => error.name === "TypeError",
    );
  }
});

test("guardar vistos no cambia youtubeGroups", async () => {
  const { YouTubeGroupsStorage, store } = loadModules();
  await YouTubeGroupsStorage.saveGroups([{ id: "a" }]);
  const before = JSON.stringify(store.youtubeGroups);

  await YouTubeGroupsStorage.saveWatchedVideos({
    dQw4w9WgXcQ: { watchedAt: 1 },
  });

  assert.strictEqual(JSON.stringify(store.youtubeGroups), before);
});

test("getSettings sin datos devuelve {} y no escribe", async () => {
  const { YouTubeGroupsStorage, calls } = loadModules();

  const settings = await YouTubeGroupsStorage.getSettings();

  assert.deepStrictEqual(plain(settings), {});
  assert.strictEqual(calls.set, 0);
});

test("getSettings con datos corruptos devuelve {}", async () => {
  for (const corrupt of [[], null, 3]) {
    const { YouTubeGroupsStorage, store, calls } = loadModules();
    store.youtubeSettings = { version: 1, settings: corrupt };

    const settings = await YouTubeGroupsStorage.getSettings();

    assert.deepStrictEqual(plain(settings), {});
    assert.strictEqual(calls.set, 0);
  }
});

test("saveSettings y getSettings conservan los ajustes con version 1", async () => {
  const { YouTubeGroupsStorage, store } = loadModules();
  const settings = { watchedMode: "hide", outsideMode: "dim" };

  await YouTubeGroupsStorage.saveSettings(settings);
  const loaded = await YouTubeGroupsStorage.getSettings();

  assert.deepStrictEqual(plain(loaded), settings);
  assert.strictEqual(store.youtubeSettings.version, 1);
});

test("saveSettings con algo que no es un objeto plano lanza TypeError", async () => {
  const { YouTubeGroupsStorage } = loadModules();

  for (const invalid of [[], null]) {
    await assert.rejects(
      () => YouTubeGroupsStorage.saveSettings(invalid),
      (error) => error.name === "TypeError",
    );
  }
});

test("guardar ajustes no cambia youtubeGroups ni youtubeWatched", async () => {
  const { YouTubeGroupsStorage, store } = loadModules();
  await YouTubeGroupsStorage.saveGroups([{ id: "a" }]);
  await YouTubeGroupsStorage.saveWatchedVideos({
    dQw4w9WgXcQ: { watchedAt: 1 },
  });
  const before = JSON.stringify([store.youtubeGroups, store.youtubeWatched]);

  await YouTubeGroupsStorage.saveSettings({ watchedMode: "hide" });

  assert.strictEqual(
    JSON.stringify([store.youtubeGroups, store.youtubeWatched]),
    before,
  );
});

test("getPlaylists sin datos devuelve [] y no escribe", async () => {
  const { YouTubeGroupsStorage, calls } = loadModules();

  const playlists = await YouTubeGroupsStorage.getPlaylists();

  assert.deepStrictEqual(plain(playlists), []);
  assert.strictEqual(calls.set, 0);
});

test("getPlaylists con datos corruptos devuelve []", async () => {
  for (const corrupt of [{}, null]) {
    const { YouTubeGroupsStorage, store, calls } = loadModules();
    store.youtubePlaylists = { version: 1, playlists: corrupt };

    const playlists = await YouTubeGroupsStorage.getPlaylists();

    assert.deepStrictEqual(plain(playlists), []);
    assert.strictEqual(calls.set, 0);
  }
});

test("savePlaylists y getPlaylists conservan las listas con version 1", async () => {
  const { YouTubeGroupsStorage, store } = loadModules();
  const playlists = [
    {
      id: "p1",
      name: "Para luego",
      videos: [
        {
          id: "dQw4w9WgXcQ",
          title: "T",
          channelName: "C",
          addedAt: 1794672642000,
        },
      ],
    },
  ];

  await YouTubeGroupsStorage.savePlaylists(playlists);
  const loaded = await YouTubeGroupsStorage.getPlaylists();

  assert.deepStrictEqual(plain(loaded), playlists);
  assert.strictEqual(store.youtubePlaylists.version, 1);
});

test("savePlaylists con algo que no es un array lanza TypeError", async () => {
  const { YouTubeGroupsStorage } = loadModules();

  for (const invalid of [{}, null]) {
    await assert.rejects(
      () => YouTubeGroupsStorage.savePlaylists(invalid),
      (error) => error.name === "TypeError",
    );
  }
});

test("guardar listas no cambia grupos, vistos ni ajustes", async () => {
  const { YouTubeGroupsStorage, store } = loadModules();
  await YouTubeGroupsStorage.saveGroups([{ id: "a" }]);
  await YouTubeGroupsStorage.saveWatchedVideos({
    dQw4w9WgXcQ: { watchedAt: 1 },
  });
  await YouTubeGroupsStorage.saveSettings({ watchedMode: "hide" });
  const before = JSON.stringify([
    store.youtubeGroups,
    store.youtubeWatched,
    store.youtubeSettings,
  ]);

  await YouTubeGroupsStorage.savePlaylists([
    { id: "p", name: "x", videos: [] },
  ]);

  assert.strictEqual(
    JSON.stringify([
      store.youtubeGroups,
      store.youtubeWatched,
      store.youtubeSettings,
    ]),
    before,
  );
});

test("KEYS tiene las seis claves con sus nombres reales", () => {
  const { YouTubeGroupsStorage } = loadModules();

  assert.deepStrictEqual(plain(YouTubeGroupsStorage.KEYS), {
    groups: "youtubeGroups",
    watched: "youtubeWatched",
    settings: "youtubeSettings",
    playlists: "youtubePlaylists",
    avatars: "youtubeAvatars",
    subscriptions: "youtubeSubscriptions",
  });
  assert.ok(Object.isFrozen(YouTubeGroupsStorage.KEYS));
});

test("withLock con la misma clave ejecuta en orden", async () => {
  const { YouTubeGroupsStorage } = loadModules();
  const events = [];
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });

  const first = YouTubeGroupsStorage.withLock("k", async () => {
    events.push("first:start");
    await gate;
    events.push("first:end");
  });
  const second = YouTubeGroupsStorage.withLock("k", async () => {
    events.push("second:start");
  });

  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepStrictEqual(events, ["first:start"]);

  release();
  await Promise.all([first, second]);

  assert.deepStrictEqual(events, ["first:start", "first:end", "second:start"]);
});

test("withLock con claves distintas no se esperan", async () => {
  const { YouTubeGroupsStorage } = loadModules();
  const gate = new Promise(() => {});

  YouTubeGroupsStorage.withLock("a", () => gate);
  const result = await YouTubeGroupsStorage.withLock("b", () => "listo");

  assert.strictEqual(result, "listo");
});

test("withLock devuelve el valor de fn, síncrono o asíncrono", async () => {
  const { YouTubeGroupsStorage } = loadModules();

  assert.strictEqual(await YouTubeGroupsStorage.withLock("k", () => 1), 1);
  assert.strictEqual(
    await YouTubeGroupsStorage.withLock("k", async () => 2),
    2,
  );
});

test("withLock rechaza con el error de fn y la cola sigue", async () => {
  const { YouTubeGroupsStorage } = loadModules();
  const rejected = new Error("async");
  const thrown = new Error("sync");

  const first = YouTubeGroupsStorage.withLock("k", async () => {
    throw rejected;
  });
  const second = YouTubeGroupsStorage.withLock("k", () => {
    throw thrown;
  });
  const third = YouTubeGroupsStorage.withLock("k", () => "ok");

  await assert.rejects(first, (error) => error === rejected);
  await assert.rejects(second, (error) => error === thrown);
  assert.strictEqual(await third, "ok");
  assert.strictEqual(
    await YouTubeGroupsStorage.withLock("k", () => "otra"),
    "otra",
  );
});

test("saveGroups con algo que no es un array lanza TypeError", async () => {
  const { YouTubeGroupsStorage } = loadModules();

  await assert.rejects(
    () => YouTubeGroupsStorage.saveGroups({}),
    (error) => error.name === "TypeError",
  );
});

test("readGroupsValue y readPlaylistsValue devuelven el array o []", () => {
  const { YouTubeGroupsStorage: S } = loadModules();
  const cases = [
    ["readGroupsValue", "groups"],
    ["readPlaylistsValue", "playlists"],
  ];

  for (const [reader, field] of cases) {
    assert.deepStrictEqual(plain(S[reader](undefined)), []);
    assert.deepStrictEqual(plain(S[reader](null)), []);
    assert.deepStrictEqual(
      plain(S[reader]({ version: 1, [field]: [{ id: "a" }] })),
      [{ id: "a" }],
    );
    assert.deepStrictEqual(plain(S[reader]({ version: 1, [field]: {} })), []);
    assert.deepStrictEqual(plain(S[reader]({ version: 1, [field]: "x" })), []);
  }
});

test("readWatchedValue y readSettingsValue devuelven el objeto o {}", () => {
  const { YouTubeGroupsStorage: S } = loadModules();
  const cases = [
    ["readWatchedValue", "videos"],
    ["readSettingsValue", "settings"],
  ];

  for (const [reader, field] of cases) {
    assert.deepStrictEqual(plain(S[reader](undefined)), {});
    assert.deepStrictEqual(plain(S[reader](null)), {});
    assert.deepStrictEqual(
      plain(S[reader]({ version: 1, [field]: { a: 1 } })),
      { a: 1 },
    );
    assert.deepStrictEqual(plain(S[reader]({ version: 1, [field]: [] })), {});
    assert.deepStrictEqual(plain(S[reader]({ version: 1, [field]: null })), {});
  }
});

test("getChangedKeys ignora áreas distintas de local", () => {
  const { YouTubeGroupsStorage: S } = loadModules();

  assert.deepStrictEqual(
    plain(S.getChangedKeys({ youtubeGroups: {} }, "sync")),
    [],
  );
});

test("getChangedKeys devuelve los nombres lógicos en el orden de KEYS", () => {
  const { YouTubeGroupsStorage: S } = loadModules();
  const changes = { youtubePlaylists: {}, youtubeGroups: {}, otraClave: {} };

  assert.deepStrictEqual(plain(S.getChangedKeys(changes, "local")), [
    "groups",
    "playlists",
  ]);
  assert.deepStrictEqual(
    plain(S.getChangedKeys({ otraClave: {} }, "local")),
    [],
  );
});

test("getChangedKeys con youtubeAvatars devuelve avatars y respeta el orden de KEYS", () => {
  const { YouTubeGroupsStorage: S } = loadModules();

  assert.deepStrictEqual(
    plain(S.getChangedKeys({ youtubeAvatars: {} }, "local")),
    ["avatars"],
  );
  assert.deepStrictEqual(
    plain(
      S.getChangedKeys(
        { youtubeAvatars: {}, youtubePlaylists: {}, youtubeGroups: {} },
        "local",
      ),
    ),
    ["groups", "playlists", "avatars"],
  );
});

test("readAvatarsValue devuelve el objeto o {}", () => {
  const { YouTubeGroupsStorage: S } = loadModules();

  assert.deepStrictEqual(plain(S.readAvatarsValue(undefined)), {});
  assert.deepStrictEqual(plain(S.readAvatarsValue([])), {});
  assert.deepStrictEqual(plain(S.readAvatarsValue({ avatars: [] })), {});
  assert.deepStrictEqual(
    plain(S.readAvatarsValue({ version: 1, avatars: { a: "b" } })),
    { a: "b" },
  );
});

test("getAvatars sin datos devuelve {} y no escribe", async () => {
  const { YouTubeGroupsStorage, calls } = loadModules();

  const avatars = await YouTubeGroupsStorage.getAvatars();

  assert.deepStrictEqual(plain(avatars), {});
  assert.strictEqual(calls.set, 0);
});

test("saveAvatars y getAvatars conservan el mapa con version 1", async () => {
  const { YouTubeGroupsStorage, store } = loadModules();
  const map = { "https://www.youtube.com/@foo": "https://yt3.ggpht.com/a" };

  await YouTubeGroupsStorage.saveAvatars(map);
  const loaded = await YouTubeGroupsStorage.getAvatars();

  assert.deepStrictEqual(plain(loaded), map);
  assert.deepStrictEqual(plain(store.youtubeAvatars), {
    version: 1,
    avatars: map,
  });
});

test("getChangedKeys con youtubeSubscriptions devuelve subscriptions", () => {
  const { YouTubeGroupsStorage: S } = loadModules();

  assert.deepStrictEqual(
    plain(S.getChangedKeys({ youtubeSubscriptions: {} }, "local")),
    ["subscriptions"],
  );
});

test("readSubscriptionsValue devuelve el mapa o {}", () => {
  const { YouTubeGroupsStorage: S } = loadModules();

  assert.deepStrictEqual(plain(S.readSubscriptionsValue(undefined)), {});
  assert.deepStrictEqual(plain(S.readSubscriptionsValue(null)), {});
  assert.deepStrictEqual(plain(S.readSubscriptionsValue([])), {});
  assert.deepStrictEqual(plain(S.readSubscriptionsValue({ channels: [] })), {});
  assert.deepStrictEqual(
    plain(S.readSubscriptionsValue({ channels: "x" })),
    {},
  );
  assert.deepStrictEqual(
    plain(
      S.readSubscriptionsValue({ version: 1, channels: { a: { name: "A" } } }),
    ),
    { a: { name: "A" } },
  );
});

test("getSubscriptions sin datos devuelve {} y no escribe", async () => {
  const { YouTubeGroupsStorage, calls } = loadModules();

  const subscriptions = await YouTubeGroupsStorage.getSubscriptions();

  assert.deepStrictEqual(plain(subscriptions), {});
  assert.strictEqual(calls.set, 0);
});

test("saveSubscriptions y getSubscriptions conservan el mapa con version 1", async () => {
  const { YouTubeGroupsStorage, store } = loadModules();
  const map = {
    "https://www.youtube.com/@foo": {
      name: "Foo",
      url: "https://www.youtube.com/@foo",
      firstSeen: 1,
    },
  };

  await YouTubeGroupsStorage.saveSubscriptions(map);
  const loaded = await YouTubeGroupsStorage.getSubscriptions();

  assert.deepStrictEqual(plain(loaded), map);
  assert.deepStrictEqual(plain(store.youtubeSubscriptions), {
    version: 1,
    channels: map,
  });
});

test("saveSubscriptions con algo que no es un objeto plano lanza TypeError", async () => {
  const { YouTubeGroupsStorage } = loadModules();

  for (const invalid of [[], null, 5]) {
    await assert.rejects(
      () => YouTubeGroupsStorage.saveSubscriptions(invalid),
      (error) => error.name === "TypeError",
    );
  }
});

test("saveAvatars con algo que no es un objeto plano lanza TypeError", async () => {
  const { YouTubeGroupsStorage } = loadModules();

  for (const invalid of [[], null, 5]) {
    await assert.rejects(
      () => YouTubeGroupsStorage.saveAvatars(invalid),
      (error) => error.name === "TypeError",
    );
  }
});
