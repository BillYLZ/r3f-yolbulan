import { test } from 'node:test'
import assert from 'node:assert/strict'
import { METHODS, key, pathCost, randomTerrain, randomWalls, supports } from './index.js'
import { dijkstra } from './astar.js'
import { yolbulan1995 } from './yolbulan1995.js'
import { GRIDS } from '../grids.js'
import { curveLength, segmentClear, stepLength, wallBlocked } from '../geom.js'

const seeded = (seed) => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)

function assertValid(grid, walls, path) {
  assert.deepEqual(path[0], grid.start)
  assert.deepEqual(path.at(-1), grid.goal)
  for (let j = 1; j < path.length; j++) {
    const ok = grid.neighbors(path[j - 1], walls).some(([x, y]) => x === path[j][0] && y === path[j][1])
    assert.ok(ok, `step ${path[j - 1]} → ${path[j]}`)
    assert.ok(!walls.has(key(...path[j])))
  }
}

// Any-angle routes: from Start to Finish in straight pieces that never touch a wall.
function assertValidPoints(grid, walls, r) {
  const close = (a, b) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9
  assert.ok(close(r.points[0], grid.toWorld(grid.start)), 'starts at Start')
  assert.ok(close(r.points.at(-1), grid.toWorld(grid.goal)), 'ends at Finish')
  const blocked = wallBlocked(grid, walls)
  for (let i = 1; i < r.points.length; i++) assert.ok(segmentClear(blocked, r.points[i - 1], r.points[i]), `piece ${i} hits a wall`)
  assert.ok(Math.abs(r.cost - curveLength(r.points) / stepLength(grid)) < 1e-9)
  for (const c of r.path) assert.ok(!walls.has(key(...c)))
}

for (const m of METHODS) {
  for (const grid of Object.values(GRIDS).filter((g) => supports(m, g.id))) {
    test(`${m.name} on ${grid.label}: valid path${m.shortest ? ', and shortest' : ''}`, () => {
      let found = 0
      for (let i = 0; i < 12; i++) {
        const walls = randomWalls(grid, grid.start, grid.goal, 0.25)
        const costs = randomTerrain(grid, walls, grid.start, grid.goal, 0.15)
        const r = m.run(grid, walls, grid.start, grid.goal, { costs, random: i % 2 === 1, rng: seeded(i + 1) })
        const { path, visited } = r
        assert.ok(visited.length > 0)
        if (!path.length) {
          assert.ok(!m.alwaysFinds, 'must find a path when one exists')
          continue
        }
        found += 1
        if (m.anyAngle) {
          assertValidPoints(grid, walls, r)
          continue
        }
        assertValid(grid, walls, path)
        if (m.shortest === 'steps') assert.equal(path.length, yolbulan1995(grid, walls, grid.start, grid.goal).path.length)
        if (m.shortest === 'cost') {
          const best = dijkstra(grid, walls, grid.start, grid.goal, { costs }).path
          assert.ok(Math.abs(pathCost(grid, path, costs) - pathCost(grid, best, costs)) < 1e-9)
        }
        if (m.shortest === 'steps-diag') {
          const best = dijkstra(grid, walls, grid.start, grid.goal).path
          assert.ok(Math.abs(pathCost(grid, path) - pathCost(grid, best)) < 1e-9, `${pathCost(grid, path)} vs ${pathCost(grid, best)}`)
        }
      }
      assert.ok(found > 0, 'never found a path')
    })
  }
}

test('every method finds the way across an empty floor', () => {
  for (const m of METHODS)
    for (const grid of Object.values(GRIDS).filter((g) => supports(m, g.id))) {
      const r = m.run(grid, new Set(), grid.start, grid.goal, { rng: seeded(7) })
      assert.ok(r.path.length > 0, `${m.name} on ${grid.label}`)
      if (m.anyAngle) assertValidPoints(grid, new Set(), r)
      else assertValid(grid, new Set(), r.path)
    }
})

test('greedy can be beaten: on some map it finds a longer path than the shortest', () => {
  const grid = GRIDS.square
  const greedy = METHODS.find((m) => m.id === 'greedy')
  let longer = false
  for (let i = 0; i < 40 && !longer; i++) {
    const walls = randomWalls(grid, grid.start, grid.goal, 0.3)
    const g = greedy.run(grid, walls, grid.start, grid.goal).path.length
    longer = g > yolbulan1995(grid, walls, grid.start, grid.goal).path.length
  }
  assert.ok(longer)
})

test('Theta* is never longer than the shortest cell-to-cell route', () => {
  const theta = METHODS.find((m) => m.id === 'theta')
  for (const grid of Object.values(GRIDS))
    for (let i = 0; i < 10; i++) {
      const walls = randomWalls(grid, grid.start, grid.goal, 0.25)
      const best = dijkstra(grid, walls, grid.start, grid.goal).path
      const bestLength = curveLength(best.map((c) => grid.toWorld(c))) / stepLength(grid)
      assert.ok(theta.run(grid, walls, grid.start, grid.goal).cost <= bestLength + 1e-6, grid.label)
    }
})

test('on an open floor Theta* and RRT* go almost straight', () => {
  for (const grid of Object.values(GRIDS)) {
    const straight = curveLength([grid.toWorld(grid.start), grid.toWorld(grid.goal)]) / stepLength(grid)
    assert.ok(METHODS.find((m) => m.id === 'theta').run(grid, new Set(), grid.start, grid.goal).cost < straight * 1.05, grid.label)
    assert.ok(METHODS.find((m) => m.id === 'rrtstar').run(grid, new Set(), grid.start, grid.goal, { rng: seeded(3) }).cost < straight * 1.25, grid.label)
  }
})

test('potential field has to shake itself out of a pocket facing Finish', () => {
  // a cup of walls opening away from Finish, Start inside it
  const grid = GRIDS.square
  const walls = new Set()
  for (let y = 4; y <= 9; y++) walls.add(key(8, y))
  for (let x = 3; x <= 8; x++) walls.add(key(x, 4)).add(key(x, 9))
  const r = METHODS.find((m) => m.id === 'potential').run(grid, walls, [6, 6], grid.goal, { rng: seeded(1) })
  assert.ok(r.field.length > 0)
  assert.ok(r.escapes > 0, 'had to shake itself free at least once')
})

test('visibility graph: never longer than Theta*, and it bends only at wall corners', () => {
  const vg = METHODS.find((m) => m.id === 'visibility')
  const theta = METHODS.find((m) => m.id === 'theta')
  for (const grid of Object.values(GRIDS))
    for (let i = 0; i < 8; i++) {
      const walls = randomWalls(grid, grid.start, grid.goal, 0.25)
      const r = vg.run(grid, walls, grid.start, grid.goal)
      if (!r.points) continue
      assert.ok(r.cost <= theta.run(grid, walls, grid.start, grid.goal).cost * 1.02, grid.label)
      // every bend is one of the graph's corner nodes, close to a wall
      for (const p of r.points.slice(1, -1)) {
        assert.ok(r.graph.nodes.some((q) => q[0] === p[0] && q[1] === p[1]))
        const near = [...walls].some((k) => curveLength([p, grid.toWorld(k.split(',').map(Number))]) < 1.2 * grid.cellSize + 0.5)
        assert.ok(near, 'bend far from any wall')
      }
    }
})

test('visibility graph on an open floor is one straight line', () => {
  for (const grid of Object.values(GRIDS)) {
    const r = METHODS.find((m) => m.id === 'visibility').run(grid, new Set(), grid.start, grid.goal)
    assert.equal(r.points.length, 2, grid.label)
  }
})
