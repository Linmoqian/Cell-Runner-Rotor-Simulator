import { describe, expect, it } from 'vitest'
import { getTrailOpacity, type TrailPoint } from './cellRenderer'

const createTrailPoint = (elapsedMinutes: number, state: TrailPoint['state']): TrailPoint => ({
  elapsedMinutes,
  state,
  x: 0,
  y: 0,
})

describe('cell trail', () => {
  it('历史轨迹随年龄变淡但保持可见', () => {
    const recentOpacity = getTrailOpacity(createTrailPoint(300, 'run'), 300)
    const oldOpacity = getTrailOpacity(createTrailPoint(0, 'run'), Number.MAX_SAFE_INTEGER)

    expect(oldOpacity).toBeCloseTo(0.28 * 0.14)
    expect(oldOpacity).toBeLessThan(recentOpacity)
  })

  it('转向轨迹在相同年龄下比直行轨迹更醒目', () => {
    const runOpacity = getTrailOpacity(createTrailPoint(120, 'run'), 180)
    const turnOpacity = getTrailOpacity(createTrailPoint(120, 'turn'), 180)

    expect(turnOpacity).toBeGreaterThan(runOpacity)
  })
})
