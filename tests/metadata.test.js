"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { loadModules, plain } = require("./helpers/load-modules");

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

test("extractCardMetadata devuelve el primer valor de cada tipo", () => {
  const { extractCardMetadata } = loadModules().YouTubeGroupsMetadata;
  assert.deepStrictEqual(
    plain(
      extractCardMetadata([
        "Título",
        "12:34",
        "1,2 M de visualizaciones",
        "hace 3 días",
      ]),
    ),
    { duration: 754, age: 259200, views: 1200000 },
  );
  assert.deepStrictEqual(plain(extractCardMetadata(["Título", "Canal"])), {
    duration: null,
    age: null,
    views: null,
  });
  assert.deepStrictEqual(
    plain(extractCardMetadata(["1:00", "2:00", "hace 1 hora", "hace 2 horas"])),
    { duration: 60, age: 3600, views: null },
  );
});

test("matchesAdvancedFilters respeta límites y datos desconocidos", () => {
  const { matchesAdvancedFilters: m } = loadModules().YouTubeGroupsMetadata;
  const any = { duration: "any", age: "any", views: "any" };
  const meta = (o) => ({ duration: null, age: null, views: null, ...o });

  assert.strictEqual(m(meta({ duration: 5, age: 5, views: 5 }), any), true);
  const d = (id, duration) => m(meta({ duration }), { ...any, duration: id });
  assert.strictEqual(d("short", 239), true);
  assert.strictEqual(d("short", 240), false);
  assert.strictEqual(d("medium", 240), true);
  assert.strictEqual(d("medium", 1200), true);
  assert.strictEqual(d("medium", 239), false);
  assert.strictEqual(d("medium", 1201), false);
  assert.strictEqual(d("long", 1201), true);
  assert.strictEqual(d("long", 1200), false);

  const a = (id, age) => m(meta({ age }), { ...any, age: id });
  assert.strictEqual(a("day", 86400), true);
  assert.strictEqual(a("day", 86401), false);
  assert.strictEqual(a("week", 604800), true);
  assert.strictEqual(a("week", 604801), false);
  assert.strictEqual(a("month", 2592000), true);
  assert.strictEqual(a("year", 31536000), true);
  assert.strictEqual(a("year", 31536001), false);

  const v = (id, views) => m(meta({ views }), { ...any, views: id });
  assert.strictEqual(v("1k", 999), false);
  assert.strictEqual(v("1k", 1000), true);
  assert.strictEqual(v("10k", 9999), false);
  assert.strictEqual(v("100k", 100000), true);
  assert.strictEqual(v("1m", 999999), false);
  assert.strictEqual(v("1m", 1000000), true);

  // Dato desconocido pasa en cada criterio.
  assert.strictEqual(d("long", null), true);
  assert.strictEqual(a("day", null), true);
  assert.strictEqual(v("1m", null), true);

  // Un criterio que falla basta.
  assert.strictEqual(
    m(meta({ duration: 100, views: 5 }), {
      duration: "short",
      age: "any",
      views: "1k",
    }),
    false,
  );
  // Id desconocido = any.
  assert.strictEqual(
    m(meta({ duration: 5 }), { duration: "zzz", age: "zzz", views: "zzz" }),
    true,
  );
});

test("hasActiveFilters detecta criterios activos", () => {
  const { hasActiveFilters } = loadModules().YouTubeGroupsMetadata;
  assert.strictEqual(
    hasActiveFilters({ duration: "any", age: "any", views: "any" }),
    false,
  );
  assert.strictEqual(
    hasActiveFilters({ duration: "any", age: "week", views: "any" }),
    true,
  );
});

test("FILTER_OPTIONS empieza por any, con ids únicos y etiquetas", () => {
  const { FILTER_OPTIONS } = loadModules().YouTubeGroupsMetadata;
  assert.deepStrictEqual(Object.keys(FILTER_OPTIONS).sort(), [
    "age",
    "duration",
    "views",
  ]);
  for (const options of Object.values(FILTER_OPTIONS)) {
    assert.strictEqual(options[0].id, "any");
    const ids = options.map((o) => o.id);
    assert.strictEqual(new Set(ids).size, ids.length);
    for (const o of options) {
      assert.ok(typeof o.label === "string" && o.label.length > 0);
    }
  }
});
