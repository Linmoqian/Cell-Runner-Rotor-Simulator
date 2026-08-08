import { useEffect, useState } from 'react'
import { ObservationStage } from '../features/observation/components/ObservationStage'
import { StageDock } from '../features/stage-dock/components/StageDock'
import styles from './ObservationRoute.module.css'

export function ObservationRoute() {
  const [isDockCollapsed, setIsDockCollapsed] = useState(false)

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('debug:stage-ready', {
        detail: { surface: 'character-observation-stage' },
      }),
    )
  }, [])

  return (
    <main className={`${styles.observatory}${isDockCollapsed ? ` ${styles.dockCollapsed}` : ''}`}>
      <StageDock onCollapsedChange={setIsDockCollapsed} />
      <ObservationStage />
    </main>
  )
}
