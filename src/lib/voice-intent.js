import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { norm } from "@/lib/entity-search";

const LEVELS = ["district", "region", "department", "subPrefecture", "locality"];
const OPS = ["ORANGE", "MTN", "MOOV"];
const TECHS = ["2G", "3G", "4G"];

/** Schéma de la requête de couverture extraite d'une note vocale. */
const CoverageQuerySchema = z.object({
  entity: z.string().describe("Nom de l'entité géographique recherchée, sans le type (ex: « Korhogo »). Vide si absent."),
  level: z.enum(["district", "region", "department", "subPrefecture", "locality"])
    .describe("Niveau administratif cité ; « locality » par défaut si aucun type n'est mentionné."),
  operators: z.array(z.enum(["ORANGE", "MTN", "MOOV"])).describe("Opérateurs cités, sinon liste vide."),
  technologies: z.array(z.enum(["2G", "3G", "4G"])).describe("Technologies citées, sinon liste vide."),
  normalized: z.string().describe("La demande reformulée en une requête de couverture claire, en français."),
});

const SYSTEM = `Tu convertis une note vocale (souvent mal transcrite, en français de Côte d'Ivoire) en requête de couverture réseau pour l'observatoire ARTCI.

Règles :
- « entity » = uniquement le nom propre du lieu, sans le type ni les mots de liaison. Exemple : « la couverture réseau à Korhogo » → « Korhogo ».
- Corrige les erreurs de transcription phonétique sur les noms de lieux ivoiriens (ex. « boiraké »/« bwake » → « Bouaké », « yamousoukro » → « Yamoussoukro », « corogo » → « Korhogo », « aboidjan » → « Abidjan »).
- « level » : le type seulement s'il est dit explicitement (district, région, département, sous-préfecture). **Si aucun type n'est cité, réponds « locality »** - par défaut une demande porte sur une localité.
- « operators » / « technologies » seulement si cités. La dictée déforme souvent ces mots : « 2 jeux »/« de jeux »/« de chez » → 2G ; « 3 jeux »/« trajet » → 3G ; « 4 jeux »/« quartier »/« quatre G » → 4G ; « mauve »/« mouve »/« moore »/« gémo » → MOOV ; « GMT »/« aime té enne » → MTN ; « aurange » → ORANGE.
- « normalized » = phrase courte décrivant la requête, ex. « Couverture 4G de Orange à Korhogo ».
- Si aucun lieu n'est identifiable, « entity » vide.`;

/**
 * Corrections phonétiques de la reconnaissance vocale française (reprises de la V2,
 * enrichies). La dictée confond très souvent « 2G » avec « 2 jeux », « MOOV » avec
 * « mauve », etc. - ces variantes sont détectées avant toute analyse.
 */
export const COMMAND_MAPPINGS = {
  "2G": ["2g", "2 g", "2d", "2 d", "2j", "2 j", "dg", "d g", "tg", "t g", "de gmt", "dgt",
    "2 jeux", "de jeu", "de jeux", "des jeux", "de chez", "des chez", "2e theme", "2e tete",
    "2e tnt", "peugeot", "de gemo", "gemeaux", "de gemeaux", "des gemeaux", "deux g", "deuxieme generation"],
  "3G": ["3g", "3 g", "3j", "3 j", "3 chez", "3 jeux", "3e theme", "3e tnt", "trajet",
    "trois g", "troisieme generation"],
  "4G": ["4g", "4 g", "4j", "4 chez", "4 jeux", "4e theme", "4e tete", "4e tnt", "quartier",
    "quatre g", "quatrieme generation"],
  ORANGE: ["orange", "oranges", "aurange", "auranges"],
  MTN: ["mtn", "mt", "gmt", "em te enne", "aime te enne", "2e theme", "3e theme", "4e theme",
    "2e tnt", "3e tnt", "4e tnt", "2e tete", "3e tete", "4e tete", "dgt"],
  MOOV: ["moov", "mouve", "move", "moves", "mauve", "mauv", "mauves", "m'ouvre", "m'ouvres",
    "moore", "gemo", "gemeaux", "mouv"],
};

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/**
 * Expression d'une variante phonétique, bornée par des limites de mots :
 * « 2 d » ne doit PAS se déclencher sur « 2 districts ».
 */
const variantRe = (variant) => new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(norm(variant))}($|[^\\p{L}\\p{N}])`, "u");

/** Détecte les entrées d'une catégorie via ses variantes phonétiques. */
function detectMapped(nText, keys) {
  return keys.filter((k) => (COMMAND_MAPPINGS[k] || []).some((variant) => variantRe(variant).test(nText)));
}

/** Retire les mots vides d'une note vocale pour isoler un nom de lieu (repli local). */
const STOP_WORDS = [
  "quelle", "quel", "est", "la", "le", "les", "de", "du", "des", "a", "au", "aux", "sur", "dans", "pour",
  "couverture", "reseau", "reseaux", "montre", "moi", "affiche", "cherche", "recherche", "donne",
  "statistique", "statistiques", "stat", "stats", "je", "veux", "voir", "svp", "s'il", "te", "plait",
  "district", "region", "departement", "sous", "prefecture", "localite", "village", "ville", "commune",
  "et", "en", "l", "d", "the", "of",
];

/** Extraction heuristique locale (sans modèle) - repli si l'API n'est pas configurée. */
export function localIntent(transcript) {
  const raw = String(transcript || "");
  const n = norm(raw);

  // Détection tolérante aux erreurs de dictée (dictionnaire phonétique V2).
  const operators = detectMapped(n, OPS);
  const technologies = detectMapped(n, TECHS);

  // Niveau : « localité » par défaut si aucun type n'est explicitement cité (comme en V2).
  let level = "locality";
  if (/\b(district|disque)\b/.test(n)) level = "district";
  else if (/\bregion\b/.test(n)) level = "region";
  else if (/\bdepartement\b/.test(n)) level = "department";
  else if (/sous.?prefecture/.test(n)) level = "subPrefecture";

  // Retire d'abord les variantes phonétiques reconnues (« 2 jeux », « mauve »…),
  // puis les mots vides : ce qui reste est le nom du lieu.
  // Les variantes les plus longues d'abord : « 2 jeux » doit primer sur « 2 j »,
  // sinon il resterait un fragment (« eux ») dans le nom du lieu.
  const variants = [...OPS, ...TECHS]
    .flatMap((key) => COMMAND_MAPPINGS[key] || [])
    .map(norm)
    .sort((a, b) => b.length - a.length);
  let cleaned = n;
  for (const v of variants) {
    // Même règle de limite de mot que la détection, pour ne pas amputer un nom.
    cleaned = cleaned.replace(
      new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(v)}($|[^\\p{L}\\p{N}])`, "gu"),
      "$1 $2",
    );
  }
  const entity = cleaned
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w && w.length > 1 && !STOP_WORDS.includes(w))
    .join(" ")
    .trim();

  return {
    entity,
    level,
    operators,
    technologies,
    normalized: entity ? `Couverture${technologies.length ? " " + technologies.join("/") : ""}${operators.length ? " de " + operators.join(", ") : ""} à ${entity}` : "",
    source: "local",
  };
}

/** Intentions comprises par l'assistant conversationnel. */
const ASSISTANT_INTENTS = ["entity", "best", "worst", "national", "help"];

const AssistantQuerySchema = z.object({
  intent: z.enum(["entity", "best", "worst", "national", "help"])
    .describe("entity = couverture d'un lieu précis ; best/worst = classement des mieux/moins couverts ; national = chiffres du pays ; help = demande d'aide ou hors sujet."),
  entity: z.string().describe("Nom du lieu si l'intention est « entity », sinon vide."),
  level: z.enum(["district", "region", "department", "subPrefecture", "locality"])
    .describe("Niveau concerné. Pour un classement, le découpage à classer (district par défaut)."),
  operators: z.array(z.enum(["ORANGE", "MTN", "MOOV"])),
  technologies: z.array(z.enum(["2G", "3G", "4G"])),
  count: z.number().int().min(1).max(10).describe("Nombre d'éléments pour un classement (3 par défaut)."),
});

const ASSISTANT_SYSTEM = `Tu analyses une question posée à l'assistant de l'observatoire de couverture télécoms de Côte d'Ivoire (ARTCI), et tu la traduis en requête structurée.

- « intent » : « entity » si un lieu précis est cité ; « best » pour les mieux couverts ; « worst » pour les moins couverts / zones à prioriser / zones blanches ; « national » pour des chiffres d'ensemble du pays ; « help » si la question est hors sujet ou demande de l'aide.
- « entity » : uniquement le nom propre du lieu, sans le type. Corrige les fautes sur les noms ivoiriens (« corogo » → « Korhogo », « bwake » → « Bouaké »).
- « level » : le type cité (district, région, département, sous-préfecture, localité). Pour un classement sans type précisé, réponds « district ».
- « operators » / « technologies » : seulement si cités, sinon listes vides.
- « count » : nombre demandé pour un classement, sinon 3.`;

/** Repli local : détecte l'intention par mots-clés. */
export function localAssistantIntent(text) {
  const base = localIntent(text);
  const n = norm(text);
  let intent = "entity";
  if (/(meilleur|mieux couvert|plus couvert|top|classement)/.test(n)) intent = "best";
  else if (/(pire|moins couvert|plus faible|mauvais|zone blanche|zones blanches|non couvert|sans reseau|prioris)/.test(n)) intent = "worst";
  // « nationaux », « nationale »… → radical « nationa ».
  else if (!base.entity || /(nationa|pays|cote d ivoire|ensemble du territoire|total)/.test(n)) intent = "national";

  let level = base.level;
  if (intent === "best" || intent === "worst") {
    level = /\bregion/.test(n) ? "region"
      : /\bdepartement/.test(n) ? "department"
      : /sous.?prefecture/.test(n) ? "subPrefecture"
      : /localite|village/.test(n) ? "locality"
      : "district";
  }
  const m = /\b(\d{1,2})\b/.exec(n);
  const count = m ? Math.min(10, Math.max(1, Number(m[1]))) : 3;

  return { ...base, intent, level, count, source: "local" };
}

/** Analyse une question de l'assistant (IA si configurée, sinon repli local). */
export async function extractAssistantQuery(text) {
  const q = String(text || "").trim();
  if (!q) return { intent: "help", entity: "", level: "district", operators: [], technologies: [], count: 3, source: "empty" };

  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) return localAssistantIntent(q);

  try {
    const client = new Anthropic();
    const response = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 1024,
      system: ASSISTANT_SYSTEM,
      messages: [{ role: "user", content: `Question : « ${q} »` }],
      output_config: { format: zodOutputFormat(AssistantQuerySchema) },
    });
    const out = response.parsed_output;
    if (!out) return localAssistantIntent(q);
    return {
      intent: ASSISTANT_INTENTS.includes(out.intent) ? out.intent : "entity",
      entity: (out.entity || "").trim(),
      level: LEVELS.includes(out.level) ? out.level : "district",
      operators: (out.operators || []).filter((o) => OPS.includes(o)),
      technologies: (out.technologies || []).filter((t) => TECHS.includes(t)),
      count: Math.min(10, Math.max(1, Number(out.count) || 3)),
      source: "ai",
    };
  } catch (err) {
    console.error("[assistant-intent] repli local:", err?.message || err);
    return localAssistantIntent(q);
  }
}

/**
 * Convertit une note vocale en requête de couverture structurée.
 * Utilise Claude si une clé est configurée, sinon un extracteur local.
 */
export async function extractCoverageQuery(transcript) {
  const text = String(transcript || "").trim();
  if (!text) return { entity: "", level: "locality", operators: [], technologies: [], normalized: "", source: "empty" };

  // Sans identifiants, on reste sur l'extraction locale (aucun appel réseau).
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return localIntent(text);
  }

  try {
    const client = new Anthropic();
    const response = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 1024,
      system: SYSTEM,
      messages: [{ role: "user", content: `Note vocale : « ${text} »` }],
      output_config: { format: zodOutputFormat(CoverageQuerySchema) },
    });

    const out = response.parsed_output;
    if (!out) return localIntent(text);

    return {
      entity: (out.entity || "").trim(),
      level: LEVELS.includes(out.level) ? out.level : "locality",
      operators: Array.isArray(out.operators) ? out.operators.filter((o) => OPS.includes(o)) : [],
      technologies: Array.isArray(out.technologies) ? out.technologies.filter((t) => TECHS.includes(t)) : [],
      normalized: (out.normalized || "").trim(),
      source: "ai",
    };
  } catch (err) {
    console.error("[voice-intent] repli local:", err?.message || err);
    return localIntent(text);
  }
}
