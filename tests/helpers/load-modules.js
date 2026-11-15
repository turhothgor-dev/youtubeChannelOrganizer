"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..", "..");
const MODULES = [
  "storage.js",
  "icons.js",
  "groups.js",
  "watched.js",
  "settings.js",
  "visibility.js",
  "metadata.js",
  "pages.js",
  "filter.js",
  "playlists.js",
  "backup.js",
];

/**
 * Carga los scripts clásicos de modules/ en un contexto vm con un
 * browser.storage.local simulado (guarda y devuelve copias, cuenta llamadas a set).
 */
function loadModules(initialStore = {}, { latencyMs = 0 } = {}) {
  const store = structuredClone(initialStore);
  const calls = { get: 0, set: 0 };
  const delay = () =>
    latencyMs > 0
      ? new Promise((resolve) => setTimeout(resolve, latencyMs))
      : null;

  const browser = {
    storage: {
      local: {
        async get(key) {
          calls.get += 1;
          await delay();
          return key in store ? { [key]: structuredClone(store[key]) } : {};
        },
        async set(items) {
          calls.set += 1;
          await delay();
          Object.assign(store, structuredClone(items));
        },
      },
    },
  };

  const context = vm.createContext({
    window: { location: { origin: "https://www.youtube.com" } },
    URL,
    crypto: globalThis.crypto,
    structuredClone,
    browser,
  });

  for (const file of MODULES) {
    const code = fs.readFileSync(path.join(ROOT, "modules", file), "utf8");
    vm.runInContext(code, context, { filename: file });
  }

  return {
    store,
    calls,
    YouTubeGroups: vm.runInContext("YouTubeGroups", context),
    YouTubeGroupsIcons: vm.runInContext("YouTubeGroupsIcons", context),
    YouTubeGroupsStorage: vm.runInContext("YouTubeGroupsStorage", context),
    YouTubeGroupsWatched: vm.runInContext("YouTubeGroupsWatched", context),
    YouTubeGroupsSettings: vm.runInContext("YouTubeGroupsSettings", context),
    YouTubeGroupsVisibility: vm.runInContext(
      "YouTubeGroupsVisibility",
      context,
    ),
    YouTubeGroupsMetadata: vm.runInContext("YouTubeGroupsMetadata", context),
    YouTubeGroupsPages: vm.runInContext("YouTubeGroupsPages", context),
    YouTubeGroupsFilter: vm.runInContext("YouTubeGroupsFilter", context),
    YouTubeGroupsPlaylists: vm.runInContext("YouTubeGroupsPlaylists", context),
    YouTubeGroupsBackup: vm.runInContext("YouTubeGroupsBackup", context),
  };
}

// Pasa un objeto creado en el contexto vm a uno comparable con deepStrictEqual.
function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = { loadModules, plain };
