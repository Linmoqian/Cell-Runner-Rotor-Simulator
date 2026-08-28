/**
 * Created on 2026-08-28, updated on 2026-08-28
 * @author: https://github.com/Linmoqian
 */

import {
  createRunnerRotorCell,
  MCF10A_COLLAGEN,
  nextRandom,
  RUNNER_ROTOR_ALGORITHM_VERSION,
  stepRunnerRotor,
} from '../model/runnerRotor'
import type { BatchExportOptions } from '../types'

const csvValue = (value: unknown) => {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}
const toCsv = (columns: unknown[], rows: unknown[][]) =>
  [columns, ...rows]
    .map((row) => row.map(csvValue).join(','))
    .join('\n')
    .concat('\n')
const normalizeAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle))
const MAX_BATCH_RECORDS = 2_000_000

const validate = (options: BatchExportOptions) => {
  if (!Number.isInteger(options.cellCount) || options.cellCount < 1 || options.cellCount > 500)
    throw new Error('细胞数必须是 1 到 500 的整数')
  if (!Number.isFinite(options.dtMinutes) || options.dtMinutes <= 0) throw new Error('时间步必须是正数')
  if (!Number.isFinite(options.durationMinutes) || options.durationMinutes <= 0)
    throw new Error('实验时长必须是正数')
  if (!Number.isInteger(options.seed) || options.seed < 0 || options.seed > 0xffffffff)
    throw new Error('随机种子必须是 32 位无符号整数')
  const stepCount = Math.round(options.durationMinutes / options.dtMinutes)
  if (stepCount * options.cellCount > MAX_BATCH_RECORDS) {
    throw new Error('批处理规模过大；细胞数乘以时间步数不能超过 2000000')
  }
}

const hashText = async (text: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function createInitialCells(options: BatchExportOptions) {
  return Array.from({ length: options.cellCount }, (_, index) => {
    const seed = (options.seed + index) >>> 0
    const initializer = createRunnerRotorCell({ id: `initializer-${index}`, observatoryId: 'batch', seed })
    const heading = nextRandom(initializer) * Math.PI * 2 - Math.PI
    const radius = Math.sqrt(nextRandom(initializer)) * Math.sqrt(index + 1) * 12
    const angle = nextRandom(initializer) * Math.PI * 2
    return createRunnerRotorCell({
      heading,
      id: `cell-${String(index + 1).padStart(4, '0')}`,
      observatoryId: 'batch',
      seed,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    })
  })
}

function simulate(options: BatchExportOptions) {
  const stepCount = Math.round(options.durationMinutes / options.dtMinutes)
  const durationMinutes = stepCount * options.dtMinutes
  const cells = createInitialCells(options)
  const trajectories: unknown[][] = cells.map((cell) => [
    cell.id,
    0,
    0,
    cell.x,
    cell.y,
    cell.heading,
    cell.state,
    cell.chirality,
  ])
  const turningAngles: unknown[][] = []
  const residenceTimes: unknown[][] = []
  const starts = new Map(cells.map((cell) => [cell.id, { state: cell.state, startMinutes: 0 }]))
  for (let step = 1; step <= stepCount; step += 1) {
    const simulatedMinutes = step * options.dtMinutes
    for (const cell of cells) {
      const previousHeading = cell.heading
      const previousState = cell.state
      stepRunnerRotor(cell, MCF10A_COLLAGEN, options.dtMinutes)
      trajectories.push([
        cell.id,
        step,
        simulatedMinutes,
        cell.x,
        cell.y,
        cell.heading,
        cell.state,
        cell.chirality,
      ])
      turningAngles.push([
        cell.id,
        step,
        simulatedMinutes,
        normalizeAngle(cell.heading - previousHeading),
        cell.state,
      ])
      if (cell.state !== previousState) {
        const residence = starts.get(cell.id)!
        const end = simulatedMinutes - options.dtMinutes
        residenceTimes.push([
          cell.id,
          residence.state,
          residence.startMinutes,
          end,
          end - residence.startMinutes,
        ])
        starts.set(cell.id, { state: cell.state, startMinutes: end })
      }
    }
  }
  for (const cell of cells) {
    const residence = starts.get(cell.id)!
    residenceTimes.push([
      cell.id,
      residence.state,
      residence.startMinutes,
      durationMinutes,
      durationMinutes - residence.startMinutes,
    ])
  }
  return { durationMinutes, residenceTimes, stepCount, trajectories, turningAngles }
}

export async function runLocalBatchExperiment(options: BatchExportOptions) {
  validate(options)
  const { durationMinutes, residenceTimes, stepCount, trajectories, turningAngles } = simulate(options)
  const texts: Record<string, string> = {
    'trajectories.csv': toCsv(
      ['cell_id', 'step', 'simulated_minutes', 'x', 'y', 'heading_radians', 'state', 'chirality'],
      trajectories,
    ),
    'turning_angles.csv': toCsv(
      ['cell_id', 'step', 'simulated_minutes', 'turning_angle_radians', 'state'],
      turningAngles,
    ),
    'state_residence_times.csv': toCsv(
      ['cell_id', 'state', 'start_minutes', 'end_minutes', 'residence_minutes'],
      residenceTimes,
    ),
  }
  const sha256 = Object.fromEntries(
    await Promise.all(Object.entries(texts).map(async ([name, text]) => [name, await hashText(text)])),
  )
  const manifest = {
    ...options,
    algorithmVersion: RUNNER_ROTOR_ALGORITHM_VERSION,
    durationMinutes,
    generatedLocally: true as const,
    model: 'runner-rotor',
    modelParameters: MCF10A_COLLAGEN,
    sha256,
    stepCount,
  }
  texts['manifest.json'] = `${JSON.stringify(manifest, null, 2)}\n`
  return { manifest, texts }
}
