/**
 * Created on 2026-08-28, updated on 2026-08-28
 * @author: https://github.com/Linmoqian
 */

import { describe, expect, it } from 'vitest'
import { runLocalBatchExperiment } from './localBatchExperiment'

describe('runLocalBatchExperiment', () => {
  it('生成可重复的本地 CSV、manifest 与哈希', async () => {
    const options = { cellCount: 2, dtMinutes: 0.5, durationMinutes: 3, seed: 7 }
    const first = await runLocalBatchExperiment(options)
    const second = await runLocalBatchExperiment(options)
    expect(first).toEqual(second)
    expect(first.manifest.generatedLocally).toBe(true)
    expect(first.texts['trajectories.csv'].trim().split('\n')).toHaveLength(15)
    expect(first.manifest.sha256['trajectories.csv']).toMatch(/^[0-9a-f]{64}$/)
  })

  it('拒绝会长期占满 Worker 的实验规模', async () => {
    await expect(
      runLocalBatchExperiment({ cellCount: 500, dtMinutes: 0.001, durationMinutes: 10_000, seed: 1 }),
    ).rejects.toThrow('批处理规模过大')
  })
})
