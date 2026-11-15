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
        containerId: "a",
        url: "https://www.youtube.com/@x?a=1",
        name: "X",
      }),
    ),
    { type: "channel", containerId: "a", url: X, name: "X" },
  );
  assert.strictEqual(
    F.normalizeFilter({ type: "channel", containerId: "a", url: X }).name,
    "",
  );

  const invalids = [
    null,
    undefined,
    "group",
    { type: "otro" },
    { type: "group", id: "" },
    { type: "group" },
    { type: "channel", containerId: "a", url: "https://example.com/@x" },
    { type: "channel", containerId: "a", url: 42 },
    { type: "channel", containerId: "a", url: "https://www.youtube.com/watch" },
    { type: "channel", url: X },
    { type: "channel", containerId: "", url: X },
    { type: "channel", containerId: 5, url: X },
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
    F.getFilterKey({ type: "channel", containerId: "a", url: `${X}?a=1` }),
    `channel:a:${X}`,
  );
  assert.strictEqual(F.getFilterKey({ type: "channel", url: X }), null);
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

  const channel = F.resolveFilterUrls(groups, {
    type: "channel",
    containerId: "a",
    url: X,
  });
  assert.strictEqual(channel.status, "ok");
  assert.deepStrictEqual([...channel.urls], [X]);

  assert.deepStrictEqual(
    plain(F.resolveFilterUrls(groups, { type: "group", id: "nope" })),
    { status: "missing" },
  );
});

test("resolveFilterUrls con canal: contenedor propio, huérfano y con parámetros", () => {
  const { YouTubeGroupsFilter: F } = loadModules();
  const groups = tree();
  const Y = "https://www.youtube.com/@y";

  const nested = F.resolveFilterUrls(groups, {
    type: "channel",
    containerId: "a1",
    url: Y,
  });
  assert.strictEqual(nested.status, "ok");
  assert.deepStrictEqual([...nested.urls], [Y]);

  // El grupo padre no tiene el canal entre sus propios canales
  assert.deepStrictEqual(
    plain(
      F.resolveFilterUrls(groups, {
        type: "channel",
        containerId: "a",
        url: Y,
      }),
    ),
    { status: "missing" },
  );
  assert.deepStrictEqual(
    plain(
      F.resolveFilterUrls(groups, {
        type: "channel",
        containerId: "nope",
        url: X,
      }),
    ),
    { status: "missing" },
  );
  assert.deepStrictEqual(
    plain(
      F.resolveFilterUrls(groups, {
        type: "channel",
        containerId: "a",
        url: "https://www.youtube.com/@z",
      }),
    ),
    { status: "missing" },
  );

  const withParams = [
    { id: "p", name: "P", channels: [{ name: "X", url: `${X}?a=1` }] },
  ];
  assert.strictEqual(
    F.resolveFilterUrls(withParams, {
      type: "channel",
      containerId: "p",
      url: X,
    }).status,
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
const CX = { type: "channel", containerId: "a", url: X, name: "X" };

test("parseFilterKey lee claves válidas y descarta el resto", () => {
  const { YouTubeGroupsFilter: F } = loadModules();

  assert.deepStrictEqual(plain(F.parseFilterKey("group:a")), GA);
  assert.deepStrictEqual(plain(F.parseFilterKey(`channel:a:${X}?a=1`)), {
    type: "channel",
    containerId: "a",
    url: X,
    name: "",
  });
  const colon = F.getFilterKey({
    type: "channel",
    containerId: "g:1/ñ",
    url: X,
  });
  assert.strictEqual(colon, `channel:g%3A1%2F%C3%B1:${X}`);
  assert.strictEqual(F.parseFilterKey(colon).containerId, "g:1/ñ");
  assert.strictEqual(F.parseFilterKey(`channel:${X}`), null);
  assert.strictEqual(F.parseFilterKey(`channel::${X}`), null);
  assert.strictEqual(F.parseFilterKey(`channel:%E0%A4%A:${X}`), null);
  assert.strictEqual(F.parseFilterKey("channel:a:ftp://x"), null);
  assert.strictEqual(F.parseFilterKey("foo:a"), null);
  assert.strictEqual(F.parseFilterKey("group:"), null);
  assert.strictEqual(F.parseFilterKey(null), null);
  assert.strictEqual(F.parseFilterKey(5), null);
});

test("normalizeSelection quita repetidos e inválidos", () => {
  const { YouTubeGroupsFilter: F } = loadModules();

  assert.deepStrictEqual(
    plain(
      F.normalizeSelection([
        "group:a",
        "x",
        `channel:a:${X}?z=1`,
        "group:a",
        `channel:${X}`,
        3,
      ]),
    ),
    ["group:a", `channel:a:${X}`],
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
      F.toggleSelection(["group:b", `channel:a:${X}`], {
        type: "channel",
        containerId: "a",
        url: `${X}?a=1`,
        name: "otro",
      }),
    ),
    ["group:b"],
  );
  assert.deepStrictEqual(
    plain(F.toggleSelection(["group:https://www.youtube.com/@x"], CX)),
    ["group:https://www.youtube.com/@x", `channel:a:${X}`],
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

  const union = F.resolveSelection(groups, ["group:a", `channel:b:${Z}`]);
  assert.deepStrictEqual(plain(union.selection), ["group:a", `channel:b:${Z}`]);
  assert.deepStrictEqual([...union.urls].sort(), [X, Y, Z].sort());

  const partial = F.resolveSelection(groups, [
    "group:borrado",
    "channel:b:https://www.youtube.com/@huerfano",
    `channel:a:${Z}`,
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
  const selection = ["group:a", `channel:a:${X}`];
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
    F.parsePendingSelection(
      JSON.stringify({ version: 2, selection, createdAt: t }),
      t,
    ),
    null,
  );
  assert.deepStrictEqual(
    plain(
      F.parsePendingSelection(
        JSON.stringify({ version: 3, selection, createdAt: t }),
        t,
      ),
    ),
    selection,
  );
  assert.strictEqual(
    F.parsePendingSelection(F.serializePendingSelection([], t), t),
    null,
  );
});
