/**
 * Created on 2026-08-28, updated on 2026-08-28
 * @author: https://github.com/Linmoqian
 */

import { describe, expect, it } from 'vitest'
import { createDefaultSnapshot, LocalRuntimeEngine } from './localRuntimeEngine'

describe('LocalRuntimeEngine', () => {
  it('以固定时间步推进独立观察台并保持暂停状态', () => {
    const engine = new LocalRuntimeEngine(createDefaultSnapshot())
    expect(engine.advance()[0].tick).toBe(1)
    engine.updateObservatory('observatory-1', { paused: true })
    expect(engine.advance()).toEqual([])
    expect(engine.getBootstrap().observatories[0].tick).toBe(1)
  })

  it('创建观察台并将新增细胞限制在目标观察台', () => {
    const engine = new LocalRuntimeEngine(createDefaultSnapshot())
    const observatory = engine.createObservatory('group-default')
    const created = engine.addCell(observatory.id)
    const bootstrap = engine.getBootstrap()
    expect(created.observatoryId).toBe(observatory.id)
    expect(bootstrap.cells.filter((cell) => cell.observatoryId === observatory.id)).toHaveLength(1)
  })
})
