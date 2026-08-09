import { offsetSkeleton, type CellMembrane, type CellSkeleton, type Point } from './cellGeometry'
import type { CellState } from '../model/runnerRotor'

export interface TrailPoint extends Point {
  elapsedMinutes: number
  state: CellState
}

interface DrawCellOptions {
  center: Point
  elapsedMinutes: number
  heading: number
  membrane: CellMembrane
  skeleton: CellSkeleton
  state: CellState
}

const MIN_TRAIL_VISIBILITY = 0.14
const TRAIL_FADE_MINUTES = 90

const traceSmoothOpenPath = (context: CanvasRenderingContext2D, points: Point[]) => {
  if (points.length < 2) return
  context.moveTo(points[0].x, points[0].y)
  for (let index = 1; index < points.length - 1; index += 1) {
    const current = points[index]
    const next = points[index + 1]
    context.quadraticCurveTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2)
  }
  const last = points[points.length - 1]
  context.lineTo(last.x, last.y)
}

const traceMembrane = (context: CanvasRenderingContext2D, membrane: CellMembrane) => {
  const outline = membrane.particles
  context.beginPath()
  context.moveTo(outline[0].x, outline[0].y)
  for (let index = 0; index < outline.length; index += 1) {
    const current = outline[index]
    const next = outline[(index + 1) % outline.length]
    context.quadraticCurveTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2)
  }
  context.closePath()
}

const drawMembraneParticles = (
  context: CanvasRenderingContext2D,
  membrane: CellMembrane,
  state: CellState,
) => {
  context.save()
  context.fillStyle = state === 'turn' ? 'rgba(255, 229, 207, 0.38)' : 'rgba(229, 255, 237, 0.3)'
  membrane.particles.forEach((particle) => {
    context.beginPath()
    context.arc(particle.x, particle.y, 0.72, 0, Math.PI * 2)
    context.fill()
  })
  context.restore()
}

export const drawSubstrate = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  camera: Point,
  viewOffset: Point,
  zoom = 1,
) => {
  context.clearRect(0, 0, width, height)
  context.fillStyle = '#111f21'
  context.fillRect(0, 0, width, height)

  const spacing = 34 * zoom
  const offsetX = ((-camera.x * zoom + viewOffset.x) % spacing) - spacing
  const offsetY = ((-camera.y * zoom + viewOffset.y) % spacing) - spacing
  context.fillStyle = 'rgba(125, 171, 157, 0.11)'
  for (let x = offsetX; x < width + spacing; x += spacing) {
    for (let y = offsetY; y < height + spacing; y += spacing) {
      const stagger = Math.round(y / spacing) % 2 === 0 ? 0 : spacing / 2
      context.fillRect(x + stagger, y, 1, 1)
    }
  }

  const vignette = context.createRadialGradient(
    width / 2,
    height / 2,
    40,
    width / 2,
    height / 2,
    width * 0.68,
  )
  vignette.addColorStop(0, 'rgba(91, 148, 126, 0.06)')
  vignette.addColorStop(1, 'rgba(2, 9, 12, 0.5)')
  context.fillStyle = vignette
  context.fillRect(0, 0, width, height)
}

export const getTrailOpacity = (point: TrailPoint, newestElapsedMinutes: number) => {
  const baseOpacity = point.state === 'turn' ? 0.54 : 0.28
  const ageMinutes = Math.max(0, newestElapsedMinutes - point.elapsedMinutes)
  const ageFactor =
    MIN_TRAIL_VISIBILITY + (1 - MIN_TRAIL_VISIBILITY) * Math.exp(-ageMinutes / TRAIL_FADE_MINUTES)
  return baseOpacity * ageFactor
}

export const drawTrail = (context: CanvasRenderingContext2D, trail: TrailPoint[]) => {
  if (trail.length < 2) return
  const newestElapsedMinutes = trail[trail.length - 1].elapsedMinutes
  context.save()
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.lineWidth = 1.6
  for (let index = 1; index < trail.length; index += 1) {
    const previous = trail[index - 1]
    const point = trail[index]
    context.beginPath()
    context.moveTo(previous.x, previous.y)
    context.lineTo(point.x, point.y)
    const opacity = getTrailOpacity(point, newestElapsedMinutes)
    context.strokeStyle =
      point.state === 'turn' ? `rgba(239, 165, 119, ${opacity})` : `rgba(140, 217, 184, ${opacity})`
    context.stroke()
  }
  context.restore()
}

const drawActinFlow = (
  context: CanvasRenderingContext2D,
  skeleton: CellSkeleton,
  elapsedMinutes: number,
  state: CellState,
) => {
  context.save()
  context.lineWidth = state === 'turn' ? 1.25 : 1.6
  context.lineCap = 'round'
  context.setLineDash([3, 7])
  context.lineDashOffset = -elapsedMinutes * 9
  for (const offset of [-7, 0, 7]) {
    context.beginPath()
    traceSmoothOpenPath(context, offsetSkeleton(skeleton, offset).reverse())
    context.strokeStyle = state === 'turn' ? 'rgba(255, 209, 166, 0.34)' : 'rgba(203, 255, 224, 0.46)'
    context.stroke()
  }
  context.restore()
}

const drawNucleus = (context: CanvasRenderingContext2D, skeleton: CellSkeleton) => {
  const anchor = skeleton.joints[3]
  const next = skeleton.joints[4]
  const angle = Math.atan2(anchor.y - next.y, anchor.x - next.x)
  context.save()
  context.translate(anchor.x, anchor.y)
  context.rotate(angle)
  context.beginPath()
  context.ellipse(0, 0, 11, 8.5, 0, 0, Math.PI * 2)
  context.fillStyle = 'rgba(13, 48, 47, 0.78)'
  context.fill()
  context.strokeStyle = 'rgba(190, 239, 218, 0.34)'
  context.lineWidth = 1
  context.stroke()
  context.restore()
}

const drawPolarity = (
  context: CanvasRenderingContext2D,
  center: Point,
  heading: number,
  state: CellState,
) => {
  const length = state === 'run' ? 70 : 58
  const end = { x: center.x + Math.cos(heading) * length, y: center.y + Math.sin(heading) * length }
  context.save()
  context.strokeStyle = state === 'run' ? 'rgba(211, 255, 226, 0.82)' : 'rgba(255, 198, 151, 0.9)'
  context.fillStyle = context.strokeStyle
  context.lineWidth = 1.4
  context.beginPath()
  context.moveTo(center.x, center.y)
  context.lineTo(end.x, end.y)
  context.stroke()
  context.translate(end.x, end.y)
  context.rotate(heading)
  context.beginPath()
  context.moveTo(0, 0)
  context.lineTo(-9, -4)
  context.lineTo(-7, 0)
  context.lineTo(-9, 4)
  context.closePath()
  context.fill()
  context.restore()
}

export const drawCell = (context: CanvasRenderingContext2D, options: DrawCellOptions) => {
  const { center, elapsedMinutes, heading, membrane, skeleton, state } = options
  const front = skeleton.joints[0]
  const rear = skeleton.joints[skeleton.joints.length - 1]
  const membraneGradient = context.createLinearGradient(rear.x, rear.y, front.x, front.y)
  membraneGradient.addColorStop(0, state === 'turn' ? 'rgba(109, 87, 77, 0.84)' : 'rgba(63, 104, 91, 0.86)')
  membraneGradient.addColorStop(
    0.55,
    state === 'turn' ? 'rgba(172, 116, 87, 0.92)' : 'rgba(94, 157, 128, 0.94)',
  )
  membraneGradient.addColorStop(
    1,
    state === 'turn' ? 'rgba(245, 174, 119, 0.96)' : 'rgba(175, 235, 194, 0.96)',
  )

  context.save()
  traceMembrane(context, membrane)
  context.shadowColor = state === 'turn' ? 'rgba(255, 154, 102, 0.34)' : 'rgba(159, 243, 194, 0.28)'
  context.shadowBlur = state === 'turn' ? 23 : 17
  context.fillStyle = membraneGradient
  context.fill()
  context.shadowBlur = 0
  context.strokeStyle = state === 'turn' ? 'rgba(255, 220, 190, 0.78)' : 'rgba(220, 255, 232, 0.72)'
  context.lineWidth = 1.25
  context.stroke()
  context.clip()
  drawActinFlow(context, skeleton, elapsedMinutes, state)
  drawNucleus(context, skeleton)
  context.restore()
  drawMembraneParticles(context, membrane, state)

  context.save()
  context.beginPath()
  context.arc(center.x, center.y, 2.2, 0, Math.PI * 2)
  context.fillStyle = 'rgba(235, 255, 244, 0.82)'
  context.fill()
  context.restore()
  drawPolarity(context, center, heading, state)
}
