"use client";

import { useCallback, useEffect, useState } from "react";
import { Inbox, MapPin } from "lucide-react";
import { api } from "@/lib/api-client";
import { PageHead, Spinner, EmptyState, StatusBadge, Badge } from "./ui";
import { SortHeader, useTableSort } from "@/components/ui/kit";
import s from "./dashboard.module.css";

const FILTERS = [
  { value: "ALL", label: "Tous" },
  { value: "PENDING", label: "En attente" },
  { value: "IN_REVIEW", label: "En cours" },
  { value: "RESOLVED", label: "Résolus" },
  { value: "REJECTED", label: "Rejetés" },
];
const STATUS_OPTS = [
  { value: "PENDING", label: "En attente" },
  { value: "IN_REVIEW", label: "En cours" },
  { value: "RESOLVED", label: "Résolu" },
  { value: "REJECTED", label: "Rejeté" },
];

function fmtDate(d) {
  try {
    return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}

export default function ReportsManager({ canEdit = true }) {
  const [rows, setRows] = useState(null);
  const [filter, setFilter] = useState("ALL");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(null);

  const load = useCallback(async (f) => {
    setErr("");
    try {
      setRows(await api(`/api/v1/admin/reports?status=${f}`));
    } catch (e) {
      setErr(e.message);
      setRows([]);
    }
  }, []);

  useEffect(() => {
    load(filter);
  }, [filter, load]);

  async function changeStatus(code, status) {
    setBusy(code);
    try {
      await api(`/api/v1/admin/reports/${code}`, { method: "PATCH", body: { status } });
      await load(filter);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  }

  // Le tri porte sur la donnée brute (date ISO, coordonnées, contact réel).
  const { rows: sortedRows, sort, toggleSort } = useTableSort(rows, {
    accessor: (r, key) =>
      key === "location" ? r.locality ?? (r.lat != null ? `${r.lat},${r.lng}` : null)
      : key === "contact" ? r.email || r.phone
      : r[key],
    initial: { key: "createdAt", dir: "desc" },
  });

  return (
    <div>
      <PageHead title="Signalements citoyens" subtitle="Déclarations de problèmes réseau géolocalisées." />

      <div className={s.toolbar}>
        {FILTERS.map((f) => (
          <button
            key={f.value}
            className={`${s.btn} ${s.btnSm} ${filter === f.value ? s.btnPrimary : ""}`}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {err && <div className={s.formError}>{err}</div>}

      {rows === null ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <div className={s.tableWrap}>
          <EmptyState icon={Inbox}>Aucun signalement pour ce filtre.</EmptyState>
        </div>
      ) : (
        <div className={s.tableWrap}>
          <div className={s.tableScroll}>
            <table className={s.table}>
              <thead>
                <tr>
                  {[
                    { key: "createdAt", label: "Date" },
                    { key: "categoryLabel", label: "Catégorie" },
                    { key: "location", label: "Localisation" },
                    { key: "comment", label: "Commentaire" },
                    { key: "contact", label: "Contact" },
                    { key: "status", label: "Statut" },
                  ].map((c) => (
                    <SortHeader key={c.key} label={c.label} sortKey={c.key} sort={sort} onSort={toggleSort} />
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((r) => (
                  <tr key={r.code}>
                    <td className={s.cellMuted}>{fmtDate(r.createdAt)}</td>
                    <td>
                      <Badge tone="blue">{r.categoryLabel}</Badge>
                    </td>
                    <td className={s.cellMuted}>
                      {r.locality ? (
                        r.locality
                      ) : r.lat != null ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <MapPin size={13} /> {r.lat.toFixed(3)}, {r.lng.toFixed(3)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td style={{ maxWidth: 260 }}>{r.comment || "—"}</td>
                    <td className={s.cellMuted}>{r.email || r.phone || "—"}</td>
                    <td>
                      {canEdit ? (
                        <select
                          className={s.select}
                          style={{ minWidth: 130, padding: "0.35rem 0.5rem" }}
                          value={r.status}
                          disabled={busy === r.code}
                          onChange={(e) => changeStatus(r.code, e.target.value)}
                        >
                          {STATUS_OPTS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <StatusBadge status={r.status} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
