CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    account VARCHAR(64) NOT NULL UNIQUE,
    phone VARCHAR(20) UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL,
    display_name VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS calls (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL,
    driver_id BIGINT REFERENCES users(id),
    police_id BIGINT REFERENCES users(id),
    room_id VARCHAR(96) NOT NULL UNIQUE,
    status VARCHAR(32) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    disconnect_reason VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_calls_session_created ON calls(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_calls_driver_id ON calls(driver_id);
CREATE INDEX IF NOT EXISTS idx_calls_police_id ON calls(police_id);
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);

CREATE TABLE IF NOT EXISTS recordings (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL,
    call_id VARCHAR(36) REFERENCES calls(id),
    status VARCHAR(32) NOT NULL,
    file_path VARCHAR(512) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(128) NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_recordings_session_id ON recordings(session_id);
CREATE INDEX IF NOT EXISTS idx_recordings_call_id ON recordings(call_id);
CREATE INDEX IF NOT EXISTS idx_recordings_status ON recordings(status);

CREATE TABLE IF NOT EXISTS call_transcripts (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL,
    recording_id VARCHAR(36) NOT NULL UNIQUE REFERENCES recordings(id),
    status VARCHAR(32) NOT NULL,
    provider VARCHAR(32) NOT NULL,
    model VARCHAR(64) NOT NULL,
    error_message VARCHAR(1024),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_call_transcripts_session_id ON call_transcripts(session_id);
CREATE INDEX IF NOT EXISTS idx_call_transcripts_status ON call_transcripts(status);

CREATE TABLE IF NOT EXISTS call_transcript_segments (
    id VARCHAR(36) PRIMARY KEY,
    transcript_id VARCHAR(36) NOT NULL REFERENCES call_transcripts(id),
    session_id VARCHAR(64) NOT NULL,
    recording_id VARCHAR(36) NOT NULL REFERENCES recordings(id),
    chunk_index INTEGER NOT NULL,
    segment_index INTEGER NOT NULL,
    speaker VARCHAR(64) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_call_transcript_segments_transcript_id ON call_transcript_segments(transcript_id);
CREATE INDEX IF NOT EXISTS idx_call_transcript_segments_session_id ON call_transcript_segments(session_id);
CREATE INDEX IF NOT EXISTS idx_call_transcript_segments_recording_id ON call_transcript_segments(recording_id);
