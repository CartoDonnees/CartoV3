import { prisma } from "@/lib/prisma";
import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { verifyPassword, signToken, sessionCookieOptions, publicUser, SESSION_COOKIE } from "@/lib/auth";

/** POST /api/v1/auth/login — vérifie les identifiants et ouvre une session. */
export const POST = withErrorHandling(async (request) => {
  const body = await request.json().catch(() => ({}));
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  if (!email || !password) return fail("BAD_REQUEST", "E-mail et mot de passe requis.", 422);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.password))) {
    return fail("INVALID_CREDENTIALS", "E-mail ou mot de passe incorrect.", 401);
  }
  if (user.status === "INACTIVE" || user.status === "SUSPENDED") {
    return fail("ACCOUNT_DISABLED", "Ce compte est désactivé.", 403);
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const token = await signToken({ sub: user.id, email: user.email, role: user.role });
  const res = ok({ user: publicUser(user) });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
});
