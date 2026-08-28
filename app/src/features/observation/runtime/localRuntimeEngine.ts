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
  type RunnerRotorCell,
} from '../model/runnerRotor'
import type { BootstrapData, ObservatoryRecord, SimulationFrame } from '../types'
import { LOCAL_RUNTIME_SCHEMA_VERSION, MAX_CELLS_PER_OBSERVATORY, type RuntimeSnapshot } from './runtimeTypes'

export const SIMULATION_DT_MINUTES = 0.1
const PALETTES = ['mint', 'amber', 'violet', 'cyan', 'rose']

export const createDefaultSnapshot = (): RuntimeSnapshot => ({
  algorithmVersion: RUNNER_ROTOR_ALGORITHM_VERSION,
  cells: [createRunnerRotorCell()],
  groups: [{ id: 'group-default', name: '默认组', sortOrder: 0 }],
  observatories: [
    {
      cameraX: 0,
      cameraY: 0,
      cameraZoom: 1,
      groupId: 'group-default',
      id: 'observatory-1',
      name: '观察台 01',
      palette: 'mint',
      params: { ...MCF10A_COLLAGEN },
      paused: false,
      simulatedMinutes: 0,
      tick: 0,
    },
  ],
  schemaVersion: LOCAL_RUNTIME_SCHEMA_VERSION,
  updatedAt: new Date().toISOString(),
})

const cloneBootstrap = (snapshot: RuntimeSnapshot): BootstrapData => ({
  cells: structuredClone(snapshot.cells),
  groups: structuredClone(snapshot.groups),
  observatories: structuredClone(snapshot.observatories),
})

export class LocalRuntimeEngine {
  private readonly snapshot: RuntimeSnapshot

  constructor(snapshot: RuntimeSnapshot) {
    this.snapshot = snapshot
  }

  getBootstrap() {
    return cloneBootstrap(this.snapshot)
  }

  getSnapshot() {
    this.snapshot.updatedAt = new Date().toISOString()
    return structuredClone(this.snapshot)
  }

  createObservatory(groupId: string) {
    if (!this.snapshot.groups.some((group) => group.id === groupId)) throw new Error('观察台分组不存在')
    const sequence = this.snapshot.observatories.length + 1
    const observatory: ObservatoryRecord = {
      cameraX: 0,
      cameraY: 0,
      cameraZoom: 1,
      groupId,
      id: `observatory-${crypto.randomUUID()}`,
      name: `观察台 ${String(sequence).padStart(2, '0')}`,
      palette: PALETTES[(sequence - 1) % PALETTES.length],
      params: { ...MCF10A_COLLAGEN },
      paused: false,
      simulatedMinutes: 0,
      tick: 0,
    }
    this.snapshot.observatories.push(observatory)
    return structuredClone(observatory)
  }

  addCell(observatoryId: string) {
    const observatory = this.requireObservatory(observatoryId)
    const existing = this.snapshot.cells.filter((cell) => cell.observatoryId === observatoryId)
    if (existing.length >= MAX_CELLS_PER_OBSERVATORY) throw new Error('观察台已达到 500 个细胞上限')
    const seed = crypto.getRandomValues(new Uint32Array(1))[0]
    const initializer = createRunnerRotorCell({ observatoryId, seed })
    const heading = nextRandom(initializer) * Math.PI * 2 - Math.PI
    const radius = Math.sqrt(nextRandom(initializer)) * Math.sqrt(existing.length + 1) * 12
    const angle = nextRandom(initializer) * Math.PI * 2
    const cell = createRunnerRotorCell({
      heading,
      id: `cell-${crypto.randomUUID()}`,
      observatoryId: observatory.id,
      seed,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    })
    this.snapshot.cells.push(cell)
    return { id: cell.id, observatoryId }
  }

  updateObservatory(
    observatoryId: string,
    update: { params?: ObservatoryRecord['params']; paused?: boolean },
  ) {
    const observatory = this.requireObservatory(observatoryId)
    if (update.params) observatory.params = structuredClone(update.params)
    if (update.paused !== undefined) observatory.paused = update.paused
  }

  advance() {
    const frames: SimulationFrame[] = []
    for (const observatory of this.snapshot.observatories) {
      if (observatory.paused) continue
      const cells = this.snapshot.cells.filter((cell) => cell.observatoryId === observatory.id)
      for (const cell of cells) stepRunnerRotor(cell, observatory.params, SIMULATION_DT_MINUTES)
      observatory.tick += 1
      observatory.simulatedMinutes = observatory.tick * SIMULATION_DT_MINUTES
      frames.push({
        cells: cells.map(
          ({ rngState: _rngState, seed: _seed, observatoryId: _observatoryId, ...cell }) => cell,
        ),
        observatoryId: observatory.id,
        simulatedMinutes: observatory.simulatedMinutes,
        tick: observatory.tick,
      })
    }
    return frames
  }

  private requireObservatory(observatoryId: string) {
    const observatory = this.snapshot.observatories.find((candidate) => candidate.id === observatoryId)
    if (!observatory) throw new Error('观察台不存在')
    return observatory
  }
}

export const cloneCell = (cell: RunnerRotorCell) => structuredClone(cell)
