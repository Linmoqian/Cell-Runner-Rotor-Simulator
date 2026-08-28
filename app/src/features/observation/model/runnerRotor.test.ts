import { describe, expect, it } from 'vitest'
import {
  createRunnerRotorCell,
  MCF10A_COLLAGEN,
  stepRunnerRotor,
  switchProbability,
  nextRandom,
} from './runnerRotor'
import goldenCases from '../../../../../tests/runner-rotor-golden.json'

describe('runnerRotor', () => {
  it('按指数等待时间计算状态切换概率', () => {
    expect(switchProbability(29.9, 29.9)).toBeCloseTo(1 - Math.exp(-1))
    expect(switchProbability(0, 29.9)).toBe(0)
  })

  it('Run 状态沿极性方向迁移且不产生确定性转向', () => {
    const params = { ...MCF10A_COLLAGEN, drRun: 0, tauRun: Number.POSITIVE_INFINITY }
    const next = stepRunnerRotor(createRunnerRotorCell({ heading: 0, seed: 7 }), params, 2)

    expect(next.state).toBe('run')
    expect(next.heading).toBe(0)
    expect(next.x).toBeCloseTo(params.vRun * 2)
    expect(next.y).toBeCloseTo(0)
  })

  it('进入 Turn 时固定手性并以恒定角速度旋转', () => {
    const params = { ...MCF10A_COLLAGEN, drTurn: 0, tauRun: 0 }
    const next = stepRunnerRotor(createRunnerRotorCell({ heading: 0, seed: 7 }), params, 1)

    expect(next.state).toBe('turn')
    expect([-1, 1]).toContain(next.chirality)
    expect(Math.abs(next.heading)).toBeCloseTo(params.omegaTurn)
    expect(next.stateElapsedMinutes).toBe(1)
  })

  it('从 Turn 返回 Run 时保留最近一次手性但停止确定性旋转', () => {
    const params = { ...MCF10A_COLLAGEN, drRun: 0, tauTurn: 0 }
    const next = stepRunnerRotor(
      createRunnerRotorCell({ chirality: -1, heading: 0.4, seed: 7, state: 'turn' }),
      params,
      1,
    )

    expect(next.state).toBe('run')
    expect(next.chirality).toBe(-1)
    expect(next.heading).toBeCloseTo(0.4)
  })

  it('固定种子的随机序列与轨迹可复现', () => {
    const first = createRunnerRotorCell({ seed: 42 })
    const second = createRunnerRotorCell({ seed: 42 })
    expect([nextRandom(first), nextRandom(first), nextRandom(first)]).toEqual([
      nextRandom(second),
      nextRandom(second),
      nextRandom(second),
    ])
    for (let step = 0; step < 100; step += 1) {
      stepRunnerRotor(first, MCF10A_COLLAGEN, 0.1)
      stepRunnerRotor(second, MCF10A_COLLAGEN, 0.1)
    }
    expect(first).toEqual(second)
  })

  it('与 Node 和 Rust 共享的黄金轨迹一致', () => {
    for (const golden of goldenCases) {
      const cell = createRunnerRotorCell({
        heading: -0.18,
        id: 'cell',
        observatoryId: 'golden',
        seed: golden.seed,
      })
      for (let step = 0; step < golden.steps; step += 1)
        stepRunnerRotor(cell, MCF10A_COLLAGEN, golden.dtMinutes)
      expect(cell.rngState).toBe(golden.expected.rngState)
      expect(cell.state).toBe(golden.expected.state)
      expect(cell.chirality).toBe(golden.expected.chirality)
      for (const key of ['elapsedMinutes', 'heading', 'stateElapsedMinutes', 'x', 'y'] as const) {
        expect(cell[key]).toBeCloseTo(golden.expected[key], 12)
      }
    }
  })
})
