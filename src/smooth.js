import { key } from './grids.js'
import { catmullRom, polyline, segmentClear } from './geom.js'

export { curveLength } from './geom.js'

/**
 * Path smoothing ("Yumuşat"), for any method and any floor:
 *   1. string pulling — from each kept point, jump to the farthest later point that can be reached in a straight
 *      line without touching a wall (with a little clearance so the cube never scrapes a corner) and without
 *      crossing mud or water the original path avoided;
 *   2. a centripetal Catmull-Rom spline through the kept points. If the curve would bulge into a wall,
 *      the straight pulled path is used instead.
 * Takes either a cell path, or world points for any-angle methods.
 * Returns { pulled: [[wx,wz]…] kept points, points: [[wx,wz]…] dense points along the final curve, curved }.
 */
export function smoothPath(grid, walls, costs, path) {
  const world = path.map((c) => grid.toWorld(c))
  const onPath = new Set(path.map((c) => key(...c)))
  return smoothWorld(grid, walls, costs, world, onPath)
}

export function smoothPoints(grid, walls, costs, points) {
  const onPath = new Set()
  for (const p of polyline(points)) {
    const c = grid.toCell(p[0], p[1])
    if (c) onPath.add(key(...c))
  }
  return smoothWorld(grid, walls, costs, points, onPath)
}

function smoothWorld(grid, walls, costs, world, onPath) {
  if (world.length < 3) return { pulled: world, points: world, curved: false }
  const blocked = (p) => {
    const c = grid.toCell(p[0], p[1])
    if (!c) return true
    const k = key(...c)
    return walls.has(k) || ((costs?.get(k) ?? 1) > 1 && !onPath.has(k))
  }
  const radius = 0.22 * grid.cellSize

  const pulled = [world[0]]
  let i = 0
  while (i < world.length - 1) {
    let j = i + 1
    for (let k = world.length - 1; k > i + 1; k--) {
      if (segmentClear(blocked, world[i], world[k], radius)) {
        j = k
        break
      }
    }
    pulled.push(world[j])
    i = j
  }

  const curve = catmullRom(pulled)
  if (curve.every((p) => !blocked(p))) return { pulled, points: curve, curved: true }
  return { pulled, points: polyline(pulled), curved: false }
}
