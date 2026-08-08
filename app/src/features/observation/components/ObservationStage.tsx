import { useEffect, useRef, useState } from 'react'
import { useAppSelector } from '../../../store/hooks'
import {
  createRunnerRotorCell,
  MCF10A_COLLAGEN,
  type CellParams,
  type RunnerRotorCell,
} from '../model/runnerRotor'
import { ModelControls } from './ModelControls'
import { ObservationViewport } from './ObservationViewport'
import styles from './ObservationStage.module.css'

interface StageControls {
  params: CellParams
  paused: boolean
  resetCount: number
}

const createStageControls = (): StageControls => ({
  params: MCF10A_COLLAGEN,
  paused: false,
  resetCount: 0,
})

export function ObservationStage() {
  const { activeStageId, stages } = useAppSelector((state) => state.stages)
  const [controlsByStage, setControlsByStage] = useState<Record<string, StageControls>>({})
  const [snapshot, setSnapshot] = useState(createRunnerRotorCell)
  const snapshotsByStage = useRef(new Map<string, RunnerRotorCell>())
  const activeControls = controlsByStage[activeStageId] ?? createStageControls()

  useEffect(() => {
    setSnapshot(snapshotsByStage.current.get(activeStageId) ?? createRunnerRotorCell())
  }, [activeStageId])

  const updateActiveControls = (update: (controls: StageControls) => StageControls) => {
    setControlsByStage((current) => ({
      ...current,
      [activeStageId]: update(current[activeStageId] ?? createStageControls()),
    }))
  }

  const handleSnapshot = (stageId: string, nextSnapshot: RunnerRotorCell) => {
    snapshotsByStage.current.set(stageId, nextSnapshot)
    if (stageId === activeStageId) setSnapshot(nextSnapshot)
  }

  return (
    <>
      <section className={styles.layout} aria-label="Runner-Rotor 细胞运动观察舞台">
        <ModelControls
          onChange={(params) => updateActiveControls((controls) => ({ ...controls, params }))}
          onReset={() =>
            updateActiveControls((controls) => ({ ...controls, resetCount: controls.resetCount + 1 }))
          }
          onTogglePause={() =>
            updateActiveControls((controls) => ({ ...controls, paused: !controls.paused }))
          }
          params={activeControls.params}
          paused={activeControls.paused}
          snapshot={snapshot}
        />
        <div className={styles.stageStack}>
          {stages.map((stage, stageIndex) => {
            const stageControls = controlsByStage[stage.id] ?? createStageControls()
            const isActive = stage.id === activeStageId

            return (
              <div
                key={stage.id}
                aria-label={`第 ${stageIndex + 1} 个舞台观察视图`}
                className={styles.stageSurface}
                data-observation-stage-id={stage.id}
                hidden={!isActive}
              >
                <ObservationViewport
                  activeStageNumber={stageIndex + 1}
                  onSnapshot={(nextSnapshot) => handleSnapshot(stage.id, nextSnapshot)}
                  params={stageControls.params}
                  paused={stageControls.paused}
                  resetKey={`${stage.id}-${stageControls.resetCount}`}
                />
              </div>
            )
          })}
        </div>
      </section>
    </>
  )
}
