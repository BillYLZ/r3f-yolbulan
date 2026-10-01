const H = 0.5 // obstacle height

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

// Pushes triangle a-b-c, wound so the face points along `normal`.
function tri(out, a, b, c, normal) {
  const flip = dot(cross(sub(b, a), sub(c, a)), normal) < 0
  out.push(...a, ...(flip ? c : b), ...(flip ? b : c))
}

const vkey = ([x, z]) => `${x.toFixed(4)},${z.toFixed(4)}`

/**
 * Builds one merged shell for a set of wall cells ("x,y" keys) on any grid: an edge shared by two walls is
 * left out (no face, no line), so neighbouring walls read as a single block. A vertical line is drawn at a
 * corner unless the outline runs straight through it.
 * Returns flat Float32Arrays: `faces` (triangles) and `edges` (line segments).
 */
export function buildWallShell(walls, grid) {
  const faces = []
  const edges = []
  const cells = [...walls].map((k) => k.split(',').map(Number))

  // Count every polygon edge; an edge seen twice lies between two walls.
  const edgeCount = new Map()
  const ek = (a, b) => [vkey(a), vkey(b)].sort().join('|')
  for (const c of cells) {
    const poly = grid.polygon(c)
    poly.forEach((a, i) => {
      const k = ek(a, poly[(i + 1) % poly.length])
      edgeCount.set(k, (edgeCount.get(k) ?? 0) + 1)
    })
  }

  const corners = new Map() // vertex → directions of exposed edges leaving it
  for (const c of cells) {
    const poly = grid.polygon(c)
    const [cx, cz] = grid.toWorld(c)
    // top and bottom as a fan
    for (let i = 1; i < poly.length - 1; i++) {
      const [a, b, d] = [poly[0], poly[i], poly[i + 1]]
      tri(faces, [a[0], H, a[1]], [b[0], H, b[1]], [d[0], H, d[1]], [0, 1, 0])
      tri(faces, [a[0], 0, a[1]], [b[0], 0, b[1]], [d[0], 0, d[1]], [0, -1, 0])
    }
    poly.forEach((a, i) => {
      const b = poly[(i + 1) % poly.length]
      if (edgeCount.get(ek(a, b)) > 1) return
      const out = [(a[0] + b[0]) / 2 - cx, 0, (a[1] + b[1]) / 2 - cz]
      tri(faces, [a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], H, b[1]], out)
      tri(faces, [a[0], 0, a[1]], [b[0], H, b[1]], [a[0], H, a[1]], out)
      edges.push(a[0], H, a[1], b[0], H, b[1], a[0], 0, a[1], b[0], 0, b[1])
      for (const [p, q] of [[a, b], [b, a]]) {
        const len = Math.hypot(q[0] - p[0], q[1] - p[1])
        const list = corners.get(vkey(p)) ?? { p, dirs: [] }
        list.dirs.push([(q[0] - p[0]) / len, (q[1] - p[1]) / len])
        corners.set(vkey(p), list)
      }
    })
  }

  for (const { p, dirs } of corners.values()) {
    const straight = dirs.length === 2 && Math.abs(dirs[0][0] + dirs[1][0]) < 1e-6 && Math.abs(dirs[0][1] + dirs[1][1]) < 1e-6
    if (!straight) edges.push(p[0], 0, p[1], p[0], H, p[1])
  }
  return { faces: new Float32Array(faces), edges: new Float32Array(edges) }
}
