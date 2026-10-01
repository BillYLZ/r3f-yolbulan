// A* on a 4-connected grid. walls: Set of "x,y" keys.
// Returns { visited: [[x,y]...] in expansion order, path: [[x,y]...] or [] }.
export const key = (x, y) => `${x},${y}`

export function astar(size, walls, start, goal) {
  const h = (x, y) => Math.abs(x - goal[0]) + Math.abs(y - goal[1])
  const g = new Map([[key(...start), 0]])
  const parent = new Map()
  const closed = new Set()
  const open = [[h(...start), 0, start]] // [f, tiebreak, node]
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

    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cur[0] + dx
      const ny = cur[1] + dy
      const nk = key(nx, ny)
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue
      if (walls.has(nk) || closed.has(nk)) continue
      const ng = g.get(k) + 1
      if (ng < (g.get(nk) ?? Infinity)) {
        g.set(nk, ng)
        parent.set(nk, k)
        open.push([ng + h(nx, ny), ++counter, [nx, ny]])
      }
    }
  }
  return { visited, path: [] }
}

// Random walls, retried until start and goal are connected.
export function randomWalls(size, start, goal, density = 0.28) {
  for (let i = 0; i < 100; i++) {
    const walls = tryRandomWalls(size, start, goal, density)
    if (astar(size, walls, start, goal).path.length) return walls
  }
  return new Set()
}

function tryRandomWalls(size, start, goal, density) {
  const walls = new Set()
  for (let x = 0; x < size; x++)
    for (let y = 0; y < size; y++) {
      if ((x === start[0] && y === start[1]) || (x === goal[0] && y === goal[1])) continue
      if (Math.random() < density) walls.add(key(x, y))
    }
  return walls
}
