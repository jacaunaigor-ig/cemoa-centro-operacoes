"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { LayerGroup, Map as LeafletMap } from "leaflet";
import { addOsmTiles, loadLeafletWithCluster, resetLeafletHost } from "@/lib/leaflet-osm";
import { fitMapToAmazonas } from "@/lib/map";
import { corTemperatura, type TemperaturaEstacao } from "@/lib/inmet-temperatura";
import { loadMunicipalMesh } from "@/lib/stain-clip";

export function TemperaturaMap({ estacoes }: { estacoes: TemperaturaEstacao[] }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const pinsRef = useRef<LayerGroup | null>(null);
  const estacoesRef = useRef(estacoes);
  estacoesRef.current = estacoes;

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
      L.geoJSON(geo, {
        style: {
          color: "#ffffff",
          weight: 1,
          fillColor: "#dbe4ef",
          fillOpacity: 0.55,
        },
        interactive: false,
      }).addTo(map);
      pinsRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      paint(L);
      const refit = () => {
        map.invalidateSize();
        fitMapToAmazonas(map, false);
      };
      refit();
      requestAnimationFrame(refit);
    }

    function paint(L: typeof import("leaflet")) {
      const group = pinsRef.current;
      if (!group) return;
      group.clearLayers();
      for (const est of estacoesRef.current) {
        const cor = corTemperatura(est.temp);
        const texto = est.temp.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
        const icon = L.divIcon({
          className: "cemoa-temp-pin",
          html: `<span style="display:inline-flex;align-items:center;justify-content:center;min-width:48px;height:22px;padding:0 5px;border-radius:999px;background:${cor};color:#102033;font:700 11px ui-monospace,monospace;border:1px solid #fff;box-shadow:0 1px 3px rgba(16,32,51,.35)">${texto}°</span>`,
          iconSize: [54, 22],
          iconAnchor: [27, 11],
        });
        L.marker([est.lat, est.lon], { icon, keyboard: false })
          .bindTooltip(`${est.nome} · ${est.codigo}<br>${texto} °C · ${est.hora}`, { direction: "top" })
          .addTo(group);
      }
    }

    void boot();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      pinsRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadLeafletWithCluster().then((L) => {
      const group = pinsRef.current;
      if (cancelled || !mapRef.current || !group) return;
      group.clearLayers();
      for (const est of estacoes) {
        const cor = corTemperatura(est.temp);
        const texto = est.temp.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
        const icon = L.divIcon({
          className: "cemoa-temp-pin",
          html: `<span style="display:inline-flex;align-items:center;justify-content:center;min-width:48px;height:22px;padding:0 5px;border-radius:999px;background:${cor};color:#102033;font:700 11px ui-monospace,monospace;border:1px solid #fff;box-shadow:0 1px 3px rgba(16,32,51,.35)">${texto}°</span>`,
          iconSize: [54, 22],
          iconAnchor: [27, 11],
        });
        L.marker([est.lat, est.lon], { icon, keyboard: false })
          .bindTooltip(`${est.nome} · ${est.codigo}<br>${texto} °C · ${est.hora}`, { direction: "top" })
          .addTo(group);
      }
      mapRef.current.invalidateSize();
    });
    return () => {
      cancelled = true;
    };
  }, [estacoes]);

  return (
    <>
      <style>{`.cemoa-temp-pin{background:transparent !important;border:none !important;}`}</style>
      <div ref={hostRef} className="h-[min(68vh,640px)] min-h-80 w-full rounded-xl border border-border" />
    </>
  );
}
