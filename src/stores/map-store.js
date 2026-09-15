import { create } from "zustand";
import { OPERATORS, TECHNOLOGIES } from "@/config/artci";
import { DEFAULT_METRIC } from "@/lib/coverage";
import { RGPH_REFERENTIALS, rgphCodeFor, pickPeriodForRgph } from "@/lib/rgph";

/** Périodes semestrielles par défaut (repli si l'API base n'est pas disponible). */
export const PERIODS = [
  { label: "31 décembre 2024", date: "2024-12-31" },
  { label: "30 juin 2024", date: "2024-06-30" },
  { label: "31 décembre 2023", date: "2023-12-31" },
  { label: "30 juin 2023", date: "2023-06-30" },
  { label: "31 décembre 2022", date: "2022-12-31" },
  { label: "30 juin 2022", date: "2022-06-30" },
  { label: "31 décembre 2021", date: "2021-12-31" },
  { label: "30 juin 2021", date: "2021-06-30" },
];

/** Référentiels de population - définis une seule fois dans `lib/rgph`. */
export const RGPH = RGPH_REFERENTIALS;

/** Libellé d'une période - résolu contre la liste dynamique (base) puis le repli. */
export const periodLabel = (date) => {
  const list = useMapStore.getState?.().periods ?? PERIODS;
  return list.find((p) => p.date === date)?.label ?? date;
};
export const rgphLabel = (code) => RGPH.find((r) => r.code === code)?.label ?? code;

const OP_NAME = { MOOV: "Moov Africa", MTN: "MTN", ORANGE: "Orange" };

/* Bascule couverture ⇄ qualité de service : les couches d'un domaine sont
   éteintes quand l'autre prend la main, et sa section se replie. */
const COVERAGE_ON = { network: true, globalCov: true, showCovLocalities: true };
const COVERAGE_OFF = {
  network: false, globalCov: false, showLocality: false, showCovLocalities: false,
  showNoCovLocalities: false, covLevels: false, operatorCov: false, statCountry: false,
};
/* Domaine QoS activé : on ouvre la section et l'échantillon audité, les
   opérateurs et services restant au choix de l'utilisateur. */
const QOS_ON = { showQoS: true, qosOperator: true, showFieldLevel: true };
const QOS_OFF = {
  showQoS: false, qosOperator: false, showFieldLevel: false, showQosOperator: false,
  showServiceBase: false, showVoiceService: false, showSmsService: false,
  showDataService: false, qosConnexService: false, qosFieldLevel: false, statAudit: false,
};

/**
 * État global de l'expérience carte (filtres, panneaux, outils, instance Mapbox).
 * L'instance Mapbox est stockée hors-rendu : on la lit via getState().
 */
export const useMapStore = create((set, get) => ({
  /** Instance Mapbox partagée (non réactive) */
  map: null,
  setMap: (map) => set({ map }),

  /**
   * Taux appliqués à la choroplèthe via `setFeatureState`, par source puis par
   * entité. Ces états ne font pas partie du style : l'export doit les rejouer
   * sur sa carte hors écran, sinon les polygones sortent en gris.
   */
  choroplethStates: {},
  setChoroplethStates: (source, states) =>
    set((s) => ({ choroplethStates: { ...s.choroplethStates, [source]: states } })),

  /** Données de référence (chargées depuis la base ; repli sur la config). */
  periods: PERIODS,
  operatorList: OPERATORS,
  technologyList: TECHNOLOGIES,
  loadRefData: async () => {
    try {
      const j = (url) => fetch(url).then((r) => r.json()).catch(() => null);
      const [pr, opr, tr, qc] = await Promise.all([
        j("/api/v1/periods?type=COV"),
        j("/api/v1/operators"),
        j("/api/v1/technologies"),
        j("/api/v1/geo?kind=qosCampaigns"),
      ]);
      const patch = {};

      // Campagnes d'audit QoS (déduites des fichiers de mesures présents).
      if (Array.isArray(qc) && qc.length) {
        patch.qosCampaigns = qc;
        if (!qc.includes(get().qosCampaign)) patch.qosCampaign = qc[0];
      }

      if (pr?.success && pr.data?.length) {
        patch.periods = pr.data.map((p) => ({ date: p.date, label: p.label }));
        const cur = get().periodDate;
        if (!patch.periods.some((p) => p.date === cur)) {
          // On conserve si possible le référentiel choisi, sinon période la plus récente.
          patch.periodDate =
            pickPeriodForRgph(patch.periods, get().rgphCode, null) ?? patch.periods[0].date;
        }
        // Le référentiel suit toujours la période finalement retenue.
        patch.rgphCode = rgphCodeFor(patch.periodDate ?? cur);
      }

      if (opr?.success && opr.data?.length) {
        const cfgColor = Object.fromEntries(OPERATORS.map((o) => [o.code, o.color]));
        const cfgKm = Object.fromEntries(OPERATORS.map((o) => [o.code, o.fiberKm]));
        patch.operatorList = opr.data.map((o) => ({
          code: o.key, // MOOV | MTN | ORANGE
          name: OP_NAME[o.key] ?? o.name,
          color: cfgColor[o.key] ?? o.color, // couleur cohérente avec les icônes carte
          fiberKm: cfgKm[o.key],
          description: o.description,
          // Logo administré en base et nature du réseau (fixe / mobile / hybride).
          imagePath: o.imagePath,
          network: o.network,
        }));
      }

      if (tr?.success && tr.data?.length) {
        const cfgColor = Object.fromEntries(TECHNOLOGIES.map((t) => [t.code, t.color]));
        patch.technologyList = tr.data.map((t) => ({
          code: t.code,
          name: t.name,
          color: cfgColor[t.code],
          desc: t.description,
        }));
      }

      if (Object.keys(patch).length) set(patch);
    } catch {
      /* garde les valeurs de config par défaut */
    }
  },

  /** Chargement de données carto (compteur de requêtes en cours) - bloque la carte. */
  mapLoading: false,
  loadingCount: 0,
  beginLoading: () => set((s) => ({ loadingCount: s.loadingCount + 1, mapLoading: true })),
  endLoading: () =>
    set((s) => {
      const loadingCount = Math.max(0, s.loadingCount - 1);
      return { loadingCount, mapLoading: loadingCount > 0 };
    }),

  /** Panneaux d'UI */
  sidebarOpen: true,
  statsOpen: false,
  legendOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleStats: () => set((s) => ({ statsOpen: !s.statsOpen })),
  setLegendOpen: (open) => set({ legendOpen: open }),

  /** Outil actif : null | influence | route | timelapse | assistant | report | compare */
  activeTool: null,
  setActiveTool: (tool) => set((s) => ({ activeTool: s.activeTool === tool ? null : tool })),

  /** Modal de requête vocale (transcription) */
  voiceOpen: false,
  setVoiceOpen: (voiceOpen) => set({ voiceOpen }),

  /** Modal « Données & signalements » (accès rapide aux services) */
  dataHubOpen: false,
  setDataHubOpen: (dataHubOpen) => set({ dataHubOpen }),

  /** Bulletin d'information consulté (modal dédié, au-dessus du hub) */
  newsItem: null,
  setNewsItem: (newsItem) => set({ newsItem }),

  /** Aperçu avant export : { kind|domain, title, custom?, service?, campaign? } */
  exportRequest: null,
  setExportRequest: (exportRequest) => set({ exportRequest }),

  /** Thème clair / sombre */
  theme: "light",
  toggleTheme: () => {
    const theme = get().theme === "light" ? "dark" : "light";
    if (typeof document !== "undefined") document.documentElement.classList.toggle("dark", theme === "dark");
    set({ theme });
  },

  /** Vue 3D */
  is3D: false,
  toggle3D: () => {
    const is3D = !get().is3D;
    const map = get().map;
    if (map) map.easeTo({ pitch: is3D ? 62 : 0, duration: 800 });
    set({ is3D });
  },

  /** Filtres de couverture (pilotent la choroplèthe) */
  operators: ["MOOV", "MTN", "ORANGE"],
  technologies: ["2G", "3G", "4G"],
  showWhiteZones: false,
  showDistricts: true, // master global (permalien/export)
  // Choroplèthe de couverture : UN seul niveau administratif actif à la fois, visible à tous les zooms.
  coverageLevel: "district", // district | region | department | subPrefecture
  setCoverageLevel: (key) => set({ coverageLevel: key }),
  /**
   * Indicateur lu par la choroplèthe : part des localités couvertes ou part
   * de la population couverte. Le découpage, les opérateurs et les
   * technologies restent communs aux deux vues.
   */
  coverageMetric: DEFAULT_METRIC, // locality | population
  // Changer d'indicateur invalide la fiche ouverte : ses chiffres portaient
  // sur l'autre lecture.
  setCoverageMetric: (coverageMetric) => set({ coverageMetric, selectedEntity: null }),
  toggleOperator: (op) =>
    set((s) => ({
      operators: s.operators.includes(op) ? s.operators.filter((o) => o !== op) : [...s.operators, op],
    })),
  toggleTechnology: (tech) =>
    set((s) => ({
      technologies: s.technologies.includes(tech) ? s.technologies.filter((t) => t !== tech) : [...s.technologies, tech],
    })),
  setFlag: (key, value) => set({ [key]: value }),

  /** Contrôles détaillés du panneau (repris de ClientSidebar V2) */
  controls: {
    // Sections principales
    network: true,
    showInfra: false,
    showQoS: false,
    // Couverture globale
    globalCov: true,
    showLocality: false,
    showCovLocalities: true,
    showNoCovLocalities: false,
    operatorCov: false,
    statCountry: false,
    // Infrastructures - fibres optiques
    showInfraRNHD: true,
    showFiberMOOV: false,
    showFiberMTN: false,
    showFiberORANGE: false,
    showFiberAnsut: false,
    showFiberAwale: false,
    // Autres infrastructures
    present: false,
    highway: false,
    nationalRoad: false,
    track: false,
    railway: false,
    adminLimit: true,
    showInfraPtsCom: false,
    // Qualité de service
    qosOperator: false,
    showFieldLevel: false, // localités retenues dans l'échantillon d'audit
    showQosOperator: false,
    showServiceBase: false,
    showVoiceService: false,
    showSmsService: false,
    showDataService: false,
    qosConnexService: false,
    qosFieldLevel: false,
    statAudit: false,
  },
  setControl: (key, value) => set((s) => ({ controls: { ...s.controls, [key]: value } })),
  toggleControl: (key) => set((s) => ({ controls: { ...s.controls, [key]: !s.controls[key] } })),

  /**
   * Bascule entre les deux domaines exclusifs du panneau - couverture réseau
   * et qualité de service. Les deux jeux de couches ne se lisent pas ensemble
   * sur la carte : activer l'un remet l'autre à zéro et replie sa section.
   */
  setDomain: (domain) =>
    set((s) =>
      domain === "qos"
        ? {
            controls: { ...s.controls, ...COVERAGE_OFF, ...QOS_ON },
            // Couches de couverture pilotées hors `controls`.
            showWhiteZones: false,
            mapOperators: [],
            coverageLevel: null,
          }
        : {
            controls: { ...s.controls, ...QOS_OFF, ...COVERAGE_ON },
            qosOperators: [],
            coverageLevel: "district",
            technologies: TECHNOLOGIES.map((t) => t.code),
          },
    ),

  /** Opérateurs affichés sur la carte en marqueurs (section Couverture par opérateur) */
  mapOperators: [],
  toggleMapOperator: (op) =>
    set((s) => ({
      mapOperators: s.mapOperators.includes(op) ? s.mapOperators.filter((o) => o !== op) : [...s.mapOperators, op],
    })),

  /** Technologies sélectionnées PAR opérateur (indépendantes les unes des autres) */
  operatorTechs: {
    MOOV: ["2G", "3G", "4G"],
    MTN: ["2G", "3G", "4G"],
    ORANGE: ["2G", "3G", "4G"],
  },
  toggleOperatorTech: (op, tech) =>
    set((s) => {
      const cur = s.operatorTechs[op] ?? [];
      return {
        operatorTechs: {
          ...s.operatorTechs,
          [op]: cur.includes(tech) ? cur.filter((t) => t !== tech) : [...cur, tech],
        },
      };
    }),

  /** Campagnes d'audit de qualité de service (« Campagne-1 2025 »…) */
  qosCampaigns: [],
  qosCampaign: null,
  setQosCampaign: (qosCampaign) => set({ qosCampaign, selectedQos: null }),

  /** Localité auditée sélectionnée sur la carte → fiche de résultats QoS */
  selectedQos: null,
  setSelectedQos: (selectedQos) => set({ selectedQos }),

  /** Opérateurs QoS sélectionnés (section Qualité de service) */
  qosOperators: [],
  toggleQosOperator: (op) =>
    set((s) => ({
      qosOperators: s.qosOperators.includes(op) ? s.qosOperators.filter((o) => o !== op) : [...s.qosOperators, op],
    })),

  /** Limites administratives affichées (couches lignes) */
  adminLimits: { district: false, region: false, department: false, subPrefecture: false },
  setAdminLimit: (level, value) => set((s) => ({ adminLimits: { ...s.adminLimits, [level]: value } })),

  /** Période semestrielle + style de carte */
  periodDate: PERIODS[0].date,
  /**
   * Référentiel de population piloté depuis la barre latérale. Il reste
   * toujours cohérent avec la période affichée : changer l'un ajuste l'autre
   * via la règle centralisée de `lib/rgph`.
   */
  rgphCode: rgphCodeFor(PERIODS[0].date),
  // Changer de période efface l'entité sélectionnée (ses stats étaient figées sur l'ancienne période).
  setPeriod: (date) => set({ periodDate: date, rgphCode: rgphCodeFor(date), selectedEntity: null }),
  /**
   * Changement de référentiel : la période courante est conservée si elle
   * appartient au recensement choisi, sinon on bascule sur la plus récente qui
   * en relève. Sans aucune période publiée pour ce référentiel, la sélection
   * est ignorée (l'option est désactivée dans l'interface).
   */
  setRgph: (code) =>
    set((s) => {
      const date = pickPeriodForRgph(s.periods, code, s.periodDate);
      if (!date) return {};
      if (date === s.periodDate) return { rgphCode: code };
      return { rgphCode: code, periodDate: date, selectedEntity: null };
    }),
  mapStyle: "streets",
  setMapStyle: (mapStyle) => set({ mapStyle }),

  /** Lecture time-lapse */
  isPlaying: false,
  setPlaying: (isPlaying) => set({ isPlaying }),

  /** District survolé (tooltip) */
  activeDistrict: null,
  setActiveDistrict: (activeDistrict) => set({ activeDistrict }),

  /** Entité cliquée (fill) → statistiques affichées dans StatsPanel. */
  selectedEntity: null, // { name, level, props }
  setSelectedEntity: (selectedEntity) =>
    set((s) => ({ selectedEntity, statsOpen: selectedEntity ? true : s.statsOpen })),

  /** Recherche d'entité */
  search: "",
  setSearch: (search) => set({ search }),
  flyTo: (entity) => {
    const map = get().map;
    if (map && entity) {
      const zoom = entity.zoom ?? (entity.type === "Ville" ? 10 : 7.4);
      map.flyTo({ center: [entity.lng, entity.lat], zoom, duration: 1400, essential: true });
    }
  },

  /** Popup de statistiques d'une entité (résultat de recherche) : { name, levelLabel, stats } */
  statsPopup: null,
  setStatsPopup: (statsPopup) => set({ statsPopup }),

  /** Signalements citoyens (persistés en base) */
  reports: [],
  addReport: (report) => set((s) => ({ reports: [...s.reports, report] })),
  loadReports: async () => {
    try {
      const r = await fetch("/api/v1/reports").then((x) => x.json());
      if (r?.success) set({ reports: r.data });
    } catch {
      /* ignore */
    }
  },
  submitReport: async (report) => {
    try {
      const r = await fetch("/api/v1/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(report),
      }).then((x) => x.json());
      if (r?.success) {
        set((s) => ({ reports: [...s.reports, r.data] }));
        return { ok: true };
      }
      return { ok: false, error: r?.error?.message };
    } catch {
      return { ok: false, error: "Envoi impossible." };
    }
  },

  /** Authentification */
  user: null,
  authOpen: false,
  setAuthOpen: (authOpen) => set({ authOpen }),
  loadSession: async () => {
    try {
      const r = await fetch("/api/v1/auth/me").then((x) => x.json());
      if (r?.success) set({ user: r.data.user });
    } catch {
      /* ignore */
    }
  },
  login: async (email, password) => {
    const r = await fetch("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }).then((x) => x.json());
    if (r?.success) {
      set({ user: r.data.user, authOpen: false });
      return { ok: true, user: r.data.user };
    }
    return { ok: false, error: r?.error?.message || "Connexion impossible." };
  },
  register: async (payload) => {
    const r = await fetch("/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then((x) => x.json());
    if (r?.success) {
      set({ user: r.data.user, authOpen: false });
      return { ok: true };
    }
    return { ok: false, error: r?.error?.message || "Inscription impossible." };
  },
  logout: async () => {
    try {
      await fetch("/api/v1/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    set({ user: null });
  },

  /** Menu Partage / Export */
  shareOpen: false,
  setShareOpen: (shareOpen) => set({ shareOpen }),

  /** Restaure des filtres depuis un permalien */
  applyState: (partial) => set(partial),
}));
