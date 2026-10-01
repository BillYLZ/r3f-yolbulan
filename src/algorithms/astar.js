import { key } from '../grids.js'
import { stepCost, walkBack } from './cost.js'

export { key }

/**
 * Best-first search family on any grid. walls: Set of "x,y" keys; options.costs: terrain Map.
 *   astar    — g + h: cheapest path, guided towards the goal
 *   dijkstra — g only: cheapest path, spreads evenly in every direction
 *   greedy   — h only: rushes towards the goal, path is not always the shortest
 * Returns { visited: [[x,y]...] in expansion order, path: [[x,y]...] or [] }.
 */
function bestFirst(grid, walls, start, goal, { costs, weightG = 1, weightH = 1 } = {}) {
  const h = (c) => grid.heuristic(c, goal)
  const g = new Map([[key(...start), 0]])
  const parent = new Map()
  const closed = new Set()
  const open = [[weightH * h(start), 0, start]] // [f, tiebreak, node]
  const visited = []
  let counter = 0

  while (open.length) {
    open.sort((a, b) => a[0] - b[0] || a[1] - b[1])
    const [, , cur] = open.shift()
    const k = key(...cur)
    if (closed.has(k)) continue
    closed.add(k)
    visited.push(cur)
    if (cur[0] === goal[0] && cur[1] === goal[1]) return { visited, path: walkBack(parent, k) }

    for (const n of grid.neighbors(cur, walls)) {
      const nk = key(...n)
      if (walls.has(nk) || closed.has(nk)) continue
      const ng = g.get(k) + stepCost(grid, cur, n, costs)
      if (ng < (g.get(nk) ?? Infinity)) {
        g.set(nk, ng)
        parent.set(nk, k)
        open.push([weightG * ng + weightH * h(n), ++counter, n])
      }
    }
  }
  return { visited, path: [] }
}

export const astar = (grid, walls, start, goal, opts = {}) => bestFirst(grid, walls, start, goal, { costs: opts.costs })
export const dijkstra = (grid, walls, start, goal, opts = {}) => bestFirst(grid, walls, start, goal, { costs: opts.costs, weightH: 0 })
export const greedy = (grid, walls, start, goal, opts = {}) => bestFirst(grid, walls, start, goal, { costs: opts.costs, weightG: 0 })

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

/**
 * Random patches of mud (3) and water (5) on free cells, as a terrain cost Map. `density` ≈ share of cells covered.
 */
export function randomTerrain(grid, walls, start, goal, density = 0.1) {
  const costs = new Map()
  const total = grid.cols * grid.rows
  let target = Math.round(total * density)
  for (let tries = 0; target > 0 && tries < 200; tries++) {
    const c = [Math.floor(Math.random() * grid.cols), Math.floor(Math.random() * grid.rows)]
    const cost = Math.random() < 0.55 ? 3 : 5
    const size = 2 + Math.floor(Math.random() * 6)
    const queue = [c]
    const seen = new Set()
    let placed = 0
    while (queue.length && placed < size && target > 0) {
      const cur = queue.splice(Math.floor(Math.random() * queue.length), 1)[0]
      const k = key(...cur)
      if (seen.has(k)) continue
      seen.add(k)
      const isEnd = (cur[0] === start[0] && cur[1] === start[1]) || (cur[0] === goal[0] && cur[1] === goal[1])
      if (walls.has(k) || isEnd || costs.has(k)) continue
      costs.set(k, cost)
      placed += 1
      target -= 1
      queue.push(...grid.neighbors(cur))
    }
  }
  return costs
}
