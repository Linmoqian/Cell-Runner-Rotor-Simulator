import { type MutableRefObject, useEffect, useRef } from 'react'
import {
  createCellMembrane,
  createCellSkeleton,
  resolveCellMembrane,
  resolveCellSkeleton,
  type CellMembrane,
  type CellSkeleton,
  type Point,
} from '../graphics/cellGeometry'
import { drawCell, drawSubstrate, drawTrail, type TrailPoint } from '../graphics/cellRenderer'
import { subscribeToFrames } from '../services/simulationClient'
import type { CellScientificFrame, SimulationFrame } from '../types'
import type { RunnerRotorCell } from '../model/runnerRotor'
import styles from './ObservationStage.module.css'

interface CellSimulationCanvasProps {
  initialCells: CellScientificFrame[]
  observatoryId: string
  onSnapshot: (snapshot: RunnerRotorCell, cellCount: number) => void
  resetKey: string
  viewOffset: Point
  viewZoom: number
}

interface LatestInputs {
  onSnapshot: (snapshot: RunnerRotorCell, cellCount: number) => void
  viewOffset: Point
  viewZoom: number
}

interface VisualCell {
  current: CellScientificFrame
  membrane: CellMembrane
  skeleton: CellSkeleton
  target: CellScientificFrame
  trail: TrailPoint[]
}

const PIXELS_PER_MICRON = 3.6
const MAX_TOTAL_TRAIL_POINTS = 12_000
const MAX_TRAIL_POINTS_PER_CELL = 720
const MIN_TRAIL_POINTS_PER_CELL = 48

const fitCanvas = (canvas: HTMLCanvasElement, context: CanvasRenderingContext2D, size: Point) => {
  const bounds = canvas.getBoundingClientRect()
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
  size.x = Math.max(1, bounds.width)
  size.y = Math.max(1, bounds.height)
  canvas.width = Math.max(1, Math.round(size.x * pixelRatio))
  canvas.height = Math.max(1, Math.round(size.y * pixelRatio))
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
}

const toWorldPoint = (cell: CellScientificFrame) => ({
  x: cell.x * PIXELS_PER_MICRON,
  y: cell.y * PIXELS_PER_MICRON,
})

const createVisualCell = (cell: CellScientificFrame): VisualCell => {
  const center = toWorldPoint(cell)
  return {
    current: { ...cell },
    membrane: createCellMembrane(center, cell.heading),
    skeleton: createCellSkeleton(center, cell.heading),
    target: { ...cell },
    trail: [{ ...center, elapsedMinutes: cell.elapsedMinutes, state: cell.state }],
  }
}

const shortestAngle = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from))

function applyFrame(visualCells: Map<string, VisualCell>, frame: SimulationFrame) {
  const trailLimit = Math.min(
    MAX_TRAIL_POINTS_PER_CELL,
    Math.max(MIN_TRAIL_POINTS_PER_CELL, Math.floor(MAX_TOTAL_TRAIL_POINTS / Math.max(frame.cells.length, 1))),
  )
  for (const cell of frame.cells) {
    const visual = visualCells.get(cell.id)
    if (!visual) {
      visualCells.set(cell.id, createVisualCell(cell))
      continue
    }
    visual.target = cell
    const newestTrail = visual.trail[visual.trail.length - 1]
    if (cell.elapsedMinutes - newestTrail.elapsedMinutes >= 0.34) {
      visual.trail.push({ ...toWorldPoint(cell), elapsedMinutes: cell.elapsedMinutes, state: cell.state })
      if (visual.trail.length > trailLimit) visual.trail.splice(0, visual.trail.length - trailLimit)
    }
  }
}

function renderVisualCell(context: CanvasRenderingContext2D, visual: VisualCell, dtSeconds: number) {
  const follow = 1 - Math.exp(-dtSeconds * 14)
  visual.current.x += (visual.target.x - visual.current.x) * follow
  visual.current.y += (visual.target.y - visual.current.y) * follow
  visual.current.heading += shortestAngle(visual.current.heading, visual.target.heading) * follow
  visual.current.elapsedMinutes = visual.target.elapsedMinutes
  visual.current.stateElapsedMinutes = visual.target.stateElapsedMinutes
  visual.current.state = visual.target.state
  visual.current.chirality = visual.target.chirality
  const center = toWorldPoint(visual.current)
  resolveCellSkeleton(visual.skeleton, center, visual.current.heading, dtSeconds)
  resolveCellMembrane(
    visual.membrane,
    center,
    visual.current.heading,
    visual.current.elapsedMinutes,
    visual.current.state,
    visual.current.chirality,
    dtSeconds,
  )
  drawCell(context, {
    center,
    elapsedMinutes: visual.current.elapsedMinutes,
    heading: visual.current.heading,
    membrane: visual.membrane,
    skeleton: visual.skeleton,
    state: visual.current.state,
  })
}

function followPopulation(
  camera: Point,
  visualCells: Map<string, VisualCell>,
  viewportSize: Point,
  dtSeconds: number,
) {
  if (visualCells.size === 0) return 1
  let targetX = 0
  let targetY = 0
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const visual of visualCells.values()) {
    const x = visual.current.x * PIXELS_PER_MICRON
    const y = visual.current.y * PIXELS_PER_MICRON
    targetX += x
    targetY += y
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  targetX /= visualCells.size
  targetY /= visualCells.size
  const follow = 1 - Math.exp(-dtSeconds * 2.4)
  camera.x += (targetX - camera.x) * follow
  camera.y += (targetY - camera.y) * follow
  const contentWidth = Math.max(150, maxX - minX + 150)
  const contentHeight = Math.max(100, maxY - minY + 110)
  return Math.min(1, (viewportSize.x * 0.82) / contentWidth, (viewportSize.y * 0.82) / contentHeight)
}

function startRenderer(
  canvas: HTMLCanvasElement,
  observatoryId: string,
  initialCells: CellScientificFrame[],
  latestInputs: MutableRefObject<LatestInputs>,
) {
  const context = canvas.getContext('2d')
  if (!context) return undefined
  const viewportSize: Point = { x: 1, y: 1 }
  const visualCells = new Map(initialCells.map((cell) => [cell.id, createVisualCell(cell)]))
  const camera: Point = { x: 0, y: 0 }
  let animationFrame = 0
  let latestFrame: SimulationFrame | null = null
  let lastAppliedTick = -1
  let lastSnapshotTimestamp = -Infinity
  let lastTimestamp = performance.now()
  let populationZoom = 1
  const unsubscribe = subscribeToFrames(observatoryId, (frame) => {
    if (frame.tick > (latestFrame?.tick ?? lastAppliedTick)) latestFrame = frame
  })
  const resizeCanvas = () => fitCanvas(canvas, context, viewportSize)

  const renderFrame = (timestamp: number) => {
    const dtSeconds = Math.min(Math.max((timestamp - lastTimestamp) / 1000, 0), 0.05)
    lastTimestamp = timestamp
    if (latestFrame && latestFrame.tick > lastAppliedTick) {
      applyFrame(visualCells, latestFrame)
      lastAppliedTick = latestFrame.tick
    }
    const { viewOffset, viewZoom } = latestInputs.current
    const targetPopulationZoom = followPopulation(camera, visualCells, viewportSize, dtSeconds)
    populationZoom += (targetPopulationZoom - populationZoom) * (1 - Math.exp(-dtSeconds * 2.4))
    const effectiveZoom = populationZoom * viewZoom
    drawSubstrate(context, viewportSize.x, viewportSize.y, camera, viewOffset, effectiveZoom)
    context.save()
    context.translate(
      viewportSize.x / 2 - camera.x * effectiveZoom + viewOffset.x,
      viewportSize.y / 2 - camera.y * effectiveZoom + viewOffset.y,
    )
    context.scale(effectiveZoom, effectiveZoom)
    for (const visual of visualCells.values()) drawTrail(context, visual.trail)
    for (const visual of visualCells.values()) renderVisualCell(context, visual, dtSeconds)
    context.restore()

    if (timestamp - lastSnapshotTimestamp >= 160 && visualCells.size > 0) {
      const first = visualCells.values().next().value as VisualCell
      latestInputs.current.onSnapshot(first.current, visualCells.size)
      lastSnapshotTimestamp = timestamp
    }
    animationFrame = window.requestAnimationFrame(renderFrame)
  }

  const resizeObserver = new ResizeObserver(resizeCanvas)
  resizeObserver.observe(canvas)
  resizeCanvas()
  animationFrame = window.requestAnimationFrame(renderFrame)
  return () => {
    unsubscribe()
    resizeObserver.disconnect()
    window.cancelAnimationFrame(animationFrame)
  }
}

export function CellSimulationCanvas({
  initialCells,
  observatoryId,
  onSnapshot,
  resetKey,
  viewOffset,
  viewZoom,
}: CellSimulationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const latestInputs = useRef<LatestInputs>({ onSnapshot, viewOffset, viewZoom })

  useEffect(() => {
    latestInputs.current = { onSnapshot, viewOffset, viewZoom }
  }, [onSnapshot, viewOffset, viewZoom])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || typeof window.requestAnimationFrame !== 'function') return undefined
    return startRenderer(canvas, observatoryId, initialCells, latestInputs)
  }, [initialCells, observatoryId, resetKey])

  return (
    <canvas
      ref={canvasRef}
      aria-label="Runner-Rotor 多细胞群体与可变形膜动画"
      className={styles.cellCanvas}
    />
  )
}
