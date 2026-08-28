/**
 * Created on 2026-08-10, updated on 2026-08-28
 * @author: https://github.com/Linmoqian
 */

import type { CellParams } from '../model/runnerRotor'
import { getLocalSimulationClient } from '../runtime/localSimulationClient'
import type { BatchExportOptions, BatchExportResult, BootstrapData, SimulationFrame } from '../types'

interface TauriGlobal {
  core: { invoke: <T>(command: string, args?: Record<string, unknown>) => Promise<T> }
  event: { listen: <T>(event: string, listener: (event: { payload: T }) => void) => Promise<() => void> }
}

declare global {
  interface Window {
    __TAURI__?: TauriGlobal
  }
}

const getTauri = () => window.__TAURI__

export async function getBootstrap(): Promise<BootstrapData> {
  const tauri = getTauri()
  return tauri ? tauri.core.invoke<BootstrapData>('get_bootstrap') : getLocalSimulationClient().getBootstrap()
}

export async function addCell(observatoryId: string) {
  const tauri = getTauri()
  if (tauri)
    return tauri.core.invoke<{ id: string; observatoryId: string }>('add_cell', {
      request: { observatoryId },
    })
  return getLocalSimulationClient().addCell(observatoryId)
}

export async function createObservatory(groupId: string) {
  const tauri = getTauri()
  if (tauri)
    return tauri.core.invoke<BootstrapData['observatories'][number]>('create_observatory', { groupId })
  return getLocalSimulationClient().createObservatory(groupId)
}

export async function updateObservatory(
  observatoryId: string,
  update: { params?: CellParams; paused?: boolean },
) {
  const tauri = getTauri()
  if (tauri) return tauri.core.invoke('update_observatory', { observatoryId, update })
  return getLocalSimulationClient().updateObservatory(observatoryId, update)
}

export async function exportBatchExperiment(options: BatchExportOptions): Promise<BatchExportResult> {
  if (getTauri()) throw new Error('批量导出暂仅支持 Web 本地运行时')
  return getLocalSimulationClient().exportBatch(options)
}

export async function clearLocalSimulationData() {
  if (getTauri()) throw new Error('桌面运行时数据不属于浏览器本地存储')
  await getLocalSimulationClient().clearLocalData()
}

export function subscribeToFrames(
  observatoryId: string,
  onFrame: (frame: SimulationFrame) => void,
  onError?: () => void,
) {
  const tauri = getTauri()
  if (!tauri) return getLocalSimulationClient().subscribe(observatoryId, onFrame, onError)
  let disposed = false
  let unlisten: (() => void) | undefined
  void tauri.event
    .listen<SimulationFrame>('simulation://frame', ({ payload }) => {
      if (payload.observatoryId === observatoryId) onFrame(payload)
    })
    .then((dispose) => (disposed ? dispose() : (unlisten = dispose)))
    .catch(() => onError?.())
  return () => {
    disposed = true
    unlisten?.()
  }
}
