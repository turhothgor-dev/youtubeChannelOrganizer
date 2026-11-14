"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { loadModules } = require("./helpers/load-modules");

function cases(fn, table) {
  for (const [input, expected] of table) {
    assert.strictEqual(fn(input), expected, JSON.stringify(input));
  }
}

test("parseDuration interpreta m:ss y h:mm:ss", () => {
  const { parseDuration } = loadModules().YouTubeGroupsMetadata;
  cases(parseDuration, [
    ["0:59", 59],
    ["12:34", 754],
    ["1:02:03", 3723],
    [" 4:00 ", 240],
    ["12:3", null],
    ["1:60", null],
    ["abc", null],
    ["12", null],
    ["EN DIRECTO", null],
    ["", null],
  ]);
});

test("parseViewCount interpreta español e inglés", () => {
  const { parseViewCount } = loadModules().YouTubeGroupsMetadata;
  cases(parseViewCount, [
    ["345 visualizaciones", 345],
    ["1 visualización", 1],
    ["1.234 visualizaciones", 1234],
    ["12 mil visualizaciones", 12000],
    ["1,2 M de visualizaciones", 1200000],
    ["2 mil M de visualizaciones", 2000000000],
    ["Sin visualizaciones", 0],
    ["1.2M views", 1200000],
    ["12K views", 12000],
    ["1,234 views", 1234],
    ["3.4B views", 3400000000],
    ["No views", 0],
    ["1,2 mil espectadores", null],
    ["500 watching", null],
    ["hace 3 días", null],
    ["12:34", null],
  ]);
});

test("parseAge interpreta español e inglés", () => {
  const { parseAge } = loadModules().YouTubeGroupsMetadata;
  cases(parseAge, [
    ["hace 3 días", 259200],
    ["hace 1 hora", 3600],
    ["Emitido hace 2 semanas", 1209600],
    ["hace 5 meses", 12960000],
    ["hace 1 año", 31536000],
    ["3 days ago", 259200],
    ["Streamed 1 month ago", 2592000],
    ["10 minutes ago", 600],
    ["345 visualizaciones", null],
    ["ayer", null],
    ["12:34", null],
  ]);
});
