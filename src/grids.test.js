import { test } from 'node:test'
import assert from 'node:assert/strict'
import { diagGrid, hexGrid, squareGrid, triGrid } from './grids.js'

for (const grid of [squareGrid(), diagGrid(), triGrid(), hexGrid()]) {
  test(`${grid.id}: neighbours are mutual and share an edge`, () => {
    for (let x = 0; x < grid.cols; x++)
      for (let y = 0; y < grid.rows; y++)
        for (const n of grid.neighbors([x, y])) {
          assert.ok(grid.neighbors(n).some(([a, b]) => a === x && b === y), `${x},${y} ↔ ${n}`)
          const shared = grid.polygon([x, y]).filter(([px, pz]) =>
            grid.polygon(n).some(([qx, qz]) => Math.abs(px - qx) < 1e-9 && Math.abs(pz - qz) < 1e-9),
          )
          // squares, triangles and hexagons share an edge; diagonal squares may share just a corner
          assert.equal(shared.length, grid.id === 'diag' && n[0] !== x && n[1] !== y ? 1 : 2)
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

test('hexagons have 6 neighbours, diagonal squares 8', () => {
  assert.equal(hexGrid().neighbors([5, 5]).length, 6)
  assert.equal(hexGrid().neighbors([5, 6]).length, 6)
  assert.equal(diagGrid().neighbors([5, 5]).length, 8)
})

test('diagonal steps never cut a wall corner', () => {
  const g = diagGrid()
  const walls = new Set(['6,5'])
  const n = g.neighbors([5, 5], walls).map(String)
  assert.ok(!n.includes('6,6') && !n.includes('6,4'))
  assert.ok(n.includes('4,4'))
})
