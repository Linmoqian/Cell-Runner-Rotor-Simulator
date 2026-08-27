# Cell Runner · Rotor Simulator

面向细胞群体 Runner-Rotor 运动与涌现现象观察的交互模拟器。科学轨迹由 Node.js Web 后端或 Rust 桌面后端产生，React 前端只订阅科学帧并绘制可变形细胞。

## 项目结构

```text
.
├── app/                    # React + TypeScript + Vite 主应用
│   ├── src-tauri/          # Rust 多线程桌面运行时与 SQLite 单写者
│   ├── src/features/       # 按业务能力拆分的前端模块
│   ├── src/routes/         # 页面路由组装
│   ├── src/store/          # Redux Toolkit Store 与类型化 Hooks
│   └── cell-proc-anim/     # 独立 Processing 程序动画草图（Git 子模块）
├── server/                 # Node.js Worker Threads Web 运行时
├── docs/                   # 架构、接口与工程专题规范
└── skills/                 # 项目工程协作 Skill
```

## 本地开发

Web 运行时要求 Node.js 24+（使用内置 SQLite），项目统一使用 pnpm。首次安装依赖后，用一个命令启动 Node 后端和 Vite 前端：

```bash
pnpm --dir app install --frozen-lockfile
pnpm --dir server install --frozen-lockfile
pnpm install --frozen-lockfile
pnpm run dev:web
```

Node 后端默认监听 <http://127.0.0.1:8788>，开发服务器默认使用 <http://localhost:3223> 并代理 `/api`。桌面开发不使用这套 Node Web 后端：在 `app/` 执行 `pnpm run dev`，再在 `app/src-tauri/` 执行 `cargo run`，此时科学模拟和 SQLite 持久化均由 Rust 线程运行。

## 质量检查

```bash
cd app
pnpm run check

cd ../server
pnpm run check

cd ../app/src-tauri
cargo clippy --offline --all-targets -- -D warnings
cargo test --offline
```

`check` 依次执行格式检查、Oxlint、TypeScript 类型检查、Vitest 测试和生产构建。单项命令及架构说明见 [应用文档](app/README.md)。

## 可重复科学批处理

Node 运行时可固定种子离线导出原始统计数据，不依赖 UI、SQLite 或真实时间调度：

```bash
cd server
pnpm run experiment:export -- --seed 20260810 --cells 32 --duration-minutes 240 --dt-minutes 0.1 --output artifacts/batch-20260810
```

输出目录包含 `manifest.json`（种子、时间步与模型参数）、`trajectories.csv`（每步位置与朝向）、`turning_angles.csv`（相邻步的规范化转向角）和 `state_residence_times.csv`（连续 Run/Turn 段的驻留时间）。此命令目前只生成可供统计分析的原始数据，不包含论文图复现。

## 工程约束

- 通用规则见 [AGENTS.md](AGENTS.md) 与 [CLAUDE.md](CLAUDE.md)。
- 前端开发遵循 [docs/development/frontend.md](docs/development/frontend.md)。
- Processing 草图保持独立，不与 React 构建流程耦合；其源码通过 Git 子模块跟踪 [cell-proc-anim](https://github.com/Linmoqian/cell-proc-anim)。
- 双后端职责、线程模型和背压策略见 [模拟运行时架构](docs/architecture/simulation-runtime.md)。
- 克隆后执行 `git submodule update --init --recursive` 获取草图；如需拉取上游 `main` 的新版本，执行 `git submodule update --remote app/cell-proc-anim`，再提交更新后的子模块引用。
