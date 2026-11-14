"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { loadModules, plain } = require("./helpers/load-modules");

const YT = "https://www.youtube.com";

test("normalizeChannelUrl acepta los formatos de canal y limpia query y fragmento", () => {
  const { YouTubeGroups } = loadModules();
  const normalize = YouTubeGroups.normalizeChannelUrl;

  assert.strictEqual(normalize("/@handle"), `${YT}/@handle`);
  assert.strictEqual(normalize("/channel/UC123"), `${YT}/channel/UC123`);
  assert.strictEqual(normalize("/c/x"), `${YT}/c/x`);
  assert.strictEqual(normalize("/user/x"), `${YT}/user/x`);
  assert.strictEqual(normalize("/@handle/"), `${YT}/@handle`);
  assert.strictEqual(normalize(`${YT}/@handle?a=1#frag`), `${YT}/@handle`);
});

test("normalizeChannelUrl devuelve null si no es un canal", () => {
  const { YouTubeGroups } = loadModules();
  const normalize = YouTubeGroups.normalizeChannelUrl;

  assert.strictEqual(normalize("/watch?v=abc"), null);
  assert.strictEqual(normalize("/@handle/videos"), null);
  assert.strictEqual(normalize("https://example.com/@handle"), null);
});

test("createSubGroup anida el subgrupo con type y parentId", async () => {
  const { YouTubeGroups, YouTubeGroupsStorage } = loadModules();

  const parent = await YouTubeGroups.createGroup("Padre");
  const sub = await YouTubeGroups.createSubGroup(parent.id, "Hijo");

  const groups = plain(await YouTubeGroupsStorage.getGroups());
  assert.strictEqual(groups.length, 1);
  assert.strictEqual(groups[0].subgroups.length, 1);
  assert.strictEqual(groups[0].subgroups[0].id, sub.id);
  assert.strictEqual(groups[0].subgroups[0].type, "subgroup");
  assert.strictEqual(groups[0].subgroups[0].parentId, parent.id);
});

test("addChannelToGroup en un subgrupo guarda la URL normalizada y no duplica", async () => {
  const { YouTubeGroups, YouTubeGroupsStorage } = loadModules();

  const parent = await YouTubeGroups.createGroup("Padre");
  const sub = await YouTubeGroups.createSubGroup(parent.id, "Hijo");

  await YouTubeGroups.addChannelToGroup(sub.id, {
    name: "Canal",
    url: `${YT}/@handle?x=1`,
  });
  await YouTubeGroups.addChannelToGroup(sub.id, {
    name: "Canal",
    url: `${YT}/@handle/`,
  });

  const groups = plain(await YouTubeGroupsStorage.getGroups());
  assert.deepStrictEqual(groups[0].subgroups[0].channels, [
    { name: "Canal", url: `${YT}/@handle` },
  ]);
});
