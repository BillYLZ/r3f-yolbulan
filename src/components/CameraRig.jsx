import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { SIZE } from '../grids.js'

const PANEL = 352 // desktop side panel width incl. margin
const FOLLOW_OFFSET = new THREE.Vector3(0, 5, 6)
const DURATION = 0.7 // seconds for a view transition

// Camera position for each preset, given the fitted distance d.
const VIEWS = {
  persp: (d) => new THREE.Vector3(0, d * 0.68, d * 0.73),
  top: (d) => new THREE.Vector3(0, d * 1.05, 0.001),
  iso: (d) => new THREE.Vector3(d * 0.58, d * 0.6, d * 0.58),
}

const ease = (t) => 1 - Math.pow(1 - t, 3)

/**
 * Orbit camera with preset views and an optional follow mode.
 * `gestures` on: one finger / left mouse rotates, two fingers zoom + pan.
 * `gestures` off: touch is left for editing the arena; two fingers and right mouse still move the camera.
 */
export default function CameraRig({ view, resetKey, gestures, followRef }) {
  const { camera, size } = useThree()
  const controls = useRef()
  const anim = useRef(null)
  const lastFollow = useRef(new THREE.Vector3())

  const fitDistance = () => {
    const v = THREE.MathUtils.degToRad(camera.fov) / 2
    const side = size.width >= 768 ? PANEL : 0
    const h = Math.atan(Math.tan(v) * ((size.width - side) / size.height))
    return Math.max((SIZE * 0.55) / Math.tan(h), (SIZE * 0.55) / Math.tan(v))
  }

  // Desktop: shift the projection so the arena centers in the space beside the panel.
  useEffect(() => {
    const side = size.width >= 768 ? PANEL : 0
    if (side) camera.setViewOffset(size.width, size.height, -side / 2, 0, size.width, size.height)
    else camera.clearViewOffset()
  }, [camera, size])

  // Start a smooth transition whenever the preset (or its reset) or screen size changes.
  useEffect(() => {
    const c = controls.current
    if (!c) return
    let toPos, toTarget
    if (view === 'follow' && followRef.current) {
      toTarget = followRef.current.position.clone()
      toPos = toTarget.clone().add(FOLLOW_OFFSET)
      lastFollow.current.copy(toTarget)
    } else {
      toTarget = new THREE.Vector3()
      toPos = (VIEWS[view] || VIEWS.persp)(fitDistance())
    }
    anim.current = { t: 0, fromPos: camera.position.clone(), fromTarget: c.target.clone(), toPos, toTarget }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, resetKey, size.width, size.height])

  useFrame((_, dt) => {
    const c = controls.current
    if (!c) return
    const a = anim.current
    if (a) {
      // In follow mode keep the destination glued to the moving cube.
      if (view === 'follow' && followRef.current) {
        a.toTarget.copy(followRef.current.position)
        a.toPos.copy(a.toTarget).add(FOLLOW_OFFSET)
      }
      a.t = Math.min(a.t + dt / DURATION, 1)
      const k = ease(a.t)
      camera.position.lerpVectors(a.fromPos, a.toPos, k)
      c.target.lerpVectors(a.fromTarget, a.toTarget, k)
      if (a.t === 1) {
        anim.current = null
        if (followRef.current) lastFollow.current.copy(followRef.current.position)
      }
      c.update()
    } else if (view === 'follow' && followRef.current) {
      // Move camera and target by the cube's motion, keeping the user's own zoom/rotation.
      const p = followRef.current.position
      const delta = p.clone().sub(lastFollow.current)
      if (delta.lengthSq() > 0) {
        camera.position.add(delta)
        c.target.add(delta)
        lastFollow.current.copy(p)
        c.update()
      }
    }
  })

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan
      screenSpacePanning={false}
      mouseButtons={
        gestures
          ? { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }
          : { MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }
      }
      touches={gestures ? { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN } : { TWO: THREE.TOUCH.DOLLY_PAN }}
      maxPolarAngle={Math.PI / 2.1}
      minDistance={3}
      maxDistance={80}
      onStart={() => (anim.current = null)}
    />
  )
}
