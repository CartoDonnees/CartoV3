"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, Upload, Loader2, CheckCircle2, Download, Save, FileSpreadsheet } from "lucide-react";
import { api } from "@/lib/api-client";
import { useMapStore } from "@/stores/map-store";
import { PageHead, Card, Spinner, Badge } from "@/components/dashboard/ui";
import { SortHeader, useTableSort } from "@/components/ui/kit";
import Modal from "@/components/dashboard/Modal";
import s from "@/components/dashboard/dashboard.module.css";

const TECHS = ["2G", "3G", "4G"];
const OPS = ["ORANGE", "MTN", "MOOV"];
const FLAGS = [
  { key: "coverage", prefix: "cov", label: "Couverture" },
  { key: "present", prefix: "pres", label: "Station" },
  { key: "forecast", prefix: "prev", label: "Prévision" },
];

/**
 * Déclaration des données de couverture (module « Données de couverture » V2).
 * `operator` restreint la saisie au réseau de l'opérateur connecté ;
 * un administrateur déclare pour l'ensemble des opérateurs.
 */
export function CoverageDeclaration({ operator = null }) {
  const periods = useMapStore((st) => st.periods);
  const loadRefData = useMapStore((st) => st.loadRefData);

  const [periodCode, setPeriodCode] = useState("");
  const [periodList, setPeriodList] = useState([]);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [savingCode, setSavingCode] = useState(null);
  const [importOpen, setImportOpen] = useState(false);

  const ops = operator ? [operator] : OPS;

  useEffect(() => { loadRefData(); }, [loadRefData]);

  // Périodes de couverture (avec leur code, nécessaire aux appels).
  useEffect(() => {
    let alive = true;
    api("/api/v1/admin/periods")
      .then((d) => {
        if (!alive) return;
        const cov = d.filter((p) => p.type === "COVERAGE");
        setPeriodList(cov);
        setPeriodCode((c) => c || cov[0]?.code || "");
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const load = useCallback(async () => {
    if (!periodCode) return;
    setError("");
    setRows(null);
    try {
      const d = await api(`/api/v1/coverage-data?period=${periodCode}&q=${encodeURIComponent(query)}&limit=50`);
      setRows(d.data);
    } catch (e) {
      setError(e.message);
      setRows([]);
    }
  }, [periodCode, query]);

  useEffect(() => {
    const t = setTimeout(load, query ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, query]);

  /** Valeur courante d'un drapeau pour une localité. */
  const flagOf = (row, op, tech, key) =>
    !!row.cells.find((c) => c.operator === op && c.technology === tech)?.[key];

  /** Bascule locale (l'enregistrement se fait ligne par ligne). */
  const toggle = (rowCode, op, tech, key) => {
    setRows((list) =>
      list.map((r) => {
        if (r.code !== rowCode) return r;
        const cells = [...r.cells];
        const i = cells.findIndex((c) => c.operator === op && c.technology === tech);
        if (i === -1) cells.push({ operator: op, technology: tech, coverage: false, present: false, forecast: false, [key]: true });
        else cells[i] = { ...cells[i], [key]: !cells[i][key] };
        return { ...r, cells, dirty: true };
      }),
    );
  };

  /** Enregistre la ligne pour chaque opérateur déclarable. */
  const save = async (row) => {
    setSavingCode(row.code);
    setError("");
    try {
      for (const op of ops) {
        const values = Object.fromEntries(
          TECHS.map((t) => [t, {
            coverage: flagOf(row, op, t, "coverage"),
            present: flagOf(row, op, t, "present"),
            forecast: flagOf(row, op, t, "forecast"),
          }]),
        );
        await api("/api/v1/coverage-data", {
          method: "PUT",
          body: { periodCode, localityCode: row.code, operator: op, values },
        });
      }
      setRows((list) => list.map((r) => (r.code === row.code ? { ...r, dirty: false, declared: true } : r)));
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingCode(null);
    }
  };

  // « État » se trie du plus urgent au plus abouti : modifié → non déclaré → déclaré.
  const { rows: sortedRows, sort, toggleSort } = useTableSort(rows, {
    accessor: (r, key) => (key === "state" ? (r.dirty ? 0 : r.declared ? 2 : 1) : r[key]),
  });

  return (
    <div>
      <PageHead
        title="Données de couverture"
        subtitle={
          operator
            ? `Déclaration de la couverture du réseau ${operator}.`
            : "Déclaration de la couverture, tous opérateurs."
        }
      >
        <button className={`${s.btn} ${s.btnPrimary}`} onClick={() => setImportOpen(true)}>
          <Upload size={16} /> Importer un fichier Excel
        </button>
      </PageHead>

      <div className={s.toolbar}>
        <select className={s.select} style={{ maxWidth: 220 }} value={periodCode} onChange={(e) => setPeriodCode(e.target.value)}>
          {periodList.map((p) => <option key={p.code} value={p.code}>{p.title}</option>)}
        </select>
        <label className={s.search}>
          <Search size={16} color="var(--muted)" />
          <input placeholder="Rechercher une localité (nom ou code)…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>

      {error && <div className={s.formError}>{error}</div>}

      {rows === null ? (
        <Spinner />
      ) : (
        <div className={s.tableWrap}>
          <div className={s.tableScroll}>
            <table className={s.table}>
              <thead>
                <tr>
                  <SortHeader label="Localité" sortKey="name" sort={sort} onSort={toggleSort} />
                  <SortHeader label="Sous-préfecture" sortKey="subPrefecture" sort={sort} onSort={toggleSort} />
                  {ops.map((op) => TECHS.map((t) => <th key={`${op}${t}`} style={{ textAlign: "center" }}>{op.slice(0, 3)} {t}</th>))}
                  <SortHeader label="État" sortKey="state" sort={sort} onSort={toggleSort} />
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((r) => (
                  <tr key={r.code}>
                    <td className={s.cellStrong}>
                      {r.name}
                      <span className={s.cellMuted} style={{ fontWeight: 400 }}> · {r.code}</span>
                    </td>
                    <td className={s.cellMuted}>{r.subPrefecture}</td>
                    {ops.map((op) =>
                      TECHS.map((t) => (
                        <td key={`${op}${t}`} style={{ textAlign: "center" }}>
                          {FLAGS.map((f) => (
                            <button
                              key={f.key}
                              onClick={() => toggle(r.code, op, t, f.key)}
                              title={`${f.label} — ${op} ${t}`}
                              style={{
                                width: 16, height: 16, marginRight: 2, borderRadius: 4, cursor: "pointer",
                                border: "1px solid var(--border)",
                                background: flagOf(r, op, t, f.key)
                                  ? f.key === "coverage" ? "var(--artci-green)" : f.key === "present" ? "#3b82f6" : "var(--artci-orange)"
                                  : "var(--surface)",
                              }}
                            />
                          ))}
                        </td>
                      )),
                    )}
                    <td>
                      {r.dirty ? <Badge tone="amber">Modifié</Badge>
                        : r.declared ? <Badge tone="green">Déclaré</Badge>
                        : <Badge tone="gray">Non déclaré</Badge>}
                    </td>
                    <td>
                      <div className={s.rowActions}>
                        <button className={`${s.btn} ${s.btnSm}`} onClick={() => save(r)} disabled={savingCode === r.code}>
                          {savingCode === r.code ? <Loader2 size={13} /> : <Save size={13} />} Enregistrer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={s.pageSub} style={{ padding: "0.6rem 1rem", margin: 0 }}>
            Trois cases par couple opérateur/technologie :
            <b style={{ color: "var(--artci-green)" }}> couverture</b>,
            <b style={{ color: "#3b82f6" }}> station présente</b>,
            <b style={{ color: "var(--artci-orange)" }}> prévision</b>.
            Recherchez une localité pour affiner la liste (50 lignes affichées).
          </p>
        </div>
      )}

      {importOpen && (
        <ExcelImport periodCode={periodCode} periods={periodList} operator={operator} onClose={() => { setImportOpen(false); load(); }} />
      )}
    </div>
  );
}

/* ------------------------- Import de fichier Excel ---------------------- */

function ExcelImport({ periodCode, periods, operator, onClose }) {
  const [file, setFile] = useState(null);
  const [period, setPeriod] = useState(periodCode);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  const ops = operator ? [operator] : OPS;

  /** Modèle de fichier : une colonne par drapeau et par couple opérateur/technologie. */
  const downloadTemplate = async () => {
    const ExcelJS = (await import("exceljs")).default ?? (await import("exceljs"));
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Couverture");
    const cols = ["code", "localite"];
    for (const op of ops) for (const t of TECHS) for (const f of FLAGS) cols.push(`${f.prefix}${t}${op}`);
    ws.columns = cols.map((c) => ({ header: c, key: c, width: Math.max(12, c.length + 2) }));
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF159A4E" } };
    ws.addRow({ code: "C0001", localite: "ABADJI-BIMBRESSO" });
    const buf = await wb.xlsx.writeBuffer();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    a.download = "modele_declaration_couverture.xlsx";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  /** Lit le classeur côté navigateur puis envoie les lignes à l'API. */
  const runImport = async () => {
    if (!file) return;
    setBusy(true); setError(""); setResult(null);
    try {
      const ExcelJS = (await import("exceljs")).default ?? (await import("exceljs"));
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const ws = wb.worksheets[0];
      if (!ws) throw new Error("Le classeur ne contient aucune feuille.");

      const headers = [];
      ws.getRow(1).eachCell((cell, col) => { headers[col] = String(cell.value ?? "").trim(); });

      const rows = [];
      ws.eachRow((row, i) => {
        if (i === 1) return;
        const obj = {};
        row.eachCell((cell, col) => {
          const h = headers[col];
          if (h) obj[h] = cell.value?.result ?? cell.value;
        });
        if (obj.code) rows.push(obj);
      });
      if (!rows.length) throw new Error("Aucune ligne exploitable (colonne « code » requise).");

      setResult(await api("/api/v1/coverage-data/import", { method: "POST", body: { periodCode: period, rows } }));
    } catch (e) {
      setError(e.message || "Import impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Importer les déclarations (Excel)"
      onClose={() => !busy && onClose()}
      wide
      footer={
        <>
          <button className={s.btn} onClick={onClose} disabled={busy}>Fermer</button>
          <button className={`${s.btn} ${s.btnPrimary}`} onClick={runImport} disabled={busy || !file}>
            {busy ? <Loader2 size={15} /> : <Upload size={15} />} {busy ? "Import en cours…" : "Importer"}
          </button>
        </>
      }
    >
      <p className={s.modalText}>
        Le fichier doit comporter une colonne <b>code</b> (code officiel de la localité, ex. C0001)
        et, pour chaque couple opérateur/technologie, les colonnes
        <b> cov…</b> (couverture), <b>pres…</b> (station) et <b>prev…</b> (prévision) —
        par exemple <code>cov4GORANGE</code>. Les valeurs acceptées sont 1/0, oui/non, vrai/faux.
      </p>

      <div className={s.formGrid} style={{ marginTop: "0.9rem" }}>
        <div className={s.field}>
          <span className={s.label}>Période</span>
          <select className={s.select} value={period} onChange={(e) => setPeriod(e.target.value)}>
            {periods.map((p) => <option key={p.code} value={p.code}>{p.title}</option>)}
          </select>
        </div>
        <div className={s.field}>
          <span className={s.label}>Fichier</span>
          <input ref={inputRef} type="file" accept=".xlsx,.xlsm" className={s.input}
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); }} />
        </div>
      </div>

      <button className={s.btn} style={{ marginTop: "0.8rem" }} onClick={downloadTemplate}>
        <Download size={14} /> Télécharger le modèle
      </button>

      {error && <div className={s.formError} style={{ marginTop: "0.9rem" }}>{error}</div>}

      {result && (
        <div style={{ marginTop: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontWeight: 700, color: "var(--artci-green-700)" }}>
            <CheckCircle2 size={16} /> Import terminé — {result.period}
          </div>
          <ul style={{ marginTop: "0.5rem", fontSize: "0.85rem", lineHeight: 1.7 }}>
            <li>Lignes lues : <b>{result.rows}</b></li>
            <li>Localités déclarées : <b>{result.summaries}</b></li>
            <li>Valeurs enregistrées : <b>{result.cells}</b></li>
            <li>Opérateurs concernés : <b>{result.scope.join(", ")}</b></li>
            {result.unknownCount > 0 && (
              <li style={{ color: "var(--uncovered)" }}>
                Codes inconnus ignorés : <b>{result.unknownCount}</b> ({result.unknownCodes.join(", ")}…)
              </li>
            )}
          </ul>
        </div>
      )}
    </Modal>
  );
}
