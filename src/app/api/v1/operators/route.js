import { prisma } from "@/lib/prisma";
import { ok, withErrorHandling } from "@/lib/api/response";

/** GET /api/v1/operators - opérateurs mobiles (depuis la base). */
export const GET = withErrorHandling(async () => {
  const rows = await prisma.operator.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
  });
  const data = rows.map((o) => ({
    key: o.name, // MOOV | MTN | ORANGE (clé métier utilisée par la carte)
    code: o.code,
    name: o.name,
    color: o.color,
    imagePath: o.imagePath,
    network: o.network,
    fiberKm: o.fiberKm,
    description: o.description,
  }));
  return ok(data);
});
