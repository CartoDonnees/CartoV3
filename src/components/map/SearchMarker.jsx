"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import { useMapStore } from "@/stores/map-store";

/**
 * Marqueur de l'entité recherchée (repris de la V2) : posé sur la carte à la
 * position de l'entité sélectionnée, retiré quand la sélection est effacée.
 */
export function SearchMarker() {
  const map = useMapStore((s) => s.map);
  const popup = useMapStore((s) => s.statsPopup);
  const markerRef = useRef(null);

  useEffect(() => {
    if (!map) return;
    const lng = Number(popup?.lng);
    const lat = Number(popup?.lat);

    // Pas de marqueur pour une portée nationale (pas de point précis à désigner).
    if (!popup || popup.levelLabel === "National" || !Number.isFinite(lng) || !Number.isFinite(lat)) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    if (!markerRef.current) {
      const el = document.createElement("div");
      el.className = "carto-search-marker";
      el.innerHTML = `
        <span class="carto-search-marker__pulse"></span>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
        </svg>`;
      markerRef.current = new mapboxgl.Marker({ element: el, anchor: "bottom" });
    }
    markerRef.current.setLngLat([lng, lat]).addTo(map);
  }, [map, popup]);

  // Retire le marqueur au démontage.
  useEffect(() => () => markerRef.current?.remove(), []);

  return null;
}
