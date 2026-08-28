/**
 * Created on 2026-08-28, updated on 2026-08-28
 * @author: https://github.com/Linmoqian
 */

import type { CellParams } from '../model/runnerRotor'
import type { BatchExportOptions, BootstrapData, SimulationFrame } from '../types'

export const LOCAL_RUNTIME_SCHEMA_VERSION = 1
export const MAX_CELLS_PER_OBSERVATORY = 500

export interface RuntimeSnapshot extends BootstrapData {
  algorithmVersion: string
  schemaVersion: number
  updatedAt: string
}

export type RuntimeCommand =
  | { type: 'initialize' }
  | { type: 'getBootstrap' }
  | { type: 'addCell'; observatoryId: string }
  | { type: 'createObservatory'; groupId: string }
  | { type: 'updateObservatory'; observatoryId: string; update: { params?: CellParams; paused?: boolean } }
  | { type: 'exportBatch'; options: BatchExportOptions }
  | { type: 'persist' }
  | { type: 'clearLocalData' }
  | { type: 'close' }

export interface RuntimeRequest {
  command: RuntimeCommand
  requestId: number
}

export type RuntimeEvent =
  | { type: 'frame'; frame: SimulationFrame }
  | { type: 'response'; requestId: number; result?: unknown; error?: string }
