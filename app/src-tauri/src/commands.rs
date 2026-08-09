use tauri::State;

use crate::{
    dto::{AddCellRequest, ApiError, BootstrapDto, CellCreatedDto},
    runtime::DesktopRuntime,
};

#[tauri::command]
pub fn get_bootstrap(runtime: State<'_, DesktopRuntime>) -> Result<BootstrapDto, ApiError> {
    runtime.bootstrap()
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
