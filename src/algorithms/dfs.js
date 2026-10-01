import { key } from '../grids.js'
import { walkBack } from './cost.js'

/**
 * Derinlik öncelikli arama (DFS): bir yöne gidebildiği kadar gider, çıkmaza girince son çatala geri döner.
 * Bir yol bulur ama genelde en kısası değildir. random: komşuları karışık sırayla dener.
 */
export function dfs(grid, walls, start, goal, { random = false, rng = Math.random } = {}) {
  const parent = new Map()
  const seen = new Set([key(...start)])
  const stack = [start]
  const visited = []
  while (stack.length) {
    const cur = stack.pop()
    const k = key(...cur)
    visited.push(cur)
    if (cur[0] === goal[0] && cur[1] === goal[1]) return { visited, path: walkBack(parent, k) }
    let ns = grid.neighbors(cur, walls).filter((n) => !walls.has(key(...n)) && !seen.has(key(...n)))
    if (random) ns = ns.sort(() => rng() - 0.5)
    // push in reverse so the first neighbour is explored first
    for (const n of ns.reverse()) {
      seen.add(key(...n))
      parent.set(key(...n), k)
      stack.push(n)
    }
  }
  return { visited, path: [] }
}
