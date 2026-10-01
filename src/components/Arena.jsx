import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Grid } from '@react-three/drei'
import * as THREE from 'three'
import { buildWallShell } from '../wallMesh.js'

const ORANGE = '#ef7d3c'
const CELL_LINE = '#3b2b24'
const VIOLET = '#a78bfa'
const TERRAIN = { 3: '#b07a45', 5: '#3b82f6' }

// Flat geometries for a cell's outline, cached by shape: tiles, and a frame (ring) for the cursor.
// Shapes are built in the XY plane around the cell centre and laid flat with rotation -90° about X.
const geoCache = new Map()
function cellGeometry(grid, cell, scale, hole = 0) {
  const [cx, cz] = grid.toWorld(cell)
  const rel = grid.polygon(cell).map(([x, z]) => [x - cx, -(z - cz)])
  const k = `${rel.map((p) => p.map((v) => v.toFixed(3)).join(',')).join(';')}|${scale}|${hole}`
  if (!geoCache.has(k)) {
    const shape = new THREE.Shape(rel.map(([x, y]) => new THREE.Vector2(x * scale, y * scale)))
    if (hole) shape.holes.push(new THREE.Path(rel.map(([x, y]) => new THREE.Vector2(x * hole, y * hole))))
    geoCache.set(k, new THREE.ShapeGeometry(shape))
  }
  return geoCache.get(k)
}

const flat = (wx, wz, y) => ({ position: [wx, y, wz], rotation: [-Math.PI / 2, 0, 0] })

// Line segments of every cell edge, each drawn once.
function gridLines(grid) {
  const seen = new Set()
  const pts = []
  for (let x = 0; x < grid.cols; x++)
    for (let y = 0; y < grid.rows; y++) {
      const poly = grid.polygon([x, y])
      poly.forEach((a, i) => {
        const b = poly[(i + 1) % poly.length]
        const k = [a, b].map((p) => p.map((v) => v.toFixed(3)).join(',')).sort().join('|')
        if (seen.has(k)) return
        seen.add(k)
        pts.push(a[0], 0, a[1], b[0], 0, b[1])
      })
    }
  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
}

export function Floor({ grid, onPick }) {
  const triLines = useMemo(() => (grid.id === 'square' ? null : gridLines(grid)), [grid])
  const border = useMemo(() => {
    const [w, d] = [grid.width / 2, grid.depth / 2]
    const pts = [-w, 0, -d, w, 0, -d, w, 0, -d, w, 0, d, w, 0, d, -w, 0, d, -w, 0, d, -w, 0, -d]
    return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
  }, [grid])
  return (
    <>
      {grid.id === 'square' ? (
        <Grid
          infiniteGrid
          cellSize={1}
          cellThickness={0.6}
          cellColor={CELL_LINE}
          sectionSize={7}
          sectionThickness={1.3}
          sectionColor={ORANGE}
          fadeDistance={60}
          fadeStrength={1.6}
          position={[0, 0.002, 0]}
        />
      ) : (
        <>
          <lineSegments geometry={triLines} position={[0, 0.002, 0]}>
            <lineBasicMaterial color="#6b4630" />
          </lineSegments>
          <lineSegments geometry={border} position={[0, 0.003, 0]}>
            <lineBasicMaterial color={ORANGE} />
          </lineSegments>
        </>
      )}
      <mesh rotation={[-Math.PI / 2, 0, 0]} onPointerDown={onPick} onPointerMove={onPick}>
        <planeGeometry args={[grid.width, grid.depth]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </>
  )
}

// Thin glowing posts around the arena edge, one per world unit, taller at the ends and middle.
export function Fence({ grid }) {
  const posts = useMemo(() => {
    const list = []
    const [w, d] = [grid.width / 2, grid.depth / 2]
    const nx = Math.round(grid.width)
    const nz = Math.round(grid.depth)
    const tall = (i, n) => i === 0 || i === n || i * 2 === n
    for (let i = 0; i <= nx; i++) {
      const x = -w + (i * grid.width) / nx
      const h = tall(i, nx) ? 2.4 : 0.8
      list.push([x, -d, h], [x, d, h])
    }
    for (let i = 1; i < nz; i++) {
      const z = -d + (i * grid.depth) / nz
      const h = tall(i, nz) ? 2.4 : 0.8
      list.push([-w, z, h], [w, z, h])
    }
    return list
  }, [grid])
  return posts.map(([x, z, h], i) => (
    <mesh key={i} position={[x, h / 2, z]}>
      <boxGeometry args={[0.025, h, 0.025]} />
      <meshBasicMaterial color={ORANGE} transparent opacity={h > 1 ? 0.55 : 0.25} />
    </mesh>
  ))
}

// All walls as one merged shell, so touching walls read as a single block.
export function Obstacles({ grid, walls }) {
  const { faceGeo, edgeGeo } = useMemo(() => {
    const { faces, edges } = buildWallShell(walls, grid)
    const faceGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(faces, 3))
    const edgeGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(edges, 3))
    return { faceGeo, edgeGeo }
  }, [walls, grid])
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

// Every tried step drawn as a thin bar between cell centres, so all attempted routes from Start grow like a tree.
// Bars on the final path turn orange and thick.
function Branches({ grid, branches, path }) {
  const onPath = new Set()
  for (let i = 1; i < path.length; i++) onPath.add(`${path[i - 1]}|${path[i]}`).add(`${path[i]}|${path[i - 1]}`)
  return branches.map(([a, b, isFresh, side]) => {
    const [ax, az] = grid.toWorld(a)
    const [bx, bz] = grid.toWorld(b)
    const win = onPath.has(`${a}|${b}`)
    const len = Math.hypot(bx - ax, bz - az)
    const angle = Math.atan2(-(bz - az), bx - ax)
    return (
      <mesh
        key={`${a}|${b}`}
        position={[(ax + bx) / 2, win ? 0.017 : 0.014, (az + bz) / 2]}
        rotation={[-Math.PI / 2, 0, angle]}
      >
        <planeGeometry args={[len, win ? 0.16 : 0.06]} />
        <meshBasicMaterial color={win ? ORANGE : side === 'b' ? '#c084fc' : '#38bdf8'} transparent opacity={win ? 1 : isFresh ? 0.95 : 0.45} depthWrite={false} />
      </mesh>
    )
  })
}

// Bright frame on the cell the algorithm is working on right now.
function Cursor({ grid, cell }) {
  const [wx, wz] = grid.toWorld(cell)
  return (
    <mesh {...flat(wx, wz, 0.03)} geometry={cellGeometry(grid, cell, 0.98, 0.8)}>
      <meshBasicMaterial color="#38bdf8" />
    </mesh>
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

// Mud (3) and water (5) cells, tinted on the floor under everything else.
export function Terrain({ grid, terrain }) {
  return [...terrain].map(([k, cost]) => {
    const cell = k.split(',').map(Number)
    const [wx, wz] = grid.toWorld(cell)
    return (
      <mesh key={k} {...flat(wx, wz, 0.005)} geometry={cellGeometry(grid, cell, 0.97)}>
        <meshBasicMaterial color={TERRAIN[cost]} transparent opacity={0.42} depthWrite={false} />
      </mesh>
    )
  })
}

// Visited cells, the found path and — for methods that score cells — each cell's score.
export function Trail({ grid, visited, path, scores, sides, fresh, cursor, branches }) {
  const onPath = new Set(path.map((c) => c.join(',')))
  const label = 0.62 * grid.cellSize
  return (
    <>
      {[...visited].map((k) => {
        const cell = k.split(',').map(Number)
        const [wx, wz] = grid.toWorld(cell)
        const score = scores?.get(k)
        const hot = scores && onPath.has(k)
        const isFresh = fresh?.has(k)
        const tint = sides?.get(k) === 'b' && !hot ? VIOLET : ORANGE
        return (
          <group key={k}>
            <mesh {...flat(wx, wz, 0.01)} geometry={cellGeometry(grid, cell, 0.9)}>
              <meshBasicMaterial color={tint} transparent opacity={hot ? 0.55 : isFresh ? 0.35 : 0.13} depthWrite={false} />
            </mesh>
            {score !== undefined && (
              <mesh {...flat(wx, wz, 0.02)}>
                <planeGeometry args={[label, label]} />
                <meshBasicMaterial map={numberTexture(score)} transparent opacity={hot || isFresh ? 1 : 0.7} depthWrite={false} />
              </mesh>
            )}
          </group>
        )
      })}
      {branches && <Branches grid={grid} branches={branches} path={path} />}
      {cursor && <Cursor grid={grid} cell={cursor} />}
      {!scores &&
        path.map((c, i) => {
          const [wx, wz] = grid.toWorld(c)
          return (
            <mesh key={i} {...flat(wx, wz, 0.02)}>
              <circleGeometry args={[0.13 * grid.cellSize, 20]} />
              <meshBasicMaterial color={ORANGE} />
            </mesh>
          )
        })}
    </>
  )
}

// Thin, tall colored pillar marking the start or finish cell, on a flat disc so the cell reads clearly.
// Lambert + emissive and no shadows: renders on every mobile GPU.
export function Marker({ grid, cell, color, pulse }) {
  const ref = useRef()
  useFrame(({ clock }) => {
    if (pulse) ref.current.material.emissiveIntensity = 0.5 + Math.sin(clock.elapsedTime * 4) * 0.25
  })
  const [wx, wz] = grid.toWorld(cell)
  return (
    <group position={[wx, 0, wz]}>
      <mesh ref={ref} position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.13, 0.13, 1.8, 24]} />
        <meshLambertMaterial color={color} emissive={color} emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.4 * grid.cellSize, 40]} />
        <meshBasicMaterial color={color} transparent opacity={0.35} depthWrite={false} />
      </mesh>
    </group>
  )
}
