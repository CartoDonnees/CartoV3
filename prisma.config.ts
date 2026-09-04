import path from "node:path";
import { defineConfig } from "prisma/config";
import "./prisma/load-env.mjs";

/**
 * Configuration Prisma du projet.
 *
 * Remplace la clé `prisma` de `package.json`, dépréciée et retirée en
 * Prisma 7. Déclare notamment la commande de peuplement, utilisée par
 * `prisma db seed` et par `prisma migrate reset`.
 */
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    seed: "node prisma/seed.mjs",
  },
});
