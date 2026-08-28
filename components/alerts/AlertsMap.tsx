"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type {
  CircleMarker,
  GeoJSON as GeoJSONType,
  Map as LeafletMap,
  PathOptions,
  Polyline,
} from "leaflet";
import type { RiskLevel } from "@/lib/types";
import { RISK_COLORS, RISK_LABELS } from "@/lib/risk";
import { OSM_BASEMAP_ID } from "@/lib/map";
import { addOsmTiles, leafletNamespace, resetLeafletHost } from "@/lib/leaflet-osm";
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

export type AlertsMapHandle = {
  finishPolygon: () => void;
  cancelDraw: () => void;
};

export const AlertsMap = forwardRef<
  AlertsMapHandle,
  {
    municipios: Muni[];
    selected: string | null;
    filter: RiskLevel | "TODOS";
    basin: string | null;
    adminMode: boolean;
    drawMode: boolean;
    onSelect: (nome: string, bacia: string) => void;
    onPaint: (id: string, nome: string, bacia: string) => void;
    onPolygonComplete: (points: Array<{ lat: number; lng: number }>) => void;
  }
>(function AlertsMap(
  {
    municipios,
    selected,
    filter,
    basin,
    adminMode,
    drawMode,
    onSelect,
    onPaint,
    onPolygonComplete,
  },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const layerRef = useRef<GeoJSONType | null>(null);
  const drawLineRef = useRef<Polyline | null>(null);
  const drawDotsRef = useRef<CircleMarker[]>([]);
  const verticesRef = useRef<Array<{ lat: number; lng: number }>>([]);
  const onSelectRef = useRef(onSelect);
  const onPaintRef = useRef(onPaint);
  const onPolygonRef = useRef(onPolygonComplete);
  const stateRef = useRef({ municipios, selected, filter, basin, adminMode, drawMode });

  useEffect(() => {
    onSelectRef.current = onSelect;
    onPaintRef.current = onPaint;
    onPolygonRef.current = onPolygonComplete;
    stateRef.current = { municipios, selected, filter, basin, adminMode, drawMode };
  }, [onSelect, onPaint, onPolygonComplete, municipios, selected, filter, basin, adminMode, drawMode]);

  function clearDraw() {
    verticesRef.current = [];
    drawLineRef.current?.remove();
    drawLineRef.current = null;
    drawDotsRef.current.forEach((d) => d.remove());
    drawDotsRef.current = [];
  }

  function finishPolygon() {
    const pts = verticesRef.current;
    if (pts.length >= 3) onPolygonRef.current(pts);
    clearDraw();
  }

  function addVertex(lat: number, lng: number) {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    verticesRef.current = [...verticesRef.current, { lat, lng }];
    const last = verticesRef.current.at(-1);
    if (!last) return;
    const dot = L.circleMarker([last.lat, last.lng], {
      radius: 5,
      color: "#ff6a1f",
      fillColor: "#ffb020",
      fillOpacity: 1,
      weight: 2,
    }).addTo(map);
    drawDotsRef.current.push(dot);
    const latlngs = verticesRef.current.map((p) => [p.lat, p.lng] as [number, number]);
    if (drawLineRef.current) drawLineRef.current.setLatLngs(latlngs);
    else {
      drawLineRef.current = L.polyline(latlngs, {
        color: "#ff6a1f",
        weight: 2.5,
        dashArray: "6 4",
      }).addTo(map);
    }
  }

  useImperativeHandle(ref, () => ({ finishPolygon, cancelDraw: clearDraw }));

  useEffect(() => {
    let cancelled = false;
    let resizeObs: ResizeObserver | undefined;

    async function boot() {
      const L = leafletNamespace(await import("leaflet"));
      leafletRef.current = L;
      if (cancelled || !hostRef.current) return;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      resetLeafletHost(hostRef.current);

      const map = L.map(hostRef.current, {
        zoomControl: true,
        minZoom: 5,
        maxZoom: 18,
      }).setView([-4.2, -64.6], 6);

      addOsmTiles(L, map);
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
            lyr.on("click", (ev) => {
              const { adminMode: admin, drawMode: drawing } = stateRef.current;
              const m = stateRef.current.municipios.find((item) => item.nome === nome);
              if (drawing) {
                addVertex(ev.latlng.lat, ev.latlng.lng);
                return;
              }
              if (admin) {
                if (m) onPaintRef.current(m.id, m.nome, m.bacia);
                return;
              }
              onSelectRef.current(nome, m?.bacia ?? "");
            });
            lyr.on("mouseover", () => {
              const m = stateRef.current.municipios.find((item) => item.nome === nome);
              const prefix = stateRef.current.adminMode ? "Classificar · " : "";
              lyr
                .bindTooltip(
                  `<strong>${prefix}${nome}</strong><br/>${m?.bacia ?? ""} · ${RISK_LABELS[m?.risco ?? "BAIXO"]}`,
                  { sticky: true },
                )
                .openTooltip();
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

      map.on("dblclick", (ev) => {
        if (!stateRef.current.drawMode) return;
        ev.originalEvent.preventDefault();
        finishPolygon();
      });

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
    // Map is remounted via key={OSM_BASEMAP_ID} when the basemap identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    if (selected && !adminMode) {
      const m = municipios.find((item) => item.nome === selected);
      if (m && mapRef.current) mapRef.current.panTo([m.lat, m.lon], { animate: true });
    }
  }, [municipios, selected, filter, basin, adminMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (drawMode) map.doubleClickZoom.disable();
    else {
      map.doubleClickZoom.enable();
      clearDraw();
    }
  }, [drawMode]);

  return (
    <div
      ref={hostRef}
      className={adminMode || drawMode ? "absolute inset-0 cursor-crosshair" : "absolute inset-0"}
      data-basemap={OSM_BASEMAP_ID}
      role="presentation"
    />
  );
});

AlertsMap.displayName = "AlertsMap";
