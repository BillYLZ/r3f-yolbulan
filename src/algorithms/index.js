import { astar } from './astar.js'
import { yolbulan1995 } from './yolbulan1995.js'

export { key, randomWalls } from './astar.js'

// Path-finding methods offered in the UI. Each run(grid, walls, start, goal, options) returns { visited, path }.
// `grid` picks the floor the method works on; `randomizable` methods accept { random: true }
// to pick among equally short paths.
export const METHODS = [
  {
    id: 'astar',
    name: 'A*',
    description: 'Manhattan sezgiseliyle en kısa yolu garanti eder.',
    grid: 'square',
    run: astar,
    ready: true,
  },
  {
    id: 'yolbulan1995',
    name: 'yolbulan1995',
    description: 'Start = 0, komşulara 1, 2, 3… puan verir; Finish bulununca durur.',
    grid: 'square',
    run: yolbulan1995,
    ready: true,
    randomizable: true,
  },
  {
    id: 'ucgen',
    name: 'üçgen',
    description: 'yolbulan1995 puanlaması, üçgen zeminde: her üçgenin 3 komşusu var.',
    grid: 'tri',
    run: yolbulan1995,
    ready: true,
    randomizable: true,
  },
]

export const methodById = (id) => METHODS.find((m) => m.id === id) ?? METHODS[0]
