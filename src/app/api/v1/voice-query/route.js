import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { extractCoverageQuery } from "@/lib/voice-intent";
import { searchEntities, nationalEntity, DATE_RE } from "@/lib/entity-search";

/**
 * POST /api/v1/voice-query
 * Body: { transcript, date }
 * Interprète une note vocale (modèle IA, repli local) en requête de couverture,
 * puis renvoie les entités correspondantes avec leurs statistiques.
 * Sans lieu cité (ex. « couverture 2G Orange »), la portée est NATIONALE.
 */
export const POST = withErrorHandling(async (request) => {
  const body = await request.json().catch(() => ({}));
  const transcript = (body.transcript || "").toString().trim();
  if (!transcript) return fail("BAD_REQUEST", "La transcription est vide.", 422);

  const date = DATE_RE.test(body.date || "") ? body.date : null;
  if (!date) return fail("BAD_REQUEST", "Période invalide.", 422);

  const query = await extractCoverageQuery(transcript);

  // Recherche : le niveau détecté d'abord (localité par défaut), puis tous niveaux.
  let results = [];
  if (query.entity) {
    results = await searchEntities(query.entity, date, { limit: 6, level: query.level });
    if (!results.length) results = await searchEntities(query.entity, date, { limit: 6 });
  }

  // Aucun lieu identifié → couverture sur toute l'étendue du territoire.
  let scope = "entity";
  if (!results.length) {
    const national = await nationalEntity(date);
    if (national) {
      results = [national];
      scope = "national";
    }
  }

  // Combinaison demandée (opérateur × technologie) à mettre en évidence.
  const focus = { operators: query.operators || [], technologies: query.technologies || [] };

  return ok({ query, scope, focus, results });
});
