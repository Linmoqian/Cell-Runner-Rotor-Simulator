import { Tooltip } from 'antd'
import { AnimatePresence, motion } from 'motion/react'
import { Layers3 } from 'lucide-react'
import { type CSSProperties, useState } from 'react'
import { useAppSelector } from '../../../store/hooks'
import { DockActions } from './DockActions'
import { StageList } from './StageList'
import styles from './StageDock.module.css'

interface StageDockProps {
  addingObservatory?: boolean
  onAddObservatory?: () => void
  onCollapsedChange?: (collapsed: boolean) => void
}

const cx = (...classNames: Array<string | false>) => classNames.filter(Boolean).join(' ')

export function StageDock({
  addingObservatory = false,
  onAddObservatory = () => {},
  onCollapsedChange,
}: StageDockProps) {
  const { activeStageId, expandedGroupIds, groups, stages } = useAppSelector((state) => state.stages)
  const [isCollapsed, setIsCollapsed] = useState(false)

  const toggleCollapsed = () => {
    const nextCollapsed = !isCollapsed
    setIsCollapsed(nextCollapsed)
    onCollapsedChange?.(nextCollapsed)
  }

  return (
    <motion.aside
      className={cx(styles.stageDock, isCollapsed && styles.collapsed)}
      aria-label="观察台切换与管理"
      layout
      initial={{ opacity: 0, scale: 0.92, x: '-50%', y: 16, filter: 'blur(4px)' }}
      animate={{
        opacity: 1,
        scale: 1,
        x: '-50%',
        y: 0,
        filter: 'blur(0px)',
      }}
      style={{ transformOrigin: 'center bottom' } as CSSProperties}
      transition={{ type: 'spring', bounce: 0, duration: 0.32 }}
    >
      <Tooltip title={isCollapsed ? '展开观察台坞' : '收起观察台坞'} placement="right">
        <button
          className={cx(styles.iconButton, styles.logo)}
          type="button"
          aria-label={isCollapsed ? '展开观察台坞' : '收起观察台坞'}
          aria-pressed={isCollapsed}
          onClick={toggleCollapsed}
        >
          <Layers3 aria-hidden="true" />
        </button>
      </Tooltip>

      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            className={styles.content}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4 }}
            transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
          >
            <StageList
              activeStageId={activeStageId}
              expandedGroupIds={expandedGroupIds}
              groups={groups}
              stages={stages}
            />
            <DockActions adding={addingObservatory} onAdd={onAddObservatory} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  )
}
