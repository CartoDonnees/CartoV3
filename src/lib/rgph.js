/**
 * Référentiel de population (recensement) utilisé par période de couverture.
 *
 * Les données publiées jusqu'au 30 juin 2025 reposent sur le RGPH 2014
 * (cf. `dataFiles/.../historique_rgph2014.json`). À partir du semestre
 * 2026-06-30, elles reposent sur le RGPH 2021 : la population de référence et
 * la liste des localités changent, ce qui crée une RUPTURE DE SÉRIE.
 * Les taux d'avant et d'après ne sont donc pas directement comparables.
 */
const REFERENTIALS = [
  { from: "2026-01-01", label: "RGPH 2021", code: "RG-2021" },
  { from: "0000-00-00", label: "RGPH 2014", code: "RG-2014" },
];

/** Référentiel applicable à une période (AAAA-MM-JJ). */
export function rgphFor(date) {
  const d = String(date || "");
  return REFERENTIALS.find((r) => d >= r.from) ?? REFERENTIALS[REFERENTIALS.length - 1];
}

/** Vrai si les deux périodes ne reposent pas sur le même recensement. */
export const isBreak = (a, b) => rgphFor(a).label !== rgphFor(b).label;

/**
 * Première période (dans une liste triée du plus ancien au plus récent) qui
 * inaugure un nouveau référentiel — sert à marquer la rupture sur les courbes.
 */
export function breakPoint(dates = []) {
  for (let i = 1; i < dates.length; i++) {
    if (isBreak(dates[i - 1], dates[i])) return dates[i];
  }
  return null;
}

export const RGPH_NOTE =
  "Rupture de série : à partir de 2026, les indicateurs reposent sur le RGPH 2021 " +
  "(population de référence et liste des localités révisées). Les valeurs ne sont pas " +
  "directement comparables à celles des périodes antérieures, établies sur le RGPH 2014.";
