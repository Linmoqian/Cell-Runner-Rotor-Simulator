import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createRunnerRotorCell } from '../model/runnerRotor'
import { ObservationViewport } from './ObservationViewport'

describe('ObservationViewport', () => {
  it('使用鼠标中键拖动坐标舞台后保留圆心偏移', () => {
    render(
      <ObservationViewport
        activeStageNumber={1}
        initialCells={[]}
        observatoryId="observatory-1"
        onSnapshot={() => createRunnerRotorCell()}
        resetKey="test"
      />,
    )
    const stagePlane = screen.getByRole('region', {
      name: '可平移缩放的观察台；滚轮缩放，中键或左键拖动',
    })

    expect(screen.getByText(/ORIGIN \/ X \+000 Y \+000 PX · ZOOM 1\.00×/)).toBeInTheDocument()

    fireEvent.pointerDown(stagePlane, { pointerId: 1, button: 1, clientX: 100, clientY: 120 })
    expect(stagePlane).toHaveAttribute('aria-grabbed', 'true')
    fireEvent.pointerMove(stagePlane, { pointerId: 1, clientX: 132, clientY: 95 })
    fireEvent.pointerUp(stagePlane, { pointerId: 1 })

    expect(stagePlane).toHaveStyle({ transform: 'translate(32px, -25px)' })
    expect(stagePlane).toHaveAttribute('aria-grabbed', 'false')
    expect(screen.getByText(/ORIGIN \/ X \+032 Y -025 PX · ZOOM 1\.00×/)).toBeInTheDocument()
    expect(screen.getByLabelText('Runner-Rotor 多细胞群体与可变形膜动画')).toBeInTheDocument()
  })

  it('使用鼠标滚轮围绕指针缩放观察台', () => {
    render(
      <ObservationViewport
        activeStageNumber={1}
        initialCells={[]}
        observatoryId="observatory-1"
        onSnapshot={() => createRunnerRotorCell()}
        resetKey="test"
      />,
    )
    const stagePlane = screen.getByRole('region', {
      name: '可平移缩放的观察台；滚轮缩放，中键或左键拖动',
    })

    fireEvent.wheel(stagePlane.parentElement!, { clientX: 0, clientY: 0, deltaY: -100 })

    expect(screen.getByText(/ZOOM 1\.16×/)).toBeInTheDocument()
  })
})
