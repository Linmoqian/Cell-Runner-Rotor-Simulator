/**
 * Created on 2026-08-28, updated on 2026-08-28
 * @author: https://github.com/Linmoqian
 */

import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createDefaultSnapshot } from './localRuntimeEngine'
import {
  clearRuntimeStorage,
  IncompatibleRuntimeSnapshotError,
  loadRuntimeSnapshot,
  saveRuntimeSnapshot,
} from './runtimeStorage'

describe('runtimeStorage', () => {
  beforeEach(async () => clearRuntimeStorage())

  it('原子保存并恢复完整科学检查点', async () => {
    const snapshot = createDefaultSnapshot()
    snapshot.observatories[0].tick = 42
    snapshot.cells[0].rngState = 123
    await saveRuntimeSnapshot(snapshot)
    expect(await loadRuntimeSnapshot()).toEqual(snapshot)
  })

  it('保留并拒绝不兼容的算法版本', async () => {
    const snapshot = createDefaultSnapshot()
    snapshot.algorithmVersion = 'future-version'
    await saveRuntimeSnapshot(snapshot)
    await expect(loadRuntimeSnapshot()).rejects.toBeInstanceOf(IncompatibleRuntimeSnapshotError)
  })
})
