import { test } from 'node:test'
import assert from 'node:assert/strict'
import { yolbulan1995 } from './yolbulan1995.js'
import { astar, key, randomWalls } from './astar.js'
import { squareGrid } from '../grids.js'

test('start is 0 and its open neighbours are 1; walls get no score', () => {
  const walls = new Set([key(3, 2)])
  const { scores } = yolbulan1995(squareGrid(5), walls, [2, 2], [4, 4])
  assert.equal(scores.get(key(2, 2)), 0)
  for (const k of [key(1, 2), key(2, 1), key(2, 3)]) assert.equal(scores.get(k), 1)
  assert.equal(scores.has(key(3, 2)), false)
})

test('stops spreading once finish is scored', () => {
  const { scores } = yolbulan1995(squareGrid(10), new Set(), [0, 0], [1, 0])
  assert.equal(scores.get(key(1, 0)), 1)
  assert.ok(![...scores.values()].some((s) => s > 1))
})

test('path length matches A* (both shortest)', () => {
  for (let i = 0; i < 20; i++) {
    const walls = randomWalls(squareGrid(14), [1, 12], [12, 1], 0.3)
    const a = astar(squareGrid(14), walls, [1, 12], [12, 1]).path.length
    const b = yolbulan1995(squareGrid(14), walls, [1, 12], [12, 1]).path.length
    assert.equal(b, a)
  }
})

test('path scores count down 0, 1, 2 ... to finish', () => {
  const { path, scores } = yolbulan1995(squareGrid(8), new Set([key(2, 0), key(2, 1), key(2, 2)]), [0, 0], [4, 0])
  path.forEach(([x, y], i) => assert.equal(scores.get(key(x, y)), i))
})

test('no path when finish is walled off', () => {
  const walls = new Set([key(3, 4), key(4, 3)])
  assert.deepEqual(yolbulan1995(squareGrid(5), walls, [0, 0], [4, 4]).path, [])
})

test('steps replay to the same scores and trace the path back from finish', () => {
  const walls = randomWalls(squareGrid(10), [0, 9], [9, 0], 0.25)
  const { steps, scores, path } = yolbulan1995(squareGrid(10), walls, [0, 9], [9, 0])
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

// Small seeded generator so random runs are repeatable.
const seeded = (seed) => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)

test('counts distinct shortest paths', () => {
  // 3×3 open grid, corner to corner: C(4, 2) = 6 paths
  assert.equal(yolbulan1995(squareGrid(3), new Set(), [0, 0], [2, 2]).pathCount, 6)
  assert.equal(yolbulan1995(squareGrid(3), new Set([key(1, 1)]), [0, 0], [2, 2]).pathCount, 2)
})

test('random mode finds different shortest paths, all valid and shortest', () => {
  const seen = new Set()
  for (let seed = 1; seed <= 30; seed++) {
    const { path, steps, scores } = yolbulan1995(squareGrid(8), new Set(), [0, 0], [7, 7], { random: true, rng: seeded(seed) })
    assert.equal(path.length, 15)
    path.forEach(([x, y], i) => assert.equal(scores.get(key(x, y)), i))
    const traced = steps.filter((s) => s.t === 'trace').map((s) => s.cell)
    assert.deepEqual(traced, [...path].reverse())
    seen.add(path.join(';'))
  }
  assert.ok(seen.size > 10, `only ${seen.size} different paths`)
})

test('fixed mode always finds the same path', () => {
  const walls = randomWalls(squareGrid(10), [0, 9], [9, 0], 0.2)
  const a = yolbulan1995(squareGrid(10), walls, [0, 9], [9, 0]).path
  const b = yolbulan1995(squareGrid(10), walls, [0, 9], [9, 0]).path
  assert.deepEqual(a, b)
})
