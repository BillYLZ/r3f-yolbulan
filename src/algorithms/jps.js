import { key } from '../grids.js'

/**
 * Jump Point Search — A*'ın çapraz hareketli kare zemin için hızlandırılmış hali.
 * Düz ve çapraz çizgiler boyunca kare kare bakmak yerine "atlar"; sadece yön değiştirmenin gerekebileceği
 * noktalarda (jump point) durup karar verir. Köşe kesmeden (iki duvar arasından çapraz geçmeden) çalışır.
 * visited: atlarken taranan bütün kareler. Terrain (costs) dikkate alınmaz.
 */
export function jps(grid, walls, start, goal) {
  const ok = (x, y) => grid.inBounds([x, y]) && !walls.has(key(x, y))
  const visited = []
  const isGoal = (x, y) => x === goal[0] && y === goal[1]

  function jump(x, y, px, py) {
    const dx = x - px
    const dy = y - py
    if (!ok(x, y)) return null
    visited.push([x, y])
    if (isGoal(x, y)) return [x, y]
    if (dx !== 0 && dy !== 0) {
      if (jump(x + dx, y, x, y) || jump(x, y + dy, x, y)) return [x, y]
    } else if (dx !== 0) {
      if ((ok(x, y - 1) && !ok(x - dx, y - 1)) || (ok(x, y + 1) && !ok(x - dx, y + 1))) return [x, y]
    } else if (dy !== 0) {
      if ((ok(x - 1, y) && !ok(x - 1, y - dy)) || (ok(x + 1, y) && !ok(x + 1, y - dy))) return [x, y]
    }
    if (ok(x + dx, y) && ok(x, y + dy)) return jump(x + dx, y + dy, x, y)
    return null
  }

  function neighbours([x, y], par) {
    if (!par) return grid.neighbors([x, y], walls).filter(([nx, ny]) => ok(nx, ny))
    const dx = Math.sign(x - par[0])
    const dy = Math.sign(y - par[1])
    const out = []
    if (dx !== 0 && dy !== 0) {
      if (ok(x, y + dy)) out.push([x, y + dy])
      if (ok(x + dx, y)) out.push([x + dx, y])
      if (ok(x, y + dy) && ok(x + dx, y)) out.push([x + dx, y + dy])
    } else if (dx !== 0) {
      const next = ok(x + dx, y)
      const top = ok(x, y + 1)
      const bottom = ok(x, y - 1)
      if (next) {
        out.push([x + dx, y])
        if (top) out.push([x + dx, y + 1])
        if (bottom) out.push([x + dx, y - 1])
      }
      if (top) out.push([x, y + 1])
      if (bottom) out.push([x, y - 1])
    } else {
      const next = ok(x, y + dy)
      const right = ok(x + 1, y)
      const left = ok(x - 1, y)
      if (next) {
        out.push([x, y + dy])
        if (right) out.push([x + 1, y + dy])
        if (left) out.push([x - 1, y + dy])
      }
      if (right) out.push([x + 1, y])
      if (left) out.push([x - 1, y])
    }
    return out
  }

  const g = new Map([[key(...start), 0]])
  const parent = new Map()
  const closed = new Set()
  const open = [[grid.heuristic(start, goal), 0, start]]
  let counter = 0
  visited.push(start)
  while (open.length) {
    open.sort((a, b) => a[0] - b[0] || a[1] - b[1])
    const [, , cur] = open.shift()
    const k = key(...cur)
    if (closed.has(k)) continue
    closed.add(k)
    if (isGoal(...cur)) return { visited, path: expand(parent, k) }
    const par = parent.has(k) ? parent.get(k).split(',').map(Number) : null
    for (const [nx, ny] of neighbours(cur, par)) {
      const jp = jump(nx, ny, cur[0], cur[1])
      if (!jp) continue
      const jk = key(...jp)
      if (closed.has(jk)) continue
      const ng = g.get(k) + grid.heuristic(cur, jp) // octile distance along a straight or diagonal line
      if (ng < (g.get(jk) ?? Infinity)) {
        g.set(jk, ng)
        parent.set(jk, k)
        open.push([ng + grid.heuristic(jp, goal), ++counter, jp])
      }
    }
  }
  return { visited, path: [] }
}

// Jump points → every cell in between (segments are straight or diagonal lines).
function expand(parent, k) {
  const points = [k.split(',').map(Number)]
  while (parent.has(k)) {
    k = parent.get(k)
    points.unshift(k.split(',').map(Number))
  }
  const path = [points[0]]
  for (let i = 1; i < points.length; i++) {
    let [x, y] = points[i - 1]
    const [tx, ty] = points[i]
    const dx = Math.sign(tx - x)
    const dy = Math.sign(ty - y)
    while (x !== tx || y !== ty) {
      x += dx
      y += dy
      path.push([x, y])
    }
  }
  return path
}
