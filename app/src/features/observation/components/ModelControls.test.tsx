import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createRunnerRotorCell, MCF10A_COLLAGEN } from '../model/runnerRotor'
import { ModelControls } from './ModelControls'

describe('ModelControls', () => {
  it('实时提交论文参数并提供播放控制', () => {
    const onChange = vi.fn()
    const onReset = vi.fn()
    const onTogglePause = vi.fn()
    render(
      <ModelControls
        onChange={onChange}
        onReset={onReset}
        onTogglePause={onTogglePause}
        params={MCF10A_COLLAGEN}
        paused={false}
        snapshot={createRunnerRotorCell()}
      />,
    )

    fireEvent.change(screen.getByRole('slider', { name: '转向角速度' }), {
      target: { value: '0.25' },
    })
    fireEvent.click(screen.getByRole('button', { name: '暂停' }))
    fireEvent.click(screen.getByRole('button', { name: '重置轨迹' }))

    expect(onChange).toHaveBeenCalledWith({ ...MCF10A_COLLAGEN, omegaTurn: 0.25 })
    expect(onTogglePause).toHaveBeenCalledOnce()
    expect(onReset).toHaveBeenCalledOnce()
  })
})
