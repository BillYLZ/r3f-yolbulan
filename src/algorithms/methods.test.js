import { test } from 'node:test'
import assert from 'node:assert/strict'
import { METHODS, key, pathCost, randomTerrain, randomWalls, supports } from './index.js'
import { dijkstra } from './astar.js'
import { yolbulan1995 } from './yolbulan1995.js'
import { GRIDS } from '../grids.js'

const seeded = (seed) => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)

function assertValid(grid, walls, path) {
  assert.deepEqual(path[0], grid.start)
  assert.deepEqual(path.at(-1), grid.goal)
  for (let j = 1; j < path.length; j++) {
    const ok = grid.neighbors(path[j - 1], walls).some(([x, y]) => x === path[j][0] && y === path[j][1])
    assert.ok(ok, `step ${path[j - 1]} → ${path[j]}`)
    assert.ok(!walls.has(key(...path[j])))
  }
}

for (const m of METHODS) {
  for (const grid of Object.values(GRIDS).filter((g) => supports(m, g.id))) {
    test(`${m.name} on ${grid.label}: valid path${m.shortest ? ', and shortest' : ''}`, () => {
      let found = 0
      for (let i = 0; i < 12; i++) {
        const walls = randomWalls(grid, grid.start, grid.goal, 0.25)
        const costs = randomTerrain(grid, walls, grid.start, grid.goal, 0.15)
        const { path, visited } = m.run(grid, walls, grid.start, grid.goal, { costs, random: i % 2 === 1, rng: seeded(i + 1) })
        assert.ok(visited.length > 0)
        if (!path.length) {
          assert.ok(!m.alwaysFinds, 'must find a path when one exists')
          continue
        }
        found += 1
        assertValid(grid, walls, path)
        if (m.shortest === 'steps') assert.equal(path.length, yolbulan1995(grid, walls, grid.start, grid.goal).path.length)
        if (m.shortest === 'cost') {
          const best = dijkstra(grid, walls, grid.start, grid.goal, { costs }).path
          assert.ok(Math.abs(pathCost(grid, path, costs) - pathCost(grid, best, costs)) < 1e-9)
        }
        if (m.shortest === 'steps-diag') {
          const best = dijkstra(grid, walls, grid.start, grid.goal).path
          assert.ok(Math.abs(pathCost(grid, path) - pathCost(grid, best)) < 1e-9, `${pathCost(grid, path)} vs ${pathCost(grid, best)}`)
        }
      }
      assert.ok(found > 0, 'never found a path')
    })
  }
}

test('every method finds the way across an empty floor', () => {
  for (const m of METHODS)
    for (const grid of Object.values(GRIDS).filter((g) => supports(m, g.id))) {
      const { path } = m.run(grid, new Set(), grid.start, grid.goal, { rng: seeded(7) })
      assert.ok(path.length > 0, `${m.name} on ${grid.label}`)
      assertValid(grid, new Set(), path)
    }
})

test('greedy can be beaten: on some map it finds a longer path than the shortest', () => {
  const grid = GRIDS.square
  const greedy = METHODS.find((m) => m.id === 'greedy')
  let longer = false
  for (let i = 0; i < 40 && !longer; i++) {
    const walls = randomWalls(grid, grid.start, grid.goal, 0.3)
    const g = greedy.run(grid, walls, grid.start, grid.goal).path.length
    longer = g > yolbulan1995(grid, walls, grid.start, grid.goal).path.length
  }
  assert.ok(longer)
})
