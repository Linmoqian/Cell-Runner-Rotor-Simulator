import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createRuntimeServer } from './server.js'

test('Web 服务创建细胞并推送后端科学帧', async (context) => {
  const tempDirectory = await mkdtemp(join(tmpdir(), 'cell-runner-rotor-'))
  const runtime = await createRuntimeServer({
    databasePath: join(tempDirectory, 'test.sqlite3'),
    workerCount: 1,
  })
  await runtime.listen(0, '127.0.0.1')
  context.after(async () => {
    await runtime.close()
    await rm(tempDirectory, { force: true, recursive: true })
  })

  const address = runtime.server.address()
  const baseUrl = `http://127.0.0.1:${address.port}`
  const bootstrap = await fetch(`${baseUrl}/api/v1/bootstrap`).then((response) => response.json())
  assert.equal(bootstrap.groups[0].id, 'group-default')
  assert.equal(bootstrap.observatories[0].id, 'observatory-1')
  assert.equal(bootstrap.cells[0].id, 'cell-1')

  const creation = await fetch(`${baseUrl}/api/v1/observatories/observatory-1/cells`, {
    body: JSON.stringify({ heading: 0, x: 4, y: -2 }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })
  assert.equal(creation.status, 201)

  const stream = await fetch(`${baseUrl}/api/v1/observatories/observatory-1/stream`)
  const reader = stream.body.getReader()
  const decoder = new TextDecoder()
  let payload = ''
  while (!payload.includes('event: frame')) {
    const chunk = await reader.read()
    assert.equal(chunk.done, false)
    payload += decoder.decode(chunk.value, { stream: true })
  }
  await reader.cancel()
  assert.match(payload, /"observatoryId":"observatory-1"/)
  assert.match(payload, /"cells":\[/)
})
