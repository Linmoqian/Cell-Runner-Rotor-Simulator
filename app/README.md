# Cell Runner 前端应用

## 技术栈

- React 19 + TypeScript 6 + Vite 8
- React Router：页面路由
- Redux Toolkit + React Redux：跨组件舞台状态
- Ant Design：主题 Token、语言环境与通用交互组件
- Motion：悬浮坞布局和拖拽动画
- Vitest + React Testing Library + jsdom：组件与状态测试
- Oxlint + Prettier：静态检查与格式化

## 目录职责

```text
src/
├── app/                       # 全局 Provider 与主题
├── features/
│   ├── observation/           # 观察视图
│   └── stage-dock/            # 悬浮坞、Resize Hook 与 Redux Slice
├── routes/                    # 路由级页面组装
├── store/                     # Store 与类型化 Hooks
├── test/                      # 测试环境初始化
├── App.tsx                    # 路由声明
└── main.tsx                   # 浏览器入口
```

组件样式采用同名 CSS Modules；`index.css` 仅保存字体、重置和应用级基础规则。

## 命令

```bash
npm run dev           # 启动 Vite 开发服务器
npm run format        # 写入 Prettier 格式
npm run format:check  # 检查格式
npm run lint          # 运行 Oxlint
npm run typecheck     # 运行 TypeScript 项目检查
npm run test          # 以监听模式运行 Vitest
npm run test:run      # 单次运行测试
npm run build         # 类型检查并生成生产包
npm run check         # 执行完整质量门禁
npm run preview       # 预览生产构建
```

## 状态边界

舞台列表、当前舞台和清空状态由 Redux Toolkit 管理，因为这些状态同时被悬浮坞和观察视图消费。坞的折叠、管理模式和实时尺寸属于组件局部交互状态，保留在组件与 Hook 内，避免扩大 Store。
