import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Edges } from '@react-three/drei'
import * as THREE from 'three'
import { toWorld } from '../grid.js'

const S = 0.6 // cube size
const BASE = 0
const UP = new THREE.Vector3(0, 1, 0)
const axis = new THREE.Vector3()

// A cube that tumbles through the cells in `queue` (a ref'd array of [x, y]), calling onStep on each arrival.
export default function Runner({ queue, onStep, snap, speed = 3.5, groupRef }) {
  const localGroup = useRef()
  const group = groupRef || localGroup
  const cube = useRef()
  const from = useRef(new THREE.Vector3())

  useEffect(() => {
    const [wx, wz] = toWorld(snap.cell)
    group.current.position.set(wx, 0, wz)
    from.current.set(wx, 0, wz)
  }, [snap])

  useFrame((_, dt) => {
    const g = group.current
    const c = cube.current
    const target = queue.current[0]
    if (!target) {
      c.position.y = BASE + S / 2
      c.quaternion.identity()
      return
    }
    const [tx, tz] = toWorld(target)
    const dx = tx - g.position.x
    const dz = tz - g.position.z
    const d = Math.hypot(dx, dz)
    const step = speed * dt
    if (d <= step) {
      g.position.set(tx, 0, tz)
      from.current.set(tx, 0, tz)
      queue.current.shift()
      onStep(target)
      return
    }
    g.position.x += (dx / d) * step
    g.position.z += (dz / d) * step
    // Hop and roll a quarter turn per cell; the cube is symmetric, so resetting on arrival is seamless.
    const total = from.current.distanceTo(new THREE.Vector3(tx, 0, tz)) || 1
    const f = 1 - Math.min(d / total, 1)
    c.position.y = BASE + S / 2 + Math.sin(Math.PI * f) * 0.35
    axis.set(dx, 0, dz).normalize().cross(UP).negate()
    c.quaternion.setFromAxisAngle(axis, (Math.PI / 2) * f)
  })

  return (
    <group ref={group}>
      <mesh ref={cube} renderOrder={2}>
        <boxGeometry args={[S, S, S]} />
        <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={0.5} transparent opacity={0.45} depthWrite={false} />
        <Edges color="#bae6fd" />
      </mesh>
    </group>
  )
}
