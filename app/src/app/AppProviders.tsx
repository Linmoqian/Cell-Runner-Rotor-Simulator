import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import type { PropsWithChildren } from 'react'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router'
import { store } from '../store'
import { appTheme } from './theme'

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <Provider store={store}>
      <ConfigProvider locale={zhCN} theme={appTheme}>
        <BrowserRouter>{children}</BrowserRouter>
      </ConfigProvider>
    </Provider>
  )
}
