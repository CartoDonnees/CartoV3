import { prisma } from "@/lib/prisma";
import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { hashPassword, signToken, sessionCookieOptions, publicUser, SESSION_COOKIE } from "@/lib/auth";
import { recordActivity } from "@/lib/activity";
import { actorNameOf, sanitizeValues } from "@/lib/activity-format";

/** POST /api/v1/auth/register - crée un compte client et ouvre une session. */
export const POST = withErrorHandling(async (request) => {
  const body = await request.json().catch(() => ({}));
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  const lastName = (body.lastName || body.last_name || "").trim();
  const firstName = (body.firstName || body.first_name || "").trim() || null;

  if (!email || !password || !lastName) return fail("BAD_REQUEST", "Nom, e-mail et mot de passe sont requis.", 422);
  if (password.length < 6) return fail("WEAK_PASSWORD", "Le mot de passe doit contenir au moins 6 caractères.", 422);

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return fail("EMAIL_TAKEN", "Cet e-mail est déjà utilisé.", 409);

  const user = await prisma.user.create({
    data: {
      email,
      lastName,
      firstName,
      password: await hashPassword(password),
      role: "CLIENT",
      status: "ACTIVE",
    },
  });

  await recordActivity({
    actor: user,
    action: "REGISTER",
    resourceType: "user",
    resourceId: user.code,
    resourceLabel: actorNameOf(user),
    newValue: sanitizeValues(user), // mot de passe masqué
    request,
  });

  const token = await signToken({ sub: user.id, email: user.email, role: user.role });
  const res = ok({ user: publicUser(user) }, { status: 201 });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
});
