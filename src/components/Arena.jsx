import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Edges, Grid } from '@react-three/drei'
import { SIZE, toWorld } from '../grid.js'

const ORANGE = '#ef7d3c'
const HALF = SIZE / 2

export function Floor({ onPick }) {
  return (
    <>
      <Grid
        infiniteGrid
        cellSize={1}
        cellThickness={0.6}
        cellColor="#3b2b24"
        sectionSize={7}
        sectionThickness={1.3}
        sectionColor={ORANGE}
        fadeDistance={60}
        fadeStrength={1.6}
        position={[0, 0.002, 0]}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow onPointerDown={onPick} onPointerMove={onPick}>
        <planeGeometry args={[SIZE, SIZE]} />
        <shadowMaterial opacity={0.45} />
      </mesh>
    </>
  )
}

// Thin glowing posts around the arena edge, taller every 7 cells.
export function Fence() {
  const posts = useMemo(() => {
    const list = []
    for (let i = -HALF; i <= HALF; i++) {
      const h = i % 7 === 0 ? 2.4 : 0.8
      list.push([i, -HALF, h], [i, HALF, h])
      if (Math.abs(i) !== HALF) list.push([-HALF, i, h], [HALF, i, h])
    }
    return list
  }, [])
  return posts.map(([x, z, h], i) => (
    <mesh key={i} position={[x, h / 2, z]}>
      <boxGeometry args={[0.025, h, 0.025]} />
      <meshBasicMaterial color={ORANGE} transparent opacity={h > 1 ? 0.55 : 0.25} />
    </mesh>
  ))
}

export function Obstacles({ walls }) {
  return [...walls].map((k) => {
    const [wx, wz] = toWorld(k.split(',').map(Number))
    return (
      <mesh key={k} position={[wx, 0.25, wz]}>
        <boxGeometry args={[0.94, 0.5, 0.94]} />
        <meshBasicMaterial color={ORANGE} transparent opacity={0.1} depthWrite={false} />
        <Edges color={ORANGE} threshold={15} transparent opacity={0.6} />
      </mesh>
    )
  })
}

export function Trail({ visited, path }) {
  return (
    <>
      {[...visited].map((k) => {
        const [wx, wz] = toWorld(k.split(',').map(Number))
        return (
          <mesh key={k} position={[wx, 0.01, wz]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.9, 0.9]} />
            <meshBasicMaterial color={ORANGE} transparent opacity={0.13} />
          </mesh>
        )
      })}
      {path.map((c, i) => {
        const [wx, wz] = toWorld(c)
        return (
          <mesh key={i} position={[wx, 0.02, wz]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.13, 20]} />
            <meshBasicMaterial color={ORANGE} />
          </mesh>
        )
      })}
    </>
  )
}

// Solid colored cylinder marking the start or finish cell.
export function Marker({ cell, color, pulse }) {
  const ref = useRef()
  useFrame(({ clock }) => {
    if (pulse) ref.current.material.emissiveIntensity = 0.45 + Math.sin(clock.elapsedTime * 4) * 0.25
  })
  const [wx, wz] = toWorld(cell)
  return (
    <mesh ref={ref} position={[wx, 0.4, wz]} castShadow receiveShadow>
      <cylinderGeometry args={[0.36, 0.36, 0.8, 40]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.45} roughness={0.45} />
    </mesh>
  )
}
