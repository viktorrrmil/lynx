package storage

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	_ "github.com/lib/pq"
	"github.com/pgvector/pgvector-go"
)

type PostgresVectorStore struct {
	db *sql.DB
}

func (store *PostgresVectorStore) Db() *sql.DB {
	return store.db
}

func connectWithRetry(connStr string, maxRetries int) (*sql.DB, error) {
	var db *sql.DB
	var err error

	for i := 0; i < maxRetries; i++ {
		db, err = sql.Open("postgres", connStr)
		if err != nil {
			log.Printf("Failed to open database: %v, retrying...", err)
			time.Sleep(2 * time.Second)
			continue
		}

		err = db.Ping()
		if err == nil {
			log.Println("Successfully connected to database!")
			return db, nil
		}

		log.Printf("Failed to ping database (attempt %d/%d): %v", i+1, maxRetries, err)
		time.Sleep(2 * time.Second)
	}

	return nil, fmt.Errorf("failed to connect after %d attempts: %w", maxRetries, err)
}

func NewPostgresVectorStore(connStr string) (*PostgresVectorStore, error) {
	db, err := connectWithRetry(connStr, 10)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	return &PostgresVectorStore{db: db}, nil
}

func (store *PostgresVectorStore) AddVector(text string, embedding []float32) (int64, error) {
	var id int64
	err := store.db.QueryRow(`
		INSERT INTO vectors (text, embedding)
		VALUES ($1, $2)
		RETURNING id
	`, text, pgvector.NewVector(embedding)).Scan(&id)

	return id, err
}

func (store *PostgresVectorStore) AddBatch(texts []string, embeddings [][]float32) ([]int64, error) {
	fmt.Printf("Adding batch of %d vectors to Postgres\n", len(texts))
	tx, err := store.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	ids := make([]int64, len(texts))
	for i := range texts {
		var id int64
		err := tx.QueryRow(`
			INSERT INTO vectors (text, embedding)
			VALUES ($1, $2)
			RETURNING id
		`, texts[i], pgvector.NewVector(embeddings[i])).Scan(&id)

		if err != nil {
			return nil, err
		}
		ids[i] = id
	}

	tx.Commit()
	return ids, nil
}

func (store *PostgresVectorStore) GetVector(id int64) ([]float32, error) {
	var vec pgvector.Vector
	err := store.db.QueryRow(`
		SELECT embedding FROM vectors WHERE id = $1
	`, id).Scan(&vec)

	return vec.Slice(), err
}

func (store *PostgresVectorStore) GetAllVectors() ([][]float32, error) {
	rows, err := store.db.Query(`SELECT embedding FROM vectors ORDER BY id`)
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

	return vectors, nil
}

func (store *PostgresVectorStore) Size() (int64, error) {
	var count int64
	err := store.db.QueryRow(`SELECT COUNT(*) FROM vectors`).Scan(&count)
	return count, err
}
