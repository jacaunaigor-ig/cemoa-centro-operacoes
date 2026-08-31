import type { LatLng, Map as LeafletMap, Tooltip } from "leaflet";

type LeafletNS = typeof import("leaflet");

/** One cursor tooltip per map — GeoJSON MultiPolygons must not open a tip per ring. */
export function createMapHoverTip(L: LeafletNS, map: LeafletMap): Tooltip {
  const tip = L.tooltip({
    sticky: true,
    opacity: 0.96,
    className: "muni-hover-tip",
    direction: "top",
    offset: [0, -8],
    permanent: false,
  });

  const hide = () => {
    map.closeTooltip(tip);
  };

  map.getContainer().addEventListener("mouseleave", hide);
  map.on("movestart", hide);
  map.on("zoomstart", hide);
  map.once("unload", () => {
    map.getContainer().removeEventListener("mouseleave", hide);
    map.off("movestart", hide);
    map.off("zoomstart", hide);
    hide();
  });

  return tip;
}

export function showMapHoverTip(map: LeafletMap, tip: Tooltip, latlng: LatLng, html: string) {
  tip.setContent(html);
  tip.setLatLng(latlng);
  if (!tip.isOpen()) tip.addTo(map);
}

export function hideMapHoverTip(map: LeafletMap, tip: Tooltip) {
  map.closeTooltip(tip);
}
