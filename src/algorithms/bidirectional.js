import { key } from '../grids.js'

function shuffled(list, rng) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Çift yönlü dalga — yolbulan1995'in puanlaması iki uçtan birden:
 *   Start'tan bir dalga (a: 0, 1, 2 …) ve Finish'ten bir dalga (b: 0, 1, 2 …) sırayla birer adım yayılır.
 *   İki dalga bir karede buluşunca durur; yol Start → buluşma → Finish.
 * Returns { visited, path, scores, sides, steps, meet } — steps are replayed like yolbulan1995's,
 * each with side 'a' (from Start) or 'b' (from Finish).
 */
export function bidirectional(grid, walls, start, goal, { random = false, rng = Math.random } = {}) {
  const order = (list) => (random ? shuffled(list, rng) : list)
  const scores = new Map()
  const sides = new Map()
  const parent = { a: new Map(), b: new Map() }
  const visited = []
  const steps = []
  const waves = { a: [start], b: [goal] }
  for (const [side, c] of [['a', start], ['b', goal]]) {
    scores.set(key(...c), 0)
    sides.set(key(...c), side)
    visited.push(c)
    steps.push({ t: 'assign', cell: c, score: 0, side })
  }
  if (start[0] === goal[0] && start[1] === goal[1]) return { visited, path: [start], scores, sides, steps, meet: key(...start) }

  let side = 'a'
  while (waves.a.length || waves.b.length) {
    if (!waves[side].length) side = side === 'a' ? 'b' : 'a'
    const other = side === 'a' ? 'b' : 'a'
    const next = []
    let best = null // [aKey, bKey, length] — finish the round so the shortest meeting wins
    for (const [x, y] of order(waves[side])) {
      const here = key(x, y)
      const score = scores.get(here)
      steps.push({ t: 'expand', cell: [x, y], score, side })
      for (const n of order(grid.neighbors([x, y], walls))) {
        const nk = key(...n)
        if (walls.has(nk)) continue
        if (sides.get(nk) === other) {
          // the two waves touch between `here` (this side) and `nk` (the other side)
          const length = score + 1 + scores.get(nk)
          if (!best || length < best[2]) best = [...(side === 'a' ? [here, nk] : [nk, here]), length]
          continue
        }
        if (sides.has(nk)) continue
        scores.set(nk, score + 1)
        sides.set(nk, side)
        parent[side].set(nk, here)
        visited.push(n)
        next.push(n)
        steps.push({ t: 'assign', cell: n, score: score + 1, from: [x, y], side })
      }
    }
    if (best) return finish(scores, sides, parent, visited, steps, best[0], best[1])
    waves[side] = next
    side = other
  }
  return { visited, path: [], scores, sides, steps }
}

function chain(parentMap, k) {
  const out = [k]
  while (parentMap.has(k)) {
    k = parentMap.get(k)
    out.push(k)
  }
  return out
}

// aKey (reached from Start) and bKey (reached from Finish) are neighbours where the waves met.
function finish(scores, sides, parent, visited, steps, aKey, bKey) {
  const toStart = chain(parent.a, aKey) // aKey … start
  const toGoal = chain(parent.b, bKey) // bKey … goal
  const path = [...toStart.reverse(), ...toGoal].map((k) => k.split(',').map(Number))
  for (const c of [...path].reverse()) {
    const k = `${c[0]},${c[1]}`
    steps.push({ t: 'trace', cell: c, score: scores.get(k), side: sides.get(k) })
  }
  return { visited, path, scores, sides, steps, meet: bKey }
}
