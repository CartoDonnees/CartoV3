"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import { useMapStore } from "@/stores/map-store";
import { getQos, getQosLocalities } from "@/lib/geodata";
import { registerMapIcons, qosIconId } from "@/lib/mapIcons";
import { formatNumber } from "@/lib/utils";

const esc = (v) =>
  String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** Ordre canonique des opérateurs — celui des noms de fichiers et des icônes. */
const OPS = ["MOOV", "MTN", "ORANGE"];

/**
 * Services de base audités. `ctrl` est la case du panneau de filtres,
 * `service` le nom du fichier de mesures (VOIX / SMS / DATA).
 */
const SERVICES = [
  { key: "voice", service: "VOIX", label: "Voix", ctrl: "showVoiceService" },
  { key: "sms", service: "SMS", label: "SMS", ctrl: "showSmsService" },
  { key: "data", service: "DATA", label: "Internet", ctrl: "showDataService" },
];

/* Marqueurs d'audit : pleinement opaques à tous les zooms, doublés d'un halo
   qui les fait ressortir du fond de carte même à l'échelle nationale.
   Seule la taille varie ; l'échantillon audité étant homogène, tous les
   marqueurs gardent le même calibre pour rester comparables.

   ATTENTION : `icon-size` est une propriété de MISE EN PAGE, où Mapbox refuse
   `feature-state` (réservé aux propriétés de peinture). L'état du pointeur
   passe donc par une comparaison du code de la localité, comme en version 2,
   et les propriétés sont ré-appliquées à chaque survol. */

/* Paliers de zoom : [zoom, repos, survol, sélectionné]. */
const SIZE_STOPS = [
  [4, 0.75, 0.95, 1.05],
  [8, 1.2, 1.5, 1.65],
  [12, 1.5, 1.85, 2.05],
  [16, 1.7, 2.05, 2.25],
];
const HALO_STOPS = [
  [4, 11, 15, 17],
  [8, 18, 24, 27],
  [12, 24, 31, 35],
  [16, 28, 36, 40],
];

/** Valeur conditionnée au marqueur survolé / sélectionné (par code de localité). */
const pick = (base, hover, selected, hoverCode, selCode) => {
  const branches = [];
  if (selCode) branches.push(["==", ["get", "ADM4_PCODE"], selCode], selected);
  if (hoverCode && hoverCode !== selCode) branches.push(["==", ["get", "ADM4_PCODE"], hoverCode], hover);
  return branches.length ? ["case", ...branches, base] : base;
};

/** Interpolation par zoom dont chaque palier tient compte de l'état du pointeur. */
const byZoom = (stops, hoverCode, selCode) => [
  "interpolate", ["linear"], ["zoom"],
  ...stops.flatMap(([z, base, hover, selected]) => [z, pick(base, hover, selected, hoverCode, selCode)]),
];

const iconSize = (h, s) => byZoom(SIZE_STOPS, h, s);
const haloRadius = (h, s) => byZoom(HALO_STOPS, h, s);
const haloColor = (h, s) => pick("#0f172a", "#0b6d37", "#f47b20", h, s);
const haloOpacity = (h, s) => pick(0.2, 0.4, 0.55, h, s);

const qosLayout = (image) => ({
  "icon-image": image,
  "icon-size": iconSize(null, null),
  "icon-allow-overlap": true,
  "icon-ignore-placement": true,
  "icon-anchor": "center",
});
const QOS_ICON_PAINT = { "icon-opacity": 1 };
const QOS_HALO_PAINT = {
  "circle-radius": haloRadius(null, null),
  "circle-color": haloColor(null, null),
  "circle-opacity": haloOpacity(null, null),
  "circle-blur": 0.7,
};

/** Toutes les couches de marqueurs d'audit, halo compris. */
const QOS_MARKERS = ["qos-audited", "qos-voice", "qos-sms", "qos-data"];

/**
 * Couches de qualité de service (version 2) : localités auditées et mesures
 * Voix / SMS / Internet de la campagne choisie. Chaque marqueur est cerclé
 * des opérateurs sélectionnés ; le survol résume la localité et le clic
 * ouvre la fiche détaillée des indicateurs.
 */
export function QosLayers() {
  const map = useMapStore((s) => s.map);
  const controls = useMapStore((s) => s.controls);
  const qosOperators = useMapStore((s) => s.qosOperators);
  const qosCampaign = useMapStore((s) => s.qosCampaign);
  const loadedRef = useRef({});

  useEffect(() => {
    if (!map || !qosCampaign) return;
    let cancelled = false;
    const loaded = loadedRef.current;

    // Version 2 : l'infobulle reste ouverte (bouton de fermeture) le temps que
    // l'utilisateur atteigne le lien « Détails QoS ».
    const popup = new mapboxgl.Popup({
      closeButton: true,
      closeOnClick: true,
      offset: 14,
      className: "qos-popup",
      maxWidth: "260px",
    });

    // Contenu réutilisé d'un survol à l'autre : une seule écoute de clic.
    const content = document.createElement("div");
    let pending = null; // audit visé par le bouton de détail
    content.addEventListener("click", (ev) => {
      if (!ev.target.closest("[data-qos-details]") || !pending) return;
      markSelected?.(pendingRef);
      useMapStore.getState().setSelectedQos(pending);
      popup.remove();
    });
    // Renseignés plus bas, une fois les états de pointeur définis.
    let markSelected = null;
    let pendingRef = null;

    const removeLayer = (id) => {
      if (map.getLayer(id)) map.removeLayer(id);
    };
    /** Retire un marqueur d'audit et son halo. */
    const removeMarker = (id) => {
      removeLayer(id);
      removeLayer(`${id}-halo`);
    };
    /** Pose le halo puis le marqueur, dans cet ordre d'empilement. */
    const addMarker = (id, image) => {
      if (!map.getLayer(`${id}-halo`)) {
        map.addLayer({ id: `${id}-halo`, type: "circle", source: id, paint: QOS_HALO_PAINT });
      }
      if (map.getLayer(id)) {
        // La sélection d'opérateurs a pu changer : l'anneau doit suivre.
        map.setLayoutProperty(id, "icon-image", image);
      } else {
        map.addLayer({ id, type: "symbol", source: id, layout: qosLayout(image), paint: QOS_ICON_PAINT });
      }
    };

    /** Charge la source si absente ou si la campagne a changé. */
    const ensureSource = async (id, loader, key) => {
      if (loaded[id] === key && map.getSource(id)) return true;
      useMapStore.getState().beginLoading();
      try {
        const data = await loader();
        if (cancelled) return false;
        const src = map.getSource(id);
        if (src) src.setData(data);
        else map.addSource(id, { type: "geojson", data });
        loaded[id] = key;
        return true;
      } catch {
        return false; // campagne sans mesures pour ce service
      } finally {
        useMapStore.getState().endLoading();
      }
    };

    let running = false;
    let queued = false;
    const runSync = async () => {
      if (running) { queued = true; return; }
      running = true;
      try {
        await sync();
      } catch (e) {
        console.error("[QosLayers]", e);
      } finally {
        running = false;
        if (queued && !cancelled) { queued = false; runSync(); }
      }
    };

    const sync = async () => {
      if (!map.getStyle()) return;
      const st = useMapStore.getState();
      const campaign = st.qosCampaign;
      // Ordre canonique : « MOOV_MTN » et non « MTN_MOOV ».
      const ops = OPS.filter((o) => st.qosOperators.includes(o));

      // ---- Localités auditées (échantillon de la campagne) ----
      if (st.controls.showFieldLevel) {
        if (await ensureSource("qos-audited", () => getQosLocalities(campaign), campaign)) {
          await registerMapIcons(map);
          addMarker("qos-audited", "ic-qos-audited");
        }
      } else removeMarker("qos-audited");

      // ---- Mesures par service ----
      const showServices = st.controls.showServiceBase && ops.length > 0;
      for (const s of SERVICES) {
        const layerId = `qos-${s.key}`;
        if (!showServices || !st.controls[s.ctrl]) {
          removeMarker(layerId);
          continue;
        }
        if (!(await ensureSource(layerId, () => getQos(s.service, campaign), campaign))) {
          removeMarker(layerId);
          continue;
        }
        await registerMapIcons(map);
        addMarker(layerId, qosIconId(s.service, ops));
      }

      // Les couches recréées reprennent l'état courant du pointeur.
      applyStates();
    };

    /* ------------------------------ Interactions ------------------------- */
    const layerOf = (key) => (key === "audited" ? "qos-audited" : `qos-${key}`);

    /* États de pointeur : `hover` suit la souris, `selected` reste tant que la
       fiche de résultats est ouverte — l'utilisateur voit toujours à quel
       marqueur elle se rapporte. Les deux se rejouent en réécrivant les
       propriétés des couches, seule voie ouverte pour `icon-size`. */
    let hoverCode = null;
    let selCode = null;
    const applyStates = () => {
      for (const id of QOS_MARKERS) {
        if (map.getLayer(id)) map.setLayoutProperty(id, "icon-size", iconSize(hoverCode, selCode));
        const halo = `${id}-halo`;
        if (!map.getLayer(halo)) continue;
        map.setPaintProperty(halo, "circle-radius", haloRadius(hoverCode, selCode));
        map.setPaintProperty(halo, "circle-color", haloColor(hoverCode, selCode));
        map.setPaintProperty(halo, "circle-opacity", haloOpacity(hoverCode, selCode));
      }
    };
    const setHover = (code) => {
      if (code === hoverCode) return;
      hoverCode = code;
      applyStates();
    };
    const setSelected = (code) => {
      if (code === selCode) return;
      selCode = code;
      applyStates();
    };
    markSelected = setSelected;

    // La fiche refermée, le marqueur reprend son apparence normale.
    const unsubscribe = useMapStore.subscribe((st, prev) => {
      if (prev.selectedQos && !st.selectedQos) setSelected(null);
    });

    const onEnter = (svc) => (e) => {
      const f = e.features?.[0];
      if (!f) return;
      map.getCanvas().style.cursor = "pointer";
      const p = f.properties || {};
      setHover(p.ADM4_PCODE ?? null);
      pendingRef = p.ADM4_PCODE ?? null;
      pending = svc
        ? {
            service: svc.service,
            serviceLabel: svc.label,
            campaign: useMapStore.getState().qosCampaign,
            properties: p,
          }
        : null;

      content.innerHTML =
        `<div class="qos-popup__svc">${svc ? `Service : ${svc.label}` : "Localité auditée"}</div>` +
        `<div class="qos-popup__name">${esc(p.ADM4_FR) || "—"}</div>` +
        `<div class="qos-popup__meta">Sous-préfecture : ${esc(p.ADM3_FR) || "—"}</div>` +
        `<div class="qos-popup__meta">Population : <b>${formatNumber(Number(p.pop) || 0)}</b></div>` +
        (svc ? `<button type="button" class="qos-popup__btn" data-qos-details>Détails QoS</button>` : "");

      popup.setLngLat(e.lngLat).setDOMContent(content).addTo(map);
    };
    // L'infobulle persiste (version 2) : seuls le curseur et l'état de survol
    // sont rétablis.
    const onLeave = () => {
      map.getCanvas().style.cursor = "";
      setHover(null);
    };
    const onClick = (svc) => (e) => {
      const f = e.features?.[0];
      if (!f || !svc) return;
      setSelected(f.properties?.ADM4_PCODE ?? null);
      useMapStore.getState().setSelectedQos({
        service: svc.service,
        serviceLabel: svc.label,
        campaign: useMapStore.getState().qosCampaign,
        properties: f.properties || {},
      });
    };

    const handlers = [];
    const bind = (key, svc) => {
      const enter = onEnter(svc);
      const click = onClick(svc);
      // Marqueur ET halo : ce dernier élargit la cible de survol.
      for (const id of [layerOf(key), `${layerOf(key)}-halo`]) {
        map.on("mouseenter", id, enter);
        map.on("mouseleave", id, onLeave);
        map.on("click", id, click);
        handlers.push([id, enter, click]);
      }
    };
    bind("audited", null);
    for (const s of SERVICES) bind(s.key, s);

    runSync();
    const onStyle = () => {
      for (const k of Object.keys(loaded)) delete loaded[k];
      runSync();
    };
    map.on("style.load", onStyle);

    return () => {
      cancelled = true;
      unsubscribe();
      // Sans quoi un marqueur resterait agrandi après un changement de filtre.
      hoverCode = null;
      selCode = null;
      popup.remove();
      map.off("style.load", onStyle);
      for (const [id, enter, click] of handlers) {
        map.off("mouseenter", id, enter);
        map.off("mouseleave", id, onLeave);
        map.off("click", id, click);
      }
    };
  }, [map, controls, qosOperators, qosCampaign]);

  return null;
}
