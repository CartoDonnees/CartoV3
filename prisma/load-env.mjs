/**
 * Charge les variables d'environnement pour les outils lancés hors Next.js
 * (CLI Prisma, script de peuplement).
 *
 * Next.js lit `.env` / `.env.local` de lui-même, mais ni `node prisma/seed.mjs`
 * ni le CLI Prisma — dès qu'un `prisma.config.ts` existe — ne le font. Sans ce
 * chargement, `DATABASE_URL` est introuvable sur une installation neuve.
 *
 * Précédence respectée : une variable déjà présente dans l'environnement
 * l'emporte sur les fichiers, et `.env.local` l'emporte sur `.env`.
 */
import { existsSync } from "node:fs";
import path from "node:path";

const FILES = [".env", ".env.local"]; // du plus général au plus spécifique

export function loadEnv(root = process.cwd()) {
  // Ce qui vient de l'appelant est prioritaire : on le met de côté.
  const explicit = { ...process.env };

  for (const file of FILES) {
    const full = path.join(root, file);
    if (!existsSync(full)) continue;
    try {
      process.loadEnvFile(full);
    } catch {
      /* fichier illisible ou malformé : on ignore, les suivants peuvent suffire */
    }
  }

  for (const [key, value] of Object.entries(explicit)) process.env[key] = value;
}

loadEnv();
