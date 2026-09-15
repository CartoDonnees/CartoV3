import {
  LayoutDashboard,
  Users,
  FolderTree,
  Bell,
  RefreshCw,
  Download,
  Tags,
  Table2,
  Radio,
  SignalHigh,
  CalendarRange,
  Newspaper,
  TriangleAlert,
  MessageSquareWarning,
  Globe2,
  Settings,
  Activity,
  Map as MapIcon,
} from "lucide-react";

/** Métadonnées d'affichage par rôle. */
export const ROLE_META = {
  ADMIN: { label: "Administrateur", space: "Administration", home: "/admin" },
  SUPERVISOR: { label: "Superviseur", space: "Supervision", home: "/superviseur" },
  CONTROLLER: { label: "Contrôleur", space: "Supervision", home: "/superviseur" },
  OPERATOR: { label: "Opérateur", space: "Espace opérateur", home: "/operateur" },
  CLIENT: { label: "Citoyen", space: "Espace public", home: "/carte" },
};

/**
 * Navigation latérale, organisée comme la version 2 : des rubriques
 * (« Gestion des données », « Paramètres ») regroupant des entrées qui
 * peuvent elles-mêmes déplier leurs sous-menus.
 *
 * Chaque entrée est soit une destination (`href`), soit un groupe (`children`).
 */
export function navForRole(role) {
  if (role === "ADMIN") {
    return [
      {
        heading: "Vue d'ensemble",
        items: [
          { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
          { href: "/admin/activite", label: "Activité de la plateforme", icon: Activity },
        ],
      },
      {
        heading: "Gestion des données",
        items: [
          {
            label: "Données géographiques",
            icon: Globe2,
            children: [
              { href: "/admin/referentiel", label: "Entités administratives", icon: FolderTree },
              { href: "/admin/couverture", label: "Données de couverture", icon: Table2 },
            ],
          },
          {
            label: "Signalements",
            icon: TriangleAlert,
            children: [
              { href: "/admin/signalements", label: "Problèmes réseaux", icon: MessageSquareWarning },
              { href: "/admin/problemes", label: "Problèmes plateforme", icon: TriangleAlert },
            ],
          },
          {
            label: "Newsletters",
            icon: Newspaper,
            children: [
              { href: "/admin/bulletins", label: "Gestion des actualités", icon: Newspaper },
              { href: "/admin/categories", label: "Gestion des catégories", icon: Tags },
            ],
          },
          { href: "/admin/periodes", label: "Périodes", icon: CalendarRange },
        ],
      },
      {
        heading: "Paramètres",
        items: [
          {
            label: "Comptes et profils",
            icon: Users,
            children: [
              { href: "/admin/utilisateurs", label: "Utilisateurs", icon: Users },
              { href: "/admin/operateurs", label: "Opérateurs", icon: Radio },
            ],
          },
          {
            label: "Configuration",
            icon: Settings,
            children: [
              { href: "/admin/technologies", label: "Technologies", icon: SignalHigh },
              { href: "/admin/synchronisations", label: "Synchronisations", icon: RefreshCw },
              { href: "/admin/notifications", label: "Notifications", icon: Bell },
              { href: "/admin/telechargements", label: "Téléchargements", icon: Download },
            ],
          },
        ],
      },
    ];
  }

  if (role === "SUPERVISOR" || role === "CONTROLLER") {
    return [
      {
        heading: "Vue d'ensemble",
        items: [{ href: "/superviseur", label: "Tableau de bord", icon: LayoutDashboard, exact: true }],
      },
      {
        heading: "Suivi",
        items: [{ href: "/superviseur/signalements", label: "Signalements", icon: MessageSquareWarning }],
      },
    ];
  }

  if (role === "OPERATOR") {
    return [
      {
        heading: "Vue d'ensemble",
        items: [{ href: "/operateur", label: "Tableau de bord", icon: LayoutDashboard, exact: true }],
      },
      {
        heading: "Gestion des données",
        items: [
          {
            label: "Données géographiques",
            icon: Globe2,
            children: [{ href: "/operateur/couverture", label: "Données de couverture", icon: Table2 }],
          },
        ],
      },
    ];
  }

  return [];
}

export const BACK_TO_MAP = { href: "/carte", label: "Voir la carte", icon: MapIcon };
