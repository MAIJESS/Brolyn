// Brolyn: catálogo temático de Broly y Dragon Ball Super para KinoTV.
// Datos: TMDB a través de kino.tmdb (Kino pone la llave; este código no lleva ninguna).
// Solo catálogo ("catalogOnly": true): Kino 0.9.54+ busca el título en los otros plugins de la persona.

const LANG = "es-MX";
const IMG_POSTER = "https://image.tmdb.org/t/p/w500";
const IMG_BACKDROP = "https://image.tmdb.org/t/p/w1280";
const IMG_STILL = "https://image.tmdb.org/t/p/w300";
const MAX_SEASONS = 20;

// Palabras que deben aparecer en el título para que un resultado pertenezca al tema.
const THEME_WORDS = ["broly", "dragon ball", "dragonball", "ドラゴンボール"];

// Filas de inicio. Cada "ref" sirve también para browse ("Ver más").
const ROWS = [
  { id: "broly", title: "La saga de Broly", genre: "peliculas", path: "/search/movie", params: { query: "Broly" }, themed: true },
  { id: "super", title: "Dragon Ball Super", genre: "anime", path: "/search/multi", params: { query: "Dragon Ball Super" }, themed: true },
  { id: "peliculas", title: "Películas de Dragon Ball", genre: "peliculas", path: "/search/movie", params: { query: "Dragon Ball" }, themed: true },
  { id: "series", title: "Series de Dragon Ball", genre: "anime", path: "/search/tv", params: { query: "Dragon Ball" }, themed: true },
  {
    id: "accion",
    title: "Más anime de acción",
    genre: "anime",
    path: "/discover/tv",
    params: { with_genres: "16,10759", with_original_language: "ja", sort_by: "popularity.desc", "vote_count.gte": 200 },
    themed: false,
  },
];

// ---------- Helpers HTTP y errores ----------

async function tmdb(path, params) {
  await null; // evita la trampa de rechazo temprano en Kino antiguos
  if (typeof kino.tmdb !== "function") {
    throw kino.error("unavailable", "kino.tmdb no existe en esta versión", {
      userMessage: "Actualiza Kino para usar Brolyn (necesita Kino 0.9.54 o superior).",
    });
  }
  return kino.tmdb(path, Object.assign({ language: LANG }, params || {}));
}

let lastSoftError = null;

// Devuelve null en vez de lanzar: para filas de inicio que pueden fallar sin romper todo.
async function tmdbSoft(path, params) {
  try {
    return await tmdb(path, params);
  } catch (e) {
    lastSoftError = e && e.code;
    kino.log("tmdb falló", path, e && e.code);
    return null;
  }
}

function friendlyError(e) {
  const code = e && e.code;
  if (code === "not_found") return kino.error("not_found", "TMDB 404");
  if (code === "rate_limited") return kino.error("rate_limited", "TMDB limitó las peticiones");
  if (code === "timeout" || code === "network" || code === "unavailable") {
    return kino.error("unavailable", "TMDB no respondió: " + code, {
      userMessage: "No pudimos conectar con el catálogo. Revisa tu conexión e inténtalo de nuevo.",
    });
  }
  return e; // no_tmdb_key y otros: Kino ya muestra su propio mensaje
}

function parseRef(ref) {
  try {
    const r = JSON.parse(ref);
    if (r && (r.t === "movie" || r.t === "tv" || r.t === "row") ) return r;
  } catch (_) {}
  throw kino.error("not_found", "ref inválida");
}

// ---------- Normalización ----------

let genreCache = null;

async function genreMap() {
  if (genreCache) return genreCache;
  const [m, t] = await Promise.all([tmdbSoft("/genre/movie/list"), tmdbSoft("/genre/tv/list")]);
  const map = {};
  for (const g of [].concat((m && m.genres) || [], (t && t.genres) || [])) map[g.id] = g.name;
  genreCache = map;
  return map;
}

function img(base, path) {
  return typeof path === "string" && path ? base + path : undefined;
}

function yearOf(date) {
  return typeof date === "string" && /^\d{4}/.test(date) ? date.slice(0, 4) : undefined;
}

function rating(v) {
  return typeof v === "number" && v > 0 ? Math.round(v * 10) / 10 : undefined;
}

function isThemed(m) {
  const text = [m.title, m.name, m.original_title, m.original_name].filter(Boolean).join(" ").toLowerCase();
  return THEME_WORDS.some((w) => text.includes(w));
}

function clean(obj) {
  for (const k of Object.keys(obj)) if (obj[k] === undefined || obj[k] === "") delete obj[k];
  return obj;
}

// Un resultado de lista de TMDB -> Item de Kino (sin pedir detalles por elemento).
function toItem(m, type, genres) {
  const t = type === "tv" ? "tv" : "movie";
  const title = m.title || m.name;
  if (!title || typeof m.id !== "number") return null;
  return clean({
    id: t + "-" + m.id,
    ref: JSON.stringify({ t, id: m.id }),
    kind: t === "tv" ? "series" : "movie",
    title: String(title).slice(0, 300),
    originalTitle: (m.original_title || m.original_name) !== title ? m.original_title || m.original_name : undefined,
    year: yearOf(m.release_date || m.first_air_date),
    poster: img(IMG_POSTER, m.poster_path),
    backdrop: img(IMG_BACKDROP, m.backdrop_path),
    overview: m.overview || undefined,
    rating: rating(m.vote_average),
    genres: Array.isArray(m.genre_ids) && genres ? m.genre_ids.map((g) => genres[g]).filter(Boolean).slice(0, 4) : undefined,
    lang: m.original_language || undefined,
    ids: { tmdb: m.id },
  });
}

function toItems(results, fallbackType, genres, themed) {
  const out = [];
  const seen = {};
  for (const m of results || []) {
    const type = m.media_type || fallbackType;
    if (type !== "movie" && type !== "tv") continue; // descarta personas
    if (m.adult) continue;
    if (themed && !isThemed(m)) continue;
    const it = toItem(m, type, genres);
    if (it && !seen[it.id]) {
      seen[it.id] = true;
      out.push(it);
    }
  }
  return out;
}

function typeOfPath(path) {
  return path.indexOf("/tv") !== -1 ? "tv" : "movie";
}

// ---------- Contrato ----------

export async function home() {
  const genres = await genreMap();
  const pages = await Promise.all(ROWS.map((r) => tmdbSoft(r.path, Object.assign({ page: 1, include_adult: false }, r.params))));
  const rows = [];
  ROWS.forEach((r, i) => {
    const data = pages[i];
    if (!data) return; // fila con error de red: se omite, el resto sigue
    const items = toItems(data.results, typeOfPath(r.path), genres, r.themed).slice(0, 60);
    if (!items.length) return; // fila vacía: no se muestra
    const row = { id: r.id, title: r.title, items, genre: r.genre };
    if ((data.total_pages || 1) > 1) row.ref = JSON.stringify({ t: "row", id: r.id });
    rows.push(row);
  });
  if (!rows.length) {
    if (lastSoftError === "no_tmdb_key") return []; // sin llave: inicio vacío, como recomienda la guía
    throw kino.error("unavailable", "home vacío", {
      userMessage: "No pudimos cargar el catálogo de Brolyn. Revisa tu conexión e inténtalo más tarde.",
    });
  }
  return rows;
}

export async function browse(ref, cursor) {
  const r = parseRef(ref);
  const row = r.t === "row" && ROWS.find((x) => x.id === r.id);
  if (!row) throw kino.error("not_found", "fila desconocida");
  const page = Math.max(1, parseInt(cursor || "1", 10) || 1);
  let data;
  try {
    data = await tmdb(row.path, Object.assign({ page, include_adult: false }, row.params));
  } catch (e) {
    throw friendlyError(e);
  }
  const items = toItems(data.results, typeOfPath(row.path), await genreMap(), row.themed);
  const total = Math.min(data.total_pages || 1, 500);
  return page < total ? { items, next: String(page + 1) } : { items };
}

export async function search(query) {
  const q = String((query && query.q) || "").trim();
  if (!q) return [];
  const page = Math.max(1, parseInt((query && query.cursor) || "1", 10) || 1);
  let data;
  try {
    data = await tmdb("/search/multi", { query: q.slice(0, 200), page, include_adult: false });
  } catch (e) {
    throw friendlyError(e);
  }
  const genres = await genreMap();
  let items = toItems(data.results, "movie", genres, false);
  // Lo del tema primero; el resto después para que la búsqueda siga siendo útil.
  items = items.filter((i) => isThemedItem(i)).concat(items.filter((i) => !isThemedItem(i)));
  if (query.type === "series") items.sort((a, b) => (b.kind === "series") - (a.kind === "series"));
  if (query.type === "movie") items.sort((a, b) => (b.kind === "movie") - (a.kind === "movie"));
  const total = Math.min(data.total_pages || 1, 500);
  return page < total ? { items, next: String(page + 1) } : { items };
}

function isThemedItem(i) {
  return isThemed({ title: i.title, original_title: i.originalTitle });
}

// Ficha de película (apiVersion 8). El reparto lo añade Kino gracias a ids.tmdb.
export async function details(ref) {
  const r = parseRef(ref);
  if (r.t !== "movie") return null;
  let m;
  try {
    m = await tmdb("/movie/" + r.id);
  } catch (e) {
    if (e && e.code === "not_found") return null;
    throw friendlyError(e);
  }
  return clean({
    title: m.title || undefined,
    overview: m.overview || "Sinopsis no disponible en español.",
    poster: img(IMG_POSTER, m.poster_path),
    backdrop: img(IMG_BACKDROP, m.backdrop_path),
    year: yearOf(m.release_date),
    genres: Array.isArray(m.genres) ? m.genres.map((g) => g.name).filter(Boolean) : undefined,
    rating: rating(m.vote_average),
    runtimeMinutes: typeof m.runtime === "number" && m.runtime > 0 ? m.runtime : undefined,
    ids: clean({ tmdb: m.id, imdb: /^tt\d{5,10}$/.test(m.imdb_id || "") ? m.imdb_id : undefined }),
  });
}

export async function episodes(ref) {
  const r = parseRef(ref);
  if (r.t !== "tv") throw kino.error("not_found", "no es una serie");
  let show;
  try {
    show = await tmdb("/tv/" + r.id, { append_to_response: "external_ids" });
  } catch (e) {
    throw friendlyError(e);
  }
  const imdb = show.external_ids && show.external_ids.imdb_id;
  const series = clean({
    title: show.name || undefined,
    overview: show.overview || "Sinopsis no disponible en español.",
    poster: img(IMG_POSTER, show.poster_path),
    backdrop: img(IMG_BACKDROP, show.backdrop_path),
    year: yearOf(show.first_air_date),
    genres: Array.isArray(show.genres) ? show.genres.map((g) => g.name).filter(Boolean) : undefined,
    rating: rating(show.vote_average),
    ids: clean({ tmdb: show.id, imdb: /^tt\d{5,10}$/.test(imdb || "") ? imdb : undefined }),
  });

  // Temporadas reales (sin especiales "0"), en lotes de 4 para respetar los límites de kino.tmdb.
  const numbers = (show.seasons || [])
    .map((s) => s.season_number)
    .filter((n) => typeof n === "number" && n > 0)
    .slice(0, MAX_SEASONS);
  const out = [];
  for (let i = 0; i < numbers.length; i += 4) {
    const batch = await Promise.all(numbers.slice(i, i + 4).map((n) => tmdbSoft("/tv/" + r.id + "/season/" + n)));
    for (const season of batch) {
      if (!season || !Array.isArray(season.episodes)) continue; // temporada con error: se omite
      for (const e of season.episodes) {
        if (!(e.episode_number > 0)) continue;
        out.push(clean({
          season: season.season_number,
          number: e.episode_number,
          ref: JSON.stringify({ t: "ep", id: r.id, s: season.season_number, e: e.episode_number }),
          title: e.name || "Episodio " + e.episode_number,
          still: img(IMG_STILL, e.still_path),
          overview: e.overview || undefined,
          airDate: typeof e.air_date === "string" && e.air_date ? e.air_date : undefined,
          runtimeMinutes: typeof e.runtime === "number" && e.runtime > 0 ? e.runtime : undefined,
        }));
      }
    }
  }
  if (!out.length && numbers.length) {
    throw kino.error("unavailable", "sin episodios", {
      userMessage: "No pudimos cargar los episodios de esta serie. Inténtalo de nuevo en un momento.",
    });
  }
  return { series, episodes: out };
}

// Solo lo llaman Kino 0.9.53 o anteriores; 0.9.54+ respeta "catalogOnly" y nunca lo llama.
export async function resolve() {
  await null;
  throw kino.error("not_found", "catalog only", {
    userMessage: "Brolyn solo muestra el catálogo: busca este título en tus otros plugins.",
  });
}
