import { key } from '../grids.js'

export { key }

// A* on any grid. walls: Set of "x,y" keys.
// Returns { visited: [[x,y]...] in expansion order, path: [[x,y]...] or [] }.
export function astar(grid, walls, start, goal) {
  const h = (c) => grid.heuristic(c, goal)
  const g = new Map([[key(...start), 0]])
  const parent = new Map()
  const closed = new Set()
  const open = [[h(start), 0, start]] // [f, tiebreak, node]
  const visited = []
  let counter = 0

  while (open.length) {
    open.sort((a, b) => a[0] - b[0] || a[1] - b[1])
    const [, , cur] = open.shift()
    const k = key(...cur)
    if (closed.has(k)) continue
    closed.add(k)
    visited.push(cur)

    if (cur[0] === goal[0] && cur[1] === goal[1]) {
      const path = [cur]
      let p = k
      while (parent.has(p)) {
        p = parent.get(p)
        path.unshift(p.split(',').map(Number))
      }
      return { visited, path }
    }

    for (const n of grid.neighbors(cur)) {
      const nk = key(...n)
      if (walls.has(nk) || closed.has(nk)) continue
      const ng = g.get(k) + 1
      if (ng < (g.get(nk) ?? Infinity)) {
        g.set(nk, ng)
        parent.set(nk, k)
        open.push([ng + h(n), ++counter, n])
      }
    }
  }
  return { visited, path: [] }
}

// Random walls, retried until start and goal are connected.
export function randomWalls(grid, start, goal, density = 0.28) {
  for (let i = 0; i < 100; i++) {
    const walls = tryRandomWalls(grid, start, goal, density)
    if (astar(grid, walls, start, goal).path.length) return walls
  }
  return new Set()
}

function tryRandomWalls(grid, start, goal, density) {
  const walls = new Set()
  for (let x = 0; x < grid.cols; x++)
    for (let y = 0; y < grid.rows; y++) {
      if ((x === start[0] && y === start[1]) || (x === goal[0] && y === goal[1])) continue
      if (Math.random() < density) walls.add(key(x, y))
    }
  return walls
}
