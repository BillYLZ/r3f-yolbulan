import { key } from '../grids.js'
import { cellsAlong, curveLength, dist, segmentClear, stepLength, wallBlocked } from '../geom.js'

// Methods that move in any direction, not just cell to cell. Besides { visited, path } (cells, for the counters)
// they return `points`: the route as world points [x, z], and `cost`: its length in steps of the grid.

const finish = (grid, visited, points, extra = {}) => {
  if (!points) return { visited, path: [], points: null, ...extra }
  return { visited, path: cellsAlong(grid, points), points, cost: curveLength(points) / stepLength(grid), ...extra }
}

/**
 * Theta*: A* where a cell may take its grandparent as parent when there is a straight, clear line between
 * them. The route is a few straight lines at any angle, through cell centres.
 */
export function thetaStar(grid, walls, start, goal) {
  const blocked = wallBlocked(grid, walls)
  const radius = 0.2 * grid.cellSize
  const W = (c) => grid.toWorld(c)
  const sight = (a, b) => segmentClear(blocked, W(a), W(b), radius)
  const h = (c) => dist(W(c), W(goal))
  const g = new Map([[key(...start), 0]])
  const parent = new Map([[key(...start), start]])
  const closed = new Set()
  const open = [[h(start), 0, start]]
  const visited = []
  let counter = 0
  while (open.length) {
    open.sort((a, b) => a[0] - b[0] || a[1] - b[1])
    const [, , cur] = open.shift()
    const k = key(...cur)
    if (closed.has(k)) continue
    closed.add(k)
    visited.push(cur)
    if (cur[0] === goal[0] && cur[1] === goal[1]) {
      const chain = [cur]
      let c = cur
      while (key(...parent.get(key(...c))) !== key(...c)) {
        c = parent.get(key(...c))
        chain.unshift(c)
      }
      return finish(grid, visited, chain.map(W), { anchors: chain })
    }
    for (const n of grid.neighbors(cur, walls)) {
      const nk = key(...n)
      if (walls.has(nk) || closed.has(nk)) continue
      const pc = parent.get(k)
      // path 2: straight from the grandparent if it can see n, otherwise through cur (path 1)
      const [from, ng] = sight(pc, n) ? [pc, g.get(key(...pc)) + dist(W(pc), W(n))] : [cur, g.get(k) + dist(W(cur), W(n))]
      if (ng < (g.get(nk) ?? Infinity) - 1e-9) {
        g.set(nk, ng)
        parent.set(nk, from)
        open.push([ng + h(n), ++counter, n])
      }
    }
  }
  return finish(grid, visited, null)
}

/**
 * Potansiyel alan: Finish pulls the cube, walls and the arena edge push it away. The cube slides along the
 * sum of these forces in small steps. In a pocket where the forces cancel it gets stuck (a local minimum) and
 * it shakes itself free with a short random walk (a few times at most), then follows the forces again; if that
 * does not help it gives up. `field` holds the force arrow for every free cell, for drawing.
 * random: also a little noise on every step.
 */
export function potentialField(grid, walls, start, goal, { random = false, rng = Math.random } = {}) {
  const blocked = wallBlocked(grid, walls)
  const cs = grid.cellSize
  const G = grid.toWorld(goal)
  const wallPts = [...walls].map((k) => grid.toWorld(k.split(',').map(Number)))
  const reach = 0.95 * cs // walls further than this do not push
  const [hw, hd] = [grid.width / 2, grid.depth / 2]

  const force = ([x, z]) => {
    const dg = dist([x, z], G) || 1e-6
    let fx = (G[0] - x) / dg
    let fz = (G[1] - z) / dg
    const push = (ox, oz, d) => {
      if (d >= reach) return
      const s = 0.35 * (1 / Math.max(d, 0.05) - 1 / reach) / Math.max(d, 0.05)
      fx += ox * s
      fz += oz * s
    }
    for (const [wx, wz] of wallPts) {
      const d0 = Math.hypot(x - wx, z - wz)
      if (d0 < reach + cs) push((x - wx) / (d0 || 1), (z - wz) / (d0 || 1), Math.max(d0 - 0.45 * cs, 0.02))
    }
    push(1, 0, x + hw)
    push(-1, 0, hw - x)
    push(0, 1, z + hd)
    push(0, -1, hd - z)
    return [fx, fz]
  }

  const field = []
  for (let cx = 0; cx < grid.cols; cx++)
    for (let cy = 0; cy < grid.rows; cy++) {
      if (walls.has(key(cx, cy))) continue
      const p = grid.toWorld([cx, cy])
      const [fx, fz] = force(p)
      const m = Math.hypot(fx, fz) || 1
      field.push([p[0], p[1], fx / m, fz / m])
    }

  const step = 0.07 * Math.max(cs, 0.8)
  const points = [grid.toWorld(start)]
  let p = points[0]
  let best = dist(p, G)
  let sinceBest = 0
  let escapes = 0
  let shake = 0 // steps left in the current random escape
  let shakeDir = 0
  const tryMove = (angle) => {
    for (const turn of [0, 0.4, -0.4, 0.9, -0.9, 1.4, -1.4]) {
      const a = angle + turn
      const q = [p[0] + Math.cos(a) * step, p[1] + Math.sin(a) * step]
      if (!blocked(q) && segmentClear(blocked, p, q, 0.12 * cs)) return q
    }
    return null
  }
  for (let i = 0; i < 9000; i++) {
    if (dist(p, G) < step * 1.5) {
      points.push(G)
      return finish(grid, cellsAlong(grid, points), points, { field, escapes })
    }
    let angle
    if (shake > 0) {
      // random escape: wander in a roughly steady direction for a while
      shakeDir += (rng() - 0.5) * 0.8
      angle = shakeDir
      shake -= 1
    } else {
      let [fx, fz] = force(p)
      if (random) {
        fx += (rng() - 0.5) * 0.6
        fz += (rng() - 0.5) * 0.6
      }
      angle = Math.atan2(fz, fx)
    }
    const q = tryMove(angle)
    if (q) {
      p = q
      points.push(p)
    } else if (shake > 0) shakeDir = rng() * Math.PI * 2
    const d = dist(p, G)
    if (d < best - 0.05) [best, sinceBest] = [d, 0]
    else if (++sinceBest > 160 && shake === 0) {
      // stuck in a pocket: shake free, a limited number of times
      if (escapes >= 8) break
      escapes += 1
      shake = 40 + Math.floor(rng() * 60)
      shakeDir = rng() * Math.PI * 2
      sinceBest = 0
      best = d
    }
  }
  return { visited: cellsAlong(grid, points), path: [], points: null, field, stuck: points, escapes }
}

/**
 * RRT (Rapidly-exploring Random Tree): from Start the tree reaches towards random points in the arena, one short
 * branch at a time, never through a wall. When a branch can see Finish, the route is read back along the tree.
 * star = true (RRT*): keeps growing for a while; each new branch picks the cheapest nearby parent and re-links
 * its neighbours through itself when that is shorter, so the route straightens out.
 * `tree` lists every branch [[x, z], [x, z]] in the order it grew (for RRT* with their final parents).
 */
export function rrt(grid, walls, start, goal, { rng = Math.random, star = false } = {}) {
  const blocked = wallBlocked(grid, walls)
  const radius = 0.18 * grid.cellSize
  const clear = (a, b) => segmentClear(blocked, a, b, radius)
  const unit = stepLength(grid)
  const stepMax = 0.9 * unit
  const near = 2.6 * unit
  const S = grid.toWorld(start)
  const G = grid.toWorld(goal)
  const nodes = [{ p: S, parent: -1, cost: 0 }]
  const children = [[]]
  let goalNode = -1
  const [hw, hd] = [grid.width / 2, grid.depth / 2]
  const maxIter = 8000
  let afterFound = 0

  for (let it = 0; it < maxIter; it++) {
    const sample = rng() < 0.1 ? G : [(rng() * 2 - 1) * hw, (rng() * 2 - 1) * hd]
    if (blocked(sample)) continue
    let ni = 0
    let nd = Infinity
    for (let i = 0; i < nodes.length; i++) {
      const d = dist(nodes[i].p, sample)
      if (d < nd) [ni, nd] = [i, d]
    }
    if (nd < 1e-6) continue
    const f = Math.min(1, stepMax / nd)
    const q = [nodes[ni].p[0] + (sample[0] - nodes[ni].p[0]) * f, nodes[ni].p[1] + (sample[1] - nodes[ni].p[1]) * f]
    if (!clear(nodes[ni].p, q)) continue

    let parent = ni
    let cost = nodes[ni].cost + dist(nodes[ni].p, q)
    let nearby = []
    if (star) {
      // cheapest clear parent among nearby nodes; the wall check only runs for candidates that would be cheaper
      nearby = []
      for (let i = 0; i < nodes.length; i++) if (dist(nodes[i].p, q) < near) nearby.push(i)
      nearby.sort((a, b) => nodes[a].cost + dist(nodes[a].p, q) - (nodes[b].cost + dist(nodes[b].p, q)))
      for (const i of nearby) {
        const c = nodes[i].cost + dist(nodes[i].p, q)
        if (c >= cost) break
        if (clear(nodes[i].p, q)) {
          ;[parent, cost] = [i, c]
          break
        }
      }
    }
    const qi = nodes.push({ p: q, parent, cost }) - 1
    children.push([])
    children[parent].push(qi)
    if (star) {
      for (const i of nearby) {
        const c = cost + dist(q, nodes[i].p)
        if (i === parent || c >= nodes[i].cost - 1e-9 || !clear(q, nodes[i].p)) continue
        const delta = nodes[i].cost - c
        const old = children[nodes[i].parent]
        old.splice(old.indexOf(i), 1)
        nodes[i].parent = qi
        children[qi].push(i)
        // every node below a re-linked one gets cheaper by the same amount
        const stack = [i]
        while (stack.length) {
          const j = stack.pop()
          nodes[j].cost -= delta
          stack.push(...children[j])
        }
      }
    }
    // can this node finish the route?
    if (dist(q, G) <= stepMax && clear(q, G)) {
      const c = cost + dist(q, G)
      if (goalNode < 0 || c < nodes[goalNode].cost) {
        if (goalNode < 0) {
          goalNode = nodes.push({ p: G, parent: qi, cost: c }) - 1
          children.push([])
        } else Object.assign(nodes[goalNode], { parent: qi, cost: c })
      }
    }
    if (goalNode >= 0 && (!star || ++afterFound > 900)) break
  }

  const tree = nodes.filter((n) => n.parent >= 0).map((n) => [nodes[n.parent].p, n.p])
  const visited = []
  for (const n of nodes) {
    const c = grid.toCell(...n.p)
    if (c) visited.push(c)
  }
  if (goalNode < 0) return { visited, path: [], points: null, tree }
  const points = []
  for (let i = goalNode; i >= 0; i = nodes[i].parent) points.unshift(nodes[i].p)
  return finish(grid, visited, points, { tree })
}

export const rrtStar = (grid, walls, start, goal, opts = {}) => rrt(grid, walls, start, goal, { ...opts, star: true })
