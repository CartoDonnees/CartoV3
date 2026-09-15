/**
 * Localités non couvertes, ventilées par opérateur.
 *
 * Le fichier `whiteLocality_<date>.geojson` ne contient que les zones blanches
 * ABSOLUES - les localités que personne ne dessert. Filtrer les zones blanches
 * par opérateur demande de savoir, localité par localité, qui la couvre : cette
 * information n'existe que dans `locality_<date>.geojson`, qui pèse 79 Mo.
 *
 * On en extrait donc les localités présentant au moins une lacune d'opérateur,
 * avec un masque de couverture sur trois bits. Une localité est alors « zone
 * blanche » pour une sélection d'opérateurs si elle n'est desservie par AUCUN
 * d'entre eux - définition contrôlée exactement égale aux agrégats
 * `whiteLoc{COMBINAISON}` publiés, sur toutes les combinaisons et les deux
 * référentiels.
 *
 *   node scripts/build-white-index.mjs
 *
 * Produit : dataFiles/data_server/data_cov/whiteLocalityOps_<date>.geojson
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";

const OUT_DIR = path.join(process.cwd(), "dataFiles", "data_server", "data_cov");

/** Bit de chaque opérateur dans le masque de couverture. */
const OPERATOR_BITS = { MOOV: 1, MTN: 2, ORANGE: 4 };

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

const dates = readdirSync(OUT_DIR)
  .map((f) => /^locality_(\d{4}-\d{2}-\d{2})\.geojson$/.exec(f)?.[1])
  .filter(Boolean)
  .sort();

console.log(`Périodes trouvées : ${dates.length}`);

for (const date of dates) {
  const fc = JSON.parse(readFileSync(path.join(OUT_DIR, `locality_${date}.geojson`), "utf8"));

  const features = [];
  for (const f of fc.features) {
    const p = f.properties;
    let mask = 0;
    for (const [op, bit] of Object.entries(OPERATOR_BITS)) {
      if (num(p[`cov${op}`]) === 1) mask |= bit;
    }
    // Localité desservie par les trois opérateurs : aucune lacune à signaler.
    if (mask === 7) continue;

    const lng = num(p.centerLng);
    const lat = num(p.centerLat);
    features.push({
      type: "Feature",
      id: features.length + 1,
      geometry: { type: "Point", coordinates: [lng, lat] },
      properties: {
        // Mêmes champs que `whiteLocality_*` : la carte et le tableau existants
        // s'en servent tels quels.
        ADM0_FR: p.ADM0_FR ?? "",
        ADM1_FR: p.ADM1_FR ?? "",
        ADM2_FR: p.ADM2_FR ?? "",
        ADM3_FR: p.ADM3_FR ?? "",
        ADM3_PCODE: p.ADM3_PCODE ?? "",
        ADM4_FR: p.ADM4_FR ?? "",
        ADM4_PCODE: p.ADM4_PCODE ?? "",
        centerLat: lat,
        centerLng: lng,
        pop: num(p.pop),
        score: num(p.pop),
        // Masque de couverture : bit à 1 = opérateur présent.
        covMask: mask,
      },
    });
  }

  const out = { type: "FeatureCollection", features };
  const file = path.join(OUT_DIR, `whiteLocalityOps_${date}.geojson`);
  const json = JSON.stringify(out);
  writeFileSync(file, json);

  const absolute = features.filter((x) => x.properties.covMask === 0).length;
  console.log(
    `  ${date} : ${features.length} localités avec lacune, dont ${absolute} zones blanches absolues, ` +
      `${(json.length / 1024).toFixed(0)} Ko`,
  );
}
