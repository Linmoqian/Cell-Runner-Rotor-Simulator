import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { Worker } from 'node:worker_threads'

export class DatabaseClient {
  #pending = new Map()
  #requestId = 0
  #worker

  static async create(databasePath) {
    await mkdir(dirname(databasePath), { recursive: true })
    return new DatabaseClient(databasePath)
  }

  constructor(databasePath) {
    this.#worker = new Worker(new URL('./databaseWorker.js', import.meta.url), {
      workerData: { databasePath },
    })
    this.#worker.on('message', (message) => this.#handleMessage(message))
    this.#worker.on('error', (error) => {
      for (const request of this.#pending.values()) request.reject(error)
      this.#pending.clear()
    })
  }

  request(operation, payload) {
    const requestId = ++this.#requestId
    return new Promise((resolve, reject) => {
      this.#pending.set(requestId, { reject, resolve })
      this.#worker.postMessage({ operation, payload, requestId })
    })
  }

  close() {
    return this.#worker.terminate()
  }

  #handleMessage(message) {
    if (!message.requestId) return
    const request = this.#pending.get(message.requestId)
    if (!request) return
    this.#pending.delete(message.requestId)
    if (message.error) {
      request.reject(Object.assign(new Error(message.error.message), { code: message.error.code }))
    } else {
      request.resolve(message.result)
    }
  }
}
