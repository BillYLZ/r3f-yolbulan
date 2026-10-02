import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decodeMap, encodeMap } from './mapcode.js'
import { ARENAS, key, makeGrids } from './grids.js'
import { randomTerrain, randomWalls } from './algorithms/index.js'

test('reads the example from the request: 1 wall, 2 water, 3 mud, 0 free, L new row', () => {
  const m = decodeMap('#1010012L00010001L100100203')
  assert.equal(m.gridId, 'square')
  assert.equal(m.arena, '4')
  assert.ok(m.walls.has(key(0, 0)) && m.walls.has(key(2, 0)) && m.walls.has(key(5, 0)))
  assert.equal(m.terrain.get(key(6, 0)), 5) // 2 = water
  assert.equal(m.terrain.get(key(8, 2)), 3) // 3 = mud
  assert.ok(!m.walls.has(key(1, 0)))
})

test('start, finish and floor name', () => {
  const m = decodeMap('#altigen:S01L0001F')
  assert.equal(m.gridId, 'hex')
  assert.deepEqual(m.start, [0, 0])
  assert.deepEqual(m.goal, [4, 1])
})

test('a code wider than the default arena picks a bigger one', () => {
  const m = decodeMap('#kare:' + '0'.repeat(20) + '1')
  assert.equal(m.grid.cols >= 21, true)
  assert.ok(m.walls.has(key(20, 0)))
})

test('not a map code', () => {
  assert.equal(decodeMap(''), null)
  assert.equal(decodeMap('#hello'), null)
  assert.equal(decodeMap('#kare:12x'), null)
})

test('every floor and arena survives a round trip', () => {
  for (const [n, [bx, by]] of Object.entries(ARENAS))
    for (const [gridId, grid] of Object.entries(makeGrids(bx, by))) {
      const walls = randomWalls(grid, grid.start, grid.goal, 0.25)
      const terrain = randomTerrain(grid, walls, grid.start, grid.goal, 0.15)
      const code = encodeMap(gridId, grid, walls, terrain, grid.start, grid.goal)
      const m = decodeMap('#' + code)
      assert.equal(m.gridId, gridId)
      assert.equal(m.arena, n, `${gridId} ${n}`)
      assert.deepEqual([...m.walls].sort(), [...walls].sort())
      assert.deepEqual([...m.terrain].sort(), [...terrain].sort())
      assert.deepEqual(m.start, grid.start)
      assert.deepEqual(m.goal, grid.goal)
    }
})

test('an empty arena keeps its size', () => {
  for (const [n, [bx, by]] of Object.entries(ARENAS)) {
    const grid = makeGrids(bx, by).square
    const m = decodeMap('#' + encodeMap('square', grid, new Set(), new Map(), grid.start, grid.goal))
    assert.equal(m.arena, n)
  }
})
