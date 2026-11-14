"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { loadModules } = require("./helpers/load-modules");

// Tabla de referencia escrita a mano a partir de las reglas del plan.
function expected(matchesFilter, isWatched, watchedMode, outsideMode) {
  if (!matchesFilter && outsideMode === "hide") return "hidden";
  if (isWatched && watchedMode === "hide") return "hidden";
  if (!matchesFilter) return "dimmed";
  if (isWatched && watchedMode === "dim") return "dimmed";
  return "visible";
}

test("getCardVisibility cubre todas las combinaciones", () => {
  const { YouTubeGroupsVisibility } = loadModules();

  for (const watchedMode of ["show", "dim", "hide"]) {
    for (const outsideMode of ["hide", "dim"]) {
      for (const matchesFilter of [true, false]) {
        for (const isWatched of [true, false]) {
          assert.strictEqual(
            YouTubeGroupsVisibility.getCardVisibility(
              { matchesFilter, isWatched },
              { watchedMode, outsideMode },
            ),
            expected(matchesFilter, isWatched, watchedMode, outsideMode),
            `${matchesFilter} ${isWatched} ${watchedMode} ${outsideMode}`,
          );
        }
      }
    }
  }
});

test("visto y fuera del filtro con watchedMode hide y outsideMode dim se oculta", () => {
  const { YouTubeGroupsVisibility } = loadModules();

  assert.strictEqual(
    YouTubeGroupsVisibility.getCardVisibility(
      { matchesFilter: false, isWatched: true },
      { watchedMode: "hide", outsideMode: "dim" },
    ),
    "hidden",
  );
});

test("con los valores por defecto el filtro oculta y los vistos se atenúan", () => {
  const { YouTubeGroupsVisibility, YouTubeGroupsSettings } = loadModules();
  const defaults = YouTubeGroupsSettings.DEFAULT_SETTINGS;
  const get = (matchesFilter, isWatched) =>
    YouTubeGroupsVisibility.getCardVisibility(
      { matchesFilter, isWatched },
      defaults,
    );

  assert.strictEqual(get(false, false), "hidden");
  assert.strictEqual(get(true, true), "dimmed");
  assert.strictEqual(get(true, false), "visible");
});
