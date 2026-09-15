"use client";

import ActivityLog from "@/components/dashboard/ActivityLog";

/**
 * Activité de la plateforme - journal des actions menées sur la plateforme.
 * L'accès est réservé aux administrateurs par le layout `/admin` ; l'API
 * vérifie à nouveau le rôle à chaque lecture.
 */
export default function AdminActivityPage() {
  return <ActivityLog />;
}
