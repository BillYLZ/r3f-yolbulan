import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildWallShell } from './wallMesh.js'

const count = (walls) => {
  const { faces, edges } = buildWallShell(new Set(walls))
  return { quads: faces.length / 18, lines: edges.length / 6 }
}
const unique = (walls) => {
  const { edges } = buildWallShell(new Set(walls))
  const set = new Set()
  for (let i = 0; i < edges.length; i += 6) {
    const a = edges.slice(i, i + 3).join()
    const b = edges.slice(i + 3, i + 6).join()
    set.add([a, b].sort().join('|'))
  }
  return set.size
}

test('single cube has 6 faces and 12 edges', () => {
  assert.deepEqual(count(['3,3']), { quads: 6, lines: 12 })
})

test('two neighbours merge into one box: no shared face, 4 vertical edges', () => {
  // top 2 + bottom 2 + 6 sides; 6 top + 6 bottom segments + 4 verticals
  assert.deepEqual(count(['3,3', '4,3']), { quads: 10, lines: 16 })
  assert.equal(unique(['3,3', '4,3']), 16)
})

test('L shape gets 6 vertical edges', () => {
  const { edges } = buildWallShell(new Set(['3,3', '4,3', '3,4']))
  let verticals = new Set()
  for (let i = 0; i < edges.length; i += 6) {
    if (edges[i + 1] !== edges[i + 4]) verticals.add(`${edges[i]},${edges[i + 2]}`)
  }
  assert.equal(verticals.size, 6)
})
