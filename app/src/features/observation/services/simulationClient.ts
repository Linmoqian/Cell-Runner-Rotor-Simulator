import type { BatchExportOptions, BatchExportResult, BootstrapData, SimulationFrame } from '../types'
import type { CellParams } from '../model/runnerRotor'

interface TauriGlobal {
  core: {
    invoke: <T>(command: string, args?: Record<string, unknown>) => Promise<T>
  }
  event: {
    listen: <T>(event: string, listener: (event: { payload: T }) => void) => Promise<() => void>
  }
}

declare global {
  interface Window {
    __TAURI__?: TauriGlobal
  }
}

const getTauri = () => window.__TAURI__

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: { message?: string } }
  if (!response.ok) throw new Error(payload.error?.message ?? `请求失败：${response.status}`)
  return payload
}

export async function getBootstrap(): Promise<BootstrapData> {
  const tauri = getTauri()
  if (tauri) return tauri.core.invoke<BootstrapData>('get_bootstrap')
  return readJson<BootstrapData>(await fetch('/api/v1/bootstrap'))
}

export async function addCell(observatoryId: string) {
  const tauri = getTauri()
  const request = { observatoryId }
  if (tauri) return tauri.core.invoke<{ id: string; observatoryId: string }>('add_cell', { request })
  return readJson<{ cell: { id: string; observatoryId: string } }>(
    await fetch(`/api/v1/observatories/${encodeURIComponent(observatoryId)}/cells`, {
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    }),
  )
}

export async function createObservatory(groupId: string) {
  const tauri = getTauri()
  if (tauri)
    return tauri.core.invoke<BootstrapData['observatories'][number]>('create_observatory', { groupId })
  const result = await readJson<{ observatory: BootstrapData['observatories'][number] }>(
    await fetch('/api/v1/observatories', {
      body: JSON.stringify({ groupId }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    }),
  )
  return result.observatory
}

export async function updateObservatory(
  observatoryId: string,
  update: { params?: CellParams; paused?: boolean },
) {
  const tauri = getTauri()
  if (tauri) return tauri.core.invoke('update_observatory', { observatoryId, update })
  return readJson(
    await fetch(`/api/v1/observatories/${encodeURIComponent(observatoryId)}`, {
      body: JSON.stringify(update),
      headers: { 'Content-Type': 'application/json' },
      method: 'PATCH',
    }),
  )
}

export async function exportBatchExperiment(options: BatchExportOptions): Promise<BatchExportResult> {
  if (getTauri()) throw new Error('批量导出暂仅支持 Web 运行时')
  return readJson<BatchExportResult>(
    await fetch('/api/v1/experiments/batch', {
      body: JSON.stringify(options),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    }),
  )
}

export function subscribeToFrames(
  observatoryId: string,
  onFrame: (frame: SimulationFrame) => void,
  onError?: () => void,
) {
  const tauri = getTauri()
  if (tauri) {
    let disposed = false
    let unlisten: (() => void) | undefined
    void tauri.event
      .listen<SimulationFrame>('simulation://frame', ({ payload }) => {
        if (payload.observatoryId === observatoryId) onFrame(payload)
      })
      .then((dispose) => {
        if (disposed) dispose()
        else unlisten = dispose
      })
      .catch(() => onError?.())
    return () => {
      disposed = true
      unlisten?.()
    }
  }

  const source = new EventSource(`/api/v1/observatories/${encodeURIComponent(observatoryId)}/stream`)
  source.addEventListener('frame', (event) => {
    const frame = JSON.parse((event as MessageEvent<string>).data) as SimulationFrame
    onFrame(frame)
  })
  source.addEventListener('error', () => onError?.())
  return () => source.close()
}
