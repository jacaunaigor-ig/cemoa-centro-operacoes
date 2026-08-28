"use client";

import { useEffect, useRef } from "react";
import type { GeoJSON as GeoJSONType, Map as LeafletMap, PathOptions } from "leaflet";
import type { RiskLevel } from "@/lib/types";
import { RISK_COLORS, RISK_LABELS } from "@/lib/risk";
import { reportClientError } from "@/lib/client";
import "leaflet/dist/leaflet.css";

type Muni = {
  id: string;
  nome: string;
  bacia: string;
  lon: number;
  lat: number;
  risco: RiskLevel;
};

export function AlertsMap({
  municipios,
  selected,
  filter,
  basin,
  onSelect,
}: {
  municipios: Muni[];
  selected: string | null;
  filter: RiskLevel | "TODOS";
  basin: string | null;
  onSelect: (nome: string, bacia: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<GeoJSONType | null>(null);
  const onSelectRef = useRef(onSelect);
  const stateRef = useRef({ municipios, selected, filter, basin });

  useEffect(() => {
    onSelectRef.current = onSelect;
    stateRef.current = { municipios, selected, filter, basin };
  }, [onSelect, municipios, selected, filter, basin]);

  useEffect(() => {
    let cancelled = false;
    let resizeObs: ResizeObserver | undefined;

    async function boot() {
      const L = (await import("leaflet")).default;
      if (cancelled || !hostRef.current || mapRef.current) return;

      const map = L.map(hostRef.current, {
        zoomControl: true,
        minZoom: 5,
        maxZoom: 11,
      }).setView([-4.2, -64.6], 6);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;

      const styleFor = (feature?: GeoJSON.Feature): PathOptions => {
        const nome = String(feature?.properties?.nome ?? "");
        const { municipios: list, selected: sel, filter: f, basin: b } =
          stateRef.current;
        const m = list.find((item) => item.nome === nome);
        const risco = m?.risco ?? "BAIXO";
        const matchLevel = f === "TODOS" || risco === f;
        const matchBasin = !b || m?.bacia === b;
        const match = matchLevel && matchBasin;
        const isSel = sel === nome;
        return {
          color: isSel ? "#ffffff" : match ? "rgba(255,255,255,.85)" : "#3a4b60",
          weight: isSel ? 2.6 : match ? 1.1 : 0.7,
          opacity: match || isSel ? 1 : 0.35,
          fillColor: RISK_COLORS[risco],
          fillOpacity: isSel ? 0.92 : match ? 0.78 : 0.12,
          className: "muni-path",
        };
      };

      try {
        const geo = await fetch("/geo/amazonas-municipios.json").then((r) => {
          if (!r.ok) throw new Error(`GeoJSON HTTP ${r.status}`);
          return r.json();
        });
        if (cancelled) return;

        const layer = L.geoJSON(geo, {
          style: styleFor,
          onEachFeature: (feature, lyr) => {
            const nome = String(feature.properties?.nome ?? "");
            lyr.on("click", () => {
              const m = stateRef.current.municipios.find((item) => item.nome === nome);
              onSelectRef.current(nome, m?.bacia ?? "");
            });
            lyr.on("mouseover", () => {
              const m = stateRef.current.municipios.find((item) => item.nome === nome);
              lyr.bindTooltip(
                `<strong>${nome}</strong><br/>${m?.bacia ?? ""} · ${RISK_LABELS[m?.risco ?? "BAIXO"]}`,
                { sticky: true },
              ).openTooltip();
            });
          },
        }).addTo(map);
        layerRef.current = layer;
        map.fitBounds(layer.getBounds().pad(0.04));
      } catch (err) {
        reportClientError(
          err instanceof Error ? err.message : "Falha no GeoJSON",
          "AlertsMap",
        );
      }

      resizeObs = new ResizeObserver(() => map.invalidateSize());
      if (hostRef.current) resizeObs.observe(hostRef.current);
    }

    void boot();
    return () => {
      cancelled = true;
      resizeObs?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.setStyle((feature) => {
      const nome = String(feature?.properties?.nome ?? "");
      const m = municipios.find((item) => item.nome === nome);
      const risco = m?.risco ?? "BAIXO";
      const matchLevel = filter === "TODOS" || risco === filter;
      const matchBasin = !basin || m?.bacia === basin;
      const match = matchLevel && matchBasin;
      const isSel = selected === nome;
      return {
        color: isSel ? "#ffffff" : match ? "rgba(255,255,255,.85)" : "#3a4b60",
        weight: isSel ? 2.6 : match ? 1.1 : 0.7,
        opacity: match || isSel ? 1 : 0.35,
        fillColor: RISK_COLORS[risco],
        fillOpacity: isSel ? 0.92 : match ? 0.78 : 0.12,
        className: "muni-path",
      };
    });

    if (selected) {
      const m = municipios.find((item) => item.nome === selected);
      if (m && mapRef.current) mapRef.current.panTo([m.lat, m.lon], { animate: true });
    }
  }, [municipios, selected, filter, basin]);

  return <div ref={hostRef} className="absolute inset-0" role="presentation" />;
}
