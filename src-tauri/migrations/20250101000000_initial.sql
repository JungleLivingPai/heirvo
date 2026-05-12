-- Initial schema for DVD Recovery sessions, sector maps, and outputs.

CREATE TABLE IF NOT EXISTS recovery_sessions (
    id                  TEXT PRIMARY KEY,
    disc_label          TEXT NOT NULL,
    disc_fingerprint    TEXT NOT NULL,
    drive_path          TEXT NOT NULL,
    total_sectors       INTEGER NOT NULL,
    output_dir          TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'created',
    current_pass        INTEGER NOT NULL DEFAULT 0,
    created_at          INTEGER NOT NULL,
    updated_at          INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_fingerprint ON recovery_sessions(disc_fingerprint);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON recovery_sessions(status);

CREATE TABLE IF NOT EXISTS sector_maps (
    session_id  TEXT PRIMARY KEY REFERENCES recovery_sessions(id) ON DELETE CASCADE,
    total       INTEGER NOT NULL,
    data        BLOB NOT NULL,
    checksum    TEXT NOT NULL,
    updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS recovery_passes (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id       TEXT NOT NULL REFERENCES recovery_sessions(id) ON DELETE CASCADE,
    pass_number      INTEGER NOT NULL,
    strategy         TEXT NOT NULL,
    started_at       INTEGER,
    completed_at     INTEGER,
    sectors_good     INTEGER NOT NULL DEFAULT 0,
    sectors_failed   INTEGER NOT NULL DEFAULT 0,
    sectors_skipped  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_passes_session ON recovery_passes(session_id);

CREATE TABLE IF NOT EXISTS sector_errors (
    session_id   TEXT NOT NULL,
    lba          INTEGER NOT NULL,
    error_code   TEXT NOT NULL,
    attempt_num  INTEGER NOT NULL,
    occurred_at  INTEGER NOT NULL,
    PRIMARY KEY (session_id, lba, attempt_num)
);

CREATE TABLE IF NOT EXISTS disc_structure (
    session_id      TEXT PRIMARY KEY REFERENCES recovery_sessions(id) ON DELETE CASCADE,
    structure_json  TEXT NOT NULL,
    updated_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS output_files (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT NOT NULL REFERENCES recovery_sessions(id) ON DELETE CASCADE,
    file_type   TEXT NOT NULL,
    path        TEXT NOT NULL,
    size_bytes  INTEGER,
    status      TEXT NOT NULL DEFAULT 'pending',
    created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_outputs_session ON output_files(session_id);

CREATE TABLE IF NOT EXISTS enhancement_jobs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id      TEXT REFERENCES recovery_sessions(id) ON DELETE SET NULL,
    input_file      TEXT NOT NULL,
    output_file     TEXT NOT NULL,
    pipeline_json   TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'queued',
    progress        REAL NOT NULL DEFAULT 0.0,
    started_at      INTEGER,
    completed_at    INTEGER,
    error_message   TEXT
);
