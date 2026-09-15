/**
 * Extraction locale des stations mobiles 2G / 3G / 4G.
 *
 * Les stations sont publiées sous forme de jeux de tuiles vectorielles sur le
 * compte Mapbox de l'ARTCI. Les tuiles ne sont pas exploitables pour de
 * l'analyse : on ne peut ni les agréger, ni les joindre aux découpages
 * administratifs, ni les compter. Ce script les rapatrie une fois pour toutes
 * en GeoJSON local, puis rattache chaque station à sa sous-préfecture par
 * localisation ponctuelle - ce qui donne, par héritage, sa chaîne
 * administrative complète (district, région, département).
 *
 *   node scripts/extract-stations.mjs [--zoom N] [--date AAAA-MM-JJ]
 *
 * Produit : dataFiles/data_server/data_cov/stations.geojson
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { VectorTile } from "@mapbox/vector-tile";
// pbf 4 n'exporte plus de défaut : le lecteur s'appelle `PbfReader`.
import { PbfReader } from "pbf";
import { booleanPointInPolygon, bbox } from "@turf/turf";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "dataFiles", "data_server", "data_cov");

/** Jeux de tuiles publiés, un par technologie. */
const TILESETS = [
  { tech: "2G", id: "yaoparfait.bzvlxsrw" },
  { tech: "3G", id: "yaoparfait.9d4txn9w" },
  { tech: "4G", id: "yaoparfait.9eto12ui" },
];

/** Emprise du territoire ivoirien, marge comprise. */
const EXTENT = { west: -8.9, east: -2.2, south: 4.1, north: 10.9 };

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
/** Période dont on emprunte le découpage administratif pour la jointure. */
const JOIN_DATE = argOf("--date", "2024-12-31");
const FORCED_ZOOM = args.includes("--zoom") ? Number(argOf("--zoom")) : null;

process.loadEnvFile(path.join(ROOT, ".env.local"));
const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
if (!TOKEN) {
  console.error("NEXT_PUBLIC_MAPBOX_TOKEN absent de .env.local");
  process.exit(1);
}

/* ------------------------------ Tuiles ---------------------------------- */

const lngToX = (lng, z) => Math.floor(((lng + 180) / 360) * 2 ** z);
const latToY = (lat, z) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};

/** Métadonnées du jeu de tuiles (zoom maximal, couches). */
async function tileJson(id) {
  const r = await fetch(`https://api.mapbox.com/v4/${id}.json?access_token=${TOKEN}`);
  if (!r.ok) throw new Error(`TileJSON ${id} : HTTP ${r.status}`);
  return r.json();
}

/** Télécharge et décode une tuile ; renvoie les entités en GeoJSON. */
async function fetchTile(id, z, x, y) {
  const url = `https://api.mapbox.com/v4/${id}/${z}/${x}/${y}.mvt?access_token=${TOKEN}`;
  const r = await fetch(url);
  if (r.status === 404 || r.status === 204) return [];
  if (!r.ok) throw new Error(`Tuile ${z}/${x}/${y} : HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (!buf.length) return [];
  const tile = new VectorTile(new PbfReader(buf));
  const out = [];
  for (const name of Object.keys(tile.layers)) {
    const layer = tile.layers[name];
    for (let i = 0; i < layer.length; i++) out.push(layer.feature(i).toGeoJSON(x, y, z));
  }
  return out;
}

/** Exécute `worker` sur chaque élément, `limit` en parallèle. */
async function mapPool(items, limit, worker) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      await worker(items[i], i);
    }
  });
  await Promise.all(runners);
}

/**
 * Rapatrie toutes les stations d'une technologie.
 * La déduplication porte sur le couple (code, position) : une même station
 * apparaît dans chaque tuile qui la recouvre, et sur les tuiles voisines à
 * cause de la marge de rendu.
 */
async function extractTech({ tech, id }) {
  const meta = await tileJson(id);
  const zoom = FORCED_ZOOM ?? meta.maxzoom ?? 10;

  const x0 = lngToX(EXTENT.west, zoom);
  const x1 = lngToX(EXTENT.east, zoom);
  const y0 = latToY(EXTENT.north, zoom);
  const y1 = latToY(EXTENT.south, zoom);

  const tiles = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) tiles.push([x, y]);

  const seen = new Map();
  let done = 0;
  let errors = 0;
  await mapPool(tiles, 24, async ([x, y]) => {
    try {
      for (const f of await fetchTile(id, zoom, x, y)) {
        const [lng, lat] = f.geometry?.coordinates ?? [];
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
        const p = f.properties ?? {};
        // Position arrondie : la même station peut différer d'un cran de tuile.
        const key = `${p.code ?? ""}|${lng.toFixed(5)}|${lat.toFixed(5)}`;
        if (!seen.has(key)) {
          seen.set(key, {
            code: String(p.code ?? ""),
            name: String(p.Site_Name ?? ""),
            tech,
            district: String(p.district ?? ""),
            region: String(p.region ?? ""),
            lng,
            lat,
          });
        }
      }
    } catch {
      errors += 1;
    }
    done += 1;
    if (done % 200 === 0) process.stdout.write(`\r   ${tech} : ${done}/${tiles.length} tuiles, ${seen.size} stations`);
  });
  process.stdout.write(`\r   ${tech} : ${tiles.length}/${tiles.length} tuiles, ${seen.size} stations${errors ? ` (${errors} tuiles en erreur)` : ""}\n`);
  return [...seen.values()];
}

/* --------------------- Rattachement administratif ------------------------ */

/**
 * Index par boîte englobante : tester 500 polygones pour chaque station serait
 * inutilement coûteux, on ne teste que ceux dont la boîte contient le point.
 */
function buildIndex(features) {
  return features.map((f) => ({ f, box: bbox(f) }));
}

function locate(index, lng, lat) {
  for (const { f, box } of index) {
    if (lng < box[0] || lng > box[2] || lat < box[1] || lat > box[3]) continue;
    if (booleanPointInPolygon([lng, lat], f)) return f.properties;
  }
  return null;
}

/* -------------------------------- Sortie --------------------------------- */

async function main() {
  console.log(`Extraction des stations (jointure sur le découpage du ${JOIN_DATE})`);

  const perTech = [];
  for (const ts of TILESETS) perTech.push(await extractTech(ts));
  const stations = perTech.flat();
  console.log(`   total brut : ${stations.length} stations`);

  const subPrefs = JSON.parse(
    readFileSync(path.join(OUT_DIR, `subPrefecture_${JOIN_DATE}.geojson`), "utf8"),
  ).features;
  const index = buildIndex(subPrefs);
  console.log(`   rattachement à ${subPrefs.length} sous-préfectures…`);

  /*
   * Regroupement en SITES. Les tuiles listent une ligne par cellule : un même
   * pylône y figure 3, 6 ou 9 fois (secteurs). Les empiler à l'identique sur
   * la carte n'apprendrait rien et alourdirait le rendu ; on garde un point
   * par (position, technologie), en conservant le nombre de cellules.
   */
  const sites = new Map();
  for (const s of stations) {
    const lng = Number(s.lng.toFixed(5));
    const lat = Number(s.lat.toFixed(5));
    const key = `${lng},${lat},${s.tech}`;
    const cur = sites.get(key);
    if (cur) {
      cur.cells += 1;
      if (cur.codes.length < 12) cur.codes.push(s.code);
    } else {
      sites.set(key, { lng, lat, tech: s.tech, name: s.name, codes: [s.code], cells: 1, raw: s });
    }
  }
  console.log(`   sites distincts : ${sites.size}`);

  let matched = 0;
  let i = 0;
  const features = [...sites.values()].map((s) => {
    const props = locate(index, s.lng, s.lat);
    if (props) matched += 1;
    i += 1;
    return {
      type: "Feature",
      id: i,
      geometry: { type: "Point", coordinates: [s.lng, s.lat] },
      properties: {
        code: s.codes[0],
        codes: s.codes.join(" "),
        cells: s.cells,
        name: s.name,
        tech: s.tech,
        // Chaîne administrative héritée de la sous-préfecture contenante ;
        // à défaut, les libellés portés par la tuile.
        ADM0_FR: props?.ADM0_FR ?? s.raw.district,
        ADM1_FR: props?.ADM1_FR ?? s.raw.region,
        ADM2_FR: props?.ADM2_FR ?? "",
        ADM3_FR: props?.ADM3_FR ?? "",
        ADM3_PCODE: props?.ADM3_PCODE ?? "",
      },
    };
  });

  const fc = { type: "FeatureCollection", features };
  const out = path.join(OUT_DIR, "stations.geojson");
  writeFileSync(out, JSON.stringify(fc));
  const byTech = features.reduce((a, f) => ({ ...a, [f.properties.tech]: (a[f.properties.tech] ?? 0) + 1 }), {});
  const cells = features.reduce((a, f) => a + f.properties.cells, 0);
  console.log(`   localisés : ${matched}/${features.length}`);
  console.log(`   sites par technologie : ${JSON.stringify(byTech)} (${cells} cellules)`);
  console.log(`Écrit : ${out} (${(JSON.stringify(fc).length / 1048576).toFixed(1)} Mo)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
