"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { loadModules, plain } = require("./helpers/load-modules");

const X = "https://www.youtube.com/@x";

function tree() {
  return [
    {
      id: "a",
      name: "A",
      channels: [
        { name: "X", url: X },
        { name: "", url: "https://www.youtube.com/@n" },
        { name: "Sin url" },
      ],
      subgroups: [
        {
          id: "a1",
          name: "A1",
          channels: [],
          subgroups: [{ id: "a1a", name: "A1a", channels: [], subgroups: [] }],
        },
      ],
    },
    { id: "b", name: "B", channels: [], subgroups: [] },
  ];
}

test("getGuideColumn normaliza la URL de los canales y omite los no normalizables", () => {
  const { YouTubeGroupsGuide: G } = loadModules();
  const groups = [
    {
      id: "g",
      name: "G",
      channels: [
        { name: "X", url: `${X}?a=1` },
        { name: "Malo", url: "https://example.com/@x" },
      ],
      subgroups: [],
    },
  ];

  const column = plain(G.getGuideColumn(groups, []));
  assert.deepStrictEqual(column.items[0].channels, [{ name: "X", url: X }]);
});

test("getGuideColumn da la raíz y la columna de un grupo", () => {
  const { YouTubeGroupsGuide: G } = loadModules();
  const groups = tree();
  const before = JSON.stringify(groups);

  const root = plain(G.getGuideColumn(groups, []));
  assert.deepStrictEqual(root.path, []);
  assert.strictEqual(root.parent, null);
  assert.deepStrictEqual(
    root.items.map((i) => [i.id, i.hasSubgroups]),
    [
      ["a", true],
      ["b", false],
    ],
  );
  assert.deepStrictEqual(root.items[0].channels, [
    { name: "X", url: X },
    { name: "https://www.youtube.com/@n", url: "https://www.youtube.com/@n" },
  ]);

  const inA = plain(G.getGuideColumn(groups, ["a"]));
  assert.deepStrictEqual(inA.parent, { id: "a", name: "A" });
  assert.deepStrictEqual(
    inA.items.map((i) => i.id),
    ["a1"],
  );
  assert.strictEqual(JSON.stringify(groups), before);
});

test("normalizeGuidePath recorta rutas inválidas", () => {
  const { YouTubeGroupsGuide: G } = loadModules();
  const groups = tree();
  assert.deepStrictEqual(plain(G.normalizeGuidePath(groups, ["a", "a1"])), [
    "a",
    "a1",
  ]);
  assert.deepStrictEqual(plain(G.normalizeGuidePath(groups, ["a", "zzz"])), [
    "a",
  ]);
  assert.deepStrictEqual(plain(G.normalizeGuidePath(groups, ["a", "a1a"])), [
    "a",
  ]);
  assert.deepStrictEqual(plain(G.normalizeGuidePath(groups, ["a1a"])), []);
  assert.deepStrictEqual(plain(G.normalizeGuidePath(groups, ["b"])), ["b"]);
  assert.deepStrictEqual(
    plain(G.normalizeGuidePath(groups, ["a", "a1", "a1a"])),
    ["a", "a1", "a1a"],
  );
  assert.deepStrictEqual(
    plain(G.normalizeGuidePath(groups, ["a", "a1", "a1a", "zzz"])),
    ["a", "a1", "a1a"],
  );
  assert.deepStrictEqual(plain(G.normalizeGuidePath(groups, "a")), []);
  assert.deepStrictEqual(plain(G.normalizeGuidePath(groups, null)), []);
});

test("enterGuideGroup y leaveGuideGroup", () => {
  const { YouTubeGroupsGuide: G } = loadModules();
  const groups = tree();
  assert.deepStrictEqual(plain(G.enterGuideGroup(groups, [], "a")), ["a"]);
  assert.deepStrictEqual(plain(G.enterGuideGroup(groups, ["a"], "a1")), [
    "a",
    "a1",
  ]);
  assert.deepStrictEqual(plain(G.enterGuideGroup(groups, [], "a1")), []);
  assert.deepStrictEqual(plain(G.enterGuideGroup(groups, [], "b")), ["b"]);
  assert.deepStrictEqual(plain(G.enterGuideGroup(groups, ["a"], "a1a")), ["a"]);
  assert.deepStrictEqual(plain(G.enterGuideGroup(groups, ["a", "a1"], "a1a")), [
    "a",
    "a1",
    "a1a",
  ]);
  assert.deepStrictEqual(plain(G.leaveGuideGroup(["a", "a1"])), ["a"]);
  assert.deepStrictEqual(plain(G.leaveGuideGroup([])), []);
});

test("findGuidePath da la ruta hasta un grupo o null", () => {
  const { YouTubeGroupsGuide: G } = loadModules();
  const groups = tree();
  assert.deepStrictEqual(plain(G.findGuidePath(groups, "a1a")), [
    "a",
    "a1",
    "a1a",
  ]);
  assert.deepStrictEqual(plain(G.findGuidePath(groups, "b")), ["b"]);
  assert.strictEqual(G.findGuidePath(groups, "zzz"), null);
  assert.strictEqual(G.findGuidePath(null, "a"), null);
});

test("getCreateTarget decide dónde se crea según selección y columna", () => {
  const { YouTubeGroupsGuide: G } = loadModules();
  const groups = tree();

  assert.deepStrictEqual(plain(G.getCreateTarget(groups, [], [])), {
    parentId: null,
    parentName: null,
    label: "+ Grupo",
    title: "Crear grupo",
  });
  assert.deepStrictEqual(plain(G.getCreateTarget(groups, ["a"], [])), {
    parentId: "a",
    parentName: "A",
    label: "+ Subgrupo",
    title: "Crear subgrupo en «A»",
  });
  assert.strictEqual(
    G.getCreateTarget(groups, ["a"], ["group:b"]).parentId,
    "b",
  );
  const multi = plain(
    G.getCreateTarget(groups, [], ["group:a", `channel:${X}`, "group:a1"]),
  );
  assert.strictEqual(multi.parentId, "a1");
  assert.strictEqual(multi.label, "+ Subgrupo");
  assert.strictEqual(
    multi.title,
    "Crear subgrupo en «A1» (último seleccionado)",
  );
  const stale = G.getCreateTarget(groups, [], ["group:a", "group:zzz"]);
  assert.strictEqual(stale.label, "+ Subgrupo");
  assert.strictEqual(stale.title, "Crear subgrupo en «A»");
  const onlyChannels = G.getCreateTarget(groups, [], [`channel:${X}`]);
  assert.strictEqual(onlyChannels.label, "+ Grupo");
  assert.strictEqual(onlyChannels.title, "Crear grupo");
  assert.strictEqual(
    G.getCreateTarget(groups, ["a"], [`channel:${X}`]).label,
    "+ Subgrupo",
  );
  assert.strictEqual(
    G.getCreateTarget(groups, ["a"], [`channel:${X}`]).parentId,
    "a",
  );
  assert.strictEqual(G.getCreateTarget(groups, [], null).parentId, null);
});

test("isChannelListOpen aplica override, selección y profundidad", () => {
  const { YouTubeGroupsGuide: G } = loadModules();
  const item = { id: "a", channels: [{ name: "X", url: X }] };
  const none = new Map();

  assert.strictEqual(G.isChannelListOpen(none, item, 0, []), false);
  assert.strictEqual(G.isChannelListOpen(none, item, 1, []), true);
  assert.strictEqual(
    G.isChannelListOpen(new Map([["a", true]]), item, 0, []),
    true,
  );
  assert.strictEqual(
    G.isChannelListOpen(new Map([["a", false]]), item, 1, []),
    false,
  );
  assert.strictEqual(
    G.isChannelListOpen(none, item, 0, [`channel:a:${X}`]),
    true,
  );
  assert.strictEqual(
    G.isChannelListOpen(none, item, 0, ["group:b", `channel:a:${X}`]),
    true,
  );
  assert.strictEqual(
    G.isChannelListOpen(none, item, 0, [`channel:b:${X}`]),
    false,
  );
  assert.strictEqual(G.isChannelListOpen(none, item, 0, ["group:a"]), false);
  assert.strictEqual(
    G.isChannelListOpen(new Map([["a", false]]), item, 0, [`channel:a:${X}`]),
    false,
  );
});

test("findGuideInsertionIndex localiza la sección Más de YouTube", () => {
  const { YouTubeGroupsGuide: G } = loadModules();
  const sections = [
    ["/", "/feed/subscriptions"],
    ["/feed/history", "not a url ::", "/@x"],
    [
      "/feed/history",
      "https://studio.youtube.com/",
      "https://music.youtube.com/",
    ],
  ];
  const before = JSON.stringify(sections);
  assert.strictEqual(G.findGuideInsertionIndex(sections), 2);
  assert.strictEqual(
    G.findGuideInsertionIndex([["/"], ["https://music.youtube.com/"]]),
    1,
  );
  assert.strictEqual(G.findGuideInsertionIndex(sections.slice(0, 2)), -1);
  assert.strictEqual(G.findGuideInsertionIndex([]), -1);
  assert.strictEqual(JSON.stringify(sections), before);
});
