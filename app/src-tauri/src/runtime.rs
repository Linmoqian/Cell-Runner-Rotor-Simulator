use std::{
    collections::HashMap,
    sync::{Arc, Mutex, mpsc},
    thread,
    time::{Duration, Instant},
};

use uuid::Uuid;

use crate::{
    domain::runner_rotor::{Cell, CellParams, step_cell},
    dto::{
        AddCellRequest, ApiError, BootstrapDto, CellCreatedDto, CellDto, CellFrameDto,
        SimulationFrameDto,
    },
    services::storage::StorageHandle,
};

const WALL_TICK: Duration = Duration::from_millis(20);
const DT_MINUTES: f64 = 0.1;
const FRAME_EVERY_TICKS: u64 = 3;
const PERSIST_EVERY_TICKS: u64 = 15;
const SIMULATION_QUEUE_CAPACITY: usize = 256;

struct ObservatoryRuntime {
    cells: HashMap<String, Cell>,
    id: String,
    params: CellParams,
    paused: bool,
    simulated_minutes: f64,
    tick: u64,
}

enum SimulationCommand {
    AddCell(Cell),
    Shutdown,
}

struct RuntimeInner {
    bootstrap: Mutex<BootstrapDto>,
    simulation_sender: mpsc::SyncSender<SimulationCommand>,
    storage: StorageHandle,
}

impl Drop for RuntimeInner {
    fn drop(&mut self) {
        let _ = self.simulation_sender.try_send(SimulationCommand::Shutdown);
        self.storage.shutdown();
    }
}

#[derive(Clone)]
pub struct DesktopRuntime {
    inner: Arc<RuntimeInner>,
}

impl DesktopRuntime {
    pub fn open(
        database_path: &std::path::Path,
        emit: impl Fn(SimulationFrameDto) + Send + Sync + 'static,
    ) -> Result<Self, ApiError> {
        let (storage, bootstrap) = StorageHandle::open(database_path)?;
        let observatories = hydrate_observatories(&bootstrap);
        let (simulation_sender, simulation_receiver) =
            mpsc::sync_channel(SIMULATION_QUEUE_CAPACITY);
        let storage_for_thread = storage.clone();
        let emit = Arc::new(emit);
        thread::Builder::new()
            .name("cell-simulation".into())
            .spawn(move || {
                simulation_loop(observatories, simulation_receiver, storage_for_thread, emit);
            })
            .map_err(|error| ApiError::new("THREAD_ERROR", error.to_string()))?;
        Ok(Self {
            inner: Arc::new(RuntimeInner {
                bootstrap: Mutex::new(bootstrap),
                simulation_sender,
                storage,
            }),
        })
    }

    pub fn bootstrap(&self) -> Result<BootstrapDto, ApiError> {
        self.inner
            .bootstrap
            .lock()
            .map(|bootstrap| bootstrap.clone())
            .map_err(|_| ApiError::new("STATE_ERROR", "观察台状态锁已损坏"))
    }

    pub fn add_cell(&self, request: AddCellRequest) -> Result<CellCreatedDto, ApiError> {
        let heading = request.heading.unwrap_or(0.0);
        let x = request.x.unwrap_or(0.0);
        let y = request.y.unwrap_or(0.0);
        if !heading.is_finite() || !x.is_finite() || !y.is_finite() {
            return Err(ApiError::new(
                "INVALID_REQUEST",
                "细胞坐标和方向必须为有限数",
            ));
        }
        let seed = random_seed();
        let id = format!("cell-{}", Uuid::new_v4());
        {
            let bootstrap = self
                .inner
                .bootstrap
                .lock()
                .map_err(|_| ApiError::new("STATE_ERROR", "观察台状态锁已损坏"))?;
            if !bootstrap
                .observatories
                .iter()
                .any(|observatory| observatory.id == request.observatory_id)
            {
                return Err(ApiError::new("OBSERVATORY_NOT_FOUND", "观察台不存在"));
            }
            if bootstrap
                .cells
                .iter()
                .filter(|cell| cell.observatory_id == request.observatory_id)
                .count()
                >= 500
            {
                return Err(ApiError::new(
                    "CELL_LIMIT_REACHED",
                    "观察台细胞数量已达上限",
                ));
            }
        }
        let cell_dto = CellDto {
            chirality: 1,
            elapsed_minutes: 0.0,
            heading,
            id: id.clone(),
            observatory_id: request.observatory_id.clone(),
            rng_state: seed,
            seed,
            state: crate::domain::runner_rotor::CellState::Run,
            state_elapsed_minutes: 0.0,
            x,
            y,
        };
        self.inner.storage.create_cell(cell_dto.clone())?;
        self.inner
            .simulation_sender
            .try_send(SimulationCommand::AddCell(cell_from_dto(&cell_dto)))
            .map_err(|_| ApiError::new("SIMULATION_BUSY", "模拟命令队列已满"))?;
        self.inner
            .bootstrap
            .lock()
            .map_err(|_| ApiError::new("STATE_ERROR", "观察台状态锁已损坏"))?
            .cells
            .push(cell_dto);
        Ok(CellCreatedDto {
            id,
            observatory_id: request.observatory_id,
        })
    }
}

fn random_seed() -> u32 {
    let bytes = *Uuid::new_v4().as_bytes();
    u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]])
}

fn cell_from_dto(cell: &CellDto) -> Cell {
    let mut runtime = Cell::new(
        cell.id.clone(),
        cell.observatory_id.clone(),
        cell.rng_state,
        cell.x,
        cell.y,
        cell.heading,
    );
    runtime.chirality = cell.chirality;
    runtime.elapsed_minutes = cell.elapsed_minutes;
    runtime.state = cell.state;
    runtime.state_elapsed_minutes = cell.state_elapsed_minutes;
    runtime
}

fn hydrate_observatories(bootstrap: &BootstrapDto) -> HashMap<String, ObservatoryRuntime> {
    bootstrap
        .observatories
        .iter()
        .map(|observatory| {
            let cells = bootstrap
                .cells
                .iter()
                .filter(|cell| cell.observatory_id == observatory.id)
                .map(|cell| (cell.id.clone(), cell_from_dto(cell)))
                .collect();
            (
                observatory.id.clone(),
                ObservatoryRuntime {
                    cells,
                    id: observatory.id.clone(),
                    params: observatory.params,
                    paused: observatory.paused,
                    simulated_minutes: observatory.simulated_minutes,
                    tick: observatory.tick,
                },
            )
        })
        .collect()
}

fn simulation_loop(
    mut observatories: HashMap<String, ObservatoryRuntime>,
    receiver: mpsc::Receiver<SimulationCommand>,
    storage: StorageHandle,
    emit: Arc<dyn Fn(SimulationFrameDto) + Send + Sync>,
) {
    let mut running = true;
    while running {
        let started_at = Instant::now();
        for _ in 0..64 {
            match receiver.try_recv() {
                Ok(SimulationCommand::AddCell(cell)) => {
                    if let Some(observatory) = observatories.get_mut(&cell.observatory_id) {
                        observatory.cells.insert(cell.id.clone(), cell);
                    }
                }
                Ok(SimulationCommand::Shutdown) | Err(mpsc::TryRecvError::Disconnected) => {
                    running = false;
                    break;
                }
                Err(mpsc::TryRecvError::Empty) => break,
            }
        }
        for observatory in observatories.values_mut() {
            if observatory.paused {
                continue;
            }
            for cell in observatory.cells.values_mut() {
                step_cell(cell, observatory.params, DT_MINUTES);
            }
            observatory.tick += 1;
            observatory.simulated_minutes += DT_MINUTES;
            if observatory.tick.is_multiple_of(FRAME_EVERY_TICKS) {
                emit(to_frame(observatory));
            }
            if observatory.tick.is_multiple_of(PERSIST_EVERY_TICKS) {
                storage.try_persist(to_frame(observatory));
            }
        }
        if let Some(remaining) = WALL_TICK.checked_sub(started_at.elapsed()) {
            thread::sleep(remaining);
        }
    }
}

fn to_frame(observatory: &ObservatoryRuntime) -> SimulationFrameDto {
    SimulationFrameDto {
        cells: observatory
            .cells
            .values()
            .map(|cell| CellFrameDto {
                chirality: cell.chirality,
                elapsed_minutes: cell.elapsed_minutes,
                heading: cell.heading,
                id: cell.id.clone(),
                rng_state: cell.rng_state,
                state: cell.state,
                state_elapsed_minutes: cell.state_elapsed_minutes,
                x: cell.x,
                y: cell.y,
            })
            .collect(),
        observatory_id: observatory.id.clone(),
        simulated_minutes: observatory.simulated_minutes,
        tick: observatory.tick,
    }
}

#[cfg(test)]
mod tests {
    use std::{
        sync::mpsc,
        time::{Duration, Instant},
    };

    use tempfile::tempdir;

    use super::DesktopRuntime;
    use crate::dto::AddCellRequest;

    #[test]
    fn emits_frames_and_adds_independent_cells() {
        let directory = tempdir().expect("temporary directory");
        let (sender, receiver) = mpsc::sync_channel(8);
        let runtime = DesktopRuntime::open(&directory.path().join("test.sqlite3"), move |frame| {
            let _ = sender.try_send(frame);
        })
        .expect("runtime");
        runtime
            .add_cell(AddCellRequest {
                heading: Some(0.0),
                observatory_id: "observatory-1".into(),
                x: Some(1.0),
                y: Some(2.0),
            })
            .expect("cell");

        let deadline = Instant::now() + Duration::from_secs(1);
        let frame = loop {
            let remaining = deadline.saturating_duration_since(Instant::now());
            let frame = receiver.recv_timeout(remaining).expect("simulation frame");
            if frame.cells.len() == 2 {
                break frame;
            }
        };
        assert_eq!(frame.observatory_id, "observatory-1");
        assert!(frame.tick > 0);
    }
}
