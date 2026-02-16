CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS vectors
(
    id         BIGSERIAL PRIMARY KEY,
    text       TEXT NOT NULL,
    embedding  vector(384),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vectors_id ON vectors (id);