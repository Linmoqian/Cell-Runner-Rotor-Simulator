use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CellParams {
    pub dr_run: f64,
    pub dr_turn: f64,
    pub omega_turn: f64,
    pub tau_run: f64,
    pub tau_turn: f64,
    pub v_run: f64,
    pub v_turn: f64,
}

impl Default for CellParams {
    fn default() -> Self {
        Self {
            dr_run: 0.005,
            dr_turn: 0.031,
            omega_turn: 0.160,
            tau_run: 29.9,
            tau_turn: 8.2,
            v_run: 0.39,
            v_turn: 0.32,
        }
    }
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum CellState {
    Run,
    Turn,
}

#[derive(Clone, Debug)]
pub struct Cell {
    pub chirality: i8,
    pub elapsed_minutes: f64,
    pub heading: f64,
    pub id: String,
    pub observatory_id: String,
    pub rng_state: u32,
    pub state: CellState,
    pub state_elapsed_minutes: f64,
    pub x: f64,
    pub y: f64,
}

impl Cell {
    pub fn new(
        id: String,
        observatory_id: String,
        seed: u32,
        x: f64,
        y: f64,
        heading: f64,
    ) -> Self {
        Self {
            chirality: 1,
            elapsed_minutes: 0.0,
            heading,
            id,
            observatory_id,
            rng_state: seed,
            state: CellState::Run,
            state_elapsed_minutes: 0.0,
            x,
            y,
        }
    }

    pub fn next_random(&mut self) -> f64 {
        self.rng_state = self.rng_state.wrapping_add(0x6d2b_79f5);
        let mut value = self.rng_state;
        value = (value ^ (value >> 15)).wrapping_mul(value | 1);
        value ^= value.wrapping_add((value ^ (value >> 7)).wrapping_mul(value | 61));
        f64::from(value ^ (value >> 14)) / 4_294_967_296.0
    }
}

pub fn switch_probability(dt_minutes: f64, mean_duration_minutes: f64) -> f64 {
    if dt_minutes <= 0.0 {
        return 0.0;
    }
    if mean_duration_minutes <= 0.0 {
        return 1.0;
    }
    1.0 - (-dt_minutes / mean_duration_minutes).exp()
}

fn standard_normal(cell: &mut Cell) -> f64 {
    let first = cell.next_random().max(f64::EPSILON);
    let second = cell.next_random();
    (-2.0 * first.ln()).sqrt() * (2.0 * std::f64::consts::PI * second).cos()
}

pub fn step_cell(cell: &mut Cell, params: CellParams, dt_minutes: f64) {
    if dt_minutes <= 0.0 {
        return;
    }
    let mean_duration = match cell.state {
        CellState::Run => params.tau_run,
        CellState::Turn => params.tau_turn,
    };
    let switches_state = cell.next_random() < switch_probability(dt_minutes, mean_duration);
    let previous_state = cell.state;
    if switches_state {
        cell.state = match cell.state {
            CellState::Run => CellState::Turn,
            CellState::Turn => CellState::Run,
        };
    }
    if previous_state == CellState::Run && cell.state == CellState::Turn {
        cell.chirality = if cell.next_random() < 0.5 { -1 } else { 1 };
    }
    let diffusion = match cell.state {
        CellState::Run => params.dr_run,
        CellState::Turn => params.dr_turn,
    };
    let turn = match cell.state {
        CellState::Run => 0.0,
        CellState::Turn => f64::from(cell.chirality) * params.omega_turn * dt_minutes,
    };
    let noise = (2.0 * diffusion * dt_minutes).sqrt() * standard_normal(cell);
    cell.heading = (cell.heading + turn + noise)
        .sin()
        .atan2((cell.heading + turn + noise).cos());
    cell.state_elapsed_minutes = if switches_state {
        dt_minutes
    } else {
        cell.state_elapsed_minutes + dt_minutes
    };
    cell.elapsed_minutes += dt_minutes;
    let speed = match cell.state {
        CellState::Run => params.v_run,
        CellState::Turn => params.v_turn,
    };
    cell.x += speed * cell.heading.cos() * dt_minutes;
    cell.y += speed * cell.heading.sin() * dt_minutes;
}

#[cfg(test)]
mod tests {
    use super::{Cell, CellParams, step_cell, switch_probability};

    #[test]
    fn exponential_switch_probability_matches_model() {
        let actual = switch_probability(29.9, 29.9);
        assert!((actual - (1.0 - (-1.0_f64).exp())).abs() < 1e-12);
    }

    #[test]
    fn seeded_trajectory_is_independent_from_interleaving() {
        let mut first = Cell::new("a".into(), "o".into(), 7, 0.0, 0.0, 0.0);
        let mut second = Cell::new("b".into(), "o".into(), 7, 0.0, 0.0, 0.0);
        let mut unrelated = Cell::new("c".into(), "o".into(), 99, 0.0, 0.0, -0.18);
        for _ in 0..100 {
            step_cell(&mut first, CellParams::default(), 0.1);
            step_cell(&mut unrelated, CellParams::default(), 0.1);
            step_cell(&mut second, CellParams::default(), 0.1);
        }
        assert_eq!(first.x, second.x);
        assert_eq!(first.y, second.y);
        assert_eq!(first.heading, second.heading);
        assert_eq!(first.state, second.state);
    }
}
