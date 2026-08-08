import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from 'react'

const dockBaseWidth = 128

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const getDefaultDockSize = () => ({
  width: dockBaseWidth,
  height: Math.round((typeof window === 'undefined' ? 900 : window.innerHeight) * (2 / 3)),
})

const constrainDockSize = (width: number, height: number) => ({
  width: clamp(width, 72, Math.min(320, window.innerWidth * 0.5)),
  height: clamp(height, 220, window.innerHeight - 48),
})

export function useDockResize() {
  const [dockSize, setDockSize] = useState(getDefaultDockSize)
  const [isResizing, setIsResizing] = useState(false)
  const dockBaseHeight = useRef(dockSize.height)
  const resizeStart = useRef<{ x: number; y: number; width: number; height: number } | null>(null)
  const pendingResize = useRef<{ width: number; height: number } | null>(null)
  const resizeFrame = useRef<number | null>(null)
  const dockScale = clamp(
    Math.min(dockSize.width / dockBaseWidth, dockSize.height / dockBaseHeight.current),
    0.72,
    2,
  )

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
    resizeStart.current = { x: event.clientX, y: event.clientY, ...dockSize }
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
      if (resizeFrame.current !== null) return

      resizeFrame.current = requestAnimationFrame(() => {
        if (pendingResize.current) setDockSize(pendingResize.current)
        resizeFrame.current = null
      })
    }

    const stopResize = () => {
      if (pendingResize.current) setDockSize(pendingResize.current)
      resizeStart.current = null
      pendingResize.current = null
      setIsResizing(false)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopResize)
    window.addEventListener('pointercancel', stopResize)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', stopResize)
      window.removeEventListener('pointercancel', stopResize)
      if (resizeFrame.current !== null) cancelAnimationFrame(resizeFrame.current)
      resizeFrame.current = null
    }
  }, [isResizing])

  return {
    dockScale,
    dockSize,
    handleResizeKeyDown,
    isResizing,
    resetDockSize,
    startDockResize,
  }
}
