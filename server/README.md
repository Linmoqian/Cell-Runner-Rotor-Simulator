# Node 科学对照工具

`server/` 保留确定性 Runner–Rotor 参考实现、黄金轨迹回归和本地批量导出。它不属于 Web 生产运行链，也不由 Vercel 构建。

```bash
pnpm run check
pnpm run experiment:export -- --seed 20260810 --cells 32 --duration-minutes 240 --dt-minutes 0.1 --output artifacts/batch-20260810
```

Web 科学状态以用户浏览器中的 Web Worker 与 IndexedDB 为权威；桌面科学状态仍以 Rust 运行时与 SQLite 为权威。
