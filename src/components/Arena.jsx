import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Edges, Grid } from '@react-three/drei'
import * as THREE from 'three'
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
      <mesh key={k} position={[wx, 0.25, wz]} castShadow receiveShadow>
        <boxGeometry args={[0.94, 0.5, 0.94]} />
        <meshStandardMaterial color="#17181e" roughness={0.8} />
        <Edges color={ORANGE} threshold={15} />
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

function Ring({ cell, color, pulse }) {
  const ref = useRef()
  useFrame(({ clock }) => {
    if (!pulse) return
    const s = 1 + Math.sin(clock.elapsedTime * 4) * 0.08
    ref.current.scale.set(s, s, 1)
  })
  const [wx, wz] = toWorld(cell)
  return (
    <mesh ref={ref} position={[wx, 0.015, wz]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.36, 0.46, 40]} />
      <meshBasicMaterial color={color} transparent opacity={0.9} />
    </mesh>
  )
}

export function StartPad({ cell }) {
  return <Ring cell={cell} color="#ffffff" />
}

function checkerTexture() {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 40
  const g = c.getContext('2d')
  for (let x = 0; x < 8; x++)
    for (let y = 0; y < 5; y++) {
      g.fillStyle = (x + y) % 2 ? '#111' : '#f4f4f4'
      g.fillRect(x * 8, y * 8, 8, 8)
    }
  const t = new THREE.CanvasTexture(c)
  t.magFilter = THREE.NearestFilter
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function FinishFlag({ cell }) {
  const flag = useRef()
  const tex = useMemo(checkerTexture, [])
  useFrame(({ clock }) => {
    flag.current.rotation.y = Math.sin(clock.elapsedTime * 3) * 0.25
  })
  const [wx, wz] = toWorld(cell)
  return (
    <>
      <Ring cell={cell} color={ORANGE} pulse />
      <group position={[wx, 0, wz]}>
        <mesh position={[0, 0.7, 0]} castShadow>
          <cylinderGeometry args={[0.025, 0.025, 1.4, 8]} />
          <meshStandardMaterial color="#d9d9d9" metalness={0.6} roughness={0.3} />
        </mesh>
        <group ref={flag} position={[0, 1.2, 0]}>
          <mesh position={[0.26, 0, 0]} castShadow>
            <planeGeometry args={[0.5, 0.32]} />
            <meshStandardMaterial map={tex} side={THREE.DoubleSide} />
          </mesh>
        </group>
      </group>
    </>
  )
}
