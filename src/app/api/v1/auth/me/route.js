import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ok, withErrorHandling } from "@/lib/api/response";
import { verifyToken, publicUser, SESSION_COOKIE } from "@/lib/auth";

/** GET /api/v1/auth/me - retourne l'utilisateur connecté (ou null). */
export const GET = withErrorHandling(async () => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const payload = token ? await verifyToken(token) : null;
  if (!payload?.sub) return ok({ user: null });

  const user = await prisma.user.findUnique({ where: { id: Number(payload.sub) } });
  return ok({ user: user ? publicUser(user) : null });
});
