import { availableParallelism } from 'node:os'
import { Worker } from 'node:worker_threads'

const MAX_PENDING_COMMANDS = 256

function hashId(value) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export class SimulationPool {
  #frameListeners = new Set()
  #persistListeners = new Set()
  #requestId = 0
  #workers

  constructor(workerCount = Math.max(1, Math.min(4, availableParallelism() - 1))) {
    this.#workers = Array.from({ length: workerCount }, () => {
      const worker = new Worker(new URL('./simulationWorker.js', import.meta.url))
      const slot = { pending: new Set(), worker }
      worker.on('message', (message) => this.#handleMessage(slot, message))
      worker.on('error', (error) => console.error('[错误] 模拟 Worker 异常', error.message))
      return slot
    })
  }

  get workerCount() {
    return this.#workers.length
  }

  onFrame(listener) {
    this.#frameListeners.add(listener)
    return () => this.#frameListeners.delete(listener)
  }

  onPersist(listener) {
    this.#persistListeners.add(listener)
    return () => this.#persistListeners.delete(listener)
  }

  send(observatoryId, command, payload) {
    const slot = this.#workers[hashId(observatoryId) % this.#workers.length]
    if (slot.pending.size >= MAX_PENDING_COMMANDS) return false
    const requestId = ++this.#requestId
    slot.pending.add(requestId)
    slot.worker.postMessage({ command, payload, requestId })
    return true
  }

  async close() {
    await Promise.all(this.#workers.map(({ worker }) => worker.terminate()))
  }

  #handleMessage(slot, message) {
    if (message.type === 'ack') {
      slot.pending.delete(message.requestId)
      return
    }
    if (message.type === 'frame') {
      for (const listener of this.#frameListeners) listener(message.frame)
    }
    if (message.type === 'persist') {
      for (const listener of this.#persistListeners) listener(message.frame)
    }
  }
}
