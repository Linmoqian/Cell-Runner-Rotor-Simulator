# Cell Runner · Rotor Simulator

面向细胞角色运动与转子模拟的交互原型。当前应用提供可调整尺寸的悬浮舞台坞、舞台管理与显微观察视图，并保留独立的 Processing 程序动画草图。

## 项目结构

```text
.
├── app/                    # React + TypeScript + Vite 主应用
│   ├── src/features/       # 按业务能力拆分的前端模块
│   ├── src/routes/         # 页面路由组装
│   ├── src/store/          # Redux Toolkit Store 与类型化 Hooks
│   └── cell-proc-anim/     # 独立 Processing 程序动画草图（Git 子模块）
├── docs/development/       # 工程专题规范
└── skills/                 # 项目工程协作 Skill
```

## 本地开发

要求 Node.js 20.19+ 或 22.12+，并使用 npm 与仓库锁文件。

```bash
cd app
npm ci
npm run dev
```

开发服务器默认使用 <http://localhost:3223>。

## 质量检查

```bash
cd app
npm run check
```

`check` 依次执行格式检查、Oxlint、TypeScript 类型检查、Vitest 测试和生产构建。单项命令及架构说明见 [应用文档](app/README.md)。

## 工程约束

- 通用规则见 [AGENTS.md](AGENTS.md) 与 [CLAUDE.md](CLAUDE.md)。
- 前端开发遵循 [docs/development/frontend.md](docs/development/frontend.md)。
- Processing 草图保持独立，不与 React 构建流程耦合；其源码通过 Git 子模块跟踪 [cell-proc-anim](https://github.com/Linmoqian/cell-proc-anim)。
- 克隆后执行 `git submodule update --init --recursive` 获取草图；如需拉取上游 `main` 的新版本，执行 `git submodule update --remote app/cell-proc-anim`，再提交更新后的子模块引用。
