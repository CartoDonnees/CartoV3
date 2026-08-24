/**
 * Tri des tableaux de l'application — logique pure, sans React.
 * Utilisé par `useTableSort` (kit d'interface) et testable isolément.
 */

/** Cellule considérée comme vide : toujours reléguée en fin de liste. */
export const isEmptyCell = (v) => v == null || v === "" || v === "—";

/** Comparaison naturelle : nombres, booléens, puis texte (ordre français). */
export function compareValues(a, b) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" || typeof b === "boolean") return (a ? 1 : 0) - (b ? 1 : 0);
  // `numeric` classe « Localité 2 » avant « Localité 10 ».
  return String(a).localeCompare(String(b), "fr", { numeric: true, sensitivity: "base" });
}

/**
 * Trie une copie de `rows` selon `sort` = { key, dir }.
 * `accessor(row, key)` permet de trier sur une valeur dérivée.
 * Les cellules vides restent en fin de liste dans les deux sens.
 */
export function sortRows(rows, sort, accessor) {
  if (!sort || !Array.isArray(rows)) return rows;
  const valueOf = (row) => (accessor ? accessor(row, sort.key) : row?.[sort.key]);
  return [...rows].sort((ra, rb) => {
    const a = valueOf(ra);
    const b = valueOf(rb);
    if (isEmptyCell(a) || isEmptyCell(b)) {
      return isEmptyCell(a) && isEmptyCell(b) ? 0 : isEmptyCell(a) ? 1 : -1;
    }
    const c = compareValues(a, b);
    return sort.dir === "asc" ? c : -c;
  });
}

/** Cycle d'un en-tête : croissant → décroissant → ordre d'origine. */
export function nextSort(current, key) {
  if (current?.key !== key) return { key, dir: "asc" };
  return current.dir === "asc" ? { key, dir: "desc" } : null;
}
