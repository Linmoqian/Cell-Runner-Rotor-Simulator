import { Plus } from 'lucide-react'
import styles from './StageDock.module.css'

interface DockActionsProps {
  adding: boolean
  onAdd: () => void
}

export function DockActions({ adding, onAdd }: DockActionsProps) {
  return (
    <div className={styles.actions}>
      <button
        className={styles.iconButton}
        type="button"
        aria-label="添加观察台"
        disabled={adding}
        onClick={onAdd}
      >
        <Plus aria-hidden="true" />
      </button>
    </div>
  )
}
