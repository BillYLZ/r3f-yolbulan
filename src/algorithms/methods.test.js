import { test } from 'node:test'
import assert from 'node:assert/strict'
import { METHODS, key, randomWalls } from './index.js'
import { GRIDS } from '../grids.js'

// Every ready method must return a valid path on its own grid: from start to goal,
// each step to a neighbouring cell, never through a wall.
for (const m of METHODS.filter((m) => m.ready)) {
  test(`${m.name}: returns a valid path`, () => {
    const grid = GRIDS[m.grid]
    for (let i = 0; i < 10; i++) {
      const walls = randomWalls(grid, grid.start, grid.goal, 0.3)
      const { path, visited } = m.run(grid, walls, grid.start, grid.goal)
      assert.ok(visited.length > 0)
      assert.deepEqual(path[0], grid.start)
      assert.deepEqual(path.at(-1), grid.goal)
      for (let j = 1; j < path.length; j++) {
        const [px, py] = path[j - 1]
        assert.ok(grid.neighbors(path[j - 1]).some(([x, y]) => x === path[j][0] && y === path[j][1]), `step ${px},${py} → ${path[j]}`)
        assert.ok(!walls.has(key(...path[j])))
      }
    }
  })
}

test('triangle method finds the same length as A* on triangles', () => {
  const tri = METHODS.find((m) => m.grid === 'tri')
  const astar = METHODS.find((m) => m.id === 'astar')
  const grid = GRIDS.tri
  for (let i = 0; i < 10; i++) {
    const walls = randomWalls(grid, grid.start, grid.goal, 0.3)
    assert.equal(tri.run(grid, walls, grid.start, grid.goal).path.length, astar.run(grid, walls, grid.start, grid.goal).path.length)
  }
})
