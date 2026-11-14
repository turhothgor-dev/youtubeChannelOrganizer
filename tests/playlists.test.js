"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { loadModules, plain } = require("./helpers/load-modules");

const V1 = "dQw4w9WgXcQ";
const V2 = "abcdefghijk";
const V3 = "ABCDEFGHIJK";

function video(id = V1, extra = {}) {
  return { id, title: "Título", channelName: "Canal", ...extra };
}

function list(id, videos = [], name = id) {
  return { id, name, videos };
}

test("applyCreatePlaylist añade al final y recorta el nombre", () => {
  const { YouTubeGroupsPlaylists: P } = loadModules();
  const input = [list("a")];

  const result = P.applyCreatePlaylist(input, "  Música  ", "b");

  assert.strictEqual(result.changed, true);
  assert.deepStrictEqual(plain(result.playlists), [
    list("a"),
    { id: "b", name: "Música", videos: [] },
  ]);
  assert.deepStrictEqual(plain(input), [list("a")]);
});

test("applyCreatePlaylist rechaza nombres vacíos o demasiado largos", () => {
  const { YouTubeGroupsPlaylists: P } = loadModules();

  assert.throws(
    () => P.applyCreatePlaylist([], "  ", "a"),
    /El nombre de la lista no puede estar vacío\./,
  );
  assert.throws(
    () => P.applyCreatePlaylist([], "x".repeat(81), "a"),
    /El nombre de la lista no puede exceder 80 caracteres\./,
  );
  assert.strictEqual(
    P.applyCreatePlaylist([], "x".repeat(80), "a").playlists.length,
    1,
  );
});

test("applyRenamePlaylist renombra, detecta el mismo nombre y lanza si no existe", () => {
  const { YouTubeGroupsPlaylists: P } = loadModules();
  const input = [list("a", [], "Uno")];

  const renamed = P.applyRenamePlaylist(input, "a", " Dos ");
  assert.strictEqual(renamed.changed, true);
  assert.strictEqual(renamed.playlists[0].name, "Dos");
  assert.strictEqual(input[0].name, "Uno");

  assert.strictEqual(P.applyRenamePlaylist(input, "a", "Uno").changed, false);
  assert.throws(
    () => P.applyRenamePlaylist(input, "zzz", "X"),
    /No existe la lista indicada\./,
  );
});

test("applyDeletePlaylist quita solo esa lista y lanza si no existe", () => {
  const { YouTubeGroupsPlaylists: P } = loadModules();
  const input = [list("a"), list("b")];

  const result = P.applyDeletePlaylist(input, "a");

  assert.strictEqual(result.changed, true);
  assert.deepStrictEqual(plain(result.playlists), [list("b")]);
  assert.strictEqual(input.length, 2);
  assert.throws(
    () => P.applyDeletePlaylist(input, "zzz"),
    /No existe la lista indicada\./,
  );
});

test("applyVideoPlaylists añade, quita y conserva addedAt y posición", () => {
  const { YouTubeGroupsPlaylists: P } = loadModules();
  const existing = { id: V1, title: "Viejo", channelName: "C", addedAt: 1 };
  const other = { id: V2, title: "Otro", channelName: "C", addedAt: 2 };
  const input = [
    list("a", [existing, other]),
    list("b", [existing]),
    list("c", [other]),
  ];

  const result = P.applyVideoPlaylists(
    input,
    video(V1),
    new Set(["a", "c", "desconocida"]),
    99,
  );

  assert.strictEqual(result.changed, true);
  const [a, b, c] = plain(result.playlists);
  assert.deepStrictEqual(a.videos, [existing, other]);
  assert.deepStrictEqual(b.videos, []);
  assert.deepStrictEqual(c.videos, [
    other,
    { id: V1, title: "Título", channelName: "Canal", addedAt: 99 },
  ]);
  assert.strictEqual(input[1].videos.length, 1);
  assert.strictEqual(input[2].videos.length, 1);
});

test("applyVideoPlaylists sin cambios devuelve changed false", () => {
  const { YouTubeGroupsPlaylists: P } = loadModules();
  const input = [
    list("a", [{ id: V1, title: "", channelName: "", addedAt: 1 }]),
    list("b"),
  ];

  const result = P.applyVideoPlaylists(input, video(V1), ["a"], 5);

  assert.strictEqual(result.changed, false);
  assert.deepStrictEqual(plain(result.playlists), plain(input));
});

test("applyVideoPlaylists recorta y trunca título y canal", () => {
  const { YouTubeGroupsPlaylists: P } = loadModules();

  const result = P.applyVideoPlaylists(
    [list("a")],
    video(V1, { title: `  ${"t".repeat(201)}`, channelName: "c".repeat(101) }),
    ["a"],
    1,
  );
  const saved = result.playlists[0].videos[0];
  assert.strictEqual(saved.title.length, 200);
  assert.strictEqual(saved.channelName.length, 100);

  const nonString = P.applyVideoPlaylists(
    [list("a")],
    video(V1, { title: 42, channelName: null }),
    ["a"],
    1,
  );
  assert.strictEqual(nonString.playlists[0].videos[0].title, "");
  assert.strictEqual(nonString.playlists[0].videos[0].channelName, "");
});

test("applyVideoPlaylists lanza con un ID de vídeo inválido", () => {
  const { YouTubeGroupsPlaylists: P } = loadModules();

  assert.throws(
    () => P.applyVideoPlaylists([list("a")], video("corto"), ["a"], 1),
    /Vídeo inválido\./,
  );
});

test("applyRemoveVideo quita el vídeo, ignora ausentes y lanza sin lista", () => {
  const { YouTubeGroupsPlaylists: P } = loadModules();
  const input = [
    list("a", [
      { id: V1, title: "", channelName: "", addedAt: 1 },
      { id: V2, title: "", channelName: "", addedAt: 2 },
    ]),
  ];

  const removed = P.applyRemoveVideo(input, "a", V1);
  assert.strictEqual(removed.changed, true);
  assert.deepStrictEqual(
    plain(removed.playlists[0].videos).map((v) => v.id),
    [V2],
  );
  assert.strictEqual(input[0].videos.length, 2);

  assert.strictEqual(P.applyRemoveVideo(input, "a", V3).changed, false);
  assert.throws(
    () => P.applyRemoveVideo(input, "zzz", V1),
    /No existe la lista indicada\./,
  );
});

test("getVideoPlaylistIds devuelve las listas que contienen el vídeo", () => {
  const { YouTubeGroupsPlaylists: P } = loadModules();
  const item = { id: V1, title: "", channelName: "", addedAt: 1 };
  const input = [list("a", [item]), list("b"), list("c", [item])];

  assert.deepStrictEqual(plain(P.getVideoPlaylistIds(input, V1)), ["a", "c"]);
  assert.deepStrictEqual(plain(P.getVideoPlaylistIds(input, V2)), []);
});

test("buildPlayAllUrl devuelve null si está vacía y limita a 50 IDs", () => {
  const { YouTubeGroupsPlaylists: P } = loadModules();
  const mk = (id) => ({ id, title: "", channelName: "", addedAt: 1 });

  assert.strictEqual(P.buildPlayAllUrl(list("a")), null);

  const three = new URL(P.buildPlayAllUrl(list("a", [mk(V1), mk(V2), mk(V3)])));
  assert.strictEqual(three.origin, "https://www.youtube.com");
  assert.strictEqual(three.pathname, "/watch_videos");
  assert.strictEqual(three.searchParams.get("video_ids"), `${V1},${V2},${V3}`);

  const many = Array.from({ length: 60 }, (_, i) =>
    mk(`video${String(i).padStart(6, "0")}`),
  );
  const ids = new URL(P.buildPlayAllUrl(list("a", many))).searchParams
    .get("video_ids")
    .split(",");
  assert.strictEqual(ids.length, 50);
  assert.strictEqual(ids[0], many[0].id);
  assert.strictEqual(ids[49], many[49].id);
});

test("buildVideoUrl construye la URL o devuelve null", () => {
  const { YouTubeGroupsPlaylists: P } = loadModules();

  const url = new URL(P.buildVideoUrl(V1));
  assert.strictEqual(url.origin, "https://www.youtube.com");
  assert.strictEqual(url.pathname, "/watch");
  assert.strictEqual(url.searchParams.get("v"), V1);
  assert.strictEqual(P.buildVideoUrl("mal"), null);
});

test("createPlaylist escribe una vez y devuelve la lista creada", async () => {
  const { YouTubeGroupsPlaylists: P, calls, store } = loadModules();

  const created = await P.createPlaylist("  Para luego ");

  assert.strictEqual(created.name, "Para luego");
  assert.deepStrictEqual(plain(created.videos), []);
  assert.strictEqual(calls.set, 1);
  assert.strictEqual(store.youtubePlaylists.playlists.length, 1);
});

test("setVideoPlaylists sin cambios no escribe y renombrar/borrar/quitar funcionan", async () => {
  const { YouTubeGroupsPlaylists: P, calls, store } = loadModules();
  const created = await P.createPlaylist("Uno");

  await P.setVideoPlaylists(video(V1), [created.id]);
  assert.strictEqual(calls.set, 2);
  await P.setVideoPlaylists(video(V1), [created.id]);
  assert.strictEqual(calls.set, 2);

  await P.removeVideoFromPlaylist(created.id, V1);
  assert.strictEqual(store.youtubePlaylists.playlists[0].videos.length, 0);

  await P.renamePlaylist(created.id, "Dos");
  assert.strictEqual(store.youtubePlaylists.playlists[0].name, "Dos");

  await P.deletePlaylist(created.id);
  assert.strictEqual(store.youtubePlaylists.playlists.length, 0);
});

test("un error de validación no escribe", async () => {
  const { YouTubeGroupsPlaylists: P, calls } = loadModules();

  await assert.rejects(P.createPlaylist("  "));
  await assert.rejects(P.setVideoPlaylists(video("mal"), []));
  assert.strictEqual(calls.set, 0);
});
