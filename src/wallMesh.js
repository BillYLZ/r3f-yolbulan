import { OFFSET } from './grid.js'

const H = 0.5 // obstacle height
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]]

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

// Pushes quad a-b-c-d as two triangles, wound so the face points along `normal`.
function quad(out, a, b, c, d, normal) {
  const flip = dot(cross(sub(b, a), sub(c, a)), normal) < 0
  const tris = flip ? [a, c, b, a, d, c] : [a, b, c, a, c, d]
  for (const v of tris) out.push(...v)
}

/**
 * Builds one merged shell for a set of wall cells ("x,y" keys): faces shared by two walls and
 * the edges between them are left out, so neighbouring walls read as a single block.
 * Returns flat Float32Arrays: `faces` (triangles) and `edges` (line segments).
 */
export function buildWallShell(walls) {
  const faces = []
  const edges = []
  const has = (x, y) => walls.has(`${x},${y}`)
  const seg = (a, b) => edges.push(...a, ...b)
  const verticals = new Set() // a corner is shared by two exposed sides; draw its edge once

  for (const k of walls) {
    const [cx, cy] = k.split(',').map(Number)
    const x = cx - OFFSET
    const z = cy - OFFSET
    const x0 = x - 0.5, x1 = x + 0.5, z0 = z - 0.5, z1 = z + 0.5

    quad(faces, [x0, H, z0], [x1, H, z0], [x1, H, z1], [x0, H, z1], [0, 1, 0])
    quad(faces, [x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1], [0, -1, 0])

    for (const [dx, dz] of DIRS) {
      if (has(cx + dx, cy + dz)) continue
      // Corners of the exposed side, ordered along its tangent (tx, tz).
      const [tx, tz] = [-dz, dx]
      const px = x + dx * 0.5
      const pz = z + dz * 0.5
      const e0 = [px - tx * 0.5, pz - tz * 0.5]
      const e1 = [px + tx * 0.5, pz + tz * 0.5]
      quad(faces, [e0[0], 0, e0[1]], [e1[0], 0, e1[1]], [e1[0], H, e1[1]], [e0[0], H, e0[1]], [dx, 0, dz])
      seg([e0[0], H, e0[1]], [e1[0], H, e1[1]])
      seg([e0[0], 0, e0[1]], [e1[0], 0, e1[1]])
      // A vertical edge only where this side does not continue straight into the next wall's side.
      for (const [s, e] of [[-1, e0], [1, e1]]) {
        const nx = cx + tx * s
        const ny = cy + tz * s
        const continues = has(nx, ny) && !has(nx + dx, ny + dz)
        const vk = `${e[0]},${e[1]}`
        if (!continues && !verticals.has(vk)) {
          verticals.add(vk)
          seg([e[0], 0, e[1]], [e[0], H, e[1]])
        }
      }
    }
  }
  return { faces: new Float32Array(faces), edges: new Float32Array(edges) }
}
