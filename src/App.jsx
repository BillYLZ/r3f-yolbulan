import { useCallback, useEffect, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { astar, key, randomWalls } from './astar.js'
import { SIZE, inBounds, toCell } from './grid.js'
import Robot from './components/Robot.jsx'
import Joystick from './components/Joystick.jsx'
import { Fence, FinishFlag, Floor, Obstacles, StartPad, Trail } from './components/Arena.jsx'

const MODES = [
  ['wall', 'ENGEL'],
  ['start', 'START'],
  ['goal', 'FINISH'],
]
const START = [1, SIZE - 2]
const GOAL = [SIZE - 2, 1]

// Places the camera far enough back that the whole arena fits the screen.
function CameraRig() {
  const { camera, size } = useThree()
  useEffect(() => {
    const v = THREE.MathUtils.degToRad(camera.fov) / 2
    const h = Math.atan(Math.tan(v) * (size.width / size.height))
    const dist = Math.max((SIZE * 0.55) / Math.tan(h), (SIZE * 0.55) / Math.tan(v))
    camera.position.set(0, dist * 0.68, dist * 0.73)
    camera.lookAt(0, 0, 0)
  }, [camera, size])
  return null
}

export default function App() {
  const [robot, setRobot] = useState(START)
  const [snap, setSnap] = useState({ cell: START })
  const [goal, setGoal] = useState(GOAL)
  const [walls, setWalls] = useState(() => randomWalls(SIZE, START, GOAL, 0.25))
  const [modeIdx, setModeIdx] = useState(0)
  const [visited, setVisited] = useState(new Set())
  const [path, setPath] = useState([])
  const [phase, setPhase] = useState('idle') // idle | search | walk
  const [status, setStatus] = useState('START → FINISH')

  const queue = useRef([])
  const dir = useRef(null)
  const timer = useRef(null)
  const paintValue = useRef(true)
  const lastPainted = useRef(null)
  const mode = MODES[modeIdx][0]
  const busy = phase !== 'idle'

  const clearTrail = () => {
    setVisited(new Set())
    setPath([])
  }

  const placeRobot = (cell) => {
    queue.current = []
    setRobot(cell)
    setSnap({ cell })
  }

  const pick = (e) => {
    if (busy || e.nativeEvent.buttons !== 1) return
    const cell = toCell(e.point.x, e.point.z)
    if (!inBounds(cell)) return
    const k = key(...cell)
    if (e.type === 'pointermove' && (mode !== 'wall' || lastPainted.current === k)) return
    lastPainted.current = k
    e.stopPropagation()
    const occupied = k === key(...robot) || k === key(...goal)
    clearTrail()
    if (mode === 'start') {
      if (!walls.has(k) && k !== key(...goal)) placeRobot(cell)
    } else if (mode === 'goal') {
      if (!walls.has(k) && k !== key(...robot)) setGoal(cell)
    } else if (!occupied) {
      if (e.type === 'pointerdown') paintValue.current = !walls.has(k)
      setWalls((prev) => {
        const next = new Set(prev)
        paintValue.current ? next.add(k) : next.delete(k)
        return next
      })
    }
    setStatus('START → FINISH')
  }

  const findPath = () => {
    if (busy) return
    clearTrail()
    queue.current = []
    const result = astar(SIZE, walls, robot, goal)
    setPhase('search')
    setStatus('ARANIYOR…')
    let i = 0
    timer.current = setInterval(() => {
      i += 4
      setVisited(new Set(result.visited.slice(0, i).map((p) => key(...p))))
      if (i < result.visited.length) return
      clearInterval(timer.current)
      if (!result.path.length) {
        setPhase('idle')
        setStatus('YOL YOK!')
        return
      }
      setPath(result.path)
      setStatus(`YOL: ${result.path.length - 1} ADIM`)
      if (result.path.length > 1) {
        queue.current = result.path.slice(1)
        setPhase('walk')
      } else setPhase('idle')
    }, 16)
  }

  const shuffle = () => {
    if (busy) return
    clearTrail()
    setWalls(randomWalls(SIZE, robot, goal, 0.25))
    setStatus('START → FINISH')
  }

  const clearWalls = () => {
    if (busy) return
    clearTrail()
    setWalls(new Set())
  }

  const onStep = useCallback(
    (cell) => {
      setRobot(cell)
      if (queue.current.length === 0 && cell[0] === goal[0] && cell[1] === goal[1]) {
        setPhase('idle')
        setStatus('FINISH! 🏁')
      } else if (queue.current.length === 0) setPhase('idle')
    },
    [goal],
  )

  // Manual driving: joystick / keyboard step the robot one free cell at a time.
  useEffect(() => {
    const id = setInterval(() => {
      if (!dir.current || phase !== 'idle' || queue.current.length) return
      const next = [robot[0] + dir.current[0], robot[1] + dir.current[1]]
      if (!inBounds(next) || walls.has(key(...next))) return
      setVisited(new Set())
      setPath([])
      queue.current.push(next)
    }, 50)
    return () => clearInterval(id)
  }, [robot, walls, phase])

  useEffect(() => {
    const keys = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] }
    const down = (e) => {
      if (keys[e.key]) {
        dir.current = keys[e.key]
        e.preventDefault()
      } else if (e.key === ' ' || e.key === 'Enter') findPath()
    }
    const up = (e) => keys[e.key] && (dir.current = null)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  })

  useEffect(() => () => clearInterval(timer.current), [])

  return (
    <>
      <Canvas shadows camera={{ fov: 45 }} onContextMenu={(e) => e.preventDefault()}>
        <color attach="background" args={['#0b0b10']} />
        <fog attach="fog" args={['#0b0b10', 30, 90]} />
        <CameraRig />
        <ambientLight intensity={0.55} />
        <directionalLight
          position={[6, 14, 8]}
          intensity={1.6}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-9}
          shadow-camera-right={9}
          shadow-camera-top={9}
          shadow-camera-bottom={-9}
        />
        <Floor onPick={pick} />
        <Fence />
        <Trail visited={visited} path={path} />
        <Obstacles walls={walls} />
        <StartPad cell={robot} />
        <FinishFlag cell={goal} />
        <Robot queue={queue} onStep={onStep} snap={snap} />
        <OrbitControls
          enablePan={false}
          mouseButtons={{ RIGHT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY }}
          touches={{ TWO: THREE.TOUCH.DOLLY_ROTATE }}
          maxPolarAngle={Math.PI / 2.3}
          minDistance={6}
          maxDistance={70}
        />
      </Canvas>

      <div className="hud">
        <div className="top">
          <div className="frame">
            <span className="tag">MOD</span>
            <button className="big" onClick={() => setModeIdx((i) => (i + 1) % MODES.length)}>
              {MODES[modeIdx][1]}
            </button>
          </div>
          <div className="frame right">
            <span className="tag orange">HARİTA</span>
            <button className="big orange" onClick={clearWalls}>TEMİZLE</button>
          </div>
        </div>
        <div className="status">{status}</div>
        <div className="bottom">
          <Joystick onDir={(d) => (dir.current = d)} />
          <div className="pad">
            <div className="btn-wrap b">
              <button className="round" onClick={shuffle}>B</button>
              <span>RASTGELE</span>
            </div>
            <div className="btn-wrap a">
              <button className="round" onClick={findPath}>A</button>
              <span>YOLU BUL</span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
