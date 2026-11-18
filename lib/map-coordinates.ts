import type { LeafletMouseEvent, Map as LeafletMap } from "leaflet";

type LeafletNS = typeof import("leaflet");

/** Adds a compact coordinate readout to a map. Mouse movement and taps update it. */
export function addMapCoordinates(L: LeafletNS, map: LeafletMap) {
  const control = L.control({ position: "topright" });

  control.onAdd = () => {
    const element = L.DomUtil.create("div", "leaflet-control map-coordinate-readout");
    element.textContent = "Lat: — · Lon: —";
    element.setAttribute("role", "status");
    element.setAttribute("aria-live", "off");
    element.style.cssText = [
      "margin: 8px 8px 0 0",
      "padding: 6px 9px",
      "border: 1px solid rgba(255,255,255,.2)",
      "border-radius: 6px",
      "background: rgba(15,23,42,.9)",
      "color: #fff",
      "box-shadow: 0 1px 5px rgba(0,0,0,.35)",
      "font: 500 11px/1.3 ui-monospace, SFMono-Regular, Consolas, monospace",
      "white-space: nowrap",
      "pointer-events: none",
    ].join(";");
    return element;
  };

  control.addTo(map);
  const readout = control.getContainer();
  if (!readout) return control;

  const update = (event: LeafletMouseEvent) => {
    readout.textContent = `Lat: ${event.latlng.lat.toFixed(5)} · Lon: ${event.latlng.lng.toFixed(5)}`;
  };

  map.on("mousemove", update);
  map.on("click", update);
  map.once("unload", () => {
    map.off("mousemove", update);
    map.off("click", update);
  });

  return control;
}
