import { type KeyboardEvent, type PointerEvent, type WheelEvent, useRef, useState } from 'react'
import type { RunnerRotorCell } from '../model/runnerRotor'
import type { CellScientificFrame } from '../types'
import { CellSimulationCanvas } from './CellSimulationCanvas'
import styles from './ObservationStage.module.css'

interface ObservationViewportProps {
  activeStageNumber: number
  initialCells: CellScientificFrame[]
  observatoryId: string
  onSnapshot: (snapshot: RunnerRotorCell, cellCount: number) => void
  resetKey: string
}

interface Coordinate {
  x: number
  y: number
}

const MIN_ZOOM = 0.35
const MAX_ZOOM = 4
const formatCoordinate = (value: number) =>
  `${value >= 0 ? '+' : '-'}${String(Math.round(Math.abs(value))).padStart(3, '0')}`

function useViewportCamera() {
  const [stageOffset, setStageOffset] = useState<Coordinate>({ x: 0, y: 0 })
  const [stageZoom, setStageZoom] = useState(1)
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef<{
    pointerId: number
    x: number
    y: number
    originX: number
    originY: number
  } | null>(null)

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.button !== 1) return
    event.preventDefault()
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

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    const bounds = event.currentTarget.getBoundingClientRect()
    const pointerX = event.clientX - bounds.left - bounds.width / 2
    const pointerY = event.clientY - bounds.top - bounds.height / 2
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, stageZoom * Math.exp(-event.deltaY * 0.0015)))
    const ratio = nextZoom / stageZoom
    setStageOffset((offset) => ({
      x: pointerX - (pointerX - offset.x) * ratio,
      y: pointerY - (pointerY - offset.y) * ratio,
    }))
    setStageZoom(nextZoom)
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

  return {
    handleKeyDown,
    handlePointerDown,
    handlePointerMove,
    handlePointerStop: stopDrag,
    handleWheel,
    isDragging,
    stageOffset,
    stageZoom,
  }
}

export function ObservationViewport({
  activeStageNumber,
  initialCells,
  observatoryId,
  onSnapshot,
  resetKey,
}: ObservationViewportProps) {
  const camera = useViewportCamera()

  return (
    <div className={styles.stageFrame}>
      <div className={styles.stageToolbar}>
        <span>OBSERVATORY / A-{String(activeStageNumber).padStart(2, '0')}</span>
        <span>BACKEND TRAJECTORY STREAM</span>
      </div>
      <div className={styles.stageViewport} onWheel={camera.handleWheel}>
        <CellSimulationCanvas
          initialCells={initialCells}
          observatoryId={observatoryId}
          onSnapshot={onSnapshot}
          resetKey={resetKey}
          viewOffset={camera.stageOffset}
          viewZoom={camera.stageZoom}
        />
        <div
          aria-grabbed={camera.isDragging}
          aria-label="可平移缩放的观察台；滚轮缩放，中键或左键拖动"
          className={styles.stagePlane}
          role="region"
          tabIndex={0}
          style={{ transform: `translate(${camera.stageOffset.x}px, ${camera.stageOffset.y}px)` }}
          onKeyDown={camera.handleKeyDown}
          onPointerCancel={camera.handlePointerStop}
          onPointerDown={camera.handlePointerDown}
          onPointerMove={camera.handlePointerMove}
          onPointerUp={camera.handlePointerStop}
        >
          <div className={`${styles.crosshair} ${styles.crosshairHorizontal}`} />
          <div className={`${styles.crosshair} ${styles.crosshairVertical}`} />
        </div>
        <span className={`${styles.scaleMark} ${styles.scaleMarkTop}`}>100 μm</span>
        <span className={`${styles.scaleMark} ${styles.scaleMarkBottom}`}>◉ X / Y AXIS</span>
      </div>
      <div className={styles.stageFooter}>
        <span>MCF-10A / COLLAGEN</span>
        <span className={styles.footerLine} />
        <span aria-live="polite">
          ORIGIN / X {formatCoordinate(camera.stageOffset.x)} Y {formatCoordinate(camera.stageOffset.y)} PX ·
          ZOOM {camera.stageZoom.toFixed(2)}×
        </span>
        <span>RUNNER-ROTOR</span>
      </div>
    </div>
  )
}
