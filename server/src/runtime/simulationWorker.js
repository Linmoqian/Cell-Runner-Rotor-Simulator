import { parentPort } from 'node:worker_threads'
import { createCell, MCF10A_COLLAGEN, stepCell, toCellFrame } from '../domain/runnerRotor.js'

const WALL_TICK_MS = 20
const SIMULATION_MINUTES_PER_SECOND = 5
const DT_MINUTES = (WALL_TICK_MS / 1000) * SIMULATION_MINUTES_PER_SECOND
const FRAME_EVERY_TICKS = 3
const PERSIST_EVERY_TICKS = 15
const observatories = new Map()

function emitFrame(observatory, type) {
  const cells = [...observatory.cells.values()].map((cell) => ({
    ...toCellFrame(cell),
    ...(type === 'persist' ? { rngState: cell.rngState } : {}),
  }))
  parentPort.postMessage({
    type,
    frame: {
      cells,
      observatoryId: observatory.id,
      simulatedMinutes: observatory.simulatedMinutes,
      tick: observatory.tick,
    },
  })
}

function advance() {
  for (const observatory of observatories.values()) {
    if (observatory.paused) continue
    for (const cell of observatory.cells.values()) stepCell(cell, observatory.params, DT_MINUTES)
    observatory.tick += 1
    observatory.simulatedMinutes += DT_MINUTES
    if (observatory.tick % FRAME_EVERY_TICKS === 0) emitFrame(observatory, 'frame')
    if (observatory.tick % PERSIST_EVERY_TICKS === 0) emitFrame(observatory, 'persist')
  }
}

function hydrateCell(record) {
  return {
    ...createCell(record),
    chirality: record.chirality ?? 1,
    elapsedMinutes: record.elapsedMinutes ?? 0,
    rngState: record.rngState ?? record.seed,
    state: record.state ?? 'run',
    stateElapsedMinutes: record.stateElapsedMinutes ?? 0,
  }
}

function handleCommand(message) {
  const { command, payload, requestId } = message
  if (command === 'upsertObservatory') {
    observatories.set(payload.id, {
      cells: new Map(payload.cells.map((cell) => [cell.id, hydrateCell(cell)])),
      id: payload.id,
      params: { ...MCF10A_COLLAGEN, ...payload.params },
      paused: payload.paused ?? false,
      simulatedMinutes: payload.simulatedMinutes ?? 0,
      tick: payload.tick ?? 0,
    })
  } else if (command === 'addCell') {
    observatories.get(payload.observatoryId)?.cells.set(payload.id, hydrateCell(payload))
  } else if (command === 'setPaused') {
    const observatory = observatories.get(payload.observatoryId)
    if (observatory) observatory.paused = payload.paused
  } else if (command === 'setParams') {
    const observatory = observatories.get(payload.observatoryId)
    if (observatory) observatory.params = { ...observatory.params, ...payload.params }
  } else if (command === 'reset') {
    const observatory = observatories.get(payload.observatoryId)
    if (observatory) {
      observatory.tick = 0
      observatory.simulatedMinutes = 0
      observatory.cells = new Map(
        payload.cells.map((cell) => [cell.id, hydrateCell(cell)]),
      )
      emitFrame(observatory, 'frame')
      emitFrame(observatory, 'persist')
    }
  }
  parentPort.postMessage({ requestId, type: 'ack' })
}

parentPort.on('message', handleCommand)
const timer = setInterval(advance, WALL_TICK_MS)
timer.unref()
parentPort.postMessage({ type: 'ready' })
