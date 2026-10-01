import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Grid } from '@react-three/drei'
import * as THREE from 'three'
import { SIZE, toWorld } from '../grid.js'
import { buildWallShell } from '../wallMesh.js'

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
      <mesh rotation={[-Math.PI / 2, 0, 0]} onPointerDown={onPick} onPointerMove={onPick}>
        <planeGeometry args={[SIZE, SIZE]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
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

// All walls as one merged shell, so touching walls read as a single block.
export function Obstacles({ walls }) {
  const { faceGeo, edgeGeo } = useMemo(() => {
    const { faces, edges } = buildWallShell(walls)
    const faceGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(faces, 3))
    const edgeGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(edges, 3))
    return { faceGeo, edgeGeo }
  }, [walls])
  useEffect(
    () => () => {
      faceGeo.dispose()
      edgeGeo.dispose()
    },
    [faceGeo, edgeGeo],
  )
  return (
    <group>
      <mesh geometry={faceGeo}>
        <meshBasicMaterial color={ORANGE} transparent opacity={0.1} depthWrite={false} />
      </mesh>
      <lineSegments geometry={edgeGeo}>
        <lineBasicMaterial color={ORANGE} transparent opacity={0.6} />
      </lineSegments>
    </group>
  )
}

// One cached canvas texture per score number.
const numberTextures = new Map()
function numberTexture(n) {
  if (!numberTextures.has(n)) {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')
    g.fillStyle = '#ffffff'
    g.font = `700 ${n > 99 ? 54 : 70}px ui-sans-serif, system-ui, sans-serif`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(String(n), 64, 68)
    const t = new THREE.CanvasTexture(c)
    t.anisotropy = 4
    numberTextures.set(n, t)
  }
  return numberTextures.get(n)
}

function flat(wx, wz, y) {
  return { position: [wx, y, wz], rotation: [-Math.PI / 2, 0, 0] }
}

// Visited cells, the found path and — for methods that score cells — each cell's score.
export function Trail({ visited, path, scores }) {
  const onPath = new Set(path.map((c) => c.join(',')))
  return (
    <>
      {[...visited].map((k) => {
        const [wx, wz] = toWorld(k.split(',').map(Number))
        const score = scores?.get(k)
        const hot = scores && onPath.has(k)
        return (
          <group key={k}>
            <mesh {...flat(wx, wz, 0.01)}>
              <planeGeometry args={[0.9, 0.9]} />
              <meshBasicMaterial color={ORANGE} transparent opacity={hot ? 0.55 : 0.13} depthWrite={false} />
            </mesh>
            {score !== undefined && (
              <mesh {...flat(wx, wz, 0.02)}>
                <planeGeometry args={[0.62, 0.62]} />
                <meshBasicMaterial map={numberTexture(score)} transparent opacity={hot ? 1 : 0.7} depthWrite={false} />
              </mesh>
            )}
          </group>
        )
      })}
      {!scores &&
        path.map((c, i) => {
          const [wx, wz] = toWorld(c)
          return (
            <mesh key={i} {...flat(wx, wz, 0.02)}>
              <circleGeometry args={[0.13, 20]} />
              <meshBasicMaterial color={ORANGE} />
            </mesh>
          )
        })}
    </>
  )
}

// Thin, tall colored pillar marking the start or finish cell, on a flat disc so the cell reads clearly.
// Lambert + emissive and no shadows: renders on every mobile GPU.
export function Marker({ cell, color, pulse }) {
  const ref = useRef()
  useFrame(({ clock }) => {
    if (pulse) ref.current.material.emissiveIntensity = 0.5 + Math.sin(clock.elapsedTime * 4) * 0.25
  })
  const [wx, wz] = toWorld(cell)
  return (
    <group position={[wx, 0, wz]}>
      <mesh ref={ref} position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.13, 0.13, 1.8, 24]} />
        <meshLambertMaterial color={color} emissive={color} emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.4, 40]} />
        <meshBasicMaterial color={color} transparent opacity={0.35} depthWrite={false} />
      </mesh>
    </group>
  )
}
