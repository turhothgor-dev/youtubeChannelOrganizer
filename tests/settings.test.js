"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { loadModules, plain } = require("./helpers/load-modules");

const DEFAULTS = {
  watchedMode: "dim",
  outsideMode: "hide",
  autoMarkPercent: 80,
  panelCollapsed: true,
  sidebarCollapsed: false,
};

test("normalizeSettings devuelve los valores por defecto con entradas no válidas", () => {
  const { YouTubeGroupsSettings } = loadModules();

  for (const raw of [undefined, null, [], {}, 3]) {
    assert.deepStrictEqual(
      plain(YouTubeGroupsSettings.normalizeSettings(raw)),
      DEFAULTS,
    );
  }
});

test("normalizeSettings conserva valores válidos", () => {
  const { YouTubeGroupsSettings } = loadModules();
  const raw = {
    watchedMode: "hide",
    outsideMode: "dim",
    autoMarkPercent: 95,
    panelCollapsed: true,
    sidebarCollapsed: true,
  };

  assert.deepStrictEqual(
    plain(YouTubeGroupsSettings.normalizeSettings(raw)),
    raw,
  );
});

test("normalizeSettings conserva autoMarkPercent 0 y sustituye valores no válidos", () => {
  const { YouTubeGroupsSettings } = loadModules();

  assert.strictEqual(
    YouTubeGroupsSettings.normalizeSettings({ autoMarkPercent: 0 })
      .autoMarkPercent,
    0,
  );
  for (const bad of [70, "80", null, NaN]) {
    assert.strictEqual(
      YouTubeGroupsSettings.normalizeSettings({ autoMarkPercent: bad })
        .autoMarkPercent,
      80,
    );
  }
});

test("normalizeSettings sustituye solo el campo inválido", () => {
  const { YouTubeGroupsSettings } = loadModules();

  const result = YouTubeGroupsSettings.normalizeSettings({
    watchedMode: "x",
    outsideMode: "dim",
  });

  assert.deepStrictEqual(plain(result), {
    watchedMode: "dim",
    outsideMode: "dim",
    autoMarkPercent: 80,
    panelCollapsed: true,
    sidebarCollapsed: false,
  });
});

test("normalizeSettings sustituye panelCollapsed no booleano por true", () => {
  const { YouTubeGroupsSettings } = loadModules();

  for (const bad of ["sí", 1, null, undefined]) {
    assert.strictEqual(
      YouTubeGroupsSettings.normalizeSettings({ panelCollapsed: bad })
        .panelCollapsed,
      true,
    );
  }
});

test("normalizeSettings conserva panelCollapsed false", () => {
  const { YouTubeGroupsSettings } = loadModules();

  assert.strictEqual(
    YouTubeGroupsSettings.normalizeSettings({ panelCollapsed: false })
      .panelCollapsed,
    false,
  );
});

test("updateSettings con panelCollapsed false escribe una vez desde el valor por defecto", async () => {
  const { YouTubeGroupsSettings, calls } = loadModules();

  const result = await YouTubeGroupsSettings.updateSettings({
    panelCollapsed: false,
  });

  assert.strictEqual(result.changed, true);
  assert.strictEqual(result.settings.panelCollapsed, false);
  assert.strictEqual(calls.set, 1);
});

test("normalizeSettings descarta campos desconocidos y no muta la entrada", () => {
  const { YouTubeGroupsSettings } = loadModules();
  const raw = { watchedMode: "show", foo: 1 };

  const result = YouTubeGroupsSettings.normalizeSettings(raw);

  assert.deepStrictEqual(plain(result), {
    watchedMode: "show",
    outsideMode: "hide",
    autoMarkPercent: 80,
    panelCollapsed: true,
    sidebarCollapsed: false,
  });
  assert.deepStrictEqual(raw, { watchedMode: "show", foo: 1 });
  assert.notStrictEqual(result, raw);
});

test("getSettings sin datos devuelve los valores por defecto sin escribir", async () => {
  const { YouTubeGroupsSettings, calls } = loadModules();

  const settings = await YouTubeGroupsSettings.getSettings();

  assert.deepStrictEqual(plain(settings), DEFAULTS);
  assert.strictEqual(calls.set, 0);
});

test("updateSettings escribe una vez y no repite si no cambia", async () => {
  const { YouTubeGroupsSettings, calls, store } = loadModules();

  const first = await YouTubeGroupsSettings.updateSettings({
    watchedMode: "hide",
  });
  assert.strictEqual(first.changed, true);
  assert.deepStrictEqual(plain(first.settings), {
    watchedMode: "hide",
    outsideMode: "hide",
    autoMarkPercent: 80,
    panelCollapsed: true,
    sidebarCollapsed: false,
  });
  assert.strictEqual(calls.set, 1);
  assert.strictEqual(store.youtubeSettings.version, 1);

  const second = await YouTubeGroupsSettings.updateSettings({
    watchedMode: "hide",
  });
  assert.strictEqual(second.changed, false);
  assert.strictEqual(calls.set, 1);
});

test("updateSettings conserva el otro campo", async () => {
  const { YouTubeGroupsSettings } = loadModules({
    youtubeSettings: {
      version: 1,
      settings: { watchedMode: "show", outsideMode: "dim" },
    },
  });

  const result = await YouTubeGroupsSettings.updateSettings({
    watchedMode: "hide",
  });

  assert.deepStrictEqual(plain(result.settings), {
    watchedMode: "hide",
    outsideMode: "dim",
    autoMarkPercent: 80,
    panelCollapsed: true,
    sidebarCollapsed: false,
  });
});

test("updateSettings con panelCollapsed escribe una vez y conserva los demás campos", async () => {
  const { YouTubeGroupsSettings, calls } = loadModules({
    youtubeSettings: {
      version: 1,
      settings: { watchedMode: "show", outsideMode: "dim" },
    },
  });

  const result = await YouTubeGroupsSettings.updateSettings({
    panelCollapsed: false,
  });

  assert.strictEqual(result.changed, true);
  assert.deepStrictEqual(plain(result.settings), {
    watchedMode: "show",
    outsideMode: "dim",
    autoMarkPercent: 80,
    panelCollapsed: false,
    sidebarCollapsed: false,
  });
  assert.strictEqual(calls.set, 1);
});

test("normalizeSettings sustituye sidebarCollapsed no booleano por false", () => {
  const { YouTubeGroupsSettings } = loadModules();

  for (const bad of ["sí", 1, null, undefined]) {
    assert.strictEqual(
      YouTubeGroupsSettings.normalizeSettings({ sidebarCollapsed: bad })
        .sidebarCollapsed,
      false,
    );
  }
});

test("normalizeSettings conserva sidebarCollapsed true", () => {
  const { YouTubeGroupsSettings } = loadModules();

  assert.strictEqual(
    YouTubeGroupsSettings.normalizeSettings({ sidebarCollapsed: true })
      .sidebarCollapsed,
    true,
  );
});

test("updateSettings con sidebarCollapsed escribe una vez y conserva los demás campos", async () => {
  const { YouTubeGroupsSettings, calls } = loadModules({
    youtubeSettings: {
      version: 1,
      settings: { watchedMode: "show", outsideMode: "dim" },
    },
  });

  const result = await YouTubeGroupsSettings.updateSettings({
    sidebarCollapsed: true,
  });

  assert.strictEqual(result.changed, true);
  assert.deepStrictEqual(plain(result.settings), {
    watchedMode: "show",
    outsideMode: "dim",
    autoMarkPercent: 80,
    panelCollapsed: true,
    sidebarCollapsed: true,
  });
  assert.strictEqual(calls.set, 1);
});

test("updateSettings con autoMarkPercent 0 escribe y conserva los otros campos", async () => {
  const { YouTubeGroupsSettings, calls } = loadModules({
    youtubeSettings: {
      version: 1,
      settings: { watchedMode: "show", outsideMode: "dim" },
    },
  });

  const result = await YouTubeGroupsSettings.updateSettings({
    autoMarkPercent: 0,
  });

  assert.strictEqual(result.changed, true);
  assert.deepStrictEqual(plain(result.settings), {
    watchedMode: "show",
    outsideMode: "dim",
    autoMarkPercent: 0,
    panelCollapsed: true,
    sidebarCollapsed: false,
  });
  assert.strictEqual(calls.set, 1);
});

test("updateSettings rechaza claves y valores inválidos sin leer ni escribir", async () => {
  for (const patch of [
    { watchedMode: "nope" },
    { foo: 1 },
    { autoMarkPercent: 70 },
    { autoMarkPercent: "80" },
    { panelCollapsed: 1 },
    { sidebarCollapsed: 1 },
  ]) {
    const { YouTubeGroupsSettings, calls } = loadModules();

    await assert.rejects(
      YouTubeGroupsSettings.updateSettings(patch),
      /Ajuste inválido: /,
    );
    assert.strictEqual(calls.set, 0);
    assert.strictEqual(calls.get, 0);
  }
});

test("dos updateSettings a la vez conservan los dos cambios", async () => {
  const { YouTubeGroupsSettings: S, store } = loadModules({}, { latencyMs: 5 });

  await Promise.all([
    S.updateSettings({ watchedMode: "hide" }),
    S.updateSettings({ outsideMode: "dim" }),
  ]);

  assert.strictEqual(store.youtubeSettings.settings.watchedMode, "hide");
  assert.strictEqual(store.youtubeSettings.settings.outsideMode, "dim");
});
