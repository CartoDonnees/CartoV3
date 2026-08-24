"use client";

import ResourceManager from "@/components/dashboard/ResourceManager";
import { Badge } from "@/components/dashboard/ui";

export default function NewslettersPage() {
  return (
    <ResourceManager
      title="Bulletins d'information"
      subtitle="Actualités publiées sur l'observatoire public."
      endpoint="/api/v1/admin/newsletters"
      singular="bulletin"
      createLabel="Nouveau bulletin"
      wideModal
      defaultForm={{ published: true }}
      toForm={(r) => ({
        title: r.title,
        categoryCode: r.categoryCode || "",
        description: r.description || "",
        imagePath: r.imagePath || "",
        filePath: r.filePath || "",
        published: !!r.published,
      })}
      columns={[
        { key: "title", label: "Titre", strong: true },
        { key: "categoryTitle", label: "Catégorie", render: (r) => r.categoryTitle || "—" },
        { key: "published", label: "État", render: (r) => <Badge tone={r.published ? "green" : "gray"}>{r.published ? "Publié" : "Brouillon"}</Badge> },
        { key: "likes", label: "J'aime" },
      ]}
      fields={[
        { name: "title", label: "Titre", required: true, full: true },
        {
          name: "categoryCode",
          label: "Catégorie",
          type: "select",
          remote: { endpoint: "/api/v1/admin/news-categories", valueKey: "code", labelKey: "title" },
          required: true,
        },
        { name: "published", label: "Publier immédiatement", type: "checkbox" },
        { name: "description", label: "Contenu", type: "textarea", full: true },
        { name: "imagePath", label: "Image (chemin/URL)", full: true },
        { name: "filePath", label: "Fichier joint (chemin/URL)", full: true },
      ]}
    />
  );
}
