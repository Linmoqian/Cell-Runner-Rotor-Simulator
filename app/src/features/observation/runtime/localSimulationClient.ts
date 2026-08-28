/**
 * Created on 2026-08-28, updated on 2026-08-28
 * @author: https://github.com/Linmoqian
 */

import type { CellParams } from '../model/runnerRotor'
import type {
  BatchExportOptions,
  BatchExportResult,
  BootstrapData,
  ObservatoryRecord,
  SimulationFrame,
} from '../types'
import type { RuntimeCommand, RuntimeEvent, RuntimeRequest } from './runtimeTypes'

interface RawBatchResult {
  manifest: BatchExportResult['manifest']
  texts: Record<string, string>
}

class LocalSimulationClient {
  private readonly errorListeners = new Set<() => void>()
  private readonly listeners = new Map<string, Set<(frame: SimulationFrame) => void>>()
  private readonly pending = new Map<
    number,
    { reject: (error: Error) => void; resolve: (value: unknown) => void }
  >()
  private requestId = 0
  private readonly worker = new Worker(new URL('./simulation.worker.ts', import.meta.url), { type: 'module' })
  private readonly initialized: Promise<BootstrapData>

  constructor() {
    this.worker.addEventListener('message', (event: MessageEvent<RuntimeEvent>) =>
      this.handleEvent(event.data),
    )
    this.worker.addEventListener('error', (event) => {
      this.rejectAll(new Error(event.message || '本地科学 Worker 启动失败'))
      for (const listener of this.errorListeners) listener()
    })
    this.initialized = this.send<BootstrapData>({ type: 'initialize' })
    window.addEventListener('pagehide', () => {
      void this.send({ type: 'persist' }).catch(() => undefined)
    })
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void this.send({ type: 'persist' }).catch(() => undefined)
    })
  }

  async getBootstrap() {
    await this.initialized
    return this.send<BootstrapData>({ type: 'getBootstrap' })
  }

  async addCell(observatoryId: string) {
    await this.initialized
    return this.send<{ id: string; observatoryId: string }>({ observatoryId, type: 'addCell' })
  }

  async createObservatory(groupId: string) {
    await this.initialized
    return this.send<ObservatoryRecord>({ groupId, type: 'createObservatory' })
  }

  async updateObservatory(observatoryId: string, update: { params?: CellParams; paused?: boolean }) {
    await this.initialized
    await this.send({ observatoryId, type: 'updateObservatory', update })
  }

  async exportBatch(options: BatchExportOptions) {
    await this.initialized
    const result = await this.send<RawBatchResult>({ options, type: 'exportBatch' })
    return {
      files: Object.entries(result.texts).map(([filename, text]) => ({
        filename,
        url: URL.createObjectURL(
          new Blob([text], { type: filename.endsWith('.json') ? 'application/json' : 'text/csv' }),
        ),
      })),
      manifest: result.manifest,
    } satisfies BatchExportResult
  }

  subscribe(observatoryId: string, listener: (frame: SimulationFrame) => void, onError?: () => void) {
    const listeners = this.listeners.get(observatoryId) ?? new Set()
    listeners.add(listener)
    this.listeners.set(observatoryId, listeners)
    if (onError) this.errorListeners.add(onError)
    return () => {
      listeners.delete(listener)
      if (onError) this.errorListeners.delete(onError)
      if (listeners.size === 0) this.listeners.delete(observatoryId)
    }
  }

  async clearLocalData() {
    await this.initialized
    await this.send({ type: 'clearLocalData' })
  }

  private send<T = void>(command: RuntimeCommand) {
    if (this.pending.size >= 256) return Promise.reject<T>(new Error('本地科学命令队列已满，请稍后重试'))
    const requestId = ++this.requestId
    return new Promise<T>((resolve, reject) => {
      this.pending.set(requestId, { reject, resolve: resolve as (value: unknown) => void })
      this.worker.postMessage({ command, requestId } satisfies RuntimeRequest)
    })
  }

  private handleEvent(event: RuntimeEvent) {
    if (event.type === 'frame') {
      for (const listener of this.listeners.get(event.frame.observatoryId) ?? []) listener(event.frame)
      return
    }
    const pending = this.pending.get(event.requestId)
    if (!pending) return
    this.pending.delete(event.requestId)
    if (event.error) pending.reject(new Error(event.error))
    else pending.resolve(event.result)
  }

  private rejectAll(error: Error) {
    for (const pending of this.pending.values()) pending.reject(error)
    this.pending.clear()
  }
}

let client: LocalSimulationClient | undefined
export const getLocalSimulationClient = () => (client ??= new LocalSimulationClient())
