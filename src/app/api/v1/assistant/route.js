import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { answerQuery } from "@/lib/assistant";
import { DATE_RE } from "@/lib/entity-search";

/**
 * POST /api/v1/assistant
 * Body: { query, operators?, technologies?, date? }
 * Répond en langage naturel sur la couverture, à partir des données réelles
 * de la période (intention extraite par le modèle IA, repli local sans clé).
 */
export const POST = withErrorHandling(async (request) => {
  const body = await request.json().catch(() => ({}));
  const query = (body.query || "").toString().trim();
  if (!query) return fail("BAD_REQUEST", "La question est vide.", 422);

  const date = DATE_RE.test(body.date || "") ? body.date : "2024-12-31";

  const result = await answerQuery({
    query,
    date,
    operators: Array.isArray(body.operators) ? body.operators : undefined,
    technologies: Array.isArray(body.technologies) ? body.technologies : undefined,
  });

  return ok(result);
});
