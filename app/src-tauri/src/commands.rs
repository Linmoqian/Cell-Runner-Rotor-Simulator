use tauri::State;

use crate::{
    dto::{
        AddCellRequest, ApiError, BootstrapDto, CellCreatedDto, ObservatoryDto,
        UpdateObservatoryRequest,
    },
    runtime::DesktopRuntime,
};

#[tauri::command]
pub fn get_bootstrap(runtime: State<'_, DesktopRuntime>) -> Result<BootstrapDto, ApiError> {
    runtime.bootstrap()
}

#[tauri::command]
pub async fn create_observatory(
    runtime: State<'_, DesktopRuntime>,
    group_id: String,
) -> Result<ObservatoryDto, ApiError> {
    let runtime = runtime.inner().clone();
    tauri::async_runtime::spawn_blocking(move || runtime.create_observatory(group_id))
        .await
        .map_err(|error| ApiError::new("THREAD_ERROR", error.to_string()))?
}

#[tauri::command]
pub async fn update_observatory(
    runtime: State<'_, DesktopRuntime>,
    observatory_id: String,
    update: UpdateObservatoryRequest,
) -> Result<(), ApiError> {
    let runtime = runtime.inner().clone();
    tauri::async_runtime::spawn_blocking(move || runtime.update_observatory(observatory_id, update))
        .await
        .map_err(|error| ApiError::new("THREAD_ERROR", error.to_string()))?
}

#[tauri::command]
pub async fn add_cell(
    runtime: State<'_, DesktopRuntime>,
    request: AddCellRequest,
) -> Result<CellCreatedDto, ApiError> {
    let runtime = runtime.inner().clone();
    tauri::async_runtime::spawn_blocking(move || runtime.add_cell(request))
        .await
        .map_err(|error| ApiError::new("THREAD_ERROR", error.to_string()))?
}
