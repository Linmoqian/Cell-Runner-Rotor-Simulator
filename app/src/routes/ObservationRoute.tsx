import { useEffect, useState } from 'react'
import { useAppDispatch } from '../store/hooks'
import { hydrateStages, selectStage } from '../features/stage-dock/store/stageSlice'
import { stagePalettes, type StagePalette } from '../features/stage-dock/types'
import { ObservationStage } from '../features/observation/components/ObservationStage'
import { createObservatory, getBootstrap } from '../features/observation/services/simulationClient'
import type { BootstrapData } from '../features/observation/types'
import { StageDock } from '../features/stage-dock/components/StageDock'
import styles from './ObservationRoute.module.css'

const toPalette = (palette: string): StagePalette =>
  stagePalettes.includes(palette as StagePalette) ? (palette as StagePalette) : 'mint'

export function ObservationRoute() {
  const dispatch = useAppDispatch()
  const [bootstrap, setBootstrap] = useState<BootstrapData | null>(null)
  const [addingObservatory, setAddingObservatory] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isDockCollapsed, setIsDockCollapsed] = useState(false)

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('debug:stage-ready', {
        detail: { surface: 'character-observation-stage' },
      }),
    )
    let active = true
    void getBootstrap()
      .then((data) => {
        if (!active) return
        setBootstrap(data)
        dispatch(
          hydrateStages({
            groups: data.groups.map(({ id, name }) => ({ id, name })),
            stages: data.observatories.map(({ groupId, id, palette }) => ({
              groupId,
              id,
              palette: toPalette(palette),
            })),
          }),
        )
      })
      .catch((error: Error) => {
        if (active) setLoadError(error.message)
      })
    return () => {
      active = false
    }
  }, [dispatch])

  if (loadError) {
    return (
      <main className={styles.observatory}>
        <p role="alert">无法启动本地科学运行时：{loadError}</p>
      </main>
    )
  }

  if (!bootstrap) {
    return (
      <main className={styles.observatory}>
        <p role="status">正在恢复本地科学实验…</p>
      </main>
    )
  }

  const handleAddObservatory = async () => {
    setAddingObservatory(true)
    try {
      const createdObservatory = await createObservatory(bootstrap.groups[0].id)
      const nextBootstrap = await getBootstrap()
      setBootstrap(nextBootstrap)
      dispatch(
        hydrateStages({
          groups: nextBootstrap.groups.map(({ id, name }) => ({ id, name })),
          stages: nextBootstrap.observatories.map(({ groupId, id, palette }) => ({
            groupId,
            id,
            palette: toPalette(palette),
          })),
        }),
      )
      dispatch(selectStage(createdObservatory.id))
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : '创建观察台失败')
    } finally {
      setAddingObservatory(false)
    }
  }

  return (
    <main className={`${styles.observatory}${isDockCollapsed ? ` ${styles.dockCollapsed}` : ''}`}>
      <StageDock
        addingObservatory={addingObservatory}
        onAddObservatory={() => void handleAddObservatory()}
        onCollapsedChange={setIsDockCollapsed}
      />
      <ObservationStage bootstrap={bootstrap} />
    </main>
  )
}
