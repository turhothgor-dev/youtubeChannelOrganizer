"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { loadModules, plain } = require("./helpers/load-modules");

const ID = "dQw4w9WgXcQ";
const ID2 = "abcdefghijk";

test("isValidVideoId solo acepta cadenas de 11 caracteres válidos", () => {
  const { YouTubeGroupsWatched: W } = loadModules();

  assert.strictEqual(W.isValidVideoId(ID), true);
  assert.strictEqual(W.isValidVideoId("dQw4w9WgXc"), false);
  assert.strictEqual(W.isValidVideoId("dQw4w9WgXcQQ"), false);
  assert.strictEqual(W.isValidVideoId("dQw4w9WgX!Q"), false);
  assert.strictEqual(W.isValidVideoId(12345678901), false);
  assert.strictEqual(W.isValidVideoId(null), false);
});

test("extractVideoId devuelve el ID de URLs de vídeo válidas", () => {
  const { YouTubeGroupsWatched: W } = loadModules();

  assert.strictEqual(W.extractVideoId(`/watch?v=${ID}`), ID);
  assert.strictEqual(W.extractVideoId(`/watch?v=${ID}&t=10s&list=X`), ID);
  assert.strictEqual(
    W.extractVideoId(`https://www.youtube.com/watch?v=${ID}`),
    ID,
  );
  assert.strictEqual(W.extractVideoId(`/shorts/${ID}`), ID);
});

test("extractVideoId devuelve null para URLs que no son vídeos válidos", () => {
  const { YouTubeGroupsWatched: W } = loadModules();

  for (const href of [
    "/watch",
    "/watch?v=dQw4w9WgXc",
    "/watch?v=dQw4w9WgXcQQ",
    "/watch?v=dQw4w9WgX!Q",
    `https://evil.example/watch?v=${ID}`,
    "/@handle",
    "/playlist?list=X",
  ]) {
    assert.strictEqual(W.extractVideoId(href), null, href);
  }
});

test("applyVideoWatched marca un vídeo y no muta la entrada", () => {
  const { YouTubeGroupsWatched: W } = loadModules();
  const input = {};

  const result = W.applyVideoWatched(input, ID, true, 123);

  assert.strictEqual(result.changed, true);
  assert.deepStrictEqual(plain(result.videos), { [ID]: { watchedAt: 123 } });
  assert.deepStrictEqual(plain(input), {});
});

test("applyVideoWatched conserva watchedAt y campos extra de uno ya visto", () => {
  const { YouTubeGroupsWatched: W } = loadModules();
  const input = { [ID]: { watchedAt: 1, extra: "x" } };

  const result = W.applyVideoWatched(input, ID, true, 999);

  assert.strictEqual(result.changed, false);
  assert.deepStrictEqual(plain(result.videos), {
    [ID]: { watchedAt: 1, extra: "x" },
  });
});

test("applyVideoWatched desmarca y no muta la entrada", () => {
  const { YouTubeGroupsWatched: W } = loadModules();
  const input = { [ID]: { watchedAt: 1 }, [ID2]: { watchedAt: 2 } };

  const result = W.applyVideoWatched(input, ID, false, 5);

  assert.strictEqual(result.changed, true);
  assert.deepStrictEqual(plain(result.videos), { [ID2]: { watchedAt: 2 } });
  assert.strictEqual(Object.keys(input).length, 2);
});

test("applyVideoWatched desmarcar uno no visto no cambia nada", () => {
  const { YouTubeGroupsWatched: W } = loadModules();

  const result = W.applyVideoWatched({}, ID, false, 5);

  assert.strictEqual(result.changed, false);
});

test("applyVideoWatched con ID inválido lanza error", () => {
  const { YouTubeGroupsWatched: W } = loadModules();

  assert.throws(() => W.applyVideoWatched({}, "corto", true, 1), {
    message: "Vídeo inválido.",
  });
});

test("isVideoWatched distingue vistos y no vistos", () => {
  const { YouTubeGroupsWatched: W } = loadModules();
  const videos = { [ID]: { watchedAt: 1 } };

  assert.strictEqual(W.isVideoWatched(videos, ID), true);
  assert.strictEqual(W.isVideoWatched(videos, ID2), false);
});

test("setVideoWatched escribe una vez al marcar y no escribe sin cambio", async () => {
  const { YouTubeGroupsWatched: W, calls, store } = loadModules();

  const first = await W.setVideoWatched(ID, true);
  assert.strictEqual(first.changed, true);
  assert.strictEqual(calls.set, 1);
  assert.strictEqual(store.youtubeWatched.version, 1);
  assert.ok(ID in store.youtubeWatched.videos);

  const second = await W.setVideoWatched(ID, true);
  assert.strictEqual(second.changed, false);
  assert.strictEqual(calls.set, 1);
});

test("setVideoWatched con ID inválido rechaza sin escribir", async () => {
  const { YouTubeGroupsWatched: W, calls } = loadModules();

  await assert.rejects(() => W.setVideoWatched("nope", true), {
    message: "Vídeo inválido.",
  });
  assert.strictEqual(calls.set, 0);
});

test("shouldAutoMark decide según el porcentaje de reproducción", () => {
  const { YouTubeGroupsWatched: W } = loadModules();

  assert.strictEqual(W.shouldAutoMark(80, 100, 80), true);
  assert.strictEqual(W.shouldAutoMark(95, 100, 95), true);
  assert.strictEqual(W.shouldAutoMark(79.9, 100, 80), false);
  assert.strictEqual(W.shouldAutoMark(100, 100, 0), false);
  assert.strictEqual(W.shouldAutoMark(10, Infinity, 50), false);
  assert.strictEqual(W.shouldAutoMark(10, NaN, 50), false);
  assert.strictEqual(W.shouldAutoMark(10, 0, 50), false);
  assert.strictEqual(W.shouldAutoMark(NaN, 100, 50), false);
});

test("marcar dos vídeos a la vez conserva los dos", async () => {
  const { YouTubeGroupsWatched: W, store } = loadModules({}, { latencyMs: 5 });

  await Promise.all([
    W.setVideoWatched(ID, true),
    W.setVideoWatched(ID2, true),
  ]);

  assert.deepStrictEqual(Object.keys(store.youtubeWatched.videos).sort(), [
    ID2,
    ID,
  ]);
});
