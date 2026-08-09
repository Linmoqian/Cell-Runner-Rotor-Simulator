import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createRunnerRotorCell, MCF10A_COLLAGEN } from '../model/runnerRotor'
import { ModelControls } from './ModelControls'

describe('ModelControls', () => {
  it('实时提交论文参数并提供播放控制', () => {
    const onChange = vi.fn()
    const onAddCell = vi.fn()
    const onReset = vi.fn()
    const onTogglePause = vi.fn()
    const onExport = vi.fn()
    render(
      <ModelControls
        addingCell={false}
        cellCount={12}
        onAddCell={onAddCell}
        onChange={onChange}
        onExport={onExport}
        onReset={onReset}
        onTogglePause={onTogglePause}
        params={MCF10A_COLLAGEN}
        paused={false}
        snapshot={createRunnerRotorCell()}
        batchExportAvailable
        batchExporting={false}
        batchExportResult={null}
      />,
    )

    fireEvent.change(screen.getByRole('slider', { name: '转向角速度' }), {
      target: { value: '0.25' },
    })
    fireEvent.click(screen.getByRole('button', { name: '暂停' }))
    fireEvent.click(screen.getByRole('button', { name: '添加细胞' }))
    fireEvent.click(screen.getByRole('button', { name: '清空尾迹' }))
    fireEvent.click(screen.getByRole('button', { name: '导出原始统计' }))

    expect(onChange).toHaveBeenCalledWith({ ...MCF10A_COLLAGEN, omegaTurn: 0.25 })
    expect(onTogglePause).toHaveBeenCalledOnce()
    expect(onAddCell).toHaveBeenCalledOnce()
    expect(onReset).toHaveBeenCalledOnce()
    expect(onExport).toHaveBeenCalledWith({
      cellCount: 32,
      dtMinutes: 0.1,
      durationMinutes: 240,
      seed: 20260810,
    })
    expect(screen.getByText('12 cells')).toBeInTheDocument()
  })
})
