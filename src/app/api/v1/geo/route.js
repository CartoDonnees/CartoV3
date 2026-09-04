import { createReadStream } from "node:fs";
import { stat, readdir } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { fail } from "@/lib/api/response";

const COV_DIR = path.join(process.cwd(), "dataFiles", "data_server", "data_cov");
const INIT_DIR = path.join(process.cwd(), "dataFiles", "init");
const QOS_DIR = path.join(process.cwd(), "dataFiles", "data_server", "data_qos");

const QOS_SERVICES = new Set(["VOIX", "SMS", "DATA"]);

/** Campagnes QoS disponibles (déduites des fichiers présents), mises en cache. */
let qosCampaignsPromise = null;
function qosCampaigns() {
  if (!qosCampaignsPromise) {
    qosCampaignsPromise = readdir(QOS_DIR)
      .then((files) => {
        const set = new Set();
        for (const f of files) {
          const m = /^(VOIX|SMS|DATA)_(.+)_\.geojson$/.exec(f);
          if (m) set.add(m[2]);
        }
        // « Campagne 2020 » … « Campagne-2 2024 » : tri par année puis par numéro.
        return [...set].sort((a, b) => {
          const ya = Number(/(\d{4})/.exec(a)?.[1] ?? 0);
          const yb = Number(/(\d{4})/.exec(b)?.[1] ?? 0);
          return yb - ya || a.localeCompare(b);
        });
      })
      .catch(() => []);
  }
  return qosCampaignsPromise;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATED_KINDS = {
  district: (d) => `district_${d}.geojson`,
  region: (d) => `region_${d}.geojson`,
  department: (d) => `departments_${d}.geojson`,
  subPrefecture: (d) => `subPrefecture_${d}.geojson`,
  locality: (d) => `locality_${d}.geojson`,
  whiteLocality: (d) => `whiteLocality_${d}.geojson`,
  stats: (d) => `statsnationales_${d}.json`,
};
const FIBER_OPS = new Set(["orange", "mtn", "awale", "ansut"]);

/**
 * GET /api/v1/geo?kind=district&date=2024-12-31
 * GET /api/v1/geo?kind=fiber&op=orange
 * GET /api/v1/geo?kind=railways
 * Sert (en streaming) les sources GeoJSON/JSON depuis dataFiles/data_server/data_cov.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind");

  // Liste des campagnes de qualité de service.
  if (kind === "qosCampaigns") {
    return Response.json(await qosCampaigns(), {
      headers: { "Cache-Control": "public, max-age=3600" },
    });
  }

  let filename;
  let baseDir = COV_DIR;
  if (kind === "qos") {
    // Audits de qualité de service : VOIX / SMS / DATA par campagne.
    const service = (searchParams.get("service") || "").toUpperCase();
    const campaign = searchParams.get("campaign") || "";
    if (!QOS_SERVICES.has(service)) return fail("BAD_REQUEST", "Service QoS invalide.", 422);
    // La campagne doit appartenir à la liste connue (aucune valeur libre).
    if (!(await qosCampaigns()).includes(campaign)) {
      return fail("BAD_REQUEST", "Campagne QoS inconnue.", 422);
    }
    baseDir = QOS_DIR;
    filename = `${service}_${campaign}_.geojson`;
  } else if (kind === "qosLocality") {
    // Localités retenues dans l'échantillon d'audit d'une campagne.
    const campaign = searchParams.get("campaign") || "";
    if (!(await qosCampaigns()).includes(campaign)) {
      return fail("BAD_REQUEST", "Campagne QoS inconnue.", 422);
    }
    baseDir = QOS_DIR;
    filename = `locality_${campaign}_.geojson`;
  } else if (kind === "railways") {
    filename = "railways.geojson";
  } else if (kind === "state") {
    // Limite (bordure) de l'État de Côte d'Ivoire - non datée, dans dataFiles/init.
    baseDir = INIT_DIR;
    filename = "state_admin.geojson";
  } else if (kind === "fiber") {
    const op = (searchParams.get("op") || "").toLowerCase();
    if (!FIBER_OPS.has(op)) return fail("BAD_REQUEST", "Opérateur fibre invalide.", 422);
    filename = `fiber_${op}.geojson`;
  } else if (DATED_KINDS[kind]) {
    const date = searchParams.get("date");
    if (!DATE.test(date || "")) return fail("BAD_REQUEST", "Date invalide.", 422);
    filename = DATED_KINDS[kind](date);
  } else {
    return fail("BAD_REQUEST", "Type de donnée inconnu.", 422);
  }

  const filePath = path.join(baseDir, filename);
  // Garde-fou anti path-traversal
  if (!filePath.startsWith(baseDir)) return fail("FORBIDDEN", "Chemin non autorisé.", 403);

  try {
    await stat(filePath);
  } catch {
    return fail("NOT_FOUND", "Donnée indisponible pour cette période.", 404);
  }

  const nodeStream = createReadStream(filePath);
  const webStream = Readable.toWeb(nodeStream);
  return new Response(webStream, {
    headers: {
      "Content-Type": kind === "stats" ? "application/json" : "application/geo+json",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
