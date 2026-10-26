"use client";

import { useEffect, useRef } from "react";
import type { GeoJSON as GeoJSONLayer, Map as LeafletMap, PathOptions } from "leaflet";
import { addOsmTiles, leafletNamespace, resetLeafletHost } from "@/lib/leaflet-osm";
import "leaflet/dist/leaflet.css";

type Props = {
  malha: GeoJSON.FeatureCollection | null;
  avisos: GeoJSON.FeatureCollection | null;
  cores: Record<string, string>;
  nomes: Record<string, string>;
  selecionado: string | null;
  onSelect: (codarea: string) => void;
};

export function SalaMapa({ malha, avisos, cores, nomes, selecionado, onSelect }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const node = host.current;
    if (!node || !malha) return;
    let cancelled = false;
    let map: LeafletMap | null = null;

    const pintar = (codarea: string): PathOptions => {
      const ativo = codarea === selecionado;
      const dark = document.documentElement.dataset.theme === "dark";
      return {
        color: ativo ? "#f8fafc" : dark ? "#cbd5e1" : "#0f172a",
        weight: ativo ? 2.5 : 0.8,
        fillColor: cores[codarea] ?? "#94a3b8",
        fillOpacity: 0.82,
      };
    };

    (async () => {
      const L = leafletNamespace(await import("leaflet"));
      if (cancelled || !node.isConnected) return;
      resetLeafletHost(node);
      map = L.map(node, { zoomControl: true, attributionControl: true, minZoom: 3 });
      addOsmTiles(L, map);

      const territorio: GeoJSONLayer = L.geoJSON(malha, {
        style: (feature) => pintar(String(feature?.properties?.codarea ?? "")),
        onEachFeature: (feature, layer) => {
          const codarea = String(feature?.properties?.codarea ?? "");
          const nome = nomes[codarea] || codarea;
          layer.bindTooltip(nome, { sticky: true });
          layer.on("click", () => onSelectRef.current(codarea));
        },
      }).addTo(map);

      if (avisos?.features?.length) {
        L.geoJSON(avisos, {
          interactive: false,
          style: (feature) => {
            const cor = typeof feature?.properties?.cor === "string" ? feature.properties.cor : "#FFFE00";
            return { color: cor, weight: 1.5, fillColor: cor, fillOpacity: 0.18 };
          },
        }).addTo(map);
      }

      const bounds = territorio.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [16, 16] });
      else map.setView([-14.2, -51.9], 4);
    })();

    return () => {
      cancelled = true;
      map?.remove();
      resetLeafletHost(node);
    };
  }, [malha, avisos, cores, nomes, selecionado]);

  return <div ref={host} className="h-full min-h-[320px] w-full" />;
}
