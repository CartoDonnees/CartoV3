"use client";

import ResourceManager from "@/components/dashboard/ResourceManager";
import { Badge } from "@/components/dashboard/ui";

export default function NotificationsPage() {
  return (
    <ResourceManager
      title="Notifications"
      subtitle="Messages adressés aux utilisateurs de la plateforme."
      endpoint="/api/v1/admin/notifications"
      singular="notification"
      createLabel="Nouvelle notification"
      toForm={(r) => ({ title: r.title, content: r.content || "", target: r.target === "Tous" ? "" : r.target })}
      columns={[
        { key: "title", label: "Titre", strong: true },
        { key: "content", label: "Message", muted: true },
        { key: "target", label: "Destinataire" },
        { key: "read", label: "État", render: (r) => <Badge tone={r.read ? "green" : "amber"}>{r.read ? "Lue" : "Non lue"}</Badge> },
      ]}
      fields={[
        { name: "title", label: "Titre", required: true, full: true },
        { name: "content", label: "Message", type: "textarea", full: true },
        { name: "target", label: "E-mail du destinataire", full: true, help: "Laisser vide pour une notification générale (tous les utilisateurs)." },
      ]}
    />
  );
}
