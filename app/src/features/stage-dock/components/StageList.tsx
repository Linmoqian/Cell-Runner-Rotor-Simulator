import { AnimatePresence, Reorder } from 'motion/react'
import { type KeyboardEvent, type MouseEvent, type WheelEvent, useEffect, useMemo, useState } from 'react'
import { useAppDispatch } from '../../../store/hooks'
import {
  copyStage,
  createStageGroup,
  moveStageToGroup,
  removeStage,
  reorderStages,
  selectStage,
  toggleStageGroup,
} from '../store/stageSlice'
import type { Stage, StageGroup } from '../types'
import { type ContextMenuState, StageContextMenu } from './StageContextMenu'
import styles from './StageDock.module.css'
import { StageItem } from './StageItem'

interface StageListProps {
  activeStageId: string
  expandedGroupIds: string[]
  groups: StageGroup[]
  stages: Stage[]
}

const paletteClasses = {
  mint: styles.mint,
  violet: styles.violet,
  amber: styles.amber,
  blue: styles.blue,
  rose: styles.rose,
}

function getKeyTargetIndex(key: string, stageIndex: number, stageCount: number) {
  return {
    ArrowDown: stageIndex + 1,
    ArrowRight: stageIndex + 1,
    ArrowUp: stageIndex - 1,
    ArrowLeft: stageIndex - 1,
    Home: 0,
    End: stageCount - 1,
  }[key]
}

function getContextMenuState(event: MouseEvent<HTMLButtonElement>, stage: Stage, stageIndex: number) {
  return {
    bottom: Math.max(window.innerHeight - event.clientY + 12, 12),
    stage,
    stageIndex,
    x: Math.max(12, Math.min(event.clientX, window.innerWidth - 350)),
  }
}

function useCloseContextMenu(contextMenu: ContextMenuState | null, onClose: () => void) {
  useEffect(() => {
    if (!contextMenu) return undefined

    const closeOnPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest(`.${styles.contextMenu}`)) return
      onClose()
    }
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('pointerdown', closeOnPointerDown)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('pointerdown', closeOnPointerDown)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [contextMenu, onClose])
}

function scrollStageList(event: WheelEvent<HTMLUListElement>) {
  const list = event.currentTarget
  if (list.scrollWidth <= list.clientWidth || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return

  event.preventDefault()
  list.scrollLeft += event.deltaY
}

export function StageList({ activeStageId, expandedGroupIds, groups, stages }: StageListProps) {
  const dispatch = useAppDispatch()
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const closeContextMenu = () => setContextMenu(null)
  const groupStages = useMemo(
    () => new Map(groups.map((group) => [group.id, stages.filter((stage) => stage.groupId === group.id)])),
    [groups, stages],
  )
  const visibleStages = useMemo(
    () =>
      stages.filter((stage) => {
        if (!stage.groupId || expandedGroupIds.includes(stage.groupId)) return true
        return groupStages.get(stage.groupId)?.[0]?.id === stage.id
      }),
    [expandedGroupIds, groupStages, stages],
  )

  useCloseContextMenu(contextMenu, closeContextMenu)

  const focusStage = (stageIndex: number) => {
    const nextStage = stages[(stageIndex + stages.length) % stages.length]
    dispatch(selectStage(nextStage.id))
    requestAnimationFrame(() =>
      document.querySelector<HTMLButtonElement>(`[data-stage-id="${nextStage.id}"]`)?.focus(),
    )
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, stageIndex: number) => {
    const targetIndex = getKeyTargetIndex(event.key, stageIndex, stages.length)
    if (targetIndex === undefined) return
    event.preventDefault()
    focusStage(targetIndex)
  }
  const openContextMenu = (event: MouseEvent<HTMLButtonElement>, stage: Stage, stageIndex: number) => {
    event.preventDefault()
    setContextMenu(getContextMenuState(event, stage, stageIndex))
  }

  return (
    <div className={styles.stageBrowser}>
      <Reorder.Group
        className={styles.stageList}
        axis="x"
        values={stages}
        onReorder={(nextStages) => dispatch(reorderStages(nextStages))}
        onWheel={scrollStageList}
        role="tablist"
        aria-label="观察台"
      >
        <AnimatePresence initial={false}>
          {visibleStages.map((stage) => {
            const stageIndex = stages.findIndex((candidate) => candidate.id === stage.id)
            const group = groups.find((candidate) => candidate.id === stage.groupId)
            const groupedStages = stage.groupId ? (groupStages.get(stage.groupId) ?? []) : []
            const isCollapsedGroup =
              groupedStages.length > 1 && !expandedGroupIds.includes(stage.groupId ?? '')
            const isGroupLead = isCollapsedGroup && groupedStages[0]?.id === stage.id

            return (
              <StageItem
                key={stage.id}
                group={group}
                groupedStages={groupedStages}
                isActive={stage.id === activeStageId}
                isCollapsedGroup={isCollapsedGroup}
                isGroupLead={isGroupLead}
                onContextMenu={(event) => openContextMenu(event, stage, stageIndex)}
                onKeyDown={(event) => handleKeyDown(event, stageIndex)}
                onSelect={() => dispatch(selectStage(stage.id))}
                onToggleGroup={() => stage.groupId && dispatch(toggleStageGroup(stage.groupId))}
                paletteClass={paletteClasses[stage.palette]}
                stage={stage}
                stageIndex={stageIndex}
              />
            )
          })}
        </AnimatePresence>
      </Reorder.Group>
      <StageContextMenu
        canDelete={stages.length > 1}
        contextMenu={contextMenu}
        groups={groups}
        onCopy={(stage) => {
          dispatch(copyStage(stage.id))
          closeContextMenu()
        }}
        onCreateGroup={(stage, name) => {
          dispatch(createStageGroup({ name, stageId: stage.id }))
          closeContextMenu()
        }}
        onDelete={(stage) => {
          dispatch(removeStage(stage.id))
          closeContextMenu()
        }}
        onMoveToGroup={(stage, groupId) => {
          dispatch(moveStageToGroup({ groupId, stageId: stage.id }))
          closeContextMenu()
        }}
      />
    </div>
  )
}
