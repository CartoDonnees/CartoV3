"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import { useMapStore } from "@/stores/map-store";
import { LOCALITY_LAYERS } from "./LayerManager";
import { getQos } from "@/lib/geodata";
import { localityPopupHtml, qosKeys, QOS_SERVICE_LABELS } from "@/lib/locality-popup";

/* Marqueurs de qualité de service : ils ont leur propre infobulle, on leur
   laisse la priorité quand les deux se superposent. */
const QOS_LAYERS = ["qos-audited", "qos-voice", "qos-sms", "qos-data"].flatMap((id) => [id, `${id}-halo`]);

/**
 * Indexe les mesures d'audit d'une campagne par code de localité, pour les
 * trois services. Une campagne ne couvre qu'un échantillon (~80 localités) :
 * l'index reste donc petit et se charge une seule fois par campagne.
 */
async function buildQosIndex(campaign) {
  const index = new Map();
  await Promise.all(
    QOS_SERVICE_LABELS.map(async ({ key }) => {
      const data = await getQos(key, campaign).catch(() => null);
      for (const f of data?.features ?? []) {
        // Indexé sous toutes ses clés : le référentiel de la période
        // affichée ne partage pas toujours la codification des audits.
        for (const k of qosKeys(f.properties)) {
          const entry = index.get(k) ?? {};
          entry[key] = f.properties;
          index.set(k, entry);
        }
      }
    }),
  );
  return index;
}

/**
 * Infobulle de survol des points de localité : identité, couverture par
 * opérateur et technologie, et synthèse des audits de qualité de service
 * lorsque la localité fait partie de l'échantillon.
 * Une seule écoute globale sert toutes les couches — celles qui ne sont pas
 * affichées sont simplement ignorées.
 */
export function LocalityHover() {
  const map = useMapStore((s) => s.map);
  const qosCampaign = useMapStore((s) => s.qosCampaign);
  const qosIndex = useRef(new Map());

  // Index QoS de la campagne courante (rechargé quand elle change).
  useEffect(() => {
    if (!qosCampaign) return;
    let alive = true;
    qosIndex.current = new Map();
    buildQosIndex(qosCampaign).then((idx) => {
      if (alive) qosIndex.current = idx;
    });
    return () => { alive = false; };
  }, [qosCampaign]);

  useEffect(() => {
    if (!map) return;

    const popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 16,
      maxWidth: "340px",
      className: "lh-popup",
    });
    let shownKey = null;

    const hide = () => {
      shownKey = null;
      popup.remove();
    };

    const onMove = (e) => {
      // On n'interroge que les couches réellement présentes sur la carte.
      const active = LOCALITY_LAYERS.filter((id) => map.getLayer(id));
      const qosLayers = QOS_LAYERS.filter((id) => map.getLayer(id));
      if (!active.length) return hide();

      const feats = map.queryRenderedFeatures(e.point, { layers: [...qosLayers, ...active] });
      const top = feats[0];
      // Un marqueur QoS au premier plan garde la main sur sa propre infobulle.
      if (!top || qosLayers.includes(top.layer.id)) return hide();

      const p = top.properties || {};
      const key = `${top.layer.id}|${p.ADM4_PCODE ?? p.ADM4_FR}`;
      if (key !== shownKey) {
        shownKey = key;
        popup.setHTML(
          localityPopupHtml(p, {
            layerId: top.layer.id,
            qos: qosKeys(p).map((k) => qosIndex.current.get(k)).find(Boolean) ?? null,
            campaign: useMapStore.getState().qosCampaign,
          }),
        );
      }
      popup.setLngLat(e.lngLat).addTo(map);
    };

    map.on("mousemove", onMove);
    map.on("mouseout", hide);
    return () => {
      map.off("mousemove", onMove);
      map.off("mouseout", hide);
      popup.remove();
    };
  }, [map]);

  return null;
}
