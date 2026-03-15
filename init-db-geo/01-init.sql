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

CREATE TABLE indexed_areas
(
    id             BIGSERIAL PRIMARY KEY,
    source         TEXT NOT NULL,
    bbox_min_x     DOUBLE PRECISION NOT NULL,
    bbox_max_x     DOUBLE PRECISION NOT NULL,
    bbox_min_y     DOUBLE PRECISION NOT NULL,
    bbox_max_y     DOUBLE PRECISION NOT NULL,
    total_points   BIGINT NOT NULL,
    indexed_points BIGINT NOT NULL,
    indexed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (source, bbox_min_x, bbox_max_x, bbox_min_y, bbox_max_y)
);

CREATE INDEX ON indexed_areas (source);
CREATE INDEX ON indexed_areas (indexed_at DESC);
