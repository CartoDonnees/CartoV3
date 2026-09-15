import { prisma } from "@/lib/prisma";
import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { verifyPassword, signToken, sessionCookieOptions, publicUser, SESSION_COOKIE } from "@/lib/auth";
import { recordActivity } from "@/lib/activity";

/** POST /api/v1/auth/login - vérifie les identifiants et ouvre une session. */
export const POST = withErrorHandling(async (request) => {
  const body = await request.json().catch(() => ({}));
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  if (!email || !password) return fail("BAD_REQUEST", "E-mail et mot de passe requis.", 422);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.password))) {
    if (user) {
      await recordActivity({
        actor: user,
        action: "LOGIN_FAILED",
        resourceType: "session",
        status: "FAILURE",
        reason: "mot de passe incorrect",
        request,
      });
    } else {
      // Adresse inconnue : la saisie n'est PAS recopiée au journal. Un mot de
      // passe tapé par erreur dans le champ e-mail y finirait en clair.
      await recordActivity({
        actorName: "Adresse inconnue",
        action: "LOGIN_FAILED",
        resourceType: "session",
        status: "FAILURE",
        description: "Échec de connexion avec une adresse e-mail inconnue.",
        request,
      });
    }
    return fail("INVALID_CREDENTIALS", "E-mail ou mot de passe incorrect.", 401);
  }
  if (user.status === "INACTIVE" || user.status === "SUSPENDED") {
    await recordActivity({
      actor: user,
      action: "LOGIN_FAILED",
      resourceType: "session",
      status: "FAILURE",
      reason: "compte désactivé",
      request,
    });
    return fail("ACCOUNT_DISABLED", "Ce compte est désactivé.", 403);
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await recordActivity({ actor: user, action: "LOGIN", resourceType: "session", request });
  const token = await signToken({ sub: user.id, email: user.email, role: user.role });
  const res = ok({ user: publicUser(user) });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
});
