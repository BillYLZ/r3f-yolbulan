import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { toWorld } from '../grid.js'

const SPEED = 3.2 // cells per second
const WHITE = '#f1f1ee'
const DARK = '#1c1d22'
const ORANGE = '#ef7d3c'

function lerpAngle(a, b, t) {
  const d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI
  return a + d * t
}

function Leg({ side, legRef }) {
  return (
    <group ref={legRef} position={[side * 0.1, 0.38, 0]}>
      <mesh position={[0, -0.1, 0]} castShadow>
        <boxGeometry args={[0.12, 0.18, 0.14]} />
        <meshStandardMaterial color={WHITE} roughness={0.5} />
      </mesh>
      <mesh position={[0, -0.25, 0]} castShadow>
        <boxGeometry args={[0.07, 0.14, 0.07]} />
        <meshStandardMaterial color={DARK} />
      </mesh>
      <mesh position={[0, -0.34, 0.03]} castShadow>
        <boxGeometry args={[0.13, 0.06, 0.22]} />
        <meshStandardMaterial color={ORANGE} />
      </mesh>
    </group>
  )
}

// Walks through the cells in `queue` (a ref'd array of [x, y]), calling onStep on each arrival.
export default function Robot({ queue, onStep, snap }) {
  const group = useRef()
  const body = useRef()
  const legL = useRef()
  const legR = useRef()
  const heading = useRef(0)
  const phase = useRef(0)
  const stride = useRef(0)

  useEffect(() => {
    const [wx, wz] = toWorld(snap.cell)
    group.current.position.set(wx, 0, wz)
  }, [snap])

  useFrame((_, dt) => {
    const g = group.current
    const target = queue.current[0]
    let moving = false
    if (target) {
      const [tx, tz] = toWorld(target)
      const dx = tx - g.position.x
      const dz = tz - g.position.z
      const d = Math.hypot(dx, dz)
      const step = SPEED * dt
      if (d <= step) {
        g.position.set(tx, 0, tz)
        queue.current.shift()
        onStep(target)
      } else {
        g.position.x += (dx / d) * step
        g.position.z += (dz / d) * step
        heading.current = Math.atan2(dx, dz)
      }
      moving = true
    }
    g.rotation.y = lerpAngle(g.rotation.y, heading.current, 1 - Math.exp(-14 * dt))
    stride.current += ((moving ? 1 : 0) - stride.current) * (1 - Math.exp(-10 * dt))
    phase.current += dt * 16 * stride.current
    const s = Math.sin(phase.current) * 0.7 * stride.current
    legL.current.rotation.x = s
    legR.current.rotation.x = -s
    body.current.position.y = Math.abs(Math.cos(phase.current)) * 0.04 * stride.current
    body.current.rotation.z = Math.sin(phase.current) * 0.06 * stride.current
  })

  return (
    <group ref={group} scale={1.3}>
      <group ref={body}>
        <mesh position={[0, 0.5, 0]} castShadow>
          <boxGeometry args={[0.3, 0.24, 0.22]} />
          <meshStandardMaterial color={WHITE} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.5, 0.112]}>
          <boxGeometry args={[0.12, 0.18, 0.01]} />
          <meshStandardMaterial color={DARK} />
        </mesh>
        <mesh position={[0, 0.68, 0]}>
          <cylinderGeometry args={[0.04, 0.05, 0.14, 12]} />
          <meshStandardMaterial color={DARK} />
        </mesh>
        <group position={[0, 0.8, 0.02]}>
          <mesh scale={[1, 0.62, 1.15]} castShadow>
            <sphereGeometry args={[0.2, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2 + 0.25]} />
            <meshStandardMaterial color={WHITE} roughness={0.35} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.03, 0]} scale={[1, 1.15, 1]}>
            <torusGeometry args={[0.198, 0.018, 8, 40]} />
            <meshStandardMaterial color={ORANGE} emissive={ORANGE} emissiveIntensity={0.4} />
          </mesh>
          <mesh position={[0, -0.07, 0.17]}>
            <boxGeometry args={[0.16, 0.05, 0.04]} />
            <meshStandardMaterial color={DARK} emissive="#ffb070" emissiveIntensity={0.15} />
          </mesh>
        </group>
      </group>
      <Leg side={-1} legRef={legL} />
      <Leg side={1} legRef={legR} />
    </group>
  )
}
