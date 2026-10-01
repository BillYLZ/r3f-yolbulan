import { key } from './astar.js'

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]]

/**
 * yolbulan1995 — her kareye puan verilir:
 *   Start = 0, 0'ın boş komşularına 1, 1'lerin boş komşularına 2, ...
 *   Engellere puan verilmez. Finish puan alınca yayılma durur.
 * Yol: Finish'ten başlayıp her adımda puanı bir eksik olan komşuya gidilerek Start'a dönülür.
 *
 * Returns { visited, path, scores } — scores: Map "x,y" → puan (ekranda karelerin üstünde gösterilir).
 */
export function yolbulan1995(size, walls, start, goal) {
  const goalKey = key(...goal)
  const scores = new Map([[key(...start), 0]])
  const visited = [start]
  let wave = [start]

  while (wave.length && !scores.has(goalKey)) {
    const next = []
    for (const [x, y] of wave) {
      const score = scores.get(key(x, y))
      for (const [dx, dy] of DIRS) {
        const nx = x + dx
        const ny = y + dy
        const nk = key(nx, ny)
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue
        if (walls.has(nk) || scores.has(nk)) continue
        scores.set(nk, score + 1)
        visited.push([nx, ny])
        next.push([nx, ny])
        if (nk === goalKey) break
      }
      if (scores.has(goalKey)) break
    }
    wave = next
  }

  if (!scores.has(goalKey)) return { visited, path: [], scores }

  // Walk back from Finish, always stepping to the neighbour whose score is one lower.
  const path = [goal]
  let [x, y] = goal
  let score = scores.get(goalKey)
  while (score > 0) {
    const prev = DIRS.map(([dx, dy]) => [x + dx, y + dy]).find(([px, py]) => scores.get(key(px, py)) === score - 1)
    ;[x, y] = prev
    score -= 1
    path.unshift(prev)
  }
  return { visited, path, scores }
}
