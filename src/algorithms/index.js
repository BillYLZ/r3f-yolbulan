import { astar } from './astar.js'
import { yolbulan1995 } from './yolbulan1995.js'

export { key, randomWalls } from './astar.js'

// Path-finding methods offered in the UI. Each run(size, walls, start, goal) returns { visited, path }.
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
    description: 'Kendi yöntemimiz — kuralları tanımlanınca açılacak.',
    run: yolbulan1995,
    ready: false,
  },
]

export const methodById = (id) => METHODS.find((m) => m.id === id) ?? METHODS[0]
