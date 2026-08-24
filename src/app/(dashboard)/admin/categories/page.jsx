"use client";

import ResourceManager from "@/components/dashboard/ResourceManager";

export default function NewsCategoriesPage() {
  return (
    <ResourceManager
      title="Catégories d'actualités"
      subtitle="Rubriques de classement des bulletins d'information."
      endpoint="/api/v1/admin/news-categories"
      singular="catégorie"
      createLabel="Nouvelle catégorie"
      toForm={(r) => ({ title: r.title, description: r.description || "" })}
      columns={[
        { key: "title", label: "Titre", strong: true },
        { key: "description", label: "Description", muted: true },
      ]}
      fields={[
        { name: "title", label: "Titre", required: true, full: true },
        { name: "description", label: "Description", type: "textarea", full: true },
      ]}
    />
  );
}
