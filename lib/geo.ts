/** Ray-cast point-in-polygon. Ring is GeoJSON [lon, lat][], optionally closed. */
export function pointInRing(lon: number, lat: number, ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const denom = yj - yi || 1e-12;
    const intersect = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / denom + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function latLngsToRing(points: Array<{ lat: number; lng: number }>) {
  const ring = points.map((p) => [p.lng, p.lat]);
  if (ring.length && (ring[0][0] !== ring.at(-1)?.[0] || ring[0][1] !== ring.at(-1)?.[1])) {
    ring.push([...ring[0]]);
  }
  return ring;
}
