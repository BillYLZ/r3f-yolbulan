import { key } from '../grids.js'

const angle = (grid, a, b) => {
  const [ax, az] = grid.toWorld(a)
  const [bx, bz] = grid.toWorld(b)
  return (Math.atan2(bz - az, bx - ax) * 180) / Math.PI // screen view from above: clockwise is positive
}
const mod = (v) => ((v % 360) + 360) % 360
const dist = (grid, a, b) => {
  const [ax, az] = grid.toWorld(a)
  const [bx, bz] = grid.toWorld(b)
  return Math.hypot(ax - bx, az - bz)
}
const same = (a, b) => a[0] === b[0] && a[1] === b[1]

/**
 * Sağ el kuralı (robot): hedefe doğru yürür. Önünde engel olup hedefe yaklaşamayınca sağ elini duvardan
 * ayırmadan engelin etrafından dolaşır (sırasıyla sağ, düz, sol, geri); hedefe başladığı yerden daha
 * yakın bir noktada yeniden hedefe yönelir. Gerçek bir robot gibi sadece yanındaki kareleri görür.
 * Yol yürüdüğü her adımdır (aynı kareden iki kez geçebilir). Takılırsa path = [].
 */
export function wallFollower(grid, walls, start, goal) {
  const open = (c) => grid.neighbors(c, walls).filter((n) => !walls.has(key(...n)))
  const visited = [start]
  const path = [start]
  let cur = start
  let heading = angle(grid, start, goal)
  let mode = 'go'
  let hitDist = Infinity
  const states = new Set()
  const limit = grid.cols * grid.rows * 8

  while (!same(cur, goal) && path.length < limit) {
    const d = dist(grid, cur, goal)
    const ns = open(cur)
    if (!ns.length) break
    let next = null
    if (mode === 'follow' && d < hitDist - 1e-9) {
      const closer = ns.filter((n) => dist(grid, n, goal) < d - 1e-9)
      if (closer.length) mode = 'go'
    }
    if (mode === 'go') {
      const closer = ns.filter((n) => dist(grid, n, goal) < d - 1e-9).sort((a, b) => dist(grid, a, goal) - dist(grid, b, goal))
      if (closer.length) next = closer[0]
      else {
        // blocked: start hugging the obstacle, turning left first so the wall stays on the right
        mode = 'follow'
        hitDist = d
        const toGoal = angle(grid, cur, goal)
        next = [...ns].sort((a, b) => mod(toGoal - angle(grid, cur, a)) - mod(toGoal - angle(grid, cur, b)))[0]
      }
    } else {
      // right hand on the wall: prefer right, then straight, then left, then back
      next = [...ns].sort((a, b) => mod(heading + 90 - angle(grid, cur, a)) - mod(heading + 90 - angle(grid, cur, b)))[0]
    }
    const state = `${key(...cur)}>${key(...next)}|${mode}`
    if (mode === 'follow' && states.has(state)) return { visited, path: [] } // circling an island forever
    states.add(state)
    heading = angle(grid, cur, next)
    cur = next
    visited.push(cur)
    path.push(cur)
  }
  return { visited, path: same(cur, goal) ? path : [] }
}

/**
 * Rastgele yürüyüş: her adımda rastgele bir komşuya gider; Finish'e varınca durur.
 * visited yürünen her adımdır. Küpün yürüdüğü yol, bu yürüyüşün döngüleri silinmiş halidir
 * (bir kareye geri dönüldüğünde aradaki tur atılır).
 */
export function randomWalk(grid, walls, start, goal, { rng = Math.random } = {}) {
  const visited = [start]
  let cur = start
  const limit = grid.cols * grid.rows * 60
  while (!same(cur, goal) && visited.length < limit) {
    const ns = grid.neighbors(cur, walls).filter((n) => !walls.has(key(...n)))
    if (!ns.length) break
    cur = ns[Math.floor(rng() * ns.length)]
    visited.push(cur)
  }
  if (!same(cur, goal)) return { visited, path: [] }
  // loop erasure
  const path = []
  const index = new Map()
  for (const c of visited) {
    const k = key(...c)
    if (index.has(k)) {
      const i = index.get(k)
      for (const dropped of path.splice(i + 1)) index.delete(key(...dropped))
    } else {
      index.set(k, path.length)
      path.push(c)
    }
  }
  return { visited, path }
}
