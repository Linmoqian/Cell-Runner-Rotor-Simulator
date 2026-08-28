# Cell Runner 前端应用

## 技术栈

- React 19 + TypeScript 6 + Vite 8
- React Router：页面路由
- Redux Toolkit + React Redux：跨组件观察台索引状态
- Ant Design：主题 Token、语言环境与通用交互组件
- Motion：悬浮坞布局和拖拽动画
- Vitest + React Testing Library + jsdom：组件与状态测试
- Oxlint + Prettier：静态检查与格式化

## 目录职责

```text
src/
├── app/                       # 全局 Provider 与主题
├── features/
│   ├── observation/           # 本地 Worker 科学运行时、IndexedDB 与群体观察视图
│   └── stage-dock/            # 观察台分组、切换坞与 Redux Slice
├── routes/                    # 路由级页面组装
├── store/                     # Store 与类型化 Hooks
├── test/                      # 测试环境初始化
├── App.tsx                    # 路由声明
└── main.tsx                   # 浏览器入口
```

组件样式采用同名 CSS Modules；`index.css` 仅保存字体、重置和应用级基础规则。

## 命令

```bash
pnpm run dev           # 启动 Vite 开发服务器
pnpm run format        # 写入 Prettier 格式
pnpm run format:check  # 检查格式
pnpm run lint          # 运行 Oxlint
pnpm run typecheck     # 运行 TypeScript 项目检查
pnpm run test          # 以监听模式运行 Vitest
pnpm run test:run      # 单次运行测试
pnpm run build         # 类型检查并生成生产包
pnpm run check         # 执行完整质量门禁
pnpm run preview       # 预览生产构建
```

## 状态边界

Web 版启动时从 IndexedDB 恢复检查点，并由 Web Worker 水合观察台索引。Worker 持有科学状态、细胞轨迹和随机数状态；React 主线程只接收 latest-only 帧。逐帧数据保留在 Canvas 的 ref/Map 中，不进入 Redux，避免群体级 React 重渲染。

Web 开发在本目录执行 `pnpm run dev`，不需要启动 `server/`。Tauri 环境由 `window.__TAURI__` 自动切换到 Rust command/事件，不需要另一套页面代码。Node `server/` 只保留为本地科学对照和批处理工具。
