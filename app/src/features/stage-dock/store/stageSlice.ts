import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit'
import { stagePalettes, type Stage, type StageGroup } from '../types'

export interface StageState {
  stages: Stage[]
  activeStageId: string
  groups: StageGroup[]
  expandedGroupIds: string[]
}

export const initialStageState: StageState = {
  stages: [{ groupId: 'group-default', id: 'observatory-1', palette: 'mint' }],
  activeStageId: 'observatory-1',
  groups: [],
  expandedGroupIds: [],
}

const stageSlice = createSlice({
  name: 'stages',
  initialState: initialStageState,
  reducers: {
    addStage: {
      prepare: () => ({ payload: { id: `stage-${nanoid()}` } }),
      reducer: (state, action: PayloadAction<{ id: string }>) => {
        const palette = stagePalettes[state.stages.length % stagePalettes.length]

        state.stages.push({ id: action.payload.id, palette })
        state.activeStageId = action.payload.id
      },
    },
    removeStage: (state, action: PayloadAction<string>) => {
      if (state.stages.length === 1) return

      const stageIndex = state.stages.findIndex((stage) => stage.id === action.payload)
      if (stageIndex < 0) return

      const removedGroupId = state.stages[stageIndex].groupId
      const nextActiveStage = state.stages[stageIndex - 1] ?? state.stages[stageIndex + 1]
      state.stages.splice(stageIndex, 1)

      if (state.activeStageId === action.payload) state.activeStageId = nextActiveStage.id

      if (removedGroupId && !state.stages.some((stage) => stage.groupId === removedGroupId)) {
        state.groups = state.groups.filter((group) => group.id !== removedGroupId)
        state.expandedGroupIds = state.expandedGroupIds.filter((groupId) => groupId !== removedGroupId)
      }
    },
    copyStage: {
      prepare: (stageId: string) => ({ payload: { id: `stage-${nanoid()}`, stageId } }),
      reducer: (state, action: PayloadAction<{ id: string; stageId: string }>) => {
        const stageIndex = state.stages.findIndex((stage) => stage.id === action.payload.stageId)
        if (stageIndex < 0) return

        const sourceStage = state.stages[stageIndex]
        state.stages.splice(stageIndex + 1, 0, { ...sourceStage, id: action.payload.id })
        state.activeStageId = action.payload.id
      },
    },
    createStageGroup: {
      prepare: ({ name, stageId }: { name: string; stageId: string }) => ({
        payload: { id: `group-${nanoid()}`, name, stageId },
      }),
      reducer: (state, action: PayloadAction<{ id: string; name: string; stageId: string }>) => {
        const stage = state.stages.find((candidate) => candidate.id === action.payload.stageId)
        if (!stage) return

        state.groups.push({
          id: action.payload.id,
          name: action.payload.name || `第 ${state.groups.length + 1} 组`,
        })
        stage.groupId = action.payload.id
      },
    },
    moveStageToGroup: (state, action: PayloadAction<{ groupId: string; stageId: string }>) => {
      const stage = state.stages.find((candidate) => candidate.id === action.payload.stageId)
      if (!stage || !state.groups.some((group) => group.id === action.payload.groupId)) return

      const previousGroupId = stage.groupId
      stage.groupId = action.payload.groupId
      if (previousGroupId && !state.stages.some((candidate) => candidate.groupId === previousGroupId)) {
        state.groups = state.groups.filter((group) => group.id !== previousGroupId)
        state.expandedGroupIds = state.expandedGroupIds.filter((groupId) => groupId !== previousGroupId)
      }
    },
    toggleStageGroup: (state, action: PayloadAction<string>) => {
      if (state.expandedGroupIds.includes(action.payload)) {
        state.expandedGroupIds = state.expandedGroupIds.filter((groupId) => groupId !== action.payload)
      } else {
        state.expandedGroupIds.push(action.payload)
      }
    },
    reorderStages: (state, action: PayloadAction<Stage[]>) => {
      state.stages = action.payload
    },
    selectStage: (state, action: PayloadAction<string>) => {
      if (state.stages.some((stage) => stage.id === action.payload)) state.activeStageId = action.payload
    },
    hydrateStages: (state, action: PayloadAction<{ groups: StageGroup[]; stages: Stage[] }>) => {
      if (action.payload.stages.length === 0) return
      state.groups = action.payload.groups
      state.stages = action.payload.stages
      state.expandedGroupIds = action.payload.groups
        .filter((group) => state.stages.filter((stage) => stage.groupId === group.id).length > 1)
        .map((group) => group.id)
      if (!state.stages.some((stage) => stage.id === state.activeStageId)) {
        state.activeStageId = state.stages[0].id
      }
    },
  },
})

export const {
  addStage,
  copyStage,
  createStageGroup,
  hydrateStages,
  moveStageToGroup,
  removeStage,
  reorderStages,
  selectStage,
  toggleStageGroup,
} = stageSlice.actions
export const stageReducer = stageSlice.reducer
