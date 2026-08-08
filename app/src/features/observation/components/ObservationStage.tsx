import { useAppSelector } from '../../../store/hooks'
import { ObservationViewport } from './ObservationViewport'
import styles from './ObservationStage.module.css'

export function ObservationStage() {
  const { activeStageId, clearedStageIds, stages } = useAppSelector((state) => state.stages)
  const activeStageIndex = stages.findIndex((stage) => stage.id === activeStageId)
  const activeStageNumber = activeStageIndex + 1
  const isActiveStageCleared = clearedStageIds.includes(activeStageId)

  if (isActiveStageCleared) return <ObservationViewport activeStageNumber={activeStageNumber} empty />

  return (
    <>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>CELL RUNNER / OBSERVATION DECK</p>
          <h1 className={styles.title}>角色观察台</h1>
        </div>
        <div className={styles.sessionStatus} aria-label="观察状态">
          <span className={styles.statusDot} />
          <span>LIVE SPECIMEN</span>
        </div>
      </header>

      <section className={styles.layout} aria-label="显微镜角色观察舞台">
        <aside className={styles.notes}>
          <p className={styles.label}>SPECIMEN {String(activeStageNumber).padStart(2, '0')}</p>
          <h2>未命名角色</h2>
          <p className={styles.description}>进入观察范围后，角色的运动、轮廓和反应将被记录在这块视野中。</p>
          <dl className={styles.readings}>
            <div>
              <dt>状态</dt>
              <dd>待机</dd>
            </div>
            <div>
              <dt>倍率</dt>
              <dd>1.0×</dd>
            </div>
            <div>
              <dt>视野</dt>
              <dd>开放</dd>
            </div>
          </dl>
        </aside>
        <ObservationViewport activeStageNumber={activeStageNumber} />
      </section>

      <footer className={styles.footer}>
        <span>CHARACTER SYSTEM</span>
        <span className={styles.footerRule} />
        <span>Awaiting motion input</span>
      </footer>
    </>
  )
}
