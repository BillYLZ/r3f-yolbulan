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
 * yolbulan1995 — her kareye (ya da üçgene) puan verilir:
 *   Start = 0, 0'ın boş komşularına 1, 1'lerin boş komşularına 2, ...
 *   Engellere puan verilmez. Finish puan alınca yayılma durur.
 * Yol: Finish'ten başlayıp her adımda puanı bir eksik olan komşuya gidilerek Start'a dönülür.
 *
 * options.random: aynı uzunlukta birden çok yol varsa her seferinde farklısını bulmak için
 *   kareleri ve komşuları karışık sırayla dener, geri izlemede uygun komşulardan rastgele birini seçer.
 * options.rng: rastgele sayı üreteci (testler için), varsayılan Math.random
 *
 * Returns { visited, path, scores, steps, pathCount }
 *   scores:    Map "x,y" → puan (ekranda karelerin üstünde gösterilir)
 *   pathCount: Start'tan Finish'e kaç farklı en kısa yol var
 *   steps:     her iterasyon, sırasıyla — ekranda adım adım oynatılır:
 *     { t: 'expand', cell, score }        bu kare işleniyor, boş komşularına score + 1 yazılacak
 *     { t: 'assign', cell, score, from }  bu kareye score yazıldı; from = puanı veren komşu (denenen dal)
 *     { t: 'trace',  cell, score }        geri izleme: Finish'ten Start'a yol kuruluyor
 */
export function yolbulan1995(grid, walls, start, goal, { random = false, rng = Math.random } = {}) {
  const goalKey = key(...goal)
  const scores = new Map([[key(...start), 0]])
  const visited = [start]
  const steps = [{ t: 'assign', cell: start, score: 0 }]
  const order = (list) => (random ? shuffled(list, rng) : list)
  let wave = [start]

  while (wave.length && !scores.has(goalKey)) {
    const next = []
    for (const [x, y] of order(wave)) {
      const score = scores.get(key(x, y))
      steps.push({ t: 'expand', cell: [x, y], score })
      for (const [nx, ny] of order(grid.neighbors([x, y], walls))) {
        const nk = key(nx, ny)
        if (walls.has(nk) || scores.has(nk)) continue
        scores.set(nk, score + 1)
        steps.push({ t: 'assign', cell: [nx, ny], score: score + 1, from: [x, y] })
        visited.push([nx, ny])
        next.push([nx, ny])
        if (nk === goalKey) break
      }
      if (scores.has(goalKey)) break
    }
    wave = next
  }

  if (!scores.has(goalKey)) return { visited, path: [], scores, steps, pathCount: 0 }

  // Number of distinct shortest paths: each cell's count is the sum of its neighbours one score lower.
  const ways = new Map([[key(...start), 1]])
  const byScore = [...scores.entries()].sort((a, b) => a[1] - b[1])
  for (const [k, s] of byScore) {
    if (s === 0) continue
    const [x, y] = k.split(',').map(Number)
    let w = 0
    for (const [nx, ny] of grid.neighbors([x, y], walls)) if (scores.get(key(nx, ny)) === s - 1) w += ways.get(key(nx, ny)) ?? 0
    ways.set(k, w)
  }

  // Walk back from Finish, always stepping to a neighbour whose score is one lower.
  const path = [goal]
  let [x, y] = goal
  let score = scores.get(goalKey)
  steps.push({ t: 'trace', cell: goal, score })
  while (score > 0) {
    const options = grid.neighbors([x, y], walls).filter(([px, py]) => scores.get(key(px, py)) === score - 1)
    const prev = random ? options[Math.floor(rng() * options.length)] : options[0]
    ;[x, y] = prev
    score -= 1
    path.unshift(prev)
    steps.push({ t: 'trace', cell: prev, score })
  }
  return { visited, path, scores, steps, pathCount: ways.get(goalKey) }
}
