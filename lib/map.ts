/** Same-origin OSM proxy — never Carto, no API key. */
export const OSM_TILE_URL = "/tiles/osm/{z}/{x}/{y}";

export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';

export const OSM_BASEMAP_ID = "osm-local-proxy-v3";

/** Southwest → northeast, used to keep the maps on Amazonas. */
export const AMAZONAS_CENTER: [number, number] = [-3.9, -64.5];
export const AMAZONAS_BOUNDS: [[number, number], [number, number]] = [
  [-9.95, -73.95],
  [2.35, -56.0],
];

const AMAZONAS_LAT = { min: -12, max: 5 } as const;
const AMAZONAS_LNG = { min: -76, max: -54 } as const;
const FIT_PADDING: [number, number] = [16, 16];
const MIN_MAP_PX = 40;

type LeafletMap = import("leaflet").Map;
type ResetView = import("leaflet").ZoomPanOptions & { reset?: boolean };
type ResetFit = import("leaflet").FitBoundsOptions & { reset?: boolean };

export function mapCenterInAmazonas(map: LeafletMap): boolean {
  const c = map.getCenter();
  return (
    c.lat >= AMAZONAS_LAT.min &&
    c.lat <= AMAZONAS_LAT.max &&
    c.lng >= AMAZONAS_LNG.min &&
    c.lng <= AMAZONAS_LNG.max
  );
}

/** Fit only after the container has a real size. Leaflet 0×0 init frames the wrong continent. */
export function fitMapToAmazonas(map: LeafletMap, animate = false): boolean {
  map.invalidateSize();
  const size = map.getSize();
  if (size.x < MIN_MAP_PX || size.y < MIN_MAP_PX) return false;
  // `reset` forces a redraw even when the internal center is already Amazonas
  // (0×0 boot leaves tiles on the wrong continent while getCenter() looks fine).
  const fit: ResetFit = {
    animate,
    padding: FIT_PADDING,
    reset: true,
  };
  map.fitBounds(AMAZONAS_BOUNDS, fit);
  if (!mapCenterInAmazonas(map)) {
    const view: ResetView = { animate: false, reset: true };
    map.setView(AMAZONAS_CENTER, 6, view);
  }
  return mapCenterInAmazonas(map);
}

export function restrictMapToAmazonas(
  map: LeafletMap,
  L: typeof import("leaflet"),
) {
  map.options.maxBoundsViscosity = 0.7;
  map.setMaxBounds(L.latLngBounds(AMAZONAS_BOUNDS).pad(0.18));
}

/**
 * Retry fit after layout (rAF + delayed timeouts). Apply maxBounds only after
 * the first successful Amazonas frame so a 0-size boot cannot lock onto NA.
 */
export function scheduleAmazonasFit(
  map: LeafletMap,
  L: typeof import("leaflet"),
): () => void {
  let cancelled = false;
  let boundsApplied = false;
  const timers: number[] = [];

  const attempt = () => {
    if (cancelled) return;
    if (!fitMapToAmazonas(map, false)) return;
    if (!boundsApplied) {
      restrictMapToAmazonas(map, L);
      boundsApplied = true;
    }
  };

  attempt();
  const raf = requestAnimationFrame(attempt);
  for (const delay of [80, 200, 450, 900]) {
    timers.push(window.setTimeout(attempt, delay));
  }

  return () => {
    cancelled = true;
    cancelAnimationFrame(raf);
    timers.forEach((id) => clearTimeout(id));
  };
}
