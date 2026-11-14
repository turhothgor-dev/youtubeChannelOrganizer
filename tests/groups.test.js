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

function seedGroups() {
  const sub = {
    id: "s1",
    name: "Hijo",
    type: "subgroup",
    parentId: "g1",
    channels: [],
    subgroups: [],
  };
  const g1 = {
    id: "g1",
    name: "Padre",
    type: "group",
    channels: [],
    subgroups: [sub],
  };
  const g2 = {
    id: "g2",
    name: "Otro",
    type: "group",
    channels: [{ name: "Canal", url: `${YT}/@handle` }],
    subgroups: [],
  };
  return { version: 1, groups: [g1, g2] };
}

const CHANNEL = { name: "Canal", url: `${YT}/@handle?x=1` };

test("applyChannelGroupSelection añade en grupo y subgrupo anidado y quita de otro", () => {
  const { YouTubeGroups } = loadModules();
  const { groups } = seedGroups();

  const result = YouTubeGroups.applyChannelGroupSelection(groups, CHANNEL, [
    "g1",
    "s1",
  ]);

  assert.deepStrictEqual(plain(result.addedGroupIds), ["g1", "s1"]);
  assert.deepStrictEqual(plain(result.removedGroupIds), ["g2"]);
  const out = plain(result.groups);
  const expected = [{ name: "Canal", url: `${YT}/@handle` }];
  assert.deepStrictEqual(out[0].channels, expected);
  assert.deepStrictEqual(out[0].subgroups[0].channels, expected);
  assert.deepStrictEqual(out[1].channels, []);
});

test("applyChannelGroupSelection sin cambios, canal ya presente e ids desconocidos", () => {
  const { YouTubeGroups } = loadModules();
  const { groups } = seedGroups();

  const result = YouTubeGroups.applyChannelGroupSelection(groups, CHANNEL, [
    "g2",
    "nope",
  ]);

  assert.deepStrictEqual(plain(result.addedGroupIds), []);
  assert.deepStrictEqual(plain(result.removedGroupIds), []);
  assert.strictEqual(plain(result.groups)[1].channels.length, 1);
});

test("applyChannelGroupSelection valida canal y URL", () => {
  const { YouTubeGroups } = loadModules();
  const { groups } = seedGroups();
  const apply = YouTubeGroups.applyChannelGroupSelection;

  assert.throws(() => apply(groups, { name: "", url: CHANNEL.url }, []), {
    message: "El canal debe incluir nombre y URL.",
  });
  assert.throws(() => apply(groups, { name: "X" }, []), {
    message: "El canal debe incluir nombre y URL.",
  });
  assert.throws(
    () => apply(groups, { name: "X", url: `${YT}/watch?v=1` }, []),
    {
      message: "URL de canal inválida.",
    },
  );
});

test("applyChannelGroupSelection no muta la entrada", () => {
  const { YouTubeGroups } = loadModules();
  const { groups } = seedGroups();
  const before = plain(groups);

  YouTubeGroups.applyChannelGroupSelection(groups, CHANNEL, ["g1", "s1"]);

  assert.deepStrictEqual(plain(groups), before);
});

test("setChannelGroups escribe una sola vez con cambios", async () => {
  const { YouTubeGroups, YouTubeGroupsStorage, calls } = loadModules({
    youtubeGroups: seedGroups(),
  });

  const result = await YouTubeGroups.setChannelGroups(CHANNEL, ["g1", "s1"]);

  assert.strictEqual(calls.set, 1);
  assert.deepStrictEqual(plain(result.addedGroupIds), ["g1", "s1"]);
  const saved = plain(await YouTubeGroupsStorage.getGroups());
  assert.strictEqual(saved[0].channels.length, 1);
  assert.strictEqual(saved[1].channels.length, 0);
});

test("setChannelGroups no escribe sin cambios ni con error", async () => {
  const { YouTubeGroups, calls } = loadModules({
    youtubeGroups: seedGroups(),
  });

  await YouTubeGroups.setChannelGroups(CHANNEL, ["g2"]);
  assert.strictEqual(calls.set, 0);

  await assert.rejects(
    YouTubeGroups.setChannelGroups({ name: "", url: "" }, ["g1"]),
    {
      message: "El canal debe incluir nombre y URL.",
    },
  );
  assert.strictEqual(calls.set, 0);
});
