"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { GeoJSON as GeoLayer, LayerGroup, Map as LeafletMap, PathOptions } from "leaflet";
import { addOsmTiles, loadLeafletWithCluster, resetLeafletHost } from "@/lib/leaflet-osm";
import { fitMapToAmazonas } from "@/lib/map";
import { addMapCoordinates } from "@/lib/map-coordinates";
import { syncPluviometers, type PluvioStation } from "@/lib/map-overlays";
import { loadMunicipalMesh } from "@/lib/stain-clip";

const SEM_ESTACOES: PluvioStation[] = [];

export function MunicipioChoropleth({
  fills,
  titles,
  selected,
  onSelect,
  className,
  estacoes = SEM_ESTACOES,
  ativo = true,
}: {
  fills: Record<string, string>;
  titles?: Record<string, string>;
  selected?: string | null;
  onSelect?: (nome: string) => void;
  className?: string;
  estacoes?: PluvioStation[];
  ativo?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<GeoLayer | null>(null);
  const pluvioRef = useRef<LayerGroup | null>(null);
  const leafletRef = useRef<Awaited<ReturnType<typeof loadLeafletWithCluster>> | null>(null);
  const fillsRef = useRef(fills);
  const titlesRef = useRef(titles);
  const selectedRef = useRef(selected);
  const onSelectRef = useRef(onSelect);
  const estacoesRef = useRef(estacoes);
  const [ready, setReady] = useState(0);

  fillsRef.current = fills;
  titlesRef.current = titles;
  selectedRef.current = selected;
  onSelectRef.current = onSelect;
  estacoesRef.current = estacoes;

  useEffect(() => {
    if (!ativo) return;
    let cancelled = false;
    const host = hostRef.current;
    if (!host) return;

    function enquadrar(mapa: LeafletMap) {
      if (cancelled || mapa.getContainer().clientWidth < 40) return;
      try {
        fitMapToAmazonas(mapa, false);
      } catch {
        /* o contêiner ainda não tem medida */
      }
    }

    async function boot() {
      const L = await loadLeafletWithCluster();
      if (cancelled || !hostRef.current) return;
      resetLeafletHost(hostRef.current);
      const map = L.map(hostRef.current, { zoomControl: true, attributionControl: true });
      mapRef.current = map;
      if (cancelled) {
        map.remove();
        mapRef.current = null;
        return;
      }
      addMapCoordinates(L, map);
      addOsmTiles(L, map);
      const geo = await loadMunicipalMesh();
      if (cancelled) {
        map.remove();
        mapRef.current = null;
        return;
      }
      if (!map.getPane("pointsPane")) map.createPane("pointsPane");
      const pane = map.getPane("pointsPane");
      if (pane) pane.style.zIndex = "630";
      const layer = L.geoJSON(geo, {
        style: (feature) => paint(String(feature?.properties?.nome ?? "")),
        onEachFeature(feature, lyr) {
          const nome = String(feature.properties?.nome ?? "");
          lyr.bindTooltip(() => titlesRef.current?.[nome] ?? nome, { sticky: true });
          lyr.on("click", () => onSelectRef.current?.(nome));
        },
      }).addTo(map);
      const pluvio = L.layerGroup().addTo(map);
      layerRef.current = layer;
      pluvioRef.current = pluvio;
      leafletRef.current = L;
      syncPluviometers(L, pluvio, estacoesRef.current);
      enquadrar(map);
      requestAnimationFrame(() => enquadrar(map));
      setReady((value) => value + 1);
    }

    void boot();
    const observar = new ResizeObserver(() => {
      if (mapRef.current) enquadrar(mapRef.current);
    });
    observar.observe(host);
    return () => {
      cancelled = true;
      observar.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      pluvioRef.current = null;
      leafletRef.current = null;
    };
  }, [ativo]);

  useEffect(() => {
    const L = leafletRef.current;
    const camada = pluvioRef.current;
    if (!L || !camada || !ready || !ativo) return;
    syncPluviometers(L, camada, estacoes);
  }, [estacoes, ready, ativo]);

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
