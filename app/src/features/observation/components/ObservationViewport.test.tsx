import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ObservationViewport } from './ObservationViewport'

describe('ObservationViewport', () => {
  it('拖动坐标舞台后保留圆心偏移', () => {
    render(<ObservationViewport activeStageNumber={1} />)
    const stagePlane = screen.getByRole('region', { name: '可拖动的坐标舞台；使用方向键微调' })

    expect(screen.getByText('ORIGIN / X +000 Y +000 PX')).toBeInTheDocument()

    fireEvent.pointerDown(stagePlane, { pointerId: 1, clientX: 100, clientY: 120 })
    expect(stagePlane).toHaveAttribute('aria-grabbed', 'true')
    fireEvent.pointerMove(stagePlane, { pointerId: 1, clientX: 132, clientY: 95 })
    fireEvent.pointerUp(stagePlane, { pointerId: 1 })

    expect(stagePlane).toHaveStyle({ transform: 'translate(32px, -25px)' })
    expect(stagePlane).toHaveAttribute('aria-grabbed', 'false')
    expect(screen.getByText('ORIGIN / X +032 Y -025 PX')).toBeInTheDocument()
  })
})
