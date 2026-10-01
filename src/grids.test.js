import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ARENAS, GRIDS, diagGrid, hexGrid, makeGrids, squareGrid, triGrid } from './grids.js'

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

test('default arena is unchanged: 14 × 14 squares, 23 × 14 triangles, 13 × 15 hexagons', () => {
  assert.deepEqual([GRIDS.square.cols, GRIDS.square.rows], [14, 14])
  assert.deepEqual([GRIDS.tri.cols, GRIDS.tri.rows], [23, 14])
  assert.deepEqual([GRIDS.hex.cols, GRIDS.hex.rows], [13, 15])
})

test('bigger arenas grow every floor to about the same size', () => {
  for (const [n, [bx, by]] of Object.entries(ARENAS)) {
    const g = makeGrids(bx, by)
    assert.equal((g.square.cols / 7) * (g.square.rows / 7), Number(n))
    for (const grid of Object.values(g)) {
      assert.ok(Math.abs(grid.width - bx * 7) < 1, `${grid.id} width ${grid.width}`)
      assert.ok(Math.abs(grid.depth - by * 7) < 1, `${grid.id} depth ${grid.depth}`)
      // corners of the arena map back to their cells
      for (const c of [grid.start, grid.goal, [0, 0], [grid.cols - 1, grid.rows - 1]]) assert.deepEqual(grid.toCell(...grid.toWorld(c)), c)
    }
  }
})
