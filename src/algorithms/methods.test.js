import { test } from 'node:test'
import assert from 'node:assert/strict'
import { METHODS, key, randomWalls } from './index.js'

// Every ready method must return a valid path: from start to goal, one orthogonal step at a time, never through a wall.
for (const m of METHODS.filter((m) => m.ready)) {
  test(`${m.name}: returns a valid path`, () => {
    for (let i = 0; i < 10; i++) {
      const start = [1, 12]
      const goal = [12, 1]
      const walls = randomWalls(14, start, goal, 0.3)
      const { path, visited } = m.run(14, walls, start, goal)
      assert.ok(visited.length > 0)
      assert.deepEqual(path[0], start)
      assert.deepEqual(path.at(-1), goal)
      for (let j = 1; j < path.length; j++) {
        const [ax, ay] = path[j - 1]
        const [bx, by] = path[j]
        assert.equal(Math.abs(ax - bx) + Math.abs(ay - by), 1)
        assert.ok(!walls.has(key(bx, by)))
      }
    }
  })
}
