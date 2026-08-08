import { AnimatePresence, Reorder, motion } from 'motion/react'
import { Grip, Layers3, Plus, SlidersHorizontal, Trash2 } from 'lucide-react'
import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from 'react'
import './App.css'

const stagePalette = ['mint', 'violet', 'amber', 'blue', 'rose']
const dockBaseWidth = 128
const getDefaultDockSize = () => {
  const viewportHeight = typeof window === 'undefined' ? 900 : window.innerHeight

  return {
    width: dockBaseWidth,
    height: Math.round(viewportHeight * (2 / 3)),
  }
}
const initialStages = stagePalette.slice(0, 1).map((palette, index) => ({
  id: `stage-${index + 1}`,
  palette,
}))

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const constrainDockSize = (width: number, height: number) => ({
  width: clamp(width, 72, Math.min(320, window.innerWidth * 0.5)),
  height: clamp(height, 220, window.innerHeight - 48),
})

function App() {
  const [stages, setStages] = useState(initialStages)
  const [activeStageId, setActiveStageId] = useState(initialStages[0].id)
  const [isManaging, setIsManaging] = useState(false)
  const [isDockCollapsed, setIsDockCollapsed] = useState(false)
  const [dockSize, setDockSize] = useState(getDefaultDockSize)
  const [clearedStageIds, setClearedStageIds] = useState(() => new Set([initialStages[0].id]))
  const dockBaseHeight = useRef(dockSize.height)
  const resizeStart = useRef<{ x: number; y: number; width: number; height: number } | null>(null)
  const pendingResize = useRef<{ width: number; height: number } | null>(null)
  const resizeFrame = useRef<number | null>(null)
  const [isResizing, setIsResizing] = useState(false)
  const activeStage = stages.findIndex((stage) => stage.id === activeStageId)
  const isActiveStageCleared = clearedStageIds.has(activeStageId)
  const dockScale = clamp(Math.min(dockSize.width / dockBaseWidth, dockSize.height / dockBaseHeight.current), 0.72, 2)

  const addStage = () => {
    if (stages.length >= stagePalette.length) return

    const usedPalettes = new Set(stages.map((stage) => stage.palette))
    const nextPalette = stagePalette.find((palette) => !usedPalettes.has(palette)) ?? stagePalette[stages.length]
    const nextStage = {
      id: `stage-${Date.now()}`,
      palette: nextPalette,
    }
    setStages((currentStages) => [...currentStages, nextStage])
    setClearedStageIds((currentIds) => new Set(currentIds).add(nextStage.id))
    setActiveStageId(nextStage.id)
  }

  const removeStage = (stageId: string) => {
    if (stages.length === 1) return

    const stageIndex = stages.findIndex((stage) => stage.id === stageId)
    const currentStageIndex = stages.findIndex((stage) => stage.id === activeStageId)
    const nextActiveStage = stages[stageIndex - 1] ?? stages[stageIndex + 1]
    setStages((currentStages) => currentStages.filter((stage) => stage.id !== stageId))

    if (stageId === activeStageId) {
      setActiveStageId(nextActiveStage.id)
    } else if (stageIndex < currentStageIndex) {
      setActiveStageId(activeStageId)
    }
  }

  const focusStage = (stageIndex: number) => {
    const nextStage = stages[(stageIndex + stages.length) % stages.length]
    setActiveStageId(nextStage.id)
    requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>(`[data-stage-id="${nextStage.id}"]`)?.focus()
    })
  }

  const handleStageKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, stageIndex: number) => {
    const keyTargets = {
      ArrowDown: stageIndex + 1,
      ArrowRight: stageIndex + 1,
      ArrowUp: stageIndex - 1,
      ArrowLeft: stageIndex - 1,
      Home: 0,
      End: stages.length - 1,
    } as const
    const targetIndex = keyTargets[event.key as keyof typeof keyTargets]

    if (targetIndex === undefined) return
    event.preventDefault()
    focusStage(targetIndex)
  }

  const resetDockSize = () => setDockSize(getDefaultDockSize())

  const handleResizeKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Home') {
      event.preventDefault()
      resetDockSize()
      return
    }

    const step = event.shiftKey ? 24 : 8
    const deltas = {
      ArrowLeft: { width: -step, height: 0 },
      ArrowRight: { width: step, height: 0 },
      ArrowUp: { width: 0, height: -step },
      ArrowDown: { width: 0, height: step },
    } as const
    const delta = deltas[event.key as keyof typeof deltas]

    if (!delta) return
    event.preventDefault()
    setDockSize((currentSize) =>
      constrainDockSize(currentSize.width + delta.width, currentSize.height + delta.height),
    )
  }

  const startDockResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    resizeStart.current = {
      x: event.clientX,
      y: event.clientY,
      width: dockSize.width,
      height: dockSize.height,
    }
    setIsResizing(true)
  }

  useEffect(() => {
    if (!isResizing) return undefined

    const handlePointerMove = (event: PointerEvent) => {
      if (!resizeStart.current) return

      pendingResize.current = constrainDockSize(
        resizeStart.current.width + event.clientX - resizeStart.current.x,
        resizeStart.current.height + event.clientY - resizeStart.current.y,
      )

      if (resizeFrame.current === null) {
        resizeFrame.current = requestAnimationFrame(() => {
          if (pendingResize.current) setDockSize(pendingResize.current)
          resizeFrame.current = null
        })
      }
    }

    const handlePointerUp = () => {
      if (pendingResize.current) setDockSize(pendingResize.current)
      resizeStart.current = null
      pendingResize.current = null
      setIsResizing(false)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
      if (resizeFrame.current !== null) cancelAnimationFrame(resizeFrame.current)
      resizeFrame.current = null
    }
  }, [isResizing])

  useEffect(() => {
    if (!isManaging) return undefined

    const stopManaging = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsManaging(false)
    }

    window.addEventListener('keydown', stopManaging)
    return () => window.removeEventListener('keydown', stopManaging)
  }, [isManaging])

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('debug:stage-ready', {
        detail: { surface: 'character-observation-stage' },
      }),
    )
  }, [])

  return (
    <main className={`observatory${isDockCollapsed ? ' dock-collapsed' : ''}`}>
      <motion.aside
        className={`stage-dock${isManaging ? ' is-managing' : ''}${isDockCollapsed ? ' is-collapsed' : ''}${isResizing ? ' is-resizing' : ''}`}
        aria-label="舞台切换与管理"
        layout={!isResizing}
        initial={{ opacity: 0, scale: 0.96, x: -8, filter: 'blur(4px)' }}
        animate={{
          opacity: 1,
          scale: 1,
          x: 0,
          filter: 'blur(0px)',
          width: isDockCollapsed ? 48 : dockSize.width,
          height: isDockCollapsed ? 48 : dockSize.height,
        }}
        style={{ '--dock-scale': dockScale, transformOrigin: 'top left' } as CSSProperties}
        transition={isResizing ? { duration: 0 } : { type: 'spring', duration: 0.24, bounce: 0.08 }}
      >
        <button
          className="dock-icon-button dock-logo"
          type="button"
          aria-label={isDockCollapsed ? '展开舞台坞' : '收起舞台坞'}
          aria-pressed={isDockCollapsed}
          data-tooltip={isDockCollapsed ? '展开舞台坞' : '收起舞台坞'}
          onClick={() => setIsDockCollapsed((collapsed) => !collapsed)}
        >
          <Layers3 aria-hidden="true" />
        </button>

        <AnimatePresence initial={false}>
          {!isDockCollapsed && (
            <motion.div
              className="dock-content"
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -4 }}
              transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
            >
              <div className="stage-browser">
                <div className="stage-list-header" aria-hidden="true">
                  <span>舞台</span>
                  <span>{String(stages.length).padStart(2, '0')}</span>
                </div>
                <Reorder.Group
                  className="stage-list"
                  axis="y"
                  values={stages}
                  onReorder={setStages}
                  role="tablist"
                  aria-label="观察舞台"
                >
                  <AnimatePresence initial={false}>
                    {stages.map((stage, stageIndex) => (
                      <Reorder.Item
                        className="stage-item"
                        key={stage.id}
                        value={stage}
                        layout
                        initial={{ opacity: 0, scale: 0.94, y: -8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.94, y: 8 }}
                        transition={{ type: 'spring', duration: 0.22, bounce: 0.12 }}
                        whileDrag={{ scale: 1.04, zIndex: 2, cursor: 'grabbing' }}
                      >
                        <button
                          className={`stage-thumbnail stage-thumbnail-${stage.palette}${activeStage === stageIndex ? ' is-active' : ''}`}
                          type="button"
                          role="tab"
                          aria-label={`切换到第 ${stageIndex + 1} 个舞台`}
                          aria-selected={activeStage === stageIndex}
                          data-stage-id={stage.id}
                          tabIndex={activeStage === stageIndex ? 0 : -1}
                          onClick={() => setActiveStageId(stage.id)}
                          onKeyDown={(event) => handleStageKeyDown(event, stageIndex)}
                        >
                          <span className="thumbnail-frame" />
                          <span className="thumbnail-specimen" />
                          <span className="stage-thumbnail-index" aria-hidden="true">
                            {String(stageIndex + 1).padStart(2, '0')}
                          </span>
                          <span className="stage-active-marker" aria-hidden="true" />
                        </button>
                        <AnimatePresence>
                          {isManaging && stages.length > 1 && (
                            <motion.button
                              className="stage-remove"
                              type="button"
                              aria-label={`删除第 ${stageIndex + 1} 个舞台`}
                              onClick={() => removeStage(stage.id)}
                              initial={{ opacity: 0, scale: 0.9, rotate: -12 }}
                              animate={{ opacity: 1, scale: 1, rotate: 0 }}
                              exit={{ opacity: 0, scale: 0.94, rotate: 12 }}
                              transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
                            >
                              <Trash2 aria-hidden="true" />
                            </motion.button>
                          )}
                        </AnimatePresence>
                      </Reorder.Item>
                    ))}
                  </AnimatePresence>
                </Reorder.Group>
              </div>

              <div className="dock-actions">
                <button
                  className="dock-icon-button"
                  type="button"
                  aria-label="添加舞台"
                  data-tooltip={stages.length >= stagePalette.length ? '已达到舞台上限' : '添加舞台'}
                  onClick={addStage}
                  disabled={stages.length >= stagePalette.length}
                >
                  <Plus aria-hidden="true" />
                </button>
                <button
                  className={`dock-icon-button${isManaging ? ' is-selected' : ''}`}
                  type="button"
                  aria-label={isManaging ? '完成舞台管理' : '管理舞台'}
                  aria-pressed={isManaging}
                  data-tooltip={isManaging ? '完成管理 · Esc' : '管理舞台'}
                  onClick={() => setIsManaging((managing) => !managing)}
                >
                  <SlidersHorizontal aria-hidden="true" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {!isDockCollapsed && (
          <button
            className="dock-resize-handle"
            type="button"
            aria-label="调整舞台坞大小；使用方向键微调，Shift 加速，Home 重置"
            aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Home"
            onDoubleClick={resetDockSize}
            onKeyDown={handleResizeKeyDown}
            onPointerDown={startDockResize}
          >
            <Grip aria-hidden="true" />
          </button>
        )}
      </motion.aside>

      {!isActiveStageCleared && (
        <>
          <header className="observatory-header">
            <div>
              <p className="eyebrow">CELL RUNNER / OBSERVATION DECK</p>
              <h1>角色观察台</h1>
            </div>
            <div className="session-status" aria-label="观察状态">
              <span className="status-dot" />
              <span>LIVE SPECIMEN</span>
            </div>
          </header>

          <section className="observation-layout" aria-label="显微镜角色观察舞台">
            <aside className="observation-notes">
              <p className="label">SPECIMEN {String(activeStage + 1).padStart(2, '0')}</p>
              <h2>未命名角色</h2>
              <p className="description">
                进入观察范围后，角色的运动、轮廓和反应将被记录在这块视野中。
              </p>
              <dl className="readings">
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

            <div className="stage-frame">
              <div className="stage-toolbar">
                <span>FIELD / A-{String(activeStage + 1).padStart(2, '0')}</span>
                <span>40° 42' 51" N</span>
              </div>
              <div className="stage-viewport">
                <div className="crosshair crosshair-horizontal" />
                <div className="crosshair crosshair-vertical" />
                <div className="specimen-orbit" aria-hidden="true">
                  <div className="specimen">
                    <span className="specimen-eye specimen-eye-left" />
                    <span className="specimen-eye specimen-eye-right" />
                    <span className="specimen-limb specimen-limb-left" />
                    <span className="specimen-limb specimen-limb-right" />
                  </div>
                </div>
                <span className="scale-mark scale-mark-top">100 μm</span>
                <span className="scale-mark scale-mark-bottom">◉ centered / ready</span>
              </div>
              <div className="stage-footer">
                <span>OPTICAL CHANNEL / CH-01</span>
                <span className="footer-line" />
                <span>OBSERVATION MODE</span>
              </div>
            </div>
          </section>

          <footer className="observatory-footer">
            <span>CHARACTER SYSTEM</span>
            <span className="footer-rule" />
            <span>Awaiting motion input</span>
          </footer>
        </>
      )}

      {isActiveStageCleared && (
        <section className="empty-observation" aria-label="空观察舞台">
          <div className="stage-frame stage-frame-empty">
            <div className="stage-viewport">
              <div className="crosshair crosshair-horizontal" />
              <div className="crosshair crosshair-vertical" />
            </div>
          </div>
        </section>
      )}
    </main>
  )
}

export default App
