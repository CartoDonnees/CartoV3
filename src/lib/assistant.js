import { searchEntities, entitiesAtLevel, nationalEntity, rateFromStats } from "@/lib/entity-search";
import { extractAssistantQuery } from "@/lib/voice-intent";

const LEVEL_LABEL = {
  district: "district",
  region: "région",
  department: "département",
  subPrefecture: "sous-préfecture",
  locality: "localité",
};
// Pluriel + accord de l'adjectif (« les mieux couvertes » au féminin).
const LEVEL_PLURAL = {
  district: "districts",
  region: "régions",
  department: "départements",
  subPrefecture: "sous-préfectures",
  locality: "localités",
};
const LEVEL_FEMININE = { region: true, subPrefecture: true, locality: true };
const LEVEL_ZOOM = { national: 5.6, district: 6.8, region: 7.6, department: 9, subPrefecture: 10.5, locality: 12 };

const fmt = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0));
const pct = (n) => `${(Number(n) || 0).toFixed(1)} %`;
const compact = (n) => new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 }).format(Number(n) || 0);

/** Contexte « opérateurs · technologies » affiché dans les réponses. */
function ctxLabel(ops, techs) {
  const parts = [];
  if (ops?.length) parts.push(ops.join(", "));
  if (techs?.length) parts.push(techs.join("/"));
  return parts.length ? ` (${parts.join(" · ")})` : "";
}

/** Réponse détaillée pour une entité. */
function entityAnswer(e, ops, techs) {
  const s = e.stats;
  const lines = [
    `**${e.name}** - ${e.levelLabel}`,
    `Couverture population : **${pct(s.perPopCov)}** sur ${fmt(s.pop)} habitants.`,
  ];
  if (s.locs > 1) lines.push(`Localités couvertes : **${fmt(s.locCov)} / ${fmt(s.locs)}** (${pct(s.perLocCov)}).`);
  if (s.stations) lines.push(`Stations radioélectriques : **${fmt(s.stations)}**.`);

  // Détail demandé (opérateur et/ou technologie).
  if (ops?.length || techs?.length) {
    const opList = ops?.length ? ops : s.operators.map((o) => o.op);
    const techList = techs?.length ? techs : ["2G", "3G", "4G"];
    const detail = [];
    for (const op of opList) {
      const row = s.operators.find((o) => o.op === op);
      for (const t of techList) {
        const cell = row?.byTech.find((c) => c.tech === t);
        if (!cell) continue;
        detail.push(s.isLocality
          ? `${op} ${t} : **${s.matrix.find((m) => m.op === op)?.byTech.find((c) => c.tech === t)?.covered ? "couvert" : "non couvert"}**`
          : `${op} ${t} : **${pct(cell.perPop)}**`);
      }
    }
    if (detail.length) lines.push(detail.join(" · "));
  }
  return lines.join("\n");
}

/** Classement des entités les mieux / moins couvertes d'un niveau. */
async function rankingAnswer({ date, level, ops, techs, count, worst }) {
  const items = await entitiesAtLevel(date, level);
  if (!items.length) return { text: `Données indisponibles pour les ${LEVEL_PLURAL[level] || level}.`, action: null };

  const scored = items
    .map((it) => ({ it, rate: rateFromStats(it.stats, ops, techs) }))
    .sort((a, b) => (worst ? a.rate - b.rate : b.rate - a.rate))
    .slice(0, count);

  const e = LEVEL_FEMININE[level] ? "es" : "s"; // accord : « couvertes » / « couverts »
  const head = worst
    ? `Les ${scored.length} ${LEVEL_PLURAL[level]} les **moins couvert${e}**${ctxLabel(ops, techs)} :`
    : `Les ${scored.length} ${LEVEL_PLURAL[level]} les **mieux couvert${e}**${ctxLabel(ops, techs)} :`;
  const list = scored.map((x, i) => `${i + 1}. **${x.it.name}** - ${pct(x.rate)}`).join("\n");
  const first = scored[0].it;

  return {
    text: `${head}\n${list}`,
    action: { center: [first.lng, first.lat], zoom: LEVEL_ZOOM[level] ?? 7 },
    entities: scored.map((x) => ({ name: x.it.name, level: x.it.level, levelLabel: x.it.levelLabel, lng: x.it.lng, lat: x.it.lat, stats: x.it.stats })),
  };
}

/** Chiffres nationaux. */
function nationalAnswer(nat, ops, techs) {
  const s = nat.stats;
  const lines = [
    `**Côte d'Ivoire**${ctxLabel(ops, techs)}`,
    `Population couverte : **${pct(s.perPopCov)}** (${compact(s.pop)} habitants).`,
    `Localités couvertes : **${fmt(s.locCov)} / ${fmt(s.locs)}** (${pct(s.perLocCov)}) - ${fmt(s.locNoCov)} non couvertes.`,
    `Stations radioélectriques : **${fmt(s.stations)}**.`,
  ];
  if (ops?.length || techs?.length) {
    const opList = ops?.length ? ops : s.operators.map((o) => o.op);
    const techList = techs?.length ? techs : ["2G", "3G", "4G"];
    const detail = [];
    for (const op of opList) {
      const row = s.operators.find((o) => o.op === op);
      for (const t of techList) {
        const cell = row?.byTech.find((c) => c.tech === t);
        if (cell) detail.push(`${op} ${t} : **${pct(cell.perPop)}**`);
      }
    }
    if (detail.length) lines.push(detail.join(" · "));
  }
  return lines.join("\n");
}

const HELP_TEXT = [
  "Je réponds sur la couverture réseau en Côte d'Ivoire. Par exemple :",
  "• « Couverture de Korhogo »",
  "• « Couverture 4G de MTN »",
  "• « Les 5 régions les moins couvertes »",
  "• « Chiffres nationaux »",
].join("\n");

/**
 * Répond à une question en langage naturel sur la couverture.
 * L'intention est extraite par le modèle IA (repli local sans clé), puis la
 * réponse est calculée sur les données réelles de la période.
 * @returns {{ text, action, query, entities? }}
 */
export async function answerQuery({ query, date, operators, technologies }) {
  const q = await extractAssistantQuery(query);

  // Les filtres actifs de la carte servent de contexte par défaut.
  const ops = q.operators?.length ? q.operators : operators?.length ? operators : [];
  const techs = q.technologies?.length ? q.technologies : technologies?.length ? technologies : [];

  if (q.intent === "help") return { text: HELP_TEXT, action: null, query: q };

  if (q.intent === "best" || q.intent === "worst") {
    const res = await rankingAnswer({ date, level: q.level, ops, techs, count: q.count, worst: q.intent === "worst" });
    return { ...res, query: q };
  }

  if (q.intent === "entity" && q.entity) {
    let results = await searchEntities(q.entity, date, { limit: 1, level: q.level });
    if (!results.length) results = await searchEntities(q.entity, date, { limit: 1 });
    if (results.length) {
      const e = results[0];
      return {
        text: entityAnswer(e, ops, techs),
        action: { center: [e.lng, e.lat], zoom: LEVEL_ZOOM[e.level] ?? 8 },
        entities: [e],
        query: q,
      };
    }
    // Lieu introuvable (nom inconnu ou question hors sujet) → on guide l'utilisateur.
    return {
      text: `Je n'ai pas trouvé de lieu correspondant à « ${q.entity} ».\n\n${HELP_TEXT}`,
      action: null,
      query: q,
    };
  }

  const nat = await nationalEntity(date);
  if (!nat) return { text: "Données indisponibles pour cette période.", action: null, query: q };
  return { text: nationalAnswer(nat, ops, techs), action: null, entities: [nat], query: q };
}
