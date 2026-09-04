/**
 * Contenu de l'infobulle affichée au survol d'un point de localité :
 * identité de la localité, couverture par opérateur et technologie, puis
 * résultats d'audit de qualité de service lorsque la localité fait partie
 * de l'échantillon de la campagne.
 *
 * Module pur (aucune dépendance React ni Mapbox) afin d'être testable seul.
 */
import { OPERATORS, TECHNOLOGIES } from "@/config/artci";
import { QOS_INDICATORS, meetsThreshold } from "@/lib/export-data";

const OPS = OPERATORS.map((o) => o.code);
const TECHS = TECHNOLOGIES.map((t) => t.code);
const OP_COLOR = Object.fromEntries(OPERATORS.map((o) => [o.code, o.color]));

/** Services d'audit, dans l'ordre d'affichage. */
export const QOS_SERVICE_LABELS = [
  { key: "VOIX", label: "Voix" },
  { key: "SMS", label: "SMS" },
  { key: "DATA", label: "Internet" },
];

const nf = new Intl.NumberFormat("fr-FR");
const esc = (v) =>
  String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const flag = (v) => Number(v) === 1;
const dot = (kind) => `<span class="lh__dot lh__dot--${kind}"></span>`;

/** Vrai si la couche survolée représente une zone blanche. */
export const isWhiteLayer = (layerId) => layerId === "sym-white" || layerId === "white-halo";

/* ------------------------ Rattachement localité ↔ audit ------------------ */

/** Normalisation pour comparer des noms : sans accents, sans ponctuation. */
const norm = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");

/**
 * Clés de rattachement d'une localité à ses mesures d'audit.
 *
 * Les fichiers de couverture antérieurs à 2026 partagent les codes officiels
 * des fichiers QoS (« C0029 ») : le rattachement est exact. Le référentiel
 * RGPH 2021 introduit une autre codification (« CIV0036 ») ; on retombe alors
 * sur le couple nom + sous-préfecture, qui lève les homonymes.
 */
export function qosKeys(p = {}) {
  const keys = [];
  if (p.ADM4_PCODE) keys.push(`code:${p.ADM4_PCODE}`);
  if (p.ADM4_FR) keys.push(`nom:${norm(p.ADM4_FR)}|${norm(p.ADM3_FR)}`);
  return keys;
}

/* ----------------------------- Couverture ------------------------------- */

/** Logo de l'opérateur, comme dans l'en-tête de ligne de la version 2. */
const OP_LOGO = Object.fromEntries(OPS.map((op) => [op, `/images/operateurs/${op.toLowerCase()}.png`]));

/** Coche verte / croix rouge - pictogrammes de la version 2. */
const mark = (ok) =>
  `<img class="lh__mark" src="/images/icons/${ok ? "success" : "cancel"}.png" alt="${ok ? "oui" : "non"}" />`;

/**
 * Tableau opérateurs × technologies repris de la version 2 : « Couvertures »
 * d'un côté, « Stations radios » de l'autre, une ligne par opérateur avec
 * son logo, et une coche ou une croix dans chaque case.
 */
function coverageTable(p) {
  const head =
    `<tr><th></th><th colspan="${TECHS.length}">Couvertures</th><th colspan="${TECHS.length}">Stations radios</th></tr>` +
    `<tr><th></th>${TECHS.map((t) => `<th>${t}</th>`).join("")}${TECHS.map((t) => `<th>${t}</th>`).join("")}</tr>`;

  const body = OPS.map((op) => {
    const cov = TECHS.map((t) => `<td>${mark(flag(p[`cov${op}${t}`]))}</td>`).join("");
    const sta = TECHS.map((t) => `<td>${mark(flag(p[`present${op}${t}`]))}</td>`).join("");
    return (
      `<tr><th><img class="lh__logo" src="${OP_LOGO[op]}" alt="${op}" title="${op}" /></th>${cov}${sta}</tr>`
    );
  }).join("");

  return `<table class="lh__grid"><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

/** Couples opérateur/technologie annoncés mais pas encore couverts. */
function forecastNote(p) {
  const pending = [];
  for (const op of OPS)
    for (const t of TECHS)
      if (!flag(p[`cov${op}${t}`]) && flag(p[`forecast${op}${t}`])) pending.push(`${t} ${op}`);
  return pending.length
    ? `<div class="lh__forecast">${dot("soon")}Couverture annoncée : ${pending.join(", ")}</div>`
    : "";
}

/** La localité porte-t-elle le détail de couverture par opérateur ? */
const hasCoverage = (p) => OPS.some((op) => TECHS.some((t) => `cov${op}${t}` in p));

/* -------------------------- Qualité de service --------------------------- */

/**
 * Conformité d'un opérateur sur un service : nombre d'indicateurs qui
 * respectent leur seuil réglementaire, sur le nombre d'indicateurs mesurables.
 * Retourne `null` si aucune mesure n'est disponible.
 */
export function qosCompliance(props, service, op) {
  const indicators = QOS_INDICATORS[service] || [];
  let ok = 0;
  let total = 0;
  for (const ind of indicators) {
    const raw = props?.[`${ind.key}_${op}`];
    const v = Number.isFinite(Number(raw)) ? Number(raw) : null;
    const meets = meetsThreshold(v, ind);
    if (meets === null) continue; // pas de seuil, ou pas de mesure
    total += 1;
    if (meets) ok += 1;
  }
  return total ? { ok, total } : null;
}

/** Tableau de synthèse des audits : une ligne par service, une colonne par opérateur. */
function qosTable(qos) {
  const services = QOS_SERVICE_LABELS.filter((s) => qos[s.key]);
  if (!services.length) return "";

  const head = `<tr><th></th>${OPS.map(
    (op) => `<th><span class="lh__op" style="background:${OP_COLOR[op]}"></span>${op}</th>`,
  ).join("")}</tr>`;

  const body = services
    .map((s) => {
      const cells = OPS.map((op) => {
        const c = qosCompliance(qos[s.key], s.key, op);
        if (!c) return `<td class="lh__qos-na">-</td>`;
        // Vert si tous les seuils sont tenus, orange en deçà, rouge si aucun.
        const tone = c.ok === c.total ? "ok" : c.ok === 0 ? "ko" : "mid";
        return `<td><span class="lh__qos lh__qos--${tone}">${c.ok}/${c.total}</span></td>`;
      }).join("");
      return `<tr><th>${s.label}</th>${cells}</tr>`;
    })
    .join("");

  return (
    `<div class="lh__sub">Qualité de service - seuils tenus</div>` +
    `<table class="lh__grid lh__grid--qos"><thead>${head}</thead><tbody>${body}</tbody></table>`
  );
}

/* -------------------------------- Rendu ---------------------------------- */

/**
 * Assemble l'infobulle.
 * @param p        propriétés de l'entité survolée
 * @param layerId  couche d'origine (détermine le cas « zone blanche »)
 * @param qos      mesures d'audit de la localité : { VOIX, SMS, DATA } ou null
 * @param campaign intitulé de la campagne d'audit, pour l'en-tête QoS
 */
export function localityPopupHtml(p = {}, { layerId, qos = null, campaign = null } = {}) {
  const path = [p.ADM3_FR, p.ADM2_FR, p.ADM1_FR].filter(Boolean).join(" · ");
  const white = isWhiteLayer(layerId);
  const audited = qos && QOS_SERVICE_LABELS.some((s) => qos[s.key]);

  return (
    `<div class="lh__name">${esc(p.ADM4_FR) || "Localité"}</div>` +
    (path ? `<div class="lh__path">${esc(path)}</div>` : "") +
    `<div class="lh__pop"><b>${nf.format(Number(p.pop) || 0)}</b> habitants</div>` +
    (white ? `<div class="lh__white">Zone blanche - ni couverture ni prévision</div>` : "") +
    (!white && hasCoverage(p) ? coverageTable(p) + forecastNote(p) : "") +
    (audited
      ? qosTable(qos) +
        (campaign ? `<div class="lh__note">Campagne ${esc(campaign)} · cliquer pour le détail</div>` : "")
      : `<div class="lh__note">Localité hors échantillon d'audit QoS</div>`)
  );
}
