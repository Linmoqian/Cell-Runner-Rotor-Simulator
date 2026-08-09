export const MCF10A_COLLAGEN = Object.freeze({
  drRun: 0.005,
  drTurn: 0.031,
  omegaTurn: 0.16,
  tauRun: 29.9,
  tauTurn: 8.2,
  vRun: 0.39,
  vTurn: 0.32,
})

export function createCell({ heading = -0.18, id, observatoryId, seed, x = 0, y = 0 }) {
  return {
    chirality: 1,
    elapsedMinutes: 0,
    heading,
    id,
    observatoryId,
    rngState: seed >>> 0,
    state: 'run',
    stateElapsedMinutes: 0,
    x,
    y,
  }
}

export function nextRandom(cell) {
  cell.rngState = (cell.rngState + 0x6d2b79f5) >>> 0
  let value = cell.rngState
  value = Math.imul(value ^ (value >>> 15), value | 1)
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296
}

export function switchProbability(dtMinutes, meanDurationMinutes) {
  if (dtMinutes <= 0) return 0
  if (meanDurationMinutes <= 0) return 1
  return 1 - Math.exp(-dtMinutes / meanDurationMinutes)
}

function standardNormal(cell) {
  const first = Math.max(nextRandom(cell), Number.EPSILON)
  const second = nextRandom(cell)
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second)
}

function normalizeAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle))
}

export function stepCell(cell, params, dtMinutes) {
  if (dtMinutes <= 0) return cell

  const meanDuration = cell.state === 'run' ? params.tauRun : params.tauTurn
  const switchesState = nextRandom(cell) < switchProbability(dtMinutes, meanDuration)
  const state = switchesState ? (cell.state === 'run' ? 'turn' : 'run') : cell.state
  if (cell.state === 'run' && state === 'turn') cell.chirality = nextRandom(cell) < 0.5 ? -1 : 1

  const diffusion = state === 'run' ? params.drRun : params.drTurn
  const turn = state === 'turn' ? cell.chirality * params.omegaTurn * dtMinutes : 0
  const noise = Math.sqrt(2 * diffusion * dtMinutes) * standardNormal(cell)
  cell.heading = normalizeAngle(cell.heading + turn + noise)
  cell.state = state
  cell.stateElapsedMinutes = switchesState ? dtMinutes : cell.stateElapsedMinutes + dtMinutes
  cell.elapsedMinutes += dtMinutes

  const speed = state === 'run' ? params.vRun : params.vTurn
  cell.x += speed * Math.cos(cell.heading) * dtMinutes
  cell.y += speed * Math.sin(cell.heading) * dtMinutes
  return cell
}

export function toCellFrame(cell) {
  return {
    chirality: cell.chirality,
    elapsedMinutes: cell.elapsedMinutes,
    heading: cell.heading,
    id: cell.id,
    state: cell.state,
    stateElapsedMinutes: cell.stateElapsedMinutes,
    x: cell.x,
    y: cell.y,
  }
}
