export class PersistenceCoordinator {
  #database
  #inFlight = new Set()
  #latest = new Map()

  constructor(database) {
    this.#database = database
  }

  enqueue(frame) {
    const id = frame.observatoryId
    if (this.#inFlight.has(id)) {
      this.#latest.set(id, frame)
      return
    }
    this.#persist(frame)
  }

  async #persist(frame) {
    const id = frame.observatoryId
    this.#inFlight.add(id)
    try {
      await this.#database.request('persistFrame', frame)
    } catch (error) {
      console.error('[错误] 观察台检查点写入失败', error.message)
    } finally {
      const latest = this.#latest.get(id)
      this.#latest.delete(id)
      if (latest) {
        this.#persist(latest)
      } else {
        this.#inFlight.delete(id)
      }
    }
  }
}
