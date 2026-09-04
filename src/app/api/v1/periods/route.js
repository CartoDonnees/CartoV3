import { prisma } from "@/lib/prisma";
import { ok, withErrorHandling } from "@/lib/api/response";

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
function frLabel(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return dateStr;
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

/**
 * GET /api/v1/periods?type=COV - périodes semestrielles (depuis la base).
 * Triées de la plus récente à la plus ancienne.
 */
export const GET = withErrorHandling(async (request) => {
  const raw = new URL(request.url).searchParams.get("type");
  const type = raw === "QOS" ? "QOS" : "COVERAGE"; // accepte "COV"/"COVERAGE" → COVERAGE
  const rows = await prisma.period.findMany({
    where: { type, status: "ACTIVE" },
  });
  const data = rows
    .map((p) => ({ code: p.code, date: p.title, label: frLabel(p.title), type: p.type }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  return ok(data);
});
