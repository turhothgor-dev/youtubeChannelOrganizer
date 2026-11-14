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

test("getGroupChannelUrls reúne canales propios y de descendientes", () => {
  const { YouTubeGroups } = loadModules();
  const { groups } = seedGroups();
  groups[0].channels.push({ name: "A", url: `${YT}/@a` });
  groups[0].subgroups[0].channels.push({ name: "B", url: `${YT}/@b` });

  const parent = YouTubeGroups.getGroupChannelUrls(groups, "g1");
  assert.deepStrictEqual([...parent].sort(), [`${YT}/@a`, `${YT}/@b`]);

  const sub = YouTubeGroups.getGroupChannelUrls(groups, "s1");
  assert.deepStrictEqual([...sub], [`${YT}/@b`]);
});

test("getGroupChannelUrls devuelve Set vacío sin canales y null si no existe", () => {
  const { YouTubeGroups } = loadModules();
  const { groups } = seedGroups();

  assert.strictEqual(YouTubeGroups.getGroupChannelUrls(groups, "s1").size, 0);
  assert.strictEqual(YouTubeGroups.getGroupChannelUrls(groups, "nope"), null);
});

function nestedGroups() {
  const leaf = {
    id: "s2",
    name: "Nieto",
    type: "subgroup",
    channels: [],
    subgroups: [],
  };
  const sibling = {
    id: "s3",
    name: "Hermano",
    type: "subgroup",
    channels: [],
    subgroups: [],
  };
  const mid = {
    id: "s1",
    name: "Hijo",
    type: "subgroup",
    channels: [],
    subgroups: [leaf],
  };
  const g1 = {
    id: "g1",
    name: "Padre",
    type: "group",
    channels: [],
    subgroups: [mid, sibling],
  };
  const g2 = {
    id: "g2",
    name: "Otro",
    type: "group",
    channels: [],
    subgroups: [],
  };
  return [g1, g2];
}

test("removeGroupById borra un grupo de primer nivel con sus descendientes", () => {
  const { YouTubeGroups } = loadModules();

  const result = YouTubeGroups.removeGroupById(nestedGroups(), "g1");

  assert.deepStrictEqual(plain(result.removedIds).sort(), [
    "g1",
    "s1",
    "s2",
    "s3",
  ]);
  assert.deepStrictEqual(
    plain(result.groups).map((g) => g.id),
    ["g2"],
  );
});

test("removeGroupById borra un subgrupo de segundo nivel y respeta padre y hermanos", () => {
  const { YouTubeGroups } = loadModules();

  const result = YouTubeGroups.removeGroupById(nestedGroups(), "s2");

  assert.deepStrictEqual(plain(result.removedIds), ["s2"]);
  const g1 = plain(result.groups)[0];
  assert.deepStrictEqual(
    g1.subgroups.map((g) => g.id),
    ["s1", "s3"],
  );
  assert.deepStrictEqual(g1.subgroups[0].subgroups, []);
  assert.strictEqual(result.groups.length, 2);
});

test("removeGroupById lanza si el id no existe y no muta la entrada", () => {
  const { YouTubeGroups } = loadModules();
  const groups = nestedGroups();
  const before = plain(groups);

  assert.throws(() => YouTubeGroups.removeGroupById(groups, "nope"), {
    message: "No existe el grupo indicado.",
  });
  YouTubeGroups.removeGroupById(groups, "s1");
  assert.deepStrictEqual(plain(groups), before);
});

test("deleteGroup quita un subgrupo anidado con una sola escritura y devuelve sus ids", async () => {
  const { YouTubeGroups, YouTubeGroupsStorage, calls } = loadModules({
    youtubeGroups: { version: 1, groups: nestedGroups() },
  });

  const removedIds = await YouTubeGroups.deleteGroup("s1");

  assert.strictEqual(calls.set, 1);
  assert.deepStrictEqual(plain(removedIds).sort(), ["s1", "s2"]);
  const saved = plain(await YouTubeGroupsStorage.getGroups());
  assert.deepStrictEqual(
    saved[0].subgroups.map((g) => g.id),
    ["s3"],
  );
});

test("deleteGroup con id desconocido lanza y no escribe", async () => {
  const { YouTubeGroups, calls } = loadModules({
    youtubeGroups: { version: 1, groups: nestedGroups() },
  });

  await assert.rejects(YouTubeGroups.deleteGroup("nope"), {
    message: "No existe el grupo indicado.",
  });
  assert.strictEqual(calls.set, 0);
});

test("renameGroup y setGroupAppearance modifican un subgrupo anidado", async () => {
  const { YouTubeGroups, YouTubeGroupsStorage } = loadModules({
    youtubeGroups: { version: 1, groups: nestedGroups() },
  });

  await YouTubeGroups.renameGroup("s2", "Nuevo");
  await YouTubeGroups.setGroupAppearance("s2", "tech", "#2196F3");
  await YouTubeGroups.setGroupAppearance("s2", "music", "#4CAF50");

  const saved = plain(await YouTubeGroupsStorage.getGroups());
  const nested = saved[0].subgroups[0].subgroups[0];
  assert.strictEqual(nested.name, "Nuevo");
  assert.strictEqual(nested.icon, "music");
  assert.strictEqual(nested.color, "#4CAF50");
});

test("getGroupAppearance devuelve icono y color propios", () => {
  const { YouTubeGroups } = loadModules();
  const groups = nestedGroups();
  groups[0].icon = "music";
  groups[0].color = "#4CAF50";

  assert.deepStrictEqual(
    plain(YouTubeGroups.getGroupAppearance(groups, "g1")),
    { icon: "music", color: "#4CAF50" },
  );
});

test("getGroupAppearance hereda el color del antecesor más cercano", () => {
  const { YouTubeGroups } = loadModules();
  const groups = nestedGroups();
  groups[0].color = "#4CAF50";
  groups[0].subgroups[0].subgroups[0].icon = "tech";

  // Sin color en el padre: toma el del abuelo.
  assert.deepStrictEqual(
    plain(YouTubeGroups.getGroupAppearance(groups, "s2")),
    { icon: "tech", color: "#4CAF50" },
  );

  // Con color en el padre: toma el del padre.
  groups[0].subgroups[0].color = "#2196F3";
  assert.strictEqual(
    YouTubeGroups.getGroupAppearance(groups, "s2").color,
    "#2196F3",
  );

  // Con color propio: no hereda.
  groups[0].subgroups[0].subgroups[0].color = "#F44336";
  assert.strictEqual(
    YouTubeGroups.getGroupAppearance(groups, "s2").color,
    "#F44336",
  );
});

test("getGroupAppearance no hereda el icono", () => {
  const { YouTubeGroups } = loadModules();
  const groups = nestedGroups();
  groups[0].icon = "music";
  groups[0].subgroups[0].icon = "";

  assert.strictEqual(YouTubeGroups.getGroupAppearance(groups, "s1").icon, "");
});

test("getGroupAppearance ignora iconos inexistentes y formato antiguo", () => {
  const { YouTubeGroups } = loadModules();
  const groups = nestedGroups();
  groups[0].icon = "nope";

  assert.strictEqual(YouTubeGroups.getGroupAppearance(groups, "g1").icon, "");
  assert.deepStrictEqual(
    plain(YouTubeGroups.getGroupAppearance(groups, "g2")),
    { icon: "", color: "" },
  );
});

test("getGroupAppearance devuelve null si el grupo no existe y no muta", () => {
  const { YouTubeGroups } = loadModules();
  const groups = nestedGroups();
  groups[0].color = "#4CAF50";
  const before = JSON.stringify(groups);

  assert.strictEqual(YouTubeGroups.getGroupAppearance(groups, "zzz"), null);
  YouTubeGroups.getGroupAppearance(groups, "s2");
  assert.strictEqual(JSON.stringify(groups), before);
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

test("dos createGroup a la vez dejan dos grupos", async () => {
  const { YouTubeGroups, store } = loadModules({}, { latencyMs: 5 });

  await Promise.all([
    YouTubeGroups.createGroup("Uno"),
    YouTubeGroups.createGroup("Dos"),
  ]);

  assert.deepStrictEqual(
    store.youtubeGroups.groups.map((group) => group.name).sort(),
    ["Dos", "Uno"],
  );
});

test("setChannelGroups de dos canales a la vez al mismo grupo conserva los dos", async () => {
  const { YouTubeGroups, store } = loadModules(
    { youtubeGroups: seedGroups() },
    { latencyMs: 5 },
  );
  const other = { name: "Otro canal", url: `${YT}/@otro` };

  await Promise.all([
    YouTubeGroups.setChannelGroups(CHANNEL, ["g1", "g2"]),
    YouTubeGroups.setChannelGroups(other, ["g1"]),
  ]);

  const g1 = store.youtubeGroups.groups.find((group) => group.id === "g1");
  assert.deepStrictEqual(g1.channels.map((channel) => channel.url).sort(), [
    `${YT}/@handle`,
    `${YT}/@otro`,
  ]);
});

test("createSubGroup y setGroupAppearance a la vez conservan ambos cambios", async () => {
  const { YouTubeGroups, store } = loadModules(
    { youtubeGroups: seedGroups() },
    { latencyMs: 5 },
  );

  await Promise.all([
    YouTubeGroups.createSubGroup("g2", "Nuevo"),
    YouTubeGroups.setGroupAppearance("g2", "", "#ff0000"),
  ]);

  const g2 = store.youtubeGroups.groups.find((group) => group.id === "g2");
  assert.strictEqual(g2.subgroups.length, 1);
  assert.strictEqual(g2.subgroups[0].name, "Nuevo");
  assert.strictEqual(g2.color, "#ff0000");
});

test("renameGroup inexistente a la vez que createGroup rechaza y guarda el grupo nuevo", async () => {
  const { YouTubeGroups, store } = loadModules({}, { latencyMs: 5 });

  const [renamed, created] = await Promise.allSettled([
    YouTubeGroups.renameGroup("no-existe", "X"),
    YouTubeGroups.createGroup("Nuevo"),
  ]);

  assert.strictEqual(renamed.status, "rejected");
  assert.strictEqual(created.status, "fulfilled");
  assert.deepStrictEqual(
    store.youtubeGroups.groups.map((group) => group.name),
    ["Nuevo"],
  );
});

test("flattenGroups devuelve el preorden con el nivel de cada grupo", () => {
  const { YouTubeGroups } = loadModules();
  const groups = [
    {
      id: "a",
      name: "A",
      subgroups: [
        { id: "a1", name: "A1", subgroups: [{ id: "a1x", name: "A1X" }] },
        { id: "a2", name: "A2", subgroups: [] },
      ],
    },
    { id: "b", name: "B", subgroups: [{ id: "b1", name: "B1" }] },
  ];

  assert.deepStrictEqual(plain(YouTubeGroups.flattenGroups(groups)), [
    { id: "a", name: "A", level: 0 },
    { id: "a1", name: "A1", level: 1 },
    { id: "a1x", name: "A1X", level: 2 },
    { id: "a2", name: "A2", level: 1 },
    { id: "b", name: "B", level: 0 },
    { id: "b1", name: "B1", level: 1 },
  ]);
});

test("flattenGroups acepta lista vacía y grupos sin subgroups", () => {
  const { YouTubeGroups } = loadModules();

  assert.deepStrictEqual(plain(YouTubeGroups.flattenGroups([])), []);
  assert.deepStrictEqual(
    plain(YouTubeGroups.flattenGroups([{ id: "a", name: "A" }])),
    [{ id: "a", name: "A", level: 0 }],
  );
});

test("flattenGroups no muta la entrada", () => {
  const { YouTubeGroups } = loadModules();
  const groups = [
    { id: "a", name: "A", subgroups: [{ id: "a1", name: "A1" }] },
  ];
  const before = JSON.stringify(groups);

  YouTubeGroups.flattenGroups(groups);

  assert.strictEqual(JSON.stringify(groups), before);
});

const ch = (name, url) => ({ name, url });
const grp = (id, channels, subgroups) => ({
  id,
  name: id.toUpperCase(),
  channels,
  subgroups: subgroups || [],
});

test("analyzeGroups detecta repetidos en el mismo grupo y conserva el primero", () => {
  const { YouTubeGroups } = loadModules();
  const result = plain(
    YouTubeGroups.analyzeGroups([
      grp("a", [ch("Foo", `${YT}/@Foo`), ch("foo", `${YT}/@foo`)]),
      grp("b", [ch("foo", `${YT}/@foo`)]),
    ]),
  );

  assert.strictEqual(result.duplicates.length, 1);
  assert.strictEqual(result.duplicates[0].groupId, "a");
  assert.strictEqual(result.duplicates[0].url, `${YT}/@foo`);
  assert.strictEqual(result.duplicates[0].keptUrl, `${YT}/@Foo`);
});

test("analyzeGroups trata /@%C3%B1u y /@ñu como repetidos y /channel y /@x no", () => {
  const { YouTubeGroups } = loadModules();
  const result = plain(
    YouTubeGroups.analyzeGroups([
      grp("a", [
        ch("n1", `${YT}/@%C3%91u`),
        ch("n2", `${YT}/@%C3%B1u`),
        ch("x1", `${YT}/channel/UCx`),
        ch("x2", `${YT}/@x`),
      ]),
    ]),
  );

  assert.strictEqual(result.duplicates.length, 1);
  assert.strictEqual(result.duplicates[0].name, "n2");
});

test("analyzeGroups marca URL no válidas", () => {
  const { YouTubeGroups } = loadModules();
  const result = plain(
    YouTubeGroups.analyzeGroups([
      grp("a", [
        ch("j", "javascript:x"),
        ch("w", `${YT}/watch?v=1`),
        ch("ok", `${YT}/@ok`),
      ]),
    ]),
  );

  assert.strictEqual(result.invalid.length, 2);
  assert.strictEqual(result.duplicates.length, 0);
});

test("analyzeGroups informa solo del grupo vacío más alto y no vacía si un subgrupo tiene canales", () => {
  const { YouTubeGroups } = loadModules();
  const result = plain(
    YouTubeGroups.analyzeGroups([
      grp("a", [], [grp("a1", [])]),
      grp("b", [], [grp("b1", [ch("x", `${YT}/@x`)])]),
    ]),
  );

  assert.deepStrictEqual(result.emptyGroups, [{ id: "a", name: "A" }]);
});

test("applyCleanup con todo false no cambia nada", () => {
  const { YouTubeGroups } = loadModules();
  const groups = [
    grp("a", [
      ch("F", `${YT}/@F`),
      ch("f", `${YT}/@f`),
      ch("j", "javascript:x"),
    ]),
    grp("e", []),
  ];
  const result = plain(
    YouTubeGroups.applyCleanup(groups, {
      duplicates: false,
      invalid: false,
      emptyGroups: false,
    }),
  );

  assert.strictEqual(result.changed, false);
  assert.deepStrictEqual(result.groups, groups);
  assert.deepStrictEqual(result.removedGroupIds, []);
});

test("applyCleanup quita repetidos e inválidas y después los grupos que quedan vacíos sin mutar", () => {
  const { YouTubeGroups } = loadModules();
  const groups = [
    grp("a", [ch("F", `${YT}/@F`), ch("f", `${YT}/@f`)]),
    grp("b", [ch("j", "javascript:x")], [grp("b1", [])]),
  ];
  const before = JSON.stringify(groups);

  const result = plain(
    YouTubeGroups.applyCleanup(groups, {
      duplicates: true,
      invalid: true,
      emptyGroups: true,
    }),
  );

  assert.strictEqual(JSON.stringify(groups), before);
  assert.strictEqual(result.changed, true);
  assert.strictEqual(result.groups.length, 1);
  assert.deepStrictEqual(result.groups[0].channels, [ch("F", `${YT}/@F`)]);
  assert.deepStrictEqual(result.removedGroupIds.sort(), ["b", "b1"]);
});

test("applyCleanup corrige las URL recuperables y quita las irrecuperables", () => {
  const { YouTubeGroups } = loadModules();
  const groups = [
    grp("a", [
      ch("Ñu", `${YT}/@ñu`),
      ch("X", `${YT}/@x?a=1`),
      { name: "num", url: 42 },
      ch("txt", "no-url"),
      ch("otro", "https://example.com/@x"),
    ]),
  ];

  const result = plain(YouTubeGroups.applyCleanup(groups, { invalid: true }));

  assert.strictEqual(result.changed, true);
  assert.deepStrictEqual(result.groups[0].channels, [
    ch("Ñu", `${YT}/@%C3%B1u`),
    ch("X", `${YT}/@x`),
  ]);
});

test("applyCleanup quita la recuperable cuya URL corregida ya está en el grupo", () => {
  const { YouTubeGroups } = loadModules();
  const groups = [
    grp("a", [ch("X1", `${YT}/@x?a=1`), ch("X2", `${YT}/@x`)]),
    grp("b", [ch("Y1", `${YT}/@y?a=1`), ch("Y2", `${YT}/@y#b`)]),
  ];

  const result = plain(YouTubeGroups.applyCleanup(groups, { invalid: true }));

  assert.strictEqual(result.changed, true);
  assert.deepStrictEqual(result.groups[0].channels, [ch("X2", `${YT}/@x`)]);
  assert.deepStrictEqual(result.groups[1].channels, [ch("Y1", `${YT}/@y`)]);
});

test("analyzeGroups da fixedUrl en las recuperables y null en las demás", () => {
  const { YouTubeGroups } = loadModules();
  const result = plain(
    YouTubeGroups.analyzeGroups([
      grp("a", [
        ch("n", `${YT}/@ñu`),
        ch("x", `${YT}/@x?a=1`),
        ch("j", "javascript:x"),
        { name: "num", url: 42 },
      ]),
    ]),
  );

  assert.deepStrictEqual(
    result.invalid.map((item) => item.fixedUrl),
    [`${YT}/@%C3%B1u`, `${YT}/@x`, null, null],
  );
});

test("cleanupGroups sin nada que limpiar no escribe", async () => {
  const { YouTubeGroups, calls } = loadModules({
    youtubeGroups: { version: 1, groups: [grp("a", [ch("x", `${YT}/@x`)])] },
  });

  const result = await YouTubeGroups.cleanupGroups({
    duplicates: true,
    invalid: true,
    emptyGroups: true,
  });

  assert.strictEqual(result.changed, false);
  assert.strictEqual(calls.set, 0);
});

test("cleanupGroups con duplicados escribe una vez", async () => {
  const { YouTubeGroups, store, calls } = loadModules({
    youtubeGroups: {
      version: 1,
      groups: [grp("a", [ch("F", `${YT}/@F`), ch("f", `${YT}/@f`)])],
    },
  });

  const result = await YouTubeGroups.cleanupGroups({ duplicates: true });

  assert.strictEqual(result.changed, true);
  assert.strictEqual(calls.set, 1);
  assert.deepStrictEqual(store.youtubeGroups.groups[0].channels.length, 1);
});

test("buildChannelNameIndex incluye subgrupos, repite misma URL y excluye nombres ambiguos", () => {
  const { YouTubeGroups } = loadModules();
  const groups = [
    grp(
      "a",
      [
        ch(" Uno ", `${YT}/@uno`),
        ch("Dup", `${YT}/@x`),
        ch("Mismo", `${YT}/@m`),
      ],
      [
        grp("b", [
          ch("Sub", `${YT}/@sub`),
          ch("Dup", `${YT}/@y`),
          ch("Mismo", `${YT}/@m`),
        ]),
      ],
    ),
  ];

  const index = YouTubeGroups.buildChannelNameIndex(groups);

  assert.strictEqual(index.get("Uno"), `${YT}/@uno`);
  assert.strictEqual(index.get("Sub"), `${YT}/@sub`);
  assert.strictEqual(index.get("Mismo"), `${YT}/@m`);
  assert.strictEqual(index.has("Dup"), false);
});

test("matchChannelByTexts devuelve el canal si los textos coinciden con una sola URL", () => {
  const { YouTubeGroups } = loadModules();
  const index = YouTubeGroups.buildChannelNameIndex([
    grp("a", [ch("Uno", `${YT}/@uno`), ch("Dos", `${YT}/@dos`)]),
  ]);

  assert.deepStrictEqual(
    plain(YouTubeGroups.matchChannelByTexts(index, ["Título", "  Uno  "])),
    { name: "Uno", url: `${YT}/@uno` },
  );
  assert.deepStrictEqual(
    plain(YouTubeGroups.matchChannelByTexts(index, ["Uno", "Uno"])),
    { name: "Uno", url: `${YT}/@uno` },
  );
  assert.strictEqual(
    YouTubeGroups.matchChannelByTexts(index, ["Uno", "Dos"]),
    null,
  );
  assert.strictEqual(
    YouTubeGroups.matchChannelByTexts(index, ["Nada", "Otro"]),
    null,
  );
});

test("cleanupGroups a la vez que createGroup no pierde el grupo creado", async () => {
  const { YouTubeGroups, store } = loadModules(
    {
      youtubeGroups: {
        version: 1,
        groups: [grp("a", [ch("F", `${YT}/@F`), ch("f", `${YT}/@f`)])],
      },
    },
    { latencyMs: 5 },
  );

  await Promise.all([
    YouTubeGroups.cleanupGroups({ duplicates: true }),
    YouTubeGroups.createGroup("Nuevo"),
  ]);

  const groups = store.youtubeGroups.groups;
  assert.deepStrictEqual(
    groups.map((group) => group.name).sort(),
    ["Nuevo", "a".toUpperCase()].sort(),
  );
  assert.strictEqual(
    groups.find((group) => group.id === "a").channels.length,
    1,
  );
});
