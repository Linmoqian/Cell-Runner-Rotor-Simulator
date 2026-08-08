import { configureStore } from '@reduxjs/toolkit'
import { stageReducer } from '../features/stage-dock/store/stageSlice'

export const createAppStore = () =>
  configureStore({
    reducer: {
      stages: stageReducer,
    },
  })

export const store = createAppStore()

export type AppStore = typeof store
export type RootState = ReturnType<AppStore['getState']>
export type AppDispatch = AppStore['dispatch']
