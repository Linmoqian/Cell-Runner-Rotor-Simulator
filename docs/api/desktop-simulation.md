# 桌面细胞群体模拟 IPC

## 接口元信息

| 项目 | 内容 |
| --- | --- |
| 接口标识 | `get_bootstrap`、`create_observatory`、`update_observatory`、`add_cell`、`simulation://frame` |
| 用途 | 在桌面 WebView 与 Rust 群体模拟运行时之间交换实验命令和科学帧 |
| 调用方 | React 观察台前端 |
| 提供方 | Tauri Rust 后端 |
| 稳定性 | 实验性 |
| 引入版本 | 0.1.0 |
| 维护方 | simulation-runtime 模块 |
| 接口类型 | command 与事件 |
| 调用方式 | command 异步调用；事件订阅 |
| 权限或认证 | `default` capability、主窗口 `main` |
| Content-Type | 不适用 |

## 请求

`get_bootstrap` 没有参数。`create_observatory` 接收 `groupId`，`update_observatory` 接收 `observatoryId` 和包含 `paused` 或完整 `params` 的 `update`。`add_cell` 接收以下参数：

| 字段 | 位置 | 类型 | 必填 | 默认值 | 约束 | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| `request.observatoryId` | IPC | string | 是 | — | 已存在观察台 ID | 目标观察台 |
| `request.x` | IPC | number | 否 | `0` | 有限数，μm | 初始横坐标 |
| `request.y` | IPC | number | 否 | `0` | 有限数，μm | 初始纵坐标 |
| `request.heading` | IPC | number | 否 | `0` | 有限数，rad | 初始极性方向 |

## 响应

`get_bootstrap` 返回组、观察台和细胞检查点。`add_cell` 返回稳定细胞 ID。`simulation://frame` 的载荷与 [Web 模拟服务](simulation-service.md) 中的帧结构一致。

| 字段 | 类型 | 必定返回 | 约束 | 说明 |
| --- | --- | --- | --- | --- |
| `id` | string | 是 | `cell-` 前缀 UUID | 新细胞 ID |
| `observatoryId` | string | 是 | 已存在观察台 | 所属观察台 |

## 错误码

| 代码 | 含义 | 可重试 | 处理建议 |
| --- | --- | --- | --- |
| `INVALID_REQUEST` | 数值不是有限数 | 否 | 修正输入 |
| `OBSERVATORY_NOT_FOUND` | 观察台不存在 | 否 | 重新获取 bootstrap |
| `CELL_LIMIT_REACHED` | 细胞达到容量上限 | 否 | 使用其他观察台 |
| `SIMULATION_BUSY` | 模拟命令队列已满 | 是 | 退避后最多重试 3 次 |
| `DATABASE_TIMEOUT` | SQLite 单写者未在 2 秒内确认 | 是 | 提示未保存并有限重试 |

## 权限与安全

command 只开放给 `main` 窗口的 `default` capability。数据库路径由 Rust 使用应用数据目录构造，不接受前端路径输入。

## 行为约束

- 副作用：`add_cell` 先写入 SQLite，再将细胞交给模拟线程。
- 幂等性：`add_cell` 非幂等。
- 超时与取消：数据库确认超时为 2 秒；窗口取消订阅不停止实验。
- 并发、限流与重试：模拟命令队列容量为 256，SQLite 队列容量为 16；队列不会随细胞数无限增长。
- 事件：`simulation://frame` 由 Rust 模拟线程产生，每个观察台 tick 单调递增；监听器卸载时必须取消订阅。
- 关闭：应用状态最后一个引用释放时通知模拟线程和 SQLite 线程停止。

## 调用示例

### 请求示例

```ts
await invoke('add_cell', {
  request: { observatoryId: 'observatory-1', x: 0, y: 0 },
})
```

### 响应示例

```json
{"id":"cell-3b5508b8-6ac2-4b5c-a438-a829c59d4454","observatoryId":"observatory-1"}
```

### 错误示例

```json
{"code":"OBSERVATORY_NOT_FOUND","message":"观察台不存在"}
```

## 兼容性与变更记录

- 0.1.0：引入 bootstrap、观察台创建与控制、添加细胞和科学帧事件。
- Web 与桌面帧字段保持同名、同单位；调用方必须忽略未知字段。
