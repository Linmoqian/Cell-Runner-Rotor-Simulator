import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createCell, MCF10A_COLLAGEN, nextRandom, stepCell, switchProbability } from './runnerRotor.js'

test('状态切换遵循指数等待时间', () => {
  assert.ok(Math.abs(switchProbability(29.9, 29.9) - (1 - Math.exp(-1))) < 1e-12)
  assert.equal(switchProbability(0, 29.9), 0)
})

test('每个细胞的随机序列由自身种子决定', () => {
  const first = createCell({ id: 'a', observatoryId: 'o', seed: 42 })
  const second = createCell({ id: 'b', observatoryId: 'o', seed: 42 })
  assert.deepEqual(
    [nextRandom(first), nextRandom(first), nextRandom(first)],
    [nextRandom(second), nextRandom(second), nextRandom(second)],
  )
})

test('固定种子的轨迹可复现且与其他细胞步进顺序无关', () => {
  const first = createCell({ heading: 0, id: 'a', observatoryId: 'o', seed: 7 })
  const second = createCell({ heading: 0, id: 'b', observatoryId: 'o', seed: 7 })
  const unrelated = createCell({ id: 'c', observatoryId: 'o', seed: 99 })

  for (let index = 0; index < 100; index += 1) {
    stepCell(first, MCF10A_COLLAGEN, 0.1)
    stepCell(unrelated, MCF10A_COLLAGEN, 0.1)
    stepCell(second, MCF10A_COLLAGEN, 0.1)
  }

  assert.equal(first.x, second.x)
  assert.equal(first.y, second.y)
  assert.equal(first.heading, second.heading)
  assert.equal(first.state, second.state)
})

test('与浏览器和 Rust 共享的黄金轨迹一致', async () => {
  const goldenCases = JSON.parse(await readFile(new URL('../../../tests/runner-rotor-golden.json', import.meta.url), 'utf8'))
  for (const golden of goldenCases) {
    const cell = createCell({ heading: -0.18, id: 'cell', observatoryId: 'golden', seed: golden.seed })
    for (let step = 0; step < golden.steps; step += 1) stepCell(cell, MCF10A_COLLAGEN, golden.dtMinutes)
    assert.equal(cell.rngState, golden.expected.rngState)
    assert.equal(cell.state, golden.expected.state)
    assert.equal(cell.chirality, golden.expected.chirality)
    for (const key of ['elapsedMinutes', 'heading', 'stateElapsedMinutes', 'x', 'y']) {
      assert.ok(Math.abs(cell[key] - golden.expected[key]) < 1e-12, `${golden.seed}:${key}`)
    }
  }
})
