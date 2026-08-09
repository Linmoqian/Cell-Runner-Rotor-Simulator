import { randomBytes, randomUUID } from 'node:crypto'
import { createReadStream, existsSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { DatabaseClient } from './storage/databaseClient.js'
import { PersistenceCoordinator } from './runtime/persistenceCoordinator.js'
import { SimulationPool } from './runtime/simulationPool.js'

const SOURCE_DIR = dirname(fileURLToPath(import.meta.url))
const PROJECT_DIR = join(SOURCE_DIR, '..', '..')
const DEFAULT_DATABASE_PATH = join(PROJECT_DIR, 'data', 'cell-runner-rotor.sqlite3')
const DEFAULT_STATIC_DIR = join(PROJECT_DIR, '..', 'app', 'dist')
const MAX_BODY_BYTES = 32 * 1024
const MAX_CELLS_PER_OBSERVATORY = 500

const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.wasm', 'application/wasm'],
])

function sendJson(response, statusCode, value) {
  const body = JSON.stringify(value)
  response.writeHead(statusCode, {
    'Content-Length': Buffer.byteLength(body),
    'Content-Type': 'application/json; charset=utf-8',
  })
  response.end(body)
}

function sendError(response, statusCode, code, message) {
  sendJson(response, statusCode, { error: { code, message } })
}

async function readJson(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error('请求体过大'), { code: 'BODY_TOO_LARGE' })
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function createSseHub() {
  const subscribers = new Map()
  return {
    publish(frame) {
      const payload = `event: frame\ndata: ${JSON.stringify(frame)}\n\n`
      for (const subscriber of subscribers.get(frame.observatoryId) ?? []) {
        if (subscriber.blocked) {
          subscriber.latest = payload
          continue
        }
        subscriber.blocked = !subscriber.response.write(payload)
      }
    },
    subscribe(observatoryId, request, response) {
      const group = subscribers.get(observatoryId) ?? new Set()
      subscribers.set(observatoryId, group)
      const subscriber = { blocked: false, latest: null, response }
      group.add(subscriber)
      response.writeHead(200, {
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'Content-Type': 'text/event-stream; charset=utf-8',
        'X-Accel-Buffering': 'no',
      })
      response.write('retry: 1000\n\n')
      response.on('drain', () => {
        subscriber.blocked = false
        if (subscriber.latest) {
          const latest = subscriber.latest
          subscriber.latest = null
          subscriber.blocked = !response.write(latest)
        }
      })
      request.on('close', () => {
        group.delete(subscriber)
        if (group.size === 0) subscribers.delete(observatoryId)
      })
    },
  }
}

function serveStatic(response, pathname, staticDir) {
  const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1)
  const candidate = normalize(join(staticDir, relativePath))
  const staticRoot = normalize(`${staticDir}/`)
  const filePath = candidate.startsWith(staticRoot) && existsSync(candidate) ? candidate : join(staticDir, 'index.html')
  if (!existsSync(filePath)) return false
  response.writeHead(200, { 'Content-Type': mimeTypes.get(extname(filePath)) ?? 'application/octet-stream' })
  createReadStream(filePath).pipe(response)
  return true
}

function randomSeed() {
  return randomBytes(4).readUInt32LE(0)
}

export async function createRuntimeServer(options = {}) {
  const database = await DatabaseClient.create(options.databasePath ?? DEFAULT_DATABASE_PATH)
  const pool = new SimulationPool(options.workerCount)
  const persistence = new PersistenceCoordinator(database)
  const sse = createSseHub()
  const bootstrap = await database.request('getBootstrap')

  for (const observatory of bootstrap.observatories) {
    pool.send(observatory.id, 'upsertObservatory', {
      ...observatory,
      cells: bootstrap.cells.filter((cell) => cell.observatoryId === observatory.id),
      params: observatory,
    })
  }
  pool.onFrame((frame) => sse.publish(frame))
  pool.onPersist((frame) => persistence.enqueue(frame))

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost')
    try {
      if (request.method === 'GET' && url.pathname === '/api/v1/health') {
        sendJson(response, 200, { database: 'ready', simulationWorkers: pool.workerCount, status: 'ok' })
        return
      }
      if (request.method === 'GET' && url.pathname === '/api/v1/bootstrap') {
        sendJson(response, 200, await database.request('getBootstrap'))
        return
      }

      const cellMatch = url.pathname.match(/^\/api\/v1\/observatories\/([^/]+)\/cells$/)
      if (request.method === 'POST' && cellMatch) {
        const observatoryId = decodeURIComponent(cellMatch[1])
        const current = await database.request('getBootstrap')
        const cellCount = current.cells.filter((cell) => cell.observatoryId === observatoryId).length
        if (cellCount >= MAX_CELLS_PER_OBSERVATORY) {
          sendError(response, 409, 'CELL_LIMIT_REACHED', '观察台细胞数量已达上限')
          return
        }
        const body = await readJson(request)
        const cell = {
          heading: Number.isFinite(body.heading) ? body.heading : Math.random() * Math.PI * 2 - Math.PI,
          id: `cell-${randomUUID()}`,
          observatoryId,
          seed: randomSeed(),
          x: Number.isFinite(body.x) ? body.x : 0,
          y: Number.isFinite(body.y) ? body.y : 0,
        }
        await database.request('createCell', cell)
        if (!pool.send(observatoryId, 'addCell', cell)) {
          sendError(response, 503, 'SIMULATION_BUSY', '模拟命令队列已满')
          return
        }
        sendJson(response, 201, { cell: { id: cell.id, observatoryId } })
        return
      }

      const streamMatch = url.pathname.match(/^\/api\/v1\/observatories\/([^/]+)\/stream$/)
      if (request.method === 'GET' && streamMatch) {
        sse.subscribe(decodeURIComponent(streamMatch[1]), request, response)
        return
      }

      const observatoryMatch = url.pathname.match(/^\/api\/v1\/observatories\/([^/]+)$/)
      if (request.method === 'PATCH' && observatoryMatch) {
        const id = decodeURIComponent(observatoryMatch[1])
        const body = await readJson(request)
        await database.request('updateObservatory', { id, params: body.params, paused: body.paused })
        if (body.params && !pool.send(id, 'setParams', { observatoryId: id, params: body.params })) {
          sendError(response, 503, 'SIMULATION_BUSY', '模拟命令队列已满')
          return
        }
        if (body.paused !== undefined && !pool.send(id, 'setPaused', { observatoryId: id, paused: body.paused })) {
          sendError(response, 503, 'SIMULATION_BUSY', '模拟命令队列已满')
          return
        }
        sendJson(response, 200, { id, params: body.params, paused: body.paused })
        return
      }

      if (url.pathname.startsWith('/api/')) {
        sendError(response, 404, 'NOT_FOUND', '接口不存在')
        return
      }
      if (!serveStatic(response, url.pathname, options.staticDir ?? DEFAULT_STATIC_DIR)) {
        sendError(response, 404, 'NOT_FOUND', '前端构建不存在')
      }
    } catch (error) {
      if (error instanceof SyntaxError || error.code === 'BODY_TOO_LARGE') {
        sendError(response, 400, 'INVALID_REQUEST', error.message)
      } else if (error.code === 'OBSERVATORY_NOT_FOUND') {
        sendError(response, 404, error.code, error.message)
      } else {
        console.error('[错误] 请求处理失败', error.message)
        sendError(response, 500, 'INTERNAL_ERROR', '服务暂时不可用')
      }
    }
  })

  return {
    close: async () => {
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
      await Promise.all([pool.close(), database.close()])
    },
    listen: (port, host) => new Promise((resolve) => server.listen(port, host, resolve)),
    server,
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 8787)
  const host = process.env.HOST ?? '127.0.0.1'
  const runtime = await createRuntimeServer()
  await runtime.listen(port, host)
  console.info(`[成功] 群体模拟服务运行于 http://${host}:${port}`)

  const shutdown = async () => {
    await runtime.close()
    process.exit(0)
  }
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
}
