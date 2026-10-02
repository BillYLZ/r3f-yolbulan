import { ARENAS, key, makeGrids } from './grids.js'

/**
 * Map links: the arena as text after the "#" of the page address, e.g.
 *   #kare:S0100L0110L0002L000F
 * One character per cell: 0 free, 1 wall, 2 water, 3 mud, S start, F finish. "L" starts the next row
 * (rows from the far side to the near side, as seen from above). The floor name in front is optional (kare).
 */
export const FLOOR_NAMES = { square: 'kare', diag: 'capraz', tri: 'ucgen', hex: 'altigen' }
const FLOOR_IDS = Object.fromEntries(Object.entries(FLOOR_NAMES).map(([id, name]) => [name, id]))
const COST_CHAR = { 5: '2', 3: '3' }
const CHAR_COST = { 2: 5, 3: 3 }

export function encodeMap(gridId, grid, walls, terrain, start, goal) {
  const rows = []
  for (let y = 0; y < grid.rows; y++) {
    let row = ''
    for (let x = 0; x < grid.cols; x++) {
      const k = key(x, y)
      if (x === start[0] && y === start[1]) row += 'S'
      else if (x === goal[0] && y === goal[1]) row += 'F'
      else if (walls.has(k)) row += '1'
      else row += COST_CHAR[terrain.get(k)] ?? '0'
    }
    // trailing free cells can be left out — except on the first row, whose length (with the number of rows)
    // tells the arena size
    rows.push(y === 0 ? row : row.replace(/0+$/, ''))
  }
  return `${FLOOR_NAMES[gridId]}:${rows.join('L')}`
}

/**
 * Reads a map code. Picks the smallest arena whose floor holds every row and column of the code; cells the code
 * does not mention are free. Returns null when the text is not a map code.
 */
export function decodeMap(text) {
  const raw = decodeURIComponent(text.replace(/^#/, '')).trim()
  if (!raw) return null
  const m = raw.match(/^(?:([a-zçğıöşü]+):)?([0-3SFsfL]+)$/i)
  if (!m) return null
  const gridId = FLOOR_IDS[(m[1] ?? 'kare').toLowerCase().replace('ç', 'c').replace('ğ', 'g').replace('ı', 'i')]
  if (!gridId) return null
  const rows = m[2].toUpperCase().split('L')
  const width = Math.max(...rows.map((r) => r.length))
  const height = rows.length

  const entries = Object.entries(ARENAS).sort((a, b) => Number(a[0]) - Number(b[0]))
  let arena = entries.at(-1)[0]
  for (const [n, [bx, by]] of entries) {
    const g = makeGrids(bx, by)[gridId]
    if (g.cols >= width && g.rows >= height) {
      arena = n
      break
    }
  }
  const grid = makeGrids(...ARENAS[arena])[gridId]
  const walls = new Set()
  const terrain = new Map()
  let start = grid.start
  let goal = grid.goal
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (!grid.inBounds([x, y])) return
      if (ch === '1') walls.add(key(x, y))
      else if (CHAR_COST[ch]) terrain.set(key(x, y), CHAR_COST[ch])
      else if (ch === 'S') start = [x, y]
      else if (ch === 'F') goal = [x, y]
    }),
  )
  // Start and Finish always stand on free ground
  for (const c of [start, goal]) {
    walls.delete(key(...c))
    terrain.delete(key(...c))
  }
  return { gridId, arena, grid, walls, terrain, start, goal }
}
