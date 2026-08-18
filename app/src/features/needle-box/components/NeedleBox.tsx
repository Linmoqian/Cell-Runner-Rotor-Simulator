import { motion, type Transition } from 'motion/react'
import { Syringe } from 'lucide-react'
import {
  type MouseEvent as ReactMouseEvent,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import {
  getHeldAnchor,
  getHeading,
  MIN_HEADING_DISTANCE,
  NEEDLE_HALF,
  NEEDLE_HEIGHT,
  NEEDLE_WIDTH,
  REST_ROTATE,
  type Point,
} from '../model/needleGeometry'
import styles from './NeedleBox.module.css'

type NeedlePhase = 'stored' | 'lifting' | 'held' | 'returning'

const LIFTING_MS = 280
const PICK_UP_EASE = [0.22, 1, 0.36, 1] as const

const STATUS_TEXT: Record<NeedlePhase, string> = {
  stored: '点击针拿起',
  lifting: '正在拿取针…',
  held: '针头已对准鼠标，随鼠标移动；点击盒子放回',
  returning: '正在放回针…',
}

const getNeedleAnimation = (phase: NeedlePhase, anchor: Point, cursor: Point, heading: number) => {
  const rest = { x: anchor.x, y: anchor.y, rotate: REST_ROTATE, scale: 1 }
  if (phase === 'stored' || phase === 'returning') {
    return rest
  }
  const held = { ...getHeldAnchor(cursor, heading), rotate: heading, scale: 1.18 }
  if (phase === 'lifting') {
    const liftedMid = { x: (anchor.x + held.x) / 2, y: (anchor.y + held.y) / 2 - 26 }
    return {
      x: [anchor.x, liftedMid.x, held.x],
      y: [anchor.y, liftedMid.y, held.y],
      rotate: [REST_ROTATE, heading],
      scale: [1, 1.18],
    }
  }
  return held
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

function useNeedleMotion(slotRef: RefObject<HTMLDivElement | null>) {
  const lastCursorRef = useRef<Point | null>(null)
  const [phase, setPhase] = useState<NeedlePhase>('stored')
  const [anchor, setAnchor] = useState<Point | null>(null)
  const [cursor, setCursor] = useState<Point>({ x: 0, y: 0 })
  const [heading, setHeading] = useState(REST_ROTATE)

  useLayoutEffect(() => {
    const measureAnchor = () => {
      const bounds = slotRef.current?.getBoundingClientRect()
      if (!bounds) return
      setAnchor({
        x: bounds.left + bounds.width / 2 - NEEDLE_HALF.x,
        y: bounds.top + bounds.height / 2 - NEEDLE_HALF.y,
      })
    }
    measureAnchor()
    window.addEventListener('resize', measureAnchor)
    return () => window.removeEventListener('resize', measureAnchor)
  }, [slotRef])

  useEffect(() => {
    if (phase !== 'lifting') return undefined
    const timer = window.setTimeout(() => setPhase('held'), LIFTING_MS)
    return () => window.clearTimeout(timer)
  }, [phase])

  useEffect(() => {
    if (phase !== 'held') return undefined
    const handlePointerMove = (event: PointerEvent) => {
      const nextCursor = { x: event.clientX, y: event.clientY }
      const previous = lastCursorRef.current
      if (
        previous &&
        Math.hypot(nextCursor.x - previous.x, nextCursor.y - previous.y) >= MIN_HEADING_DISTANCE
      ) {
        setHeading(getHeading(previous, nextCursor))
      }
      lastCursorRef.current = nextCursor
      setCursor(nextCursor)
    }
    window.addEventListener('pointermove', handlePointerMove)
    return () => window.removeEventListener('pointermove', handlePointerMove)
  }, [phase])

  const pickUp = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (phase !== 'stored' || !anchor) return
    const pickupCursor = { x: event.clientX, y: event.clientY }
    const slotCenter = { x: anchor.x + NEEDLE_HALF.x, y: anchor.y + NEEDLE_HALF.y }
    lastCursorRef.current = pickupCursor
    setCursor(pickupCursor)
    setHeading(getHeading(slotCenter, pickupCursor))
    setPhase('lifting')
  }

  const putBack = () => {
    if (phase !== 'held') return
    setPhase('returning')
  }

  const handleReturnComplete = () => {
    if (phase === 'returning') setPhase('stored')
  }

  return { anchor, cursor, handleReturnComplete, heading, phase, pickUp, putBack }
}

export function NeedleBox() {
  const slotRef = useRef<HTMLDivElement>(null)
  const { anchor, cursor, handleReturnComplete, heading, phase, pickUp, putBack } = useNeedleMotion(slotRef)
  const returnReady = phase === 'held'
  const needleClass = [styles.needle, returnReady ? styles.needleHeld : ''].filter(Boolean).join(' ')

  return (
    <aside
      aria-label="针盒"
      className={`${styles.needlePanel}${returnReady ? ` ${styles.returnReady}` : ''}`}
      data-needle-state={phase}
      onClick={putBack}
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
          animate={getNeedleAnimation(phase, anchor, cursor, heading)}
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
            onClick={pickUp}
          >
            <Syringe aria-hidden="true" />
          </button>
        </motion.div>
      ) : null}
    </aside>
  )
}
