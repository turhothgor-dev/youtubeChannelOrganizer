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

test("saveGroups con algo que no es un array lanza TypeError", async () => {
  const { YouTubeGroupsStorage } = loadModules();

  await assert.rejects(
    () => YouTubeGroupsStorage.saveGroups({}),
    (error) => error.name === "TypeError",
  );
});
