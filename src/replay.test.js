import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildTimeline, viewAt } from './replay.js'
import { yolbulan1995 } from './algorithms/yolbulan1995.js'
import { randomWalls } from './algorithms/astar.js'
import { squareGrid } from './grids.js'

const run = () => {
  const walls = randomWalls(squareGrid(10), [0, 9], [9, 0], 0.25)
  const result = yolbulan1995(squareGrid(10), walls, [0, 9], [9, 0])
  return { result, tl: buildTimeline(result, 4) }
}

test('phases come in order: numbers, iterations, path', () => {
  const { tl } = run()
  assert.deepEqual(tl.phases.map((p) => p.id), ['numbers', 'iterate', 'trace'])
})

test('numbers phase writes one score wave at a time, without branches', () => {
  const { result, tl } = run()
  const v = viewAt(result, tl, 0, 3)
  assert.deepEqual([...new Set(v.scores.values())].sort(), [0, 1, 2])
  assert.equal(v.branches.length, 0)
  assert.equal(v.traced.length, 0)
})

test('iterations start with every number already written, branches grow', () => {
  const { result, tl } = run()
  const a = viewAt(result, tl, 1, 5)
  const b = viewAt(result, tl, 1, 50)
  assert.equal(a.scores.size, result.scores.size)
  assert.ok(b.branches.length > a.branches.length)
  assert.equal(a.traced.length, 0)
})

test('path is drawn only in the last phase, and is complete when finished', () => {
  const { result, tl } = run()
  assert.equal(viewAt(result, tl, 2, 3).traced.length, 3)
  const done = viewAt(result, tl, 3, 0)
  assert.deepEqual(done.traced, [...result.path].reverse())
  assert.equal(done.cursor, null)
})
