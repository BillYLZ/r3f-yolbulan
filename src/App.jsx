import { useCallback, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Box, BrickWall, Cpu, Crosshair, Eraser, Flag, Grid3x3, Hand, MapPin, Play, Rotate3d, Route, Shuffle } from 'lucide-react'
import { METHODS, key, methodById, randomWalls } from './algorithms/index.js'
import { SIZE, inBounds, toCell } from './grid.js'
import Runner from './components/Runner.jsx'
import CameraRig from './components/CameraRig.jsx'
import { Fence, Floor, Marker, Obstacles, Trail } from './components/Arena.jsx'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const START = [1, SIZE - 2]
const GOAL = [SIZE - 2, 1]
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

export default function App() {
  const [start, setStart] = useState(START)
  const [snap, setSnap] = useState({ cell: START })
  const [goal, setGoal] = useState(GOAL)
  const [density, setDensity] = useState(25)
  const [speed, setSpeed] = useState(4)
  const [walls, setWalls] = useState(() => randomWalls(SIZE, START, GOAL, 0.25))
  const [mode, setMode] = useState('wall')
  const [visited, setVisited] = useState(new Set())
  const [path, setPath] = useState([])
  const [scores, setScores] = useState(null)
  const [phase, setPhase] = useState('idle') // idle | search | walk | done | blocked
  const [stats, setStats] = useState(null)
  const [view, setView] = useState('persp')
  const [method, setMethod] = useState('astar')
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
    setScores(null)
    setStats(null)
    setPhase('idle')
  }

  const placeRunner = (cell) => {
    queue.current = []
    setSnap({ cell })
  }

  const pick = (e) => {
    if (busy || gestures || e.nativeEvent.buttons !== 1) return
    const cell = toCell(e.point.x, e.point.z)
    if (!inBounds(cell)) return
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

  const findPath = () => {
    if (busy) return
    clearTrail()
    placeRunner(start)
    const result = methodById(method).run(SIZE, walls, start, goal)
    setScores(result.scores ?? null)
    setPhase('search')
    // Animation frames: how many visited cells to show per tick. Scoring methods reveal one score wave per tick.
    const frames = []
    if (result.scores) {
      result.visited.forEach((c, j) => {
        const next = result.visited[j + 1]
        if (!next || result.scores.get(key(...next)) !== result.scores.get(key(...c))) frames.push(j + 1)
      })
    } else {
      for (let j = 4; j < result.visited.length + 4; j += 4) frames.push(Math.min(j, result.visited.length))
    }
    let f = 0
    timer.current = setInterval(
      () => {
        setVisited(new Set(result.visited.slice(0, frames[f]).map((p) => key(...p))))
        f += 1
        if (f < frames.length) return
        clearInterval(timer.current)
        setStats({ steps: result.path.length ? result.path.length - 1 : null, scanned: result.visited.length })
        if (!result.path.length) return setPhase('blocked')
        setPath(result.path)
        queue.current = result.path.slice(1)
        setPhase(queue.current.length ? 'walk' : 'done')
      },
      result.scores ? 140 : 16,
    )
  }

  const shuffle = () => {
    if (busy) return
    clearTrail()
    setWalls(randomWalls(SIZE, start, goal, density / 100))
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
          <Floor onPick={pick} />
          <Fence />
          <Trail visited={visited} path={path} scores={scores} />
          <Obstacles walls={walls} />
          <Marker cell={start} color={START_COLOR} />
          <Marker cell={goal} color={GOAL_COLOR} pulse />
          <Runner queue={queue} onStep={onStep} snap={snap} speed={speed} groupRef={runnerRef} />
        </Canvas>
        <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center md:top-4 md:left-88">
          <Badge variant={status.variant} className="px-3 py-1 text-sm">{status.text}</Badge>
        </div>
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
            <Select value={method} onValueChange={(v) => { clearTrail(); setMethod(v) }} disabled={busy}>
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
