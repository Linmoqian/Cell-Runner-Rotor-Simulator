/**
 * Created on 2026-08-28, updated on 2026-08-28
 * @author: https://github.com/Linmoqian
 */

import { RUNNER_ROTOR_ALGORITHM_VERSION } from '../model/runnerRotor'
import { LOCAL_RUNTIME_SCHEMA_VERSION, type RuntimeSnapshot } from './runtimeTypes'

export const LOCAL_RUNTIME_DATABASE_NAME = 'cell-runner-rotor-runtime'
const STORE_NAME = 'snapshots'
const ACTIVE_SNAPSHOT_KEY = 'active'

export class IncompatibleRuntimeSnapshotError extends Error {}

const openDatabase = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(LOCAL_RUNTIME_DATABASE_NAME, LOCAL_RUNTIME_SCHEMA_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('无法打开本地实验数据库'))
  })

export async function loadRuntimeSnapshot() {
  const database = await openDatabase()
  try {
    const snapshot = await new Promise<RuntimeSnapshot | undefined>((resolve, reject) => {
      const request = database
        .transaction(STORE_NAME, 'readonly')
        .objectStore(STORE_NAME)
        .get(ACTIVE_SNAPSHOT_KEY)
      request.onsuccess = () => resolve(request.result as RuntimeSnapshot | undefined)
      request.onerror = () => reject(request.error ?? new Error('无法读取本地实验检查点'))
    })
    if (!snapshot) return undefined
    if (
      snapshot.schemaVersion !== LOCAL_RUNTIME_SCHEMA_VERSION ||
      snapshot.algorithmVersion !== RUNNER_ROTOR_ALGORITHM_VERSION
    ) {
      throw new IncompatibleRuntimeSnapshotError('本地实验数据版本不兼容，请先导出或清除旧数据')
    }
    return snapshot
  } finally {
    database.close()
  }
}

export async function saveRuntimeSnapshot(snapshot: RuntimeSnapshot) {
  const database = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).put(snapshot, ACTIVE_SNAPSHOT_KEY)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('无法保存本地实验检查点'))
      transaction.onabort = () => reject(transaction.error ?? new Error('本地实验检查点写入中止'))
    })
  } finally {
    database.close()
  }
}

export const clearRuntimeStorage = () =>
  new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(LOCAL_RUNTIME_DATABASE_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error ?? new Error('无法清除本地实验数据'))
    request.onblocked = () => reject(new Error('本地实验数据库仍被占用，请刷新后重试'))
  })
