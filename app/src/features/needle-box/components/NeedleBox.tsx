import { motion, type Transition } from 'motion/react'
import { Syringe } from 'lucide-react'
import { type MouseEvent as ReactMouseEvent, useEffect, useLayoutEffect, useRef, useState } from 'react'
import styles from './NeedleBox.module.css'

type NeedlePhase = 'stored' | 'lifting' | 'held' | 'returning'

interface Point {
  x: number
  y: number
}

// 针的渲染尺寸（px）：坐标以左上角为锚点，集中在这里避免样式与逻辑漂移。
const NEEDLE_WIDTH = 48
const NEEDLE_HEIGHT = 64
const LIFTING_MS = 280
const PICK_UP_EASE = [0.22, 1, 0.36, 1] as const

const STATUS_TEXT: Record<NeedlePhase, string> = {
  stored: '点击针拿起',
  lifting: '正在拿取针…',
  held: '针已拿起，随鼠标移动；点击盒子放回',
  returning: '正在放回针…',
}

const toPointerAnchor = (event: { clientX: number; clientY: number }): Point => ({
  x: event.clientX - NEEDLE_WIDTH / 2,
  y: event.clientY - NEEDLE_HEIGHT / 2,
})

const getNeedleAnimation = (phase: NeedlePhase, anchor: Point, pointer: Point) => {
  if (phase === 'stored' || phase === 'returning') {
    return { x: anchor.x, y: anchor.y, rotate: 0, scale: 1 }
  }
  if (phase === 'lifting') {
    return {
      x: [anchor.x, pointer.x],
      y: [anchor.y, pointer.y - 14, pointer.y],
      rotate: [0, -16],
      scale: [1, 1.18],
    }
  }
  return { x: pointer.x, y: pointer.y, rotate: -16, scale: 1.18 }
}

const getNeedleTransition = (phase: NeedlePhase): Transition => {
  if (phase === 'lifting') {
    return { duration: 0.28, times: [0, 0.55, 1], ease: PICK_UP_EASE }
  }
  if (phase === 'held') {
    return { type: 'spring', stiffness: 950, damping: 46, mass: 0.4 }
  }
  if (phase === 'returning') {
    return { type: 'spring', stiffness: 260, damping: 15, mass: 0.9 }
  }
  return { duration: 0 }
}

export function NeedleBox() {
  const slotRef = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<NeedlePhase>('stored')
  const [anchor, setAnchor] = useState<Point | null>(null)
  const [pointer, setPointer] = useState<Point>({ x: 0, y: 0 })

  useLayoutEffect(() => {
    const measureAnchor = () => {
      const bounds = slotRef.current?.getBoundingClientRect()
      if (!bounds) return
      setAnchor({
        x: bounds.left + bounds.width / 2 - NEEDLE_WIDTH / 2,
        y: bounds.top + bounds.height / 2 - NEEDLE_HEIGHT / 2,
      })
    }
    measureAnchor()
    window.addEventListener('resize', measureAnchor)
    return () => window.removeEventListener('resize', measureAnchor)
  }, [])

  useEffect(() => {
    if (phase !== 'lifting') return undefined
    const timer = window.setTimeout(() => setPhase('held'), LIFTING_MS)
    return () => window.clearTimeout(timer)
  }, [phase])

  useEffect(() => {
    if (phase !== 'held') return undefined
    const handlePointerMove = (event: PointerEvent) => setPointer(toPointerAnchor(event))
    window.addEventListener('pointermove', handlePointerMove)
    return () => window.removeEventListener('pointermove', handlePointerMove)
  }, [phase])

  const handlePickUp = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (phase !== 'stored') return
    setPointer(toPointerAnchor(event))
    setPhase('lifting')
  }

  const handlePutBack = () => {
    if (phase !== 'held') return
    setPhase('returning')
  }

  const handleReturnComplete = () => {
    if (phase === 'returning') setPhase('stored')
  }

  const returnReady = phase === 'held'
  const needleClass = [styles.needle, returnReady ? styles.needleHeld : ''].filter(Boolean).join(' ')

  return (
    <aside
      aria-label="针盒"
      className={`${styles.needlePanel}${returnReady ? ` ${styles.returnReady}` : ''}`}
      data-needle-state={phase}
      onClick={handlePutBack}
    >
      <div className={styles.panelHeading}>
        <h2>针盒</h2>
        <span className={styles.toolTag}>TOOL / NEEDLE</span>
      </div>
      <div ref={slotRef} className={styles.slot}>
        <Syringe aria-hidden="true" className={styles.slotGhost} />
      </div>
      <p aria-live="polite" className={styles.hint}>
        {STATUS_TEXT[phase]}
      </p>
      {anchor ? (
        <motion.div
          className={needleClass}
          initial={false}
          animate={getNeedleAnimation(phase, anchor, pointer)}
          transition={getNeedleTransition(phase)}
          onAnimationComplete={handleReturnComplete}
          style={{
            left: 0,
            top: 0,
            width: NEEDLE_WIDTH,
            height: NEEDLE_HEIGHT,
            pointerEvents: phase === 'stored' ? 'auto' : 'none',
          }}
        >
          <button
            aria-label="拿起针"
            className={styles.needleButton}
            disabled={phase !== 'stored'}
            type="button"
            onClick={handlePickUp}
          >
            <Syringe aria-hidden="true" />
          </button>
        </motion.div>
      ) : null}
    </aside>
  )
}
