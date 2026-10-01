import { test } from 'node:test'
import assert from 'node:assert/strict'
import { smoothPath, curveLength } from './smooth.js'
import { GRIDS, key, squareGrid } from './grids.js'
import { randomTerrain, randomWalls } from './algorithms/index.js'
import { yolbulan1995 } from './algorithms/yolbulan1995.js'
import { dfs } from './algorithms/dfs.js'

const close = (a, b) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9

test('an open floor pulls tight to a single straight line', () => {
  const g = squareGrid(10)
  const path = yolbulan1995(g, new Set(), [0, 9], [9, 0]).path
  const { anchors, points } = smoothPath(g, new Set(), null, path)
  assert.deepEqual(anchors, [[0, 9], [9, 0]])
  assert.ok(Math.abs(curveLength(points) - Math.hypot(9, 9)) < 1e-6)
})

for (const grid of Object.values(GRIDS)) {
  test(`${grid.label}: smoothed path starts and ends right, never touches a wall, pulled path is shorter`, () => {
    for (let i = 0; i < 15; i++) {
      const walls = randomWalls(grid, grid.start, grid.goal, 0.25)
      const costs = randomTerrain(grid, walls, grid.start, grid.goal, 0.1)
      const path = (i % 2 ? dfs : yolbulan1995)(grid, walls, grid.start, grid.goal).path
      const { anchors, points } = smoothPath(grid, walls, costs, path)
      assert.ok(close(points[0], grid.toWorld(grid.start)), 'start')
      assert.ok(close(points.at(-1), grid.toWorld(grid.goal)), 'end')
      for (const p of points) {
        const c = grid.toCell(...p)
        assert.ok(c && !walls.has(key(...c)), `point ${p} in a wall`)
      }
      // anchors are a subsequence of the original path
      let j = 0
      for (const a of anchors) {
        while (j < path.length && key(...path[j]) !== key(...a)) j++
        assert.ok(j < path.length, 'anchor not on path')
      }
      // pulling never lengthens the path; the curve only rounds its corners
      const zigzag = curveLength(path.map((c) => grid.toWorld(c)))
      const pulled = curveLength(anchors.map((c) => grid.toWorld(c)))
      assert.ok(pulled <= zigzag + 1e-6, `pulled ${pulled} > zigzag ${zigzag}`)
      assert.ok(curveLength(points) <= pulled * 1.15, `curve ${curveLength(points)} vs pulled ${pulled}`)
    }
  })
}
