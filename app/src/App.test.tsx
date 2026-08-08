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
    renderApp()

    expect(await screen.findByRole('complementary', { name: '舞台切换与管理' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '添加舞台' }))

    expect(screen.getByRole('tab', { name: '切换到第 2 个舞台' })).toHaveAttribute('aria-selected', 'true')
  })

  it('未知路径回退到观察舞台', async () => {
    renderApp('/missing')

    expect(await screen.findByRole('region', { name: '空观察舞台' })).toBeInTheDocument()
  })
})
