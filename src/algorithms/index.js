import { astar, dijkstra, greedy } from './astar.js'
import { yolbulan1995 } from './yolbulan1995.js'
import { bidirectional } from './bidirectional.js'
import { dfs } from './dfs.js'
import { jps } from './jps.js'
import { randomWalk, wallFollower } from './walkers.js'
import { potentialField, rrt, rrtStar, thetaStar, visibilityGraph } from './anyangle.js'

export { key, randomTerrain, randomWalls } from './astar.js'
export { pathCost } from './cost.js'

/**
 * Path-finding methods offered in the UI. Each run(grid, walls, start, goal, options) returns { visited, path };
 * methods that record `steps` are replayed in phases (numbers → iterations → path).
 *   grids:      floors the method works on (null = all)
 *   shortest:   'steps' = fewest moves, 'cost' = cheapest with terrain and diagonals, false = no guarantee
 *   terrain:    takes mud / water costs into account
 *   randomizable: accepts { random: true } for a different result among equals each run
 *   alwaysFinds: finds a path whenever one exists
 *   anyAngle:   moves in any direction, not cell to cell; returns `points` (world [x, z]) and `cost`
 */
export const METHODS = [
  {
    id: 'astar',
    name: 'A*',
    description: 'Hedefe yönelerek en ucuz yolu bulur; çamur ve suyu hesaba katar.',
    run: astar,
    shortest: 'cost',
    terrain: true,
    alwaysFinds: true,
  },
  {
    id: 'dijkstra',
    name: 'Dijkstra',
    description: 'Her yöne eşit yayılarak en ucuz yolu bulur; çamur 3, su 5 puan.',
    run: dijkstra,
    shortest: 'cost',
    terrain: true,
    alwaysFinds: true,
  },
  {
    id: 'yolbulan1995',
    name: 'yolbulan1995',
    description: 'Start = 0, komşulara 1, 2, 3… puan verir; Finish bulununca durur.',
    run: yolbulan1995,
    shortest: 'steps',
    randomizable: true,
    alwaysFinds: true,
  },
  {
    id: 'bidirectional',
    name: 'Çift yönlü dalga',
    description: "Start'tan ve Finish'ten iki dalga yayılır, ortada buluşur.",
    run: bidirectional,
    shortest: 'steps',
    randomizable: true,
    alwaysFinds: true,
  },
  {
    id: 'jps',
    name: 'Jump Point Search',
    description: 'Çapraz zeminde A*: düz ve çapraz çizgiler boyunca atlayarak arar.',
    run: jps,
    grids: ['diag'],
    shortest: 'steps-diag',
    alwaysFinds: true,
  },
  {
    id: 'theta',
    name: 'Theta*',
    description: 'Her açıya giden A*: engelsiz gördüğü noktaya doğrudan düz çizgiyle gider.',
    run: thetaStar,
    shortest: false,
    alwaysFinds: true,
    anyAngle: true,
  },
  {
    id: 'visibility',
    name: 'Görünürlük grafiği',
    description: 'Engel köşelerini birbirini gören çizgilerle bağlar, en kısasını seçer (1979).',
    run: visibilityGraph,
    shortest: false,
    alwaysFinds: false,
    anyAngle: true,
  },
  {
    id: 'potential',
    name: 'Potansiyel alan',
    description: 'Finish çeker, engeller iter; küp kuvvetle kayar. Çukura takılabilir.',
    run: potentialField,
    shortest: false,
    randomizable: true,
    alwaysFinds: false,
    anyAngle: true,
  },
  {
    id: 'rrt',
    name: 'RRT',
    description: "Start'tan rastgele yönlere dallar uzatan ağaç; Finish'e değince durur.",
    run: rrt,
    shortest: false,
    alwaysFinds: false,
    anyAngle: true,
  },
  {
    id: 'rrtstar',
    name: 'RRT*',
    description: 'RRT, ama büyümeye devam edip dalları yeniden bağlar; yol kısalır.',
    run: rrtStar,
    shortest: false,
    alwaysFinds: false,
    anyAngle: true,
  },
  {
    id: 'greedy',
    name: 'Açgözlü',
    description: 'Hep hedefe en yakın görünen kareye gider; hızlı ama yol uzayabilir.',
    run: greedy,
    shortest: false,
    alwaysFinds: true,
  },
  {
    id: 'dfs',
    name: 'Derinlik öncelikli (DFS)',
    description: 'Bir yöne gidebildiği kadar gider, çıkmazda geri döner.',
    run: dfs,
    shortest: false,
    randomizable: true,
    alwaysFinds: true,
  },
  {
    id: 'wall',
    name: 'Sağ el kuralı (robot)',
    description: 'Hedefe yürür; engele çarpınca sağ elini duvardan ayırmadan dolaşır.',
    run: wallFollower,
    shortest: false,
    alwaysFinds: false,
  },
  {
    id: 'random',
    name: 'Rastgele yürüyüş',
    description: 'Her adımda rastgele bir komşuya gider; döngüleri silinmiş yolu yürür.',
    run: randomWalk,
    shortest: false,
    alwaysFinds: false,
  },
]

export const methodById = (id) => METHODS.find((m) => m.id === id) ?? METHODS[0]
export const supports = (m, gridId) => !m.grids || m.grids.includes(gridId)
