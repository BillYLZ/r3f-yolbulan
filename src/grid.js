export const SIZE = 14
export const OFFSET = (SIZE - 1) / 2
export const toWorld = ([x, y]) => [x - OFFSET, y - OFFSET]
export const toCell = (wx, wz) => [Math.round(wx + OFFSET), Math.round(wz + OFFSET)]
export const inBounds = ([x, y]) => x >= 0 && y >= 0 && x < SIZE && y < SIZE
