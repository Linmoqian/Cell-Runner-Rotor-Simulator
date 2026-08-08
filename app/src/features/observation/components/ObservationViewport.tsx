import { type KeyboardEvent, type PointerEvent, useRef, useState } from 'react'
import styles from './ObservationStage.module.css'

interface ObservationViewportProps {
  activeStageNumber: number
  empty?: boolean
}

interface Coordinate {
  x: number
  y: number
}

const formatCoordinate = (value: number) =>
  `${value >= 0 ? '+' : '-'}${String(Math.abs(value)).padStart(3, '0')}`

export function ObservationViewport({ activeStageNumber, empty = false }: ObservationViewportProps) {
  const [stageOffset, setStageOffset] = useState<Coordinate>({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef<{
    pointerId: number
    x: number
    y: number
    originX: number
    originY: number
  } | null>(null)

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setIsDragging(true)
    dragStart.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      originX: stageOffset.x,
      originY: stageOffset.y,
    }
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = dragStart.current
    if (!start || start.pointerId !== event.pointerId) return

    setStageOffset({
      x: start.originX + event.clientX - start.x,
      y: start.originY + event.clientY - start.y,
    })
  }

  const stopDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (dragStart.current?.pointerId !== event.pointerId) return
    dragStart.current = null
    setIsDragging(false)
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 16 : 8
    const offsets = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    }[event.key]

    if (!offsets) return
    event.preventDefault()
    setStageOffset((offset) => ({ x: offset.x + offsets.x, y: offset.y + offsets.y }))
  }

  if (empty) {
    return (
      <section className={styles.emptyObservation} aria-label="空观察舞台">
        <div className={`${styles.stageFrame} ${styles.emptyFrame}`}>
          <div className={`${styles.stageViewport} ${styles.emptyViewport}`}>
            <div className={`${styles.crosshair} ${styles.crosshairHorizontal}`} />
            <div className={`${styles.crosshair} ${styles.crosshairVertical}`} />
          </div>
        </div>
      </section>
    )
  }

  return (
    <div className={styles.stageFrame}>
      <div className={styles.stageToolbar}>
        <span>FIELD / A-{String(activeStageNumber).padStart(2, '0')}</span>
        <span>ORIGIN / 0, 0</span>
      </div>
      <div className={styles.stageViewport}>
        <div
          aria-grabbed={isDragging}
          aria-label="可拖动的坐标舞台；使用方向键微调"
          className={styles.stagePlane}
          role="region"
          tabIndex={0}
          style={{ transform: `translate(${stageOffset.x}px, ${stageOffset.y}px)` }}
          onKeyDown={handleKeyDown}
          onPointerCancel={stopDrag}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDrag}
        >
          <div className={`${styles.crosshair} ${styles.crosshairHorizontal}`} />
          <div className={`${styles.crosshair} ${styles.crosshairVertical}`} />
        </div>
        <span className={`${styles.scaleMark} ${styles.scaleMarkTop}`}>100 μm</span>
        <span className={`${styles.scaleMark} ${styles.scaleMarkBottom}`}>◉ X / Y AXIS</span>
      </div>
      <div className={styles.stageFooter}>
        <span>OPTICAL CHANNEL / CH-01</span>
        <span className={styles.footerLine} />
        <span aria-live="polite">
          ORIGIN / X {formatCoordinate(stageOffset.x)} Y {formatCoordinate(stageOffset.y)} PX
        </span>
        <span>OBSERVATION MODE</span>
      </div>
    </div>
  )
}
