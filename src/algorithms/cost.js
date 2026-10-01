// Terrain: `costs` is a Map "x,y" → multiplier (1 = normal ground, 3 = mud, 5 = water). Missing = 1.
export const cellCost = (costs, k) => costs?.get(k) ?? 1

// Cost of one step: the grid's step length (1, or √2 for a diagonal) times the terrain of the cell entered.
export const stepCost = (grid, a, b, costs) => grid.stepCost(a, b) * cellCost(costs, `${b[0]},${b[1]}`)

export function pathCost(grid, path, costs) {
  let total = 0
  for (let i = 1; i < path.length; i++) total += stepCost(grid, path[i - 1], path[i], costs)
  return total
}

// Rebuilds a path by following `parent` links back from `k`.
export function walkBack(parent, k) {
  const path = [k.split(',').map(Number)]
  while (parent.has(k)) {
    k = parent.get(k)
    path.unshift(k.split(',').map(Number))
  }
  return path
}
