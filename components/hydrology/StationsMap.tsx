"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import type {
  GeoJSON as GeoJSONType,
  LayerGroup,
  Map as LeafletMap,
  Path,
  PathOptions,
  TileLayer,
} from "leaflet";
import type { HydroMode, HydroStation, HydroStatusFilter } from "@/lib/types";
import {
  HYDRO_STATUS_COLORS,
  HYDRO_STATUS_LABELS,
  statusAtivo,
  statusMapa,
} from "@/lib/hydrology";
import { addAmazonasRiverFlow } from "@/lib/map-rivers";
import {
  AMAZONAS_CENTER,
  OSM_ATTRIBUTION,
  OSM_BASEMAP_ID,
  OSM_TILE_URL,
  fitMapToAmazonas,
  muniStroke,
  observeAmazonasResize,
  panToIfNeeded,
  scheduleAmazonasFit,
} from "@/lib/map";
import { useOpsMode } from "@/components/shared/OpsMode";
import { loadLeafletWithCluster, resetLeafletHost } from "@/lib/leaflet-osm";
import {
  addTerritoryOverlays,
  applyTerritoryVisibility,
  syncPluviometers,
  type PluvioStation,
  type TerritoryLayers,
  type TerritoryVisibility,
} from "@/lib/map-overlays";
import { reportClientError } from "@/lib/client";
import { withBase } from "@/lib/site";
import "leaflet/dist/leaflet.css";

export type StationsMapHandle = {
  fitAmazonas: () => void;
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
    overlays: TerritoryVisibility;
    pluvio: PluvioStation[];
    onlyRisk: boolean;
    adminMode?: boolean;
    hovered?: string | null;
    onSelect: (station: HydroStation) => void;
    onHover?: (nome: string | null) => void;
    onPaint?: (station: HydroStation) => void;
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
    overlays,
    pluvio,
    onlyRisk,
    adminMode = false,
    hovered,
    onSelect,
    onHover,
    onPaint,
    onGeoError,
  },
  ref,
) {
  const { theme } = useOpsMode();
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const tilesRef = useRef<TileLayer | null>(null);
  const layerRef = useRef<GeoJSONType | null>(null);
  const riversRef = useRef<LayerGroup | null>(null);
  const namesRef = useRef<LayerGroup | null>(null);
  const territoryRef = useRef<TerritoryLayers | null>(null);
  const layersByNameRef = useRef(new Map<string, Path>());
  const prevHoveredRef = useRef<string | null>(null);
  const onSelectRef = useRef(onSelect);
  const onHoverRef = useRef(onHover);
  const onPaintRef = useRef(onPaint);
  const onGeoErrorRef = useRef(onGeoError);
  const stateRef = useRef({
    stations,
    selected,
    hovered: hovered ?? null,
    calha,
    bacia: bacia ?? null,
    status,
    modo,
    opacity,
    adminMode,
    overlays,
    pluvio,
  });

  useEffect(() => {
    onSelectRef.current = onSelect;
    onHoverRef.current = onHover;
    onPaintRef.current = onPaint;
    onGeoErrorRef.current = onGeoError;
    stateRef.current = {
      stations,
      selected,
      hovered: hovered ?? null,
      calha,
      bacia: bacia ?? null,
      status,
      modo,
      opacity,
      adminMode,
      overlays,
      pluvio,
    };
  }, [
    stations,
    selected,
    hovered,
    calha,
    bacia,
    status,
    modo,
    opacity,
    adminMode,
    overlays,
    pluvio,
    onSelect,
    onHover,
    onPaint,
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
    const { stations: list, selected: sel, hovered: hov, opacity: op, status: filter, modo: m } =
      stateRef.current;
    const station = list.find((s) => s.municipio === nome);
    const st = statusMapa(station, m, filter);
    const match = isVisible(station);
    const isSel = sel === nome;
    const isHov = hov === nome;
    const fill = Math.max(0.12, Math.min(0.92, op / 100));
    return {
      color: muniStroke(isSel, isHov, match),
      weight: isSel ? 2.8 : isHov ? 2.4 : match ? 1.05 : 0.7,
      opacity: match || isSel || isHov ? 1 : 0.28,
      fillColor: HYDRO_STATUS_COLORS[st],
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
            lyr.on("click", () => {
              const { adminMode: admin } = stateRef.current;
              const s = stateRef.current.stations.find((item) => item.municipio === nome);
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
              lyr.setTooltipContent(
                `<strong>${prefix}${nome}</strong><br/>${s?.calha ?? ""} · ${HYDRO_STATUS_LABELS[st]}${
                  s?.semLeitura
                    ? "<br/>Sem cota do dia"
                    : s?.cota != null
                      ? `<br/>Cota ${s.cota.toFixed(2)} m`
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
      const territory = addTerritoryOverlays(L, map);
      territoryRef.current = territory;
      applyTerritoryVisibility(L, map, territory, stateRef.current.overlays);
      if (stateRef.current.overlays.pluvio) {
        syncPluviometers(L, territory.pluvio, stateRef.current.pluvio);
      }
      if (!showRivers) map.removeLayer(rios);
      if (onlyRisk) map.removeLayer(tiles);

      if (hostRef.current) cancelResize = observeAmazonasResize(hostRef.current, map);
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
      territoryRef.current = null;
      tilesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    layerRef.current?.setStyle((feature) => styleFor(feature));
    if (selected) layersByNameRef.current.get(selected)?.bringToFront();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stations, selected, calha, bacia, status, modo, opacity, adminMode, theme]);

  const prevSelectedRef = useRef<string | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    const prev = prevSelectedRef.current;
    prevSelectedRef.current = selected;
    if (!selected || adminMode || !map || selected === prev) return;
    const s = stateRef.current.stations.find((item) => item.municipio === selected);
    if (s) panToIfNeeded(map, s.lat, s.lon);
  }, [selected, adminMode]);

  // Hover restyles only the two affected polygons directly — avoids re-styling
  // all ~62 features on every mouseover/mouseout.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hovered]);

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
    applyTerritoryVisibility(leafletRef.current, map, territoryRef.current, overlays);
  }, [overlays]);

  useEffect(() => {
    const L = leafletRef.current;
    const layer = territoryRef.current?.pluvio;
    if (!L || !layer || !overlays.pluvio) return;
    syncPluviometers(L, layer, pluvio);
  }, [pluvio, overlays.pluvio]);

  return (
    <div
      ref={hostRef}
      className={
        adminMode
          ? "hydro-map absolute inset-0 cursor-crosshair"
          : "hydro-map absolute inset-0"
      }
      data-basemap={OSM_BASEMAP_ID}
      role="presentation"
    />
  );
});

StationsMap.displayName = "StationsMap";
