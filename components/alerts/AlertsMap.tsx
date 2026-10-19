"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type {
  CircleMarker,
  GeoJSON as GeoJSONType,
  LayerGroup,
  LeafletMouseEvent,
  Map as LeafletMap,
  Path,
  PathOptions,
  Polyline,
  TileLayer,
  Tooltip,
} from "leaflet";
import type { AlertLevel } from "@/lib/types";
import { LEVEL_COLORS, LEVEL_LABELS } from "@/lib/alert-types";
import { formatMm, formatMmShort, formatWindowsCompact } from "@/lib/rainfall-display";
import { hitsMapBurst, mapBurstThreshold } from "@/lib/monitor-thresholds";
import type { AlertType } from "@/lib/alert-types";
import { formatUg } from "@/lib/air-quality-display";
import { SEM_LEITURA_FILL } from "@/lib/map-observacao";
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
import { addAmazonasRiverFlow } from "@/lib/map-rivers";
import {
  addTerritoryOverlays,
  applyTerritoryVisibility,
  syncAirSensors,
  syncPluviometers,
  type PluvioStation,
  type TerritoryLayers,
  type TerritoryVisibility,
} from "@/lib/map-overlays";
import type { AirQualitySensor } from "@/lib/types";
import { loadLeafletWithCluster, resetLeafletHost } from "@/lib/leaflet-osm";
import {
  estiloSetor,
  loadSetoresR3R4,
  setorEntra,
  SETOR_CORES,
  SETOR_POLIGONO_DESDE_ZOOM,
  SETOR_USO_ROTULO,
  type SetoresR3R4,
  type UsoSetor,
} from "@/lib/setores-r3r4";
import { createMapHoverTip, hideMapHoverTip, showMapHoverTip } from "@/lib/map-hover-tip";
import { reportClientError } from "@/lib/client";
import { loadMunicipalMesh } from "@/lib/stain-clip";
import type { AlertStain } from "@/lib/stains";
import type { InmetAvisoMapa } from "@/lib/inmet-avisos";
import { durationLabel } from "@/lib/alert-duration";
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
  pm25?: number | null;
  hasAirSensor?: boolean;
  observacao?: "classificado" | "com-leitura" | "sem-leitura" | "nao-consultada";
};

export type AlertsMapHandle = {
  fitAmazonas: () => void;
  finishPolygon: () => boolean;
  cancelDraw: () => void;
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
    paintLevel?: string;
    opacity: number;
    showNames: boolean;
    showRivers: boolean;
    overlays: TerritoryVisibility;
    pluvio: PluvioStation[];
    airSensors?: AirQualitySensor[];
    pointKind?: "cemaden" | "air";
    tipo?: AlertType;
    onlyRisk: boolean;
    hovered?: string | null;
    drawMode?: boolean;
    eraseMode?: boolean;
    stains?: AlertStain[];
    inmetAvisos?: InmetAvisoMapa[];
    showInmetAvisos?: boolean;
        focosCalor?: Array<{ lat: number; lon: number; data: string; satelite: string; cor?: string }>;
    showFocosCalor?: boolean;
    showSetores?: boolean;
    setorUso?: UsoSetor;
    fillByNome?: Record<string, string> | null;
    labelByNome?: Record<string, string> | null;
    onSelect: (nome: string, bacia: string) => void;
    onHover?: (nome: string | null) => void;
    onPaint: (id: string, nome: string, bacia: string) => void;
    onPolygonComplete?: (points: Array<{ lat: number; lng: number }>) => void;
    onStainClick?: (stain: AlertStain) => void;
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
    paintLevel = "ALTO",
    opacity,
    showNames,
    showRivers,
    overlays,
    pluvio,
    airSensors = [],
    pointKind = "cemaden",
    tipo = "CHUVA",
    onlyRisk,
    hovered,
    drawMode = false,
    eraseMode = false,
    stains = [],
    inmetAvisos = [],
    showInmetAvisos = false,
    focosCalor = [],
    showFocosCalor = false,
    showSetores = false,
    setorUso = "movimento",
    fillByNome = null,
    labelByNome = null,
    onSelect,
    onHover,
    onPaint,
    onPolygonComplete,
    onStainClick,
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
  const rainLayerRef = useRef<LayerGroup | null>(null);
  const territoryRef = useRef<TerritoryLayers | null>(null);
  const stainLayerRef = useRef<GeoJSONType | null>(null);
  const inmetLayerRef = useRef<GeoJSONType | null>(null);
  const inmetAvisosRef = useRef(inmetAvisos);
  const showInmetRef = useRef(showInmetAvisos);
  inmetAvisosRef.current = inmetAvisos;
  showInmetRef.current = showInmetAvisos;
  const focosLayerRef = useRef<LayerGroup | null>(null);
  const setoresLayerRef = useRef<GeoJSONType | null>(null);
  const setorBolhasRef = useRef<LayerGroup | null>(null);
  const setoresDataRef = useRef<SetoresR3R4 | null>(null);
  const hoverTipRef = useRef<Tooltip | null>(null);
  const [meshReady, setMeshReady] = useState(0);
  const layersByNameRef = useRef(new Map<string, Path>());
  const prevHoveredRef = useRef<string | null>(null);
  const drawLineRef = useRef<Polyline | null>(null);
  const drawDotsRef = useRef<CircleMarker[]>([]);
  const verticesRef = useRef<Array<{ lat: number; lng: number }>>([]);
  const onSelectRef = useRef(onSelect);
  const onHoverRef = useRef(onHover);
  const onPaintRef = useRef(onPaint);
  const onPolygonRef = useRef(onPolygonComplete);
  const onStainClickRef = useRef(onStainClick);
  const onGeoErrorRef = useRef(onGeoError);
  const stateRef = useRef({
    municipios,
    selected,
    hovered: hovered ?? null,
    filter,
    basin,
    calhaNomes: calhaNomes ?? null,
    adminMode,
    paintLevel,
    opacity,
    overlays,
    pluvio,
    airSensors,
    pointKind,
    tipo,
    drawMode,
    eraseMode,
    stains,
    fillByNome,
    labelByNome,
  });

  useEffect(() => {
    onSelectRef.current = onSelect;
    onHoverRef.current = onHover;
    onPaintRef.current = onPaint;
    onPolygonRef.current = onPolygonComplete;
    onStainClickRef.current = onStainClick;
    onGeoErrorRef.current = onGeoError;
    stateRef.current = {
      municipios,
      selected,
      hovered: hovered ?? null,
      filter,
      basin,
      calhaNomes: calhaNomes ?? null,
      adminMode,
      paintLevel,
      opacity,
      overlays,
      pluvio,
      airSensors,
      pointKind,
      tipo,
      drawMode,
      eraseMode,
      stains,
      fillByNome,
      labelByNome,
    };
  }, [
    onSelect,
    onHover,
    onPaint,
    onPolygonComplete,
    onStainClick,
    onGeoError,
    municipios,
    selected,
    hovered,
    filter,
    basin,
    calhaNomes,
    adminMode,
    paintLevel,
    opacity,
    overlays,
    pluvio,
    airSensors,
    pointKind,
    tipo,
    drawMode,
    eraseMode,
    stains,
    fillByNome,
    labelByNome,
  ]);

  function paintFeature(nome: string) {
    const m = stateRef.current.municipios.find((item) => item.nome === nome);
    if (!m) return;
    const level = stateRef.current.paintLevel;
    m.risco = level as AlertLevel;
    const lyr = layersByNameRef.current.get(nome);
    if (lyr) {
      const fill = Math.max(0.12, Math.min(0.92, stateRef.current.opacity / 100));
      lyr.setStyle({
        fillColor: LEVEL_COLORS[level] ?? "#7c8fab",
        fillOpacity: fill,
        color: muniStroke(false, false, true),
        weight: 1.6,
        opacity: 1,
      });
    }
    onPaintRef.current(m.id, m.nome, m.bacia);
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
    if (pts.length < 3) return false;
    onPolygonRef.current?.(pts);
    clearDraw();
    return true;
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

  function syncStains() {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    stainLayerRef.current?.remove();
    stainLayerRef.current = null;
    focosLayerRef.current = null;
    const list = stateRef.current.stains;
    if (!list.length) return;
    if (!map.getPane("stainPane")) {
      const pane = map.createPane("stainPane");
      pane.style.zIndex = "455";
      pane.style.pointerEvents = stateRef.current.drawMode ? "none" : "auto";
    } else {
      const pane = map.getPane("stainPane");
      if (pane) pane.style.pointerEvents = stateRef.current.drawMode ? "none" : "auto";
    }
    const drawing = stateRef.current.drawMode;
    const erasing = stateRef.current.eraseMode;
    const layer = L.geoJSON(
      {
        type: "FeatureCollection",
        features: list.map((stain) => ({
          type: "Feature" as const,
          properties: {
            id: stain.id,
            level: stain.level,
            municipios: stain.municipios,
            issuedBy: stain.issuedBy ?? "",
            ttlMs: stain.ttlMs ?? 0,
          },
          geometry: stain.geometry,
        })),
      } as GeoJSON.FeatureCollection,
      {
        pane: "stainPane",
        interactive: !drawing,
        style: (feature) => {
          const level = String(feature?.properties?.level ?? "");
          const color = LEVEL_COLORS[level] ?? "#f59e0b";
          return {
            color,
            fillColor: color,
            fillOpacity: erasing ? 0.55 : 0.72,
            weight: erasing ? 3 : 2.2,
            opacity: 0.95,
            dashArray: erasing ? "5 3" : undefined,
            className: erasing ? "alert-stain alert-stain-erase" : "alert-stain",
          };
        },
        onEachFeature: (feature, lyr) => {
          const level = String(feature.properties?.level ?? "");
          const munis = (feature.properties?.municipios as string[] | undefined) ?? [];
          const where =
            munis.length === 1
              ? `parte de ${munis[0]}`
              : munis.length
                ? `parte de ${munis.slice(0, 3).join(", ")}${munis.length > 3 ? ` e mais ${munis.length - 3}` : ""}`
                : "área recortada";
          const ttl = Number(feature.properties?.ttlMs ?? 0);
          const by = String(feature.properties?.issuedBy ?? "");
          lyr.bindTooltip(
            erasing
              ? `<strong>Clique para apagar esta mancha</strong><br/>Mancha ${LEVEL_LABELS[level] ?? level}<br/>${where}`
              : `<strong>Mancha ${LEVEL_LABELS[level] ?? level}</strong><br/>${where}${
                  ttl ? ` · ${durationLabel(ttl)}` : ""
                }${by ? ` · ${by}` : ""}<br/><span>Não classifica o município inteiro</span>`,
            { sticky: true },
          );
          if (!erasing) return;
          lyr.on("click", (ev) => {
            L.DomEvent.stopPropagation(ev);
            ev.originalEvent?.preventDefault?.();
            const id = String(feature.properties?.id ?? "");
            const stain = stateRef.current.stains.find((row) => row.id === id);
            if (stain) onStainClickRef.current?.(stain);
          });
        },
      },
    ).addTo(map);
    stainLayerRef.current = layer;
  }

  function syncInmetAvisos() {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    inmetLayerRef.current?.remove();
    inmetLayerRef.current = null;
    const list = showInmetRef.current ? inmetAvisosRef.current : [];
    if (!list.length) return;
    if (!map.getPane("inmetAvisoPane")) {
      const pane = map.createPane("inmetAvisoPane");
      pane.style.zIndex = "620";
      pane.style.pointerEvents = "none";
    }
    const layer = L.geoJSON(
      {
        type: "FeatureCollection",
        features: list.map((aviso) => ({
          type: "Feature" as const,
          properties: {
            id: aviso.id,
            descricao: aviso.descricao,
            severidade: aviso.severidade,
            cor: aviso.cor,
          },
          geometry: aviso.geometry,
        })),
      } as GeoJSON.FeatureCollection,
      {
        pane: "inmetAvisoPane",
        interactive: false,
        style: (feature) => {
          const fill = String(feature?.properties?.cor ?? "#FFFE00");
          return {
            color: "#a16207",
            fillColor: fill,
            fillOpacity: 0.42,
            weight: 1.6,
            opacity: 0.9,
          };
        },
      },
    ).addTo(map);
    inmetLayerRef.current = layer;
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
    const choropleth = stateRef.current.fillByNome?.[nome];
    const semLeitura = !choropleth && m?.observacao === "sem-leitura";
    const semAlertaAr = !choropleth && !semLeitura && stateRef.current.tipo === "INCENDIO" && risco === "BOA";
    const matchLevel =
      semLeitura && f === "BAIXO"
        ? false
        : f === "TODOS" || f === "ATIVOS"
          ? f === "TODOS" || (risco !== "BAIXO" && risco !== "BOA")
          : risco === f;
    const matchBasin = !b || m?.bacia === b;
    const matchCalha = !names || names.length === 0 || names.includes(nome);
    const match = matchLevel && matchBasin && matchCalha;
    const isSel = !stateRef.current.adminMode && sel === nome;
    const isHov = hov === nome;
    const fill = choropleth ? 0.86 : Math.max(0.12, Math.min(0.92, op / 100));
    return {
      color: muniStroke(isSel, isHov, match),
      weight: isSel ? 2.8 : isHov ? 2.4 : match ? 1.1 : 0.7,
      opacity: match || isSel || isHov ? 1 : 0.28,
      fillColor: choropleth ?? (semLeitura ? SEM_LEITURA_FILL : semAlertaAr ? "#d5dde6" : (LEVEL_COLORS[risco] ?? "#7c8fab")),
      dashArray: semLeitura && !choropleth ? "3 3" : undefined,
      fillOpacity: isSel
        ? Math.min(0.96, fill + 0.08)
        : isHov
          ? Math.min(0.94, fill + 0.06)
          : match
            ? fill
            : choropleth
              ? 0.45
              : 0.08,
      className: "muni-path",
    };
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
      hoverTipRef.current = createMapHoverTip(L, map);
      cancelFit = scheduleAmazonasFit(map, L);

      const rios = addAmazonasRiverFlow(L, map);
      rios.addTo(map);
      riversRef.current = rios;

      try {
        const geo = await loadMunicipalMesh();
        if (cancelled) return;

        const layer = L.geoJSON(geo, {
          style: styleFor,
          onEachFeature: (feature, lyr) => {
            const nome = String(feature.properties?.nome ?? "");
            layersByNameRef.current.set(nome, lyr as Path);
            lyr.on("click", (ev) => {
              if (stateRef.current.drawMode) {
                addVertex(ev.latlng.lat, ev.latlng.lng);
                return;
              }
              if (stateRef.current.eraseMode) return;
              if (stateRef.current.adminMode) {
                paintFeature(nome);
                return;
              }
              const m = stateRef.current.municipios.find((item) => item.nome === nome);
              onSelectRef.current(nome, m?.bacia ?? "");
            });
            lyr.on("mousemove", (ev: LeafletMouseEvent) => {
              const m = stateRef.current.municipios.find((item) => item.nome === nome);
              const prefix = stateRef.current.drawMode
                ? "Vértice · "
                : stateRef.current.eraseMode
                  ? "Apagar mancha · "
                  : stateRef.current.adminMode
                    ? "Classificar · "
                    : "";
              const focosN = stateRef.current.labelByNome?.[nome];
              const airTip =
                stateRef.current.pointKind === "air"
                  ? m?.hasAirSensor
                    ? ` · MP2,5 ${formatUg(m.pm25 ?? null)} (ao vivo)`
                    : " · sem monitor"
                  : m?.hasRainStation
                    ? ` · 1/6/24 h ${formatWindowsCompact({
                        mm1h: m.mm1h ?? null,
                        mm6h: m.mm6h ?? null,
                        mm24h: m.mm24h ?? null,
                        mm72h: null,
                        mm96h: null,
                      })} mm${
                        hitsMapBurst(stateRef.current.tipo, m)
                          ? ` · ${mapBurstThreshold(stateRef.current.tipo).label}`
                          : ""
                      }`
                    : "";
              const focosTip =
                focosN != null && focosN !== "0"
                  ? `<br/>${focosN} focos INPE (AQUA)`
                  : "";
              const map = mapRef.current;
              const tip = hoverTipRef.current;
              if (map && tip) {
                const grau =
                  m?.observacao === "sem-leitura"
                    ? "Sem leitura · não é risco baixo"
                    : (LEVEL_LABELS[m?.risco ?? "BAIXO"] ?? m?.risco);
                showMapHoverTip(
                  map,
                  tip,
                  ev.latlng,
                  `<strong>${prefix}${nome}</strong><br/>${m?.bacia ?? ""} · ${grau}${airTip}${focosTip}`,
                );
              }
              onHoverRef.current?.(nome);
            });
            lyr.on("mouseout", () => {
              const map = mapRef.current;
              const tip = hoverTipRef.current;
              if (map && tip) hideMapHoverTip(map, tip);
              onHoverRef.current?.(null);
            });
          },
        }).addTo(map);
        layerRef.current = layer;
        setMeshReady((n) => n + 1);
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
      syncRainBursts(L, rainLayer, stateRef.current.municipios, stateRef.current.tipo, (nome, bacia) => {
        if (stateRef.current.drawMode || stateRef.current.eraseMode) return;
        if (stateRef.current.adminMode) paintFeature(nome);
        else onSelectRef.current(nome, bacia);
      });
      const territory = addTerritoryOverlays(L, map);
      territoryRef.current = territory;
      applyTerritoryVisibility(
        L,
        map,
        territory,
        stateRef.current.overlays,
        stateRef.current.pointKind === "air" ? "PurpleAir ao vivo" : "CEMADEN",
      );
      if (stateRef.current.overlays.pluvio) {
        if (stateRef.current.pointKind === "air") {
          syncAirSensors(L, territory.pluvio, stateRef.current.airSensors);
        } else {
          syncPluviometers(L, territory.pluvio, stateRef.current.pluvio);
        }
      }
      if (!showRivers) map.removeLayer(rios);
      if (onlyRisk) map.removeLayer(tiles);
      syncStains();
      syncInmetAvisos();

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
      stainLayerRef.current = null;
      inmetLayerRef.current = null;
      setoresLayerRef.current = null;
      tilesRef.current = null;
    };
    // Map is remounted via key={OSM_BASEMAP_ID}. Paint handlers read stateRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const riscoSig = municipios.map((m) => `${m.id}:${m.risco}`).join("|");
  const rainBurstSig = municipios
    .filter((m) => pointKind !== "air" && hitsMapBurst(tipo, m))
    .map((m) => `${m.id}:${m.mm1h}:${m.mm24h}`)
    .join("|") + `|${tipo}`;
  const stainSig = stains.map((s) => `${s.id}:${s.level}`).join("|");
  const inmetSig = inmetAvisos.map((aviso) => `${aviso.id}:${aviso.cor}`).join("|");
  const calhaSig = (calhaNomes ?? []).join("|");

  useEffect(() => {
    const layer = layerRef.current;
    layer?.setStyle((feature) => styleFor(feature));
    const labels = stateRef.current.labelByNome;
    for (const [nome, lyr] of layersByNameRef.current) {
      const atual = lyr.getTooltip();
      const permanente = Boolean(atual?.options.permanent);
      if (!labels) {
        if (permanente) lyr.unbindTooltip();
        continue;
      }
      if (permanente) lyr.unbindTooltip();
      const valor = labels[nome] ?? "0";
      lyr.bindTooltip(valor, {
        permanent: true,
        direction: "center",
        className: valor === "0" ? "foco-balao foco-balao-zero" : "foco-balao",
        opacity: 1,
      });
    }
    if (selected) layersByNameRef.current.get(selected)?.bringToFront();
  }, [riscoSig, selected, filter, basin, calhaSig, adminMode, opacity, theme, fillByNome, labelByNome, meshReady]);

  useEffect(() => {
    const L = leafletRef.current;
    const layer = rainLayerRef.current;
    if (!L || !layer) return;
    syncRainBursts(L, layer, municipios, tipo, (nome, bacia) => {
      if (stateRef.current.drawMode || stateRef.current.eraseMode) return;
      if (stateRef.current.adminMode) paintFeature(nome);
      else onSelectRef.current(nome, bacia);
    });
    // municipios is read when the rain signature changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rainBurstSig]);

  const prevSelectedRef = useRef<string | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    const prev = prevSelectedRef.current;
    prevSelectedRef.current = selected;
    if (!selected || adminMode || !map || selected === prev) return;
    const m = stateRef.current.municipios.find((item) => item.nome === selected);
    if (m) panToIfNeeded(map, m.lat, m.lon);
  }, [selected, adminMode]);

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
    syncStains();
  }, [stainSig, drawMode, eraseMode]);

  useEffect(() => {
    syncInmetAvisos();
  }, [inmetSig, showInmetAvisos]);

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
    applyTerritoryVisibility(
      leafletRef.current,
      map,
      territoryRef.current,
      overlays,
        pointKind === "air" ? "PurpleAir ao vivo" : "CEMADEN",
    );
  }, [overlays, pointKind]);
  // Efeito para desenhar/remover os focos de calor
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;

    // Remover camada anterior
    if (focosLayerRef.current) {
      map.removeLayer(focosLayerRef.current);
      focosLayerRef.current = null;
    }

    if (showFocosCalor && focosCalor.length > 0) {
      const layer = L.layerGroup();
      focosCalor.forEach((foco) => {
        const lat = Number(foco.lat);
        const lon = Number(foco.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
        const dot = L.circleMarker([lat, lon], {
          radius: 5,
          fillColor: foco.cor || "#b91c1c",
          color: "#fff7ed",
          weight: 1,
          fillOpacity: 0.9,
          pane: "overlayPane",
        });
        dot.bindTooltip(
          `Foco INPE · ${foco.satelite || "AQUA"} · ${foco.data || ""}`,
          { sticky: true, direction: "top" },
        );
        layer.addLayer(dot);
      });
      layer.addTo(map);
      focosLayerRef.current = layer;
    }
  }, [showFocosCalor, focosCalor]);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;
    const view = map;
    const leaflet = L;
    let cancelled = false;

    function clear() {
      setoresLayerRef.current?.remove();
      setoresLayerRef.current = null;
      setorBolhasRef.current?.remove();
      setorBolhasRef.current = null;
    }

    if (!showSetores) {
      clear();
      return;
    }

    if (!map.getPane("setoresPane")) {
      const pane = map.createPane("setoresPane");
      pane.style.zIndex = "430";
    }
    const pane = map.getPane("setoresPane");
    if (pane) pane.style.pointerEvents = drawMode || eraseMode ? "none" : "auto";

    function draw(data: SetoresR3R4) {
      clear();
      const selectedId =
        stateRef.current.municipios.find((item) => item.nome === stateRef.current.selected)?.id ?? null;
      const uso = setorUso;
      const layer = leaflet.geoJSON(data, {
        pane: "setoresPane",
        filter: (feature) => setorEntra(feature?.properties?.p, uso),
        style: (feature) => estiloSetor(feature?.properties?.g, feature?.properties?.ibge, selectedId),
        onEachFeature(feature, lyr) {
          const ibge = String(feature.properties?.ibge ?? "");
          const codigo = String(feature.properties?.s ?? "");
          const grau = feature.properties?.g === "R4" ? SETOR_CORES.R4.rotulo : SETOR_CORES.R3.rotulo;
          const mun = stateRef.current.municipios.find((item) => item.id === ibge);
          lyr.bindTooltip(
            `<strong>${grau}</strong><br>${SETOR_USO_ROTULO[uso]}<br>${mun?.nome ?? ibge}<br>${codigo}`,
            { sticky: true, opacity: 0.95 },
          );
          lyr.on("click", () => {
            if (stateRef.current.drawMode || stateRef.current.eraseMode || !mun) return;
            if (stateRef.current.adminMode) paintFeature(mun.nome);
            else onSelectRef.current(mun.nome, mun.bacia);
          });
        },
      });
      setoresLayerRef.current = layer;

      const grupos = new Map<string, { lat: number; lon: number; n: number; areas: number; r4: number }>();
      layer.eachLayer((lyr) => {
        const feature = (lyr as { feature?: GeoJSON.Feature }).feature;
        const ring = feature?.geometry?.type === "Polygon" ? feature.geometry.coordinates[0] : null;
        const ibge = String(feature?.properties?.ibge ?? "");
        if (!ring || ring.length < 2 || !ibge) return;
        let x = 0;
        let y = 0;
        const n = ring.length - 1;
        for (let i = 0; i < n; i++) {
          x += ring[i][0];
          y += ring[i][1];
        }
        const atual = grupos.get(ibge) ?? { lat: 0, lon: 0, n: 0, areas: 0, r4: 0 };
        atual.lat += y;
        atual.lon += x;
        atual.n += n;
        atual.areas += 1;
        if (feature?.properties?.g === "R4") atual.r4 += 1;
        grupos.set(ibge, atual);
      });

      const bolhas = leaflet.layerGroup();
      for (const [ibge, grupo] of grupos) {
        if (!grupo.n) continue;
        const mun = stateRef.current.municipios.find((item) => item.id === ibge);
        const cor = grupo.r4 > 0 ? SETOR_CORES.R4 : SETOR_CORES.R3;
        const marker = leaflet.circleMarker([grupo.lat / grupo.n, grupo.lon / grupo.n], {
          pane: "setoresPane",
          radius: Math.min(14, 5 + Math.sqrt(grupo.areas)),
          color: selectedId === ibge ? "#f8fafc" : cor.stroke,
          weight: selectedId === ibge ? 2.5 : 1.2,
          fillColor: cor.fill,
          fillOpacity: 0.92,
        });
        marker.bindTooltip(
          `<strong>${mun?.nome ?? ibge}</strong><br>${SETOR_USO_ROTULO[uso]}<br>${grupo.areas} áreas · ${grupo.r4} em R4`,
          { sticky: true, opacity: 0.95 },
        );
        marker.on("click", (ev) => {
          leaflet.DomEvent.stopPropagation(ev);
          if (stateRef.current.drawMode || stateRef.current.eraseMode || !mun) return;
          if (stateRef.current.adminMode) paintFeature(mun.nome);
          else onSelectRef.current(mun.nome, mun.bacia);
        });
        bolhas.addLayer(marker);
      }
      setorBolhasRef.current = bolhas;
      function focarSelecionado() {
        if (!selectedId) return;
        const doMun = layer.getLayers().filter((lyr) => {
          const feature = (lyr as { feature?: GeoJSON.Feature }).feature;
          return feature?.properties?.ibge === selectedId;
        });
        if (!doMun.length) return;
        const bounds = leaflet.featureGroup(doMun).getBounds();
        if (!bounds.isValid()) return;
        const fitZoom = view.getBoundsZoom(bounds, false, leaflet.point(36, 36));
        const zoom = Math.min(14, Math.max(SETOR_POLIGONO_DESDE_ZOOM, fitZoom || SETOR_POLIGONO_DESDE_ZOOM));
        view.setView(bounds.getCenter(), zoom, { animate: false });
      }
      focarSelecionado();
      syncCamadas();
      // O cartão de detalhe muda a altura do mapa e o ajuste do Amazonas
      // desfaz o zoom. Reaplica depois desse ajuste.
      window.setTimeout(() => {
        if (cancelled) return;
        focarSelecionado();
        syncCamadas();
      }, 220);
    }

    function syncCamadas() {
      const perto = view.getZoom() >= SETOR_POLIGONO_DESDE_ZOOM;
      const polys = setoresLayerRef.current;
      const bolhas = setorBolhasRef.current;
      if (polys) {
        if (perto && !view.hasLayer(polys)) polys.addTo(view);
        if (!perto && view.hasLayer(polys)) view.removeLayer(polys);
      }
      if (bolhas) {
        if (!perto && !view.hasLayer(bolhas)) bolhas.addTo(view);
        if (perto && view.hasLayer(bolhas)) view.removeLayer(bolhas);
      }
    }

    map.on("zoomend", syncCamadas);

    if (setoresDataRef.current) {
      draw(setoresDataRef.current);
      return () => {
        cancelled = true;
        map.off("zoomend", syncCamadas);
      };
    }

    loadSetoresR3R4()
      .then((data) => {
        if (cancelled) return;
        setoresDataRef.current = data;
        draw(data);
      })
      .catch(() => {
        if (!cancelled) {
          onGeoErrorRef.current?.(
            setorUso === "margem"
              ? "Não foi possível desenhar as áreas de erosão de margem."
              : "Não foi possível desenhar as áreas R3/R4.",
          );
        }
      });

    return () => {
      cancelled = true;
      map.off("zoomend", syncCamadas);
    };
  }, [showSetores, setorUso, selected, drawMode, eraseMode, meshReady]);

  return (
    <div
      className={
        adminMode || drawMode || eraseMode
          ? "absolute inset-0 cursor-crosshair"
          : "absolute inset-0"
      }
    >
      <div
        ref={hostRef}
        className="hydro-map absolute inset-0"
        data-basemap={OSM_BASEMAP_ID}
        role="presentation"
      />
    </div>
  );
});

AlertsMap.displayName = "AlertsMap";

function syncRainBursts(
  L: typeof import("leaflet"),
  layer: LayerGroup,
  municipios: Muni[],
  tipo: AlertType,
  onSelect: (nome: string, bacia: string) => void,
) {
  layer.clearLayers();
  const burst = mapBurstThreshold(tipo);
  for (const m of municipios) {
    if (!hitsMapBurst(tipo, m)) continue;
    const shown = burst.window === "24h" ? m.mm24h : m.mm1h;
    const icon = L.divIcon({
      className: "rain-burst-wrap",
      html: `<div class="rain-burst" aria-hidden="true"><span class="rain-burst-core">${formatMmShort(shown)}</span></div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });
    const marker = L.marker([m.lat, m.lon], { icon, keyboard: false, zIndexOffset: 800 });
    marker.bindTooltip(
      `<strong>${m.nome}</strong><br/>${burst.window === "24h" ? "24 h" : "1 h"} ${formatMm(shown)} (${burst.label})`,
      { direction: "top" },
    );
    marker.on("click", (ev) => {
      L.DomEvent.stopPropagation(ev);
      onSelect(m.nome, m.bacia);
    });
    layer.addLayer(marker);
  }
}
