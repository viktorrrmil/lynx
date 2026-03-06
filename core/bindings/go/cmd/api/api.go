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
	ivfIndex := lynx.NewIVFIndex(metric, 350, 50)
	ivfPqIndex := lynx.NewIVFPQIndex(metric, 350, 125, 32, 256)
	hnswIndex := lynx.NewHNSWIndex(metric, 32, 400, 300)

	api := &API{
		bfIndex:      bfIndex,
		ivfIndex:     ivfIndex,
		ivfPqIndex:   ivfPqIndex,
		hnswIndex:    hnswIndex,
		vectorStore:  vectorStore,
		vectorCache:  cache,
		pgStore:      pgStore,
		indexesReady: false,
	}

	// Build indexes asynchronously in background
	go func() {
		fmt.Println("[INFO] Starting async index building...")

		fmt.Println("[INFO] Building BruteForce index...")
		bfIndex.SetVectorStore(vectorStore)
		fmt.Println("[INFO] ✓ BruteForce index ready")

		fmt.Println("[INFO] Training IVF index...")
		ivfIndex.SetVectorStore(vectorStore)
		fmt.Println("[INFO] ✓ IVF index ready")

		fmt.Println("[INFO] Training IVF-PQ index...")
		ivfPqIndex.SetVectorStore(vectorStore)
		fmt.Println("[INFO] ✓ IVF-PQ index ready")

		fmt.Println("[INFO] Building HNSW index (this may take a while)...")
		hnswIndex.SetVectorStore(vectorStore)
		fmt.Println("[INFO] ✓ HNSW index ready")

		api.indexesReadyLock.Lock()
		api.indexesReady = true
		api.indexesReadyLock.Unlock()

		fmt.Println("[INFO] ✓✓✓ All indexes are now ready!")
	}()

	return api
}
