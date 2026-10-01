import { test } from 'node:test'
import assert from 'node:assert/strict'
import { squareGrid, triGrid } from './grids.js'

for (const grid of [squareGrid(), triGrid()]) {
  test(`${grid.id}: neighbours are mutual and share an edge`, () => {
    for (let x = 0; x < grid.cols; x++)
      for (let y = 0; y < grid.rows; y++)
        for (const n of grid.neighbors([x, y])) {
          assert.ok(grid.neighbors(n).some(([a, b]) => a === x && b === y), `${x},${y} ↔ ${n}`)
          const shared = grid.polygon([x, y]).filter(([px, pz]) =>
            grid.polygon(n).some(([qx, qz]) => Math.abs(px - qx) < 1e-9 && Math.abs(pz - qz) < 1e-9),
          )
          assert.equal(shared.length, 2)
        }
  })

  test(`${grid.id}: toCell finds the cell under its own centre`, () => {
    for (let x = 0; x < grid.cols; x++)
      for (let y = 0; y < grid.rows; y++) assert.deepEqual(grid.toCell(...grid.toWorld([x, y])), [x, y])
  })
}

test('triangles have 3 neighbours inside the grid, squares 4', () => {
  assert.equal(triGrid().neighbors([5, 5]).length, 3)
  assert.equal(squareGrid().neighbors([5, 5]).length, 4)
})
