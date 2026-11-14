"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..", "..");
const MODULES = ["storage.js", "icons.js", "groups.js"];

/**
 * Carga los scripts clásicos de modules/ en un contexto vm con un
 * browser.storage.local simulado (guarda y devuelve copias, cuenta llamadas a set).
 */
function loadModules(initialStore = {}) {
  const store = structuredClone(initialStore);
  const calls = { get: 0, set: 0 };

  const browser = {
    storage: {
      local: {
        async get(key) {
          calls.get += 1;
          return key in store ? { [key]: structuredClone(store[key]) } : {};
        },
        async set(items) {
          calls.set += 1;
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
  };
}

// Pasa un objeto creado en el contexto vm a uno comparable con deepStrictEqual.
function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = { loadModules, plain };
