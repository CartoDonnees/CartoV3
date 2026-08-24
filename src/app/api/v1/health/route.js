import { ok, withErrorHandling } from "@/lib/api/response";

/** GET /api/v1/health - vérifie que l'API REST v1 répond. */
export const GET = withErrorHandling(async () =>
  ok({ status: "ok", service: "cartodonnees-v3", time: new Date().toISOString() }),
);
