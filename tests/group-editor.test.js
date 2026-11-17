"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { loadModules, plain } = require("./helpers/load-modules");

function node(id, subgroups = [], extra = {}) {
  const isSub = Boolean(extra.parentId);
  return {
    id,
    name: id,
    type: isSub ? "subgroup" : "group",
    channels: [],
    subgroups,
    icon: "",
    color: "",
    ...extra,
  };
}

// A (A1 (A1a), A2), B, C
function sampleTree() {
  return [
    node("A", [
      node("A1", [node("A1a", [], { parentId: "A1" })], { parentId: "A" }),
      node("A2", [], { parentId: "A" }),
    ]),
    node("B"),
    node("C"),
  ];
}

const ids = (list) => list.map((group) => group.id);

test("findGroupLocation devuelve padre, índice y número de hermanos", () => {
  const { YouTubeGroupsEditor } = loadModules();
  const tree = sampleTree();

  assert.deepStrictEqual(
    plain(YouTubeGroupsEditor.findGroupLocation(tree, "B")),
    { parentId: null, index: 1, siblingCount: 3 },
  );
  assert.deepStrictEqual(
    plain(YouTubeGroupsEditor.findGroupLocation(tree, "A1a")),
    { parentId: "A1", index: 0, siblingCount: 1 },
  );
  assert.strictEqual(YouTubeGroupsEditor.findGroupLocation(tree, "X"), null);
});

test("getSiblingMove: subir el primero es null y bajar A en [A,B,C] da [B,A,C]", () => {
  const { YouTubeGroupsEditor } = loadModules();
  const tree = sampleTree();

  assert.strictEqual(YouTubeGroupsEditor.getSiblingMove(tree, "A", -1), null);
  assert.strictEqual(YouTubeGroupsEditor.getSiblingMove(tree, "C", 1), null);

  const place = plain(YouTubeGroupsEditor.getSiblingMove(tree, "A", 1));
  assert.deepStrictEqual(place, { parentId: null, index: 1 });
  const { groups } = YouTubeGroupsEditor.moveGroup(
    tree,
    "A",
    place.parentId,
    place.index,
  );
  assert.deepStrictEqual(ids(groups), ["B", "A", "C"]);

  const up = plain(YouTubeGroupsEditor.getSiblingMove(tree, "C", -1));
  const moved = YouTubeGroupsEditor.moveGroup(tree, "C", up.parentId, up.index);
  assert.deepStrictEqual(ids(moved.groups), ["A", "C", "B"]);
});

test("moveGroup: un subgrupo al primer nivel pasa a type group sin parentId", () => {
  const { YouTubeGroupsEditor } = loadModules();
  const tree = sampleTree();

  const { groups, changed } = YouTubeGroupsEditor.moveGroup(
    tree,
    "A1",
    null,
    1,
  );
  assert.strictEqual(changed, true);
  assert.deepStrictEqual(ids(groups), ["A", "A1", "B", "C"]);
  const moved = groups[1];
  assert.strictEqual(moved.type, "group");
  assert.ok(!("parentId" in moved));
  assert.deepStrictEqual(ids(moved.subgroups), ["A1a"]);
  assert.deepStrictEqual(ids(groups[0].subgroups), ["A2"]);
});

test("moveGroup: un grupo dentro de otro pasa a subgroup con parentId y conserva sus hijos", () => {
  const { YouTubeGroupsEditor } = loadModules();
  const tree = sampleTree();

  const { groups } = YouTubeGroupsEditor.moveGroup(tree, "A", "B", 0);
  assert.deepStrictEqual(ids(groups), ["B", "C"]);
  const moved = groups[0].subgroups[0];
  assert.strictEqual(moved.id, "A");
  assert.strictEqual(moved.type, "subgroup");
  assert.strictEqual(moved.parentId, "B");
  assert.deepStrictEqual(plain(moved.subgroups), plain(tree[0].subgroups));
});

test("moveGroup lanza al mover dentro de sí mismo, de un descendiente o con ids inexistentes", () => {
  const { YouTubeGroupsEditor } = loadModules();
  const tree = sampleTree();

  assert.throws(() => YouTubeGroupsEditor.moveGroup(tree, "A", "A", 0));
  assert.throws(() => YouTubeGroupsEditor.moveGroup(tree, "A", "A1a", 0));
  assert.throws(() => YouTubeGroupsEditor.moveGroup(tree, "X", null, 0));
  assert.throws(() => YouTubeGroupsEditor.moveGroup(tree, "A", "X", 0));
});

test("moveGroup acota el índice y detecta el mismo lugar", () => {
  const { YouTubeGroupsEditor } = loadModules();
  const tree = sampleTree();

  const high = YouTubeGroupsEditor.moveGroup(tree, "A", null, 99);
  assert.deepStrictEqual(ids(high.groups), ["B", "C", "A"]);
  const low = YouTubeGroupsEditor.moveGroup(tree, "C", null, -5);
  assert.deepStrictEqual(ids(low.groups), ["C", "A", "B"]);

  const same = YouTubeGroupsEditor.moveGroup(tree, "B", null, 1);
  assert.strictEqual(same.changed, false);
  assert.deepStrictEqual(plain(same.groups), plain(tree));
  const sameEnd = YouTubeGroupsEditor.moveGroup(tree, "C", null, 99);
  assert.strictEqual(sameEnd.changed, false);
});

test("moveGroup no muta la entrada", () => {
  const { YouTubeGroupsEditor } = loadModules();
  const tree = sampleTree();
  const before = structuredClone(tree);

  YouTubeGroupsEditor.moveGroup(tree, "A1", "B", 0);
  YouTubeGroupsEditor.moveGroup(tree, "A", null, 2);
  YouTubeGroupsEditor.moveGroup(tree, "B", null, 1);
  assert.deepStrictEqual(plain(tree), plain(before));
});

test("getMoveTargets excluye el grupo y sus descendientes y marca el padre actual", () => {
  const { YouTubeGroupsEditor } = loadModules();
  const tree = sampleTree();

  const targets = plain(YouTubeGroupsEditor.getMoveTargets(tree, "A1"));
  assert.deepStrictEqual(
    targets.map((t) => t.id),
    [null, "A", "A2", "B", "C"],
  );
  assert.deepStrictEqual(
    targets.map((t) => t.level),
    [0, 1, 2, 1, 1],
  );
  assert.strictEqual(targets[0].name, "Primer nivel");
  assert.deepStrictEqual(
    targets.filter((t) => t.current).map((t) => t.id),
    ["A"],
  );

  const rootTargets = plain(YouTubeGroupsEditor.getMoveTargets(tree, "B"));
  assert.deepStrictEqual(
    rootTargets.filter((t) => t.current).map((t) => t.id),
    [null],
  );
});

test("getDropPosition: before, after e inside en el mismo nivel y en otro", () => {
  const { YouTubeGroupsEditor } = loadModules();
  const tree = sampleTree();
  const drop = (d, t, z) =>
    plain(YouTubeGroupsEditor.getDropPosition(tree, d, t, z));

  // Otro nivel
  assert.deepStrictEqual(drop("C", "A2", "before"), {
    parentId: "A",
    index: 1,
  });
  assert.deepStrictEqual(drop("C", "A2", "after"), {
    parentId: "A",
    index: 2,
  });
  assert.deepStrictEqual(drop("C", "A", "inside"), {
    parentId: "A",
    index: 2,
  });

  // Mismo nivel, arrastrado antes del destino: índice corregido
  assert.deepStrictEqual(drop("A", "C", "before"), {
    parentId: null,
    index: 1,
  });
  assert.deepStrictEqual(drop("A", "C", "after"), {
    parentId: null,
    index: 2,
  });
  // Mismo nivel, arrastrado después del destino
  assert.deepStrictEqual(drop("C", "A", "before"), {
    parentId: null,
    index: 0,
  });
  assert.deepStrictEqual(drop("C", "A", "after"), {
    parentId: null,
    index: 1,
  });
  // Inside con el arrastrado ya hijo del destino
  assert.deepStrictEqual(drop("A1", "A", "inside"), {
    parentId: "A",
    index: 1,
  });

  // Aplicado, el resultado es el esperado
  const place = drop("A", "C", "before");
  const { groups } = YouTubeGroupsEditor.moveGroup(
    tree,
    "A",
    place.parentId,
    place.index,
  );
  assert.deepStrictEqual(ids(groups), ["B", "A", "C"]);
});

test("getDropPosition devuelve null sobre sí mismo, un descendiente o ids inexistentes", () => {
  const { YouTubeGroupsEditor } = loadModules();
  const tree = sampleTree();

  assert.strictEqual(
    YouTubeGroupsEditor.getDropPosition(tree, "A", "A", "inside"),
    null,
  );
  assert.strictEqual(
    YouTubeGroupsEditor.getDropPosition(tree, "A", "A1a", "before"),
    null,
  );
  assert.strictEqual(
    YouTubeGroupsEditor.getDropPosition(tree, "X", "A", "after"),
    null,
  );
  assert.strictEqual(
    YouTubeGroupsEditor.getDropPosition(tree, "A", "X", "after"),
    null,
  );
});

test("moveGroupAndSave guarda el movimiento y no escribe si no hay cambios", async () => {
  const { YouTubeGroupsEditor, store, calls } = loadModules({
    youtubeGroups: { version: 1, groups: sampleTree() },
  });

  const none = await YouTubeGroupsEditor.moveGroupAndSave("B", null, 1);
  assert.strictEqual(none.changed, false);
  assert.strictEqual(calls.set, 0);

  const done = await YouTubeGroupsEditor.moveGroupAndSave("B", "A", 0);
  assert.strictEqual(done.changed, true);
  assert.strictEqual(calls.set, 1);
  const saved = store.youtubeGroups.groups;
  assert.deepStrictEqual(ids(saved), ["A", "C"]);
  assert.deepStrictEqual(ids(saved[0].subgroups), ["B", "A1", "A2"]);
});

function treeWithChannels() {
  const tree = sampleTree();
  tree[0].channels = [{ name: "Foo", url: "https://www.youtube.com/@Foo" }];
  tree[0].subgroups[0].channels = [
    { name: "foo", url: "https://www.youtube.com/@foo" },
    { name: "Bar", url: "https://www.youtube.com/@Bar" },
  ];
  return tree;
}

test("summarizeSubtree cuenta descendientes y canales distintos", () => {
  const { YouTubeGroupsEditor } = loadModules();
  const tree = treeWithChannels();

  assert.deepStrictEqual(
    plain(YouTubeGroupsEditor.summarizeSubtree(tree, "A")),
    { subgroups: 3, channels: 2 },
  );
  assert.deepStrictEqual(
    plain(YouTubeGroupsEditor.summarizeSubtree(tree, "B")),
    { subgroups: 0, channels: 0 },
  );
  assert.strictEqual(YouTubeGroupsEditor.summarizeSubtree(tree, "X"), null);
});

test("removeGroupWithSnapshot y restoreGroup dejan el árbol igual", () => {
  const { YouTubeGroupsEditor } = loadModules();
  const tree = treeWithChannels();
  const before = structuredClone(tree);

  for (const id of ["A", "A1", "A1a", "B", "C"]) {
    const removed = YouTubeGroupsEditor.removeGroupWithSnapshot(tree, id);
    assert.ok(!JSON.stringify(removed.groups).includes(`"id":"${id}"`));
    const back = YouTubeGroupsEditor.restoreGroup(
      removed.groups,
      removed.snapshot,
    );
    assert.strictEqual(back.restored, true);
    assert.strictEqual(back.atRoot, false);
    assert.deepStrictEqual(plain(back.groups), plain(before));
  }
  assert.deepStrictEqual(plain(tree), plain(before));

  const removed = YouTubeGroupsEditor.removeGroupWithSnapshot(tree, "A");
  assert.deepStrictEqual(plain(removed.removedIds), ["A", "A1", "A1a", "A2"]);
  assert.throws(() => YouTubeGroupsEditor.removeGroupWithSnapshot(tree, "X"));
});

test("restoreGroup: dos veces no cambia; sin padre va al final del primer nivel; índice acotado", () => {
  const { YouTubeGroupsEditor } = loadModules();
  const tree = sampleTree();

  const removed = YouTubeGroupsEditor.removeGroupWithSnapshot(tree, "A1");
  const once = YouTubeGroupsEditor.restoreGroup(
    removed.groups,
    removed.snapshot,
  );
  const twice = YouTubeGroupsEditor.restoreGroup(once.groups, removed.snapshot);
  assert.strictEqual(twice.restored, false);

  // Padre borrado
  const noParent = YouTubeGroupsEditor.removeGroupWithSnapshot(
    removed.groups,
    "A",
  );
  const orphan = YouTubeGroupsEditor.restoreGroup(
    noParent.groups,
    removed.snapshot,
  );
  assert.strictEqual(orphan.restored, true);
  assert.strictEqual(orphan.atRoot, true);
  assert.deepStrictEqual(ids(orphan.groups), ["B", "C", "A1"]);
  const placed = orphan.groups[2];
  assert.strictEqual(placed.type, "group");
  assert.ok(!("parentId" in placed));
  assert.deepStrictEqual(ids(placed.subgroups), ["A1a"]);

  // Índice acotado tras cambiar los hermanos: A1 estaba en el índice 0
  const sibling = removed.groups;
  sibling[0].subgroups = [];
  const clamped = YouTubeGroupsEditor.restoreGroup(sibling, {
    ...removed.snapshot,
    index: 5,
  });
  assert.deepStrictEqual(ids(clamped.groups[0].subgroups), ["A1"]);
  assert.strictEqual(clamped.groups[0].subgroups[0].parentId, "A");
});

test("deleteGroupAndSnapshot y restoreGroupAndSave guardan y no escriben de más", async () => {
  const { YouTubeGroupsEditor, store, calls } = loadModules({
    youtubeGroups: { version: 1, groups: treeWithChannels() },
  });
  const before = structuredClone(store.youtubeGroups.groups);

  const deleted = await YouTubeGroupsEditor.deleteGroupAndSnapshot("A");
  assert.strictEqual(calls.set, 1);
  assert.deepStrictEqual(plain(deleted.removedIds), ["A", "A1", "A1a", "A2"]);
  assert.deepStrictEqual(plain(deleted.summary), { subgroups: 3, channels: 2 });
  assert.deepStrictEqual(ids(store.youtubeGroups.groups), ["B", "C"]);

  const restored = await YouTubeGroupsEditor.restoreGroupAndSave(
    deleted.snapshot,
  );
  assert.deepStrictEqual(plain(restored), { restored: true, atRoot: false });
  assert.strictEqual(calls.set, 2);
  assert.deepStrictEqual(plain(store.youtubeGroups.groups), plain(before));

  const again = await YouTubeGroupsEditor.restoreGroupAndSave(deleted.snapshot);
  assert.strictEqual(again.restored, false);
  assert.strictEqual(calls.set, 2);

  await assert.rejects(YouTubeGroupsEditor.deleteGroupAndSnapshot("X"));
  assert.strictEqual(calls.set, 2);
});

test("moveGroupAndSave: dos movimientos solapados no se pisan", async () => {
  const { YouTubeGroupsEditor, store } = loadModules(
    { youtubeGroups: { version: 1, groups: sampleTree() } },
    { latencyMs: 5 },
  );

  await Promise.all([
    YouTubeGroupsEditor.moveGroupAndSave("B", "A", 0),
    YouTubeGroupsEditor.moveGroupAndSave("C", "A", 0),
  ]);

  const saved = store.youtubeGroups.groups;
  assert.deepStrictEqual(ids(saved), ["A"]);
  assert.deepStrictEqual(ids(saved[0].subgroups), ["C", "B", "A1", "A2"]);
});
