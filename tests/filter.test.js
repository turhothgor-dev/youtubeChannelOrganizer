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
      channels: [{ name: "X", url: X }],
      subgroups: [
        {
          id: "a1",
          name: "A1",
          channels: [{ name: "Y", url: "https://www.youtube.com/@y" }],
          subgroups: [],
        },
      ],
    },
    { id: "b", name: "B", channels: [], subgroups: [] },
  ];
}

test("normalizeFilter acepta grupo y canal y descarta lo demás", () => {
  const { YouTubeGroupsFilter: F } = loadModules();

  assert.deepStrictEqual(plain(F.normalizeFilter({ type: "group", id: "a" })), {
    type: "group",
    id: "a",
  });
  assert.deepStrictEqual(
    plain(
      F.normalizeFilter({
        type: "channel",
        url: "https://www.youtube.com/@x?a=1",
        name: "X",
      }),
    ),
    { type: "channel", url: X, name: "X" },
  );
  assert.strictEqual(F.normalizeFilter({ type: "channel", url: X }).name, "");

  const invalids = [
    null,
    undefined,
    "group",
    { type: "otro" },
    { type: "group", id: "" },
    { type: "group" },
    { type: "channel", url: "https://example.com/@x" },
    { type: "channel", url: 42 },
    { type: "channel", url: "https://www.youtube.com/watch" },
  ];
  for (const raw of invalids) {
    assert.deepStrictEqual(plain(F.normalizeFilter(raw)), { type: "all" });
  }
  assert.ok(Object.isFrozen(F.ALL_FILTER));
});

test("getFilterKey distingue los tres tipos", () => {
  const { YouTubeGroupsFilter: F } = loadModules();

  assert.strictEqual(F.getFilterKey(F.ALL_FILTER), null);
  assert.strictEqual(F.getFilterKey({ type: "group", id: "a" }), "group:a");
  assert.strictEqual(
    F.getFilterKey({ type: "channel", url: `${X}?a=1` }),
    `channel:${X}`,
  );
  assert.strictEqual(F.getFilterKey(null), null);
});

test("resolveFilterUrls resuelve todos, grupo, canal y grupo inexistente", () => {
  const { YouTubeGroupsFilter: F } = loadModules();
  const groups = tree();

  assert.deepStrictEqual(plain(F.resolveFilterUrls(groups, F.ALL_FILTER)), {
    status: "all",
  });

  const group = F.resolveFilterUrls(groups, { type: "group", id: "a" });
  assert.strictEqual(group.status, "ok");
  assert.deepStrictEqual([...group.urls].sort(), [
    X,
    "https://www.youtube.com/@y",
  ]);

  const channel = F.resolveFilterUrls(groups, { type: "channel", url: X });
  assert.strictEqual(channel.status, "ok");
  assert.deepStrictEqual([...channel.urls], [X]);

  assert.deepStrictEqual(
    plain(F.resolveFilterUrls(groups, { type: "group", id: "nope" })),
    { status: "missing" },
  );
});

test("resolveFilterUrls con canal: subgrupo, huérfano y con parámetros", () => {
  const { YouTubeGroupsFilter: F } = loadModules();
  const groups = tree();
  const Y = "https://www.youtube.com/@y";

  const nested = F.resolveFilterUrls(groups, { type: "channel", url: Y });
  assert.strictEqual(nested.status, "ok");
  assert.deepStrictEqual([...nested.urls], [Y]);

  assert.deepStrictEqual(
    plain(
      F.resolveFilterUrls(groups, {
        type: "channel",
        url: "https://www.youtube.com/@z",
      }),
    ),
    { status: "missing" },
  );

  const withParams = [
    { id: "p", name: "P", channels: [{ name: "X", url: `${X}?a=1` }] },
  ];
  assert.strictEqual(
    F.resolveFilterUrls(withParams, { type: "channel", url: X }).status,
    "ok",
  );
});

test("las constantes del filtro pendiente se conservan", () => {
  const { YouTubeGroupsFilter: F } = loadModules();

  assert.strictEqual(F.PENDING_FILTER_KEY, "youtubeGroupsPendingFilter");
  assert.strictEqual(F.PENDING_MAX_AGE_MS, 30000);
});

const GA = { type: "group", id: "a" };
const GB = { type: "group", id: "b" };
const CX = { type: "channel", url: X, name: "X" };

test("parseFilterKey lee claves válidas y descarta el resto", () => {
  const { YouTubeGroupsFilter: F } = loadModules();

  assert.deepStrictEqual(plain(F.parseFilterKey("group:a")), GA);
  assert.deepStrictEqual(plain(F.parseFilterKey(`channel:${X}?a=1`)), {
    type: "channel",
    url: X,
    name: "",
  });
  assert.strictEqual(F.parseFilterKey("foo:a"), null);
  assert.strictEqual(F.parseFilterKey("group:"), null);
  assert.strictEqual(F.parseFilterKey(null), null);
  assert.strictEqual(F.parseFilterKey(5), null);
});

test("normalizeSelection quita repetidos e inválidos", () => {
  const { YouTubeGroupsFilter: F } = loadModules();

  assert.deepStrictEqual(
    plain(
      F.normalizeSelection(["group:a", "x", `channel:${X}?z=1`, "group:a", 3]),
    ),
    ["group:a", `channel:${X}`],
  );
  assert.deepStrictEqual(plain(F.normalizeSelection("group:a")), []);
  assert.deepStrictEqual(plain(F.normalizeSelection(undefined)), []);
});

test("toggleSelection añade, quita y no muta", () => {
  const { YouTubeGroupsFilter: F } = loadModules();

  assert.deepStrictEqual(plain(F.toggleSelection([], GA)), ["group:a"]);
  assert.deepStrictEqual(plain(F.toggleSelection(["group:a"], GB)), [
    "group:a",
    "group:b",
  ]);
  assert.deepStrictEqual(plain(F.toggleSelection(["group:a", "group:b"], GA)), [
    "group:b",
  ]);
  assert.deepStrictEqual(plain(F.toggleSelection(["group:b"], GA)), [
    "group:b",
    "group:a",
  ]);
  assert.deepStrictEqual(
    plain(
      F.toggleSelection(["group:b", `channel:${X}`], {
        type: "channel",
        url: `${X}?a=1`,
        name: "otro",
      }),
    ),
    ["group:b"],
  );
  assert.deepStrictEqual(
    plain(F.toggleSelection(["group:https://www.youtube.com/@x"], CX)),
    ["group:https://www.youtube.com/@x", `channel:${X}`],
  );
  assert.deepStrictEqual(plain(F.toggleSelection(["group:a"], null)), [
    "group:a",
  ]);
  assert.deepStrictEqual(plain(F.toggleSelection(["group:a"], F.ALL_FILTER)), [
    "group:a",
  ]);

  const input = ["group:a"];
  F.toggleSelection(input, GB);
  assert.deepStrictEqual(input, ["group:a"]);
});

test("clearSelection devuelve una selección vacía", () => {
  const { YouTubeGroupsFilter: F } = loadModules();
  assert.deepStrictEqual(plain(F.clearSelection()), []);
});

test("resolveSelection une las URL y descarta lo inexistente", () => {
  const { YouTubeGroupsFilter: F } = loadModules();
  const Y = "https://www.youtube.com/@y";
  const Z = "https://www.youtube.com/@z";
  const groups = tree();
  groups[1].channels.push({ name: "Z", url: Z });

  const union = F.resolveSelection(groups, ["group:a", `channel:${Z}`]);
  assert.deepStrictEqual(plain(union.selection), ["group:a", `channel:${Z}`]);
  assert.deepStrictEqual([...union.urls].sort(), [X, Y, Z].sort());

  const partial = F.resolveSelection(groups, [
    "group:borrado",
    "channel:https://www.youtube.com/@huerfano",
    "group:b",
  ]);
  assert.deepStrictEqual(plain(partial.selection), ["group:b"]);
  assert.deepStrictEqual([...partial.urls], [Z]);

  const none = F.resolveSelection(groups, ["group:borrado"]);
  assert.deepStrictEqual(plain(none.selection), []);
  assert.strictEqual(none.urls, null);

  const empty = F.resolveSelection(groups, []);
  assert.deepStrictEqual(plain(empty.selection), []);
  assert.strictEqual(empty.urls, null);
});

test("shouldNavigateOnSelect solo navega al añadir fuera de suscripciones", () => {
  const { YouTubeGroupsFilter: F } = loadModules();

  assert.strictEqual(F.shouldNavigateOnSelect("home", [], ["group:a"]), true);
  assert.strictEqual(
    F.shouldNavigateOnSelect("watch", ["group:a"], ["group:a", "group:b"]),
    true,
  );
  assert.strictEqual(
    F.shouldNavigateOnSelect("subscriptions", [], ["group:a"]),
    false,
  );
  assert.strictEqual(
    F.shouldNavigateOnSelect("home", ["group:a", "group:b"], ["group:b"]),
    false,
  );
  assert.strictEqual(
    F.shouldNavigateOnSelect("home", ["group:a"], ["group:a"]),
    false,
  );
  assert.strictEqual(F.shouldNavigateOnSelect("home", ["group:a"], []), false);
});

test("parsePendingSelection recupera lo serializado y rechaza lo inválido", () => {
  const { YouTubeGroupsFilter: F } = loadModules();
  const t = 1763200000000;
  const selection = ["group:a", `channel:${X}`];
  const text = F.serializePendingSelection(selection, t);

  assert.deepStrictEqual(
    plain(F.parsePendingSelection(text, t + 1000)),
    selection,
  );
  assert.strictEqual(F.parsePendingSelection(text, t + 31000), null);
  assert.strictEqual(F.parsePendingSelection(text, t - 1), null);
  assert.strictEqual(F.parsePendingSelection("{no json", t), null);
  assert.strictEqual(
    F.parsePendingSelection(
      JSON.stringify({ version: 1, selection, createdAt: t }),
      t,
    ),
    null,
  );
  assert.strictEqual(
    F.parsePendingSelection(F.serializePendingSelection([], t), t),
    null,
  );
});
