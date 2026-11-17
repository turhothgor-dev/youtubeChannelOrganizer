"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { JSDOM, VirtualConsole } = require("jsdom");

const ROOT = path.resolve(__dirname, "..", "..");
const DEFAULT_URL = "https://www.youtube.com/feed/subscriptions";
const MAX_FLUSH_TURNS = 100;

/**
 * Devuelve los scripts de content_scripts[0].js del manifiesto, en su orden.
 * @returns {string[]} Rutas relativas a la raíz del proyecto.
 */
function manifestScripts() {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"),
  );
  return manifest.content_scripts[0].js;
}

/**
 * Crea un documento de jsdom y ejecuta en su contexto, con node:vm, los scripts
 * del manifiesto con un browser.storage simulado (get/set con copias y
 * contadores, onChanged asíncrono). `location` es el de jsdom: una navegación a
 * otra página no se ejecuta y se cuenta en `navigations`.
 * @param {Object} [options] - Todo opcional.
 * @param {string} [options.url] - URL de la página.
 * @param {string} [options.html] - HTML dentro de <body>.
 * @param {Object} [options.store] - Contenido inicial del almacenamiento.
 * @param {string[]} [options.scripts] - Scripts a ejecutar (por defecto, los del manifiesto).
 * @param {Function} [options.confirm] - Sustituto de `confirm`.
 * @param {Function} [options.prompt] - Sustituto de `prompt`.
 * @returns {Object} { window, document, browser, store, calls, sessionStorage,
 *   location, navigations, flush, global }.
 */
function loadDom({
  url = DEFAULT_URL,
  html = "",
  store: initialStore = {},
  scripts = manifestScripts(),
  confirm = () => true,
  prompt = () => null,
} = {}) {
  // jsdom avisa de las navegaciones que no implementa (location.assign a otra
  // página); aquí solo se cuentan.
  const navigations = { count: 0 };
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (error) => {
    if (error && error.type === "not-implemented") {
      navigations.count += 1;
    } else {
      console.error(error);
    }
  });
  const jsdom = new JSDOM(
    `<!doctype html><html><head></head><body>${html}</body></html>`,
    { url, runScripts: "outside-only", virtualConsole },
  );
  const { window } = jsdom;
  const { document, location, sessionStorage } = window;

  const store = structuredClone(initialStore);
  const calls = { get: 0, set: 0 };
  const listeners = [];

  const browser = {
    storage: {
      local: {
        async get(key) {
          calls.get += 1;
          return key in store ? { [key]: structuredClone(store[key]) } : {};
        },
        async set(items) {
          calls.set += 1;
          const changes = {};
          for (const [key, value] of Object.entries(items)) {
            changes[key] = {
              oldValue: key in store ? structuredClone(store[key]) : undefined,
              newValue: structuredClone(value),
            };
          }
          Object.assign(store, structuredClone(items));
          setImmediate(() => {
            for (const listener of listeners) {
              listener(structuredClone(changes), "local");
            }
          });
        },
      },
      onChanged: {
        addListener(listener) {
          listeners.push(listener);
        },
      },
    },
  };

  const rafQueue = [];

  // jsdom no maqueta ni trae estas APIs del navegador (o no sirven sin
  // maquetación): sustitutos mínimos para que el código no falle.
  const elementProto = window.Element.prototype;
  if (!elementProto.checkVisibility) {
    // Sin maquetación: todo se considera visible.
    elementProto.checkVisibility = () => true;
  }
  Object.assign(window, {
    // Cola controlada por flush() en lugar de pretendToBeVisual.
    requestAnimationFrame: (callback) => rafQueue.push(callback),
    matchMedia: () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    }),
    innerWidth: 1280,
    innerHeight: 800,
    confirm,
    prompt,
    alert: () => {},
    browser,
    // jsdom no expone structuredClone en su ventana.
    structuredClone,
  });

  const context = jsdom.getInternalVMContext();

  for (const file of scripts) {
    const code = fs.readFileSync(path.join(ROOT, file), "utf8");
    vm.runInContext(code, context, { filename: file });
  }

  /**
   * Espera las microtareas y ejecuta los requestAnimationFrame pendientes, en
   * bucle hasta que no quede nada.
   * @returns {Promise<void>}
   */
  async function flush() {
    for (let turn = 0; turn < MAX_FLUSH_TURNS; turn += 1) {
      await new Promise((resolve) => setImmediate(resolve));
      if (rafQueue.length === 0) {
        return;
      }
      for (const callback of rafQueue.splice(0)) {
        callback(0);
      }
    }
    throw new Error("flush: no se estabiliza tras " + MAX_FLUSH_TURNS);
  }

  return {
    window,
    document,
    browser,
    store,
    calls,
    sessionStorage,
    location,
    navigations,
    flush,
    global: (name) => vm.runInContext(name, context),
  };
}

module.exports = { loadDom, manifestScripts };
