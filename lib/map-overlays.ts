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
import { MASS_TIPO_LABEL, massRiskDo } from "@/lib/mass-risk";
import { MUNICIPALITIES } from "@/lib/municipalities";
import type { AlertType } from "@/lib/alert-types";
import type { RainfallPayload } from "@/lib/types";

type LeafletNS = typeof import("leaflet");

export type OverlayProduct = AlertType | "BOLETIM";

export type TerritoryLayers = {
  sedes: LayerGroup;
  rurais: LayerGroup;
  indigenas: LayerGroup;
  risco: LayerGroup;
  pluvio: LayerGroup;
  legendEl: HTMLElement | null;
  filled: { rurais: boolean; indigenas: boolean; risco: boolean };
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
  risco: boolean;
  pluvio: boolean;
};

export const DEFAULT_OVERLAYS: TerritoryVisibility = {
  sedes: true,
  rurais: false,
  indigenas: false,
  risco: false,
  pluvio: false,
};

export function showsPluvio(product: OverlayProduct) {
  return product === "CHUVA" || product === "ALAGAMENTO" || product === "MOVIMENTO";
}

export function showsRisco(product: OverlayProduct) {
  return product === "MOVIMENTO";
}

export function effectiveOverlays(
  vis: TerritoryVisibility,
  product: OverlayProduct,
): TerritoryVisibility {
  return {
    sedes: vis.sedes,
    rurais: vis.rurais,
    indigenas: vis.indigenas,
    risco: vis.risco && showsRisco(product),
    pluvio: vis.pluvio && showsPluvio(product),
  };
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

function fillRisco(L: LeafletNS, layer: LayerGroup) {
  for (const m of MUNICIPALITIES) {
    const risk = massRiskDo(m.id);
    if (!risk.setores) continue;
    const sede = sedeDo(m.id);
    if (!sede) continue;
    const tipos = risk.tipos.map((t) => MASS_TIPO_LABEL[t]).join(", ");
    L.circleMarker([sede.a, sede.o], {
      radius: 7,
      color: risk.susceptibilidade === "alta" ? "#b91c1c" : "#c2410c",
      weight: 1.5,
      fillColor: risk.susceptibilidade === "alta" ? "#ef4444" : "#f97316",
      fillOpacity: 0.14,
      pane: "pointsPane",
    })
      .bindTooltip(
        `<strong>Área de risco · ${m.nome}</strong><br/>${risk.setores} setor(es) · ${risk.susceptibilidade}<br/>${tipos}`,
        { direction: "top", className: "map-point-tip" },
      )
      .addTo(layer);
  }
}

function paintLegend(el: HTMLElement | null, vis: TerritoryVisibility) {
  if (!el) return;
  const rows: string[] = [];
  const extra = vis.pluvio || vis.rurais || vis.indigenas || vis.risco;
  if (vis.sedes && extra) rows.push(`<span><i style="background:#111827"></i> Sede</span>`);
  if (vis.pluvio) rows.push(`<span><i class="map-legend-pluvio"></i> CEMADEN</span>`);
  if (vis.rurais) rows.push(`<span><i style="background:#ca8a04"></i> Rural</span>`);
  if (vis.indigenas) rows.push(`<span><i style="background:#7c3aed"></i> Indígena</span>`);
  if (vis.risco) rows.push(`<span><i style="background:#ef4444;border-radius:2px"></i> Risco mapeado</span>`);
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
  if (pane) pane.style.zIndex = "620";

  const sedes = L.layerGroup();
  const rurais = clusterGroup(L, "rural");
  const indigenas = clusterGroup(L, "indio");
  const risco = L.layerGroup();
  const pluvio = L.layerGroup();

  for (const p of SEDES_MUNICIPAIS) {
    circle(L, p, "#111827", 3.5, `<strong>${p.n}</strong><br/>Sede municipal`).addTo(sedes);
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
    risco,
    pluvio,
    legendEl,
    filled: { rurais: false, indigenas: false, risco: false },
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
  const groups = new Map<string, PluvioStation[]>();
  for (const s of stations) {
    const list = groups.get(s.munId) ?? [];
    list.push(s);
    groups.set(s.munId, list);
  }
  for (const [munId, list] of groups) {
    list.forEach((s, i) => {
      const hit = localidadeProxima(munId, s.nome);
      const seat = sedeDo(munId);
      const baseLat = hit?.a ?? seat?.a;
      const baseLng = hit?.o ?? seat?.o;
      if (baseLat == null || baseLng == null) return;
      const placedAtLocality = Boolean(hit && hit.t !== "Sede");
      const [lat, lng] = placedAtLocality
        ? [hit!.a, hit!.o]
        : offsetAround(baseLat, baseLng, i, list.length);
      const mm = [s.mm1h, s.mm6h, s.mm24h]
        .map((v) => (v == null ? "—" : v.toFixed(1)))
        .join(" / ");
      L.marker([lat, lng], {
        icon,
        keyboard: false,
        pane: "pointsPane",
        zIndexOffset: 40,
      })
        .bindTooltip(
          `<strong>${s.nome}</strong><br/>CEMADEN · ${s.munNome}<br/>1 / 6 / 24 h: ${mm} mm${
            placedAtLocality ? "" : "<br/><em>Posição na sede — CEMADEN não publica a coordenada do sensor</em>"
          }`,
          { direction: "top", className: "map-point-tip" },
        )
        .addTo(layer);
    });
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
    if (vis.risco && !layers.filled.risco) {
      fillRisco(L, layers.risco);
      layers.filled.risco = true;
    }
  }
  setLayerVisible(map, layers.sedes, vis.sedes);
  setLayerVisible(map, layers.rurais, vis.rurais);
  setLayerVisible(map, layers.indigenas, vis.indigenas);
  setLayerVisible(map, layers.risco, vis.risco);
  setLayerVisible(map, layers.pluvio, vis.pluvio);
  paintLegend(layers.legendEl, vis);
}
