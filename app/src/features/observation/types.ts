/**
 * Created on 2026-08-10, updated on 2026-08-28
 * @author: https://github.com/Linmoqian
 */

import type { CellParams, CellState, RunnerRotorCell } from './model/runnerRotor'

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
  groupId: string
  id: string
  name: string
  palette: string
  params: CellParams
  paused: boolean
  simulatedMinutes: number
  tick: number
}

export interface BootstrapData {
  cells: RunnerRotorCell[]
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
  manifest: BatchExportOptions & {
    algorithmVersion: string
    generatedLocally: true
    model: string
    modelParameters: CellParams
    sha256: Record<string, string>
    stepCount: number
  }
}
