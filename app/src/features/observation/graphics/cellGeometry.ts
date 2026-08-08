import type { CellState } from '../model/runnerRotor'

export interface Point {
  x: number
  y: number
}

export interface CellSkeleton {
  joints: Point[]
}

export interface MembraneParticle extends Point {
  velocityX: number
  velocityY: number
}

export interface CellMembrane {
  particles: MembraneParticle[]
  restArea: number
  restBendLengths: number[]
  restEdgeLengths: number[]
}

const LINK_LENGTH = 17
const MAX_JOINT_BEND = 0.34
const BASE_WIDTHS = [9, 20, 27, 25, 17, 8]
const MEMBRANE_PARTICLE_COUNT = 40
const MEMBRANE_HALF_LENGTH = 52
const MEMBRANE_HALF_WIDTH = 27
const MAX_MEMBRANE_STEP_SECONDS = 1 / 60
// 每轮依次求解边长、隔点弯曲、面积和软径向目标，避免把膜锁成刚体。
const CONSTRAINT_ITERATIONS = 4

const normalizeAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle))

const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount

const distanceBetween = (from: Point, to: Point) => Math.hypot(to.x - from.x, to.y - from.y)

const rotateIntoWorld = (point: Point, center: Point, heading: number): Point => {
  const cosine = Math.cos(heading)
  const sine = Math.sin(heading)
  return {
    x: center.x + point.x * cosine - point.y * sine,
    y: center.y + point.x * sine + point.y * cosine,
  }
}

const getTargetRadius = (angle: number, elapsedMinutes: number, state: CellState, chirality: -1 | 1) => {
  const cosine = Math.cos(angle)
  const sine = Math.sin(angle)
  const ellipseRadius =
    (MEMBRANE_HALF_LENGTH * MEMBRANE_HALF_WIDTH) /
    Math.hypot(MEMBRANE_HALF_WIDTH * cosine, MEMBRANE_HALF_LENGTH * sine)
  const breathing = 1 + 0.035 * Math.sin(elapsedMinutes * 1.35)
  const membraneActivity =
    1 +
    0.026 * Math.sin(elapsedMinutes * 2.1 + angle * 3) +
    0.014 * Math.sin(elapsedMinutes * 0.83 - angle * 5)
  const turnLobe = state === 'turn' ? 1 + 0.075 * Math.max(Math.cos(angle - chirality * 0.68), 0) : 1
  return ellipseRadius * breathing * membraneActivity * turnLobe
}

const createMembraneTargets = (
  center: Point,
  heading: number,
  elapsedMinutes: number,
  state: CellState,
  chirality: -1 | 1,
) =>
  Array.from({ length: MEMBRANE_PARTICLE_COUNT }, (_, index) => {
    const angle = (index / MEMBRANE_PARTICLE_COUNT) * Math.PI * 2
    const radius = getTargetRadius(angle, elapsedMinutes, state, chirality)
    return rotateIntoWorld({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }, center, heading)
  })

const getRadialTargets = (
  particles: MembraneParticle[],
  center: Point,
  heading: number,
  elapsedMinutes: number,
  state: CellState,
  chirality: -1 | 1,
) =>
  particles.map((particle) => {
    const worldAngle = Math.atan2(particle.y - center.y, particle.x - center.x)
    const localAngle = normalizeAngle(worldAngle - heading)
    const radius = getTargetRadius(localAngle, elapsedMinutes, state, chirality)
    return {
      x: center.x + Math.cos(worldAngle) * radius,
      y: center.y + Math.sin(worldAngle) * radius,
    }
  })

export const getMembraneArea = (points: Point[]) => {
  if (points.length < 3) return 0
  let doubledArea = 0
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length]
    doubledArea += point.x * next.y - next.x * point.y
  })
  return Math.abs(doubledArea) / 2
}

const getCentroid = (points: Point[]) => {
  const total = points.reduce((centroid, point) => ({ x: centroid.x + point.x, y: centroid.y + point.y }), {
    x: 0,
    y: 0,
  })
  return { x: total.x / points.length, y: total.y / points.length }
}

const constrainDistance = (
  first: MembraneParticle,
  second: MembraneParticle,
  restLength: number,
  stiffness: number,
) => {
  const deltaX = second.x - first.x
  const deltaY = second.y - first.y
  const distance = Math.hypot(deltaX, deltaY) || 1
  const correction = ((distance - restLength) / distance) * stiffness * 0.5
  first.x += deltaX * correction
  first.y += deltaY * correction
  second.x -= deltaX * correction
  second.y -= deltaY * correction
}

const resolveMembraneSubstep = (membrane: CellMembrane, targets: Point[], dtSeconds: number) => {
  const previousPositions = membrane.particles.map(({ x, y }) => ({ x, y }))
  const velocityDamping = Math.exp(-dtSeconds * 7.5)
  const targetAcceleration = 25

  membrane.particles.forEach((particle, index) => {
    const target = targets[index]
    particle.velocityX =
      (particle.velocityX + (target.x - particle.x) * targetAcceleration * dtSeconds) * velocityDamping
    particle.velocityY =
      (particle.velocityY + (target.y - particle.y) * targetAcceleration * dtSeconds) * velocityDamping
    particle.x += particle.velocityX * dtSeconds
    particle.y += particle.velocityY * dtSeconds
  })

  const targetArea = getMembraneArea(targets)
  for (let iteration = 0; iteration < CONSTRAINT_ITERATIONS; iteration += 1) {
    membrane.particles.forEach((particle, index) => {
      const next = membrane.particles[(index + 1) % membrane.particles.length]
      constrainDistance(particle, next, membrane.restEdgeLengths[index], 0.44)
    })
    membrane.particles.forEach((particle, index) => {
      const nextNext = membrane.particles[(index + 2) % membrane.particles.length]
      constrainDistance(particle, nextNext, membrane.restBendLengths[index], 0.055)
    })

    const area = getMembraneArea(membrane.particles)
    if (area > 0 && targetArea > 0) {
      const centroid = getCentroid(membrane.particles)
      const scale = 1 + (Math.sqrt(targetArea / area) - 1) * 0.16
      membrane.particles.forEach((particle) => {
        particle.x = centroid.x + (particle.x - centroid.x) * scale
        particle.y = centroid.y + (particle.y - centroid.y) * scale
      })
    }

    const targetCorrection = 1 - Math.exp((-dtSeconds * 5.5) / CONSTRAINT_ITERATIONS)
    membrane.particles.forEach((particle, index) => {
      particle.x = lerp(particle.x, targets[index].x, targetCorrection)
      particle.y = lerp(particle.y, targets[index].y, targetCorrection)
    })
  }

  membrane.particles.forEach((particle, index) => {
    particle.velocityX = (particle.x - previousPositions[index].x) / dtSeconds
    particle.velocityY = (particle.y - previousPositions[index].y) / dtSeconds
  })
}

export const createCellMembrane = (center: Point, heading: number): CellMembrane => {
  const targets = createMembraneTargets(center, heading, 0, 'run', 1)
  const particles = targets.map((target) => ({
    ...target,
    velocityX: 0,
    velocityY: 0,
  }))
  return {
    particles,
    restArea: getMembraneArea(particles),
    restEdgeLengths: particles.map((particle, index) =>
      distanceBetween(particle, particles[(index + 1) % particles.length]),
    ),
    restBendLengths: particles.map((particle, index) =>
      distanceBetween(particle, particles[(index + 2) % particles.length]),
    ),
  }
}

export const resolveCellMembrane = (
  membrane: CellMembrane,
  center: Point,
  heading: number,
  elapsedMinutes: number,
  state: CellState,
  chirality: -1 | 1,
  dtSeconds: number,
) => {
  const safeDt = Math.max(dtSeconds, 0)
  if (safeDt === 0) return
  const substeps = Math.max(1, Math.ceil(safeDt / MAX_MEMBRANE_STEP_SECONDS))
  const substepSeconds = safeDt / substeps
  for (let step = 0; step < substeps; step += 1) {
    const targets = getRadialTargets(membrane.particles, center, heading, elapsedMinutes, state, chirality)
    resolveMembraneSubstep(membrane, targets, substepSeconds)
  }
}

export const createCellSkeleton = (center: Point, heading: number): CellSkeleton => {
  const head = {
    x: center.x + Math.cos(heading) * 34,
    y: center.y + Math.sin(heading) * 34,
  }

  return {
    joints: BASE_WIDTHS.map((_, index) => ({
      x: head.x - Math.cos(heading) * LINK_LENGTH * index,
      y: head.y - Math.sin(heading) * LINK_LENGTH * index,
    })),
  }
}

export const resolveCellSkeleton = (
  skeleton: CellSkeleton,
  center: Point,
  heading: number,
  dtSeconds: number,
) => {
  const headTarget = {
    x: center.x + Math.cos(heading) * 34,
    y: center.y + Math.sin(heading) * 34,
  }
  const headFollow = 1 - Math.exp(-Math.max(dtSeconds, 0) * 14)
  const head = skeleton.joints[0]
  head.x = lerp(head.x, headTarget.x, headFollow)
  head.y = lerp(head.y, headTarget.y, headFollow)

  let parentAngle = heading
  for (let index = 1; index < skeleton.joints.length; index += 1) {
    const previous = skeleton.joints[index - 1]
    const current = skeleton.joints[index]
    const currentAngle = Math.atan2(previous.y - current.y, previous.x - current.x)
    const bend = Math.max(
      -MAX_JOINT_BEND,
      Math.min(MAX_JOINT_BEND, normalizeAngle(currentAngle - parentAngle)),
    )
    const constrainedAngle = parentAngle + bend
    current.x = previous.x - Math.cos(constrainedAngle) * LINK_LENGTH
    current.y = previous.y - Math.sin(constrainedAngle) * LINK_LENGTH
    parentAngle = constrainedAngle
  }
}

const normalAt = (joints: Point[], index: number) => {
  const previous = joints[Math.max(0, index - 1)]
  const next = joints[Math.min(joints.length - 1, index + 1)]
  const tangentX = previous.x - next.x
  const tangentY = previous.y - next.y
  const length = Math.hypot(tangentX, tangentY) || 1
  return { x: -tangentY / length, y: tangentX / length }
}

export const offsetSkeleton = (skeleton: CellSkeleton, offset: number) =>
  skeleton.joints.map((joint, index) => {
    const normal = normalAt(skeleton.joints, index)
    return { x: joint.x + normal.x * offset, y: joint.y + normal.y * offset }
  })
