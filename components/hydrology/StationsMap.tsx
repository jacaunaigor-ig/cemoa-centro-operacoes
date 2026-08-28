"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import type {
  CircleMarker,
  GeoJSON as GeoJSONType,
  LayerGroup,
  Map as LeafletMap,
  PathOptions,
  Polyline,
  TileLayer,
} from "leaflet";
import type { HydroMode, HydroStation, HydroStatusFilter } from "@/lib/types";
import {
  HYDRO_RIOS,
  HYDRO_STATUS_COLORS,
  HYDRO_STATUS_LABELS,
  statusAtivo,
  statusMapa,
} from "@/lib/hydrology";
import {
  AMAZONAS_CENTER,
  OSM_ATTRIBUTION,
  OSM_BASEMAP_ID,
  OSM_TILE_URL,
  fitMapToAmazonas,
  mapCenterInAmazonas,
  scheduleAmazonasFit,
} from "@/lib/map";
import { leafletNamespace, resetLeafletHost } from "@/lib/leaflet-osm";
import { reportClientError } from "@/lib/client";
import "leaflet/dist/leaflet.css";

export type StationsMapHandle = {
  fitAmazonas: () => void;
  finishPolygon: () => void;
  cancelDraw: () => void;
};

export const StationsMap = forwardRef<
  StationsMapHandle,
  {
    stations: HydroStation[];
    selected: string | null;
    calha: string | null;
    bacia?: string | null;
    status: HydroStatusFilter;
    modo: HydroMode;
    opacity: number;
    showNames: boolean;
    showRivers: boolean;
    onlyRisk: boolean;
    adminMode?: boolean;
    drawMode?: boolean;
    onSelect: (station: HydroStation) => void;
    onPaint?: (station: HydroStation) => void;
    onPolygonComplete?: (points: Array<{ lat: number; lng: number }>) => void;
    onGeoError?: (message: string | null) => void;
  }
>(function StationsMap(
  {
    stations,
    selected,
    calha,
    bacia,
    status,
    modo,
    opacity,
    showNames,
    showRivers,
    onlyRisk,
    adminMode = false,
    drawMode = false,
    onSelect,
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
  const drawLineRef = useRef<Polyline | null>(null);
  const drawDotsRef = useRef<CircleMarker[]>([]);
  const verticesRef = useRef<Array<{ lat: number; lng: number }>>([]);
  const onSelectRef = useRef(onSelect);
  const onPaintRef = useRef(onPaint);
  const onPolygonRef = useRef(onPolygonComplete);
  const onGeoErrorRef = useRef(onGeoError);
  const stateRef = useRef({
    stations,
    selected,
    calha,
    bacia: bacia ?? null,
    status,
    modo,
    opacity,
    adminMode,
    drawMode,
  });

  useEffect(() => {
    onSelectRef.current = onSelect;
    onPaintRef.current = onPaint;
    onPolygonRef.current = onPolygonComplete;
    onGeoErrorRef.current = onGeoError;
    stateRef.current = {
      stations,
      selected,
      calha,
      bacia: bacia ?? null,
      status,
      modo,
      opacity,
      adminMode,
      drawMode,
    };
  }, [
    stations,
    selected,
    calha,
    bacia,
    status,
    modo,
    opacity,
    adminMode,
    drawMode,
    onSelect,
    onPaint,
    onPolygonComplete,
    onGeoError,
  ]);

  function isVisible(station: HydroStation | undefined) {
    if (!station) return false;
    const { calha: c, bacia: basin, status: st, modo: m } = stateRef.current;
    if (c && station.calha !== c) return false;
    if (basin && station.bacia !== basin) return false;
    if (st === "SL") return station.semLeitura;
    if (st === "COM_LEITURA") return !station.semLeitura;
    if (st === "NORMAL" || st === "MODERADO" || st === "ALTO") {
      return statusAtivo(station, m) === st;
    }
    return true;
  }

  function styleFor(feature?: GeoJSON.Feature): PathOptions {
    const nome = String(feature?.properties?.nome ?? "");
    const { stations: list, selected: sel, opacity: op, status: filter, modo: m } =
      stateRef.current;
    const station = list.find((s) => s.municipio === nome);
    const st = statusMapa(station, m, filter);
    const match = isVisible(station);
    const isSel = sel === nome;
    const fill = Math.max(0.12, Math.min(0.92, op / 100));
    return {
      color: isSel ? "#ffffff" : match ? "rgba(255,255,255,.8)" : "#3a4b60",
      weight: isSel ? 2.8 : match ? 1.05 : 0.7,
      opacity: match || isSel ? 1 : 0.28,
      fillColor: HYDRO_STATUS_COLORS[st],
      fillOpacity: isSel ? Math.min(0.95, fill + 0.12) : match ? fill : 0.08,
      className: "muni-path",
    };
  }

  function clearDraw() {
    verticesRef.current = [];
    drawLineRef.current?.remove();
    drawLineRef.current = null;
    drawDotsRef.current.forEach((d) => d.remove());
    drawDotsRef.current = [];
  }

  function finishPolygon() {
    const pts = verticesRef.current;
    if (pts.length >= 3) onPolygonRef.current?.(pts);
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

  useImperativeHandle(ref, () => ({
    fitAmazonas: () => {
      const map = mapRef.current;
      if (map) fitMapToAmazonas(map, true);
    },
    finishPolygon,
    cancelDraw: clearDraw,
  }));

  useEffect(() => {
    let cancelled = false;
    let resizeObs: ResizeObserver | undefined;
    let cancelFit: (() => void) | undefined;

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

      map.createPane("flowPane");
      const flowPane = map.getPane("flowPane");
      if (flowPane) {
        flowPane.style.zIndex = "455";
        flowPane.style.pointerEvents = "none";
      }
      const flowRenderer = L.svg({ pane: "flowPane" });
      const rios = L.layerGroup();
      const byBoletim = new Map(
        stateRef.current.stations.map((s) => [s.municipioBoletim, s] as const),
      );
      for (const rio of HYDRO_RIOS) {
        const coords = rio.municipios
          .map((nome) => byBoletim.get(nome))
          .filter((s): s is HydroStation => Boolean(s))
          .map((s) => [s.lat, s.lon] as [number, number]);
        if (coords.length < 2) continue;
        L.polyline(coords, {
          renderer: flowRenderer,
          pane: "flowPane",
          color: rio.cor,
          weight: 5.2,
          opacity: 0.28,
          interactive: false,
          className: `river-flow-base flow-${rio.id}`,
        }).addTo(rios);
        L.polyline(coords, {
          renderer: flowRenderer,
          pane: "flowPane",
          color: "#0b1220",
          weight: 2.6,
          opacity: 0.9,
          dashArray: "10 18",
          lineCap: "round",
          interactive: false,
          className: `river-flow-animated flow-${rio.id}`,
        }).addTo(rios);
      }
      rios.addTo(map);
      riversRef.current = rios;

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
              const s = stateRef.current.stations.find((item) => item.municipio === nome);
              if (drawing) {
                addVertex(ev.latlng.lat, ev.latlng.lng);
                return;
              }
              if (admin && s) {
                onPaintRef.current?.(s);
                return;
              }
              if (s) onSelectRef.current(s);
            });
            lyr.on("mouseover", () => {
              const s = stateRef.current.stations.find((item) => item.municipio === nome);
              const st = statusMapa(s, stateRef.current.modo, stateRef.current.status);
              const prefix = stateRef.current.adminMode ? "Editar · " : "";
              lyr
                .bindTooltip(
                  `<strong>${prefix}${nome}</strong><br/>${s?.calha ?? ""} · ${HYDRO_STATUS_LABELS[st]}${
                    s?.semLeitura
                      ? "<br/>Sem cota do dia"
                      : s?.cota != null
                        ? `<br/>Cota ${s.cota.toFixed(2)} m`
                        : ""
                  }`,
                  { sticky: true },
                )
                .openTooltip();
            });
          },
        }).addTo(map);
        layerRef.current = layer;
        onGeoErrorRef.current?.(null);
      } catch (err) {
        reportClientError(
          err instanceof Error ? err.message : "Falha no GeoJSON",
          "StationsMap",
        );
        onGeoErrorRef.current?.("Não foi possível carregar a malha municipal.");
      }

      const names = L.layerGroup();
      for (const s of stateRef.current.stations) {
        const marker = L.circleMarker([s.lat, s.lon], {
          radius: 1,
          opacity: 0,
          fillOpacity: 0,
          interactive: false,
        });
        marker.bindTooltip(s.municipio, {
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
      if (!showRivers) map.removeLayer(rios);
      if (onlyRisk) map.removeLayer(tiles);

      resizeObs = new ResizeObserver(() => {
        const before = map.getSize().y;
        map.invalidateSize();
        const after = map.getSize();
        if (after.x < 40 || after.y < 40) return;
        if (Math.abs(after.y - before) > 48 || !mapCenterInAmazonas(map)) {
          fitMapToAmazonas(map, false);
        }
      });
      if (hostRef.current) resizeObs.observe(hostRef.current);

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
      resizeObs?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      riversRef.current = null;
      namesRef.current = null;
      tilesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    layerRef.current?.setStyle((feature) => styleFor(feature));
    if (selected && !adminMode) {
      const s = stations.find((item) => item.municipio === selected);
      if (s && mapRef.current) mapRef.current.panTo([s.lat, s.lon], { animate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stations, selected, calha, bacia, status, modo, opacity, adminMode]);

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

StationsMap.displayName = "StationsMap";
