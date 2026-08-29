import type { LayerGroup, Map as LeafletMap, Polyline } from "leaflet";
import { AMAZONAS_RIVERS } from "@/lib/rivers";

type LeafletNS = typeof import("leaflet");

function scaleForZoom(zoom: number) {
  return Math.max(0.78, Math.min(1.65, 0.5 + zoom / 11));
}

export function addAmazonasRiverFlow(L: LeafletNS, map: LeafletMap): LayerGroup {
  if (!map.getPane("flowPane")) map.createPane("flowPane");
  const pane = map.getPane("flowPane");
  if (pane) {
    pane.style.zIndex = "455";
    pane.style.pointerEvents = "auto";
  }
  const renderer = L.svg({ pane: "flowPane" });
  const group = L.layerGroup();
  const strokes: Array<{ halo: Polyline; base: Polyline; flow: Polyline; peso: number }> = [];

  const applyWeights = () => {
    const scale = scaleForZoom(map.getZoom());
    for (const stroke of strokes) {
      const weight = stroke.peso * scale;
      stroke.halo.setStyle({ weight: weight + 2.8 });
      stroke.base.setStyle({ weight });
      stroke.flow.setStyle({ weight: Math.max(1.2, weight * 0.38) });
    }
  };

  for (const rio of AMAZONAS_RIVERS) {
    if (rio.path.length < 2) continue;
    const halo = L.polyline(rio.path, {
      renderer,
      pane: "flowPane",
      color: rio.cor,
      weight: rio.peso + 2.8,
      opacity: 0.2,
      lineCap: "round",
      lineJoin: "round",
      smoothFactor: 0,
      interactive: false,
      className: `river-flow-halo flow-${rio.id}`,
    }).addTo(group);
    const base = L.polyline(rio.path, {
      renderer,
      pane: "flowPane",
      color: rio.cor,
      weight: rio.peso,
      opacity: 0.82,
      lineCap: "round",
      lineJoin: "round",
      smoothFactor: 0,
      interactive: true,
      className: `river-flow-base flow-${rio.id}`,
    })
      .bindTooltip(rio.nome, { sticky: true, opacity: 0.92, className: "river-flow-tip" })
      .addTo(group);
    const flow = L.polyline(rio.path, {
      renderer,
      pane: "flowPane",
      color: "#f8fafc",
      weight: Math.max(1.2, rio.peso * 0.38),
      opacity: 0.8,
      dashArray: "7 16",
      lineCap: "round",
      lineJoin: "round",
      smoothFactor: 0,
      interactive: false,
      className: `river-flow-animated flow-${rio.id}`,
    }).addTo(group);
    strokes.push({ halo, base, flow, peso: rio.peso });
  }

  applyWeights();
  map.on("zoomend", applyWeights);
  group.on("remove", () => map.off("zoomend", applyWeights));
  return group;
}
