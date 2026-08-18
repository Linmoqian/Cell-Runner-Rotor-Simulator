import { describe, expect, it } from 'vitest'
import {
  CENTER_TO_TIP,
  getHeading,
  getHeldAnchor,
  getNeedleTailPosition,
  getNeedleTipPosition,
  NEEDLE_HALF,
  REST_ROTATE,
  rotateVector,
} from './needleGeometry'

const closeTo = (actual: { x: number; y: number }, expected: { x: number; y: number }) => {
  expect(Math.hypot(actual.x - expected.x, actual.y - expected.y)).toBeLessThan(1e-9)
}

describe('needleGeometry', () => {
  it('休息朝向让针尖朝正上方，针在盒内', () => {
    const slotCenter = { x: 220, y: 300 }
    const anchor = { x: slotCenter.x - NEEDLE_HALF.x, y: slotCenter.y - NEEDLE_HALF.y }

    const tip = getNeedleTipPosition(anchor, REST_ROTATE)

    closeTo(
      { x: tip.x, y: tip.y },
      {
        x: slotCenter.x,
        y: slotCenter.y - Math.hypot(CENTER_TO_TIP.x, CENTER_TO_TIP.y),
      },
    )
    expect(tip.y).toBeLessThan(slotCenter.y)
  })

  it('向右移动时针尖精确落在鼠标指针上，针尾在指针后方', () => {
    const previous = { x: 390, y: 300 }
    const cursor = { x: 400, y: 300 }
    const heading = getHeading(previous, cursor)
    const anchor = getHeldAnchor(cursor, heading)

    const tip = getNeedleTipPosition(anchor, heading)
    const tail = getNeedleTailPosition(anchor, heading)

    closeTo(tip, cursor)
    expect(tail.x).toBeLessThan(cursor.x)
  })

  it('朝向角使图标针尖向量指向目标方向', () => {
    const from = { x: 100, y: 100 }
    const to = { x: 180, y: 40 }
    const expected = { x: to.x - from.x, y: to.y - from.y }

    const tipVector = rotateVector(CENTER_TO_TIP, getHeading(from, to))

    const cross = tipVector.x * expected.y - tipVector.y * expected.x
    const dot = tipVector.x * expected.x + tipVector.y * expected.y
    expect(Math.abs(cross)).toBeLessThan(1e-9)
    expect(dot).toBeGreaterThan(0)
    expect(Math.hypot(tipVector.x, tipVector.y)).toBeCloseTo(Math.hypot(CENTER_TO_TIP.x, CENTER_TO_TIP.y), 9)
  })
})
