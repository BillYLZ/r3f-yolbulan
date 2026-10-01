import { key } from './grids.js'

const STEP = 0.08 // sampling distance along straight segments

/**
 * Path smoothing ("Yumuşat"), for any method and any floor:
 *   1. string pulling — from each kept point, jump to the farthest later point of the path that can be reached
 *      in a straight line without touching a wall (with a little clearance so the cube never scrapes a corner)
 *      and without crossing mud or water the original path avoided;
 *   2. a centripetal Catmull-Rom spline through the kept points. If the curve would bulge into a wall,
 *      the straight pulled path is used instead.
 * Returns { anchors: [[x,y]…] kept cells, points: [[wx,wz]…] dense world points along the final curve, curved }.
 */
export function smoothPath(grid, walls, costs, path) {
  if (path.length < 3) return { anchors: path, points: path.map((c) => grid.toWorld(c)), curved: false }
  const onPath = new Set(path.map((c) => key(...c)))
  const blocked = (cell) =>
    !cell || walls.has(key(...cell)) || ((costs?.get(key(...cell)) ?? 1) > 1 && !onPath.has(key(...cell)))
  const clear = (a, b) => segmentClear(grid, blocked, grid.toWorld(a), grid.toWorld(b), 0.22 * grid.cellSize)

  const anchors = [path[0]]
  let i = 0
  while (i < path.length - 1) {
    let j = i + 1
    for (let k = path.length - 1; k > i + 1; k--) {
      if (clear(path[i], path[k])) {
        j = k
        break
      }
    }
    anchors.push(path[j])
    i = j
  }

  const world = anchors.map((c) => grid.toWorld(c))
  const curve = catmullRom(world)
  if (curve.every((p) => !blocked(grid.toCell(...p)))) return { anchors, points: curve, curved: true }
  return { anchors, points: polyline(world), curved: false }
}

// True when a band of the given half-width around segment a→b stays on free cells.
function segmentClear(grid, blocked, [ax, az], [bx, bz], radius) {
  const len = Math.hypot(bx - ax, bz - az)
  const n = Math.max(2, Math.ceil(len / STEP))
  const px = -(bz - az) / (len || 1)
  const pz = (bx - ax) / (len || 1)
  for (let s = 0; s <= n; s++) {
    const x = ax + ((bx - ax) * s) / n
    const z = az + ((bz - az) * s) / n
    for (const o of [0, radius, -radius]) if (blocked(grid.toCell(x + px * o, z + pz * o))) return false
  }
  return true
}

// Points along straight segments, at exactly the positions segmentClear() checked.
function polyline(pts) {
  const out = [pts[0]]
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1]
    const [bx, bz] = pts[i]
    const n = Math.max(2, Math.ceil(Math.hypot(bx - ax, bz - az) / STEP))
    for (let s = 1; s <= n; s++) out.push([ax + ((bx - ax) * s) / n, az + ((bz - az) * s) / n])
  }
  return out
}

// Centripetal Catmull-Rom through every point (ends padded by repeating), sampled about every 0.15 units.
function catmullRom(pts) {
  const P = [pts[0], ...pts, pts.at(-1)]
  const out = [pts[0]]
  const tj = (a, b) => Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])) || 1e-6
  for (let i = 1; i < P.length - 2; i++) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]]
    const t1 = tj(p0, p1)
    const t2 = t1 + tj(p1, p2)
    const t3 = t2 + tj(p2, p3)
    const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 0.15))
    for (let s = 1; s <= n; s++) {
      const t = t1 + ((t2 - t1) * s) / n
      const lerp = (a, b, ta, tb) => [0, 1].map((d) => ((tb - t) / (tb - ta)) * a[d] + ((t - ta) / (tb - ta)) * b[d])
      const A1 = lerp(p0, p1, 0, t1)
      const A2 = lerp(p1, p2, t1, t2)
      const A3 = lerp(p2, p3, t2, t3)
      const B1 = lerp(A1, A2, 0, t2)
      const B2 = lerp(A2, A3, t1, t3)
      out.push(lerp(B1, B2, t1, t2))
    }
  }
  return out
}

export const curveLength = (pts) => pts.reduce((sum, p, i) => (i ? sum + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0)
