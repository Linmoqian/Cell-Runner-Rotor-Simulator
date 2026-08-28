/**
 * Created on 2026-08-10, updated on 2026-08-28
 * @author: https://github.com/Linmoqian
 */

export type CellState = 'run' | 'turn'

export interface CellParams {
  drRun: number
  drTurn: number
  omegaTurn: number
  tauRun: number
  tauTurn: number
  vRun: number
  vTurn: number
}

export interface RunnerRotorCell {
  chirality: -1 | 1
  elapsedMinutes: number
  heading: number
  id: string
  observatoryId: string
  rngState: number
  seed: number
  state: CellState
  stateElapsedMinutes: number
  x: number
  y: number
}

export const RUNNER_ROTOR_ALGORITHM_VERSION = 'runner-rotor-v1'
// Table I supplies angular and timing values. The paper reports vRun in Results;
// vTurn remains the established visual default because no mean turn speed is tabulated.
export const MCF10A_COLLAGEN: CellParams = {
  drRun: 0.005,
  drTurn: 0.031,
  omegaTurn: 0.16,
  tauRun: 29.9,
  tauTurn: 8.2,
  vRun: 0.39,
  vTurn: 0.32,
}

export const createRunnerRotorCell = (overrides: Partial<RunnerRotorCell> = {}): RunnerRotorCell => {
  const seed = overrides.seed ?? overrides.rngState ?? 1
  return {
    chirality: 1,
    elapsedMinutes: 0,
    heading: -0.18,
    id: 'cell-1',
    observatoryId: 'observatory-1',
    rngState: seed >>> 0,
    seed: seed >>> 0,
    state: 'run',
    stateElapsedMinutes: 0,
    x: 0,
    y: 0,
    ...overrides,
  }
}

export const nextRandom = (cell: RunnerRotorCell) => {
  cell.rngState = (cell.rngState + 0x6d2b79f5) >>> 0
  let value = cell.rngState
  value = Math.imul(value ^ (value >>> 15), value | 1)
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296
}

export const switchProbability = (dtMinutes: number, meanDurationMinutes: number) => {
  if (dtMinutes <= 0) return 0
  if (meanDurationMinutes <= 0) return 1
  return 1 - Math.exp(-dtMinutes / meanDurationMinutes)
}

const sampleStandardNormal = (cell: RunnerRotorCell) => {
  const firstUniform = Math.max(nextRandom(cell), Number.EPSILON)
  const secondUniform = nextRandom(cell)
  return Math.sqrt(-2 * Math.log(firstUniform)) * Math.cos(2 * Math.PI * secondUniform)
}

const normalizeAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle))

export const stepRunnerRotor = (cell: RunnerRotorCell, params: CellParams, dtMinutes: number) => {
  if (dtMinutes <= 0) return cell
  const previousState = cell.state
  const meanDuration = previousState === 'run' ? params.tauRun : params.tauTurn
  const switchesState = nextRandom(cell) < switchProbability(dtMinutes, meanDuration)
  if (switchesState) cell.state = previousState === 'run' ? 'turn' : 'run'
  if (previousState === 'run' && cell.state === 'turn') cell.chirality = nextRandom(cell) < 0.5 ? -1 : 1
  const diffusion = cell.state === 'run' ? params.drRun : params.drTurn
  const turn = cell.state === 'turn' ? cell.chirality * params.omegaTurn * dtMinutes : 0
  const noise = Math.sqrt(2 * diffusion * dtMinutes) * sampleStandardNormal(cell)
  cell.heading = normalizeAngle(cell.heading + turn + noise)
  cell.stateElapsedMinutes = switchesState ? dtMinutes : cell.stateElapsedMinutes + dtMinutes
  cell.elapsedMinutes += dtMinutes
  const speed = cell.state === 'run' ? params.vRun : params.vTurn
  cell.x += speed * Math.cos(cell.heading) * dtMinutes
  cell.y += speed * Math.sin(cell.heading) * dtMinutes
  return cell
}
