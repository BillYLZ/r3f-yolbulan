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
