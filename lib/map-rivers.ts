import type { LayerGroup, Map as LeafletMap, Polyline } from "leaflet";
import { AMAZONAS_RIVERS } from "@/lib/rivers";

type LeafletNS = typeof import("leaflet");

function scaleForZoom(zoom: number) {
  return Math.max(0.72, Math.min(1.55, 0.55 + zoom / 12));
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
      stroke.halo.setStyle({ weight: weight + 3.2 });
      stroke.base.setStyle({ weight });
      stroke.flow.setStyle({ weight: Math.max(1.4, weight * 0.42) });
    }
  };

  for (const rio of AMAZONAS_RIVERS) {
    if (rio.path.length < 2) continue;
    const halo = L.polyline(rio.path, {
      renderer,
      pane: "flowPane",
      color: rio.cor,
      weight: rio.peso + 3.2,
      opacity: 0.16,
      lineCap: "round",
      lineJoin: "round",
      interactive: false,
      className: `river-flow-halo flow-${rio.id}`,
    }).addTo(group);
    const base = L.polyline(rio.path, {
      renderer,
      pane: "flowPane",
      color: rio.cor,
      weight: rio.peso,
      opacity: 0.72,
      lineCap: "round",
      lineJoin: "round",
      interactive: true,
      className: `river-flow-base flow-${rio.id}`,
    })
      .bindTooltip(rio.nome, { sticky: true, opacity: 0.92, className: "river-flow-tip" })
      .addTo(group);
    const flow = L.polyline(rio.path, {
      renderer,
      pane: "flowPane",
      color: "#f8fafc",
      weight: Math.max(1.4, rio.peso * 0.42),
      opacity: 0.88,
      dashArray: "16 22",
      lineCap: "round",
      lineJoin: "round",
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
