import { describe, expect, it } from 'vitest'
import {
  addStage,
  copyStage,
  createStageGroup,
  initialStageState,
  moveStageToGroup,
  removeStage,
  reorderStages,
  selectStage,
  stageReducer,
  toggleStageGroup,
} from './stageSlice'

describe('stageSlice', () => {
  it('添加观察台后激活新观察台', () => {
    const state = stageReducer(initialStageState, addStage())

    expect(state.stages).toHaveLength(2)
    expect(state.activeStageId).toBe(state.stages[1].id)
  })

  it('删除当前舞台后选择相邻舞台', () => {
    const populatedState = stageReducer(initialStageState, addStage())
    const state = stageReducer(populatedState, removeStage(populatedState.activeStageId))

    expect(state.stages).toHaveLength(1)
    expect(state.activeStageId).toBe('observatory-1')
  })

  it('拒绝选择不存在的舞台', () => {
    const state = stageReducer(initialStageState, selectStage('missing'))

    expect(state.activeStageId).toBe('observatory-1')
  })

  it('按拖拽结果更新舞台顺序', () => {
    const populatedState = stageReducer(initialStageState, addStage())
    const reordered = [...populatedState.stages].reverse()
    const state = stageReducer(populatedState, reorderStages(reordered))

    expect(state.stages).toEqual(reordered)
  })

  it('舞台数量可超过原有调色板数量', () => {
    let state = initialStageState
    for (let index = 0; index < 8; index += 1) state = stageReducer(state, addStage())

    expect(state.stages).toHaveLength(9)
  })

  it('复制舞台并将舞台归入可折叠组', () => {
    const copiedState = stageReducer(initialStageState, copyStage('observatory-1'))
    const groupedState = stageReducer(
      copiedState,
      createStageGroup({ name: '实验组', stageId: 'observatory-1' }),
    )
    const groupId = groupedState.groups[0].id
    const movedState = stageReducer(
      groupedState,
      moveStageToGroup({ groupId, stageId: groupedState.stages[1].id }),
    )
    const expandedState = stageReducer(movedState, toggleStageGroup(groupId))

    expect(movedState.groups[0].name).toBe('实验组')
    expect(movedState.stages.every((stage) => stage.groupId === groupId)).toBe(true)
    expect(expandedState.expandedGroupIds).toContain(groupId)
  })
})
