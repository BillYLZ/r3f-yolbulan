// Floor grids. A cell is [x, y]; each grid knows its neighbours, where a cell sits in the world (x, z)
// and its outline, so algorithms and rendering work the same on squares and triangles.

export const SIZE = 14 // arena is about SIZE × SIZE world units

export const key = (x, y) => `${x},${y}`

function pointInPolygon([px, pz], poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i]
    const [xj, zj] = poly[j]
    if (zi > pz !== zj > pz && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}

export function squareGrid(size = SIZE) {
  const offset = (size - 1) / 2
  const inBounds = ([x, y]) => x >= 0 && y >= 0 && x < size && y < size
  return {
    id: 'square',
    cols: size,
    rows: size,
    width: size,
    depth: size,
    cellSize: 1,
    inBounds,
    neighbors: ([x, y]) => [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].filter(inBounds),
    heuristic: ([ax, ay], [bx, by]) => Math.abs(ax - bx) + Math.abs(ay - by),
    toWorld: ([x, y]) => [x - offset, y - offset],
    toCell(wx, wz) {
      const c = [Math.round(wx + offset), Math.round(wz + offset)]
      return inBounds(c) ? c : null
    },
    polygon([x, y]) {
      const cx = x - offset
      const cz = y - offset
      return [[cx - 0.5, cz - 0.5], [cx + 0.5, cz - 0.5], [cx + 0.5, cz + 0.5], [cx - 0.5, cz + 0.5]]
    },
    start: [1, size - 2],
    goal: [size - 2, 1],
  }
}

/**
 * Triangles in rows. Triangle (x, y) points away from the camera (apex at -z) when x + y is even,
 * towards it otherwise. Neighbours share an edge: left, right, and the one across the flat side.
 */
export function triGrid(cols = 23, rows = SIZE) {
  const s = (2 * SIZE) / (cols + 1) // side length, so the arena is SIZE wide
  const h = (s * Math.sqrt(3)) / 2
  const W = ((cols + 1) * s) / 2
  const D = rows * h
  const inBounds = ([x, y]) => x >= 0 && y >= 0 && x < cols && y < rows
  const up = ([x, y]) => (x + y) % 2 === 0
  const polygon = ([x, y]) => {
    const z0 = y * h - D / 2
    const z1 = z0 + h
    const xl = (x * s) / 2 - W / 2
    const xm = xl + s / 2
    const xr = xl + s
    return up([x, y]) ? [[xm, z0], [xr, z1], [xl, z1]] : [[xl, z0], [xr, z0], [xm, z1]]
  }
  const toWorld = (c) => {
    const p = polygon(c)
    return [(p[0][0] + p[1][0] + p[2][0]) / 3, (p[0][1] + p[1][1] + p[2][1]) / 3]
  }
  const step = s / Math.sqrt(3) // distance between centres of neighbouring triangles
  return {
    id: 'tri',
    cols,
    rows,
    width: W,
    depth: D,
    cellSize: s * 0.6,
    inBounds,
    neighbors: ([x, y]) => [[x - 1, y], [x + 1, y], up([x, y]) ? [x, y + 1] : [x, y - 1]].filter(inBounds),
    heuristic(a, b) {
      const [ax, az] = toWorld(a)
      const [bx, bz] = toWorld(b)
      return Math.hypot(ax - bx, az - bz) / step
    },
    toWorld,
    toCell(wx, wz) {
      const y = Math.floor((wz + D / 2) / h)
      const u = Math.floor((wx + W / 2) / (s / 2))
      for (const x of [u - 1, u, u + 1]) if (inBounds([x, y]) && pointInPolygon([wx, wz], polygon([x, y]))) return [x, y]
      return null
    },
    polygon,
    start: [1, rows - 2],
    goal: [cols - 2, 1],
  }
}

export const GRIDS = { square: squareGrid(), tri: triGrid() }
