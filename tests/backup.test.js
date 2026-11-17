"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { loadModules, plain } = require("./helpers/load-modules");

const V1 = "dQw4w9WgXcQ";
const V2 = "abcdefghijk";
const CHANNEL = "https://www.youtube.com/@canal";
const CHANNEL_B = "https://www.youtube.com/channel/UC123";
const AVATAR = "https://yt3.ggpht.com/ytc/AbC=s88-c-k-c0x00ffffff-no-rj";

function sample() {
  return {
    groups: [
      {
        id: "g1",
        name: "Música",
        type: "group",
        channels: [{ name: "Canal", url: CHANNEL }],
        subgroups: [
          {
            id: "g2",
            name: "Rock",
            type: "subgroup",
            parentId: "g1",
            channels: [{ name: "Otro", url: CHANNEL_B }],
            subgroups: [],
            icon: "",
            color: "#aabbcc",
          },
        ],
        icon: "",
        color: "",
      },
    ],
    watched: { [V1]: { watchedAt: 1700000000000 } },
    settings: {
      watchedMode: "hide",
      outsideMode: "dim",
      autoMarkPercent: 95,
      panelCollapsed: false,
    },
    playlists: [
      {
        id: "p1",
        name: "Ver luego",
        videos: [{ id: V2, title: "Título", channelName: "Canal", addedAt: 5 }],
      },
    ],
    avatars: { [CHANNEL]: AVATAR },
  };
}

function envelope(overrides = {}) {
  const data = sample();
  return JSON.stringify({
    format: "youtube-groups-backup",
    version: 1,
    exportedAt: "2026-11-14T10:00:00.000Z",
    ...data,
    ...overrides,
  });
}

test("buildBackup usa el formato del ADR 0006", () => {
  const { YouTubeGroupsBackup: B } = loadModules();
  const backup = plain(B.buildBackup(sample(), Date.UTC(2026, 10, 14, 10)));

  assert.strictEqual(backup.format, "youtube-groups-backup");
  assert.strictEqual(backup.version, 1);
  assert.strictEqual(backup.exportedAt, "2026-11-14T10:00:00.000Z");
  assert.deepStrictEqual(backup.groups, sample().groups);
  assert.deepStrictEqual(backup.avatars, sample().avatars);
});

test("parseBackup: ida y vuelta devuelve los mismos datos", () => {
  const { YouTubeGroupsBackup: B } = loadModules();
  const text = JSON.stringify(B.buildBackup(sample(), 0));

  const result = B.parseBackup(text);

  assert.deepStrictEqual(plain(result.data), sample());
  assert.strictEqual(result.dropped, 0);
});

test("parseBackup rechaza JSON roto, formato ajeno, versión 2 y exceso de tamaño", () => {
  const { YouTubeGroupsBackup: B } = loadModules();
  const notBackup = /no es una copia de YouTube Groups/;

  assert.throws(() => B.parseBackup("{roto"), notBackup);
  assert.throws(() => B.parseBackup(envelope({ format: "otro" })), notBackup);
  assert.throws(() => B.parseBackup("x".repeat(5000001)), notBackup);
  assert.throws(
    () => B.parseBackup(envelope({ version: 2 })),
    /Versión de copia no admitida/,
  );
});

test("parseBackup rechaza estructura incorrecta", () => {
  const { YouTubeGroupsBackup: B } = loadModules();
  const damaged = /La copia está dañada/;

  assert.throws(() => B.parseBackup(envelope({ groups: {} })), damaged);
  assert.throws(() => B.parseBackup(envelope({ watched: [] })), damaged);
  assert.throws(() => B.parseBackup(envelope({ playlists: "x" })), damaged);
  assert.throws(
    () => B.parseBackup(envelope({ groups: [{ id: "a", name: "  " }] })),
    damaged,
  );
});

test("parseBackup rechaza ids de grupo repetidos en todo el árbol", () => {
  const { YouTubeGroupsBackup: B } = loadModules();
  const data = sample();
  data.groups[0].subgroups[0].id = "g1";

  assert.throws(
    () => B.parseBackup(envelope({ groups: data.groups })),
    /La copia está dañada/,
  );
});

test("parseBackup descarta y cuenta canales no válidos", () => {
  const { YouTubeGroupsBackup: B } = loadModules();
  const data = sample();
  data.groups[0].channels.push(
    { name: "x", url: "javascript:alert(1)" },
    { name: "y", url: "https://www.youtube.com/watch?v=x" },
    { name: "dup", url: CHANNEL },
  );

  const result = B.parseBackup(envelope({ groups: data.groups }));

  assert.deepStrictEqual(plain(result.data.groups[0].channels), [
    { name: "Canal", url: CHANNEL },
  ]);
  assert.strictEqual(result.dropped, 3);
});

test("parseBackup recalcula type y parentId, e iconos desconocidos pasan a vacío", () => {
  const { YouTubeGroupsBackup: B } = loadModules();
  const data = sample();
  data.groups[0].type = "subgroup";
  data.groups[0].parentId = "zzz";
  data.groups[0].icon = "no-existe";
  data.groups[0].subgroups[0].type = "group";
  data.groups[0].subgroups[0].parentId = "otro";
  data.groups[0].subgroups[0].color = "rojo";

  const [top] = plain(
    B.parseBackup(envelope({ groups: data.groups })).data.groups,
  );

  assert.strictEqual(top.type, "group");
  assert.ok(!("parentId" in top));
  assert.strictEqual(top.icon, "");
  assert.strictEqual(top.subgroups[0].type, "subgroup");
  assert.strictEqual(top.subgroups[0].parentId, "g1");
  assert.strictEqual(top.subgroups[0].color, "");
});

test("parseBackup descarta vistos inválidos y normaliza ajustes", () => {
  const { YouTubeGroupsBackup: B } = loadModules();

  const result = B.parseBackup(
    envelope({
      watched: {
        [V1]: { watchedAt: 1 },
        abcdefghijk1: { watchedAt: 2 },
        [V2]: { watchedAt: "x" },
      },
      settings: { watchedMode: "nope", autoMarkPercent: 50 },
    }),
  );

  assert.deepStrictEqual(plain(result.data.watched), {
    [V1]: { watchedAt: 1 },
  });
  assert.strictEqual(result.dropped, 2);
  assert.deepStrictEqual(plain(result.data.settings), {
    watchedMode: "dim",
    outsideMode: "hide",
    autoMarkPercent: 50,
    panelCollapsed: true,
  });
});

test("parseBackup limpia los vídeos de las listas", () => {
  const { YouTubeGroupsBackup: B } = loadModules();
  const playlists = [
    {
      id: "p1",
      name: "L",
      videos: [
        { id: V1, title: "t".repeat(201), channelName: "c", addedAt: "x" },
        { id: V1, title: "repetido", channelName: "c", addedAt: 1 },
        { id: "corto", title: "malo", channelName: "c", addedAt: 1 },
      ],
    },
  ];

  const result = B.parseBackup(envelope({ playlists }));
  const [entry] = plain(result.data.playlists[0].videos);

  assert.strictEqual(result.data.playlists[0].videos.length, 1);
  assert.strictEqual(entry.title.length, 200);
  assert.strictEqual(entry.addedAt, 0);
  assert.strictEqual(result.dropped, 2);
});

function fullStore() {
  const data = sample();
  return {
    youtubeGroups: { version: 1, groups: data.groups },
    youtubeWatched: { version: 1, videos: data.watched },
    youtubeSettings: { version: 1, settings: data.settings },
    youtubePlaylists: { version: 1, playlists: data.playlists },
    youtubeAvatars: { version: 1, avatars: data.avatars },
  };
}

test("parseBackup: avatares válidos se conservan y el resto se descarta y cuenta", () => {
  const { YouTubeGroupsBackup: B } = loadModules();
  const avatars = {
    [CHANNEL]: AVATAR,
    [CHANNEL_B]: "https://i.ytimg.com/vi/x/a.jpg",
    "https://www.youtube.com/@Mayus": AVATAR,
    "https://evil.com/@a": AVATAR,
    "https://www.youtube.com/@otro": "https://yt3.ggpht.com/a=s48",
  };

  const result = B.parseBackup(envelope({ avatars }));

  assert.deepStrictEqual(plain(result.data.avatars), { [CHANNEL]: AVATAR });
  assert.strictEqual(result.dropped, 4);
});

test("parseBackup: una copia antigua sin avatares da avatars null", () => {
  const { YouTubeGroupsBackup: B } = loadModules();

  const result = B.parseBackup(envelope({ avatars: undefined }));

  assert.strictEqual(result.data.avatars, null);
  assert.strictEqual(result.dropped, 0);
});

test("parseBackup rechaza avatares que no son un objeto", () => {
  const { YouTubeGroupsBackup: B } = loadModules();

  assert.throws(
    () => B.parseBackup(envelope({ avatars: [] })),
    /La copia está dañada: avatares no válidos/,
  );
});

test("importBackup con avatares no válidos no escribe nada", async () => {
  const { YouTubeGroupsBackup: B, calls } = loadModules();

  await assert.rejects(
    () => B.importBackup(envelope({ avatars: [] })),
    /avatares no válidos/,
  );

  assert.strictEqual(calls.set, 0);
});

test("importBackup sin avatares no toca la clave guardada", async () => {
  const stored = { version: 1, avatars: { [CHANNEL_B]: AVATAR } };
  const target = loadModules({ youtubeAvatars: stored });

  await target.YouTubeGroupsBackup.importBackup(
    envelope({ avatars: undefined }),
  );

  assert.deepStrictEqual(plain(target.store.youtubeAvatars), stored);
  assert.ok(target.store.youtubeGroups);
});

test("importBackup con avatares los reemplaza", async () => {
  const target = loadModules({
    youtubeAvatars: { version: 1, avatars: { [CHANNEL_B]: AVATAR } },
  });

  await target.YouTubeGroupsBackup.importBackup(envelope());

  assert.deepStrictEqual(plain(target.store.youtubeAvatars), {
    version: 1,
    avatars: { [CHANNEL]: AVATAR },
  });
});

test("exportBackup e importBackup copian las cinco claves a otro contexto", async () => {
  const source = loadModules(fullStore());
  const text = await source.YouTubeGroupsBackup.exportBackup();
  assert.strictEqual(JSON.parse(text).version, 1);

  const target = loadModules();
  const result = await target.YouTubeGroupsBackup.importBackup(text);

  assert.strictEqual(result.dropped, 0);
  assert.deepStrictEqual(plain(target.store), fullStore());
});

test("importBackup con una copia que trae sidebarCollapsed la acepta y no lo guarda", async () => {
  const data = sample();
  const text = envelope({
    settings: { ...data.settings, sidebarCollapsed: true },
  });
  const target = loadModules();

  const result = await target.YouTubeGroupsBackup.importBackup(text);

  assert.strictEqual(result.dropped, 0);
  assert.deepStrictEqual(
    plain(target.store.youtubeSettings.settings),
    data.settings,
  );
});

test("importBackup con una copia no válida no escribe nada", async () => {
  const { YouTubeGroupsBackup: B, calls } = loadModules();

  await assert.rejects(() => B.importBackup("no es json"));
  await assert.rejects(() => B.importBackup(envelope({ version: 2 })));

  assert.strictEqual(calls.set, 0);
});

test("importBackup con latencia no bloquea la cola de otra escritura", async () => {
  const {
    YouTubeGroupsBackup: B,
    YouTubeGroupsStorage: S,
    store,
  } = loadModules({}, { latencyMs: 5 });

  const results = await Promise.all([
    B.importBackup(envelope()),
    S.withLock(S.KEYS.watched, () =>
      S.saveWatchedVideos({ [V2]: { watchedAt: 9 } }),
    ),
  ]);

  assert.strictEqual(results[0].dropped, 0);
  assert.ok(store.youtubeWatched);
});
