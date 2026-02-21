package main

import (
	"fmt"
	"lynx/data_store"
	"lynx/lynx"
	"lynx/storage"
)

func NewAPI(dimension int64, metric lynx.DistanceMetric) *API {
	// Vector cache setup
	cache := data_store.NewVectorCache("/app/data/vector_cache.bin")
	fmt.Printf("Cache file path: %s\n", cache.FilePath())

	// Connecting to Postgres vector store
	pgStore, err := storage.NewPostgresVectorStore(
		"postgres://lynx:lynx@postgres:5432/lynx?sslmode=disable")

	if err != nil {
		fmt.Printf("[ERROR] Failed to connect to Postgres: %v\n", err)
	}

	vectorStore := lynx.NewInMemoryVectorStore()

	vectors, err := pgStore.GetAllVectors()
	if err != nil {
		fmt.Printf("[ERROR] Failed to get vectors from Postgres: %v\n", err)
	} else {
		fmt.Printf("Retrieved %d vectors from Postgres\n", len(vectors))
	}
	for _, vec := range vectors {
		err := vectorStore.AddVector(vec)
		if err != nil {
			fmt.Printf("[ERROR] Failed to add vector from Postgres to in-memory store: %v\n", err)
		}
	}

	fmt.Printf("Vector store initialized with %d vectors from Postgres\n", vectorStore.Size())

	bfIndex := lynx.NewBruteforceIndex(metric)
	bfIndex.SetVectorStore(vectorStore)

	ivfIndex := lynx.NewIVFIndex(metric, 100, 10)
	ivfIndex.SetVectorStore(vectorStore)

	return &API{
		bfIndex:  bfIndex,
		ivfIndex: ivfIndex,

		vectorStore: vectorStore,
		vectorCache: cache,
		pgStore:     pgStore,
	}
}
