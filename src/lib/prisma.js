import { PrismaClient } from "@prisma/client";

/**
 * Singleton PrismaClient - évite d'ouvrir de multiples connexions
 * en développement (hot-reload). Réutilise le schéma de la V2.
 */
const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
