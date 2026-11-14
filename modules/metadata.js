const YouTubeGroupsMetadata = (() => {
  const DURATION_RE =
    /^\s*(?:(\d{1,2}):([0-5]\d)|(\d{1,2}):([0-5]\d):([0-5]\d))\s*$/;
  const NO_VIEWS_RE = /^\s*(?:sin\s+visualizaciones|no\s+views)\s*$/i;
  const VIEWS_RE =
    /^\s*(\d[\d.,\s  ]*?)\s*(mil\s+millones|mil\s+m|millones|mill\.?|mil|k|m|b)?\s*(?:de\s+)?(?:visualizaci(?:ón|on|ones)|views?)\s*$/i;
  const AGE_ES_RE =
    /^\s*(?:(?:emitido|transmitido|estrenado)\s+)?hace\s+(\d+)\s+([a-zñáéíóú]+)\s*$/i;
  const AGE_EN_RE =
    /^\s*(?:(?:streamed|premiered)\s+)?(\d+)\s+([a-z]+)\s+ago\s*$/i;

  const SUFFIX_FACTORS = [
    [/^(?:mil\s+millones|mil\s+m|b)$/, 1e9],
    [/^(?:millones|mill\.?|m)$/, 1e6],
    [/^(?:mil|k)$/, 1e3],
  ];

  const UNIT_SECONDS = [
    [/^(?:segundos?|seconds?)$/, 1],
    [/^(?:minutos?|minutes?)$/, 60],
    [/^(?:horas?|hours?)$/, 3600],
    [/^(?:d[ií]as?|days?)$/, 86400],
    [/^(?:semanas?|weeks?)$/, 604800],
    [/^(?:mes|meses|months?)$/, 2592000],
    [/^(?:a[ñn]os?|years?)$/, 31536000],
  ];

  /**
   * Convierte la insignia de duración ("12:34", "1:02:03") en segundos.
   *
   * @param {string} text - Texto de la insignia.
   * @returns {number|null} Segundos, o null si no es una duración.
   */
  function parseDuration(text) {
    const match = DURATION_RE.exec(String(text));
    if (!match) {
      return null;
    }
    if (match[1] !== undefined) {
      return Number(match[1]) * 60 + Number(match[2]);
    }
    return Number(match[3]) * 3600 + Number(match[4]) * 60 + Number(match[5]);
  }

  /**
   * Convierte el texto de visualizaciones (español o inglés) en un entero.
   *
   * @param {string} text - Texto como "1,2 M de visualizaciones" o "1.2M views".
   * @returns {number|null} Visualizaciones, o null si no es un recuento (p. ej. directos).
   */
  function parseViewCount(text) {
    const value = String(text);
    if (NO_VIEWS_RE.test(value)) {
      return 0;
    }
    const match = VIEWS_RE.exec(value);
    if (!match) {
      return null;
    }
    const number = match[1].trim();
    const suffix = match[2] ? match[2].toLowerCase().replace(/\s+/g, " ") : "";

    if (suffix) {
      if (!/^\d+(?:[.,]\d+)?$/.test(number)) {
        return null;
      }
      const entry = SUFFIX_FACTORS.find(([re]) => re.test(suffix));
      if (!entry) {
        return null;
      }
      return Math.round(Number(number.replace(",", ".")) * entry[1]);
    }

    if (!/^(?:\d{1,3}(?:[.,\s  ]\d{3})+|\d+)$/.test(number)) {
      return null;
    }
    return Number(number.replace(/[.,\s  ]/g, ""));
  }

  /**
   * Convierte la antigüedad ("hace 3 días", "3 days ago") en segundos.
   * Mes = 30 días, año = 365 días.
   *
   * @param {string} text - Texto de antigüedad.
   * @returns {number|null} Segundos, o null si no es una antigüedad.
   */
  function parseAge(text) {
    const value = String(text);
    const match = AGE_ES_RE.exec(value) || AGE_EN_RE.exec(value);
    if (!match) {
      return null;
    }
    const unit = match[2].toLowerCase();
    const entry = UNIT_SECONDS.find(([re]) => re.test(unit));
    return entry ? Number(match[1]) * entry[1] : null;
  }

  /**
   * Opciones fijas de cada criterio. `test` recibe el dato y dice si cumple.
   * Los umbrales de duración y antigüedad están en segundos.
   */
  const FILTER_DEFS = {
    duration: [
      { id: "any", label: "Cualquiera" },
      { id: "short", label: "Menos de 4 min", test: (d) => d < 240 },
      {
        id: "medium",
        label: "De 4 a 20 min",
        test: (d) => d >= 240 && d <= 1200,
      },
      { id: "long", label: "Más de 20 min", test: (d) => d > 1200 },
    ],
    age: [
      { id: "any", label: "Cualquiera" },
      { id: "day", label: "Últimas 24 horas", test: (a) => a <= 86400 },
      { id: "week", label: "Última semana", test: (a) => a <= 604800 },
      { id: "month", label: "Último mes", test: (a) => a <= 2592000 },
      { id: "year", label: "Último año", test: (a) => a <= 31536000 },
    ],
    views: [
      { id: "any", label: "Cualquiera" },
      { id: "1k", label: "Desde 1 mil", test: (v) => v >= 1e3 },
      { id: "10k", label: "Desde 10 mil", test: (v) => v >= 1e4 },
      { id: "100k", label: "Desde 100 mil", test: (v) => v >= 1e5 },
      { id: "1m", label: "Desde 1 M", test: (v) => v >= 1e6 },
    ],
  };

  const FILTER_OPTIONS = Object.fromEntries(
    Object.entries(FILTER_DEFS).map(([key, options]) => [
      key,
      options.map(({ id, label }) => ({ id, label })),
    ]),
  );

  /**
   * Extrae duración, antigüedad y visualizaciones de los textos de una tarjeta.
   *
   * @param {string[]} texts - Textos de la tarjeta.
   * @returns {{duration: number|null, age: number|null, views: number|null}}
   *   Primer valor no nulo de cada tipo, o null.
   */
  function extractCardMetadata(texts) {
    const result = { duration: null, age: null, views: null };
    const parsers = [
      ["duration", parseDuration],
      ["age", parseAge],
      ["views", parseViewCount],
    ];
    for (const text of texts) {
      for (const [key, parse] of parsers) {
        if (result[key] === null) {
          result[key] = parse(text);
        }
      }
    }
    return result;
  }

  /**
   * Indica si una tarjeta cumple los filtros avanzados. Un dato desconocido
   * (null), un criterio "any" o un id desconocido no excluyen la tarjeta.
   *
   * @param {{duration: number|null, age: number|null, views: number|null}} metadata
   * @param {{duration: string, age: string, views: string}} filters
   * @returns {boolean} true si la tarjeta pasa todos los criterios.
   */
  function matchesAdvancedFilters(metadata, filters) {
    return Object.keys(FILTER_DEFS).every((key) => {
      const value = metadata ? metadata[key] : null;
      if (value === null || value === undefined) {
        return true;
      }
      const option = FILTER_DEFS[key].find(
        (o) => o.id === (filters && filters[key]),
      );
      return !option || !option.test || option.test(value);
    });
  }

  /**
   * Indica si algún criterio de filtro está activo (distinto de "any").
   *
   * @param {{duration: string, age: string, views: string}} filters
   * @returns {boolean} true si hay algún filtro activo.
   */
  function hasActiveFilters(filters) {
    return Object.keys(FILTER_DEFS).some(
      (key) => filters && filters[key] !== undefined && filters[key] !== "any",
    );
  }

  return {
    parseDuration,
    parseViewCount,
    parseAge,
    extractCardMetadata,
    FILTER_OPTIONS,
    matchesAdvancedFilters,
    hasActiveFilters,
  };
})();
