import { ConfigProvider } from 'antd'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import App from './App'
import { appTheme } from './app/theme'
import { createAppStore } from './store'

const renderApp = (initialEntry = '/') =>
  render(
    <Provider store={createAppStore()}>
      <ConfigProvider theme={appTheme}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <App />
        </MemoryRouter>
      </ConfigProvider>
    </Provider>,
  )

describe('App', () => {
  it('渲染观察舞台并添加新舞台', async () => {
    const user = userEvent.setup()
    const { container } = renderApp()

    expect(await screen.findByRole('complementary', { name: '舞台切换与管理' })).toBeInTheDocument()
    const firstStageCanvas = container.querySelector('[data-observation-stage-id="stage-1"] canvas')
    await user.click(screen.getByRole('button', { name: '添加舞台' }))

    expect(screen.getByRole('tab', { name: '切换到第 2 个舞台' })).toHaveAttribute('aria-selected', 'true')
    expect(container.querySelectorAll('[data-observation-stage-id] canvas')).toHaveLength(2)

    await user.click(screen.getByRole('tab', { name: '切换到第 1 个舞台' }))

    expect(container.querySelector('[data-observation-stage-id="stage-1"] canvas')).toBe(firstStageCanvas)
    expect(container.querySelector('[data-observation-stage-id="stage-1"]')).not.toHaveAttribute('hidden')
    expect(
      container.querySelector('[data-observation-stage-id]:not([data-observation-stage-id="stage-1"])'),
    ).toHaveAttribute('hidden')
  })

  it('未知路径回退到观察舞台', async () => {
    renderApp('/missing')

    expect(await screen.findByLabelText('Runner-Rotor 单细胞运动与可变形膜动画')).toBeInTheDocument()
  })
})
