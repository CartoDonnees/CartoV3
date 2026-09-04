"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Loader2, CheckCircle2 } from "lucide-react";
import ResourceManager from "@/components/dashboard/ResourceManager";
import { PageHead, Card } from "@/components/dashboard/ui";
import { api } from "@/lib/api-client";
import { useMapStore } from "@/stores/map-store";
import s from "@/components/dashboard/dashboard.module.css";

/** Niveaux du découpage administratif (module « limites cartographiques » V2). */
const LEVELS = [
  {
    key: "districts", label: "Districts", singular: "district", endpoint: "/api/v1/admin/districts",
    parent: null,
  },
  {
    key: "regions", label: "Régions", singular: "région", endpoint: "/api/v1/admin/regions",
    parent: { label: "District", endpoint: "/api/v1/admin/districts" },
  },
  {
    key: "departments", label: "Départements", singular: "département", endpoint: "/api/v1/admin/departments",
    parent: { label: "Région", endpoint: "/api/v1/admin/regions" },
  },
  {
    key: "subPrefectures", label: "Sous-préfectures", singular: "sous-préfecture", endpoint: "/api/v1/admin/sub-prefectures",
    parent: { label: "Département", endpoint: "/api/v1/admin/departments" },
  },
  {
    key: "localities", label: "Localités", singular: "localité", endpoint: "/api/v1/admin/localities",
    parent: { label: "Sous-préfecture", endpoint: "/api/v1/admin/sub-prefectures" }, locality: true,
  },
];

export default function ReferentielPage() {
  const [level, setLevel] = useState(LEVELS[0]);
  const periods = useMapStore((st) => st.periods);
  const loadRefData = useMapStore((st) => st.loadRefData);
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => { loadRefData(); }, [loadRefData]);
  useEffect(() => { if (!date && periods?.length) setDate(periods[0].date); }, [periods, date]);

  /** Importe le référentiel de la période depuis les fichiers cartographiques. */
  const runImport = async () => {
    setBusy(true); setError(""); setResult(null);
    try {
      const data = await api("/api/v1/admin/entities/import", { method: "POST", body: { date } });
      setResult(data);
      setReloadKey((k) => k + 1); // force le rechargement des listes
    } catch (e) {
      setError(e.message || "Import impossible.");
    } finally {
      setBusy(false);
    }
  };

  const cols = level.locality
    ? [
        { key: "name", label: "Nom", strong: true },
        { key: "parentName", label: "Sous-préfecture", muted: true },
        { key: "population", label: "Population", render: (r) => (r.population ?? 0).toLocaleString("fr-FR") },
        { key: "status", label: "Statut" },
      ]
    : [
        { key: "name", label: "Nom", strong: true },
        ...(level.parent ? [{ key: "parentName", label: level.parent.label, muted: true }] : []),
        { key: "year", label: "Année" },
      ];

  const fields = [
    { name: "name", label: "Nom", required: true, full: true },
    ...(level.parent
      ? [{
          name: "parentCode", label: level.parent.label, type: "select", required: true,
          remote: { endpoint: level.parent.endpoint, valueKey: "code", labelKey: "name" },
        }]
      : []),
    ...(level.locality
      ? [
          { name: "population", label: "Population", type: "number" },
          { name: "status", label: "Statut", type: "select", options: [
            { value: "ACTIVE", label: "Actif" }, { value: "INACTIVE", label: "Inactif" },
          ] },
        ]
      : [{ name: "year", label: "Année", type: "number" }]),
  ];

  return (
    <div>
      <PageHead
        title="Référentiel géographique"
        subtitle="Districts, régions, départements, sous-préfectures et localités."
      />

      {/* Synchronisation depuis les fichiers cartographiques */}
      <Card title="Synchronisation depuis les fichiers cartographiques" className={s.gridStats} style={{ marginBottom: "1rem" }}>
        <p className={s.pageSub} style={{ marginTop: 0 }}>
          Importe le découpage administratif de la période choisie. Les entités déjà
          présentes sont conservées ; seules les manquantes sont ajoutées. Les homonymes
          exacts sous un même parent (doublons de la source) sont comptabilisés à part.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", alignItems: "center", marginTop: "0.75rem" }}>
          <select className={s.select} style={{ maxWidth: 220 }} value={date} onChange={(e) => setDate(e.target.value)}>
            {(periods || []).map((p) => <option key={p.date} value={p.date}>{p.label}</option>)}
          </select>
          <button className={`${s.btn} ${s.btnPrimary}`} onClick={runImport} disabled={busy || !date}>
            {busy ? <Loader2 size={15} className={s.spin} /> : <RefreshCw size={15} />}
            {busy ? "Import en cours…" : "Synchroniser"}
          </button>
        </div>

        {error && <div className={s.formError} style={{ marginTop: "0.75rem" }}>{error}</div>}

        {result && (
          <div style={{ marginTop: "0.85rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.82rem", fontWeight: 700, color: "var(--artci-green-700)" }}>
              <CheckCircle2 size={15} /> Référentiel synchronisé - {result.date}
            </div>
            <div className={s.tableScroll} style={{ marginTop: "0.5rem" }}>
              <table className={s.table}>
                <thead>
                  <tr><th>Niveau</th><th style={{ textAlign: "right" }}>Ajoutés</th><th style={{ textAlign: "right" }}>Homonymes ignorés</th><th style={{ textAlign: "right" }}>Total</th></tr>
                </thead>
                <tbody>
                  {result.levels.map((l) => (
                    <tr key={l.label}>
                      <td className={s.cellStrong}>{l.label}</td>
                      <td style={{ textAlign: "right" }}>{l.created.toLocaleString("fr-FR")}</td>
                      <td style={{ textAlign: "right" }} className={l.duplicates ? s.cellStrong : s.cellMuted}>
                        {l.duplicates ? l.duplicates.toLocaleString("fr-FR") : "-"}
                      </td>
                      <td style={{ textAlign: "right" }}>{l.total.toLocaleString("fr-FR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>

      {/* Sélecteur de niveau */}
      <div className={s.toolbar}>
        {LEVELS.map((l) => (
          <button
            key={l.key}
            onClick={() => setLevel(l)}
            className={`${s.btn} ${s.btnSm} ${level.key === l.key ? s.btnPrimary : ""}`}
          >
            {l.label}
          </button>
        ))}
      </div>

      <ResourceManager
        key={`${level.key}-${reloadKey}`}
        title={level.label}
        subtitle={
          level.locality
            ? "Utilisez la recherche pour retrouver une localité (liste bornée aux 300 premières)."
            : `Découpage administratif - ${level.label.toLowerCase()}.`
        }
        endpoint={level.endpoint}
        singular={level.singular}
        createLabel={`Ajouter - ${level.singular}`}
        toForm={(r) => ({
          name: r.name,
          parentCode: r.parentCode || "",
          year: r.year ?? "",
          population: r.population ?? "",
          status: r.status || "ACTIVE",
        })}
        columns={cols}
        fields={fields}
      />
    </div>
  );
}
