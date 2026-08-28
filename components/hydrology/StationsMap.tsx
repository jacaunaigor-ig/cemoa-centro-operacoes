"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import { RISK_COLORS, RISK_LABELS, isActiveAlert, maxRisk, riskRank } from "@/lib/risk";
import type { HydroStation, RiskLevel } from "@/lib/types";
import { OSM_ATTRIBUTION, OSM_TILE_URL } from "@/lib/map";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

export function StationsMap({
  stations,
  selected,
  basin,
  onSelect,
  onBasin,
}: {
  stations: HydroStation[];
  selected: string | null;
  basin: string | null;
  onSelect: (station: HydroStation) => void;
  onBasin: (bacia: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const stateRef = useRef({ stations, selected, basin });
  const onSelectRef = useRef(onSelect);
  const onBasinRef = useRef(onBasin);

  useEffect(() => {
    stateRef.current = { stations, selected, basin };
    onSelectRef.current = onSelect;
    onBasinRef.current = onBasin;
  }, [stations, selected, basin, onSelect, onBasin]);

  useEffect(() => {
    let cancelled = false;
    let resizeObs: ResizeObserver | undefined;

    async function boot() {
      const L = (await import("leaflet")).default;
      await import("leaflet.markercluster");
      if (cancelled || !hostRef.current || mapRef.current) return;

      const map = L.map(hostRef.current, {
        zoomControl: true,
        minZoom: 5,
        maxZoom: 18,
      }).setView([-4.2, -64.6], 7);

      L.tileLayer(OSM_TILE_URL, {
        attribution: OSM_ATTRIBUTION,
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;

      const paint = () => {
        if (layerRef.current) {
          map.removeLayer(layerRef.current);
          layerRef.current = null;
        }
        const { stations: list, selected: sel, basin: b } = stateRef.current;
        const visible = b ? list.filter((s) => s.bacia === b) : list;
        const zoom = map.getZoom();

        const pinIcon = (risco: RiskLevel, isSel: boolean, missing: boolean) =>
          L.divIcon({
            className: "hydro-pin",
            iconSize: [18, 18],
            iconAnchor: [9, 9],
            html: `<span style="
              display:block;width:${isSel ? 18 : 14}px;height:${isSel ? 18 : 14}px;
              margin:${isSel ? 0 : 2}px auto;border-radius:50%;
              background:${missing ? "#7c8fab" : RISK_COLORS[risco]};
              border:2px solid ${isSel ? "#fff" : "rgba(8,13,23,.85)"};
              box-shadow:0 0 0 ${isSel ? 4 : 0}px rgba(255,255,255,.25);
            "></span>`,
          });

        if (zoom < 6) {
          const group = L.layerGroup();
          const byBasin = new Map<string, HydroStation[]>();
          for (const s of visible) {
            const arr = byBasin.get(s.bacia) ?? [];
            arr.push(s);
            byBasin.set(s.bacia, arr);
          }
          for (const [name, members] of byBasin) {
            const lat = members.reduce((a, s) => a + s.lat, 0) / members.length;
            const lon = members.reduce((a, s) => a + s.lon, 0) / members.length;
            const alerts = members.filter((s) => isActiveAlert(s.risco) || s.semLeitura);
            const top = maxRisk(members.map((s) => s.risco));
            const marker = L.marker([lat, lon], {
              icon: L.divIcon({
                className: "basin-cluster",
                iconSize: [88, 44],
                html: `<div style="
                  min-width:86px;padding:6px 8px;border-radius:12px;
                  background:#121b30;border:1px solid ${RISK_COLORS[top]};
                  color:#f2f6fc;text-align:center;line-height:1.15;
                  box-shadow:0 8px 20px rgba(0,0,0,.4);
                "><strong style="display:block;font-size:10px">${name}</strong>
                <span style="font-size:10px;color:#aebed4">${alerts.length} alerta${alerts.length === 1 ? "" : "s"}</span></div>`,
              }),
            });
            marker.bindPopup(
              `<strong>${name}</strong><br/>${members.length} municípios · maior risco ${RISK_LABELS[top]}`,
            );
            marker.on("click", () => {
              onBasinRef.current(name);
              map.setView([lat, lon], 7, { animate: true });
            });
            group.addLayer(marker);
          }
          group.addTo(map);
          layerRef.current = group;
          return;
        }

        const cluster = L.markerClusterGroup({
          showCoverageOnHover: false,
          maxClusterRadius: 46,
          iconCreateFunction: (cl) => {
            const markers = cl.getAllChildMarkers() as Array<Marker & { options: { risk?: RiskLevel } }>;
            const top = maxRisk(
              markers.map((mk) => (mk.options.risk as RiskLevel | undefined) ?? "BAIXO"),
            );
            return L.divIcon({
              html: `<div style="
                width:36px;height:36px;border-radius:50%;display:grid;place-items:center;
                background:${RISK_COLORS[top]};color:#081018;font-weight:800;font-size:12px;
                border:2px solid #fff;
              ">${cl.getChildCount()}</div>`,
              className: "hydro-cluster",
              iconSize: [36, 36],
            });
          },
        });

        for (const s of visible) {
          const marker = L.marker([s.lat, s.lon], {
            icon: pinIcon(s.risco, sel === s.municipio, s.semLeitura),
            zIndexOffset: sel === s.municipio ? 600 : riskRank(s.risco) * 10,
          }) as Marker & { options: { risk?: RiskLevel } };
          marker.options.risk = s.risco;
          const cota = s.semLeitura ? "Sem leitura" : `${s.cota?.toFixed(2)} m`;
          marker.bindPopup(
            `<div style="min-width:180px">
              <strong>${s.municipio}</strong><br/>
              ${s.rio} · ${s.bacia}<br/>
              Cota: <b>${cota}</b><br/>
              Risco: ${RISK_LABELS[s.risco]}
            </div>`,
          );
          marker.on("click", () => onSelectRef.current(s));
          cluster.addLayer(marker);
        }
        cluster.addTo(map);
        layerRef.current = cluster;
      };

      paint();
      map.on("zoomend", paint);
      (map as LeafletMap & { __paint?: () => void }).__paint = paint;

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
    const map = mapRef.current as (LeafletMap & { __paint?: () => void }) | null;
    map?.__paint?.();
    if (selected) {
      const s = stations.find((item) => item.municipio === selected);
      if (s && map) map.panTo([s.lat, s.lon], { animate: true });
    }
  }, [stations, selected, basin]);

  return <div ref={hostRef} className="absolute inset-0" role="presentation" />;
}
