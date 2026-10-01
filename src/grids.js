// Floor grids. A cell is [x, y]; each grid knows its neighbours, where a cell sits in the world (x, z)
// and its outline, so algorithms and rendering work the same on squares and triangles.

export const BLOCK = 7 // one big square (the orange sections on the floor) is BLOCK × BLOCK small squares
export const SIZE = 2 * BLOCK // default arena: 2 × 2 big squares

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

export function squareGrid(cols = SIZE, rows = cols) {
  const ox = (cols - 1) / 2
  const oy = (rows - 1) / 2
  const inBounds = ([x, y]) => x >= 0 && y >= 0 && x < cols && y < rows
  return {
    id: 'square',
    label: 'Kare',
    cols,
    rows,
    width: cols,
    depth: rows,
    cellSize: 1,
    inBounds,
    neighbors: ([x, y]) => [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].filter(inBounds),
    heuristic: ([ax, ay], [bx, by]) => Math.abs(ax - bx) + Math.abs(ay - by),
    stepCost: () => 1,
    toWorld: ([x, y]) => [x - ox, y - oy],
    toCell(wx, wz) {
      const c = [Math.round(wx + ox), Math.round(wz + oy)]
      return inBounds(c) ? c : null
    },
    polygon([x, y]) {
      const cx = x - ox
      const cz = y - oy
      return [[cx - 0.5, cz - 0.5], [cx + 0.5, cz - 0.5], [cx + 0.5, cz + 0.5], [cx - 0.5, cz + 0.5]]
    },
    start: [1, rows - 2],
    goal: [cols - 2, 1],
  }
}

/**
 * Triangles in rows. Triangle (x, y) points away from the camera (apex at -z) when x + y is even,
 * towards it otherwise. Neighbours share an edge: left, right, and the one across the flat side.
 */
export function triGrid(cols = 23, rows = SIZE) {
  const s = (2 * SIZE) / 24 // side length: 23 triangles span SIZE (two big squares)
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
    label: 'Üçgen',
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
    stepCost: () => 1,
    toWorld,
    toCell(wx, wz) {
      const y = Math.floor((wz + D / 2) / h)
      const u = Math.floor((wx + W / 2) / (s / 2))
      for (const x of [u - 1, u, u + 1]) if (inBounds([x, y]) && pointInPolygon([wx, wz], polygon([x, y]))) return [x, y]
      // exactly on an edge or corner: take the nearest triangle centre close by
      let best = null
      let bestD = h * 0.7
      for (let yy = y - 1; yy <= y + 1; yy++)
        for (let x = u - 2; x <= u + 2; x++) {
          if (!inBounds([x, yy])) continue
          const [cx, cz] = toWorld([x, yy])
          const d = Math.hypot(wx - cx, wz - cz)
          if (d < bestD) [best, bestD] = [[x, yy], d]
        }
      return best
    },
    polygon,
    start: [1, rows - 2],
    goal: [cols - 2, 1],
  }
}

/**
 * Squares with diagonal moves (8 neighbours). A diagonal step costs √2 and is only allowed when both
 * squares it squeezes between are free, so the cube never cuts a wall's corner. Pass `walls` to neighbors()
 * to apply that rule.
 */
export function diagGrid(cols = SIZE, rows = cols) {
  const base = squareGrid(cols, rows)
  const free = (walls, c) => base.inBounds(c) && !walls?.has(key(...c))
  return {
    ...base,
    id: 'diag',
    label: 'Çapraz',
    neighbors([x, y], walls) {
      const out = base.neighbors([x, y])
      for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const d = [x + dx, y + dy]
        if (base.inBounds(d) && (!walls || (free(walls, [x + dx, y]) && free(walls, [x, y + dy])))) out.push(d)
      }
      return out
    },
    heuristic([ax, ay], [bx, by]) {
      const dx = Math.abs(ax - bx)
      const dy = Math.abs(ay - by)
      return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy) // octile distance
    },
    stepCost: ([ax, ay], [bx, by]) => (ax !== bx && ay !== by ? Math.SQRT2 : 1),
  }
}

/** Pointy-top hexagons in offset rows (odd rows shifted right by half a hexagon). 6 neighbours each. */
export function hexGrid(cols = 13, rows = 15) {
  const w = SIZE / 13.5 // hexagon width (flat side to flat side): 13 hexagons span SIZE
  const R = w / Math.sqrt(3) // corner radius
  const W = (cols + 0.5) * w
  const D = (rows - 1) * 1.5 * R + 2 * R
  const inBounds = ([x, y]) => x >= 0 && y >= 0 && x < cols && y < rows
  const toWorld = ([x, y]) => [-W / 2 + w / 2 + x * w + (y % 2 ? w / 2 : 0), -D / 2 + R + y * 1.5 * R]
  const EVEN = [[1, 0], [-1, 0], [0, -1], [-1, -1], [0, 1], [-1, 1]]
  const ODD = [[1, 0], [-1, 0], [1, -1], [0, -1], [1, 1], [0, 1]]
  return {
    id: 'hex',
    label: 'Altıgen',
    cols,
    rows,
    width: W,
    depth: D,
    cellSize: w * 0.85,
    inBounds,
    neighbors: ([x, y]) => (y % 2 ? ODD : EVEN).map(([dx, dy]) => [x + dx, y + dy]).filter(inBounds),
    heuristic(a, b) {
      const [ax, az] = toWorld(a)
      const [bx, bz] = toWorld(b)
      return Math.hypot(ax - bx, az - bz) / w
    },
    stepCost: () => 1,
    toWorld,
    toCell(wx, wz) {
      const ry = Math.round((wz + D / 2 - R) / (1.5 * R))
      let best = null
      let bestD = Infinity
      for (let y = ry - 1; y <= ry + 1; y++) {
        const rx = Math.round((wx + W / 2 - w / 2 - (y % 2 ? w / 2 : 0)) / w)
        for (let x = rx - 1; x <= rx + 1; x++) {
          if (!inBounds([x, y])) continue
          const [cx, cz] = toWorld([x, y])
          const d = Math.hypot(wx - cx, wz - cz)
          if (d < bestD) [best, bestD] = [[x, y], d]
        }
      }
      return best && bestD <= R ? best : null
    },
    polygon(c) {
      const [cx, cz] = toWorld(c)
      return [0, 1, 2, 3, 4, 5].map((k) => {
        const a = ((60 * k - 90) * Math.PI) / 180
        return [cx + R * Math.cos(a), cz + R * Math.sin(a)]
      })
    },
    start: [1, rows - 2],
    goal: [cols - 2, 1],
  }
}

/**
 * All floors for an arena of bx × by big squares. Triangles and hexagons keep their size and fill
 * about the same area as the squares.
 */
export function makeGrids(bx = 2, by = 2) {
  const W = bx * BLOCK
  const D = by * BLOCK
  const triSide = (2 * SIZE) / 24
  const triH = (triSide * Math.sqrt(3)) / 2
  const hexW = SIZE / 13.5
  const hexR = hexW / Math.sqrt(3)
  return {
    square: squareGrid(W, D),
    diag: diagGrid(W, D),
    tri: triGrid(Math.round((2 * W) / triSide - 1), Math.round(D / triH)),
    hex: hexGrid(Math.round(W / hexW - 0.5), Math.round((D - 2 * hexR) / (1.5 * hexR) + 1)),
  }
}

export const GRIDS = makeGrids()

// Arena sizes offered in the UI: number of big squares → [columns, rows] of big squares.
export const ARENAS = { 4: [2, 2], 6: [3, 2], 9: [3, 3], 12: [4, 3], 16: [4, 4] }
