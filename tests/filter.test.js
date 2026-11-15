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

test("isFilterOnRemovedGroup solo es cierto para un grupo quitado", () => {
  const { YouTubeGroupsFilter: F } = loadModules();

  assert.strictEqual(
    F.isFilterOnRemovedGroup({ type: "group", id: "a" }, ["a", "b"]),
    true,
  );
  assert.strictEqual(
    F.isFilterOnRemovedGroup({ type: "group", id: "a" }, new Set(["b"])),
    false,
  );
  assert.strictEqual(
    F.isFilterOnRemovedGroup({ type: "channel", url: X }, ["a"]),
    false,
  );
  assert.strictEqual(F.isFilterOnRemovedGroup(F.ALL_FILTER, ["a"]), false);
});

test("toggleFilter alterna con selección única", () => {
  const { YouTubeGroupsFilter: F } = loadModules();
  const a = { type: "group", id: "a" };
  const b = { type: "group", id: "b" };
  const channel = { type: "channel", url: X, name: "X" };

  assert.deepStrictEqual(plain(F.toggleFilter(F.ALL_FILTER, a)), a);
  assert.deepStrictEqual(plain(F.toggleFilter(a, a)), { type: "all" });
  assert.deepStrictEqual(plain(F.toggleFilter(a, b)), b);
  assert.deepStrictEqual(plain(F.toggleFilter(a, channel)), channel);
  assert.deepStrictEqual(
    plain(F.toggleFilter(channel, { type: "channel", url: `${X}?a=1` })),
    { type: "all" },
  );
  assert.deepStrictEqual(
    plain(F.toggleFilter(channel, { type: "group", id: X })),
    { type: "group", id: X },
  );
  assert.deepStrictEqual(plain(F.toggleFilter(a, { type: "nope" })), {
    type: "all",
  });
  assert.deepStrictEqual(plain(F.toggleFilter(a, null)), { type: "all" });
});

test("toggleFilter no muta el filtro actual", () => {
  const { YouTubeGroupsFilter: F } = loadModules();
  const current = { type: "group", id: "a" };
  const before = structuredClone(current);

  F.toggleFilter(current, { type: "group", id: "b" });
  F.toggleFilter(current, current);

  assert.deepStrictEqual(current, before);
});

test("shouldNavigateToSubscriptions solo navega con filtro fuera de suscripciones", () => {
  const { YouTubeGroupsFilter: F } = loadModules();
  const group = { type: "group", id: "a" };
  const channel = { type: "channel", url: X };

  for (const filter of [group, channel]) {
    assert.strictEqual(F.shouldNavigateToSubscriptions("home", filter), true);
    assert.strictEqual(F.shouldNavigateToSubscriptions("watch", filter), true);
    assert.strictEqual(
      F.shouldNavigateToSubscriptions("subscriptions", filter),
      false,
    );
  }
  for (const page of ["home", "watch", "subscriptions"]) {
    assert.strictEqual(
      F.shouldNavigateToSubscriptions(page, F.ALL_FILTER),
      false,
    );
  }
});

test("el filtro pendiente sobrevive a serializar y parsear", () => {
  const { YouTubeGroupsFilter: F } = loadModules();
  const t = 1763200000000;

  for (const filter of [
    { type: "group", id: "a" },
    { type: "channel", url: X, name: "X" },
  ]) {
    const text = F.serializePendingFilter(filter, t);
    assert.deepStrictEqual(plain(F.parsePendingFilter(text, t + 1000)), filter);
  }
  assert.strictEqual(F.PENDING_FILTER_KEY, "youtubeGroupsPendingFilter");
  assert.strictEqual(F.PENDING_MAX_AGE_MS, 30000);
});

test("parsePendingFilter rechaza lo caducado, futuro o inválido", () => {
  const { YouTubeGroupsFilter: F } = loadModules();
  const t = 1763200000000;
  const text = F.serializePendingFilter({ type: "group", id: "a" }, t);

  assert.strictEqual(F.parsePendingFilter(text, t + 31000), null);
  assert.strictEqual(F.parsePendingFilter(text, t - 1), null);
  assert.strictEqual(F.parsePendingFilter("{no json", t), null);
  assert.strictEqual(
    F.parsePendingFilter(
      JSON.stringify({
        version: 2,
        filter: { type: "group", id: "a" },
        createdAt: t,
      }),
      t,
    ),
    null,
  );
  assert.strictEqual(
    F.parsePendingFilter(F.serializePendingFilter(F.ALL_FILTER, t), t),
    null,
  );
});
