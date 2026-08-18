import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { NeedleBox } from './NeedleBox'

describe('NeedleBox', () => {
  it('渲染针盒、槽位提示与可拿取的针', () => {
    render(<NeedleBox />)

    const box = screen.getByRole('complementary', { name: '针盒' })
    const needle = screen.getByRole('button', { name: '拿起针' })

    expect(box).toHaveAttribute('data-needle-state', 'stored')
    expect(needle).toBeEnabled()
    expect(screen.getByText('点击针拿起')).toBeInTheDocument()
  })

  it('点击针后进入拿取动画并变为跟随鼠标状态', async () => {
    render(<NeedleBox />)

    const box = screen.getByRole('complementary', { name: '针盒' })
    const needle = screen.getByRole('button', { name: '拿起针' })

    fireEvent.click(needle, { clientX: 320, clientY: 200 })

    expect(box).toHaveAttribute('data-needle-state', 'lifting')
    expect(screen.getByText('正在拿取针…')).toBeInTheDocument()

    await waitFor(() => expect(box).toHaveAttribute('data-needle-state', 'held'))

    expect(needle).toBeDisabled()
    expect(screen.getByText(/针头已对准鼠标，随鼠标移动/)).toBeInTheDocument()
  })

  it('针被拿起后点击盒子放回盒中', async () => {
    render(<NeedleBox />)

    const box = screen.getByRole('complementary', { name: '针盒' })
    const needle = screen.getByRole('button', { name: '拿起针' })

    fireEvent.click(needle, { clientX: 320, clientY: 200 })
    await waitFor(() => expect(box).toHaveAttribute('data-needle-state', 'held'))

    fireEvent.click(box)

    expect(box).toHaveAttribute('data-needle-state', 'returning')
    expect(screen.getByText('正在放回针…')).toBeInTheDocument()
  })
})
