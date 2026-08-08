import { useEffect, useRef } from 'react'
import {
  createCellMembrane,
  createCellSkeleton,
  resolveCellMembrane,
  resolveCellSkeleton,
  type Point,
} from '../graphics/cellGeometry'
import { drawCell, drawSubstrate, drawTrail, type TrailPoint } from '../graphics/cellRenderer'
import {
  createRunnerRotorCell,
  stepRunnerRotor,
  type CellParams,
  type RunnerRotorCell,
} from '../model/runnerRotor'
import styles from './ObservationStage.module.css'

interface CellSimulationCanvasProps {
  onSnapshot: (snapshot: RunnerRotorCell) => void
  params: CellParams
  paused: boolean
  resetKey: string
  viewOffset: Point
}

interface LatestInputs {
  onSnapshot: (snapshot: RunnerRotorCell) => void
  params: CellParams
  paused: boolean
  viewOffset: Point
}

interface MutableValue<T> {
  current: T
}

const SIMULATION_MINUTES_PER_SECOND = 5
const PIXELS_PER_MICRON = 3.6

const fitCanvas = (canvas: HTMLCanvasElement, context: CanvasRenderingContext2D, size: Point) => {
  const bounds = canvas.getBoundingClientRect()
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
  size.x = Math.max(1, bounds.width)
  size.y = Math.max(1, bounds.height)
  canvas.width = Math.max(1, Math.round(size.x * pixelRatio))
  canvas.height = Math.max(1, Math.round(size.y * pixelRatio))
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
}

const followCell = (camera: Point, cellCenter: Point, viewportSize: Point, dtSeconds: number) => {
  const relativeX = cellCenter.x - camera.x
  const relativeY = cellCenter.y - camera.y
  const deadZoneX = viewportSize.x * 0.2
  const deadZoneY = viewportSize.y * 0.18
  const follow = 1 - Math.exp(-dtSeconds * 2.8)
  if (Math.abs(relativeX) > deadZoneX) camera.x += (relativeX - Math.sign(relativeX) * deadZoneX) * follow
  if (Math.abs(relativeY) > deadZoneY) camera.y += (relativeY - Math.sign(relativeY) * deadZoneY) * follow
}

const startCellSimulation = (canvas: HTMLCanvasElement, latestInputs: MutableValue<LatestInputs>) => {
  const context = canvas.getContext('2d')
  if (!context) return undefined

  const viewportSize: Point = { x: 1, y: 1 }
  let animationFrame = 0
  let lastTimestamp = performance.now()
  let lastSnapshotTimestamp = -Infinity
  let lastTrailMinute = -Infinity
  let cell = createRunnerRotorCell()
  let previousState = cell.state
  const initialCenter = { x: cell.x * PIXELS_PER_MICRON, y: cell.y * PIXELS_PER_MICRON }
  const skeleton = createCellSkeleton(initialCenter, cell.heading)
  const membrane = createCellMembrane(initialCenter, cell.heading)
  const camera: Point = { ...initialCenter }
  const trail: TrailPoint[] = [{ ...initialCenter, elapsedMinutes: cell.elapsedMinutes, state: cell.state }]
  const resizeCanvas = () => fitCanvas(canvas, context, viewportSize)

  const renderFrame = (timestamp: number) => {
    const dtSeconds = Math.min(Math.max((timestamp - lastTimestamp) / 1000, 0), 0.05)
    lastTimestamp = timestamp

    if (!latestInputs.current.paused) {
      const dtMinutes = dtSeconds * SIMULATION_MINUTES_PER_SECOND
      cell = stepRunnerRotor(cell, latestInputs.current.params, dtMinutes)
      const cellCenter = { x: cell.x * PIXELS_PER_MICRON, y: cell.y * PIXELS_PER_MICRON }
      resolveCellSkeleton(skeleton, cellCenter, cell.heading, dtSeconds)
      resolveCellMembrane(
        membrane,
        cellCenter,
        cell.heading,
        cell.elapsedMinutes,
        cell.state,
        cell.chirality,
        dtSeconds,
      )
      followCell(camera, cellCenter, viewportSize, dtSeconds)

      if (cell.elapsedMinutes - lastTrailMinute >= 0.34) {
        trail.push({ ...cellCenter, elapsedMinutes: cell.elapsedMinutes, state: cell.state })
        lastTrailMinute = cell.elapsedMinutes
      }

      if (cell.state !== previousState) {
        window.dispatchEvent(
          new CustomEvent('debug:cell-state', {
            detail: { chirality: cell.chirality, state: cell.state },
          }),
        )
        previousState = cell.state
      }
    }

    const { viewOffset } = latestInputs.current
    drawSubstrate(context, viewportSize.x, viewportSize.y, camera, viewOffset)
    context.save()
    context.translate(
      viewportSize.x / 2 - camera.x + viewOffset.x,
      viewportSize.y / 2 - camera.y + viewOffset.y,
    )
    drawTrail(context, trail)
    drawCell(context, {
      center: { x: cell.x * PIXELS_PER_MICRON, y: cell.y * PIXELS_PER_MICRON },
      elapsedMinutes: cell.elapsedMinutes,
      heading: cell.heading,
      membrane,
      skeleton,
      state: cell.state,
    })
    context.restore()

    if (timestamp - lastSnapshotTimestamp >= 160) {
      latestInputs.current.onSnapshot(cell)
      lastSnapshotTimestamp = timestamp
    }
    animationFrame = window.requestAnimationFrame(renderFrame)
  }

  const resizeObserver = new ResizeObserver(resizeCanvas)
  resizeObserver.observe(canvas)
  resizeCanvas()
  latestInputs.current.onSnapshot(cell)
  animationFrame = window.requestAnimationFrame(renderFrame)

  return () => {
    resizeObserver.disconnect()
    window.cancelAnimationFrame(animationFrame)
  }
}

export function CellSimulationCanvas({
  onSnapshot,
  params,
  paused,
  resetKey,
  viewOffset,
}: CellSimulationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const latestInputs = useRef<LatestInputs>({ onSnapshot, params, paused, viewOffset })

  useEffect(() => {
    latestInputs.current = { onSnapshot, params, paused, viewOffset }
  }, [onSnapshot, params, paused, viewOffset])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || typeof window.requestAnimationFrame !== 'function') return undefined
    return startCellSimulation(canvas, latestInputs)
  }, [resetKey])

  return (
    <canvas
      ref={canvasRef}
      aria-label="Runner-Rotor 单细胞运动与可变形膜动画"
      className={styles.cellCanvas}
    />
  )
}
