import type { LayerGroup, Map as LeafletMap } from "leaflet";
import {
  COMUNIDADES_INDIGENAS,
  COMUNIDADES_RURAIS,
  LOCALIDADES_FONTE,
  SEDES_MUNICIPAIS,
  localidadeProxima,
  sedeDo,
  type LocalidadePonto,
} from "@/lib/localidades";
import { MUNICIPALITIES } from "@/lib/municipalities";
import { AIR_LABELS, airLevelFromPm25, type AlertType } from "@/lib/alert-types";
import type { AirQualitySensor, RainfallPayload } from "@/lib/types";
import {
  AIR_NETWORK_LABELS,
  airBadgeInteger,
  airBadgeSize,
  airBadgeTextColor,
  airDotColor,
  formatUg,
} from "@/lib/air-quality-display";
import { coordenadaCemaden } from "@/lib/cemaden-estacoes";
import { formatRelative } from "@/lib/utils";

type LeafletNS = typeof import("leaflet");

export type OverlayProduct = AlertType | "BOLETIM";

export type TerritoryLayers = {
  sedes: LayerGroup;
  rurais: LayerGroup;
  indigenas: LayerGroup;
  pluvio: LayerGroup;
  legendEl: HTMLElement | null;
  filled: { rurais: boolean; indigenas: boolean };
};

export type PluvioStation = {
  id: string;
  nome: string;
  munId: string;
  munNome: string;
  mm1h: number | null;
  mm6h: number | null;
  mm24h: number | null;
};

export type TerritoryVisibility = {
  sedes: boolean;
  rurais: boolean;
  indigenas: boolean;
  pluvio: boolean;
  bairros: boolean;
  curvas: boolean;
};

export const DEFAULT_OVERLAYS: TerritoryVisibility = {
  sedes: true,
  rurais: false,
  indigenas: false,
  pluvio: false,
  bairros: false,
  curvas: false,
};

export function showsPluvio(product: OverlayProduct) {
  return product === "CHUVA" || product === "ALAGAMENTO" || product === "MOVIMENTO";
}

export function showsAirSensors(product: OverlayProduct) {
  return product === "INCENDIO";
}

export function showsPointOverlay(product: OverlayProduct) {
  return showsPluvio(product) || showsAirSensors(product);
}

export function effectiveOverlays(
  vis: TerritoryVisibility,
  product: OverlayProduct,
): TerritoryVisibility {
  return {
    sedes: vis.sedes,
    rurais: vis.rurais,
    indigenas: vis.indigenas,
    pluvio: vis.pluvio && showsPointOverlay(product),
    bairros: vis.bairros,
    curvas: vis.curvas,
  };
}

export type PluvioComChuva = PluvioStation & {
  lat: number;
  lon: number;
  mm: number;
  janela: "1 h" | "6 h";
};

/** Janela em que o pluviômetro está registrando chuva agora. O acumulado de 24 h, sozinho, não entra. */
export function leituraComChuva(
  estacao: Pick<PluvioStation, "mm1h" | "mm6h">,
): { mm: number; janela: "1 h" | "6 h" } | null {
  if (estacao.mm1h != null && estacao.mm1h > 0) return { mm: estacao.mm1h, janela: "1 h" };
  if (estacao.mm6h != null && estacao.mm6h > 0) return { mm: estacao.mm6h, janela: "6 h" };
  return null;
}

function posicaoNoGrupo(estacao: PluvioStation, indice: number, total: number) {
  const cemaden = coordenadaCemaden(estacao.id, estacao.nome, estacao.munId);
  const hit = localidadeProxima(estacao.munId, estacao.nome);
  const seat = sedeDo(estacao.munId);
  const baseLat = cemaden?.lat ?? hit?.a ?? seat?.a;
  const baseLng = cemaden?.lon ?? hit?.o ?? seat?.o;
  if (baseLat == null || baseLng == null) return null;
  const placedAtLocality = Boolean(!cemaden && hit && hit.t !== "Sede");
  const [lat, lon] = cemaden || placedAtLocality
    ? [baseLat, baseLng]
    : offsetAround(baseLat, baseLng, indice, total);
  return { lat, lon, catalogo: Boolean(cemaden), sede: !cemaden && !placedAtLocality };
}

export function pluviosPosicionados(stations: PluvioStation[]) {
  const groups = new Map<string, PluvioStation[]>();
  for (const estacao of stations) {
    const list = groups.get(estacao.munId) ?? [];
    list.push(estacao);
    groups.set(estacao.munId, list);
  }
  const out: Array<PluvioStation & { lat: number; lon: number; catalogo: boolean; sede: boolean }> = [];
  for (const list of groups.values()) {
    list.forEach((estacao, indice) => {
      const posicao = posicaoNoGrupo(estacao, indice, list.length);
      if (posicao) out.push({ ...estacao, ...posicao });
    });
  }
  return out;
}

export function pluviosRegistrandoChuva(stations: PluvioStation[]): PluvioComChuva[] {
  return pluviosPosicionados(stations).flatMap((estacao) => {
    const leitura = leituraComChuva(estacao);
    return leitura ? [{ ...estacao, mm: leitura.mm, janela: leitura.janela }] : [];
  });
}

export function distanciaKm(latA: number, lonA: number, latB: number, lonB: number) {
  const raio = 6371;
  const φ1 = (latA * Math.PI) / 180;
  const φ2 = (latB * Math.PI) / 180;
  const dφ = ((latB - latA) * Math.PI) / 180;
  const dλ = ((lonB - lonA) * Math.PI) / 180;
  const h = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  return 2 * raio * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function pluviosNoRaio<T extends { lat: number; lon: number }>(
  lista: T[],
  lat: number,
  lon: number,
  raioKm: number,
) {
  return lista.filter((estacao) => distanciaKm(lat, lon, estacao.lat, estacao.lon) <= raioKm + 0.05);
}

export function pluvioFromRain(rain: RainfallPayload | null | undefined): PluvioStation[] {
  if (!rain) return [];
  const out: PluvioStation[] = [];
  for (const mun of Object.values(rain.byId)) {
    for (const s of mun.estacoes) {
      out.push({
        id: s.id,
        nome: s.nome,
        munId: mun.id,
        munNome: mun.nome,
        mm1h: s.mm1h,
        mm6h: s.mm6h,
        mm24h: s.mm24h,
      });
    }
  }
  return out;
}

function circle(
  L: LeafletNS,
  p: LocalidadePonto,
  color: string,
  radius: number,
  html: string,
) {
  return L.circleMarker([p.a, p.o], {
    radius,
    color: "#fff",
    weight: 1,
    fillColor: color,
    fillOpacity: 0.9,
    pane: "pointsPane",
  }).bindTooltip(html, { direction: "top", opacity: 0.95, className: "map-point-tip" });
}

function clusterGroup(L: LeafletNS, kind: string) {
  const factory = (L as typeof L & { markerClusterGroup?: (opts: object) => LayerGroup }).markerClusterGroup;
  if (!factory) return L.layerGroup();
  return factory({
    maxClusterRadius: 48,
    spiderfyOnMaxZoom: true,
    disableClusteringAtZoom: 11,
    showCoverageOnHover: false,
    iconCreateFunction: (cluster: { getChildCount: () => number }) =>
      L.divIcon({
        html: `<span>${cluster.getChildCount()}</span>`,
        className: `map-cluster map-cluster-${kind}`,
        iconSize: [22, 22],
      }),
  });
}

function fillRurais(L: LeafletNS, layer: LayerGroup) {
  const munNome = new Map(MUNICIPALITIES.map((m) => [m.id, m.nome]));
  for (const p of COMUNIDADES_RURAIS) {
    circle(
      L,
      p,
      "#ca8a04",
      3,
      `<strong>${p.n}</strong><br/>${p.t || "Comunidade rural"} · ${munNome.get(p.m) ?? p.m}`,
    ).addTo(layer);
  }
}

function fillIndigenas(L: LeafletNS, layer: LayerGroup) {
  const munNome = new Map(MUNICIPALITIES.map((m) => [m.id, m.nome]));
  for (const p of COMUNIDADES_INDIGENAS) {
    circle(
      L,
      p,
      "#7c3aed",
      3,
      `<strong>${p.n}</strong><br/>${p.t ? `TI ${p.t} · ` : ""}Comunidade indígena · ${munNome.get(p.m) ?? p.m}`,
    ).addTo(layer);
  }
}

function paintLegend(
  el: HTMLElement | null,
  vis: TerritoryVisibility,
  pointLegend = "CEMADEN",
) {
  if (!el) return;
  const rows: string[] = [];
  const extra = vis.pluvio || vis.rurais || vis.indigenas || vis.bairros || vis.curvas;
  if (vis.sedes && extra) rows.push(`<span><i class="map-legend-sede"></i> Sede</span>`);
  if (vis.pluvio) {
    const air = pointLegend.toLowerCase().includes("purple");
    rows.push(
      `<span><i class="${air ? "map-legend-air" : "map-legend-pluvio"}"></i> ${pointLegend}</span>`,
    );
  }
  if (vis.rurais) rows.push(`<span><i style="background:#ca8a04"></i> Rural</span>`);
  if (vis.indigenas) rows.push(`<span><i style="background:#7c3aed"></i> Indígena</span>`);
  if (vis.bairros) rows.push(`<span><i style="background:#94a3b8"></i> Bairros de Manaus</span>`);
  if (vis.curvas) rows.push(`<span><i style="background:#0e7490"></i> Curvas de 10 m</span>`);
  if (!rows.length) {
    el.hidden = true;
    el.innerHTML = "";
    return;
  }
  el.hidden = false;
  el.innerHTML = `<strong>Apoio</strong>${rows.join("")}<small>${LOCALIDADES_FONTE}</small>`;
}

export function addTerritoryOverlays(L: LeafletNS, map: LeafletMap): TerritoryLayers {
  if (!map.getPane("pointsPane")) map.createPane("pointsPane");
  const pane = map.getPane("pointsPane");
  if (pane) pane.style.zIndex = "630";

  const sedes = L.layerGroup();
  const rurais = clusterGroup(L, "rural");
  const indigenas = clusterGroup(L, "indio");
  const pluvio = L.layerGroup();

  const sedeIcon = L.divIcon({
    className: "map-sede-icon",
    html: "<span></span>",
    iconSize: [11, 14],
    iconAnchor: [5, 13],
  });
  for (const p of SEDES_MUNICIPAIS) {
    L.marker([p.a, p.o], {
      icon: sedeIcon,
      keyboard: false,
      pane: "pointsPane",
      zIndexOffset: 20,
    })
      .bindTooltip(`<strong>${p.n}</strong><br/>Sede municipal`, {
        direction: "top",
        opacity: 0.95,
        className: "map-point-tip",
      })
      .addTo(sedes);
  }

  let legendEl: HTMLElement | null = null;
  const legend = new L.Control({ position: "bottomright" });
  legend.onAdd = () => {
    legendEl = L.DomUtil.create("div", "map-layer-legend");
    legendEl.hidden = true;
    L.DomEvent.disableClickPropagation(legendEl);
    return legendEl;
  };
  legend.addTo(map);

  return {
    sedes,
    rurais,
    indigenas,
    pluvio,
    legendEl,
    filled: { rurais: false, indigenas: false },
  };
}

function offsetAround(lat: number, lng: number, index: number, total: number): [number, number] {
  if (total <= 1) return [lat, lng];
  const ang = (index / total) * Math.PI * 2;
  const d = 0.01;
  return [lat + Math.sin(ang) * d, lng + Math.cos(ang) * d];
}

export function syncPluviometers(L: LeafletNS, layer: LayerGroup, stations: PluvioStation[]) {
  layer.clearLayers();
  const icon = L.divIcon({
    className: "map-pluvio-icon",
    html: "<span></span>",
    iconSize: [8, 8],
    iconAnchor: [4, 4],
  });
  for (const s of pluviosPosicionados(stations)) {
    const mm = [s.mm1h, s.mm6h, s.mm24h]
      .map((v) => (v == null ? "—" : v.toFixed(1)))
      .join(" / ");
    const origem = s.catalogo
      ? "<br/>Coordenada do catálogo CEMADEN"
      : s.sede
        ? "<br/><em>Posição na sede — esta estação não está no catálogo de coordenadas</em>"
        : "";
    L.marker([s.lat, s.lon], {
      icon,
      keyboard: false,
      pane: "pointsPane",
      zIndexOffset: 40,
    })
      .bindTooltip(
        `<strong>${s.nome}</strong><br/>CEMADEN · ${s.munNome}<br/>1 / 6 / 24 h: ${mm} mm${origem}`,
        { direction: "top", className: "map-point-tip" },
      )
      .addTo(layer);
  }
}

export function syncAirSensors(L: LeafletNS, layer: LayerGroup, sensors: AirQualitySensor[]) {
  layer.clearLayers();
  const ordered = [...sensors].sort((a, b) => a.pm25 - b.pm25);
  for (const s of ordered) {
    const n = airBadgeInteger(s.pm25);
    const size = airBadgeSize(s.pm25);
    const color = airDotColor(s);
    const ink = s.anomalous ? "#ffffff" : airBadgeTextColor(s.pm25);
    const level = s.anomalous ? "leitura anômala" : AIR_LABELS[airLevelFromPm25(s.pm25)];
    const place = s.indoor ? "interno" : "externo";
    const where = s.municipioNome
      ? `${s.municipioNome}${s.kmSede != null ? ` · ${s.kmSede.toLocaleString("pt-BR")} km da sede` : ""}`
      : "fora da malha CEMOA";
    const padTop = s.indoor ? 8 : 0;
    const icon = L.divIcon({
      className: "map-air-icon",
      html: `<span class="map-air-badge${s.indoor ? " is-indoor" : ""}${s.anomalous ? " is-anom" : ""}" style="--air:${color};color:${ink};width:${size}px;height:${size}px;font-size:${size >= 26 ? 10 : 9}px">${s.indoor ? '<i class="map-air-house" aria-hidden="true"></i>' : ""}<b>${n}</b></span>`,
      iconSize: [size, size + padTop],
      iconAnchor: [size / 2, size / 2 + padTop],
    });
    L.marker([s.lat, s.lon], {
      icon,
      keyboard: false,
      pane: "pointsPane",
      zIndexOffset: 40 + Math.min(90, n),
    })
      .bindTooltip(
        `<strong>${s.name}</strong><br/>${AIR_NETWORK_LABELS[s.network]} · ${place} · ${where}<br/>MP2,5 ao vivo ${formatUg(s.pm25)}${
          s.pm25Cf1 != null ? ` · CF=1 ${formatUg(s.pm25Cf1)}` : ""
        }${s.pm25Atm != null ? ` · ATM ${formatUg(s.pm25Atm)}` : ""} · ${level}${
          s.temperatureC != null ? `<br/>${s.temperatureC.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} °C` : ""
        }<br/>${formatRelative(s.lastSeen)} · coordenada real PurpleAir${
          s.anomalous ? "<br/><em>Valor acima de 500 µg/m³ — fora da classificação</em>" : ""
        }`,
        { direction: "top", className: "map-point-tip" },
      )
      .addTo(layer);
  }
}

export function setLayerVisible(map: LeafletMap, layer: LayerGroup | null, on: boolean) {
  if (!map || !layer) return;
  if (on) {
    if (!map.hasLayer(layer)) layer.addTo(map);
  } else if (map.hasLayer(layer)) map.removeLayer(layer);
}

export function applyTerritoryVisibility(
  L: LeafletNS | null,
  map: LeafletMap,
  layers: TerritoryLayers | null,
  vis: TerritoryVisibility | null | undefined,
  pointLegend = "CEMADEN",
) {
  if (!layers || !vis) return;
  if (L) {
    if (vis.rurais && !layers.filled.rurais) {
      fillRurais(L, layers.rurais);
      layers.filled.rurais = true;
    }
    if (vis.indigenas && !layers.filled.indigenas) {
      fillIndigenas(L, layers.indigenas);
      layers.filled.indigenas = true;
    }
  }
  setLayerVisible(map, layers.sedes, vis.sedes);
  setLayerVisible(map, layers.rurais, vis.rurais);
  setLayerVisible(map, layers.indigenas, vis.indigenas);
  setLayerVisible(map, layers.pluvio, vis.pluvio);
  paintLegend(layers.legendEl, vis, pointLegend);
}
