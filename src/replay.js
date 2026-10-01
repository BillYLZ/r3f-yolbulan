import { key } from './grids.js'

/**
 * Splits a recorded run (a method result with `steps` and `scores`) into the phases shown on screen:
 *   1. numbers — every score is written, one wave (0, 1, 2 …) at a time
 *   2. iterate — each iteration replayed: cell being processed, tried branches growing (speed-controlled)
 *   3. trace   — the found path drawn back from Finish to Start
 * Walking the path (phase 4) is handled by the runner.
 * `rate` is in units per second.
 */
export function buildTimeline(result, speed) {
  const iterSteps = result.steps.filter((s) => s.t !== 'trace')
  const traceSteps = result.steps.filter((s) => s.t === 'trace')
  const maxScore = Math.max(...result.scores.values())
  return {
    iterSteps,
    traceSteps,
    maxScore,
    phases: [
      { id: 'numbers', label: 'Sayılar yazılıyor', length: maxScore + 1, rate: 15 },
      { id: 'iterate', label: 'İterasyonlar', length: iterSteps.length, rate: 40 * speed },
      { id: 'trace', label: 'Bulunan yol çiziliyor', length: traceSteps.length, rate: 15 },
    ],
  }
}

/** What to draw at position `i` (1-based count) of phase `p`; p === phases.length means finished. */
export function viewAt(result, tl, p, i) {
  const scores = new Map()
  const fresh = new Set()
  const branches = []
  const traced = []
  let cursor = null
  let last = null

  if (p === 0) {
    for (const [k, s] of result.scores) {
      if (s < i) scores.set(k, s)
      if (s === i - 1) fresh.add(k)
    }
    return { p, i, scores, sides: result.sides, fresh, branches, traced, cursor, last }
  }

  for (const [k, s] of result.scores) scores.set(k, s)
  const iterCount = p === 1 ? i : tl.iterSteps.length
  for (let j = 0; j < iterCount; j++) {
    const st = tl.iterSteps[j]
    const recent = p === 1 && j >= iterCount - 10
    if (st.t === 'assign' && st.from) branches.push([st.from, st.cell, recent, st.side ?? 'a'])
    if (recent && st.t === 'assign') fresh.add(key(...st.cell))
    if (p === 1) {
      cursor = st.cell
      last = st
    }
  }
  const traceCount = p === 2 ? i : p > 2 ? tl.traceSteps.length : 0
  for (let j = 0; j < traceCount; j++) {
    traced.push(tl.traceSteps[j].cell)
    if (p === 2) {
      cursor = tl.traceSteps[j].cell
      last = tl.traceSteps[j]
    }
  }
  return { p, i, scores, sides: result.sides, fresh, branches, traced, cursor, last }
}
