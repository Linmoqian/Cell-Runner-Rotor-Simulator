import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { parentPort, workerData } from 'node:worker_threads'
import { MCF10A_COLLAGEN } from '../domain/runnerRotor.js'

const database = new DatabaseSync(workerData.databasePath)
database.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'))

function ensureDefaultExperiment() {
  const now = new Date().toISOString()
  database
    .prepare('INSERT OR IGNORE INTO observatory_groups(id, name, sort_order, created_at) VALUES (?, ?, ?, ?)')
    .run('group-default', '默认组', 0, now)
  database
    .prepare(`
      INSERT OR IGNORE INTO observatories(
        id, group_id, name, palette, dr_run, dr_turn, omega_turn, tau_run, tau_turn,
        v_run, v_turn, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      'observatory-1',
      'group-default',
      '观察台 01',
      'mint',
      MCF10A_COLLAGEN.drRun,
      MCF10A_COLLAGEN.drTurn,
      MCF10A_COLLAGEN.omegaTurn,
      MCF10A_COLLAGEN.tauRun,
      MCF10A_COLLAGEN.tauTurn,
      MCF10A_COLLAGEN.vRun,
      MCF10A_COLLAGEN.vTurn,
      now,
      now,
    )
  database
    .prepare('INSERT OR IGNORE INTO cells(id, observatory_id, seed, created_at) VALUES (?, ?, ?, ?)')
    .run('cell-1', 'observatory-1', 1, now)
  database
    .prepare(`
      INSERT OR IGNORE INTO cell_checkpoints(
        cell_id, tick, rng_state, x, y, heading, state, chirality,
        state_elapsed_minutes, elapsed_minutes, updated_at
      ) VALUES (?, 0, ?, 0, 0, -0.18, 'run', 1, 0, 0, ?)
    `)
    .run('cell-1', 1, now)
}

function getBootstrap() {
  const groups = database
    .prepare('SELECT id, name, sort_order AS sortOrder FROM observatory_groups ORDER BY sort_order, created_at')
    .all()
  const observatories = database
    .prepare(`
      SELECT id, group_id AS groupId, name, palette, dr_run AS drRun, dr_turn AS drTurn,
        omega_turn AS omegaTurn, tau_run AS tauRun, tau_turn AS tauTurn, v_run AS vRun,
        v_turn AS vTurn, paused, tick, simulated_minutes AS simulatedMinutes,
        camera_x AS cameraX, camera_y AS cameraY, camera_zoom AS cameraZoom
      FROM observatories ORDER BY created_at
    `)
    .all()
    .map((row) => ({ ...row, paused: Boolean(row.paused) }))
  const cells = database
    .prepare(`
      SELECT cells.id, cells.observatory_id AS observatoryId, cells.seed,
        checkpoints.tick, checkpoints.rng_state AS rngState, checkpoints.x, checkpoints.y,
        checkpoints.heading, checkpoints.state, checkpoints.chirality,
        checkpoints.state_elapsed_minutes AS stateElapsedMinutes,
        checkpoints.elapsed_minutes AS elapsedMinutes
      FROM cells
      LEFT JOIN cell_checkpoints AS checkpoints ON checkpoints.cell_id = cells.id
      ORDER BY cells.created_at
    `)
    .all()
  return { cells, groups, observatories }
}

function createCell(cell) {
  const now = new Date().toISOString()
  database.exec('BEGIN IMMEDIATE')
  try {
    const exists = database.prepare('SELECT 1 FROM observatories WHERE id = ?').get(cell.observatoryId)
    if (!exists) throw Object.assign(new Error('观察台不存在'), { code: 'OBSERVATORY_NOT_FOUND' })
    database
      .prepare('INSERT INTO cells(id, observatory_id, seed, created_at) VALUES (?, ?, ?, ?)')
      .run(cell.id, cell.observatoryId, cell.seed, now)
    database
      .prepare(`
        INSERT INTO cell_checkpoints(
          cell_id, tick, rng_state, x, y, heading, state, chirality,
          state_elapsed_minutes, elapsed_minutes, updated_at
        ) VALUES (?, 0, ?, ?, ?, ?, 'run', 1, 0, 0, ?)
      `)
      .run(cell.id, cell.seed, cell.x, cell.y, cell.heading, now)
    database.exec('COMMIT')
    return cell
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }
}

function createObservatory(observatory) {
  const now = new Date().toISOString()
  const group = database.prepare('SELECT 1 FROM observatory_groups WHERE id = ?').get(observatory.groupId)
  if (!group) throw Object.assign(new Error('观察台组不存在'), { code: 'GROUP_NOT_FOUND' })
  database
    .prepare(`
      INSERT INTO observatories(
        id, group_id, name, palette, dr_run, dr_turn, omega_turn, tau_run, tau_turn,
        v_run, v_turn, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      observatory.id,
      observatory.groupId,
      observatory.name,
      observatory.palette,
      observatory.params.drRun,
      observatory.params.drTurn,
      observatory.params.omegaTurn,
      observatory.params.tauRun,
      observatory.params.tauTurn,
      observatory.params.vRun,
      observatory.params.vTurn,
      now,
      now,
    )
  return observatory
}

function persistFrame(frame) {
  const now = new Date().toISOString()
  const updateObservatory = database.prepare(
    'UPDATE observatories SET tick = ?, simulated_minutes = ?, updated_at = ? WHERE id = ?',
  )
  const updateCheckpoint = database.prepare(`
    INSERT INTO cell_checkpoints(
      cell_id, tick, rng_state, x, y, heading, state, chirality,
      state_elapsed_minutes, elapsed_minutes, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(cell_id) DO UPDATE SET
      tick = excluded.tick, rng_state = excluded.rng_state, x = excluded.x, y = excluded.y,
      heading = excluded.heading, state = excluded.state, chirality = excluded.chirality,
      state_elapsed_minutes = excluded.state_elapsed_minutes,
      elapsed_minutes = excluded.elapsed_minutes, updated_at = excluded.updated_at
  `)
  const insertSample = database.prepare(`
    INSERT OR IGNORE INTO trajectory_samples(
      cell_id, tick, simulated_minutes, x, y, heading, state, chirality
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  database.exec('BEGIN IMMEDIATE')
  try {
    updateObservatory.run(frame.tick, frame.simulatedMinutes, now, frame.observatoryId)
    for (const cell of frame.cells) {
      updateCheckpoint.run(
        cell.id,
        frame.tick,
        cell.rngState ?? 0,
        cell.x,
        cell.y,
        cell.heading,
        cell.state,
        cell.chirality,
        cell.stateElapsedMinutes,
        cell.elapsedMinutes,
        now,
      )
      insertSample.run(
        cell.id,
        frame.tick,
        frame.simulatedMinutes,
        cell.x,
        cell.y,
        cell.heading,
        cell.state,
        cell.chirality,
      )
    }
    database.exec('COMMIT')
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }
  return { persistedCells: frame.cells.length, tick: frame.tick }
}

function updateObservatory(update) {
  const existing = database.prepare('SELECT * FROM observatories WHERE id = ?').get(update.id)
  if (!existing) throw Object.assign(new Error('观察台不存在'), { code: 'OBSERVATORY_NOT_FOUND' })
  const params = update.params ?? {}
  database
    .prepare(`
      UPDATE observatories SET
        dr_run = ?, dr_turn = ?, omega_turn = ?, tau_run = ?, tau_turn = ?,
        v_run = ?, v_turn = ?, paused = ?, updated_at = ?
      WHERE id = ?
    `)
    .run(
      params.drRun ?? existing.dr_run,
      params.drTurn ?? existing.dr_turn,
      params.omegaTurn ?? existing.omega_turn,
      params.tauRun ?? existing.tau_run,
      params.tauTurn ?? existing.tau_turn,
      params.vRun ?? existing.v_run,
      params.vTurn ?? existing.v_turn,
      update.paused === undefined ? existing.paused : Number(update.paused),
      new Date().toISOString(),
      update.id,
    )
  return { id: update.id, params, paused: update.paused }
}

const operations = { createCell, createObservatory, getBootstrap, persistFrame, updateObservatory }

ensureDefaultExperiment()
parentPort.on('message', ({ operation, payload, requestId }) => {
  try {
    const result = operations[operation](payload)
    parentPort.postMessage({ requestId, result })
  } catch (error) {
    parentPort.postMessage({
      error: { code: error.code ?? 'DATABASE_ERROR', message: error.message },
      requestId,
    })
  }
})
parentPort.postMessage({ type: 'ready' })
