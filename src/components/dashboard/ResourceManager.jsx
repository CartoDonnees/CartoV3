"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, Pencil, Trash2, Inbox } from "lucide-react";
import { api } from "@/lib/api-client";
import Modal from "./Modal";
import { PageHead, Spinner, EmptyState } from "./ui";
import { SortHeader, useTableSort } from "@/components/ui/kit";
import s from "./dashboard.module.css";

/**
 * Gestionnaire CRUD générique piloté par configuration.
 * Voir les pages admin pour des exemples de `columns` et `fields`.
 */
export default function ResourceManager({
  title,
  subtitle,
  endpoint,
  columns,
  fields,
  searchable = true,
  createLabel = "Ajouter",
  singular = "élément",
  toForm,
  defaultForm = {},
  wideModal = false,
  readOnly = false,   // journaux : consultation seule (pas de création ni d'édition)
  headerExtra = null, // action complémentaire dans l'en-tête
}) {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");
  const [listErr, setListErr] = useState("");
  const [remote, setRemote] = useState({});
  const [editing, setEditing] = useState(null); // {mode, row}
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [deleting, setDeleting] = useState(null);
  const [delBusy, setDelBusy] = useState(false);

  const load = useCallback(
    async (search) => {
      setListErr("");
      try {
        const url = search ? `${endpoint}?q=${encodeURIComponent(search)}` : endpoint;
        setRows(await api(url));
      } catch (e) {
        setListErr(e.message);
        setRows([]);
      }
    },
    [endpoint],
  );

  useEffect(() => {
    const t = setTimeout(() => load(q.trim()), q ? 300 : 0);
    return () => clearTimeout(t);
  }, [q, load]);

  // Options distantes (selects dynamiques)
  useEffect(() => {
    let alive = true;
    const remotes = fields.filter((f) => f.remote);
    if (!remotes.length) return;
    (async () => {
      const out = {};
      for (const f of remotes) {
        try {
          const data = await api(f.remote.endpoint);
          out[f.name] = data.map((d) => ({ value: d[f.remote.valueKey], label: d[f.remote.labelKey] }));
        } catch {
          out[f.name] = [];
        }
      }
      if (alive) setRemote(out);
    })();
    return () => {
      alive = false;
    };
  }, [fields]);

  const visibleFields = useMemo(
    () => (form ? fields.filter((f) => !f.showIf || f.showIf(form)) : fields),
    [fields, form],
  );

  function openCreate() {
    setForm({ ...defaultForm });
    setFormErr("");
    setEditing({ mode: "create" });
  }
  function openEdit(row) {
    setForm(toForm ? toForm(row) : { ...row });
    setFormErr("");
    setEditing({ mode: "edit", row });
  }
  function setField(name, value) {
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setFormErr("");
    try {
      const payload = {};
      for (const f of fields) {
        if (f.showIf && !f.showIf(form)) continue;
        payload[f.name] = form[f.name] ?? (f.type === "checkbox" ? false : "");
      }
      if (editing.mode === "create") {
        await api(endpoint, { method: "POST", body: payload });
      } else {
        await api(`${endpoint}/${editing.row.code}`, { method: "PATCH", body: payload });
      }
      setEditing(null);
      await load(q.trim());
    } catch (e2) {
      setFormErr(e2.message);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    setDelBusy(true);
    try {
      await api(`${endpoint}/${deleting.code}`, { method: "DELETE" });
      setDeleting(null);
      await load(q.trim());
    } catch (e) {
      setFormErr(e.message);
      setDeleting(null);
    } finally {
      setDelBusy(false);
    }
  }

  const optionsFor = (f) => f.options || remote[f.name] || [];

  // Tri des lignes : par défaut la valeur brute du champ, sinon `sortValue`.
  const sortAccessor = useCallback(
    (row, key) => {
      const col = columns.find((c) => c.key === key);
      return col?.sortValue ? col.sortValue(row) : row?.[key];
    },
    [columns],
  );
  const { rows: sortedRows, sort, toggleSort } = useTableSort(rows, { accessor: sortAccessor });

  return (
    <div>
      <PageHead title={title} subtitle={subtitle}>
        {headerExtra}
        {!readOnly && (
          <button className={`${s.btn} ${s.btnPrimary}`} onClick={openCreate}>
            <Plus size={17} /> {createLabel}
          </button>
        )}
      </PageHead>

      {searchable && (
        <div className={s.toolbar}>
          <label className={s.search}>
            <Search size={16} color="var(--muted)" />
            <input placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
        </div>
      )}

      {rows === null ? (
        <Spinner />
      ) : listErr ? (
        <div className={s.formError}>{listErr}</div>
      ) : rows.length === 0 ? (
        <div className={s.tableWrap}>
          <EmptyState icon={Inbox}>Aucun {singular} pour l'instant.</EmptyState>
        </div>
      ) : (
        <div className={s.tableWrap}>
          <div className={s.tableScroll}>
            <table className={s.table}>
              <thead>
                <tr>
                  {columns.map((c) =>
                    c.sortable === false ? (
                      <th key={c.key}>{c.label}</th>
                    ) : (
                      <SortHeader key={c.key} label={c.label} sortKey={c.key} sort={sort} onSort={toggleSort} />
                    ),
                  )}
                  {!readOnly && <th style={{ textAlign: "right" }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row) => (
                  <tr key={row.code}>
                    {columns.map((c) => (
                      <td key={c.key} className={c.strong ? s.cellStrong : c.muted ? s.cellMuted : ""}>
                        {c.render ? c.render(row) : row[c.key] ?? "—"}
                      </td>
                    ))}
                    {!readOnly && (
                      <td>
                        <div className={s.rowActions}>
                          <button className={`${s.btn} ${s.btnSm}`} onClick={() => openEdit(row)}>
                            <Pencil size={14} /> Éditer
                          </button>
                          <button className={`${s.btn} ${s.btnSm} ${s.btnGhost}`} onClick={() => setDeleting(row)} aria-label="Supprimer">
                            <Trash2 size={15} color="var(--uncovered)" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && (
        <Modal
          title={`${editing.mode === "create" ? "Ajouter" : "Modifier"} — ${singular}`}
          onClose={() => !saving && setEditing(null)}
          wide={wideModal}
          footer={
            <>
              <button className={s.btn} onClick={() => setEditing(null)} disabled={saving}>
                Annuler
              </button>
              <button className={`${s.btn} ${s.btnPrimary}`} onClick={submit} disabled={saving}>
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </>
          }
        >
          <form onSubmit={submit}>
            {formErr && <div className={s.formError}>{formErr}</div>}
            <div className={s.formGrid}>
              {visibleFields.map((f) => (
                <Field key={f.name} field={f} value={form[f.name]} options={optionsFor(f)} onChange={(v) => setField(f.name, v)} mode={editing.mode} />
              ))}
            </div>
          </form>
        </Modal>
      )}

      {deleting && (
        <Modal
          title="Confirmer la suppression"
          onClose={() => !delBusy && setDeleting(null)}
          footer={
            <>
              <button className={s.btn} onClick={() => setDeleting(null)} disabled={delBusy}>
                Annuler
              </button>
              <button className={`${s.btn} ${s.btnDanger}`} onClick={confirmDelete} disabled={delBusy}>
                {delBusy ? "Suppression…" : "Supprimer"}
              </button>
            </>
          }
        >
          <p className={s.modalText}>
            Voulez-vous vraiment supprimer <strong>{deleting[columns[0].key] || `ce ${singular}`}</strong> ? Cette action est irréversible.
          </p>
        </Modal>
      )}
    </div>
  );
}

function Field({ field, value, options, onChange, mode }) {
  const { name, label, type = "text", required, placeholder, help, full, min, max } = field;
  const v = value ?? (type === "checkbox" ? false : "");
  const cls = `${s.field} ${full ? s.fieldFull : ""}`;
  const req = required && mode === "create";

  if (type === "checkbox") {
    return (
      <div className={`${cls} ${s.fieldFull}`}>
        <label className={s.checkRow}>
          <input type="checkbox" checked={!!v} onChange={(e) => onChange(e.target.checked)} />
          <span className={s.label}>{label}</span>
        </label>
        {help && <span className={s.statHint}>{help}</span>}
      </div>
    );
  }

  return (
    <div className={cls}>
      <label className={s.label}>
        {label} {req && <span className={s.req}>*</span>}
      </label>
      {type === "textarea" ? (
        <textarea className={s.textarea} value={v} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : type === "select" ? (
        <select className={s.select} value={v} onChange={(e) => onChange(e.target.value)}>
          <option value="">— Choisir —</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : type === "color" ? (
        <div className={s.swatchInput}>
          <input type="color" value={v || "#159a4e"} onChange={(e) => onChange(e.target.value)} />
          <input className={s.input} value={v} placeholder="#159a4e" onChange={(e) => onChange(e.target.value)} />
        </div>
      ) : (
        <input
          className={s.input}
          type={type}
          value={v}
          placeholder={placeholder}
          min={min}
          max={max}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {help && <span className={s.statHint}>{help}</span>}
    </div>
  );
}
