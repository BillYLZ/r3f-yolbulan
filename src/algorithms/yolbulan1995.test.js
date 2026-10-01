import { test } from 'node:test'
import assert from 'node:assert/strict'
import { yolbulan1995 } from './yolbulan1995.js'
import { astar, key, randomWalls } from './astar.js'

test('start is 0 and its open neighbours are 1; walls get no score', () => {
  const walls = new Set([key(3, 2)])
  const { scores } = yolbulan1995(5, walls, [2, 2], [4, 4])
  assert.equal(scores.get(key(2, 2)), 0)
  for (const k of [key(1, 2), key(2, 1), key(2, 3)]) assert.equal(scores.get(k), 1)
  assert.equal(scores.has(key(3, 2)), false)
})

test('stops spreading once finish is scored', () => {
  const { scores } = yolbulan1995(10, new Set(), [0, 0], [1, 0])
  assert.equal(scores.get(key(1, 0)), 1)
  assert.ok(![...scores.values()].some((s) => s > 1))
})

test('path length matches A* (both shortest)', () => {
  for (let i = 0; i < 20; i++) {
    const walls = randomWalls(14, [1, 12], [12, 1], 0.3)
    const a = astar(14, walls, [1, 12], [12, 1]).path.length
    const b = yolbulan1995(14, walls, [1, 12], [12, 1]).path.length
    assert.equal(b, a)
  }
})

test('path scores count down 0, 1, 2 ... to finish', () => {
  const { path, scores } = yolbulan1995(8, new Set([key(2, 0), key(2, 1), key(2, 2)]), [0, 0], [4, 0])
  path.forEach(([x, y], i) => assert.equal(scores.get(key(x, y)), i))
})

test('no path when finish is walled off', () => {
  const walls = new Set([key(3, 4), key(4, 3)])
  assert.deepEqual(yolbulan1995(5, walls, [0, 0], [4, 4]).path, [])
})

test('steps replay to the same scores and trace the path back from finish', () => {
  const walls = randomWalls(10, [0, 9], [9, 0], 0.25)
  const { steps, scores, path } = yolbulan1995(10, walls, [0, 9], [9, 0])
  const replayed = new Map(steps.filter((s) => s.t === 'assign').map((s) => [key(...s.cell), s.score]))
  assert.deepEqual(replayed, scores)
  const traced = steps.filter((s) => s.t === 'trace').map((s) => s.cell)
  assert.deepEqual(traced, [...path].reverse())
  // every assignment follows the expansion of a cell scored one lower
  let current = null
  for (const s of steps) {
    if (s.t === 'expand') current = s.score
    if (s.t === 'assign' && s.score > 0) {
      assert.equal(s.score, current + 1)
      assert.equal(Math.abs(s.from[0] - s.cell[0]) + Math.abs(s.from[1] - s.cell[1]), 1)
      assert.equal(scores.get(key(...s.from)), s.score - 1)
    }
  }
})
