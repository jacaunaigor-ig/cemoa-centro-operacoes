import type { Map as LeafletMap } from "leaflet";
import { OSM_ATTRIBUTION, OSM_TILE_URL } from "@/lib/map";

export function leafletNamespace(mod: unknown): typeof import("leaflet") {
  const rec = mod as { default?: typeof import("leaflet") };
  return (rec.default ?? (mod as typeof import("leaflet"))) as typeof import("leaflet");
}

export function resetLeafletHost(host: HTMLElement) {
  const marked = host as HTMLElement & { _leaflet_id?: number };
  if (marked._leaflet_id) {
    marked._leaflet_id = undefined;
    host.replaceChildren();
  }
}

export function addOsmTiles(L: typeof import("leaflet"), map: LeafletMap) {
  L.tileLayer(OSM_TILE_URL, {
    attribution: OSM_ATTRIBUTION,
    maxZoom: 19,
    minZoom: 2,
    tileSize: 256,
    errorTileUrl:
      "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  }).addTo(map);
}
