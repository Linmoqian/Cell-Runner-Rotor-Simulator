pub mod commands;
pub mod domain;
mod dto;
mod runtime;
mod services;

use tauri::{Emitter, Manager};

use crate::runtime::DesktopRuntime;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let data_directory = app.path().app_data_dir()?;
            let app_handle = app.handle().clone();
            let runtime = DesktopRuntime::open(
                &data_directory.join("cell-runner-rotor.sqlite3"),
                move |frame| {
                    let _ = app_handle.emit("simulation://frame", frame);
                },
            )?;
            app.manage(runtime);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::add_cell,
            commands::create_observatory,
            commands::get_bootstrap,
            commands::update_observatory
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Cell Runner-Rotor desktop application");
}
