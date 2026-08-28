/**
 * Created on 2026-08-28, updated on 2026-08-28
 * @author: https://github.com/Linmoqian
 */

/// <reference lib="webworker" />

import { runLocalBatchExperiment } from './localBatchExperiment'
import { createDefaultSnapshot, LocalRuntimeEngine } from './localRuntimeEngine'
import { clearRuntimeStorage, loadRuntimeSnapshot, saveRuntimeSnapshot } from './runtimeStorage'
import type { RuntimeEvent, RuntimeRequest } from './runtimeTypes'

const workerScope = self as DedicatedWorkerGlobalScope
const WALL_TICK_MS = 50
const CHECKPOINT_INTERVAL_TICKS = 50
let engine: LocalRuntimeEngine | undefined
let timer: number | undefined
let lastPersistedTick = 0
let persistQueue = Promise.resolve()

const respond = (event: RuntimeEvent) => workerScope.postMessage(event)

function persist() {
  if (!engine) return persistQueue
  const snapshot = engine.getSnapshot()
  persistQueue = persistQueue.then(() => saveRuntimeSnapshot(snapshot))
  return persistQueue
}

const start = () => {
  if (timer !== undefined) return
  timer = workerScope.setInterval(() => {
    if (!engine) return
    const frames = engine.advance()
    for (const frame of frames) respond({ frame, type: 'frame' })
    const latestTick = Math.max(0, ...frames.map((frame) => frame.tick))
    if (latestTick - lastPersistedTick >= CHECKPOINT_INTERVAL_TICKS) {
      lastPersistedTick = latestTick
      void persist()
    }
  }, WALL_TICK_MS)
}

async function execute(request: RuntimeRequest) {
  const { command } = request
  if (command.type === 'initialize') {
    engine = new LocalRuntimeEngine((await loadRuntimeSnapshot()) ?? createDefaultSnapshot())
    start()
    return engine.getBootstrap()
  }
  if (!engine) throw new Error('本地科学运行时尚未初始化')
  if (command.type === 'getBootstrap') return engine.getBootstrap()
  if (command.type === 'addCell') {
    const result = engine.addCell(command.observatoryId)
    await persist()
    return result
  }
  if (command.type === 'createObservatory') {
    const result = engine.createObservatory(command.groupId)
    await persist()
    return result
  }
  if (command.type === 'updateObservatory') {
    engine.updateObservatory(command.observatoryId, command.update)
    await persist()
    return undefined
  }
  if (command.type === 'exportBatch') return runLocalBatchExperiment(command.options)
  if (command.type === 'persist') return persist()
  if (command.type === 'clearLocalData') {
    if (timer !== undefined) workerScope.clearInterval(timer)
    timer = undefined
    await persistQueue
    engine = undefined
    await clearRuntimeStorage()
    return undefined
  }
  if (timer !== undefined) workerScope.clearInterval(timer)
  await persist()
  workerScope.close()
  return undefined
}

workerScope.addEventListener('message', (event: MessageEvent<RuntimeRequest>) => {
  void execute(event.data)
    .then((result) => respond({ requestId: event.data.requestId, result, type: 'response' }))
    .catch((error: unknown) =>
      respond({
        error: error instanceof Error ? error.message : '本地科学运行时发生未知错误',
        requestId: event.data.requestId,
        type: 'response',
      }),
    )
})
