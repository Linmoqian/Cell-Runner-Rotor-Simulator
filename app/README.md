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
│   ├── observation/           # 后端帧客户端、单 Canvas 群体观察视图
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

观察台及分组索引由启动时的后端 bootstrap 水合到 Redux，当前观察台由悬浮坞和观察视图共同消费。科学状态、细胞轨迹和随机数状态只存在于后端；前端逐帧数据保留在 Canvas 组件的 ref/Map 中，不进入 Redux，避免触发群体级 React 重渲染。

Web 开发需同时启动仓库 `server/`。Tauri 环境由 `window.__TAURI__` 自动切换到 Rust command/事件，不需要另一套页面代码。
