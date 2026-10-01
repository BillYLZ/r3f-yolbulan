import { test } from 'node:test'
import assert from 'node:assert/strict'
import { astar, key, randomWalls } from './astar.js'
import { squareGrid } from '../grids.js'

test('finds shortest path on empty grid', () => {
  const { path } = astar(squareGrid(5), new Set(), [0, 0], [4, 4])
  assert.equal(path.length, 9)
  assert.deepEqual(path[0], [0, 0])
  assert.deepEqual(path.at(-1), [4, 4])
})

test('routes around walls', () => {
  const walls = new Set([key(1, 0), key(1, 1), key(1, 2)])
  const { path } = astar(squareGrid(4), walls, [0, 0], [2, 0])
  assert.equal(path.length, 9)
  assert.ok(path.every(([x, y]) => !walls.has(key(x, y))))
})

test('returns empty path when blocked', () => {
  const walls = new Set([key(1, 0), key(0, 1)])
  assert.deepEqual(astar(squareGrid(3), walls, [0, 0], [2, 2]).path, [])
})

test('randomWalls is always solvable', () => {
  for (let i = 0; i < 20; i++) {
    const walls = randomWalls(squareGrid(20), [1, 1], [18, 18], 0.4)
    assert.ok(astar(squareGrid(20), walls, [1, 1], [18, 18]).path.length > 0)
  }
})
