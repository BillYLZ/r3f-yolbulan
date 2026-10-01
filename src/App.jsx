import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { astar, key, randomWalls } from './astar.js'

const SIZE = 20
const OFFSET = (SIZE - 1) / 2
const COLORS = {
  floor: '#2a2f3a',
  wall: '#8892a6',
  visited: '#2f6f8f',
  path: '#f2c14e',
  start: '#3ecf8e',
  goal: '#ef5b5b',
}

function Tile({ x, y, state, onPaint }) {
  const isWall = state === 'wall'
  const height = isWall ? 0.8 : state === 'path' ? 0.25 : 0.1
  return (
    <mesh
      position={[x - OFFSET, height / 2, y - OFFSET]}
      onPointerDown={(e) => {
        if (e.button !== 0) return
        e.stopPropagation()
        onPaint(x, y, true)
      }}
      onPointerEnter={(e) => {
        if (e.buttons === 1) onPaint(x, y, false)
      }}
    >
      <boxGeometry args={[0.92, height, 0.92]} />
      <meshStandardMaterial color={COLORS[state]} />
    </mesh>
  )
}

function Runner({ path }) {
  const ref = useRef()
  const t = useRef(0)
  useEffect(() => {
    t.current = 0
  }, [path])
  useFrame((_, dt) => {
    if (!ref.current || path.length < 2) return
    t.current = Math.min(t.current + dt * 6, path.length - 1)
    const i = Math.floor(t.current)
    const a = path[i]
    const b = path[Math.min(i + 1, path.length - 1)]
    const f = t.current - i
    ref.current.position.set(
      THREE.MathUtils.lerp(a[0], b[0], f) - OFFSET,
      0.6,
      THREE.MathUtils.lerp(a[1], b[1], f) - OFFSET,
    )
  })
  if (path.length < 2) return null
  return (
    <mesh ref={ref} position={[path[0][0] - OFFSET, 0.6, path[0][1] - OFFSET]}>
      <sphereGeometry args={[0.3, 24, 24]} />
      <meshStandardMaterial color="#ffffff" emissive="#f2c14e" emissiveIntensity={0.6} />
    </mesh>
  )
}

export default function App() {
  const [start, setStart] = useState([1, 1])
  const [goal, setGoal] = useState([SIZE - 2, SIZE - 2])
  const [walls, setWalls] = useState(() => randomWalls(SIZE, [1, 1], [SIZE - 2, SIZE - 2]))
  const [mode, setMode] = useState('wall')
  const [visited, setVisited] = useState(new Set())
  const [path, setPath] = useState([])
  const [status, setStatus] = useState('Hazır')
  const timer = useRef(null)
  const paintValue = useRef(true)

  const stop = () => clearInterval(timer.current)
  useEffect(() => stop, [])

  const reset = () => {
    stop()
    setVisited(new Set())
    setPath([])
    setStatus('Hazır')
  }

  const paint = (x, y, first) => {
    const k = key(x, y)
    reset()
    if (mode === 'start') {
      if (!walls.has(k) && k !== key(...goal)) setStart([x, y])
      return
    }
    if (mode === 'goal') {
      if (!walls.has(k) && k !== key(...start)) setGoal([x, y])
      return
    }
    if (k === key(...start) || k === key(...goal)) return
    if (first) paintValue.current = !walls.has(k)
    setWalls((prev) => {
      const next = new Set(prev)
      paintValue.current ? next.add(k) : next.delete(k)
      return next
    })
  }

  const run = () => {
    reset()
    const result = astar(SIZE, walls, start, goal)
    let i = 0
    setStatus('Aranıyor…')
    timer.current = setInterval(() => {
      i += 3
      setVisited(new Set(result.visited.slice(0, i).map((p) => key(...p))))
      if (i >= result.visited.length) {
        stop()
        setPath(result.path)
        setStatus(
          result.path.length
            ? `Yol bulundu: ${result.path.length - 1} adım, ${result.visited.length} kare tarandı`
            : 'Yol yok!',
        )
      }
    }, 16)
  }

  const pathSet = useMemo(() => new Set(path.map((p) => key(...p))), [path])

  const stateOf = (x, y) => {
    const k = key(x, y)
    if (k === key(...start)) return 'start'
    if (k === key(...goal)) return 'goal'
    if (walls.has(k)) return 'wall'
    if (pathSet.has(k)) return 'path'
    if (visited.has(k)) return 'visited'
    return 'floor'
  }

  const tiles = []
  for (let x = 0; x < SIZE; x++)
    for (let y = 0; y < SIZE; y++)
      tiles.push(<Tile key={key(x, y)} x={x} y={y} state={stateOf(x, y)} onPaint={paint} />)

  return (
    <>
      <div className="panel">
        <h1>Yol Bulan</h1>
        <div className="modes">
          {[
            ['wall', 'Duvar'],
            ['start', 'Başlangıç'],
            ['goal', 'Hedef'],
          ].map(([m, label]) => (
            <button key={m} className={mode === m ? 'active' : ''} onClick={() => setMode(m)}>
              {label}
            </button>
          ))}
        </div>
        <div className="actions">
          <button className="primary" onClick={run}>Yolu Bul (A*)</button>
          <button onClick={() => { reset(); setWalls(randomWalls(SIZE, start, goal)) }}>Rastgele</button>
          <button onClick={() => { reset(); setWalls(new Set()) }}>Temizle</button>
        </div>
        <p className="status">{status}</p>
        <p className="hint">Sol tık: çiz · Sağ tık sürükle: döndür · Tekerlek: yakınlaştır</p>
      </div>
      <Canvas camera={{ position: [0, 24, 14], fov: 45 }} onContextMenu={(e) => e.preventDefault()}>
        <color attach="background" args={['#14171f']} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 20, 10]} intensity={1.2} />
        {tiles}
        <Runner path={path} />
        <OrbitControls
          mouseButtons={{ RIGHT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY }}
          maxPolarAngle={Math.PI / 2.2}
        />
      </Canvas>
    </>
  )
}
