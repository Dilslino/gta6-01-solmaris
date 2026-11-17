// Seeded RNG (mulberry32) + small helpers. Same seed => same city, same traffic, same shots.
export function createRandom(seed) {
  let a = (seed | 0) >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function range(rng, min, max) { return min + rng() * (max - min); }
export function int(rng, min, max) { return Math.floor(range(rng, min, max + 1)); }
export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function dist(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return Math.sqrt(dx * dx + dy * dy); }
export function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
export function angleDiff(a, b) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }
export function lerp(a, b, t) { return a + (b - a) * t; }
