"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, Plus, Pencil, Trash2, ArrowRightLeft, CheckCircle2, XCircle, FileInput,
  Download, Upload, Eye, LogIn, LogOut, ShieldAlert, UserPlus, Search, RotateCcw,
  RefreshCw, History, Users, Lock, Loader2, X,
} from "lucide-react";
import { api } from "@/lib/api-client";
import {
  actionInfo, resourceInfo, moduleLabel, ACTIVITY_MODULES, ACTIVITY_STATUS, ROLE_LABELS,
  formatDateTime, formatTime, dayKey, dayHeading, initialsOf, describeUserAgent,
  fieldLabel, formatFieldValue, MASKED,
} from "@/lib/activity-format";
import Modal from "./Modal";
import { PageHead, Spinner, EmptyState, Badge, RoleBadge, StatCard } from "./ui";
import s from "./dashboard.module.css";

/**
 * « Activité de la plateforme » - journal chronologique des actions menées sur
 * la plateforme, rédigé pour un lecteur non technique.
 *
 * Lecture seule : aucune action de cette page ne modifie le journal.
 */

const PAGE_SIZE = 25;

/** Pictogramme de chaque type d'action (clés définies dans `activity-format`). */
const ACTION_ICONS = {
  create: Plus, update: Pencil, delete: Trash2, status: ArrowRightLeft, validate: CheckCircle2,
  reject: XCircle, import: FileInput, export: Download, upload: Upload, view: Eye,
  login: LogIn, logout: LogOut, denied: ShieldAlert, register: UserPlus, activity: Activity,
};

const TONE_COLOR = {
  green: "var(--artci-green)",
  blue: "#3b82f6",
  red: "var(--uncovered)",
  amber: "#f59e0b",
  gray: "#64748b",
};

const PERIODS = [
  { value: "all", label: "Toute la période" },
  { value: "today", label: "Aujourd'hui" },
  { value: "7d", label: "7 derniers jours" },
  { value: "30d", label: "30 derniers jours" },
  { value: "custom", label: "Période personnalisée" },
];

const EMPTY_FILTERS = { q: "", actor: "", action: "", module: "", status: "", period: "all", from: "", to: "" };

/** Bornes de dates d'un préréglage de période. */
function periodRange(filters) {
  const now = new Date();
  const ago = (days) => dayKey(new Date(now.getTime() - days * 86400000));
  switch (filters.period) {
    case "today": return { from: dayKey(now), to: "" };
    case "7d": return { from: ago(6), to: "" };
    case "30d": return { from: ago(29), to: "" };
    case "custom": return { from: filters.from, to: filters.to };
    default: return { from: "", to: "" };
  }
}

function queryString(filters, page) {
  const { from, to } = periodRange(filters);
  const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  for (const [k, v] of Object.entries({ q: filters.q.trim(), actor: filters.actor, action: filters.action, module: filters.module, status: filters.status, from, to })) {
    if (v) params.set(k, v);
  }
  return params.toString();
}

/** Appel API renvoyant aussi l'enveloppe `meta` (le client commun ne renvoie que `data`). */
async function fetchPage(url) {
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) throw new Error(json?.error?.message || `Erreur ${res.status}`);
  return { data: json.data, meta: json.meta };
}

export default function ActivityLog() {
  const [facets, setFacets] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [openCode, setOpenCode] = useState(null);
  const requestId = useRef(0);
  const searchTimer = useRef(null);

  /**
   * Charge une page. Une réponse arrivée après un changement de filtres est
   * ignorée : sans ce garde-fou, une requête lente pourrait réafficher des
   * résultats qui ne correspondent plus aux filtres visibles.
   */
  const load = useCallback(async (nextFilters, page = 1) => {
    const id = ++requestId.current;
    setLoading(true);
    setErr("");
    try {
      const { data, meta: m } = await fetchPage(`/api/v1/admin/activity?${queryString(nextFilters, page)}`);
      if (id !== requestId.current) return;
      setItems((prev) => (page === 1 || !prev ? data : [...prev, ...data]));
      setMeta(m);
    } catch (e) {
      if (id !== requestId.current) return;
      setErr(e.message);
      if (page === 1) setItems([]);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  const loadFacets = useCallback(async () => {
    try {
      setFacets(await api("/api/v1/admin/activity/facets"));
    } catch {
      setFacets({ actors: [], actions: [], resourceTypes: [], stats: null });
    }
  }, []);

  useEffect(() => {
    // Premier chargement différé d'un tour : l'état n'est pas modifié pendant
    // l'exécution de l'effet, et un double montage (mode strict) ne lance pas
    // deux fois les requêtes.
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      load(EMPTY_FILTERS, 1);
      loadFacets();
    });
    return () => {
      cancelled = true;
      clearTimeout(searchTimer.current);
    };
  }, [load, loadFacets]);

  /** Met à jour un filtre et relance la recherche depuis la première page. */
  const setFilter = (patch) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    load(next, 1);
  };

  const onSearch = (value) => {
    setSearch(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setFilter({ q: value }), 300);
  };

  const reset = () => {
    clearTimeout(searchTimer.current);
    setSearch("");
    setFilters(EMPTY_FILTERS);
    load(EMPTY_FILTERS, 1);
  };

  const refresh = () => {
    load(filters, 1);
    loadFacets();
  };

  const touched = JSON.stringify({ ...filters, q: search }) !== JSON.stringify(EMPTY_FILTERS);

  /* Regroupement par journée, dans l'ordre chronologique inverse reçu. */
  const days = useMemo(() => {
    const groups = [];
    for (const it of items ?? []) {
      const key = dayKey(it.createdAt);
      const last = groups[groups.length - 1];
      if (last?.key === key) last.items.push(it);
      else groups.push({ key, items: [it] });
    }
    return groups;
  }, [items]);

  const stats = facets?.stats;
  const shown = items?.length ?? 0;
  const total = meta?.total ?? 0;

  return (
    <div>
      <PageHead
        title="Activité de la plateforme"
        subtitle="Suivez les actions menées sur la plateforme : qui a fait quoi, sur quel élément et à quel moment."
      >
        <button className={s.btn} onClick={refresh} disabled={loading}>
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Actualiser
        </button>
      </PageHead>

      {stats && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Activity} label="Aujourd'hui" value={stats.today.toLocaleString("fr-FR")} hint="activités enregistrées" />
          <StatCard
            icon={ShieldAlert}
            label="Échecs (7 jours)"
            value={stats.failures7.toLocaleString("fr-FR")}
            hint="actions refusées ou connexions échouées"
            color={stats.failures7 ? "var(--uncovered)" : "#64748b"}
          />
          <StatCard icon={Users} label="Utilisateurs actifs" value={stats.active7.toLocaleString("fr-FR")} hint="sur les 7 derniers jours" color="#3b82f6" />
          <StatCard icon={History} label="Total enregistré" value={stats.total.toLocaleString("fr-FR")} hint="depuis la mise en service" color="#8b5cf6" />
        </div>
      )}

      {/* ------------------------------ Filtres ------------------------------ */}
      <div className="mb-4 rounded-2xl border border-border bg-surface p-3 shadow-sm">
        <div className="mb-2.5 flex flex-wrap items-center gap-2">
          <label className={`${s.search} min-w-[240px] flex-1`}>
            <Search size={16} color="var(--muted)" />
            <input
              placeholder="Rechercher un utilisateur, une action, un élément, un mot-clé…"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              aria-label="Rechercher dans le journal"
            />
            {search && (
              <button type="button" onClick={() => { onSearch(""); }} aria-label="Effacer la recherche" className="text-muted hover:text-foreground">
                <X size={14} />
              </button>
            )}
          </label>
          {touched && (
            <button className={`${s.btn} ${s.btnSm}`} onClick={reset}>
              <RotateCcw size={14} /> Réinitialiser
            </button>
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <FilterSelect
            label="Utilisateur"
            value={filters.actor}
            onChange={(v) => setFilter({ actor: v })}
            placeholder="Tous les utilisateurs"
            options={(facets?.actors ?? []).map((a) => ({ value: a.value, label: a.label }))}
          />
          <FilterSelect
            label="Type d'action"
            value={filters.action}
            onChange={(v) => setFilter({ action: v })}
            placeholder="Toutes les actions"
            options={facets?.actions ?? []}
          />
          <FilterSelect
            label="Module"
            value={filters.module}
            onChange={(v) => setFilter({ module: v })}
            placeholder="Tous les modules"
            options={ACTIVITY_MODULES.map((m) => ({ value: m.key, label: m.label }))}
          />
          <FilterSelect
            label="Statut"
            value={filters.status}
            onChange={(v) => setFilter({ status: v })}
            placeholder="Tous les statuts"
            options={Object.entries(ACTIVITY_STATUS).map(([value, st]) => ({ value, label: st.label }))}
          />
          <FilterSelect
            label="Période"
            value={filters.period}
            onChange={(v) => setFilter({ period: v })}
            options={PERIODS}
          />
        </div>

        {filters.period === "custom" && (
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-wide text-muted">
              Du
              <input
                type="date"
                className={s.input}
                value={filters.from}
                max={filters.to || undefined}
                onChange={(e) => setFilter({ from: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-wide text-muted">
              Au
              <input
                type="date"
                className={s.input}
                value={filters.to}
                min={filters.from || undefined}
                onChange={(e) => setFilter({ to: e.target.value })}
              />
            </label>
          </div>
        )}
      </div>

      {err && <div className={s.formError}>{err}</div>}

      {/* ------------------------------ Journal ------------------------------ */}
      {items === null ? (
        <Spinner label="Chargement de l'activité…" />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface shadow-sm">
          <EmptyState icon={History}>
            {touched ? "Aucune activité ne correspond à ces filtres." : "Aucune activité enregistrée pour l'instant."}
          </EmptyState>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-surface p-2 shadow-sm">
          <p className="px-3 pb-1 pt-1.5 text-[12px] text-muted" aria-live="polite">
            {total.toLocaleString("fr-FR")} activité{total > 1 ? "s" : ""}
            {touched ? ` correspond${total > 1 ? "ent" : ""} aux filtres` : ""}
          </p>

          {days.map((day) => (
            <section key={day.key} aria-label={dayHeading(day.key)}>
              <h2 className="sticky top-0 z-[1] bg-surface/95 px-3 pb-1 pt-3 text-[11px] font-extrabold uppercase tracking-wide text-muted backdrop-blur">
                {dayHeading(day.key)}
              </h2>
              <ol className="relative">
                {day.items.map((it) => (
                  <ActivityRow key={it.code} item={it} onOpen={() => setOpenCode(it.code)} />
                ))}
              </ol>
            </section>
          ))}

          {shown < total && (
            <div className="flex justify-center p-3">
              <button className={s.btn} onClick={() => load(filters, (meta?.page ?? 1) + 1)} disabled={loading}>
                {loading ? <Loader2 size={15} className="animate-spin" /> : <History size={15} />}
                Afficher plus d&apos;activités
                <span className="font-normal text-muted">
                  ({shown.toLocaleString("fr-FR")} sur {total.toLocaleString("fr-FR")})
                </span>
              </button>
            </div>
          )}
        </div>
      )}

      {openCode && <ActivityDetail code={openCode} onClose={() => setOpenCode(null)} />}
    </div>
  );
}

/* ------------------------------ Primitives -------------------------------- */

function FilterSelect({ label, value, onChange, options, placeholder }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-[11px] font-bold uppercase tracking-wide text-muted">
      {label}
      <select className={s.select} value={value} onChange={(e) => onChange(e.target.value)}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

const AVATAR_COLORS = ["#159a4e", "#3b82f6", "#8b5cf6", "#f47b20", "#0891b2", "#db2777", "#65a30d", "#475569"];

/** Couleur stable d'un auteur, dérivée de sa clé. */
function avatarColor(seed) {
  let h = 0;
  for (const ch of String(seed ?? "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function Avatar({ name, seed, size = 36, anonymous = false }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full text-[12px] font-extrabold text-white"
      style={{ width: size, height: size, background: anonymous ? "#94a3b8" : avatarColor(seed) }}
      aria-hidden="true"
    >
      {anonymous ? <Users size={size * 0.42} /> : initialsOf(name)}
    </span>
  );
}

function ActionIcon({ action, size = 11, className = "" }) {
  const info = actionInfo(action);
  const Icon = ACTION_ICONS[info.icon] ?? Activity;
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full text-white ring-2 ring-surface ${className}`}
      style={{ width: size * 1.8, height: size * 1.8, background: TONE_COLOR[info.tone] ?? TONE_COLOR.gray }}
      title={info.label}
    >
      <Icon size={size} strokeWidth={2.6} />
    </span>
  );
}

/**
 * Phrase de l'activité, auteur et élément mis en évidence. Le texte est
 * découpé en nœuds React - jamais injecté comme HTML.
 */
function Sentence({ item }) {
  const text = item.description ?? "";
  const marks = [item.actorName, item.resourceLabel]
    .filter(Boolean)
    .map((needle) => ({ needle, at: text.indexOf(needle) }))
    .filter((m) => m.at >= 0)
    .sort((a, b) => a.at - b.at);

  const nodes = [];
  let cursor = 0;
  for (const m of marks) {
    if (m.at < cursor) continue; // chevauchement : on garde la première marque
    if (m.at > cursor) nodes.push(text.slice(cursor, m.at));
    nodes.push(<strong key={`${m.at}`} className="font-bold text-foreground">{m.needle}</strong>);
    cursor = m.at + m.needle.length;
  }
  nodes.push(text.slice(cursor));
  return <>{nodes}</>;
}

const isAnonymous = (it) => !it.actorRole && !it.accountDeleted && it.actorKey?.startsWith("n:");

function ActivityRow({ item, onOpen }) {
  const res = resourceInfo(item.resourceType);
  const changeWord =
    item.action === "UPDATE" || item.action === "STATUS_CHANGE" ? "modifié" : "enregistré";
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
      >
        <span className="relative mt-0.5">
          <Avatar name={item.actorName} seed={item.actorKey} anonymous={isAnonymous(item)} />
          <ActionIcon action={item.action} className="absolute -bottom-1 -right-1" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-[13px] leading-snug text-foreground/85">
            <Sentence item={item} />
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
            <span className="font-semibold">{actionInfo(item.action).label}</span>
            {res.module && <span>· {moduleLabel(res.module)}</span>}
            {item.changes > 0 && (
              <span>
                · {item.changes} champ{item.changes > 1 ? "s" : ""} {changeWord}{item.changes > 1 ? "s" : ""}
              </span>
            )}
            {item.status === "FAILURE" && <Badge tone="red">Échouée</Badge>}
            {item.accountDeleted && <Badge tone="gray">Compte supprimé</Badge>}
          </span>
        </span>

        <time
          dateTime={item.createdAt}
          title={formatDateTime(item.createdAt)}
          className="shrink-0 pt-0.5 text-[11.5px] font-semibold tabular-nums text-muted"
        >
          {formatTime(item.createdAt)}
        </time>
      </button>
    </li>
  );
}

/* ------------------------------- Détail ----------------------------------- */

function ActivityDetail({ code, onClose }) {
  const [detail, setDetail] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    api(`/api/v1/admin/activity/${encodeURIComponent(code)}`)
      .then((d) => alive && setDetail(d))
      .catch((e) => alive && setErr(e.message));
    return () => { alive = false; };
  }, [code]);

  const action = detail ? actionInfo(detail.action) : null;
  const res = detail ? resourceInfo(detail.resourceType) : null;
  const status = detail ? ACTIVITY_STATUS[detail.status] ?? ACTIVITY_STATUS.SUCCESS : null;

  return (
    <Modal title="Détail de l'activité" onClose={onClose} wide>
      {err ? (
        <div className={s.formError}>{err}</div>
      ) : !detail ? (
        <Spinner label="Chargement du détail…" />
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl bg-surface-2/60 p-3">
            <ActionIcon action={detail.action} size={15} />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] leading-snug"><Sentence item={detail} /></p>
              <div className="mt-1.5">
                <Badge tone={status.tone}>{status.label}</Badge>
              </div>
            </div>
          </div>

          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Field label="Utilisateur">
              <span className="flex items-center gap-2">
                <Avatar name={detail.actorName} seed={detail.actorKey} size={28} anonymous={isAnonymous(detail)} />
                <span className="min-w-0">
                  <span className="block truncate font-bold">{detail.actorName}</span>
                  <span className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-muted">
                    {detail.actorRole && <RoleBadge role={detail.actorRole} />}
                    {detail.actorEmail && <span className="truncate">{detail.actorEmail}</span>}
                    {detail.accountDeleted && <Badge tone="gray">Compte supprimé depuis</Badge>}
                  </span>
                </span>
              </span>
            </Field>
            <Field label="Action">
              <span className="font-bold">{action.label}</span>
            </Field>
            <Field label="Élément concerné">
              <span className="font-bold">{capitalize(res.label)}</span>
              {detail.resourceLabel && <span> {detail.resourceLabel}</span>}
              {detail.resourceId && (
                <span className="block text-[11.5px] text-muted">Identifiant : {detail.resourceId}</span>
              )}
            </Field>
            <Field label="Module">{res.module ? moduleLabel(res.module) : "—"}</Field>
            <Field label="Date et heure">{formatDateTime(detail.createdAt)}</Field>
            <Field label="Statut">{status.label}</Field>
            <Field label="Adresse IP">{detail.ipAddress || "Non disponible"}</Field>
            <Field label="Navigateur">
              <span title={detail.userAgent || ""}>{describeUserAgent(detail.userAgent) || "Non disponible"}</span>
            </Field>
          </dl>

          <Changes detail={detail} />

          <p className="flex items-center gap-1.5 border-t border-border pt-3 text-[11.5px] text-muted">
            <Lock size={13} />
            Activité en lecture seule : elle ne peut être ni modifiée ni supprimée.
            {detail.actorRole && ` Rôle au moment de l'action : ${ROLE_LABELS[detail.actorRole] ?? detail.actorRole}.`}
          </p>
        </div>
      )}
    </Modal>
  );
}

function Field({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10.5px] font-bold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-[13px]">{children}</dd>
    </div>
  );
}

/** Valeurs avant / après, ou valeurs enregistrées selon la nature de l'action. */
function Changes({ detail }) {
  const before = detail.oldValue ?? {};
  const after = detail.newValue ?? {};
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  const compare = Object.keys(before).length > 0 && Object.keys(after).length > 0;

  if (!keys.length) {
    if (detail.action === "UPDATE") {
      return <p className="text-[12.5px] text-muted">Élément enregistré sans modification de valeur.</p>;
    }
    return null;
  }

  const title = compare
    ? "Valeurs avant et après la modification"
    : detail.action === "DELETE"
      ? "Valeurs au moment de la suppression"
      : detail.action === "CREATE" || detail.action === "REGISTER"
        ? "Valeurs enregistrées"
        : "Détails";

  return (
    <div>
      <h3 className="mb-1.5 text-[12px] font-extrabold uppercase tracking-wide text-muted">{title}</h3>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-[12.5px]">
          <thead className="bg-surface-2/70 text-left text-[11px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2 font-bold">Champ</th>
              {compare ? (
                <>
                  <th className="px-3 py-2 font-bold">Avant</th>
                  <th className="px-3 py-2 font-bold">Après</th>
                </>
              ) : (
                <th className="px-3 py-2 font-bold">Valeur</th>
              )}
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => {
              const masked = before[key] === MASKED || after[key] === MASKED;
              return (
                <tr key={key} className="border-t border-border/60 align-top">
                  <td className="whitespace-nowrap px-3 py-2 font-semibold">{fieldLabel(key)}</td>
                  {compare ? (
                    masked ? (
                      <td colSpan={2} className="px-3 py-2 italic text-muted">
                        Modifié — valeur masquée pour des raisons de sécurité
                      </td>
                    ) : (
                      <>
                        <td className="px-3 py-2 text-muted line-through decoration-uncovered/50">
                          <Value k={key} v={before[key]} />
                        </td>
                        <td className="px-3 py-2 font-semibold">
                          <Value k={key} v={after[key]} />
                        </td>
                      </>
                    )
                  ) : (
                    <td className="px-3 py-2">
                      {masked ? <span className="italic text-muted">Valeur masquée</span> : <Value k={key} v={after[key] ?? before[key]} />}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Valeur lisible ; une couleur est accompagnée de sa pastille. */
function Value({ k, v }) {
  const text = formatFieldValue(k, v);
  if (k === "color" && typeof v === "string" && /^#[0-9a-f]{3,8}$/i.test(v)) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded border border-border" style={{ background: v }} />
        {text}
      </span>
    );
  }
  return <span className="break-words">{text}</span>;
}

const capitalize = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
