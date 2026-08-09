use serde::{Deserialize, Serialize};

use crate::domain::runner_rotor::{CellParams, CellState};

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ObservatoryGroupDto {
    pub id: String,
    pub name: String,
    pub sort_order: i64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ObservatoryDto {
    pub camera_x: f64,
    pub camera_y: f64,
    pub camera_zoom: f64,
    pub group_id: String,
    pub id: String,
    pub name: String,
    pub palette: String,
    pub params: CellParams,
    pub paused: bool,
    pub simulated_minutes: f64,
    pub tick: u64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CellDto {
    pub chirality: i8,
    pub elapsed_minutes: f64,
    pub heading: f64,
    pub id: String,
    pub observatory_id: String,
    pub rng_state: u32,
    pub seed: u32,
    pub state: CellState,
    pub state_elapsed_minutes: f64,
    pub x: f64,
    pub y: f64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BootstrapDto {
    pub cells: Vec<CellDto>,
    pub groups: Vec<ObservatoryGroupDto>,
    pub observatories: Vec<ObservatoryDto>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CellFrameDto {
    pub chirality: i8,
    pub elapsed_minutes: f64,
    pub heading: f64,
    pub id: String,
    #[serde(skip_serializing)]
    pub rng_state: u32,
    pub state: CellState,
    pub state_elapsed_minutes: f64,
    pub x: f64,
    pub y: f64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SimulationFrameDto {
    pub cells: Vec<CellFrameDto>,
    pub observatory_id: String,
    pub simulated_minutes: f64,
    pub tick: u64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddCellRequest {
    pub heading: Option<f64>,
    pub observatory_id: String,
    pub x: Option<f64>,
    pub y: Option<f64>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CellCreatedDto {
    pub id: String,
    pub observatory_id: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct ApiError {
    pub code: String,
    pub message: String,
}

impl ApiError {
    pub fn new(code: &str, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
        }
    }
}

impl std::fmt::Display for ApiError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(formatter, "{}: {}", self.code, self.message)
    }
}

impl std::error::Error for ApiError {}
