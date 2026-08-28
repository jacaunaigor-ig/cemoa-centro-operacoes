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
  PathOptions,
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
import { AMAZONAS_BOUNDS, AMAZONAS_CENTER, OSM_ATTRIBUTION, OSM_BASEMAP_ID, OSM_TILE_URL } from "@/lib/map";
import { leafletNamespace, resetLeafletHost } from "@/lib/leaflet-osm";
import { reportClientError } from "@/lib/client";
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
    status: HydroStatusFilter;
    modo: HydroMode;
    opacity: number;
    showNames: boolean;
    showRivers: boolean;
    onlyRisk: boolean;
    onSelect: (station: HydroStation) => void;
  }
>(function StationsMap(
  {
    stations,
    selected,
    calha,
    status,
    modo,
    opacity,
    showNames,
    showRivers,
    onlyRisk,
    onSelect,
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
  const onSelectRef = useRef(onSelect);
  const stateRef = useRef({
    stations,
    selected,
    calha,
    status,
    modo,
    opacity,
    showNames,
    showRivers,
    onlyRisk,
  });

  useEffect(() => {
    onSelectRef.current = onSelect;
    stateRef.current = {
      stations,
      selected,
      calha,
      status,
      modo,
      opacity,
      showNames,
      showRivers,
      onlyRisk,
    };
  }, [
    stations,
    selected,
    calha,
    status,
    modo,
    opacity,
    showNames,
    showRivers,
    onlyRisk,
    onSelect,
  ]);

  function isVisible(station: HydroStation | undefined) {
    if (!station) return false;
    const { calha: c, status: st, modo: m } = stateRef.current;
    if (c && station.calha !== c) return false;
    if (st === "SL") return station.semLeitura;
    if (st === "COM_LEITURA") return !station.semLeitura;
    if (st === "NORMAL" || st === "MODERADO" || st === "ALTO") {
      return statusAtivo(station, m) === st;
    }
    return true;
  }

  function styleFor(feature?: GeoJSON.Feature): PathOptions {
    const nome = String(feature?.properties?.nome ?? "");
    const { stations: list, selected: sel, opacity: op } = stateRef.current;
    const station = list.find((s) => s.municipio === nome);
    const st = statusMapa(station, stateRef.current.modo);
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

  useImperativeHandle(ref, () => ({
    fitAmazonas: () => {
      const map = mapRef.current;
      const layer = layerRef.current;
      if (!map) return;
      try {
        const bounds = layer?.getBounds();
        if (bounds?.isValid()) {
          map.fitBounds(bounds.pad(0.04), { animate: true, padding: [16, 16] });
          return;
        }
      } catch {
        /* fall through */
      }
      map.setView(AMAZONAS_CENTER, 6);
    },
  }));

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
        preferCanvas: false,
        maxBounds: L.latLngBounds(AMAZONAS_BOUNDS).pad(0.18),
        maxBoundsViscosity: 0.7,
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
            lyr.on("click", () => {
              const s = stateRef.current.stations.find((item) => item.municipio === nome);
              if (s) onSelectRef.current(s);
            });
            lyr.on("mouseover", () => {
              const s = stateRef.current.stations.find((item) => item.municipio === nome);
              const st = statusMapa(s, stateRef.current.modo);
              lyr
                .bindTooltip(
                  `<strong>${nome}</strong><br/>${s?.calha ?? ""} · ${HYDRO_STATUS_LABELS[st]}${
                    s?.cota != null ? `<br/>Cota ${s.cota.toFixed(2)} m` : "<br/>Sem leitura"
                  }`,
                  { sticky: true },
                )
                .openTooltip();
            });
          },
        }).addTo(map);
        layerRef.current = layer;
        map.invalidateSize();
        const bounds = layer.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds.pad(0.04), { animate: false, padding: [16, 16] });
        } else {
          map.setView(AMAZONAS_CENTER, 6, { animate: false });
        }
      } catch (err) {
        reportClientError(
          err instanceof Error ? err.message : "Falha no GeoJSON",
          "StationsMap",
        );
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
      if (stateRef.current.showNames) names.addTo(map);
      if (!stateRef.current.showRivers) map.removeLayer(rios);
      if (stateRef.current.onlyRisk) map.removeLayer(tiles);

      let fitted = Boolean(layerRef.current && map.getSize().x > 40);
      const fitWhenReady = () => {
        map.invalidateSize();
        const size = map.getSize();
        if (size.x < 40 || size.y < 40) return;
        const layer = layerRef.current;
        if (layer) {
          const bounds = layer.getBounds();
          if (bounds.isValid()) {
            map.fitBounds(bounds.pad(0.04), { animate: false, padding: [16, 16] });
            fitted = true;
            return;
          }
        }
        map.setView(AMAZONAS_CENTER, 6, { animate: false });
        fitted = true;
      };

      resizeObs = new ResizeObserver(() => {
        const before = map.getSize();
        map.invalidateSize();
        const after = map.getSize();
        if (!fitted && after.x > 40 && after.y > 40) fitWhenReady();
        else if (before.x < 40 && after.x > 40) fitWhenReady();
      });
      if (hostRef.current) resizeObs.observe(hostRef.current);
      requestAnimationFrame(fitWhenReady);
    }

    void boot();
    return () => {
      cancelled = true;
      resizeObs?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      riversRef.current = null;
      namesRef.current = null;
      tilesRef.current = null;
    };
    // Map is remounted via key={OSM_BASEMAP_ID} when the basemap identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    layerRef.current?.setStyle((feature) => styleFor(feature));
    if (selected) {
      const s = stations.find((item) => item.municipio === selected);
      if (s && mapRef.current) mapRef.current.panTo([s.lat, s.lon], { animate: true });
    }
    // styleFor reads the latest filters from stateRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stations, selected, calha, status, modo, opacity]);

  useEffect(() => {
    const map = mapRef.current;
    const tiles = tilesRef.current;
    if (!map || !tiles) return;
    if (onlyRisk) {
      if (map.hasLayer(tiles)) map.removeLayer(tiles);
    } else if (!map.hasLayer(tiles)) {
      tiles.addTo(map);
    }
  }, [onlyRisk]);

  useEffect(() => {
    const map = mapRef.current;
    const rios = riversRef.current;
    if (!map || !rios) return;
    if (showRivers) {
      if (!map.hasLayer(rios)) rios.addTo(map);
    } else if (map.hasLayer(rios)) {
      map.removeLayer(rios);
    }
  }, [showRivers]);

  useEffect(() => {
    const map = mapRef.current;
    const names = namesRef.current;
    if (!map || !names) return;
    if (showNames) {
      if (!map.hasLayer(names)) names.addTo(map);
    } else if (map.hasLayer(names)) {
      map.removeLayer(names);
    }
  }, [showNames]);

  return (
    <div
      ref={hostRef}
      className="hydro-map absolute inset-0"
      data-basemap={OSM_BASEMAP_ID}
      role="presentation"
    />
  );
});

StationsMap.displayName = "StationsMap";
