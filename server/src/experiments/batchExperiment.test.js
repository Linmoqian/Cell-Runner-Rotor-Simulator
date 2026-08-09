import assert from 'node:assert/strict'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { exportBatchExperiment, runBatchExperiment } from './batchExperiment.js'

test('固定种子批量实验导出相同的科学记录', () => {
  const options = { cellCount: 3, dtMinutes: 0.1, durationMinutes: 2, seed: 42 }
  assert.deepEqual(runBatchExperiment(options), runBatchExperiment(options))
})

test('转向角、轨迹和状态驻留时间覆盖全部模拟时段', () => {
  const result = runBatchExperiment({ cellCount: 2, dtMinutes: 0.5, durationMinutes: 3, seed: 7 })
  assert.equal(result.trajectories.length, 14)
  assert.equal(result.turningAngles.length, 12)
  for (const cellId of ['cell-0001', 'cell-0002']) {
    const totalResidence = result.residenceTimes
      .filter((row) => row[0] === cellId)
      .reduce((sum, row) => sum + row[4], 0)
    assert.equal(totalResidence, 3)
  }
})

test('拒绝不可重复或无效的批处理参数', () => {
  assert.throws(
    () => runBatchExperiment({ cellCount: 0 }),
    { code: 'INVALID_EXPERIMENT', message: 'cellCount 必须是正整数' },
  )
})

test('导出写入可分析的独立 CSV 与配置清单', async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), 'runner-rotor-batch-'))
  await exportBatchExperiment(outputDirectory, { cellCount: 1, dtMinutes: 1, durationMinutes: 2, seed: 9 })
  const [manifest, trajectories, turningAngles, residenceTimes] = await Promise.all([
    readFile(join(outputDirectory, 'manifest.json'), 'utf8'),
    readFile(join(outputDirectory, 'trajectories.csv'), 'utf8'),
    readFile(join(outputDirectory, 'turning_angles.csv'), 'utf8'),
    readFile(join(outputDirectory, 'state_residence_times.csv'), 'utf8'),
  ])
  assert.match(manifest, /"seed": 9/)
  assert.equal(trajectories.trim().split('\n').length, 4)
  assert.equal(turningAngles.trim().split('\n').length, 3)
  assert.match(residenceTimes, /residence_minutes/)
})
