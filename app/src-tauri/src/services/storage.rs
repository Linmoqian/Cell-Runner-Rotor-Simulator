use std::{
    path::Path,
    sync::mpsc::{self, Receiver, SyncSender, TrySendError},
    thread,
    time::Duration,
};

use rusqlite::{Connection, params};

use crate::{
    domain::runner_rotor::{CellParams, CellState},
    dto::{
        ApiError, BootstrapDto, CellDto, ObservatoryDto, ObservatoryGroupDto, SimulationFrameDto,
    },
};

const SCHEMA: &str = include_str!("../../../../server/src/storage/schema.sql");
const STORAGE_QUEUE_CAPACITY: usize = 16;

enum StorageCommand {
    CreateCell {
        cell: CellDto,
        reply: SyncSender<Result<(), ApiError>>,
    },
    CreateObservatory {
        observatory: ObservatoryDto,
        reply: SyncSender<Result<(), ApiError>>,
    },
    UpdateObservatory {
        id: String,
        params: Option<CellParams>,
        paused: Option<bool>,
        reply: SyncSender<Result<(), ApiError>>,
    },
    Persist(SimulationFrameDto),
    Shutdown,
}

#[derive(Clone)]
pub struct StorageHandle {
    sender: SyncSender<StorageCommand>,
}

impl StorageHandle {
    pub fn open(path: &Path) -> Result<(Self, BootstrapDto), ApiError> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|error| ApiError::new("DATABASE_ERROR", error.to_string()))?;
        }
        let mut connection = Connection::open(path)
            .map_err(|error| ApiError::new("DATABASE_ERROR", error.to_string()))?;
        connection
            .execute_batch(SCHEMA)
            .map_err(|error| ApiError::new("DATABASE_ERROR", error.to_string()))?;
        ensure_default_experiment(&mut connection)?;
        let bootstrap = load_bootstrap(&connection)?;
        let (sender, receiver) = mpsc::sync_channel(STORAGE_QUEUE_CAPACITY);
        thread::Builder::new()
            .name("sqlite-writer".into())
            .spawn(move || storage_loop(connection, receiver))
            .map_err(|error| ApiError::new("THREAD_ERROR", error.to_string()))?;
        Ok((Self { sender }, bootstrap))
    }

    pub fn create_cell(&self, cell: CellDto) -> Result<(), ApiError> {
        let (reply_sender, reply_receiver) = mpsc::sync_channel(1);
        self.sender
            .send(StorageCommand::CreateCell {
                cell,
                reply: reply_sender,
            })
            .map_err(|_| ApiError::new("DATABASE_UNAVAILABLE", "数据库线程已停止"))?;
        reply_receiver
            .recv_timeout(Duration::from_secs(2))
            .map_err(|_| ApiError::new("DATABASE_TIMEOUT", "数据库写入超时"))?
    }

    pub fn create_observatory(&self, observatory: ObservatoryDto) -> Result<(), ApiError> {
        let (reply_sender, reply_receiver) = mpsc::sync_channel(1);
        self.sender
            .send(StorageCommand::CreateObservatory {
                observatory,
                reply: reply_sender,
            })
            .map_err(|_| ApiError::new("DATABASE_UNAVAILABLE", "数据库线程已停止"))?;
        reply_receiver
            .recv_timeout(Duration::from_secs(2))
            .map_err(|_| ApiError::new("DATABASE_TIMEOUT", "数据库写入超时"))?
    }

    pub fn try_persist(&self, frame: SimulationFrameDto) {
        match self.sender.try_send(StorageCommand::Persist(frame)) {
            Ok(()) | Err(TrySendError::Full(_)) => {}
            Err(TrySendError::Disconnected(_)) => {
                eprintln!("[错误] SQLite 写入线程已停止");
            }
        }
    }

    pub fn update_observatory(
        &self,
        id: String,
        params: Option<CellParams>,
        paused: Option<bool>,
    ) -> Result<(), ApiError> {
        let (reply_sender, reply_receiver) = mpsc::sync_channel(1);
        self.sender
            .send(StorageCommand::UpdateObservatory {
                id,
                params,
                paused,
                reply: reply_sender,
            })
            .map_err(|_| ApiError::new("DATABASE_UNAVAILABLE", "数据库线程已停止"))?;
        reply_receiver
            .recv_timeout(Duration::from_secs(2))
            .map_err(|_| ApiError::new("DATABASE_TIMEOUT", "数据库写入超时"))?
    }

    pub fn shutdown(&self) {
        let _ = self.sender.try_send(StorageCommand::Shutdown);
    }
}

fn ensure_default_experiment(connection: &mut Connection) -> Result<(), ApiError> {
    let transaction = connection
        .transaction()
        .map_err(|error| ApiError::new("DATABASE_ERROR", error.to_string()))?;
    transaction
        .execute(
            "INSERT OR IGNORE INTO observatory_groups(id, name, sort_order, created_at) VALUES (?1, ?2, 0, CURRENT_TIMESTAMP)",
            ("group-default", "默认组"),
        )
        .and_then(|_| {
            let params = CellParams::default();
            transaction.execute(
                "INSERT OR IGNORE INTO observatories(
                    id, group_id, name, palette, dr_run, dr_turn, omega_turn, tau_run, tau_turn,
                    v_run, v_turn, created_at, updated_at
                 ) VALUES (?1, ?2, ?3, 'mint', ?4, ?5, ?6, ?7, ?8, ?9, ?10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
                params![
                    "observatory-1", "group-default", "观察台 01", params.dr_run,
                    params.dr_turn, params.omega_turn, params.tau_run, params.tau_turn,
                    params.v_run, params.v_turn
                ],
            )
        })
        .and_then(|_| {
            transaction.execute(
                "INSERT OR IGNORE INTO cells(id, observatory_id, seed, created_at) VALUES ('cell-1', 'observatory-1', 1, CURRENT_TIMESTAMP)",
                [],
            )
        })
        .and_then(|_| {
            transaction.execute(
                "INSERT OR IGNORE INTO cell_checkpoints(
                    cell_id, tick, rng_state, x, y, heading, state, chirality,
                    state_elapsed_minutes, elapsed_minutes, updated_at
                 ) VALUES ('cell-1', 0, 1, 0, 0, -0.18, 'run', 1, 0, 0, CURRENT_TIMESTAMP)",
                [],
            )
        })
        .map_err(|error| ApiError::new("DATABASE_ERROR", error.to_string()))?;
    transaction
        .commit()
        .map_err(|error| ApiError::new("DATABASE_ERROR", error.to_string()))
}

fn load_bootstrap(connection: &Connection) -> Result<BootstrapDto, ApiError> {
    let groups = connection
        .prepare(
            "SELECT id, name, sort_order FROM observatory_groups ORDER BY sort_order, created_at",
        )
        .and_then(|mut statement| {
            statement
                .query_map([], |row| {
                    Ok(ObservatoryGroupDto {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        sort_order: row.get(2)?,
                    })
                })?
                .collect::<Result<Vec<_>, _>>()
        })
        .map_err(|error| ApiError::new("DATABASE_ERROR", error.to_string()))?;
    let observatories = load_observatories(connection)?;
    let cells = load_cells(connection)?;
    Ok(BootstrapDto {
        cells,
        groups,
        observatories,
    })
}

fn load_observatories(connection: &Connection) -> Result<Vec<ObservatoryDto>, ApiError> {
    connection
        .prepare(
            "SELECT id, group_id, name, palette, dr_run, dr_turn, omega_turn, tau_run,
                tau_turn, v_run, v_turn, paused, tick, simulated_minutes, camera_x,
                camera_y, camera_zoom FROM observatories ORDER BY created_at",
        )
        .and_then(|mut statement| {
            statement
                .query_map([], |row| {
                    Ok(ObservatoryDto {
                        id: row.get(0)?,
                        group_id: row.get(1)?,
                        name: row.get(2)?,
                        palette: row.get(3)?,
                        params: CellParams {
                            dr_run: row.get(4)?,
                            dr_turn: row.get(5)?,
                            omega_turn: row.get(6)?,
                            tau_run: row.get(7)?,
                            tau_turn: row.get(8)?,
                            v_run: row.get(9)?,
                            v_turn: row.get(10)?,
                        },
                        paused: row.get::<_, i64>(11)? != 0,
                        tick: u64::try_from(row.get::<_, i64>(12)?).unwrap_or_default(),
                        simulated_minutes: row.get(13)?,
                        camera_x: row.get(14)?,
                        camera_y: row.get(15)?,
                        camera_zoom: row.get(16)?,
                    })
                })?
                .collect::<Result<Vec<_>, _>>()
        })
        .map_err(|error| ApiError::new("DATABASE_ERROR", error.to_string()))
}

fn load_cells(connection: &Connection) -> Result<Vec<CellDto>, ApiError> {
    connection
        .prepare(
            "SELECT cells.id, cells.observatory_id, cells.seed, checkpoints.rng_state,
                checkpoints.x, checkpoints.y, checkpoints.heading, checkpoints.state,
                checkpoints.chirality, checkpoints.state_elapsed_minutes,
                checkpoints.elapsed_minutes FROM cells
             JOIN cell_checkpoints AS checkpoints ON checkpoints.cell_id = cells.id
             ORDER BY cells.created_at",
        )
        .and_then(|mut statement| {
            statement
                .query_map([], |row| {
                    let state: String = row.get(7)?;
                    Ok(CellDto {
                        id: row.get(0)?,
                        observatory_id: row.get(1)?,
                        seed: row.get(2)?,
                        rng_state: row.get(3)?,
                        x: row.get(4)?,
                        y: row.get(5)?,
                        heading: row.get(6)?,
                        state: if state == "turn" {
                            CellState::Turn
                        } else {
                            CellState::Run
                        },
                        chirality: row.get(8)?,
                        state_elapsed_minutes: row.get(9)?,
                        elapsed_minutes: row.get(10)?,
                    })
                })?
                .collect::<Result<Vec<_>, _>>()
        })
        .map_err(|error| ApiError::new("DATABASE_ERROR", error.to_string()))
}

fn storage_loop(mut connection: Connection, receiver: Receiver<StorageCommand>) {
    while let Ok(command) = receiver.recv() {
        match command {
            StorageCommand::CreateCell { cell, reply } => {
                let result = insert_cell(&mut connection, &cell);
                let _ = reply.send(result);
            }
            StorageCommand::CreateObservatory { observatory, reply } => {
                let result = insert_observatory(&connection, &observatory);
                let _ = reply.send(result);
            }
            StorageCommand::Persist(frame) => {
                if let Err(error) = persist_frame(&mut connection, &frame) {
                    eprintln!("[错误] SQLite 检查点写入失败：{}", error.message);
                }
            }
            StorageCommand::UpdateObservatory {
                id,
                params,
                paused,
                reply,
            } => {
                let result = update_observatory(&connection, &id, params, paused);
                let _ = reply.send(result);
            }
            StorageCommand::Shutdown => break,
        }
    }
}

fn insert_observatory(
    connection: &Connection,
    observatory: &ObservatoryDto,
) -> Result<(), ApiError> {
    let group_exists = connection
        .query_row(
            "SELECT 1 FROM observatory_groups WHERE id = ?1",
            [&observatory.group_id],
            |_| Ok(()),
        )
        .is_ok();
    if !group_exists {
        return Err(ApiError::new("GROUP_NOT_FOUND", "观察台组不存在"));
    }
    connection
        .execute(
            "INSERT INTO observatories(
                id, group_id, name, palette, dr_run, dr_turn, omega_turn, tau_run, tau_turn,
                v_run, v_turn, paused, tick, simulated_minutes, camera_x, camera_y, camera_zoom,
                created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 0, 0, 0, 0, 1,
                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
            params![
                observatory.id,
                observatory.group_id,
                observatory.name,
                observatory.palette,
                observatory.params.dr_run,
                observatory.params.dr_turn,
                observatory.params.omega_turn,
                observatory.params.tau_run,
                observatory.params.tau_turn,
                observatory.params.v_run,
                observatory.params.v_turn,
                i64::from(observatory.paused)
            ],
        )
        .map(|_| ())
        .map_err(|error| ApiError::new("DATABASE_ERROR", error.to_string()))
}

fn update_observatory(
    connection: &Connection,
    id: &str,
    params: Option<CellParams>,
    paused: Option<bool>,
) -> Result<(), ApiError> {
    let existing = connection
        .query_row(
            "SELECT dr_run, dr_turn, omega_turn, tau_run, tau_turn, v_run, v_turn, paused
             FROM observatories WHERE id = ?1",
            [id],
            |row| {
                Ok((
                    CellParams {
                        dr_run: row.get(0)?,
                        dr_turn: row.get(1)?,
                        omega_turn: row.get(2)?,
                        tau_run: row.get(3)?,
                        tau_turn: row.get(4)?,
                        v_run: row.get(5)?,
                        v_turn: row.get(6)?,
                    },
                    row.get::<_, i64>(7)? != 0,
                ))
            },
        )
        .map_err(|_| ApiError::new("OBSERVATORY_NOT_FOUND", "观察台不存在"))?;
    let next_params = params.unwrap_or(existing.0);
    let next_paused = paused.unwrap_or(existing.1);
    connection
        .execute(
            "UPDATE observatories SET dr_run = ?1, dr_turn = ?2, omega_turn = ?3,
                tau_run = ?4, tau_turn = ?5, v_run = ?6, v_turn = ?7, paused = ?8,
                updated_at = CURRENT_TIMESTAMP WHERE id = ?9",
            params![
                next_params.dr_run,
                next_params.dr_turn,
                next_params.omega_turn,
                next_params.tau_run,
                next_params.tau_turn,
                next_params.v_run,
                next_params.v_turn,
                i64::from(next_paused),
                id
            ],
        )
        .map(|_| ())
        .map_err(|error| ApiError::new("DATABASE_ERROR", error.to_string()))
}

fn insert_cell(connection: &mut Connection, cell: &CellDto) -> Result<(), ApiError> {
    let transaction = connection
        .transaction()
        .map_err(|error| ApiError::new("DATABASE_ERROR", error.to_string()))?;
    transaction
        .execute(
            "INSERT INTO cells(id, observatory_id, seed, created_at) VALUES (?1, ?2, ?3, CURRENT_TIMESTAMP)",
            params![cell.id, cell.observatory_id, cell.seed],
        )
        .and_then(|_| {
            transaction.execute(
                "INSERT INTO cell_checkpoints(
                    cell_id, tick, rng_state, x, y, heading, state, chirality,
                    state_elapsed_minutes, elapsed_minutes, updated_at
                 ) VALUES (?1, 0, ?2, ?3, ?4, ?5, 'run', 1, 0, 0, CURRENT_TIMESTAMP)",
                params![cell.id, cell.rng_state, cell.x, cell.y, cell.heading],
            )
        })
        .map_err(|error| ApiError::new("DATABASE_ERROR", error.to_string()))?;
    transaction
        .commit()
        .map_err(|error| ApiError::new("DATABASE_ERROR", error.to_string()))
}

fn persist_frame(connection: &mut Connection, frame: &SimulationFrameDto) -> Result<(), ApiError> {
    let tick = i64::try_from(frame.tick)
        .map_err(|_| ApiError::new("DATABASE_ERROR", "模拟 tick 超出 SQLite 整数范围"))?;
    let transaction = connection
        .transaction()
        .map_err(|error| ApiError::new("DATABASE_ERROR", error.to_string()))?;
    transaction
        .execute(
            "UPDATE observatories SET tick = ?1, simulated_minutes = ?2, updated_at = CURRENT_TIMESTAMP WHERE id = ?3",
            params![tick, frame.simulated_minutes, frame.observatory_id],
        )
        .map_err(|error| ApiError::new("DATABASE_ERROR", error.to_string()))?;
    for cell in &frame.cells {
        transaction
            .execute(
                "INSERT INTO cell_checkpoints(
                    cell_id, tick, rng_state, x, y, heading, state, chirality,
                    state_elapsed_minutes, elapsed_minutes, updated_at
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, CURRENT_TIMESTAMP)
                 ON CONFLICT(cell_id) DO UPDATE SET tick = excluded.tick,
                    rng_state = excluded.rng_state, x = excluded.x, y = excluded.y,
                    heading = excluded.heading, state = excluded.state,
                    chirality = excluded.chirality,
                    state_elapsed_minutes = excluded.state_elapsed_minutes,
                    elapsed_minutes = excluded.elapsed_minutes, updated_at = CURRENT_TIMESTAMP",
                params![
                    cell.id,
                    tick,
                    cell.rng_state,
                    cell.x,
                    cell.y,
                    cell.heading,
                    match cell.state {
                        CellState::Run => "run",
                        CellState::Turn => "turn",
                    },
                    cell.chirality,
                    cell.state_elapsed_minutes,
                    cell.elapsed_minutes
                ],
            )
            .and_then(|_| {
                transaction.execute(
                    "INSERT OR IGNORE INTO trajectory_samples(
                        cell_id, tick, simulated_minutes, x, y, heading, state, chirality
                     ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                    params![
                        cell.id,
                        tick,
                        frame.simulated_minutes,
                        cell.x,
                        cell.y,
                        cell.heading,
                        match cell.state {
                            CellState::Run => "run",
                            CellState::Turn => "turn",
                        },
                        cell.chirality
                    ],
                )
            })
            .map_err(|error| ApiError::new("DATABASE_ERROR", error.to_string()))?;
    }
    transaction
        .commit()
        .map_err(|error| ApiError::new("DATABASE_ERROR", error.to_string()))
}

#[cfg(test)]
mod tests {
    use tempfile::tempdir;

    use super::StorageHandle;

    #[test]
    fn initializes_default_group_observatory_and_cell() {
        let directory = tempdir().expect("temporary directory");
        let (_storage, bootstrap) =
            StorageHandle::open(&directory.path().join("test.sqlite3")).expect("database");
        assert_eq!(bootstrap.groups.len(), 1);
        assert_eq!(bootstrap.observatories.len(), 1);
        assert_eq!(bootstrap.cells.len(), 1);
        assert_eq!(bootstrap.cells[0].observatory_id, "observatory-1");
    }
}
