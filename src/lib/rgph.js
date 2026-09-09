/**
 * Référentiel de population (recensement) utilisé par période de couverture.
 *
 * RÈGLE MÉTIER CENTRALISÉE - ne pas la réécrire dans les composants :
 *   RGPH 2014 → périodes strictement antérieures au 30/06/2026
 *   RGPH 2021 → périodes à partir du 30/06/2026
 *
 * La comparaison porte toujours sur la DATE RÉELLE de la période (AAAA-MM-JJ),
 * jamais sur son libellé, pour éviter les erreurs d'ordre.
 *
 * À partir du semestre 2026-06-30, la population de référence et la liste des
 * localités changent, ce qui crée une RUPTURE DE SÉRIE : les taux d'avant et
 * d'après ne sont pas directement comparables.
 */

/** Première période établie sur le RGPH 2021. */
export const RGPH_2021_FROM = "2026-06-30";

/** Référentiels proposés à la sélection, du plus ancien au plus récent. */
export const RGPH_REFERENTIALS = [
  { code: "RG-2014", label: "RGPH 2014", from: null, until: RGPH_2021_FROM },
  { code: "RG-2021", label: "RGPH 2021", from: RGPH_2021_FROM, until: null },
];

/** Date d'une période, qu'on reçoive `{ date, label }` ou la chaîne brute. */
const dateOf = (p) => String((p && typeof p === "object" ? p.date : p) || "");

/** Référentiel applicable à une période (AAAA-MM-JJ). */
export function rgphFor(period) {
  const d = dateOf(period);
  return d >= RGPH_2021_FROM ? RGPH_REFERENTIALS[1] : RGPH_REFERENTIALS[0];
}

/** Code du référentiel applicable à une période. */
export const rgphCodeFor = (period) => rgphFor(period).code;

/** Référentiel connu à partir de son code (repli sur le RGPH 2014). */
export const rgphByCode = (code) =>
  RGPH_REFERENTIALS.find((r) => r.code === code) ?? RGPH_REFERENTIALS[0];

/** Vrai si la période appartient au référentiel demandé. */
export const periodMatchesRgph = (period, code) => rgphCodeFor(period) === rgphByCode(code).code;

/**
 * Périodes compatibles avec un référentiel, dans l'ordre reçu.
 * C'est l'unique filtre à utiliser pour alimenter un sélecteur de période.
 */
export function periodsForRgph(periods = [], code) {
  return periods.filter((p) => periodMatchesRgph(p, code));
}

/**
 * Période à retenir après un changement de référentiel :
 * la période courante si elle reste valide, sinon la plus récente du
 * référentiel, sinon `null` (aucune donnée publiée pour ce recensement).
 */
export function pickPeriodForRgph(periods = [], code, current) {
  if (current && periodMatchesRgph(current, code) && periods.some((p) => dateOf(p) === current)) {
    return current;
  }
  const eligible = periodsForRgph(periods, code).map(dateOf).filter(Boolean);
  if (!eligible.length) return null;
  return eligible.reduce((a, b) => (b > a ? b : a));
}

/** Vrai si les deux périodes ne reposent pas sur le même recensement. */
export const isBreak = (a, b) => rgphCodeFor(a) !== rgphCodeFor(b);

/**
 * Première période (dans une liste triée du plus ancien au plus récent) qui
 * inaugure un nouveau référentiel - sert à marquer la rupture sur les courbes.
 */
export function breakPoint(dates = []) {
  for (let i = 1; i < dates.length; i++) {
    if (isBreak(dates[i - 1], dates[i])) return dates[i];
  }
  return null;
}

export const RGPH_NOTE =
  "Rupture de série : à partir du 30 juin 2026, les indicateurs reposent sur le RGPH 2021 " +
  "(population de référence et liste des localités révisées). Les valeurs ne sont pas " +
  "directement comparables à celles des périodes antérieures, établies sur le RGPH 2014.";
