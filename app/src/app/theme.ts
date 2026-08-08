import { theme, type ThemeConfig } from 'antd'

export const appTheme: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#b4edca',
    colorBgBase: '#11191d',
    colorTextBase: '#dbe8e4',
    borderRadius: 12,
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  },
  components: {
    Tooltip: {
      colorBgSpotlight: 'rgba(10, 18, 20, 0.96)',
      colorTextLightSolid: '#dcebe6',
      borderRadius: 8,
    },
  },
}
