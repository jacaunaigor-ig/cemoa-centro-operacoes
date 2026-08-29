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
import type { RainfallPayload } from "@/lib/types";

type LeafletNS = typeof import("leaflet");

export type TerritoryLayers = {
  sedes: LayerGroup;
  rurais: LayerGroup;
  indigenas: LayerGroup;
  risco: LayerGroup;
  pluvio: LayerGroup;
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
    weight: 1.2,
    fillColor: color,
    fillOpacity: 0.92,
    pane: "pointsPane",
  }).bindTooltip(html, { direction: "top", opacity: 0.95, className: "map-point-tip" });
}

function clusterGroup(L: LeafletNS, kind: string) {
  const factory = (L as typeof L & { markerClusterGroup?: (opts: object) => LayerGroup }).markerClusterGroup;
  if (!factory) return L.layerGroup();
  return factory({
    maxClusterRadius: 42,
    spiderfyOnMaxZoom: true,
    disableClusteringAtZoom: 11,
    showCoverageOnHover: false,
    iconCreateFunction: (cluster: { getChildCount: () => number }) =>
      L.divIcon({
        html: `<span>${cluster.getChildCount()}</span>`,
        className: `map-cluster map-cluster-${kind}`,
        iconSize: [28, 28],
      }),
  });
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

  const munNome = new Map(MUNICIPALITIES.map((m) => [m.id, m.nome]));

  for (const p of SEDES_MUNICIPAIS) {
    circle(
      L,
      p,
      "#111827",
      5.5,
      `<strong>${p.n}</strong><br/>Sede municipal`,
    ).addTo(sedes);
  }

  for (const p of COMUNIDADES_RURAIS) {
    circle(
      L,
      p,
      "#ca8a04",
      4,
      `<strong>${p.n}</strong><br/>${p.t || "Comunidade rural"} · ${munNome.get(p.m) ?? p.m}`,
    ).addTo(rurais);
  }

  for (const p of COMUNIDADES_INDIGENAS) {
    circle(
      L,
      p,
      "#7c3aed",
      4,
      `<strong>${p.n}</strong><br/>${p.t ? `TI ${p.t} · ` : ""}Comunidade indígena · ${munNome.get(p.m) ?? p.m}`,
    ).addTo(indigenas);
  }

  for (const m of MUNICIPALITIES) {
    const risk = massRiskDo(m.id);
    if (!risk.setores) continue;
    const sede = sedeDo(m.id);
    if (!sede) continue;
    const tipos = risk.tipos.map((t) => MASS_TIPO_LABEL[t]).join(", ");
    L.circleMarker([sede.a, sede.o], {
      radius: 9,
      color: risk.susceptibilidade === "alta" ? "#b91c1c" : "#c2410c",
      weight: 2,
      fillColor: risk.susceptibilidade === "alta" ? "#ef4444" : "#f97316",
      fillOpacity: 0.18,
      pane: "pointsPane",
    })
      .bindTooltip(
        `<strong>Área de risco · ${m.nome}</strong><br/>${risk.setores} setor(es) · ${risk.susceptibilidade}<br/>${tipos}`,
        { direction: "top", className: "map-point-tip" },
      )
      .addTo(risco);
  }

  sedes.addTo(map);
  rurais.addTo(map);
  indigenas.addTo(map);
  risco.addTo(map);
  pluvio.addTo(map);

  const legend = new L.Control({ position: "bottomright" });
  legend.onAdd = () => {
    const el = L.DomUtil.create("div", "map-layer-legend");
    el.innerHTML = `
      <strong>Apoio ao alerta</strong>
      <span><i style="background:#111827"></i> Sede municipal</span>
      <span><i style="background:#2563eb"></i> Pluviômetro CEMADEN</span>
      <span><i style="background:#ca8a04"></i> Comunidade rural</span>
      <span><i style="background:#7c3aed"></i> Comunidade indígena</span>
      <span><i style="background:#ef4444;border-radius:2px"></i> Área de risco mapeada</span>
      <small>${LOCALIDADES_FONTE}</small>
    `;
    L.DomEvent.disableClickPropagation(el);
    return el;
  };
  legend.addTo(map);

  return { sedes, rurais, indigenas, risco, pluvio };
}

function offsetAround(lat: number, lng: number, index: number, total: number): [number, number] {
  if (total <= 1) return [lat, lng];
  const ang = (index / total) * Math.PI * 2;
  const d = 0.012;
  return [lat + Math.sin(ang) * d, lng + Math.cos(ang) * d];
}

export function syncPluviometers(L: LeafletNS, layer: LayerGroup, stations: PluvioStation[]) {
  layer.clearLayers();
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
      L.circleMarker([lat, lng], {
        radius: 6,
        color: "#fff",
        weight: 1.4,
        fillColor: "#2563eb",
        fillOpacity: 0.95,
        pane: "pointsPane",
      })
        .bindTooltip(
          `<strong>${s.nome}</strong><br/>Pluviômetro CEMADEN · ${s.munNome}<br/>1 / 6 / 24 h: ${mm} mm${
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
  map: LeafletMap,
  layers: TerritoryLayers | null,
  vis: TerritoryVisibility,
) {
  if (!layers) return;
  setLayerVisible(map, layers.sedes, vis.sedes);
  setLayerVisible(map, layers.rurais, vis.rurais);
  setLayerVisible(map, layers.indigenas, vis.indigenas);
  setLayerVisible(map, layers.risco, vis.risco);
  setLayerVisible(map, layers.pluvio, vis.pluvio);
}
