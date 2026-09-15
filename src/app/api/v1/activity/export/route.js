import { ok, withErrorHandling } from "@/lib/api/response";
import { getSessionUser } from "@/lib/auth-server";
import { recordActivity } from "@/lib/activity";

/**
 * POST /api/v1/activity/export - signale un export au journal d'activité.
 *
 * Les exports (Excel, CSV, PDF, images de carte) sont produits dans le
 * navigateur : le serveur n'en a pas connaissance autrement. Cette route est
 * volontairement ÉTROITE, pour qu'elle ne puisse pas servir à fabriquer de
 * fausses activités :
 *  - l'action est imposée (EXPORT) - impossible d'inscrire une création ou une
 *    suppression par ce biais ;
 *  - l'auteur est celui de la session, jamais une valeur transmise ;
 *  - le format est pris dans une liste fermée, le libellé est borné ;
 *  - sans session, rien n'est consigné (exports publics anonymes).
 */

const FORMATS = new Set(["XLSX", "CSV", "PDF", "PNG", "JPEG", "JPG", "SVG", "GEOJSON", "KML"]);

/**
 * Libellé sûr : texte simple, sans caractères de contrôle ni guillemets
 * français (qui l'encadrent dans la phrase), borné. Les « _ » des noms de
 * fichier deviennent des espaces.
 */
const cleanLabel = (v) =>
  String(v ?? "")
    .replace(/[\u0000-\u001f\u007f\u00ab\u00bb]+/g, " ")
    .replace(/_+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160) || null;

export const POST = withErrorHandling(async (request) => {
  const user = await getSessionUser();
  if (!user) return ok({ recorded: false });

  const body = await request.json().catch(() => ({}));
  const raw = String(body.format ?? "").toUpperCase();
  const format = FORMATS.has(raw) ? (raw === "JPG" ? "JPEG" : raw) : null;
  const label = cleanLabel(body.label);

  await recordActivity({
    actor: user,
    action: "EXPORT",
    resourceType: "export",
    resourceLabel: label ? `« ${label} »` : null,
    detail: format ? `au format ${format}` : null,
    newValue: { Format: format ?? "Autre" },
    request,
  });
  return ok({ recorded: true });
});
