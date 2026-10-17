"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { GeoJSON as GeoLayer, LayerGroup, Map as LeafletMap, PathOptions } from "leaflet";
import { addOsmTiles, loadLeafletWithCluster, resetLeafletHost } from "@/lib/leaflet-osm";
import { fitMapToAmazonas } from "@/lib/map";
import {
  corMarcador,
  precipDaCamada,
  textoMarcador,
  tintaMarcador,
  type PrevisaoMetrica,
  type PrevisaoPonto,
} from "@/lib/open-meteo";
import { rainHeatColor } from "@/lib/rainfall-display";
import { loadMunicipalMesh } from "@/lib/stain-clip";

const NEUTRO = "#dbe4ef";

export function PrevisaoMap({
  pontos,
  metrica,
  camada,
  selected,
  onSelect,
}: {
  pontos: PrevisaoPonto[];
  metrica: PrevisaoMetrica;
  camada: boolean;
  selected: string | null;
  onSelect: (nome: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<GeoLayer | null>(null);
  const pinsRef = useRef<LayerGroup | null>(null);
  const stateRef = useRef({ pontos, metrica, camada, selected, onSelect });
  stateRef.current = { pontos, metrica, camada, selected, onSelect };

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
      const geo = await loadMunicipalMesh();
      if (cancelled) {
        map.remove();
        return;
      }
      const layer = L.geoJSON(geo, {
        style: (feature) => paint(String(feature?.properties?.nome ?? "")),
        onEachFeature(feature, lyr) {
          const nome = String(feature.properties?.nome ?? "");
          lyr.on("click", () => stateRef.current.onSelect(nome));
        },
      }).addTo(map);
      pinsRef.current = L.layerGroup().addTo(map);
      layerRef.current = layer;
      mapRef.current = map;
      paintPins(L);
      const refit = () => {
        map.invalidateSize();
        fitMapToAmazonas(map, false);
      };
      refit();
      requestAnimationFrame(refit);
    }

    void boot();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      pinsRef.current = null;
    };
  }, []);

  useEffect(() => {
    layerRef.current?.setStyle((feature) => paint(String(feature?.properties?.nome ?? "")));
    let cancelled = false;
    void loadLeafletWithCluster().then((L) => {
      if (!cancelled) paintPins(L);
    });
    return () => {
      cancelled = true;
    };
  }, [pontos, metrica, camada, selected]);

  function pontoDe(nome: string) {
    return stateRef.current.pontos.find((ponto) => ponto.nome === nome) ?? null;
  }

  function paint(nome: string): PathOptions {
    const { metrica: atual, camada: ligar, selected: foco } = stateRef.current;
    const ponto = pontoDe(nome);
    const on = foco === nome;
    const fill = ligar && ponto ? rainHeatColor(precipDaCamada(ponto, atual)) : NEUTRO;
    return {
      color: on ? "#0f172a" : "#64748b",
      weight: on ? 2.4 : 0.7,
      fillColor: fill,
      fillOpacity: ligar ? 0.82 : 0.4,
    };
  }

  function paintPins(L: typeof import("leaflet")) {
    const group = pinsRef.current;
    if (!group) return;
    group.clearLayers();
    const { pontos: lista, metrica: atual } = stateRef.current;
    for (const ponto of lista) {
      const cor = corMarcador(ponto, atual);
      const texto = textoMarcador(ponto, atual);
      const tinta = tintaMarcador(cor);
      const icon = L.divIcon({
        className: "cemoa-prev-pin",
        html: `<span style="display:inline-flex;align-items:center;justify-content:center;min-width:42px;height:20px;padding:0 4px;border-radius:999px;background:${cor};color:${tinta};font:700 10px ui-monospace,monospace;border:1px solid #fff;box-shadow:0 1px 3px rgba(16,32,51,.35)">${texto}</span>`,
        iconSize: [46, 20],
        iconAnchor: [23, 10],
      });
      const dica = [
        ponto.nome,
        ponto.tempC == null ? "temperatura —" : `${ponto.tempC.toLocaleString("pt-BR")} °C agora`,
        `chuva 6 h ${ponto.precip6hMm ?? "—"} mm · 24 h ${ponto.precip24hMm ?? "—"} mm`,
        `probabilidade ${ponto.prob6h ?? "—"}% em 6 h · ${ponto.prob24h ?? "—"}% em 24 h`,
      ].join("<br>");
      L.marker([ponto.lat, ponto.lon], { icon, keyboard: false })
        .bindTooltip(dica, { direction: "top" })
        .on("click", () => stateRef.current.onSelect(ponto.nome))
        .addTo(group);
    }
  }

  return (
    <>
      <style>{`.cemoa-prev-pin{background:transparent !important;border:none !important;}`}</style>
      <div ref={hostRef} className="meteo-map w-full overflow-hidden rounded-xl border border-border" />
    </>
  );
}
