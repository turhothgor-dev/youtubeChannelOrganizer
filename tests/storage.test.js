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

test("saveGroups con algo que no es un array lanza TypeError", async () => {
  const { YouTubeGroupsStorage } = loadModules();

  await assert.rejects(
    () => YouTubeGroupsStorage.saveGroups({}),
    (error) => error.name === "TypeError",
  );
});
