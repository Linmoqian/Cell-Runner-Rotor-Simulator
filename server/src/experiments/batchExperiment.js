import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createCell, MCF10A_COLLAGEN, nextRandom, stepCell } from '../domain/runnerRotor.js'

export const DEFAULT_EXPERIMENT = Object.freeze({
  cellCount: 32,
  dtMinutes: 0.1,
  durationMinutes: 240,
  seed: 20260810,
})

function normalizeAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle))
}

function csvValue(value) {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function toCsv(columns, rows) {
  return [columns, ...rows].map((row) => row.map(csvValue).join(',')).join('\n').concat('\n')
}

function validateExperiment(options) {
  for (const key of ['cellCount', 'dtMinutes', 'durationMinutes', 'seed']) {
    if (!Number.isFinite(options[key])) throw invalidExperiment(`${key} 必须是有限数字`)
  }
  if (!Number.isInteger(options.cellCount) || options.cellCount < 1) throw invalidExperiment('cellCount 必须是正整数')
  if (options.dtMinutes <= 0 || options.durationMinutes <= 0) throw invalidExperiment('时间步长与时长必须大于 0')
  if (!Number.isInteger(options.seed) || options.seed < 0 || options.seed > 0xffffffff) {
    throw invalidExperiment('seed 必须是 0 到 4294967295 的整数')
  }
}

function invalidExperiment(message) {
  return Object.assign(new Error(message), { code: 'INVALID_EXPERIMENT' })
}

function createInitialCell(index, seed) {
  const initializer = createCell({ id: `initializer-${index}`, observatoryId: 'batch', seed: (seed + index) >>> 0 })
  const heading = nextRandom(initializer) * Math.PI * 2 - Math.PI
  const radius = Math.sqrt(nextRandom(initializer)) * Math.sqrt(index + 1) * 12
  const angle = nextRandom(initializer) * Math.PI * 2
  return createCell({
    heading,
    id: `cell-${String(index + 1).padStart(4, '0')}`,
    observatoryId: 'batch',
    seed: (seed + index) >>> 0,
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  })
}

export function runBatchExperiment(overrides = {}) {
  const definedOverrides = Object.fromEntries(
    Object.entries(overrides).filter(([, value]) => value !== undefined),
  )
  const options = { ...DEFAULT_EXPERIMENT, ...definedOverrides }
  validateExperiment(options)
  const stepCount = Math.round(options.durationMinutes / options.dtMinutes)
  const durationMinutes = stepCount * options.dtMinutes
  const cells = Array.from({ length: options.cellCount }, (_, index) => createInitialCell(index, options.seed))
  const trajectories = []
  const turningAngles = []
  const residenceTimes = []
  const residenceStarts = new Map(cells.map((cell) => [cell.id, { state: cell.state, startMinutes: 0 }]))

  for (const cell of cells) {
    trajectories.push([cell.id, 0, 0, cell.x, cell.y, cell.heading, cell.state, cell.chirality])
  }

  for (let step = 1; step <= stepCount; step += 1) {
    const simulatedMinutes = step * options.dtMinutes
    const stepStartMinutes = simulatedMinutes - options.dtMinutes
    for (const cell of cells) {
      const previousHeading = cell.heading
      const previousState = cell.state
      stepCell(cell, MCF10A_COLLAGEN, options.dtMinutes)
      const turningAngle = normalizeAngle(cell.heading - previousHeading)
      trajectories.push([cell.id, step, simulatedMinutes, cell.x, cell.y, cell.heading, cell.state, cell.chirality])
      turningAngles.push([cell.id, step, simulatedMinutes, turningAngle, cell.state])

      if (cell.state !== previousState) {
        const residence = residenceStarts.get(cell.id)
        residenceTimes.push([cell.id, residence.state, residence.startMinutes, stepStartMinutes, stepStartMinutes - residence.startMinutes])
        residenceStarts.set(cell.id, { state: cell.state, startMinutes: stepStartMinutes })
      }
    }
  }

  for (const cell of cells) {
    const residence = residenceStarts.get(cell.id)
    residenceTimes.push([cell.id, residence.state, residence.startMinutes, durationMinutes, durationMinutes - residence.startMinutes])
  }

  return {
    manifest: {
      cellCount: options.cellCount,
      dtMinutes: options.dtMinutes,
      durationMinutes,
      model: 'runner-rotor',
      modelParameters: MCF10A_COLLAGEN,
      seed: options.seed,
      stepCount,
    },
    residenceTimes,
    trajectories,
    turningAngles,
  }
}

export async function exportBatchExperiment(outputDirectory, overrides = {}) {
  const result = runBatchExperiment(overrides)
  await mkdir(outputDirectory, { recursive: true })
  await Promise.all([
    writeFile(join(outputDirectory, 'manifest.json'), `${JSON.stringify(result.manifest, null, 2)}\n`, 'utf8'),
    writeFile(join(outputDirectory, 'trajectories.csv'), toCsv(
      ['cell_id', 'step', 'simulated_minutes', 'x', 'y', 'heading_radians', 'state', 'chirality'],
      result.trajectories,
    ), 'utf8'),
    writeFile(join(outputDirectory, 'turning_angles.csv'), toCsv(
      ['cell_id', 'step', 'simulated_minutes', 'turning_angle_radians', 'state'],
      result.turningAngles,
    ), 'utf8'),
    writeFile(join(outputDirectory, 'state_residence_times.csv'), toCsv(
      ['cell_id', 'state', 'start_minutes', 'end_minutes', 'residence_minutes'],
      result.residenceTimes,
    ), 'utf8'),
  ])
  return result.manifest
}
