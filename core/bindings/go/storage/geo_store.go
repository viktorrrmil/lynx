package storage

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"time"

	_ "github.com/lib/pq"
	"github.com/pgvector/pgvector-go"
)

type GeoPlace struct {
	ID         string
	EmbedText  string
	Embedding  []float32
	Longitude  *float64
	Latitude   *float64
	Category   *string
	Country    *string
	Confidence *float64
	Raw        json.RawMessage
}

type GeoSearchResult struct {
	ID         string          `json:"id"`
	EmbedText  string          `json:"embed_text"`
	Embedding  []float32       `json:"embedding"`
	Geom       json.RawMessage `json:"geom"`
	Category   *string         `json:"category,omitempty"`
	Country    *string         `json:"country,omitempty"`
	Confidence *float64        `json:"confidence,omitempty"`
	Raw        json.RawMessage `json:"raw"`
}

type GeoIndexedArea struct {
	Source        string
	BBoxMinX      float64
	BBoxMaxX      float64
	BBoxMinY      float64
	BBoxMaxY      float64
	TotalPoints   int64
	IndexedPoints int64
	IndexedAt     time.Time
}

type PostgresGeoStore struct {
	db *sql.DB
}

func (store *PostgresGeoStore) Db() *sql.DB {
	return store.db
}

func (store *PostgresGeoStore) Close() error {
	if store.db != nil {
		return store.db.Close()
	}
	return nil
}

func NewPostgresGeoStore(connStr string) (*PostgresGeoStore, error) {
	db, err := connectWithRetry(connStr, 10, "")
	if err != nil {
		log.Fatal(err)
	}

	if err := ensureGeoSchema(db); err != nil {
		log.Fatal(err)
	}

	logTableCount(db, "places")

	return &PostgresGeoStore{db: db}, nil
}

func (store *PostgresGeoStore) AddPlaces(places []GeoPlace) error {
	if len(places) == 0 {
		return nil
	}

	tx, err := store.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(`
		INSERT INTO places (id, embed_text, embedding, geom, category, country, confidence, raw)
		VALUES (
			$1,
			$2,
			$3,
			CASE
				WHEN $4::double precision IS NULL OR $5::double precision IS NULL THEN NULL
				ELSE ST_SetSRID(ST_MakePoint($4::double precision, $5::double precision), 4326)
			END,
			$6,
			$7,
			$8,
			$9
		)
		ON CONFLICT (id) DO UPDATE SET
			embed_text = EXCLUDED.embed_text,
			embedding = EXCLUDED.embedding,
			geom = EXCLUDED.geom,
			category = EXCLUDED.category,
			country = EXCLUDED.country,
			confidence = EXCLUDED.confidence,
			raw = EXCLUDED.raw
	`)
	if err != nil {
		return fmt.Errorf("failed to prepare place insert: %w", err)
	}
	defer stmt.Close()

	for _, place := range places {
		_, err := stmt.Exec(
			place.ID,
			place.EmbedText,
			pgvector.NewVector(place.Embedding),
			place.Longitude,
			place.Latitude,
			place.Category,
			place.Country,
			place.Confidence,
			[]byte(place.Raw),
		)
		if err != nil {
			return fmt.Errorf("failed to insert place %s: %w", place.ID, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit place inserts: %w", err)
	}

	return nil
}

func (store *PostgresGeoStore) GetAllEmbeddings() ([][]float32, error) {
	if store.db == nil {
		return nil, fmt.Errorf("geo store database is nil")
	}

	rows, err := store.db.Query(`SELECT embedding FROM places ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var vectors [][]float32
	for rows.Next() {
		var vec pgvector.Vector
		if err := rows.Scan(&vec); err != nil {
			return nil, err
		}
		vectors = append(vectors, vec.Slice())
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return vectors, nil
}

func (store *PostgresGeoStore) SearchPlaces(embedding []float32, limit int64) ([]GeoSearchResult, error) {
	if store.db == nil {
		return nil, fmt.Errorf("geo store database is nil")
	}
	if limit <= 0 {
		return nil, fmt.Errorf("limit must be greater than 0")
	}

	rows, err := store.db.Query(`
		SELECT
			id,
			embed_text,
			embedding,
			ST_AsGeoJSON(geom) AS geom,
			category,
			country,
			confidence,
			raw
		FROM places
		ORDER BY embedding <=> $1
		LIMIT $2
	`, pgvector.NewVector(embedding), limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query geo places: %w", err)
	}
	defer rows.Close()

	results := []GeoSearchResult{}
	for rows.Next() {
		var (
			id         string
			embedText  string
			vec        pgvector.Vector
			geom       sql.NullString
			category   sql.NullString
			country    sql.NullString
			confidence sql.NullFloat64
			raw        []byte
		)

		if err := rows.Scan(&id, &embedText, &vec, &geom, &category, &country, &confidence, &raw); err != nil {
			return nil, fmt.Errorf("failed to scan geo place: %w", err)
		}

		result := GeoSearchResult{
			ID:        id,
			EmbedText: embedText,
			Embedding: vec.Slice(),
		}
		if geom.Valid && geom.String != "" {
			result.Geom = json.RawMessage(geom.String)
		}
		if category.Valid {
			value := category.String
			result.Category = &value
		}
		if country.Valid {
			value := country.String
			result.Country = &value
		}
		if confidence.Valid {
			value := confidence.Float64
			result.Confidence = &value
		}
		if len(raw) > 0 {
			result.Raw = json.RawMessage(raw)
		}
		results = append(results, result)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("geo place iteration failed: %w", err)
	}

	return results, nil
}

func (store *PostgresGeoStore) UpsertIndexedArea(area GeoIndexedArea) error {
	if store.db == nil {
		return fmt.Errorf("geo store database is nil")
	}

	_, err := store.db.Exec(`
		INSERT INTO indexed_areas (
			source,
			bbox_min_x,
			bbox_max_x,
			bbox_min_y,
			bbox_max_y,
			total_points,
			indexed_points,
			indexed_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (source, bbox_min_x, bbox_max_x, bbox_min_y, bbox_max_y) DO UPDATE SET
			total_points = EXCLUDED.total_points,
			indexed_points = EXCLUDED.indexed_points,
			indexed_at = EXCLUDED.indexed_at
	`,
		area.Source,
		area.BBoxMinX,
		area.BBoxMaxX,
		area.BBoxMinY,
		area.BBoxMaxY,
		area.TotalPoints,
		area.IndexedPoints,
		area.IndexedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to upsert indexed area: %w", err)
	}

	return nil
}

func (store *PostgresGeoStore) ListIndexedAreas() ([]GeoIndexedArea, error) {
	if store.db == nil {
		return nil, fmt.Errorf("geo store database is nil")
	}

	rows, err := store.db.Query(`
		SELECT
			source,
			bbox_min_x,
			bbox_max_x,
			bbox_min_y,
			bbox_max_y,
			total_points,
			indexed_points,
			indexed_at
		FROM indexed_areas
		ORDER BY indexed_at DESC, source
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to list indexed areas: %w", err)
	}
	defer rows.Close()

	var areas []GeoIndexedArea
	for rows.Next() {
		var area GeoIndexedArea
		if err := rows.Scan(
			&area.Source,
			&area.BBoxMinX,
			&area.BBoxMaxX,
			&area.BBoxMinY,
			&area.BBoxMaxY,
			&area.TotalPoints,
			&area.IndexedPoints,
			&area.IndexedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan indexed area: %w", err)
		}
		areas = append(areas, area)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("indexed area iteration failed: %w", err)
	}

	return areas, nil
}

func (store *PostgresGeoStore) DeleteEmptyIndexedAreas() (int64, error) {
	if store.db == nil {
		return 0, fmt.Errorf("geo store database is nil")
	}

	result, err := store.db.Exec(`DELETE FROM indexed_areas WHERE total_points <= 0`)
	if err != nil {
		return 0, fmt.Errorf("failed to delete empty indexed areas: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("failed to read deleted indexed areas count: %w", err)
	}

	return rows, nil
}

func ensureGeoSchema(db *sql.DB) error {
	if db == nil {
		return fmt.Errorf("geo schema initialization failed: database is nil")
	}

	_, err := db.Exec(`
		CREATE EXTENSION IF NOT EXISTS postgis;
		CREATE EXTENSION IF NOT EXISTS vector;

		CREATE TABLE IF NOT EXISTS places
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

		CREATE INDEX IF NOT EXISTS places_geom_idx ON places USING GIST (geom);
		CREATE INDEX IF NOT EXISTS places_embedding_idx ON places USING hnsw (embedding vector_cosine_ops);
		CREATE INDEX IF NOT EXISTS places_category_idx ON places (category);

		CREATE TABLE IF NOT EXISTS indexed_areas
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

		CREATE INDEX IF NOT EXISTS indexed_areas_source_idx ON indexed_areas (source);
		CREATE INDEX IF NOT EXISTS indexed_areas_indexed_at_idx ON indexed_areas (indexed_at DESC);
	`)
	if err != nil {
		return fmt.Errorf("geo schema initialization failed: %w", err)
	}

	return nil
}

func logTableCount(db *sql.DB, table string) {
	if db == nil || table == "" {
		return
	}

	log.Printf("Row count in %s table:", table)
	var count int64
	if err := db.QueryRow(fmt.Sprintf(`SELECT COUNT(*) FROM %s`, table)).Scan(&count); err != nil {
		log.Printf("Failed to count rows in %s table: %v", table, err)
		return
	}
	log.Println(count)
}
