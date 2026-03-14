package storage

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"

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
