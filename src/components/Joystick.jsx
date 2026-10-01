import { useRef, useState } from 'react'

// Reports the dominant direction as [dx, dy] in grid space (screen up = -y), or null.
export default function Joystick({ onDir }) {
  const base = useRef()
  const [knob, setKnob] = useState([0, 0])
  const active = useRef(false)

  const update = (e) => {
    const r = base.current.getBoundingClientRect()
    const max = r.width / 2 - 30
    let x = e.clientX - (r.left + r.width / 2)
    let y = e.clientY - (r.top + r.height / 2)
    const len = Math.hypot(x, y)
    if (len > max) {
      x = (x / len) * max
      y = (y / len) * max
    }
    setKnob([x, y])
    if (len < max * 0.35) onDir(null)
    else if (Math.abs(x) > Math.abs(y)) onDir([Math.sign(x), 0])
    else onDir([0, Math.sign(y)])
  }

  const end = () => {
    active.current = false
    setKnob([0, 0])
    onDir(null)
  }

  return (
    <div
      ref={base}
      className="joystick"
      onPointerDown={(e) => {
        active.current = true
        e.currentTarget.setPointerCapture(e.pointerId)
        update(e)
      }}
      onPointerMove={(e) => active.current && update(e)}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div className="knob" style={{ transform: `translate(${knob[0]}px, ${knob[1]}px)` }} />
    </div>
  )
}
