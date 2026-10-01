import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { BarChart3, ChevronUp, LayoutGrid, Box, BrickWall, Footprints, Hexagon, MoveDiagonal, Square, Triangle, Waves, X, Dices, FastForward, Cpu, Crosshair, Eraser, Flag, Grid3x3, Hand, MapPin, Play, Rotate3d, Route, Shuffle } from 'lucide-react'
import { METHODS, key, methodById, pathCost, randomTerrain, randomWalls, supports } from './algorithms/index.js'
import { ARENAS, GRIDS, makeGrids } from './grids.js'
import Runner from './components/Runner.jsx'
import { buildTimeline, viewAt } from './replay.js'
import CameraRig from './components/CameraRig.jsx'
import { Fence, Floor, Marker, Obstacles, Terrain, Trail } from './components/Arena.jsx'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Toggle } from '@/components/ui/toggle'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const START_COLOR = '#2fd27f'
const GOAL_COLOR = '#e8434f'
const MUD_COLOR = '#b07a45'
const WATER_COLOR = '#3b82f6'

const formatCost = (c) => (Number.isInteger(c) ? String(c) : c.toFixed(1))

// Every method that works on this floor, run on the same map. Best values are highlighted.
function ComparePanel({ rows, current, onPick, onClose }) {
  const found = rows.filter((r) => r.found)
  const best = {
    steps: Math.min(...found.map((r) => r.steps)),
    cost: Math.min(...found.map((r) => r.cost)),
    scanned: Math.min(...rows.map((r) => r.scanned)),
  }
  const hi = (on) => (on ? 'text-primary font-semibold' : '')
  return (
    <div className="pointer-events-auto absolute inset-x-0 top-14 z-10 mx-auto w-[min(calc(100%-2rem),480px)] rounded-lg border bg-card p-3 text-xs shadow-lg backdrop-blur md:top-16 md:left-88">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium">Aynı haritada bütün yöntemler</span>
        <Button size="icon" variant="ghost" className="size-7" onClick={onClose} aria-label="Kapat">
          <X />
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full tabular-nums">
          <thead className="text-muted-foreground">
            <tr className="text-left">
              <th className="py-1 pr-2 font-normal">Yöntem</th>
              <th className="px-2 text-right font-normal">Adım</th>
              <th className="px-2 text-right font-normal">Maliyet</th>
              <th className="px-2 text-right font-normal">Taranan</th>
              <th className="hidden pl-2 text-right font-normal sm:table-cell">ms</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                onClick={() => onPick(r.id)}
                className={`cursor-pointer border-t hover:bg-accent/50 ${r.id === current ? 'bg-accent/30' : ''}`}
              >
                <td className="py-1.5 pr-2 whitespace-nowrap">
                  {r.name}
                  {r.found && r.cost === best.cost && <span className="ml-1 text-primary">★</span>}
                </td>
                {r.found ? (
                  <>
                    <td className={`px-2 text-right ${hi(r.steps === best.steps)}`}>{r.steps}</td>
                    <td className={`px-2 text-right ${hi(r.cost === best.cost)}`}>{formatCost(r.cost)}</td>
                  </>
                ) : (
                  <td colSpan={2} className="px-2 text-right text-destructive">bulamadı</td>
                )}
                <td className={`px-2 text-right ${hi(r.scanned === best.scanned)}`}>{r.scanned}</td>
                <td className="hidden pl-2 text-right text-muted-foreground sm:table-cell">{r.ms < 1 ? '<1' : Math.round(r.ms)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">★ en ucuz yol · turuncu: o sütunun en iyisi · bir satıra dokunarak o yöntemi seç</p>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="flex flex-col items-center rounded-md bg-muted/50 px-2 py-1.5">
      <span className="text-base font-semibold tabular-nums">{value}</span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  )
}

function describe(step) {
  if (!step) return ''
  const [x, y] = step.cell
  if (step.t === 'expand') return `(${x},${y}) = ${step.score} → boş komşulara ${step.score + 1} yazılıyor`
  if (step.t === 'assign') return `(${x},${y}) kareye ${step.score} yazıldı`
  return `Geri izleme: (${x},${y}) = ${step.score}`
}

const PHASE_LABELS = ['Sayılar', 'İterasyonlar', 'Yol', 'Git']

// Live view of the phased replay: which phase, what is happening now, progress, skip to the next phase.
function IterationPanel({ view, tl, walking, summary, onSkip, raised }) {
  const p = walking || summary ? 3 : view.p
  const phase = tl.phases[view.p]
  let title, detail, progress
  if (summary && !walking) {
    title = 'Bitti'
    detail = summary
    progress = 1
  } else if (p === 3) {
    title = 'Bulunan yol gidiliyor'
    detail = summary
    progress = 1
  } else if (p === 0) {
    title = `${phase.label} · puan ${Math.max(view.i - 1, 0)} / ${tl.maxScore}`
    detail = `${view.fresh.size} kareye ${Math.max(view.i - 1, 0)} yazıldı`
    progress = view.i / phase.length
  } else {
    title = p === 1 ? `İterasyon ${view.i} / ${phase.length}` : `${phase.label} · ${view.i} / ${phase.length}`
    detail = describe(view.last)
    progress = view.i / phase.length
  }
  return (
    <div className={`pointer-events-auto absolute inset-x-0 ${raised ? 'bottom-16' : 'bottom-2'} mx-auto w-[min(calc(100%-2rem),380px)] rounded-lg border bg-card px-3 py-2 text-xs shadow-sm backdrop-blur md:bottom-4 md:left-88`}>
      <div className="mb-2 grid grid-cols-4 gap-1">
        {PHASE_LABELS.map((label, j) => (
          <div key={label} className="flex flex-col gap-1">
            <div className={`h-1 rounded-full ${j < p || (j === p && progress >= 1) ? 'bg-primary' : j === p ? 'bg-primary/40' : 'bg-muted'}`} />
            <span className={`text-[10px] ${j === p ? 'text-foreground' : 'text-muted-foreground'}`}>
              {j + 1}. {label}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium tabular-nums">{title}</span>
        {onSkip && (
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={onSkip}>
            <FastForward /> Atla
          </Button>
        )}
      </div>
      <div className="mt-1 line-clamp-2 min-h-[1.5em] font-mono text-[11px] text-muted-foreground">{detail}</div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary" style={{ width: `${Math.min(progress, 1) * 100}%` }} />
      </div>
    </div>
  )
}

export default function App() {
  const [start, setStart] = useState(GRIDS.square.start)
  const [snap, setSnap] = useState({ cell: GRIDS.square.start })
  const [goal, setGoal] = useState(GRIDS.square.goal)
  const [density, setDensity] = useState(25)
  const [speed, setSpeed] = useState(4)
  const [walls, setWalls] = useState(() => randomWalls(GRIDS.square, GRIDS.square.start, GRIDS.square.goal, 0.25))
  const [terrainDensity, setTerrainDensity] = useState(10)
  const [terrain, setTerrain] = useState(() => randomTerrain(GRIDS.square, walls, GRIDS.square.start, GRIDS.square.goal, 0.1))
  const [gridId, setGridId] = useState('square')
  const [compare, setCompare] = useState(null)
  const [panelOpen, setPanelOpen] = useState(true) // phone: the bottom panel slides away while a search plays
  const swipe = useRef(null)
  const [mode, setMode] = useState('wall')
  const [visited, setVisited] = useState(new Set())
  const [path, setPath] = useState([])
  const [play, setPlay] = useState(null) // step-by-step replay for methods that record steps
  const [phase, setPhase] = useState('idle') // idle | search | walk | done | blocked
  const [stats, setStats] = useState(null)
  const [view, setView] = useState('persp')
  const [method, setMethod] = useState('astar')
  const [randomPath, setRandomPath] = useState(true)
  const [arena, setArena] = useState('4') // number of big squares
  const grids = useMemo(() => makeGrids(...ARENAS[arena]), [arena])
  const grid = grids[gridId]
  const [resetKey, setResetKey] = useState(0)
  const [gestures, setGestures] = useState(false)
  const runnerRef = useRef()

  const queue = useRef([])
  const timer = useRef(null)
  const paintValue = useRef(true)
  const lastPainted = useRef(null)
  const busy = phase === 'search' || phase === 'walk'

  const clearTrail = () => {
    setVisited(new Set())
    setPath([])
    setPlay(null)
    setStats(null)
    setPhase('idle')
  }

  const placeRunner = (cell) => {
    queue.current = []
    setSnap({ cell })
  }

  const PAINT = { wall: true, mud: 3, water: 5 }
  const pick = (e) => {
    if (busy || gestures || e.nativeEvent.buttons !== 1) return
    const cell = grid.toCell(e.point.x, e.point.z)
    if (!cell) return
    const k = key(...cell)
    if (e.type === 'pointermove' && (!(mode in PAINT) || lastPainted.current === k)) return
    lastPainted.current = k
    e.stopPropagation()
    clearTrail()
    const isEnd = k === key(...start) || k === key(...goal)
    if (mode === 'start') {
      if (!walls.has(k) && k !== key(...goal)) {
        setStart(cell)
        placeRunner(cell)
      }
    } else if (mode === 'goal') {
      if (!walls.has(k) && k !== key(...start)) setGoal(cell)
    } else if (mode === 'wall' && !isEnd) {
      // first touch decides: add walls if this cell was free, otherwise erase while dragging
      if (e.type === 'pointerdown') paintValue.current = !walls.has(k)
      setWalls((prev) => {
        const next = new Set(prev)
        paintValue.current ? next.add(k) : next.delete(k)
        return next
      })
      if (paintValue.current) setTerrain((prev) => (prev.has(k) ? new Map([...prev].filter(([c]) => c !== k)) : prev))
    } else if (mode === 'mud' || mode === 'water') {
      const cost = PAINT[mode]
      if (e.type === 'pointerdown') paintValue.current = terrain.get(k) !== cost
      setTerrain((prev) => {
        const next = new Map(prev)
        paintValue.current ? next.set(k, cost) : next.delete(k)
        return next
      })
      if (paintValue.current) setWalls((prev) => (prev.has(k) ? new Set([...prev].filter((c) => c !== k)) : prev))
    }
  }

  const finishSearch = (result) => {
    clearInterval(timer.current)
    setStats({
      steps: result.path.length ? result.path.length - 1 : null,
      cost: result.path.length ? pathCost(grid, result.path, terrain) : null,
      scanned: new Set(result.visited.map((c) => key(...c))).size,
    })
    if (!result.path.length) return setPhase('blocked')
    setPath(result.path)
    queue.current = result.path.slice(1)
    setPhase(queue.current.length ? 'walk' : 'done')
  }
  const pending = useRef(null)
  const clock = useRef({ p: 0, t0: 0 })

  const findPath = () => {
    if (busy) return
    clearTrail()
    placeRunner(start)
    // On a phone, slide the panel down so the whole screen shows the scene.
    if (window.matchMedia('(max-width: 767px)').matches) setPanelOpen(false)
    const result = methodById(method).run(grid, walls, start, goal, { random: randomPath, costs: terrain })
    pending.current = result
    setPhase('search')

    // Methods that record their iterations are replayed in phases: numbers, iterations, path; then the cube walks.
    if (result.steps) {
      const tl = buildTimeline(result, speed)
      clock.current = { p: 0, t0: performance.now() }
      setPlay({ tl, p: 0, i: 0 })
      timer.current = setInterval(() => {
        const c = clock.current
        while (c.p < tl.phases.length && tl.phases[c.p].length === 0) c.p += 1
        if (c.p >= tl.phases.length) {
          setPlay({ tl, p: tl.phases.length, i: 0 })
          return finishSearch(result)
        }
        const ph = tl.phases[c.p]
        const elapsed = Math.max(performance.now() - c.t0, 0)
        const i = Math.min(Math.floor((elapsed / 1000) * ph.rate) + 1, ph.length)
        setPlay({ tl, p: c.p, i })
        if (i >= ph.length) {
          c.p += 1
          c.t0 = performance.now() + 250 // short pause between phases
        }
      }, 30)
      return
    }

    // Other methods: reveal the scanned cells in about two seconds at most.
    const perTick = Math.max(4, Math.ceil(result.visited.length / 120))
    let i = 0
    timer.current = setInterval(() => {
      i = Math.min(i + perTick, result.visited.length)
      setVisited(new Set(result.visited.slice(0, i).map((p) => key(...p))))
      if (i >= result.visited.length) finishSearch(result)
    }, 16)
  }

  // Skip to the next phase of the replay.
  const skipPhase = () => {
    if (phase !== 'search' || !play) return
    clock.current.p += 1
    clock.current.t0 = performance.now()
  }

  const frame = useMemo(() => (play ? viewAt(pending.current, play.tl, play.p, play.i) : null), [play])
  const summary = useMemo(() => {
    const r = pending.current
    if (!play || play.p < play.tl.phases.length || !r) return null
    if (!r.path.length) return `${r.scores.size} kare puanlandı · Finish puan alamadı, yol yok`
    if (r.sides) return `${r.scores.size} kare puanlandı · dalgalar buluştu · yol ${r.path.length - 1} adım`
    const count = r.pathCount > 1 ? ` · ${r.pathCount.toLocaleString('tr-TR')} farklı en kısa yol var` : ''
    return `${r.scores.size} kare puanlandı · yol ${r.path.length - 1} adım${count}`
  }, [play])

  const changeMethod = (id) => {
    clearTrail()
    setMethod(id)
  }

  // A new floor or arena size rebuilds the arena: start, finish, walls and terrain for that grid.
  const rebuild = (next) => {
    clearTrail()
    setCompare(null)
    const w = randomWalls(next, next.start, next.goal, density / 100)
    setStart(next.start)
    setGoal(next.goal)
    setWalls(w)
    setTerrain(randomTerrain(next, w, next.start, next.goal, terrainDensity / 100))
    placeRunner(next.start)
  }

  const changeGrid = (id) => {
    if (!id || busy) return
    setGridId(id)
    rebuild(grids[id])
    if (!supports(methodById(method), id)) setMethod('astar')
  }

  const changeArena = (n) => {
    if (!n || busy) return
    setArena(n)
    rebuild(makeGrids(...ARENAS[n])[gridId])
  }

  const shuffle = () => {
    if (busy) return
    clearTrail()
    setCompare(null)
    const w = randomWalls(grid, start, goal, density / 100)
    setWalls(w)
    setTerrain(randomTerrain(grid, w, start, goal, terrainDensity / 100))
  }

  const clearWalls = () => {
    if (busy) return
    clearTrail()
    setCompare(null)
    setWalls(new Set())
    setTerrain(new Map())
  }

  // Runs every method that works on this floor on the current map and lists the results side by side.
  const runCompare = () => {
    if (busy) return
    const rows = METHODS.filter((m) => supports(m, grid.id)).map((m) => {
      const t0 = performance.now()
      const r = m.run(grid, walls, start, goal, { costs: terrain })
      const ms = performance.now() - t0
      const found = r.path.length > 0
      return {
        id: m.id,
        name: m.name,
        found,
        steps: found ? r.path.length - 1 : null,
        cost: found ? pathCost(grid, r.path, terrain) : null,
        scanned: new Set(r.visited.map((c) => key(...c))).size,
        ms,
      }
    })
    setCompare(rows)
  }

  const onStep = useCallback(() => {
    if (queue.current.length === 0) setPhase('done')
  }, [])

  useEffect(() => {
    const down = (e) => (e.key === ' ' || e.key === 'Enter') && e.target === document.body && findPath()
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  })

  useEffect(() => () => clearInterval(timer.current), [])

  const fogScale = Math.max(grid.width, grid.depth) / 14

  const status = {
    idle: { text: 'Hazır', variant: 'secondary' },
    search: { text: 'Aranıyor…', variant: 'outline' },
    walk: { text: 'Yol izleniyor', variant: 'default' },
    done: { text: 'Finish! 🏁', variant: 'default' },
    blocked: { text: 'Yol yok', variant: 'destructive' },
  }[phase]

  return (
    <div className="relative flex h-full flex-col md:block">
      <div className="relative min-h-0 flex-1 md:absolute md:inset-0">
        <Canvas camera={{ fov: 45 }} onContextMenu={(e) => e.preventDefault()} style={{ touchAction: 'none' }}>
          <color attach="background" args={['#0b0b10']} />
          <fog attach="fog" args={['#0b0b10', 30 * fogScale, 90 * fogScale]} />
          <CameraRig grid={grid} view={view} resetKey={resetKey} gestures={gestures} followRef={runnerRef} />
          <ambientLight intensity={0.55} />
          <directionalLight position={[6, 14, 8]} intensity={1.6} />
          <Floor grid={grid} onPick={pick} />
          <Fence grid={grid} />
          <Terrain grid={grid} terrain={terrain} />
          <Trail
            grid={grid}
            visited={frame ? new Set(frame.scores.keys()) : visited}
            path={frame ? frame.traced : path}
            scores={frame?.scores}
            sides={frame?.sides}
            fresh={frame?.fresh}
            cursor={frame?.cursor}
            branches={frame?.branches}
          />
          <Obstacles grid={grid} walls={walls} />
          <Marker grid={grid} cell={start} color={START_COLOR} />
          <Marker grid={grid} cell={goal} color={GOAL_COLOR} pulse />
          <Runner grid={grid} queue={queue} onStep={onStep} snap={snap} speed={speed} groupRef={runnerRef} />
        </Canvas>
        <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center md:top-4 md:left-88">
          <Badge variant={status.variant} className="px-3 py-1 text-sm">{status.text}</Badge>
        </div>
        {frame && (
          <IterationPanel
            view={frame}
            tl={play.tl}
            walking={phase === 'walk'}
            summary={summary}
            onSkip={phase === 'search' ? skipPhase : null}
            raised={!panelOpen}
          />
        )}
        {!panelOpen && (
          <Button
            variant="secondary"
            className="absolute bottom-3 left-1/2 h-10 -translate-x-1/2 rounded-full px-5 shadow-lg backdrop-blur md:hidden"
            onClick={() => setPanelOpen(true)}
            onPointerDown={(e) => (swipe.current = e.clientY)}
            onPointerUp={(e) => swipe.current !== null && swipe.current - e.clientY > 20 && setPanelOpen(true)}
            aria-label="Paneli aç"
          >
            <ChevronUp /> Panel
          </Button>
        )}
        {compare && (
          <ComparePanel
            rows={compare}
            current={method}
            onPick={(id) => {
              changeMethod(id)
              setCompare(null)
            }}
            onClose={() => setCompare(null)}
          />
        )}
        <div className="absolute top-3 right-3 flex flex-col items-end gap-2 md:top-4 md:right-4">
          <Button
            size="icon"
            variant={gestures ? 'default' : 'outline'}
            onClick={() => setGestures((g) => !g)}
            aria-pressed={gestures}
            aria-label="Parmakla kamera kontrolü"
            className="size-11 rounded-full backdrop-blur"
          >
            <Hand className="size-5" />
          </Button>
          {gestures && (
            <span className="rounded-md bg-card px-2 py-1 text-right text-[11px] leading-tight text-muted-foreground backdrop-blur">
              1 parmak: döndür<br />2 parmak: yakınlaştır · kaydır
            </span>
          )}
        </div>
      </div>

      <Card
        className={`gap-4 overflow-y-auto rounded-none rounded-t-xl border-x-0 border-b-0 backdrop-blur transition-[max-height,padding] duration-300 ease-out md:absolute md:top-4 md:left-4 md:max-h-[calc(100%-2rem)] md:w-80 md:gap-4 md:rounded-xl md:border md:py-5 ${
          panelOpen ? 'max-h-[56%] pt-2 pb-4' : 'max-h-0 border-t-0 py-0'
        }`}
      >
        <button
          type="button"
          className="-mb-2 flex w-full shrink-0 touch-none justify-center py-1 md:hidden"
          onClick={() => setPanelOpen(false)}
          onPointerDown={(e) => (swipe.current = e.clientY)}
          onPointerUp={(e) => swipe.current !== null && e.clientY - swipe.current > 20 && setPanelOpen(false)}
          aria-label="Paneli kapat"
        >
          <span className="h-1.5 w-10 rounded-full bg-muted-foreground/40" />
        </button>
        <CardHeader className="hidden md:grid">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Route className="size-5 text-primary" /> Yol Bulan
          </CardTitle>
          <CardDescription>Başlangıçtan bitişe yolu seçtiğin yöntem bulur.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 px-4 md:px-6">
          <div className="flex flex-col gap-2">
            <span className="hidden text-xs font-medium text-muted-foreground md:block">Arenaya dokununca</span>
            <ToggleGroup type="single" variant="outline" size="sm" value={mode} onValueChange={(v) => v && setMode(v)} className="w-full md:[&_svg]:hidden">
              <ToggleGroupItem value="wall" aria-label="Engel" className="gap-1 text-xs">
                <BrickWall /> Engel
              </ToggleGroupItem>
              <ToggleGroupItem value="mud" aria-label="Çamur" className="gap-1 text-xs">
                <Footprints style={{ color: MUD_COLOR }} /> Çamur
              </ToggleGroupItem>
              <ToggleGroupItem value="water" aria-label="Su" className="gap-1 text-xs">
                <Waves style={{ color: WATER_COLOR }} /> Su
              </ToggleGroupItem>
              <ToggleGroupItem value="start" aria-label="Start" className="gap-1 text-xs">
                <MapPin style={{ color: START_COLOR }} /> Start
              </ToggleGroupItem>
              <ToggleGroupItem value="goal" aria-label="Finish" className="gap-1 text-xs">
                <Flag style={{ color: GOAL_COLOR }} /> Finish
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="flex flex-col gap-2">
            <span className="hidden text-xs font-medium text-muted-foreground md:block">Zemin</span>
            <ToggleGroup type="single" variant="outline" size="sm" value={gridId} onValueChange={changeGrid} disabled={busy} className="w-full">
              <ToggleGroupItem value="square" aria-label="Kare zemin" className="gap-1 text-xs">
                <Square /> Kare
              </ToggleGroupItem>
              <ToggleGroupItem value="diag" aria-label="Çapraz zemin" className="gap-1 text-xs">
                <MoveDiagonal /> Çapraz
              </ToggleGroupItem>
              <ToggleGroupItem value="tri" aria-label="Üçgen zemin" className="gap-1 text-xs">
                <Triangle /> Üçgen
              </ToggleGroupItem>
              <ToggleGroupItem value="hex" aria-label="Altıgen zemin" className="gap-1 text-xs">
                <Hexagon /> Altıgen
              </ToggleGroupItem>
            </ToggleGroup>
            <div className="flex items-center gap-2">
              <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground" title="Büyük kare sayısı (her biri 7 × 7)">
                <LayoutGrid className="size-4" /> Saha
              </span>
              <ToggleGroup type="single" variant="outline" size="sm" value={arena} onValueChange={changeArena} disabled={busy} className="w-full">
                {Object.entries(ARENAS).map(([n, [bx, by]]) => (
                  <ToggleGroupItem key={n} value={n} aria-label={`${n} büyük kare (${bx} × ${by})`} title={`${bx} × ${by} büyük kare`} className="text-xs tabular-nums">
                    {n}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="hidden text-xs font-medium text-muted-foreground md:block">Yol bulma yöntemi</span>
            <Select value={method} onValueChange={changeMethod} disabled={busy}>
              <SelectTrigger className="w-full *:data-[slot=select-value]:flex-1" aria-label="Yol bulma yöntemi">
                <Cpu className="text-primary" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METHODS.map((m) => (
                  <SelectItem
                    key={m.id}
                    value={m.id}
                    disabled={!supports(m, gridId)}
                    hint={supports(m, gridId) ? m.description : `Sadece ${m.grids.map((g) => GRIDS[g].label).join(', ')} zeminde`}
                  >
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {methodById(method).randomizable && (
              <Toggle
                variant="outline"
                size="sm"
                pressed={randomPath}
                onPressedChange={setRandomPath}
                disabled={busy}
                aria-label="Rastgele yol"
                title="Aynı uzunlukta birden çok yol varsa her seferinde farklısını seçer"
                className="w-full justify-start text-xs text-muted-foreground data-[state=on]:border-primary/60 data-[state=on]:bg-transparent data-[state=on]:text-foreground"
              >
                <Dices className={randomPath ? 'text-primary' : ''} />
                Rastgele yol: {randomPath ? 'açık' : 'kapalı'}
                <span className="ml-auto text-muted-foreground md:hidden">eşit yollardan birini seçer</span>
              </Toggle>
            )}
          </div>

          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 md:grid-cols-2">
            <Button size="lg" onClick={findPath} disabled={busy} className="md:col-span-2">
              <Play /> Yolu Bul
            </Button>
            <Button size="lg" variant="secondary" onClick={shuffle} disabled={busy} aria-label="Rastgele">
              <Shuffle /> <span className="hidden md:inline">Rastgele</span>
            </Button>
            <Button size="lg" variant="outline" onClick={clearWalls} disabled={busy} aria-label="Temizle">
              <Eraser /> <span className="hidden md:inline">Temizle</span>
            </Button>
            <Button size="lg" variant="outline" onClick={runCompare} disabled={busy} aria-label="Yöntemleri karşılaştır" className="md:col-span-2">
              <BarChart3 /> <span className="hidden md:inline">Yöntemleri karşılaştır</span>
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            <span className="hidden text-xs font-medium text-muted-foreground md:block">Kamera</span>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={view}
              onValueChange={(v) => {
                if (v) setView(v)
                setResetKey((k) => k + 1)
              }}
              className="w-full"
            >
              <ToggleGroupItem value="persp" aria-label="Perspektif">
                <Box /> <span className="hidden md:inline">Persp.</span>
              </ToggleGroupItem>
              <ToggleGroupItem value="top" aria-label="Üstten">
                <Grid3x3 /> <span className="hidden md:inline">Üstten</span>
              </ToggleGroupItem>
              <ToggleGroupItem value="iso" aria-label="İzometrik">
                <Rotate3d /> <span className="hidden md:inline">İzo</span>
              </ToggleGroupItem>
              <ToggleGroupItem value="follow" aria-label="Takip">
                <Crosshair /> <span className="hidden md:inline">Takip</span>
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <Separator className="hidden md:block" />

          <div className="grid grid-cols-3 gap-x-4 gap-y-3">
            <label className="flex flex-col gap-2 text-xs text-muted-foreground">
              <span className="flex justify-between">Engel <span className="text-foreground tabular-nums">%{density}</span></span>
              <Slider min={5} max={45} step={5} value={[density]} onValueChange={([v]) => setDensity(v)} aria-label="Engel yoğunluğu" />
            </label>
            <label className="flex flex-col gap-2 text-xs text-muted-foreground">
              <span className="flex justify-between">Arazi <span className="text-foreground tabular-nums">%{terrainDensity}</span></span>
              <Slider min={0} max={40} step={5} value={[terrainDensity]} onValueChange={([v]) => setTerrainDensity(v)} aria-label="Çamur ve su yoğunluğu" />
            </label>
            <label className="flex flex-col gap-2 text-xs text-muted-foreground">
              <span className="flex justify-between">Hız <span className="text-foreground tabular-nums">{speed}×</span></span>
              <Slider min={1} max={10} step={1} value={[speed]} onValueChange={([v]) => setSpeed(v)} aria-label="Hız" />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Stat label="adım" value={stats?.steps ?? '–'} />
            <Stat label="maliyet" value={stats?.cost != null ? formatCost(stats.cost) : '–'} />
            <Stat label="taranan" value={stats?.scanned ?? '–'} />
          </div>

          <p className="hidden text-xs text-muted-foreground md:block">
            Maliyet: her adım 1 (çapraz √2); çamura girmek 3, suya 5 katı. ✋ açıkken sol tık döndürür, sağ tık kaydırır; kapalıyken sağ tık döndürür. Tekerlek: yakınlaştır · Boşluk: yolu bul
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
