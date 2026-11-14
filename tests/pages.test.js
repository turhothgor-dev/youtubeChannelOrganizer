"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { loadModules } = require("./helpers/load-modules");

test("getPageType clasifica las rutas conocidas", () => {
  const { YouTubeGroupsPages } = loadModules();
  const cases = {
    "/": "home",
    "/feed/subscriptions": "subscriptions",
    "/results": "search",
    "/watch": "watch",
    "/shorts/abc123": "shorts",
    "/@canal": "channel",
    "/@canal/videos": "channel",
    "/channel/UC123": "channel",
    "/channel/UC123/videos": "channel",
    "/c/canal": "channel",
    "/c/canal/featured": "channel",
    "/user/canal": "channel",
    "/user/canal/videos": "channel",
  };

  for (const [pathname, type] of Object.entries(cases)) {
    assert.strictEqual(
      YouTubeGroupsPages.getPageType(pathname),
      type,
      pathname,
    );
  }
});

test("getPageType devuelve other para el resto de rutas", () => {
  const { YouTubeGroupsPages } = loadModules();

  for (const pathname of [
    "/shorts/",
    "/shorts",
    "/feed/history",
    "/playlist",
    "/@",
    "/channel",
    "",
    undefined,
    null,
  ]) {
    assert.strictEqual(
      YouTubeGroupsPages.getPageType(pathname),
      "other",
      String(pathname),
    );
  }
});

test("getChannelUrlFromPath devuelve el canal de la página o null", () => {
  const { YouTubeGroupsPages } = loadModules();
  const origin = "https://www.youtube.com";
  const cases = {
    "/@foo/videos": `${origin}/@foo`,
    "/@foo": `${origin}/@foo`,
    "/@foo/": `${origin}/@foo`,
    "/channel/UCabc/shorts": `${origin}/channel/UCabc`,
    "/@%C3%B1u/videos": `${origin}/@%C3%B1u`,
    "/watch": null,
    "/": null,
    "/shorts/abc": null,
    [undefined]: null,
  };
  for (const [pathname, expected] of Object.entries(cases)) {
    assert.strictEqual(
      YouTubeGroupsPages.getChannelUrlFromPath(
        pathname === "undefined" ? undefined : pathname,
        origin,
      ),
      expected,
      pathname,
    );
  }
});

test("shouldShowCardControls es true solo en inicio, suscripciones, búsqueda y watch", () => {
  const { YouTubeGroupsPages } = loadModules();

  for (const type of ["home", "subscriptions", "search", "watch"]) {
    assert.strictEqual(YouTubeGroupsPages.shouldShowCardControls(type), true);
  }
  for (const type of ["shorts", "channel", "other", undefined]) {
    assert.strictEqual(YouTubeGroupsPages.shouldShowCardControls(type), false);
  }
});
