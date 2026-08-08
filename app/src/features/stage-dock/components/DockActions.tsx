import { Plus } from 'lucide-react'
import { useAppDispatch } from '../../../store/hooks'
import { addStage } from '../store/stageSlice'
import styles from './StageDock.module.css'

export function DockActions() {
  const dispatch = useAppDispatch()

  return (
    <div className={styles.actions}>
      <button
        className={styles.iconButton}
        type="button"
        aria-label="添加舞台"
        onClick={() => dispatch(addStage())}
      >
        <Plus aria-hidden="true" />
      </button>
    </div>
  )
}
