"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  RadioTower, Users, MapPinned, Search, Gauge, RotateCcw,
  Info, SlidersHorizontal, ChevronUp, X,
} from "lucide-react";
import { getStations, getStationIndex, ADMIN_LOADERS } from "@/lib/geodata";
import { useMapStore } from "@/stores/map-store";
import { OPERATORS, ADMIN_LIMITS } from "@/config/artci";
import {
  STATION_MODES, DEFAULT_MODE, isChoroplethMode, concentrationInfo,
  stationCount, countByTech, countByOperator, concentration, formatConcentration,
  OPERATOR_CODES, TECH_CODES,
} from "@/lib/stations";
import { TECH_COLOR } from "@/lib/stations-layer";
import { StationsMap } from "@/components/dashboards/StationsMap";
import { OperatorLogo } from "@/components/ui/OperatorLogo";
import { networkShort, operatorFallback } from "@/lib/operators";
import { Card as Panel, Tile as Kpi, Loading, Note, SortHeader, useTableSort } from "@/components/ui/kit";
import { formatNumber, formatCompact, cn } from "@/lib/utils";

/** Champ portant le nom de l'entité, par découpage. */
const NAME_PROP = {
  district: "ADM0_FR",
  region: "ADM1_FR",
  department: "ADM2_FR",
  subPrefecture: "ADM3_FR",
};
/** Code de l'entité dans l'index des localités, par découpage. */
const INDEX_KEY = { district: "a0", region: "a1", department: "a2", subPrefecture: "a3" };
const PCODE_PROP = {
  district: "ADM0_PCODE",
  region: "ADM1_PCODE",
  department: "ADM2_PCODE",
  subPrefecture: "ADM3_PCODE",
};
const LEVEL_ONE = {
  district: "District",
  region: "Région",
  department: "Département",
  subPrefecture: "Sous-préfecture",
};

const OP_NAME = Object.fromEntries(OPERATORS.map((o) => [o.code, o.name]));
const OP_COLOR = Object.fromEntries(OPERATORS.map((o) => [o.code, o.color]));

/**
 * « Stations mobiles & concentration ».
 *
 * Module d'analyse spatiale des infrastructures mobiles : où sont les sites,
 * qui équipe quoi, et quelles entités administratives sont sous-équipées au
 * regard de leur population et de leur nombre de localités.
 */
export function StationsTab({ date }) {
  /* Les opérateurs viennent de la base : leur logo et leur type de réseau y
     sont administrés. La configuration ne sert que de repli. */
  const operatorList = useMapStore((s) => s.operatorList);
  const operatorInfo = useCallback(
    (code) =>
      operatorList.find((o) => o.code === code) ??
      operatorFallback(code) ?? { code, name: OP_NAME[code] ?? code, color: OP_COLOR[code] },
    [operatorList],
  );

  const [mode, setMode] = useState(DEFAULT_MODE);
  const [level, setLevel] = useState("district");
  const [entity, setEntity] = useState(""); // pcode de l'entité retenue
  const [operators, setOperators] = useState(OPERATOR_CODES);
  const [technologies, setTechnologies] = useState(TECH_CODES);
  const [query, setQuery] = useState("");

  const [sites, setSites] = useState(null);
  const [areas, setAreas] = useState(null);
  const [index, setIndex] = useState(null);
  const [selectedSiteId, setSelectedSiteId] = useState(null);
  const [detail, setDetail] = useState(null); // entité cliquée sur la carte
  const bodyRef = useRef(null);

  /* Sites géolocalisés : jeu unique, non daté, chargé une seule fois. */
  useEffect(() => {
    let alive = true;
    getStations().then((d) => alive && setSites(d)).catch(() => alive && setSites({ type: "FeatureCollection", features: [] }));
    return () => { alive = false; };
  }, []);

  /* Découpage administratif de la période et du niveau choisis. Le résultat
     est ESTAMPILLÉ de son niveau et de sa période (cf. `activeAreas`). */
  useEffect(() => {
    if (!date) return;
    let alive = true;
    const empty = { type: "FeatureCollection", features: [] };
    (ADMIN_LOADERS[level] ?? ADMIN_LOADERS.district)(date)
      .then((fc) => alive && setAreas({ level, date, fc }))
      .catch(() => alive && setAreas({ level, date, fc: empty }));
    return () => { alive = false; };
  }, [date, level]);

  /* Index des localités équipées (pour les décomptes exacts de localités). */
  useEffect(() => {
    if (!date) return;
    let alive = true;
    setIndex(null);
    getStationIndex(date).then((d) => alive && setIndex(d)).catch(() => alive && setIndex(false));
    return () => { alive = false; };
  }, [date]);

  const levelName = NAME_PROP[level];
  const levelPcode = PCODE_PROP[level];

  /*
   * Le découpage chargé n'est lu que s'il correspond bien à la sélection.
   *
   * Un changement de découpage provoque toujours un rendu où `level` est déjà
   * le nouveau alors que les données sont encore les anciennes - l'effet de
   * chargement ne s'exécute qu'après. Or chaque fichier porte AUSSI les codes
   * de ses entités parentes, qui s'y répètent : lire le fichier des
   * sous-préfectures comme s'il était celui des districts donnerait 46 entités
   * portant le code `CI08`. D'où des entités en double dans le sélecteur, et
   * surtout des statistiques calculées un instant sur le mauvais découpage.
   */
  const activeAreas = areas && areas.level === level && areas.date === date ? areas.fc : null;

  /** Entités du niveau, triées, pour le sélecteur - une entrée par code. */
  const entityOptions = useMemo(() => {
    const seen = new Map();
    for (const f of activeAreas?.features ?? []) {
      const code = f.properties[levelPcode];
      const name = f.properties[levelName];
      if (code && name && !seen.has(code)) seen.set(code, { code, name });
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [activeAreas, levelName, levelPcode]);

  /*
   * Changer de découpage périme l'entité retenue et la fiche affichée : elles
   * sont exprimées dans l'ancien découpage. La validité se DÉDUIT plutôt que
   * de se corriger après coup - un code inconnu du niveau courant ne filtre
   * rien, une fiche d'un autre niveau ne s'affiche pas.
   */
  const activeEntity = entity && entityOptions.some((e) => e.code === entity) ? entity : "";
  const activeDetail = detail && detail.level === level ? detail.props : null;

  /** Entités retenues par le filtre (toutes, ou la seule sélectionnée). */
  const shownAreas = useMemo(() => {
    if (!activeAreas) return null;
    if (!activeEntity) return activeAreas;
    return {
      type: "FeatureCollection",
      features: activeAreas.features.filter((f) => f.properties[levelPcode] === activeEntity),
    };
  }, [activeAreas, activeEntity, levelPcode]);

  /** Nom de l'entité retenue, pour les libellés. */
  const entityName = useMemo(
    () => entityOptions.find((e) => e.code === activeEntity)?.name ?? "",
    [entityOptions, activeEntity],
  );

  /* -------------------------- Sites filtrés ----------------------------- */

  /**
   * Les sites ne portent pas d'opérateur : seuls la technologie, l'entité et
   * la recherche textuelle peuvent les filtrer. La carte applique en plus son
   * propre filtre technologique, pour éviter de reconstruire la source.
   */
  const filteredSites = useMemo(() => {
    if (!sites) return null;
    const q = query.trim().toLowerCase();
    /*
     * Rattachement d'un site à l'entité retenue. En sous-préfecture on compare
     * les CODES, pas les noms : cinq sous-préfectures sont homonymes en 2024
     * (LOLOBO, SANTA, N'GUESSANKRO, GUEZON, NAFANA), et filtrer sur le nom
     * ramènerait les sites de leur jumelle. Aux autres découpages les noms
     * sont uniques, et les sites ne portent que ceux-là.
     */
    const byCode = level === "subPrefecture";
    const prop = byCode ? "ADM3_PCODE" : levelName;
    const keep =
      activeEntity && shownAreas
        ? new Set(shownAreas.features.map((f) => f.properties[byCode ? "ADM3_PCODE" : levelName]))
        : null;
    const features = sites.features.filter((f) => {
      const p = f.properties;
      if (!technologies.includes(p.tech)) return false;
      if (keep && !keep.has(p[prop])) return false;
      if (q && ![p.name, p.ADM3_FR, p.code].some((v) => String(v ?? "").toLowerCase().includes(q))) return false;
      return true;
    });
    return { type: "FeatureCollection", features };
  }, [sites, technologies, activeEntity, shownAreas, level, levelName, query]);

  const siteRows = useMemo(
    () =>
      (filteredSites?.features ?? []).map((f) => ({
        id: f.id,
        name: f.properties.name || "-",
        tech: f.properties.tech,
        cells: Number(f.properties.cells) || 0,
        subPrefecture: f.properties.ADM3_FR || "",
        department: f.properties.ADM2_FR || "",
        district: f.properties.ADM0_FR || "",
      })),
    [filteredSites],
  );
  const { rows, sort, toggleSort } = useTableSort(siteRows, { initial: { key: "cells", dir: "desc" } });

  const activeSiteId =
    selectedSiteId != null && siteRows.some((r) => r.id === selectedSiteId) ? selectedSiteId : null;

  useEffect(() => {
    if (activeSiteId == null || !bodyRef.current) return;
    bodyRef.current.querySelector(`[data-row-id="${activeSiteId}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeSiteId]);

  /* ------------------------- Statistiques -------------------------------- */

  /**
   * Toutes les statistiques proviennent des décomptes déclarés par période
   * (`present{OP}{TECH}`), et non des tuiles : ce sont les seuls chiffres
   * ventilés par opérateur, et ceux que reprend le reste de l'application.
   */
  const stats = useMemo(() => {
    const feats = shownAreas?.features ?? [];
    if (!feats.length) return null;
    let total = 0, pop = 0, locs = 0;
    const byTech = Object.fromEntries(TECH_CODES.map((t) => [t, 0]));
    const byOp = Object.fromEntries(OPERATOR_CODES.map((o) => [o, 0]));
    for (const f of feats) {
      const p = f.properties;
      total += stationCount(p, operators, technologies);
      pop += Number(p.pop) || 0;
      locs += Number(p.locs) || 0;
      const t = countByTech(p, operators);
      for (const k of TECH_CODES) byTech[k] += t[k];
      const o = countByOperator(p, technologies);
      for (const k of OPERATOR_CODES) byOp[k] += o[k];
    }
    return { total, pop, locs, byTech, byOp };
  }, [shownAreas, operators, technologies]);

  /**
   * Localités équipées : comptées sur l'index, localité par localité, donc
   * exactes pour n'importe quelle combinaison de filtres (une localité
   * équipée par deux opérateurs ne compte qu'une fois).
   */
  const equipped = useMemo(() => {
    if (!index?.localities) return null;
    const key = INDEX_KEY[level];
    const fields = index.fields;
    const keep = fields.map((f) => operators.some((o) => f.startsWith(o)) && technologies.some((t) => f.endsWith(t)));
    let count = 0;
    for (const l of index.localities) {
      if (activeEntity && l[key] !== activeEntity) continue;
      let n = 0;
      for (let i = 0; i < keep.length; i++) if (keep[i]) n += l.c[i];
      if (n > 0) count += 1;
    }
    return count;
  }, [index, level, activeEntity, operators, technologies]);

  const perPop = stats?.pop ? (stats.total / stats.pop) * 10000 : 0;
  const perLoc = stats?.locs ? stats.total / stats.locs : 0;

  const filtersTouched =
    operators.length !== OPERATOR_CODES.length ||
    technologies.length !== TECH_CODES.length ||
    activeEntity !== "" || query !== "" || level !== "district" || mode !== DEFAULT_MODE;

  const resetFilters = () => {
    setOperators(OPERATOR_CODES);
    setTechnologies(TECH_CODES);
    setEntity("");
    setQuery("");
    setLevel("district");
    setMode(DEFAULT_MODE);
    setSelectedSiteId(null);
    setDetail(null);
  };

  const toggle = (list, setList, value) =>
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const choropleth = isChoroplethMode(mode);
  const metric = concentrationInfo(mode);

  /* Les filtres sont posés SUR la carte : ils agissent sur elle, ils doivent
     être là où le regard se trouve déjà. */
  const filterPanel = (
    <StationFilters
      mode={mode} setMode={setMode}
      level={level} setLevel={setLevel}
      entity={activeEntity}
      onEntity={(code) => { setEntity(code); setDetail(null); }}
      entityOptions={entityOptions}
      operators={operators} setOperators={setOperators}
      technologies={technologies} setTechnologies={setTechnologies}
      query={query} setQuery={setQuery}
      onReset={resetFilters}
      touched={filtersTouched}
      toggle={toggle}
      operatorInfo={operatorInfo}
      counts={{ sites: rows.length, stations: stats?.total ?? null }}
    />
  );

  return (
    <div className="space-y-4">
      {/* ---------------------------- Carte -------------------------------- */}
      <Panel
        title="Stations radioélectriques"
        hint={
          choropleth
            ? `${metric.title} par ${LEVEL_ONE[level].toLowerCase()} · unité : ${metric.unit} — plus la teinte est foncée, mieux l'entité est équipée`
            : "Sites 2G/3G/4G géolocalisés · regroupés en amas aux zooms faibles, cliquez un amas pour le déplier"
        }
      >
        <div className="h-[clamp(520px,70vh,860px)]">
          <StationsMap
            sites={filteredSites}
            areas={choropleth ? shownAreas : null}
            level={level}
            mode={mode}
            operators={operators}
            technologies={technologies}
            date={date}
            selectedSiteId={activeSiteId}
            onSelectSite={setSelectedSiteId}
            onSelectArea={(props) => setDetail({ props, level })}
            loading={!sites || !activeAreas}
            controls={filterPanel}
          />
        </div>
      </Panel>

      {/* ------------------------- Indicateurs ----------------------------- */}
      {!stats ? (
        <Loading label="Chargement des indicateurs…" />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              icon={RadioTower}
              value={formatNumber(stats.total)}
              label="Stations"
              hint={entityName ? `${LEVEL_ONE[level]} de ${entityName}` : "Ensemble du territoire"}
            />
            <Kpi
              icon={MapPinned}
              value={equipped == null ? "…" : formatNumber(equipped)}
              label="Localités équipées"
              hint={`sur ${formatNumber(stats.locs)} localités`}
              color="#3b82f6"
            />
            <Kpi
              icon={Gauge}
              value={perLoc.toFixed(2).replace(".", ",")}
              label="Stations par localité"
              hint="moyenne sur les entités affichées"
              color="#8b5cf6"
            />
            <Kpi
              icon={Users}
              value={perPop.toFixed(1).replace(".", ",")}
              label="Stations / 10 000 hab."
              hint={`${formatCompact(stats.pop)} habitants`}
              color="#f47b20"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Panel title="Par technologie" hint="Décompte déclaré de la période">
              <div className="space-y-1.5">
                {TECH_CODES.map((t) => (
                  <Bar
                    key={t}
                    label={t}
                    value={stats.byTech[t]}
                    total={stats.total}
                    color={TECH_COLOR[t]}
                    dim={!technologies.includes(t)}
                  />
                ))}
              </div>
            </Panel>

            <Panel title="Par opérateur" hint="Décompte déclaré de la période">
              <div className="space-y-1.5">
                {OPERATOR_CODES.map((o) => (
                  <Bar
                    key={o}
                    label={operatorInfo(o).name}
                    logo={operatorInfo(o)}
                    hint={networkShort(operatorInfo(o).network)}
                    value={stats.byOp[o]}
                    total={stats.total}
                    color={OP_COLOR[o]}
                    dim={!operators.includes(o)}
                  />
                ))}
              </div>
            </Panel>

            <Panel title="Entité sélectionnée" hint="Cliquez une entité sur la carte">
              {activeDetail ? (
                <EntityDetail
                  props={activeDetail}
                  level={level}
                  mode={mode}
                  operators={operators}
                  technologies={technologies}
                />
              ) : (
                <p className="py-6 text-center text-[12px] text-muted">
                  Aucune entité sélectionnée.
                </p>
              )}
            </Panel>
          </div>
        </>
      )}

      {/* ------------------------ Tableau des sites ------------------------ */}
      <Panel
        title="Sites géolocalisés"
        hint={`${formatNumber(rows.length)} site(s) · ${formatNumber(rows.reduce((s, r) => s + r.cells, 0))} cellules · cliquez une ligne pour la localiser`}
      >
        {!sites ? (
          <Loading label="Chargement des sites…" />
        ) : rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted">Aucun site ne correspond à ces filtres.</p>
        ) : (
          <div ref={bodyRef} className="max-h-[420px] overflow-auto rounded-xl border border-border/60">
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 z-10">
                <tr>
                  {SITE_COLS.map((c) => (
                    <SortHeader
                      key={c.key}
                      label={c.label}
                      sortKey={c.key}
                      sort={sort}
                      onSort={toggleSort}
                      align={c.align === "left" ? "left" : "right"}
                      className="whitespace-nowrap border-b border-border bg-surface px-2 py-2 font-bold text-muted"
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    data-row-id={r.id}
                    onClick={() => setSelectedSiteId((cur) => (cur === r.id ? null : r.id))}
                    className={cn(
                      "cursor-pointer transition-colors",
                      r.id === activeSiteId ? "bg-artci-green/15" : "odd:bg-surface-2/40 hover:bg-surface-2",
                    )}
                  >
                    {SITE_COLS.map((c) => (
                      <td
                        key={c.key}
                        className={cn(
                          "whitespace-nowrap border-b border-border/40 px-2 py-1.5",
                          c.align === "left" ? "font-semibold" : "text-right tabular-nums",
                          c.key !== "name" && c.align === "left" && "font-normal text-muted",
                        )}
                      >
                        {c.key === "tech" ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full" style={{ background: TECH_COLOR[r.tech] }} />
                            {r.tech}
                          </span>
                        ) : c.fmt ? (
                          c.fmt(r[c.key])
                        ) : (
                          r[c.key] || "-"
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Note icon={Info}>
        Deux sources coexistent dans cette section, et ne se recouvrent pas. Les <b>sites</b> de la
        carte proviennent des jeux de tuiles ARTCI : ils donnent la position exacte de{" "}
        {formatNumber(sites?.features?.length ?? 0)} implantations et leur technologie, mais ne
        portent aucune information d&apos;opérateur — le filtre par opérateur ne s&apos;y applique
        donc pas. Les <b>indicateurs et le choroplèthe</b> reposent sur les décomptes déclarés de la
        période, ventilés par opérateur et par technologie, seuls chiffres cohérents avec le reste
        de l&apos;application.
      </Note>
    </div>
  );
}

const SITE_COLS = [
  { key: "name", label: "Site", align: "left" },
  { key: "tech", label: "Techno.", align: "left" },
  { key: "subPrefecture", label: "Sous-préfecture", align: "left" },
  { key: "department", label: "Département", align: "left" },
  { key: "district", label: "District", align: "left" },
  { key: "cells", label: "Cellules", fmt: formatNumber },
];

/* ------------------------------ Primitives -------------------------------- */

/**
 * Panneau de filtres posé sur la carte.
 *
 * Repliable : sur un écran étroit ou lorsqu'on veut lire la carte sans
 * obstacle, il se réduit à un bouton portant le nombre de filtres actifs.
 */
function StationFilters({
  mode, setMode, level, setLevel, entity, onEntity, entityOptions,
  operators, setOperators, technologies, setTechnologies,
  query, setQuery, onReset, touched, toggle, counts, operatorInfo,
}) {
  const [open, setOpen] = useState(true);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-xl border border-border bg-surface/95 px-2.5 py-1.5 text-[11px] font-bold shadow-sm backdrop-blur transition-colors hover:bg-surface-2"
      >
        <SlidersHorizontal size={13} className="text-muted" />
        Filtres
        {touched && <span className="h-1.5 w-1.5 rounded-full bg-artci-green" />}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface/97 p-2.5 shadow-md backdrop-blur">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted">
          <SlidersHorizontal size={12} />
          Filtres
        </span>
        <div className="flex items-center gap-1">
          {touched && (
            <button
              type="button"
              onClick={onReset}
              title="Réinitialiser les filtres"
              className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-[10px] font-bold text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              <RotateCcw size={11} />
              Réinitialiser
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Replier les filtres"
            className="grid h-5 w-5 place-items-center rounded-md text-muted hover:bg-surface-2"
          >
            <ChevronUp size={12} />
          </button>
        </div>
      </div>

      {/* Mode de visualisation : il commande ce que la carte représente. */}
      <div className="mb-2 flex flex-col gap-1 rounded-lg bg-surface-2/70 p-1">
        {STATION_MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMode(m.key)}
            aria-pressed={mode === m.key}
            title={m.hint}
            className={cn(
              "rounded-md px-2 py-1 text-left text-[11px] font-bold transition-colors",
              mode === m.key ? "brand-gradient text-white shadow-sm" : "text-muted hover:bg-surface-2",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      <FilterGroup label="Opérateur">
        {OPERATOR_CODES.map((o) => {
          const active = operators.includes(o);
          const op = operatorInfo(o);
          return (
            <CheckItem key={o} checked={active} onChange={() => toggle(operators, setOperators, o)}>
              <OperatorLogo operator={op} size={16} dim={!active} />
              {op.name}
            </CheckItem>
          );
        })}
      </FilterGroup>
      {!operators.length && (
        <p className="mb-1.5 text-[10px] font-semibold text-uncovered">
          Aucun opérateur : les décomptes sont nuls.
        </p>
      )}

      <FilterGroup label="Technologie">
        {TECH_CODES.map((t) => {
          const active = technologies.includes(t);
          return (
            <CheckItem
              key={t}
              checked={active}
              onChange={() => toggle(technologies, setTechnologies, t)}
            >
              <span
                className={cn("h-2.5 w-2.5 rounded-full transition-opacity", !active && "opacity-25")}
                style={{ background: TECH_COLOR[t] }}
              />
              {t}
            </CheckItem>
          );
        })}
      </FilterGroup>

      <FilterGroup label="Découpage">
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface px-2 py-1 text-[11.5px] font-bold text-foreground outline-none focus:border-artci-green"
        >
          {ADMIN_LIMITS.map((l) => (
            <option key={l.key} value={l.key}>{l.label}</option>
          ))}
        </select>
      </FilterGroup>

      <FilterGroup label="Entité">
        <select
          value={entity}
          onChange={(e) => onEntity(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface px-2 py-1 text-[11.5px] font-bold outline-none focus:border-artci-green"
        >
          <option value="">Toutes les entités</option>
          {entityOptions.map((e) => (
            <option key={e.code} value={e.code}>{e.name}</option>
          ))}
        </select>
      </FilterGroup>

      <label className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1 focus-within:border-artci-green">
        <Search size={13} className="shrink-0 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Localité, site, code…"
          className="w-full bg-transparent text-[11.5px] outline-none placeholder:text-muted"
        />
        {query && (
          <button type="button" onClick={() => setQuery("")} aria-label="Effacer" className="shrink-0 text-muted hover:text-foreground">
            <X size={12} />
          </button>
        )}
      </label>

      <div className="mt-2 border-t border-border/60 pt-1.5 text-[10px] font-semibold text-muted">
        {formatNumber(counts.sites)} site(s) affiché(s)
        {counts.stations != null && ` · ${formatNumber(counts.stations)} stations déclarées`}
      </div>
    </div>
  );
}

function FilterGroup({ label, children }) {
  return (
    <div className="mb-2">
      <span className="mb-1 block text-[9.5px] font-bold uppercase tracking-wide text-muted">{label}</span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

/**
 * Entrée de filtre à cocher. La case est une vraie `checkbox` : l'état coché
 * est ainsi porté par le contrôle lui-même, lisible au clavier comme par les
 * technologies d'assistance, plutôt que déduit d'un fond coloré.
 */
function CheckItem({ checked, onChange, children }) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-bold transition-colors",
        checked ? "border-transparent bg-surface-2 text-foreground" : "border-border text-muted hover:bg-surface-2",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-3.5 w-3.5 shrink-0 accent-artci-green"
      />
      {children}
    </label>
  );
}

/** Barre proportionnelle d'un décompte dans son total. */
function Bar({ label, value, total, color, dim, logo, hint }) {
  const pct = total ? (value / total) * 100 : 0;
  return (
    <div className={cn("flex items-center gap-2.5", dim && "opacity-40")}>
      <span className="flex w-[104px] shrink-0 items-center gap-1.5">
        {logo && <OperatorLogo operator={logo} size={16} />}
        <span className="truncate text-[11.5px] font-bold" title={hint ? `${label} · ${hint}` : label}>{label}</span>
      </span>
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
        <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </span>
      <span className="w-[74px] shrink-0 text-right text-[11.5px] font-bold tabular-nums">
        {formatNumber(value)}
        <span className="ml-1 font-semibold text-muted">{pct.toFixed(0)} %</span>
      </span>
    </div>
  );
}

/** Fiche détaillée d'une entité cliquée sur la carte. */
function EntityDetail({ props, level, mode, operators, technologies }) {
  const total = stationCount(props, operators, technologies);
  const byTech = countByTech(props, operators);
  const pop = Number(props.pop) || 0;
  const locs = Number(props.locs) || 0;
  return (
    <div className="space-y-1.5">
      <div className="text-sm font-extrabold tracking-tight">{props[NAME_PROP[level]] ?? "-"}</div>
      <div className="text-[10px] font-bold uppercase tracking-wide text-artci-green-700">{LEVEL_ONE[level]}</div>
      <Line label="Population" value={`${formatNumber(pop)} hab.`} />
      <Line label="Localités" value={formatNumber(locs)} />
      <Line label="Stations" value={formatNumber(total)} strong />
      {TECH_CODES.map((t) => (
        <Line key={t} label={t} value={formatNumber(byTech[t])} dot={TECH_COLOR[t]} />
      ))}
      <Line
        label={concentrationInfo(mode).title}
        value={formatConcentration(concentration(props, mode, operators, technologies), mode)}
        strong
      />
      <Line
        label="Stations / 10 000 hab."
        value={pop ? ((total / pop) * 10000).toFixed(1).replace(".", ",") : "-"}
      />
    </div>
  );
}

function Line({ label, value, strong, dot }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border/40 py-1 last:border-0">
      <span className="flex items-center gap-1.5 text-[11.5px] text-muted">
        {dot && <span className="h-2 w-2 rounded-full" style={{ background: dot }} />}
        {label}
      </span>
      <span className={cn("text-[12px] tabular-nums", strong ? "font-extrabold" : "font-semibold")}>{value}</span>
    </div>
  );
}
