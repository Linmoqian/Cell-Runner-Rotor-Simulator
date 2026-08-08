import { Reorder } from 'motion/react'
import type { KeyboardEvent, MouseEvent } from 'react'
import type { Stage, StageGroup } from '../types'
import styles from './StageDock.module.css'

interface StageItemProps {
  group?: StageGroup
  groupedStages: Stage[]
  isActive: boolean
  isCollapsedGroup: boolean
  isGroupLead: boolean
  onContextMenu: (event: MouseEvent<HTMLButtonElement>) => void
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void
  onSelect: () => void
  onToggleGroup: () => void
  paletteClass: string
  stage: Stage
  stageIndex: number
}

export function StageItem({
  group,
  groupedStages,
  isActive,
  isCollapsedGroup,
  isGroupLead,
  onContextMenu,
  onKeyDown,
  onSelect,
  onToggleGroup,
  paletteClass,
  stage,
  stageIndex,
}: StageItemProps) {
  return (
    <Reorder.Item className={styles.stageItem} value={stage} layout>
      <button
        className={`${styles.stageThumbnail} ${paletteClass}${isActive ? ` ${styles.active}` : ''}${isGroupLead ? ` ${styles.groupThumbnail}` : ''}`}
        type="button"
        role="tab"
        aria-label={isGroupLead ? `展开${group?.name}` : `切换到第 ${stageIndex + 1} 个舞台`}
        aria-selected={isActive}
        data-stage-id={stage.id}
        tabIndex={isActive ? 0 : -1}
        onClick={isGroupLead ? onToggleGroup : onSelect}
        onContextMenu={onContextMenu}
        onKeyDown={onKeyDown}
      >
        <span className={styles.thumbnailFrame} />
        <span className={styles.thumbnailSpecimen} />
        {isGroupLead ? (
          <span className={styles.groupCount} aria-hidden="true">
            {groupedStages.length}
          </span>
        ) : (
          <span className={styles.thumbnailIndex} aria-hidden="true">
            {String(stageIndex + 1).padStart(2, '0')}
          </span>
        )}
        <span className={styles.activeMarker} aria-hidden="true" />
      </button>
      {group && !isCollapsedGroup && groupedStages[0]?.id === stage.id && (
        <button
          className={styles.groupCollapse}
          type="button"
          aria-label={`收起${group.name}`}
          onClick={onToggleGroup}
        >
          {group.name}
        </button>
      )}
    </Reorder.Item>
  )
}
