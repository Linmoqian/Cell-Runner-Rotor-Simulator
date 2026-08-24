//! Headless 批量仿真入口（examples，不参与桌面应用构建）。
//!
//! 用法: cargo run --release --example simulate -- <job.json>
//! 读取参数任务文件，调用 domain::runner_rotor 逐步推进细胞，
//! 仅输出轨迹数据 CSV（track_id, frame, t_min, x_um, y_um, state）。
//!
//! 种子约定: 任务给定的 seed 为统一基础种子（如 42），
//! 每条轨迹在其上加轨迹序号偏移，避免完全相同的随机流
//! 导致各轨迹互为旋转复制；初始朝向按黄金角铺开。

use cell_runner_rotor_desktop::domain::runner_rotor::{step_cell, Cell, CellParams, CellState};
use serde::Deserialize;
use std::fs;

#[derive(Deserialize)]
struct Job {
    output_dir: String,
    datasets: Vec<DatasetJob>,
}

#[derive(Deserialize)]
struct DatasetJob {
    name: String,
    dr_run: f64,
    dr_turn: f64,
    omega_turn: f64,
    tau_run: f64,
    tau_turn: f64,
    v_run: f64,
    v_turn: f64,
    n_tracks: usize,
    frames: usize,
    dt_min: f64,
    seed: u32,
    /// 可选初始位置列表 [x, y]（um），取自真实轨迹起点，
    /// 使仿真与真实数据在相同空间分布下对比运动学；轨迹数超出时循环取用。
    spawn: Option<Vec<[f64; 2]>>,
}

const GOLDEN_ANGLE_RAD: f64 = 2.399963229728653;

fn main() {
    let job_path = std::env::args()
        .nth(1)
        .unwrap_or_else(|| panic!("用法: simulate <job.json>"));
    let raw = fs::read_to_string(&job_path).unwrap_or_else(|e| panic!("读取任务文件失败: {e}"));
    let job: Job = serde_json::from_str(&raw).unwrap_or_else(|e| panic!("解析任务 JSON 失败: {e}"));

    fs::create_dir_all(&job.output_dir).unwrap_or_else(|e| panic!("创建输出目录失败: {e}"));

    for ds in &job.datasets {
        let params = CellParams {
            dr_run: ds.dr_run,
            dr_turn: ds.dr_turn,
            omega_turn: ds.omega_turn,
            tau_run: ds.tau_run,
            tau_turn: ds.tau_turn,
            v_run: ds.v_run,
            v_turn: ds.v_turn,
        };
        let mut csv = String::from("track_id,frame,t_min,x_um,y_um,state\n");
        for i in 0..ds.n_tracks {
            let (x0, y0) = match &ds.spawn {
                Some(points) if !points.is_empty() => {
                    let p = points[i % points.len()];
                    (p[0], p[1])
                }
                _ => (0.0, 0.0),
            };
            let mut cell = Cell::new(
                format!("sim_{i:04}"),
                ds.name.clone(),
                ds.seed.wrapping_add(i as u32),
                x0,
                y0,
                (i as f64) * GOLDEN_ANGLE_RAD,
            );
            for frame in 0..ds.frames {
                step_cell(&mut cell, params, ds.dt_min);
                let state = match cell.state {
                    CellState::Run => "run",
                    CellState::Turn => "turn",
                };
                csv.push_str(&format!(
                    "{i},{frame},{:.6},{:.6},{:.6},{state}\n",
                    (frame + 1) as f64 * ds.dt_min,
                    cell.x,
                    cell.y
                ));
            }
        }
        let out_path = format!("{}/{}_sim.csv", job.output_dir.trim_end_matches('/'), ds.name);
        fs::write(&out_path, &csv).unwrap_or_else(|e| panic!("写出 {out_path} 失败: {e}"));
        println!(
            "[成功] {}: {} 条轨迹 x {} 帧 -> {out_path}",
            ds.name, ds.n_tracks, ds.frames
        );
    }
}
