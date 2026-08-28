# 细胞群体模拟服务

> 适用范围：本文描述保留在 `server/` 的 Node 本地对照服务，不是 Vercel Web 生产接口。Web 页面不请求 `/api/v1/**`；浏览器 Web Worker 与 IndexedDB 是 Web 版科学状态权威。桌面接口见 `desktop-simulation.md`。

## 接口元信息

| 项目 | 内容 |
| --- | --- |
| 接口标识 | `GET /api/v1/bootstrap`、`POST /api/v1/observatories`、`PATCH /api/v1/observatories/{id}`、`POST /api/v1/observatories/{id}/cells`、`GET /api/v1/observatories/{id}/stream`、`POST /api/v1/experiments/batch` |
| 用途 | 创建具有稳定身份的细胞，并订阅由后端产生的群体运动帧 |
| 调用方 | 本地对照测试与科研工具 |
| 提供方 | Node.js 本地服务 |
| 稳定性 | 实验性 |
| 引入版本 | 0.1.0 |
| 维护方 | simulation-runtime 模块 |
| 接口类型 | HTTP API 与 Server-Sent Events；桌面端映射为 Tauri command 与事件 |
| 调用方式 | 仅本机 Base URL `/api/v1` |
| 权限或认证 | 本地单用户实验环境，不启用远程认证 |
| Content-Type | JSON；事件流为 `text/event-stream` |

## 请求

| 字段 | 位置 | 类型 | 必填 | 默认值 | 约束 | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | path | string | 是 | — | UUID 或现有兼容 ID | 观察台 ID |
| `x` | body | number | 否 | `0` | 有限数，μm | 新细胞初始横坐标 |
| `y` | body | number | 否 | `0` | 有限数，μm | 新细胞初始纵坐标 |
| `heading` | body | number | 否 | 随机值 | 有限数，rad | 新细胞初始迁移方向 |

`GET /api/v1/bootstrap` 和事件流请求没有 body。`POST /api/v1/observatories` 通过 `groupId` 创建属于指定组的观察台；`PATCH /api/v1/observatories/{id}` 接收 `paused` 或完整的 `params`；添加细胞使用 `POST /api/v1/observatories/{id}/cells`。未指定坐标时，后端会按当前群体规模扩大出生圆盘，避免大群体全部堆叠在原点。

`POST /api/v1/experiments/batch` 接收固定种子的 `{ seed, cellCount, durationMinutes, dtMinutes }`，同步生成独立批次的 `manifest.json`、`trajectories.csv`、`turning_angles.csv` 和 `state_residence_times.csv`，返回每个文件的受控下载 URL。Web 页面在浏览器 Worker 中生成同口径文件，不调用此接口。

## 响应

添加成功返回 `201 application/json`。事件流按产生顺序发送 `frame` 事件；断线后客户端重新获取 bootstrap，再重新订阅。

| 字段 | 类型 | 必定返回 | 约束 | 说明 |
| --- | --- | --- | --- | --- |
| `observatoryId` | string | 是 | 对应已存在观察台 | 事件所属观察台 |
| `tick` | integer | 是 | 单观察台严格递增 | 固定时间步编号 |
| `simulatedMinutes` | number | 是 | min | 观察台模拟时间 |
| `cells[].id` | string | 是 | 单观察台内唯一且稳定 | 细胞 ID |
| `cells[].x` | number | 是 | μm | 虚拟细胞中心横坐标 |
| `cells[].y` | number | 是 | μm | 虚拟细胞中心纵坐标 |
| `cells[].heading` | number | 是 | rad | 细胞极性方向 |
| `cells[].state` | string | 是 | `run` 或 `turn` | Runner-Rotor 状态 |
| `cells[].chirality` | integer | 是 | `-1` 或 `1` | Turn 旋向 |
| `cells[].stateElapsedMinutes` | number | 是 | min | 当前状态持续时间 |
| `cells[].elapsedMinutes` | number | 是 | min | 细胞累计模拟时间 |

## 错误码

| 代码 | 含义 | 可重试 | 处理建议 |
| --- | --- | --- | --- |
| `400 INVALID_REQUEST` | 输入不是合法 JSON 或字段越界 | 否 | 修正请求 |
| `404 OBSERVATORY_NOT_FOUND` | 观察台不存在 | 否 | 重新获取 bootstrap |
| `409 CELL_LIMIT_REACHED` | 观察台达到受控容量 | 否 | 删除细胞或创建新观察台 |
| `503 SIMULATION_BUSY` | 有界命令队列已满 | 是 | 退避 250 ms，最多重试 3 次 |
| `500 INTERNAL_ERROR` | 未分类后端错误 | 满足条件 | 保留实验状态并提示用户 |

## 权限与安全

服务只用于本地对照并默认监听回环地址，不作为远程部署入口。日志不得记录完整轨迹、数据库路径或用户环境路径。

## 行为约束

- 副作用：添加细胞会立即创建稳定 ID，并异步进入 SQLite 持久化队列。
- 幂等性：添加细胞不是幂等操作；后续版本可通过 `Idempotency-Key` 扩展。
- 超时与取消：SSE 连接关闭即取消订阅，不停止观察台模拟。
- 并发、限流与重试：模拟 Worker 数量和命令队列容量固定有界；数据库始终由单写者顺序提交。
- 顺序：同一观察台的 `tick` 严格递增；客户端必须丢弃小于等于已渲染 tick 的重复帧。
- 背压：慢订阅者只保留最新完整帧，允许丢弃中间视觉帧，不允许倒序。
- 数据事实来源：此工具运行时以 Node 状态和 SQLite 检查点为权威；Web 产品以浏览器 Worker 和 IndexedDB 为权威；前端膜形变始终是可重建图形状态。

## 调用示例

### 请求示例

```http
POST /api/v1/observatories/observatory-1/cells HTTP/1.1
Content-Type: application/json

{"x":12.5,"y":-4.0}
```

### 响应示例

```json
{
  "cell": {
    "id": "cell-3b5508b8-6ac2-4b5c-a438-a829c59d4454",
    "observatoryId": "observatory-1"
  }
}
```

### 错误示例

```json
{"error":{"code":"OBSERVATORY_NOT_FOUND","message":"观察台不存在"}}
```

## 兼容性与变更记录

- 0.1.0：定义 bootstrap、观察台创建与控制、添加细胞及后端帧流的最小契约。
- 0.2.0：退出 Web 生产链，仅保留为 Node 本地科学对照服务。
- 调用方必须忽略未知 JSON 字段；字段删除、重命名或单位变化属于不兼容变更。
