import { describe, expect, it } from 'vitest'
import {
  createRunnerRotorCell,
  MCF10A_COLLAGEN,
  stepRunnerRotor,
  switchProbability,
  type RandomSource,
} from './runnerRotor'

const sequenceRandom = (values: number[]): RandomSource => {
  let index = 0
  return () => values[index++] ?? 0.5
}

describe('runnerRotor', () => {
  it('按指数等待时间计算状态切换概率', () => {
    expect(switchProbability(29.9, 29.9)).toBeCloseTo(1 - Math.exp(-1))
    expect(switchProbability(0, 29.9)).toBe(0)
  })

  it('Run 状态沿极性方向迁移且不产生确定性转向', () => {
    const params = { ...MCF10A_COLLAGEN, drRun: 0, tauRun: Number.POSITIVE_INFINITY }
    const next = stepRunnerRotor(
      createRunnerRotorCell({ heading: 0 }),
      params,
      2,
      sequenceRandom([0.5, 0.5, 0.5]),
    )

    expect(next.state).toBe('run')
    expect(next.heading).toBe(0)
    expect(next.x).toBeCloseTo(params.vRun * 2)
    expect(next.y).toBeCloseTo(0)
  })

  it('进入 Turn 时固定手性并以恒定角速度旋转', () => {
    const params = { ...MCF10A_COLLAGEN, drTurn: 0, tauRun: 0 }
    const next = stepRunnerRotor(
      createRunnerRotorCell({ heading: 0 }),
      params,
      1,
      sequenceRandom([0, 0.75, 0.5, 0.5]),
    )

    expect(next.state).toBe('turn')
    expect(next.chirality).toBe(1)
    expect(next.heading).toBeCloseTo(params.omegaTurn)
    expect(next.stateElapsedMinutes).toBe(1)
  })

  it('从 Turn 返回 Run 时保留最近一次手性但停止确定性旋转', () => {
    const params = { ...MCF10A_COLLAGEN, drRun: 0, tauTurn: 0 }
    const next = stepRunnerRotor(
      createRunnerRotorCell({ chirality: -1, heading: 0.4, state: 'turn' }),
      params,
      1,
      sequenceRandom([0, 0.5, 0.5]),
    )

    expect(next.state).toBe('run')
    expect(next.chirality).toBe(-1)
    expect(next.heading).toBeCloseTo(0.4)
  })
})
