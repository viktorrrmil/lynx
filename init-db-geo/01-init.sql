CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE places
(
    id         TEXT PRIMARY KEY,
    embed_text TEXT NOT NULL,
    embedding  vector(384),
    geom       GEOMETRY(Point, 4326),
    category   TEXT,
    country    TEXT,
    confidence FLOAT,
    raw        JSONB
);

CREATE INDEX ON places USING GIST (geom); -- spatial queries
CREATE INDEX ON places USING hnsw (embedding vector_cosine_ops); -- handled by Lynx, but useful fallback
CREATE INDEX ON places (category);
