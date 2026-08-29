/**
 * Recorta os rios principais do Amazonas a partir da Natural Earth 10m
 * (ne_10m_rivers_lake_centerlines) e grava data/rios-amazonas.json.
 */
import fs from "node:fs";
import path from "node:path";

const SRC = process.argv[2] || "/tmp/rivers/ne_rivers.geojson";
const MUNI = path.resolve("public/geo/amazonas-municipios.json");
const OUT = path.resolve("data/rios-amazonas.json");

/** Recorte um pouco maior que o estado, para o rio entrar pela borda. */
const BBOX = { minLon: -73.9, minLat: -9.9, maxLon: -56.05, maxLat: 2.28 };

const SPECS = [
  {
    id: "solimoes",
    nome: "Solimões–Amazonas",
    cor: "#0ea5e9",
    velocidade: 1.35,
    peso: 6.8,
    names: ["Amazonas"],
    scalerank: 1,
    reverse: true,
    minPart: 200,
  },
  {
    id: "negro",
    nome: "Rio Negro",
    cor: "#2563eb",
    velocidade: 1.7,
    peso: 5.2,
    names: ["Negro"],
    scalerank: 3,
  },
  {
    id: "madeira",
    nome: "Rio Madeira",
    cor: "#0891b2",
    velocidade: 1.55,
    peso: 5,
    names: ["Madeira"],
  },
  {
    id: "purus",
    nome: "Rio Purus",
    cor: "#22d3ee",
    velocidade: 1.85,
    peso: 4.2,
    names: ["Purús"],
  },
  {
    id: "jurua",
    nome: "Rio Juruá",
    cor: "#38bdf8",
    velocidade: 1.95,
    peso: 4,
    names: ["Juruá"],
  },
  {
    id: "japura",
    nome: "Rio Japurá",
    cor: "#4f46e5",
    velocidade: 2.05,
    peso: 5.4,
    names: ["Caquetá", "Japurá"],
    keep: 0.002,
  },
  {
    id: "ica",
    nome: "Rio Içá",
    cor: "#67e8f9",
    velocidade: 2.15,
    peso: 3.4,
    names: ["Putumayo"],
  },
];

const munis = JSON.parse(fs.readFileSync(MUNI, "utf8"));
const rings = [];
for (const f of munis.features) {
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const poly of polys) rings.push(poly[0]);
}

function inRing(lon, lat, ring) {
  let insidePoly = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const hit = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (hit) insidePoly = !insidePoly;
  }
  return insidePoly;
}

function nearRing(lon, lat, ring, max = 0.22) {
  const max2 = max * max;
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i];
    const b = ring[i + 1];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((lon - a[0]) * dx + (lat - a[1]) * dy) / len2));
    const px = a[0] + t * dx;
    const py = a[1] + t * dy;
    if ((lon - px) ** 2 + (lat - py) ** 2 <= max2) return true;
  }
  return false;
}

function inAmazonas(lon, lat) {
  if (lon < BBOX.minLon || lon > BBOX.maxLon || lat < BBOX.minLat || lat > BBOX.maxLat) return false;
  for (const ring of rings) {
    if (inRing(lon, lat, ring) || nearRing(lon, lat, ring)) return true;
  }
  return false;
}

function inside(lon, lat) {
  return inAmazonas(lon, lat);
}

function lerp(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function edgeHit(a, b) {
  const hits = [];
  const edges = [
    { t: (BBOX.minLon - a[0]) / (b[0] - a[0]), axis: 0, val: BBOX.minLon },
    { t: (BBOX.maxLon - a[0]) / (b[0] - a[0]), axis: 0, val: BBOX.maxLon },
    { t: (BBOX.minLat - a[1]) / (b[1] - a[1]), axis: 1, val: BBOX.minLat },
    { t: (BBOX.maxLat - a[1]) / (b[1] - a[1]), axis: 1, val: BBOX.maxLat },
  ];
  for (const e of edges) {
    if (!Number.isFinite(e.t) || e.t <= 0 || e.t >= 1) continue;
    const p = lerp(a, b, e.t);
    const other = e.axis === 0 ? p[1] : p[0];
    const min = e.axis === 0 ? BBOX.minLat : BBOX.minLon;
    const max = e.axis === 0 ? BBOX.maxLat : BBOX.maxLon;
    if (other >= min && other <= max) hits.push({ t: e.t, p });
  }
  hits.sort((x, y) => x.t - y.t);
  return hits;
}

function clipLine(line) {
  const chains = [];
  let cur = [];
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i];
    const b = line[i + 1];
    const aIn = inside(a[0], a[1]);
    const bIn = inside(b[0], b[1]);
    const hits = edgeHit(a, b);
    if (aIn && bIn) {
      if (!cur.length) cur.push(a);
      cur.push(b);
      continue;
    }
    if (aIn && !bIn) {
      if (!cur.length) cur.push(a);
      if (hits[0]) cur.push(hits[0].p);
      if (cur.length >= 2) chains.push(cur);
      cur = [];
      continue;
    }
    if (!aIn && bIn) {
      if (hits.length) cur.push(hits[hits.length - 1].p);
      cur.push(b);
      continue;
    }
    if (hits.length >= 2) {
      if (cur.length >= 2) chains.push(cur);
      cur = [hits[0].p, hits[hits.length - 1].p];
      chains.push(cur);
      cur = [];
    }
  }
  if (cur.length >= 2) chains.push(cur);
  if (!chains.length) return [];
  chains.sort((a, b) => b.length - a.length);
  return chains[0];
}

function dist2(a, b) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

function perpendicularDist(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.sqrt(dist2(p, a));
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function chaikin(points, iters = 2) {
  let pts = points;
  for (let k = 0; k < iters; k++) {
    const out = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      out.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]]);
      out.push([0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
    }
    out.push(pts[pts.length - 1]);
    pts = out;
  }
  return pts;
}

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return [
    0.5 *
      (2 * p1[0] +
        (-p0[0] + p2[0]) * t +
        (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
        (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
    0.5 *
      (2 * p1[1] +
        (-p0[1] + p2[1]) * t +
        (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
        (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
  ];
}

function densify(points, segs = 2) {
  if (points.length < 3) return points;
  const out = [points[0]];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    for (let s = 1; s <= segs; s++) out.push(catmull(p0, p1, p2, p3, s / segs));
  }
  return out;
}

function simplify(points, tol) {
  if (points.length <= 2) return points;
  let maxD = 0;
  let idx = 0;
  const last = points.length - 1;
  for (let i = 1; i < last; i++) {
    const d = perpendicularDist(points[i], points[0], points[last]);
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD > tol) {
    const left = simplify(points.slice(0, idx + 1), tol);
    const right = simplify(points.slice(idx), tol);
    return left.slice(0, -1).concat(right);
  }
  return [points[0], points[last]];
}

function stitch(parts) {
  if (!parts.length) return [];
  const unused = parts.map((p) => p.slice());
  let path = unused.shift();
  while (unused.length) {
    let bestI = -1;
    let bestD = Infinity;
    let mode = "end-start";
    const head = path[0];
    const tail = path[path.length - 1];
    unused.forEach((p, i) => {
      const a = p[0];
      const b = p[p.length - 1];
      const candidates = [
        ["end-start", dist2(tail, a)],
        ["end-end", dist2(tail, b)],
        ["start-end", dist2(head, b)],
        ["start-start", dist2(head, a)],
      ];
      for (const [m, d] of candidates) {
        if (d < bestD) {
          bestD = d;
          bestI = i;
          mode = m;
        }
      }
    });
    if (bestI < 0 || bestD > 0.08 * 0.08) break;
    const nxt = unused.splice(bestI, 1)[0];
    if (mode === "end-start") path = path.concat(nxt.slice(1));
    else if (mode === "end-end") path = path.concat(nxt.slice(0, -1).reverse());
    else if (mode === "start-end") path = nxt.slice(0, -1).concat(path);
    else path = nxt.slice().reverse().slice(0, -1).concat(path);
  }
  return path;
}

function toLatLng(line) {
  return line.map(([lon, lat]) => [+lat.toFixed(4), +lon.toFixed(4)]);
}

const geo = JSON.parse(fs.readFileSync(SRC, "utf8"));
const rios = [];

for (const spec of SPECS) {
  const parts = [];
  for (const f of geo.features) {
    if (!spec.names.includes(f.properties.name)) continue;
    if (spec.scalerank != null && f.properties.scalerank !== spec.scalerank) continue;
    const lines = f.geometry.type === "LineString" ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const line of lines) {
      if (spec.minPart && line.length < spec.minPart) continue;
      const oriented = spec.reverse ? line.slice().reverse() : line;
      const clipped = clipLine(oriented);
      if (clipped.length >= 2) parts.push(clipped);
    }
  }
  const stitched = stitch(parts);
  if (stitched.length < 2) {
    console.error("sem geometria:", spec.id);
    process.exitCode = 1;
    continue;
  }
  const simple = densify(chaikin(simplify(stitched, spec.keep ?? 0.0034), 1), 1);
  rios.push({
    id: spec.id,
    nome: spec.nome,
    cor: spec.cor,
    velocidade: spec.velocidade,
    peso: spec.peso,
    path: toLatLng(simple),
  });
  console.log(
    spec.id,
    "pts",
    stitched.length,
    "→",
    simple.length,
    "start",
    simple[0].map((n) => n.toFixed(2)).join(","),
    "end",
    simple[simple.length - 1].map((n) => n.toFixed(2)).join(","),
  );
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(
  OUT,
  `${JSON.stringify(
    {
      fonte: "Natural Earth 10m river lake centerlines · recorte do estado do Amazonas",
      rios,
    },
    null,
    2,
  )}\n`,
);
console.log("wrote", OUT, fs.statSync(OUT).size, "bytes");
