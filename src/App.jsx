import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Box, BrickWall, Dices, FastForward, Cpu, Crosshair, Eraser, Flag, Grid3x3, Hand, MapPin, Play, Rotate3d, Route, Shuffle } from 'lucide-react'
import { METHODS, key, methodById, randomWalls } from './algorithms/index.js'
import { GRIDS } from './grids.js'
import Runner from './components/Runner.jsx'
import { buildTimeline, viewAt } from './replay.js'
import CameraRig from './components/CameraRig.jsx'
import { Fence, Floor, Marker, Obstacles, Trail } from './components/Arena.jsx'
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
function IterationPanel({ view, tl, walking, summary, onSkip }) {
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
    <div className="pointer-events-auto absolute inset-x-0 bottom-2 mx-auto w-[min(calc(100%-2rem),380px)] rounded-lg border bg-card px-3 py-2 text-xs shadow-sm backdrop-blur md:bottom-4 md:left-88">
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
  const [mode, setMode] = useState('wall')
  const [visited, setVisited] = useState(new Set())
  const [path, setPath] = useState([])
  const [play, setPlay] = useState(null) // step-by-step replay for methods that record steps
  const [phase, setPhase] = useState('idle') // idle | search | walk | done | blocked
  const [stats, setStats] = useState(null)
  const [view, setView] = useState('persp')
  const [method, setMethod] = useState('astar')
  const [randomPath, setRandomPath] = useState(true)
  const grid = GRIDS[methodById(method).grid]
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

  const pick = (e) => {
    if (busy || gestures || e.nativeEvent.buttons !== 1) return
    const cell = grid.toCell(e.point.x, e.point.z)
    if (!cell) return
    const k = key(...cell)
    if (e.type === 'pointermove' && (mode !== 'wall' || lastPainted.current === k)) return
    lastPainted.current = k
    e.stopPropagation()
    clearTrail()
    if (mode === 'start') {
      if (!walls.has(k) && k !== key(...goal)) {
        setStart(cell)
        placeRunner(cell)
      }
    } else if (mode === 'goal') {
      if (!walls.has(k) && k !== key(...start)) setGoal(cell)
    } else if (k !== key(...start) && k !== key(...goal)) {
      if (e.type === 'pointerdown') paintValue.current = !walls.has(k)
      setWalls((prev) => {
        const next = new Set(prev)
        paintValue.current ? next.add(k) : next.delete(k)
        return next
      })
    }
  }

  const finishSearch = (result) => {
    clearInterval(timer.current)
    setStats({ steps: result.path.length ? result.path.length - 1 : null, scanned: result.visited.length })
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
    const result = methodById(method).run(grid, walls, start, goal, { random: randomPath })
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

    let i = 0
    timer.current = setInterval(() => {
      i = Math.min(i + 4, result.visited.length)
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
    const count = r.pathCount > 1 ? ` · ${r.pathCount.toLocaleString('tr-TR')} farklı en kısa yol var` : ''
    return `${r.scores.size} kare puanlandı · yol ${r.path.length - 1} adım${count}`
  }, [play])

  // Switching to a method on another floor (squares ↔ triangles) rebuilds the arena for that grid.
  const changeMethod = (id) => {
    clearTrail()
    const next = GRIDS[methodById(id).grid]
    if (next !== grid) {
      setStart(next.start)
      setGoal(next.goal)
      setWalls(randomWalls(next, next.start, next.goal, density / 100))
      placeRunner(next.start)
    }
    setMethod(id)
  }

  const shuffle = () => {
    if (busy) return
    clearTrail()
    setWalls(randomWalls(grid, start, goal, density / 100))
  }

  const clearWalls = () => {
    if (busy) return
    clearTrail()
    setWalls(new Set())
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
          <fog attach="fog" args={['#0b0b10', 30, 90]} />
          <CameraRig view={view} resetKey={resetKey} gestures={gestures} followRef={runnerRef} />
          <ambientLight intensity={0.55} />
          <directionalLight position={[6, 14, 8]} intensity={1.6} />
          <Floor grid={grid} onPick={pick} />
          <Fence grid={grid} />
          <Trail
            grid={grid}
            visited={frame ? new Set(frame.scores.keys()) : visited}
            path={frame ? frame.traced : path}
            scores={frame?.scores}
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

      <Card className="gap-4 rounded-none rounded-t-xl border-x-0 border-b-0 py-4 backdrop-blur md:absolute md:top-4 md:left-4 md:w-80 md:gap-5 md:rounded-xl md:border md:py-6">
        <CardHeader className="hidden md:grid">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Route className="size-5 text-primary" /> Yol Bulan
          </CardTitle>
          <CardDescription>Başlangıçtan bitişe yolu seçtiğin yöntem bulur.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 px-4 md:px-6">
          <div className="flex flex-col gap-2">
            <span className="hidden text-xs font-medium text-muted-foreground md:block">Arenaya dokununca</span>
            <ToggleGroup type="single" variant="outline" value={mode} onValueChange={(v) => v && setMode(v)} className="w-full">
              <ToggleGroupItem value="wall" aria-label="Engel">
                <BrickWall /> Engel
              </ToggleGroupItem>
              <ToggleGroupItem value="start" aria-label="Start">
                <MapPin style={{ color: START_COLOR }} /> Start
              </ToggleGroupItem>
              <ToggleGroupItem value="goal" aria-label="Finish">
                <Flag style={{ color: GOAL_COLOR }} /> Finish
              </ToggleGroupItem>
            </ToggleGroup>
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
                  <SelectItem key={m.id} value={m.id} disabled={!m.ready} hint={m.description}>
                    {m.name}
                    {!m.ready && ' · yakında'}
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

          <div className="grid grid-cols-[1fr_auto_auto] gap-2 md:grid-cols-2">
            <Button size="lg" onClick={findPath} disabled={busy} className="md:col-span-2">
              <Play /> Yolu Bul
            </Button>
            <Button size="lg" variant="secondary" onClick={shuffle} disabled={busy} aria-label="Rastgele">
              <Shuffle /> <span className="hidden md:inline">Rastgele</span>
            </Button>
            <Button size="lg" variant="outline" onClick={clearWalls} disabled={busy} aria-label="Temizle">
              <Eraser /> <span className="hidden md:inline">Temizle</span>
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

          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <label className="flex flex-col gap-2 text-xs text-muted-foreground">
              <span className="flex justify-between">Engel yoğunluğu <span className="text-foreground tabular-nums">%{density}</span></span>
              <Slider min={5} max={45} step={5} value={[density]} onValueChange={([v]) => setDensity(v)} />
            </label>
            <label className="flex flex-col gap-2 text-xs text-muted-foreground">
              <span className="flex justify-between">Hız <span className="text-foreground tabular-nums">{speed}×</span></span>
              <Slider min={1} max={10} step={1} value={[speed]} onValueChange={([v]) => setSpeed(v)} />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Stat label="adım" value={stats?.steps ?? '–'} />
            <Stat label="taranan" value={stats?.scanned ?? '–'} />
            <Stat label="engel" value={walls.size} />
          </div>

          <p className="hidden text-xs text-muted-foreground md:block">
            ✋ açıkken sol tık döndürür, sağ tık kaydırır. Kapalıyken sağ tık döndürür. Tekerlek: yakınlaştır · Boşluk: yolu bul
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
