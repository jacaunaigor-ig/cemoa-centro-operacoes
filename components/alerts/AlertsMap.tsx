"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type {
  CircleMarker,
  GeoJSON as GeoJSONType,
  LayerGroup,
  Map as LeafletMap,
  Path,
  PathOptions,
  Polyline,
  TileLayer,
} from "leaflet";
import type { AlertLevel } from "@/lib/types";
import { LEVEL_COLORS, LEVEL_LABELS } from "@/lib/alert-types";
import { formatMm, formatMmShort, formatWindowsCompact, INTENSE_MM_PER_H } from "@/lib/rainfall-display";
import {
  AMAZONAS_CENTER,
  OSM_ATTRIBUTION,
  OSM_BASEMAP_ID,
  OSM_TILE_URL,
  fitMapToAmazonas,
  observeAmazonasResize,
  panToIfNeeded,
  scheduleAmazonasFit,
} from "@/lib/map";
import { addAmazonasRiverFlow } from "@/lib/map-rivers";
import {
  addTerritoryOverlays,
  applyTerritoryVisibility,
  syncPluviometers,
  type PluvioStation,
  type TerritoryLayers,
  type TerritoryVisibility,
} from "@/lib/map-overlays";
import { loadLeafletWithCluster, resetLeafletHost } from "@/lib/leaflet-osm";
import { reportClientError } from "@/lib/client";
import { withBase } from "@/lib/site";
import "leaflet/dist/leaflet.css";

type Muni = {
  id: string;
  nome: string;
  bacia: string;
  lon: number;
  lat: number;
  risco: AlertLevel;
  mm1h?: number | null;
  mm6h?: number | null;
  mm24h?: number | null;
  hasRainStation?: boolean;
};

export type AlertsMapHandle = {
  finishPolygon: () => void;
  cancelDraw: () => void;
  fitAmazonas: () => void;
};

export const AlertsMap = forwardRef<
  AlertsMapHandle,
  {
    municipios: Muni[];
    selected: string | null;
    filter: string;
    basin: string | null;
    calhaNomes?: string[] | null;
    adminMode: boolean;
    drawMode: boolean;
    opacity: number;
    showNames: boolean;
    showRivers: boolean;
    overlays: TerritoryVisibility;
    pluvio: PluvioStation[];
    onlyRisk: boolean;
    hovered?: string | null;
    onSelect: (nome: string, bacia: string) => void;
    onHover?: (nome: string | null) => void;
    onPaint: (id: string, nome: string, bacia: string) => void;
    onPolygonComplete: (points: Array<{ lat: number; lng: number }>) => void;
    onGeoError?: (message: string | null) => void;
  }
>(function AlertsMap(
  {
    municipios,
    selected,
    filter,
    basin,
    calhaNomes,
    adminMode,
    drawMode,
    opacity,
    showNames,
    showRivers,
    overlays,
    pluvio,
    onlyRisk,
    hovered,
    onSelect,
    onHover,
    onPaint,
    onPolygonComplete,
    onGeoError,
  },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const tilesRef = useRef<TileLayer | null>(null);
  const layerRef = useRef<GeoJSONType | null>(null);
  const riversRef = useRef<LayerGroup | null>(null);
  const namesRef = useRef<LayerGroup | null>(null);
  const rainLayerRef = useRef<LayerGroup | null>(null);
  const territoryRef = useRef<TerritoryLayers | null>(null);
  const drawLineRef = useRef<Polyline | null>(null);
  const drawDotsRef = useRef<CircleMarker[]>([]);
  const verticesRef = useRef<Array<{ lat: number; lng: number }>>([]);
  const layersByNameRef = useRef(new Map<string, Path>());
  const prevHoveredRef = useRef<string | null>(null);
  const onSelectRef = useRef(onSelect);
  const onHoverRef = useRef(onHover);
  const onPaintRef = useRef(onPaint);
  const onPolygonRef = useRef(onPolygonComplete);
  const onGeoErrorRef = useRef(onGeoError);
  const stateRef = useRef({
    municipios,
    selected,
    hovered: hovered ?? null,
    filter,
    basin,
    calhaNomes: calhaNomes ?? null,
    adminMode,
    drawMode,
    opacity,
    overlays,
    pluvio,
  });

  useEffect(() => {
    onSelectRef.current = onSelect;
    onHoverRef.current = onHover;
    onPaintRef.current = onPaint;
    onPolygonRef.current = onPolygonComplete;
    onGeoErrorRef.current = onGeoError;
    stateRef.current = {
      municipios,
      selected,
      hovered: hovered ?? null,
      filter,
      basin,
      calhaNomes: calhaNomes ?? null,
      adminMode,
      drawMode,
      opacity,
      overlays,
      pluvio,
    };
  }, [
    onSelect,
    onHover,
    onPaint,
    onPolygonComplete,
    onGeoError,
    municipios,
    selected,
    hovered,
    filter,
    basin,
    calhaNomes,
    adminMode,
    drawMode,
    opacity,
    overlays,
    pluvio,
  ]);

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

  function styleFor(feature?: GeoJSON.Feature): PathOptions {
    const nome = String(feature?.properties?.nome ?? "");
    const {
      municipios: list,
      selected: sel,
      hovered: hov,
      filter: f,
      basin: b,
      calhaNomes: names,
      opacity: op,
    } = stateRef.current;
    const m = list.find((item) => item.nome === nome);
    const risco = m?.risco ?? "BAIXO";
    const matchLevel =
      f === "TODOS" || f === "ATIVOS"
        ? f === "TODOS" || (risco !== "BAIXO" && risco !== "BOA")
        : risco === f;
    const matchBasin = !b || m?.bacia === b;
    const matchCalha = !names || names.length === 0 || names.includes(nome);
    const match = matchLevel && matchBasin && matchCalha;
    const isSel = sel === nome;
    const isHov = hov === nome;
    const fill = Math.max(0.12, Math.min(0.92, op / 100));
    return {
      color: isSel ? "#ffffff" : isHov ? "#ffb020" : match ? "rgba(255,255,255,.85)" : "#3a4b60",
      weight: isSel ? 2.8 : isHov ? 2.4 : match ? 1.1 : 0.7,
      opacity: match || isSel || isHov ? 1 : 0.28,
      fillColor: LEVEL_COLORS[risco] ?? "#7c8fab",
      fillOpacity: isSel
        ? Math.min(0.95, fill + 0.12)
        : isHov
          ? Math.min(0.92, fill + 0.18)
          : match
            ? fill
            : 0.08,
      className: "muni-path",
    };
  }

  useImperativeHandle(ref, () => ({
    finishPolygon,
    cancelDraw: clearDraw,
    fitAmazonas: () => {
      const map = mapRef.current;
      if (map) fitMapToAmazonas(map, true);
    },
  }));

  useEffect(() => {
    let cancelled = false;
    let cancelResize: (() => void) | undefined;
    let cancelFit: (() => void) | undefined;

    async function boot() {
      const L = await loadLeafletWithCluster();
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
        worldCopyJump: false,
      }).setView(AMAZONAS_CENTER, 6);

      const tiles = L.tileLayer(OSM_TILE_URL, {
        attribution: OSM_ATTRIBUTION,
        maxZoom: 19,
        minZoom: 2,
        tileSize: 256,
        errorTileUrl:
          "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
      }).addTo(map);
      tilesRef.current = tiles;
      mapRef.current = map;
      cancelFit = scheduleAmazonasFit(map, L);

      const rios = addAmazonasRiverFlow(L, map);
      rios.addTo(map);
      riversRef.current = rios;

      try {
        const geo = await fetch(withBase("/geo/amazonas-municipios.json")).then((r) => {
          if (!r.ok) throw new Error(`GeoJSON HTTP ${r.status}`);
          return r.json();
        });
        if (cancelled) return;

        const layer = L.geoJSON(geo, {
          style: styleFor,
          onEachFeature: (feature, lyr) => {
            const nome = String(feature.properties?.nome ?? "");
            layersByNameRef.current.set(nome, lyr as Path);
            lyr.bindTooltip("", { sticky: true });
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
              lyr.setTooltipContent(
                `<strong>${prefix}${nome}</strong><br/>${m?.bacia ?? ""} · ${LEVEL_LABELS[m?.risco ?? "BAIXO"] ?? m?.risco}${
                  m?.hasRainStation
                    ? ` · 1/6/24 h ${formatWindowsCompact({
                        mm1h: m.mm1h ?? null,
                        mm6h: m.mm6h ?? null,
                        mm24h: m.mm24h ?? null,
                      })} mm${
                        (m.mm1h ?? 0) >= INTENSE_MM_PER_H
                          ? ` · chuva ≥ ${INTENSE_MM_PER_H} mm/h`
                          : ""
                      }`
                    : ""
                }`,
              );
              lyr.openTooltip();
              onHoverRef.current?.(nome);
            });
            lyr.on("mouseout", () => {
              lyr.closeTooltip();
              onHoverRef.current?.(null);
            });
          },
        }).addTo(map);
        layerRef.current = layer;
        onGeoErrorRef.current?.(null);
      } catch (err) {
        reportClientError(
          err instanceof Error ? err.message : "Falha no GeoJSON",
          "AlertsMap",
        );
        onGeoErrorRef.current?.(
          "Não foi possível carregar a malha municipal.",
        );
      }

      const names = L.layerGroup();
      for (const s of stateRef.current.municipios) {
        const marker = L.circleMarker([s.lat, s.lon], {
          radius: 1,
          opacity: 0,
          fillOpacity: 0,
          interactive: false,
        });
        marker.bindTooltip(s.nome, {
          permanent: true,
          direction: "center",
          className: "hydro-muni-label",
          opacity: 1,
          offset: [0, 0],
        });
        names.addLayer(marker);
      }
      namesRef.current = names;
      if (showNames) names.addTo(map);

      map.createPane("rainPane");
      const rainPane = map.getPane("rainPane");
      if (rainPane) rainPane.style.zIndex = "650";
      const rainLayer = L.layerGroup();
      rainLayer.addTo(map);
      rainLayerRef.current = rainLayer;
      syncRainBursts(L, rainLayer, stateRef.current.municipios, (nome, bacia) =>
        onSelectRef.current(nome, bacia),
      );
      const territory = addTerritoryOverlays(L, map);
      territoryRef.current = territory;
      applyTerritoryVisibility(map, territory, stateRef.current.overlays);
      syncPluviometers(L, territory.pluvio, stateRef.current.pluvio);
      if (!showRivers) map.removeLayer(rios);
      if (onlyRisk) map.removeLayer(tiles);

      if (hostRef.current) cancelResize = observeAmazonasResize(hostRef.current, map);

      map.on("dblclick", (ev) => {
        if (!stateRef.current.drawMode) return;
        ev.originalEvent.preventDefault();
        finishPolygon();
      });
    }

    void boot();
    return () => {
      cancelled = true;
      cancelFit?.();
      cancelResize?.();
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      riversRef.current = null;
      namesRef.current = null;
      rainLayerRef.current = null;
      territoryRef.current = null;
      tilesRef.current = null;
    };
    // Map is remounted via key={OSM_BASEMAP_ID}. Draw/paint handlers read stateRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    layer?.setStyle((feature) => styleFor(feature));
    if (selected) layersByNameRef.current.get(selected)?.bringToFront();
  }, [municipios, selected, filter, basin, calhaNomes, adminMode, opacity]);

  useEffect(() => {
    const L = leafletRef.current;
    const layer = rainLayerRef.current;
    if (!L || !layer) return;
    syncRainBursts(L, layer, municipios, (nome, bacia) => onSelectRef.current(nome, bacia));
  }, [municipios]);

  const prevSelectedRef = useRef<string | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    const prev = prevSelectedRef.current;
    prevSelectedRef.current = selected;
    if (!selected || adminMode || !map || selected === prev) return;
    const m = stateRef.current.municipios.find((item) => item.nome === selected);
    if (m) panToIfNeeded(map, m.lat, m.lon);
  }, [selected, adminMode]);

  // Hover restyles only the two affected polygons directly — avoids re-styling
  // all ~62 features on every mouseover/mouseout (see full setStyle effect above).
  useEffect(() => {
    const prev = prevHoveredRef.current;
    if (prev && prev !== hovered) {
      const lyr = layersByNameRef.current.get(prev);
      const feature = (lyr as (Path & { feature?: GeoJSON.Feature }) | undefined)?.feature;
      lyr?.setStyle(styleFor(feature));
    }
    if (hovered) {
      const lyr = layersByNameRef.current.get(hovered);
      const feature = (lyr as (Path & { feature?: GeoJSON.Feature }) | undefined)?.feature;
      if (lyr) {
        lyr.setStyle(styleFor(feature));
        lyr.bringToFront();
      }
    }
    prevHoveredRef.current = hovered ?? null;
  }, [hovered]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (drawMode) map.doubleClickZoom.disable();
    else {
      map.doubleClickZoom.enable();
      clearDraw();
    }
  }, [drawMode]);

  useEffect(() => {
    const map = mapRef.current;
    const tiles = tilesRef.current;
    if (!map || !tiles) return;
    if (onlyRisk) {
      if (map.hasLayer(tiles)) map.removeLayer(tiles);
    } else if (!map.hasLayer(tiles)) tiles.addTo(map);
  }, [onlyRisk]);

  useEffect(() => {
    const map = mapRef.current;
    const rios = riversRef.current;
    if (!map || !rios) return;
    if (showRivers) {
      if (!map.hasLayer(rios)) rios.addTo(map);
    } else if (map.hasLayer(rios)) map.removeLayer(rios);
  }, [showRivers]);

  useEffect(() => {
    const map = mapRef.current;
    const names = namesRef.current;
    if (!map || !names) return;
    if (showNames) {
      if (!map.hasLayer(names)) names.addTo(map);
    } else if (map.hasLayer(names)) map.removeLayer(names);
  }, [showNames]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    applyTerritoryVisibility(map, territoryRef.current, overlays);
  }, [overlays]);

  useEffect(() => {
    const L = leafletRef.current;
    const layer = territoryRef.current?.pluvio;
    if (!L || !layer) return;
    syncPluviometers(L, layer, pluvio);
  }, [pluvio]);

  return (
    <div
      ref={hostRef}
      className={
        adminMode || drawMode
          ? "hydro-map absolute inset-0 cursor-crosshair"
          : "hydro-map absolute inset-0"
      }
      data-basemap={OSM_BASEMAP_ID}
      role="presentation"
    />
  );
});

AlertsMap.displayName = "AlertsMap";

function syncRainBursts(
  L: typeof import("leaflet"),
  layer: LayerGroup,
  municipios: Muni[],
  onSelect: (nome: string, bacia: string) => void,
) {
  layer.clearLayers();
  for (const m of municipios) {
    if ((m.mm1h ?? 0) < INTENSE_MM_PER_H) continue;
    const icon = L.divIcon({
      className: "rain-burst-wrap",
      html: `<div class="rain-burst" aria-hidden="true"><span class="rain-burst-core">${formatMmShort(m.mm1h)}</span></div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });
    const marker = L.marker([m.lat, m.lon], { icon, keyboard: false, zIndexOffset: 800 });
    marker.bindTooltip(
      `<strong>${m.nome}</strong><br/>Chuva intensa ${formatMm(m.mm1h)} / 1 h (≥ ${INTENSE_MM_PER_H} mm/h)`,
      { direction: "top" },
    );
    marker.on("click", (ev) => {
      L.DomEvent.stopPropagation(ev);
      onSelect(m.nome, m.bacia);
    });
    layer.addLayer(marker);
  }
}
