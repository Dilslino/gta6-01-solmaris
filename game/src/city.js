// The city of Solmaris: a road graph (avenues x streets, all connected), buildings
// filling the blocks, parks, a beach and the sea, trees, and named places.
// Everything is generated from the seeded RNG, so the same seed builds the same city.
import { AVENUES, BEACH_Y, DISTRICTS, PALETTE, ROAD_W, STREETS, WORLD } from './config.js';
import { clamp, dist, int, pick, range } from './random.js';

const ROOFS = [PALETTE.roofA, PALETTE.roofB, PALETTE.roofC, PALETTE.roofD, PALETTE.roofE];

export function buildCity(rng) {
  // Road-graph nodes: every avenue x street intersection, plus beach-front nodes.
  const nodes = [];
  const nodeAt = new Map();
  function addNode(x, y) {
    const key = `${x},${y}`;
    if (nodeAt.has(key)) return nodeAt.get(key);
    const n = { x, y, links: [] };
    nodeAt.set(key, n);
    nodes.push(n);
    return n;
  }
  for (const ax of AVENUES) for (const sy of STREETS) addNode(ax, sy);
  // Beach road along the shore.
  for (const ax of AVENUES) addNode(ax, BEACH_Y - 60);
  for (const n of nodes) {
    for (const m of nodes) {
      if (n === m) continue;
      if ((n.x === m.x && Math.abs(n.y - m.y) <= 620) || (n.y === m.y && Math.abs(n.x - m.x) <= 720)) {
        // Only link direct neighbours along the same road.
        let blocked = false;
        for (const o of nodes) {
          if (o === n || o === m) continue;
          if (n.x === m.x && o.x === n.x && ((o.y > n.y && o.y < m.y) || (o.y < n.y && o.y > m.y))) blocked = true;
          if (n.y === m.y && o.y === n.y && ((o.x > n.x && o.x < m.x) || (o.x < n.x && o.x > m.x))) blocked = true;
        }
        if (!blocked) n.links.push(m);
      }
    }
  }

  // Keep-spots: shops, mission markers and the spawn must stay clear of buildings.
  const clearSpots = [
    { x: 1120, y: 980, r: 150 }, { x: 1820, y: 1580, r: 150 }, { x: 3220, y: 2180, r: 160 },
    { x: 3920, y: 980, r: 170 }, { x: 4620, y: 2780, r: 150 }, { x: 4620, y: 3380, r: 170 },
    { x: 1120, y: 2180, r: 150 }, { x: 1820, y: 380, r: 120 }, { x: 2520, y: 1580, r: 120 },
  ];
  const parks = [
    { x: 1300, y: 1760, w: 560, h: 380 },
    { x: 3400, y: 1200, w: 420, h: 300 },
  ];
  const plaza = { x: 3000, y: 760, w: 560, h: 340 };

  const buildings = [];
  const xs = [0, ...AVENUES, WORLD.width];
  const ys = [0, ...STREETS, BEACH_Y];
  for (let bi = 0; bi < xs.length - 1; bi += 1) {
    for (let bj = 0; bj < ys.length - 1; bj += 1) {
      const x0 = xs[bi] + ROAD_W / 2 + 14;
      const x1 = xs[bi + 1] - ROAD_W / 2 - 14;
      const y0 = ys[bj] + ROAD_W / 2 + 14;
      const y1 = ys[bj + 1] - ROAD_W / 2 - 14;
      if (x1 - x0 < 130 || y1 - y0 < 110) continue;
      if (y0 > BEACH_Y - 120) continue;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      let blocked = false;
      for (const p of parks) if (cx > p.x - 40 && cx < p.x + p.w + 40 && cy > p.y - 40 && cy < p.y + p.h + 40) blocked = true;
      if (cx > plaza.x - 40 && cx < plaza.x + plaza.w + 40 && cy > plaza.y - 40 && cy < plaza.y + plaza.h + 40) blocked = true;
      if (blocked) continue;
      // 1-3 buildings per block, in a row or a pair.
      const n = int(rng, 1, 3);
      for (let k = 0; k < n; k += 1) {
        const w = range(rng, 110, Math.min(300, (x1 - x0) / n - 20));
        const h = range(rng, 90, Math.min(240, y1 - y0 - 20));
        const bx = clamp(x0 + ((x1 - x0) / n) * k + range(rng, 6, 24), x0, x1 - w);
        const by = clamp(y0 + range(rng, 8, Math.max(9, y1 - y0 - h - 8)), y0, y1 - h);
        const bcx = bx + w / 2, bcy = by + h / 2;
        let clear = false;
        for (const s of clearSpots) if (dist(bcx, bcy, s.x, s.y) < s.r + Math.max(w, h) / 2) clear = true;
        if (clear) continue;
        const downtown = bcx > 3000 && bcy < 1700;
        buildings.push({
          x: bx, y: by, w, h,
          roof: pick(rng, ROOFS),
          tall: downtown && rng() < 0.55,
          hgt: downtown ? int(rng, 26, 52) : int(rng, 10, 22),
        });
      }
    }
  }

  const trees = [];
  for (let i = 0; i < 220; i += 1) {
    const x = range(rng, 60, WORLD.width - 60);
    const y = range(rng, 60, BEACH_Y - 80);
    if (pointInBuildings(buildings, x, y, 26)) continue;
    if (onRoad(x, y)) continue;
    trees.push({ x, y, r: range(rng, 9, 16), palm: y > 3200 || rng() < 0.3 });
  }
  // Palm-lined beach.
  for (let x = 120; x < WORLD.width - 100; x += 90) {
    trees.push({ x: x + range(rng, -20, 20), y: BEACH_Y - 30 + range(rng, -14, 14), r: 13, palm: true });
  }

  function districtAt(x, y) {
    for (const d of DISTRICTS) if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
    return DISTRICTS[0];
  }

  return { nodes, nodeAt, buildings, trees, parks, plaza, clearSpots, districtAt };
}

export function onRoad(x, y) {
  if (y > BEACH_Y - 60 && y < BEACH_Y + 40) return true;
  for (const ax of AVENUES) if (Math.abs(x - ax) < ROAD_W / 2) return true;
  for (const sy of STREETS) if (Math.abs(y - sy) < ROAD_W / 2) return true;
  return false;
}

export function pointInBuildings(buildings, x, y, pad) {
  for (const b of buildings) {
    if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return b;
  }
  return null;
}

// Move a circle, sliding along building faces. Returns the new position.
export function moveCircle(buildings, x, y, r, dx, dy) {
  let nx = x + dx;
  if (!pointInBuildings(buildings, nx, y, r)) x = nx;
  let ny = y + dy;
  if (!pointInBuildings(buildings, x, ny, r)) y = ny;
  return { x: clamp(x, 30, WORLD.width - 30), y: clamp(y, 30, WORLD.height - 30) };
}

export function nearestNode(nodes, x, y) {
  let best = nodes[0], bd = Infinity;
  for (const n of nodes) {
    const d = (n.x - x) * (n.x - x) + (n.y - y) * (n.y - y);
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}

// Nearest point on the road network, for spawning cars on a road.
export function nearestRoadPoint(rng, x, y) {
  let best = null, bd = Infinity;
  for (const ax of AVENUES) {
    for (const sy of STREETS) {
      const d = Math.abs(x - ax) + Math.abs(y - sy);
      if (d < bd) { bd = d; best = { x: ax, y: clamp(y, sy - 200, sy + 200) }; }
    }
  }
  if (y > BEACH_Y - 200) return { x: clamp(x, 200, WORLD.width - 200), y: BEACH_Y - 60 };
  return best || { x: AVENUES[0], y: STREETS[0] };
}
