import type { CellParams, CellState } from './model/runnerRotor'

export interface CellScientificFrame {
  chirality: -1 | 1
  elapsedMinutes: number
  heading: number
  id: string
  state: CellState
  stateElapsedMinutes: number
  x: number
  y: number
}

export interface SimulationFrame {
  cells: CellScientificFrame[]
  observatoryId: string
  simulatedMinutes: number
  tick: number
}

export interface ObservatoryRecord {
  cameraX: number
  cameraY: number
  cameraZoom: number
  drRun?: number
  drTurn?: number
  groupId: string
  id: string
  name: string
  omegaTurn?: number
  palette: string
  params?: CellParams
  paused: boolean
  simulatedMinutes: number
  tauRun?: number
  tauTurn?: number
  tick: number
  vRun?: number
  vTurn?: number
}

export interface BootstrapData {
  cells: Array<CellScientificFrame & { observatoryId: string; seed: number }>
  groups: Array<{ id: string; name: string; sortOrder: number }>
  observatories: ObservatoryRecord[]
}

export interface BatchExportOptions {
  cellCount: number
  dtMinutes: number
  durationMinutes: number
  seed: number
}

export interface BatchExportResult {
  files: Array<{ filename: string; url: string }>
  manifest: BatchExportOptions & { model: string; stepCount: number }
}
