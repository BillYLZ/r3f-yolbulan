import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Grid, Line } from '@react-three/drei'
import * as THREE from 'three'
import { buildWallShell } from '../wallMesh.js'

const ORANGE = '#ef7d3c'
const CELL_LINE = '#3b2b24'
const VIOLET = '#a78bfa'
const WALL_FILL = '#c2612a'
const BACKGROUND = '#0b0b10'
const WAYPOINT = '#c084fc'
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
          fadeDistance={60 * Math.max(grid.width, grid.depth) / 14}
          fadeStrength={1.6}
          position={[-grid.width / 2, 0.002, -grid.depth / 2]}
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
  // Two passes so only the surface nearest the camera shows: first the shell is painted solid in the background
  // colour (hiding the floor lines and anything behind it), then the translucent fill draws where that depth
  // matches. Faces and edges behind it are hidden.
  // The polygon offset pushes the faces back a hair so the outline edges lying on them stay visible.
  return (
    <group>
      <mesh geometry={faceGeo} renderOrder={1}>
        <meshBasicMaterial color={BACKGROUND} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
      </mesh>
      <mesh geometry={faceGeo} renderOrder={2}>
        <meshBasicMaterial
          color={WALL_FILL}
          transparent
          opacity={0.45}
          depthWrite={false}
          depthFunc={THREE.LessEqualDepth}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>
      <lineSegments geometry={edgeGeo} renderOrder={3}>
        <lineBasicMaterial color={ORANGE} transparent opacity={0.85} />
      </lineSegments>
    </group>
  )
}

// Every tried step drawn as a thin bar between cell centres, so all attempted routes from Start grow like a tree.
// Bars on the final path turn orange and thick.
function Branches({ grid, branches, path }) {
  const onPath = new Set()
  for (let i = 1; i < path.length; i++) onPath.add(`${path[i - 1]}|${path[i]}`).add(`${path[i]}|${path[i - 1]}`)
  const bar = (a, b, k, width, y, color, opacity) => {
    const [ax, az] = grid.toWorld(a)
    const [bx, bz] = grid.toWorld(b)
    const len = Math.hypot(bx - ax, bz - az)
    const angle = Math.atan2(-(bz - az), bx - ax)
    return (
      <mesh key={k} position={[(ax + bx) / 2, y, (az + bz) / 2]} rotation={[-Math.PI / 2, 0, angle]}>
        <planeGeometry args={[len, width]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
      </mesh>
    )
  }
  return (
    <>
      {branches
        .filter(([a, b]) => !onPath.has(`${a}|${b}`))
        .map(([a, b, isFresh, side]) =>
          bar(a, b, `${a}|${b}`, 0.06, 0.014, side === 'b' ? '#c084fc' : '#38bdf8', isFresh ? 0.95 : 0.45),
        )}
      {/* The found path is drawn step by step on its own: walking back it may step to any lower-scored neighbour,
          not only the one that handed out the score, so it does not always run along a tried branch. */}
      {path.slice(1).map((c, i) => bar(path[i], c, `p${i}`, 0.16, 0.017, ORANGE, 1))}
    </>
  )
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

// Thin, tall colored pillar marking the start or finish cell, standing on the cell painted a darker shade of
// the same colour. Lambert + emissive and no shadows: renders on every mobile GPU.
export function Marker({ grid, cell, color, pulse }) {
  const ref = useRef()
  const base = useMemo(() => new THREE.Color(color).multiplyScalar(0.15), [color])
  useFrame(({ clock }) => {
    if (pulse) ref.current.material.emissiveIntensity = 0.5 + Math.sin(clock.elapsedTime * 4) * 0.25
  })
  const [wx, wz] = grid.toWorld(cell)
  return (
    <group>
      <mesh ref={ref} position={[wx, 0.9, wz]}>
        <cylinderGeometry args={[0.07, 0.07, 1.8, 20]} />
        <meshLambertMaterial color={color} emissive={color} emissiveIntensity={0.5} />
      </mesh>
      <mesh {...flat(wx, wz, 0.012)} geometry={cellGeometry(grid, cell, 0.94)}>
        <meshBasicMaterial color={base} />
      </mesh>
    </group>
  )
}

const segments = (pairs, y) => {
  const pts = new Float32Array(pairs.length * 6)
  pairs.forEach(([a, b], i) => pts.set([a[0], y, a[1], b[0], y, b[1]], i * 6))
  return new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pts, 3))
}

/**
 * Layers for the any-angle methods, revealed as `f` goes from 0 to 1:
 *   tree  (RRT, RRT*) — branches in the order they grew
 *   field (potential) — one arrow per free cell, pointing where the forces push
 *   graph (visibility graph) — corner nodes as dots, lines of sight appearing, thin pillars at the route's bends
 *   route — the cube's track; drawn as it grows for the potential field, at the end for the others.
 *   A track that got stuck is drawn red.
 */
export function AnyAngleLayer({ grid, result, f }) {
  const treeGeo = useMemo(() => {
    if (!result.tree) return null
    const n = Math.ceil(result.tree.length * f)
    return segments(result.tree.slice(0, n), 0.03)
  }, [result, f])
  const fieldGeo = useMemo(() => {
    if (!result.field) return null
    const L = 0.34 * grid.cellSize
    const pairs = []
    for (const [x, z, dx, dz] of result.field) {
      const tip = [x + dx * L, z + dz * L]
      const back = [x - dx * L * 0.6, z - dz * L * 0.6]
      pairs.push([back, tip])
      for (const turn of [2.6, -2.6]) {
        const a = Math.atan2(dz, dx) + turn
        pairs.push([tip, [tip[0] + Math.cos(a) * L * 0.35, tip[1] + Math.sin(a) * L * 0.35]])
      }
    }
    return segments(pairs, 0.02)
  }, [result, grid])
  const graphGeo = useMemo(() => {
    if (!result.graph) return null
    const n = Math.ceil(result.graph.edges.length * f)
    return segments(result.graph.edges.slice(0, n), 0.03)
  }, [result, f])
  const nodeGeo = useMemo(() => {
    if (!result.graph) return null
    const pts = new Float32Array(result.graph.nodes.length * 3)
    result.graph.nodes.forEach(([x, z], i) => pts.set([x, 0.08, z], i * 3))
    return new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pts, 3))
  }, [result])
  useEffect(() => () => graphGeo?.dispose(), [graphGeo])
  useEffect(() => () => nodeGeo?.dispose(), [nodeGeo])
  useEffect(() => () => treeGeo?.dispose(), [treeGeo])
  useEffect(() => () => fieldGeo?.dispose(), [fieldGeo])

  const track = result.points ?? result.stuck
  const growing = !!result.field // the potential field's track is its search, so it grows with f
  const shown = track && (growing ? track.slice(0, Math.max(2, Math.ceil(track.length * f))) : f >= 1 ? track : null)
  return (
    <>
      {fieldGeo && (
        <lineSegments geometry={fieldGeo}>
          <lineBasicMaterial color="#94a3b8" transparent opacity={0.5} />
        </lineSegments>
      )}
      {graphGeo && (
        <lineSegments geometry={graphGeo}>
          <lineBasicMaterial color="#a78bfa" transparent opacity={0.35} />
        </lineSegments>
      )}
      {nodeGeo && (
        <points geometry={nodeGeo}>
          <pointsMaterial color="#e9d5ff" size={0.16 * grid.cellSize} sizeAttenuation />
        </points>
      )}
      {treeGeo && (
        <lineSegments geometry={treeGeo}>
          <lineBasicMaterial color="#38bdf8" transparent opacity={0.55} />
        </lineSegments>
      )}
      {result.graph && result.points && f >= 1 &&
        result.points.slice(1, -1).map(([x, z], i) => (
          // the route's turning points, marked like Start and Finish but with thinner pillars
          <mesh key={i} position={[x, 0.6, z]}>
            <cylinderGeometry args={[0.035, 0.035, 1.2, 12]} />
            <meshLambertMaterial color={WAYPOINT} emissive={WAYPOINT} emissiveIntensity={0.5} />
          </mesh>
        ))}
      {shown && shown.length > 1 && (
        <Line points={shown.map(([x, z]) => [x, 0.06, z])} color={result.points ? ORANGE : '#f87171'} lineWidth={4} />
      )}
    </>
  )
}

// Smoothing overlay: the pulled straight path (dashed white) and the curve the cube follows (light blue).
export function SmoothLines({ pulled, points }) {
  return (
    <>
      <Line points={pulled.map(([x, z]) => [x, 0.07, z])} color="#ffffff" lineWidth={1.5} dashed dashSize={0.25} gapSize={0.15} transparent opacity={0.75} />
      <Line points={points.map(([x, z]) => [x, 0.09, z])} color="#7dd3fc" lineWidth={4} />
    </>
  )
}
