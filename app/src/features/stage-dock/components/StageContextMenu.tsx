import { AnimatePresence, motion } from 'motion/react'
import { ChevronRight, Copy, FolderPlus, Layers3, Trash2 } from 'lucide-react'
import type { FormEvent } from 'react'
import { createPortal } from 'react-dom'
import type { Stage, StageGroup } from '../types'
import styles from './StageDock.module.css'

export interface ContextMenuState {
  bottom: number
  stage: Stage
  stageIndex: number
  x: number
}

interface StageContextMenuProps {
  canDelete: boolean
  contextMenu: ContextMenuState | null
  groups: StageGroup[]
  onCopy: (stage: Stage) => void
  onCreateGroup: (stage: Stage, name: string) => void
  onDelete: (stage: Stage) => void
  onMoveToGroup: (stage: Stage, groupId: string) => void
}

export function StageContextMenu({
  canDelete,
  contextMenu,
  groups,
  onCopy,
  onCreateGroup,
  onDelete,
  onMoveToGroup,
}: StageContextMenuProps) {
  const createGroup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!contextMenu) return

    const formData = new FormData(event.currentTarget)
    onCreateGroup(contextMenu.stage, String(formData.get('groupName') ?? '').trim())
  }

  return createPortal(
    <AnimatePresence>
      {contextMenu && (
        <motion.div
          className={styles.contextMenu}
          role="menu"
          aria-label={`第 ${contextMenu.stageIndex + 1} 个舞台的菜单`}
          initial={{ opacity: 0, scale: 0.92, y: 6, filter: 'blur(3px)' }}
          animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, scale: 0.96, y: 4, filter: 'blur(2px)' }}
          style={{ bottom: contextMenu.bottom, left: contextMenu.x }}
          transition={{ type: 'spring', duration: 0.2, bounce: 0 }}
        >
          <span className={styles.contextMenuTitle}>舞台 {contextMenu.stageIndex + 1}</span>
          <button
            className={styles.contextMenuItem}
            type="button"
            role="menuitem"
            onClick={() => onCopy(contextMenu.stage)}
          >
            <Copy aria-hidden="true" />
            复制舞台
          </button>
          <div className={styles.groupMenu}>
            <button className={styles.contextMenuItem} type="button" role="menuitem" aria-haspopup="menu">
              <span>分至</span>
              <ChevronRight aria-hidden="true" />
            </button>
            <div className={styles.groupSubmenu} role="menu" aria-label="分至分组">
              {groups.map((group) => (
                <button
                  className={styles.contextMenuItem}
                  key={group.id}
                  type="button"
                  role="menuitem"
                  onClick={() => onMoveToGroup(contextMenu.stage, group.id)}
                >
                  <Layers3 aria-hidden="true" />
                  {group.name}
                </button>
              ))}
              <form className={styles.createGroupForm} onSubmit={createGroup}>
                <input
                  aria-label="新组名称"
                  autoComplete="off"
                  name="groupName"
                  placeholder={`第 ${groups.length + 1} 组`}
                />
                <button className={styles.contextMenuItem} type="submit" role="menuitem">
                  <FolderPlus aria-hidden="true" />
                  新建组
                </button>
              </form>
            </div>
          </div>
          <button
            className={`${styles.contextMenuItem} ${styles.dangerMenuItem}`}
            type="button"
            role="menuitem"
            disabled={!canDelete}
            onClick={() => onDelete(contextMenu.stage)}
          >
            <Trash2 aria-hidden="true" />
            删除舞台
          </button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
