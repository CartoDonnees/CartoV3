/**
 * Journal d'activité : vocabulaire et formulation.
 *
 * Module pur - ni base de données, ni React. Il est partagé par le serveur,
 * qui rédige la description au moment où l'action a lieu, et par l'interface,
 * qui en tire libellés, pictogrammes et comparaison avant / après.
 *
 * Les phrases sont écrites pour un lecteur non technique : jamais
 * « UPDATE users SET… », toujours « Marie Yao a modifié l'opérateur MTN. »
 *
 * Choix de rédaction : les verbes sont conjugués avec « avoir » (« a ouvert une
 * session », « a créé son compte ») plutôt qu'avec « être ». Le participe ne
 * s'accorde alors pas avec l'auteur, dont le genre n'a pas à être deviné à
 * partir de son prénom.
 */

/* ------------------------------ Actions ---------------------------------- */

/**
 * Types d'action. Le vocabulaire est ouvert : la base stocke une chaîne, et une
 * action inconnue retombe sur un libellé générique au lieu de faire échouer
 * l'affichage. En ajouter une se résume à la déclarer ici.
 *
 * - `verb` / `infinitive` : forme active et forme d'échec (« a tenté de … ») ;
 * - `of` : l'action porte sur une propriété de l'élément (« le statut DU … ») ;
 * - `sentence` : phrase complète pour les actions sans élément ciblé ;
 * - `icon` / `tone` : repères visuels, traduits en composants par l'interface.
 */
export const ACTIVITY_ACTIONS = {
  CREATE: { label: "Création", verb: "a créé", infinitive: "créer", icon: "create", tone: "green" },
  UPDATE: { label: "Modification", verb: "a modifié", infinitive: "modifier", icon: "update", tone: "blue" },
  DELETE: { label: "Suppression", verb: "a supprimé", infinitive: "supprimer", icon: "delete", tone: "red" },
  STATUS_CHANGE: {
    label: "Changement de statut",
    verb: "a changé le statut",
    infinitive: "changer le statut",
    of: true,
    icon: "status",
    tone: "amber",
  },
  VALIDATE: { label: "Validation", verb: "a validé", infinitive: "valider", icon: "validate", tone: "green" },
  REJECT: { label: "Rejet", verb: "a rejeté", infinitive: "rejeter", icon: "reject", tone: "red" },
  IMPORT: { label: "Importation", verb: "a importé", infinitive: "importer", icon: "import", tone: "blue" },
  EXPORT: { label: "Exportation", verb: "a exporté", infinitive: "exporter", icon: "export", tone: "gray" },
  UPLOAD: { label: "Téléversement", verb: "a téléversé", infinitive: "téléverser", icon: "upload", tone: "gray" },
  VIEW: { label: "Consultation", verb: "a consulté", infinitive: "consulter", icon: "view", tone: "gray" },
  LOGIN: {
    label: "Connexion",
    sentence: (actor) => `${actor} a ouvert une session sur la plateforme.`,
    icon: "login",
    tone: "green",
  },
  LOGOUT: {
    label: "Déconnexion",
    sentence: (actor) => `${actor} a fermé sa session.`,
    icon: "logout",
    tone: "gray",
  },
  LOGIN_FAILED: {
    label: "Échec de connexion",
    sentence: (actor, reason) => `Échec de connexion pour ${actor}${reason ? ` : ${reason}` : ""}.`,
    icon: "denied",
    tone: "red",
  },
  REGISTER: {
    label: "Inscription",
    sentence: (actor) => `${actor} a créé son compte sur la plateforme.`,
    icon: "register",
    tone: "green",
  },
};

const UNKNOWN_ACTION = { label: "Action", verb: "a agi sur", infinitive: "agir sur", icon: "activity", tone: "gray" };

/** Descripteur d'une action, avec repli pour un code inconnu. */
export const actionInfo = (action) => ACTIVITY_ACTIONS[action] ?? { ...UNKNOWN_ACTION, label: humanize(action) };

/* ----------------------------- Ressources -------------------------------- */

/** Modules fonctionnels : regroupent les ressources pour le filtre de la page. */
export const ACTIVITY_MODULES = [
  { key: "session", label: "Connexions" },
  { key: "accounts", label: "Comptes et profils" },
  { key: "geography", label: "Données géographiques" },
  { key: "coverage", label: "Couverture et périodes" },
  { key: "reports", label: "Signalements" },
  { key: "news", label: "Actualités" },
  { key: "config", label: "Configuration" },
  { key: "data", label: "Exports et fichiers" },
];

/**
 * Types de ressource. Les clés reprennent les noms des modèles Prisma : la
 * fabrique CRUD peut ainsi journaliser sans configuration. `g` porte le genre
 * grammatical du nom commun (utile quand l'article « l' » le masque).
 */
export const ACTIVITY_RESOURCES = {
  session: { label: "session", article: "la", g: "f", module: "session" },
  user: { label: "utilisateur", article: "l'", g: "m", module: "accounts" },
  operator: { label: "opérateur", article: "l'", g: "m", module: "accounts" },
  district: { label: "district", article: "le", g: "m", module: "geography" },
  region: { label: "région", article: "la", g: "f", module: "geography" },
  department: { label: "département", article: "le", g: "m", module: "geography" },
  subPrefecture: { label: "sous-préfecture", article: "la", g: "f", module: "geography" },
  locality: { label: "localité", article: "la", g: "f", module: "geography" },
  referential: { label: "référentiel géographique", article: "le", g: "m", module: "geography" },
  period: { label: "période", article: "la", g: "f", module: "coverage" },
  coverage: { label: "déclaration de couverture", article: "la", g: "f", module: "coverage" },
  coverageImport: { label: "fichier de déclarations de couverture", article: "le", g: "m", module: "coverage" },
  report: { label: "signalement réseau", article: "le", g: "m", module: "reports" },
  appReport: { label: "signalement de la plateforme", article: "le", g: "m", module: "reports" },
  problem: { label: "type de problème", article: "le", g: "m", module: "reports" },
  newsletter: { label: "actualité", article: "l'", g: "f", module: "news" },
  newsCategory: { label: "catégorie d'actualités", article: "la", g: "f", module: "news" },
  technology: { label: "technologie", article: "la", g: "f", module: "config" },
  sync: { label: "synchronisation", article: "la", g: "f", module: "config" },
  notification: { label: "notification", article: "la", g: "f", module: "config" },
  download: { label: "téléchargement", article: "le", g: "m", module: "data" },
  // « a exporté les données « … » au format XLSX » - et non « l'export export… ».
  export: { label: "données", article: "les", g: "f", plural: true, module: "data" },
  file: { label: "fichier", article: "le", g: "m", module: "data" },
};

/** Descripteur d'une ressource, avec repli pour un type inconnu. */
export const resourceInfo = (type) =>
  ACTIVITY_RESOURCES[type] ?? { label: humanize(type).toLowerCase(), article: "l'élément", g: "m", module: null };

export const moduleLabel = (key) => ACTIVITY_MODULES.find((m) => m.key === key)?.label ?? "Autre";

/** Types de ressource rattachés à un module (pour filtrer côté base). */
export const moduleResourceTypes = (key) =>
  Object.entries(ACTIVITY_RESOURCES).filter(([, r]) => r.module === key).map(([type]) => type);

/* ------------------------------ Phrases ---------------------------------- */

/** « la localité », « l'opérateur » - le nom commun précédé de son article. */
export function definite(type) {
  const r = resourceInfo(type);
  if (!ACTIVITY_RESOURCES[type]) return `l'élément « ${r.label} »`;
  return r.article.endsWith("'") ? `${r.article}${r.label}` : `${r.article} ${r.label}`;
}

/** « de la localité », « du signalement », « de l'opérateur ». */
export function partitive(type) {
  const phrase = definite(type);
  if (phrase.startsWith("le ")) return `du ${phrase.slice(3)}`;
  if (phrase.startsWith("les ")) return `des ${phrase.slice(4)}`;
  return `de ${phrase}`;
}

/** « une localité », « un opérateur » - quand l'élément n'a pas de nom. */
export function indefinite(type) {
  const r = resourceInfo(type);
  if (r.plural) return `des ${r.label}`;
  return `${r.g === "f" ? "une" : "un"} ${r.label}`;
}

/** Désignation de l'élément ciblé : « la localité Abobo-Doumé ». */
function target(action, resourceType, resourceLabel) {
  const a = actionInfo(action);
  const noun = resourceLabel
    ? `${a.of ? partitive(resourceType) : definite(resourceType)} ${resourceLabel}`
    : a.of ? partitive(resourceType) : indefinite(resourceType);
  return noun;
}

/**
 * Phrase décrivant une activité.
 *
 * @param actorName     auteur tel qu'il doit apparaître
 * @param action        code d'action (CREATE, UPDATE…)
 * @param resourceType  type de ressource (locality, operator…)
 * @param resourceLabel nom lisible de l'élément (« Abobo-Doumé »)
 * @param status        SUCCESS | FAILURE
 * @param reason        motif lisible d'un échec (message déjà destiné à l'utilisateur)
 * @param detail        précision ajoutée en fin de phrase (« (En attente → Résolu) »)
 */
export function describeActivity({
  actorName,
  action,
  resourceType,
  resourceLabel = null,
  status = "SUCCESS",
  reason = null,
  detail = null,
}) {
  const actor = String(actorName ?? "").trim() || "Un compte non identifié";
  const a = actionInfo(action);
  const tail = detail ? ` ${detail}` : "";

  if (a.sentence) return a.sentence(actor, reason);

  if (status === "FAILURE") {
    return `${actor} a tenté de ${a.infinitive} ${target(action, resourceType, resourceLabel)}${tail}` +
      `${reason ? ` — échec : ${stripFinalDot(reason)}` : " — échec"}.`;
  }
  return `${actor} ${a.verb} ${target(action, resourceType, resourceLabel)}${tail}.`;
}

const stripFinalDot = (s) => String(s).trim().replace(/[.\s]+$/, "");

/* ------------------------------ Auteurs ---------------------------------- */

/** Nom affiché d'un utilisateur : « Prénom Nom », à défaut son e-mail. */
export function actorNameOf(user) {
  if (!user) return null;
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return name || user.email || null;
}

/** Initiales d'un nom, pour l'avatar. */
export function initialsOf(name) {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : parts[0][1] ?? "";
  return (first + last).toUpperCase();
}

/**
 * Référence courte d'un élément sans nom (signalement…) : « n° 4F2A9C ».
 * Les six derniers caractères de l'identifiant public suffisent à le
 * retrouver sans exposer d'identifiant interne.
 */
export const referenceOf = (code) => (code ? `n° ${String(code).slice(-6).toUpperCase()}` : null);

/** Nom lisible d'un élément à partir de sa ligne en base. */
export function resourceLabelOf(type, row) {
  if (!row) return null;
  if (type === "user") return actorNameOf(row);
  if (type === "sync") return row.entityType ?? null;
  if (type === "download") return row.type ?? null;
  return row.name ?? row.title ?? row.label ?? row.code ?? null;
}

/* ------------------------ Valeurs avant / après -------------------------- */

/** Champs techniques sans intérêt pour un lecteur non technique. */
const IGNORED_FIELDS = new Set(["id", "code", "createdAt", "updatedAt"]);

/** Champs dont la valeur ne doit jamais apparaître dans le journal. */
export const SENSITIVE_FIELDS = new Set([
  "password", "passwordHash", "token", "resetToken", "secret",
  "apiKey", "accessToken", "refreshToken",
]);

/** Valeur substituée à un champ sensible. */
export const MASKED = "••••••";

const MAX_TEXT = 2000;

/** Clé technique : identifiant, clé étrangère numérique (`operatorId`…). */
const isTechnicalKey = (key) => IGNORED_FIELDS.has(key) || /Id$/.test(key);

/**
 * Réduit une ligne en valeurs simples, prêtes à être conservées au journal :
 * champs techniques et relations écartés, champs sensibles masqués, textes
 * longs tronqués.
 */
export function sanitizeValues(row) {
  if (!row || typeof row !== "object") return null;
  const out = {};
  for (const [key, raw] of Object.entries(row)) {
    if (isTechnicalKey(key)) continue;
    if (SENSITIVE_FIELDS.has(key)) {
      out[key] = MASKED;
      continue;
    }
    let value = raw instanceof Date ? raw.toISOString() : raw;
    if (value !== null && typeof value === "object") continue; // relations, JSON imbriqué
    if (typeof value === "string" && value.length > MAX_TEXT) value = `${value.slice(0, MAX_TEXT)}…`;
    out[key] = value ?? null;
  }
  return out;
}

/**
 * Écart entre deux états d'un élément : seuls les champs modifiés sont
 * retenus. Un champ sensible modifié est signalé comme tel, valeurs masquées
 * des deux côtés.
 */
export function diffValues(before, after) {
  const a = sanitizeValues(before) ?? {};
  const b = sanitizeValues(after) ?? {};
  const oldValue = {};
  const newValue = {};
  const changed = [];

  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (SENSITIVE_FIELDS.has(key)) {
      // Deux empreintes de mot de passe différentes suffisent à savoir qu'il a
      // changé : on compare les valeurs BRUTES, sans jamais les conserver.
      if (before?.[key] !== after?.[key]) {
        oldValue[key] = MASKED;
        newValue[key] = MASKED;
        changed.push(key);
      }
      continue;
    }
    if (JSON.stringify(a[key] ?? null) !== JSON.stringify(b[key] ?? null)) {
      oldValue[key] = a[key] ?? null;
      newValue[key] = b[key] ?? null;
      changed.push(key);
    }
  }
  return { oldValue, newValue, changed };
}

/* ------------------------- Présentation des champs ----------------------- */

const FIELD_LABELS = {
  name: "Nom", firstName: "Prénom", lastName: "Nom", email: "E-mail", phone: "Téléphone",
  role: "Rôle", status: "Statut", color: "Couleur", imagePath: "Logo / image", network: "Type de réseau",
  fiberKm: "Fibre optique (km)", description: "Description", title: "Titre", type: "Type",
  level: "Niveau", population: "Population", latitude: "Latitude", longitude: "Longitude",
  centerLat: "Latitude", centerLng: "Longitude", year: "Année", date: "Date",
  dateUpdate: "Date de mise à jour", entityType: "Élément synchronisé", filePath: "Fichier",
  videoPath: "Vidéo", proofFilePath: "Pièce justificative", isPublished: "Publié", published: "Publié",
  acceptNews: "Accepte les actualités", lastLoginAt: "Dernière connexion",
  emailVerifiedAt: "E-mail vérifié le", avatarUrl: "Photo de profil", bio: "Présentation",
  comment: "Commentaire", localityName: "Localité", category: "Catégorie", coverage: "Couverture",
  present: "Station présente", forecast: "Couverture prévue", message: "Message", subject: "Objet",
  password: "Mot de passe", domain: "Domaine", read: "Lue", isRead: "Lue", startDate: "Début",
  endDate: "Fin", rgph: "Référentiel de population",
};

/** Libellé d'un champ, avec repli sur une forme lisible du nom technique. */
export function fieldLabel(key) {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  // Clé déjà rédigée en français (« Localités créées ») : conservée telle quelle.
  if (/\s/.test(key)) return key;
  return humanize(key);
}

const VALUE_LABELS = {
  role: { ADMIN: "Administrateur", SUPERVISOR: "Superviseur", CONTROLLER: "Contrôleur", OPERATOR: "Opérateur", CLIENT: "Citoyen" },
  status: {
    ACTIVE: "Actif", INACTIVE: "Inactif", PENDING: "En attente", SUSPENDED: "Suspendu",
    IN_REVIEW: "En cours d'examen", RESOLVED: "Résolu", REJECTED: "Rejeté",
  },
  network: { FIXED: "Fixe", MOBILE: "Mobile", HYBRID: "Hybride (fixe et mobile)" },
  type: { COVERAGE: "Couverture", QOS: "Qualité de service", APPLICATION: "Plateforme", NETWORK: "Réseau" },
  category: {
    NO_NETWORK: "Pas de réseau", SLOW_NETWORK: "Réseau lent", FREQUENT_DROPS: "Coupures fréquentes",
    APP_ISSUE: "Problème de l'application", OTHER: "Autre",
  },
};

/** Libellés des rôles, réutilisés pour l'auteur d'une activité. */
export const ROLE_LABELS = VALUE_LABELS.role;

/** Libellés des statuts d'activité. */
export const ACTIVITY_STATUS = {
  SUCCESS: { label: "Réussie", tone: "green" },
  FAILURE: { label: "Échouée", tone: "red" },
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** Valeur lisible d'un champ. */
export function formatFieldValue(key, value) {
  if (value === MASKED) return "Valeur masquée";
  if (value === null || value === undefined || value === "") return "(vide)";
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  if (VALUE_LABELS[key]?.[value]) return VALUE_LABELS[key][value];
  if (typeof value === "string" && ISO_DATE.test(value)) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return formatDateTime(d);
  }
  if (typeof value === "number") return new Intl.NumberFormat("fr-FR").format(value);
  return String(value);
}

/* ------------------------------- Dates ----------------------------------- */

/**
 * Fuseau d'affichage. La Côte d'Ivoire vit à l'heure UTC toute l'année : fixer
 * le fuseau garantit la même heure à l'écran quel que soit l'appareil du
 * lecteur, et la même que celle du serveur.
 */
export const ACTIVITY_TIME_ZONE = "Africa/Abidjan";

/** « 14 septembre 2026 à 10:42:17 ». */
export function formatDateTime(date, { seconds = true } = {}) {
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", ...(seconds ? { second: "2-digit" } : {}),
    timeZone: ACTIVITY_TIME_ZONE,
  }).format(d).replace(",", " à");
}

/** « 10:42 ». */
export function formatTime(date) {
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: ACTIVITY_TIME_ZONE })
    .format(date instanceof Date ? date : new Date(date));
}

/** Clé de jour (AAAA-MM-JJ) dans le fuseau d'affichage. */
export function dayKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat("en-CA", { timeZone: ACTIVITY_TIME_ZONE }).format(d);
}

/** En-tête de groupe : « Aujourd'hui », « Hier », « lundi 14 septembre 2026 ». */
export function dayHeading(key, now = new Date()) {
  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getTime() - 86400000));
  if (key === today) return "Aujourd'hui";
  if (key === yesterday) return "Hier";
  const label = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  }).format(new Date(`${key}T12:00:00Z`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/* ---------------------------- Navigateur --------------------------------- */

/** « Chrome sur macOS » - lecture simplifiée de l'agent utilisateur. */
export function describeUserAgent(ua) {
  const s = String(ua ?? "");
  if (!s) return null;
  const browser =
    /Edg\//.test(s) ? "Edge" :
    /OPR\/|Opera/.test(s) ? "Opera" :
    /Firefox\//.test(s) ? "Firefox" :
    /Chrome\//.test(s) ? "Chrome" :
    /Safari\//.test(s) ? "Safari" :
    /curl\//.test(s) ? "curl" : "Navigateur inconnu";
  const os =
    /Windows/.test(s) ? "Windows" :
    /Android/.test(s) ? "Android" :
    /iPhone|iPad|iOS/.test(s) ? "iOS" :
    /Mac OS X|Macintosh/.test(s) ? "macOS" :
    /Linux/.test(s) ? "Linux" : null;
  return os ? `${browser} sur ${os}` : browser;
}

/* ------------------------------ Outils ----------------------------------- */

/** « subPrefecture » → « Sub prefecture ». */
function humanize(key) {
  const s = String(key ?? "").replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim().toLowerCase();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "Élément";
}
