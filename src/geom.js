import { key } from './grids.js'

// World-space helpers shared by smoothing and the any-angle methods. Points are [x, z].

export const STEP = 0.08 // sampling distance along straight segments

export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])

export const curveLength = (pts) => pts.reduce((sum, p, i) => (i ? sum + dist(p, pts[i - 1]) : 0), 0)

// Distance between the centres of two neighbouring cells: the "one step" unit of a grid.
export function stepLength(grid) {
  const c = [Math.floor(grid.cols / 2), Math.floor(grid.rows / 2)]
  return Math.min(...grid.neighbors(c).map((n) => dist(grid.toWorld(c), grid.toWorld(n))))
}

// A point is blocked when it is outside the arena or on a wall.
export const wallBlocked = (grid, walls) => (p) => {
  const c = grid.toCell(p[0], p[1])
  return !c || walls.has(key(...c))
}

/**
 * Same as wallBlocked, but answered from a bitmap of the arena built once (res world units per pixel).
 * Much faster when a method checks thousands of lines of sight.
 */
export function rasterBlocked(grid, walls, res = 0.04) {
  const [hw, hd] = [grid.width / 2, grid.depth / 2]
  const nx = Math.ceil(grid.width / res) + 1
  const nz = Math.ceil(grid.depth / res) + 1
  const bits = new Uint8Array(nx * nz)
  const slow = wallBlocked(grid, walls)
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < nz; j++) bits[i * nz + j] = slow([-hw + i * res, -hd + j * res]) ? 1 : 0
  return ([x, z]) => {
    const i = Math.round((x + hw) / res)
    const j = Math.round((z + hd) / res)
    return i < 0 || j < 0 || i >= nx || j >= nz || bits[i * nz + j] === 1
  }
}

// True when a band of the given half-width around segment a→b avoids every blocked point.
export function segmentClear(blocked, a, b, radius = 0) {
  const len = dist(a, b)
  const n = Math.max(2, Math.ceil(len / STEP))
  const px = -(b[1] - a[1]) / (len || 1)
  const pz = (b[0] - a[0]) / (len || 1)
  for (let s = 0; s <= n; s++) {
    const x = a[0] + ((b[0] - a[0]) * s) / n
    const z = a[1] + ((b[1] - a[1]) * s) / n
    for (const o of radius ? [0, radius, -radius] : [0]) if (blocked([x + px * o, z + pz * o])) return false
  }
  return true
}

// Points along straight segments, at exactly the positions segmentClear() checks.
export function polyline(pts) {
  const out = [pts[0]]
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = [pts[i - 1], pts[i]]
    const n = Math.max(2, Math.ceil(dist(a, b) / STEP))
    for (let s = 1; s <= n; s++) out.push([a[0] + ((b[0] - a[0]) * s) / n, a[1] + ((b[1] - a[1]) * s) / n])
  }
  return out
}

// Centripetal Catmull-Rom through every point (ends padded by repeating), sampled about every 0.15 units.
export function catmullRom(pts) {
  const P = [pts[0], ...pts, pts.at(-1)]
  const out = [pts[0]]
  const tj = (a, b) => Math.sqrt(dist(a, b)) || 1e-6
  for (let i = 1; i < P.length - 2; i++) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]]
    const t1 = tj(p0, p1)
    const t2 = t1 + tj(p1, p2)
    const t3 = t2 + tj(p2, p3)
    const n = Math.max(2, Math.ceil(dist(p1, p2) / 0.15))
    for (let s = 1; s <= n; s++) {
      const t = t1 + ((t2 - t1) * s) / n
      const lerp = (a, b, ta, tb) => [0, 1].map((d) => ((tb - t) / (tb - ta)) * a[d] + ((t - ta) / (tb - ta)) * b[d])
      const A1 = lerp(p0, p1, 0, t1)
      const A2 = lerp(p1, p2, t1, t2)
      const A3 = lerp(p2, p3, t2, t3)
      out.push(lerp(lerp(A1, A2, 0, t2), lerp(A2, A3, t1, t3), t1, t2))
    }
  }
  return out
}

// Cells crossed by a world polyline, in order, without repeats in a row.
export function cellsAlong(grid, pts) {
  const out = []
  for (const p of polyline(pts)) {
    const c = grid.toCell(p[0], p[1])
    if (c && !(out.length && out.at(-1)[0] === c[0] && out.at(-1)[1] === c[1])) out.push(c)
  }
  return out
}
