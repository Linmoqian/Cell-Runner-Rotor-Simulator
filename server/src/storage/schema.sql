PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS observatory_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS observatories (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES observatory_groups(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  palette TEXT NOT NULL DEFAULT 'mint',
  dr_run REAL NOT NULL,
  dr_turn REAL NOT NULL,
  omega_turn REAL NOT NULL,
  tau_run REAL NOT NULL,
  tau_turn REAL NOT NULL,
  v_run REAL NOT NULL,
  v_turn REAL NOT NULL,
  paused INTEGER NOT NULL DEFAULT 0 CHECK (paused IN (0, 1)),
  tick INTEGER NOT NULL DEFAULT 0,
  simulated_minutes REAL NOT NULL DEFAULT 0,
  camera_x REAL NOT NULL DEFAULT 0,
  camera_y REAL NOT NULL DEFAULT 0,
  camera_zoom REAL NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cells (
  id TEXT PRIMARY KEY,
  observatory_id TEXT NOT NULL REFERENCES observatories(id) ON DELETE CASCADE,
  seed INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS cells_observatory_id_idx ON cells(observatory_id);

CREATE TABLE IF NOT EXISTS cell_checkpoints (
  cell_id TEXT PRIMARY KEY REFERENCES cells(id) ON DELETE CASCADE,
  tick INTEGER NOT NULL,
  rng_state INTEGER NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  heading REAL NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('run', 'turn')),
  chirality INTEGER NOT NULL CHECK (chirality IN (-1, 1)),
  state_elapsed_minutes REAL NOT NULL,
  elapsed_minutes REAL NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trajectory_samples (
  cell_id TEXT NOT NULL REFERENCES cells(id) ON DELETE CASCADE,
  tick INTEGER NOT NULL,
  simulated_minutes REAL NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  heading REAL NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('run', 'turn')),
  chirality INTEGER NOT NULL CHECK (chirality IN (-1, 1)),
  PRIMARY KEY (cell_id, tick)
) WITHOUT ROWID;

INSERT OR IGNORE INTO schema_migrations(version, applied_at)
VALUES (1, CURRENT_TIMESTAMP);
