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
  state: CellState
  stateElapsedMinutes: number
  x: number
  y: number
}

export type RandomSource = () => number

// Table I supplies the angular and timing values. The article reports vRun in
// the Results; vTurn is a visual default because no mean turn speed is tabulated.
export const MCF10A_COLLAGEN: CellParams = {
  drRun: 0.005,
  drTurn: 0.031,
  omegaTurn: 0.16,
  tauRun: 29.9,
  tauTurn: 8.2,
  vRun: 0.39,
  vTurn: 0.32,
}

export const createRunnerRotorCell = (overrides: Partial<RunnerRotorCell> = {}): RunnerRotorCell => ({
  chirality: 1,
  elapsedMinutes: 0,
  heading: -0.18,
  state: 'run',
  stateElapsedMinutes: 0,
  x: 0,
  y: 0,
  ...overrides,
})

export const switchProbability = (dtMinutes: number, meanDurationMinutes: number) => {
  if (dtMinutes <= 0) return 0
  if (meanDurationMinutes <= 0) return 1
  return 1 - Math.exp(-dtMinutes / meanDurationMinutes)
}

const sampleStandardNormal = (random: RandomSource) => {
  const firstUniform = Math.max(random(), Number.EPSILON)
  const secondUniform = random()
  return Math.sqrt(-2 * Math.log(firstUniform)) * Math.cos(2 * Math.PI * secondUniform)
}

const normalizeAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle))

export const stepRunnerRotor = (
  cell: RunnerRotorCell,
  params: CellParams,
  dtMinutes: number,
  random: RandomSource = Math.random,
): RunnerRotorCell => {
  if (dtMinutes <= 0) return cell

  const meanDuration = cell.state === 'run' ? params.tauRun : params.tauTurn
  const switchesState = random() < switchProbability(dtMinutes, meanDuration)
  const state: CellState = switchesState ? (cell.state === 'run' ? 'turn' : 'run') : cell.state
  const chirality = cell.state === 'run' && state === 'turn' ? (random() < 0.5 ? -1 : 1) : cell.chirality
  const rotationalDiffusion = state === 'run' ? params.drRun : params.drTurn
  const deterministicTurn = state === 'turn' ? chirality * params.omegaTurn * dtMinutes : 0
  const angularNoise = Math.sqrt(2 * rotationalDiffusion * dtMinutes) * sampleStandardNormal(random)
  const heading = normalizeAngle(cell.heading + deterministicTurn + angularNoise)
  const speed = state === 'run' ? params.vRun : params.vTurn

  return {
    chirality,
    elapsedMinutes: cell.elapsedMinutes + dtMinutes,
    heading,
    state,
    stateElapsedMinutes: switchesState ? dtMinutes : cell.stateElapsedMinutes + dtMinutes,
    x: cell.x + speed * Math.cos(heading) * dtMinutes,
    y: cell.y + speed * Math.sin(heading) * dtMinutes,
  }
}
