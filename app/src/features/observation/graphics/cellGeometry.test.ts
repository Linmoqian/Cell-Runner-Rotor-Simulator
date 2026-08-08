import { describe, expect, it } from 'vitest'
import { createCellMembrane, getMembraneArea, resolveCellMembrane, type Point } from './cellGeometry'

const centroidOf = (points: Point[]) => {
  const total = points.reduce((centroid, point) => ({ x: centroid.x + point.x, y: centroid.y + point.y }), {
    x: 0,
    y: 0,
  })
  return { x: total.x / points.length, y: total.y / points.length }
}

describe('cell membrane particle ring', () => {
  it('用闭合膜粒子环保存相邻与弯曲静止长度', () => {
    const membrane = createCellMembrane({ x: 120, y: 80 }, 0)

    expect(membrane.particles).toHaveLength(40)
    expect(membrane.restEdgeLengths).toHaveLength(40)
    expect(membrane.restBendLengths).toHaveLength(40)
    expect(getMembraneArea(membrane.particles)).toBeCloseTo(membrane.restArea, 6)
    expect(membrane.restEdgeLengths.every((length) => length > 0)).toBe(true)
  })

  it('软中心约束会恢复受扰膜粒子但不会瞬间吸附', () => {
    const center = { x: 0, y: 0 }
    const membrane = createCellMembrane(center, 0)
    const target = { ...membrane.particles[0] }
    membrane.particles[0].x += 18
    const distanceBefore = Math.hypot(membrane.particles[0].x - target.x, membrane.particles[0].y - target.y)

    resolveCellMembrane(membrane, center, 0, 0, 'run', 1, 1 / 60)

    const distanceAfter = Math.hypot(membrane.particles[0].x - target.x, membrane.particles[0].y - target.y)
    expect(distanceAfter).toBeLessThan(distanceBefore)
    expect(distanceAfter).toBeGreaterThan(0.1)
  })

  it('迁移和转向后仍保持有限、连续且近似守恒的膜边界', () => {
    const membrane = createCellMembrane({ x: 0, y: 0 }, 0)

    for (let frame = 1; frame <= 240; frame += 1) {
      const progress = frame / 240
      resolveCellMembrane(
        membrane,
        { x: 48 * progress, y: 18 * progress },
        progress * 1.1,
        progress * 20,
        'turn',
        1,
        1 / 60,
      )
    }

    const points = membrane.particles
    const centroid = centroidOf(points)
    const areaRatio = getMembraneArea(points) / membrane.restArea
    const edgeLengths = points.map((point, index) => {
      const next = points[(index + 1) % points.length]
      return Math.hypot(next.x - point.x, next.y - point.y)
    })

    expect(points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true)
    expect(Math.hypot(centroid.x - 48, centroid.y - 18)).toBeLessThan(8)
    expect(areaRatio).toBeGreaterThan(0.82)
    expect(areaRatio).toBeLessThan(1.18)
    expect(Math.max(...edgeLengths)).toBeLessThan(13)
  })
})
