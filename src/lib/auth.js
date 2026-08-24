import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret-change-me");
export const SESSION_COOKIE = "carto_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 jours

export const hashPassword = (pw) => bcrypt.hash(pw, 10);
export const verifyPassword = (pw, hash) => bcrypt.compare(pw, hash);

export async function signToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET);
}

export async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload;
  } catch {
    return null;
  }
}

/** Options du cookie de session (httpOnly, non exposé au JS client). */
export function sessionCookieOptions(clear = false) {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: clear ? 0 : MAX_AGE,
  };
}

/** Projection publique d'un utilisateur (jamais le mot de passe). */
export const publicUser = (u) =>
  u && {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    phone: u.phone,
    role: u.role,
    avatarUrl: u.avatarUrl,
  };