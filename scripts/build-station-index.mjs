/**
 * Index compact des localités équipées en stations.
 *
 * Le fichier `locality_<date>.geojson` pèse 79 Mo : il porte plus de deux
 * cents champs par localité, dont la quasi-totalité ne concerne pas les
 * stations. Le charger dans un tableau de bord serait déraisonnable.
 *
 * On en extrait donc, pour chaque période, les seules localités portant au
 * moins une station, avec leur décompte par opérateur ET par technologie.
 * Cela suffit à répondre exactement - sans approximation - aux questions
 * « combien de localités sont équipées ? » et « combien de stations par
 * localité ? » pour N'IMPORTE QUELLE combinaison de filtres : le décompte est
 * conservé cellule par cellule, jamais pré-agrégé.
 *
 *   node scripts/build-station-index.mjs
 *
 * Produit : dataFiles/data_server/data_cov/stations_localites_<date>.json
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";

const OUT_DIR = path.join(process.cwd(), "dataFiles", "data_server", "data_cov");

const OPERATORS = ["ORANGE", "MTN", "MOOV"];
const TECHS = ["2G", "3G", "4G"];
/** Ordre des décomptes dans le tableau `c` : opérateur × technologie. */
const FIELDS = OPERATORS.flatMap((o) => TECHS.map((t) => `${o}${t}`));

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

const dates = readdirSync(OUT_DIR)
  .map((f) => /^locality_(\d{4}-\d{2}-\d{2})\.geojson$/.exec(f)?.[1])
  .filter(Boolean)
  .sort();

console.log(`Périodes trouvées : ${dates.length}`);

for (const date of dates) {
  const src = path.join(OUT_DIR, `locality_${date}.geojson`);
  const fc = JSON.parse(readFileSync(src, "utf8"));

  const localities = [];
  let stations = 0;
  for (const f of fc.features) {
    const p = f.properties;
    const counts = FIELDS.map((k) => num(p[`present${k}`]));
    const total = counts.reduce((a, b) => a + b, 0);
    if (!total) continue; // localité sans station : hors index
    stations += total;
    localities.push({
      n: p.ADM4_FR ?? "",
      k: p.ADM4_PCODE ?? "",
      a0: p.ADM0_PCODE ?? "",
      a1: p.ADM1_PCODE ?? "",
      a2: p.ADM2_PCODE ?? "",
      a3: p.ADM3_PCODE ?? "",
      s3: p.ADM3_FR ?? "",
      c: counts,
    });
  }

  const out = { date, fields: FIELDS, total: fc.features.length, localities };
  const file = path.join(OUT_DIR, `stations_localites_${date}.json`);
  const json = JSON.stringify(out);
  writeFileSync(file, json);
  console.log(
    `  ${date} : ${localities.length}/${fc.features.length} localités équipées, ` +
      `${stations} stations, ${(json.length / 1024).toFixed(0)} Ko`,
  );
}
