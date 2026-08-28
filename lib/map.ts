/** Same-origin OSM proxy — never Carto, no API key. */
export const OSM_TILE_URL = "/tiles/osm/{z}/{x}/{y}";

export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';

export const OSM_BASEMAP_ID = "osm-local-proxy-v1";

/** Southwest → northeast, used to keep the boletim map on Amazonas. */
export const AMAZONAS_CENTER: [number, number] = [-3.9, -64.5];
export const AMAZONAS_BOUNDS: [[number, number], [number, number]] = [
  [-9.95, -73.95],
  [2.35, -56.0],
];
