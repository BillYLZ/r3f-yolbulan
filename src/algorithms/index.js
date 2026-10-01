import { astar } from './astar.js'
import { yolbulan1995 } from './yolbulan1995.js'

export { key, randomWalls } from './astar.js'

// Path-finding methods offered in the UI. Each run(size, walls, start, goal, options) returns { visited, path }.
// `randomizable` methods accept { random: true } to pick among equally short paths.
export const METHODS = [
  {
    id: 'astar',
    name: 'A*',
    description: 'Manhattan sezgiseliyle en kısa yolu garanti eder.',
    run: astar,
    ready: true,
  },
  {
    id: 'yolbulan1995',
    name: 'yolbulan1995',
    description: 'Start = 0, komşulara 1, 2, 3… puan verir; Finish bulununca durur.',
    run: yolbulan1995,
    ready: true,
    randomizable: true,
  },
]

export const methodById = (id) => METHODS.find((m) => m.id === id) ?? METHODS[0]
