"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { GeoJSON as GeoLayer, Map as LeafletMap, PathOptions } from "leaflet";
import { addOsmTiles, loadLeafletWithCluster, resetLeafletHost } from "@/lib/leaflet-osm";
import { fitMapToAmazonas } from "@/lib/map";
import { withBase } from "@/lib/site";

export function MunicipioChoropleth({
  fills,
  titles,
  selected,
  onSelect,
  className,
}: {
  fills: Record<string, string>;
  titles?: Record<string, string>;
  selected?: string | null;
  onSelect?: (nome: string) => void;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<GeoLayer | null>(null);
  const fillsRef = useRef(fills);
  const titlesRef = useRef(titles);
  const selectedRef = useRef(selected);
  const onSelectRef = useRef(onSelect);
  const [ready, setReady] = useState(0);

  fillsRef.current = fills;
  titlesRef.current = titles;
  selectedRef.current = selected;
  onSelectRef.current = onSelect;

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host) return;

    async function boot() {
      const L = await loadLeafletWithCluster();
      if (cancelled || !hostRef.current) return;
      resetLeafletHost(hostRef.current);
      const map = L.map(hostRef.current, { zoomControl: true, attributionControl: true });
      addOsmTiles(L, map);
      const geo = await fetch(withBase("/geo/amazonas-municipios.json")).then((res) => {
        if (!res.ok) throw new Error("Malha municipal indisponível.");
        return res.json();
      });
      if (cancelled) {
        map.remove();
        return;
      }
      const layer = L.geoJSON(geo, {
        style: (feature) => paint(String(feature?.properties?.nome ?? "")),
        onEachFeature(feature, lyr) {
          const nome = String(feature.properties?.nome ?? "");
          lyr.bindTooltip(() => titlesRef.current?.[nome] ?? nome, { sticky: true });
          lyr.on("click", () => onSelectRef.current?.(nome));
        },
      }).addTo(map);
      layerRef.current = layer;
      mapRef.current = map;
      const refit = () => {
        map.invalidateSize();
        fitMapToAmazonas(map, false);
      };
      refit();
      requestAnimationFrame(refit);
      setReady((value) => value + 1);
    }

    void boot();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    layerRef.current?.setStyle((feature) => paint(String(feature?.properties?.nome ?? "")));
  }, [fills, selected, ready]);

  function paint(nome: string): PathOptions {
    const on = selectedRef.current === nome;
    return {
      color: on ? "#0f172a" : "#64748b",
      weight: on ? 2.4 : 0.7,
      fillColor: fillsRef.current[nome] ?? "#e8eef5",
      fillOpacity: 0.86,
    };
  }

  return (
    <div
      ref={hostRef}
      className={`w-full overflow-hidden rounded-xl border border-border ${className ?? ""}`}
      style={className ? undefined : { height: "min(68vh, 640px)" }}
    />
  );
}
