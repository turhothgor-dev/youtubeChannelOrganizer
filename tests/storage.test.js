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

test("saveGroups con algo que no es un array lanza TypeError", async () => {
  const { YouTubeGroupsStorage } = loadModules();

  await assert.rejects(
    () => YouTubeGroupsStorage.saveGroups({}),
    (error) => error.name === "TypeError",
  );
});
