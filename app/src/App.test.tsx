import { ConfigProvider } from 'antd'
import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { appTheme } from './app/theme'
import { getBootstrap } from './features/observation/services/simulationClient'
import type { BootstrapData } from './features/observation/types'
import { createAppStore } from './store'

vi.mock('./features/observation/services/simulationClient', () => ({
  createObservatory: vi.fn(),
  getBootstrap: vi.fn(),
  subscribeToFrames: vi.fn(() => () => undefined),
}))

const bootstrap: BootstrapData = {
  cells: [
    {
      chirality: 1,
      elapsedMinutes: 0,
      heading: 0,
      id: 'cell-1',
      observatoryId: 'observatory-1',
      rngState: 1,
      seed: 1,
      state: 'run',
      stateElapsedMinutes: 0,
      x: 0,
      y: 0,
    },
  ],
  groups: [{ id: 'group-default', name: '默认组', sortOrder: 0 }],
  observatories: [
    {
      cameraX: 0,
      cameraY: 0,
      cameraZoom: 1,
      groupId: 'group-default',
      id: 'observatory-1',
      name: '观察台 01',
      palette: 'mint',
      params: {
        drRun: 0.005,
        drTurn: 0.031,
        omegaTurn: 0.16,
        tauRun: 29.9,
        tauTurn: 8.2,
        vRun: 0.39,
        vTurn: 0.32,
      },
      paused: false,
      simulatedMinutes: 0,
      tick: 0,
    },
  ],
}

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

beforeEach(() => {
  vi.mocked(getBootstrap).mockResolvedValue(bootstrap)
})

describe('App', () => {
  it('从本地运行时装载观察台并只渲染活动观察台画布', async () => {
    const { container } = renderApp()

    expect(await screen.findByRole('complementary', { name: '观察台切换与管理' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '添加细胞' })).toBeInTheDocument()
    expect(container.querySelectorAll('[data-observation-stage-id] canvas')).toHaveLength(1)
    expect(container.querySelector('[data-observation-stage-id="observatory-1"]')).toBeInTheDocument()
  })

  it('未知路径回退到群体观察台', async () => {
    renderApp('/missing')

    expect(await screen.findByLabelText('Runner-Rotor 多细胞群体与可变形膜动画')).toBeInTheDocument()
  })
})
