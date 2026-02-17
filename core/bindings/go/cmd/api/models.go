package main

import (
	"lynx/data_store"
	"lynx/lynx"
	"lynx/storage"
	"sync"
)

type API struct {
	bfIndex  *lynx.BruteForceIndex
	ivfIndex *lynx.IVFIndex

	// C++ vector store wrapper
	vectorStore *lynx.InMemoryVectorStore

	// Binary file for persisting embeddings
	// NOTE: It says "vector cache" but it's really just a file on disk that we can load/save to persist the in-memory vector store across restarts
	vectorCache *data_store.VectorCache

	// Postgres vector store
	pgStore *storage.PostgresVectorStore

	lock sync.RWMutex
}

type (
	EmbeddingRequest struct {
		Text string `json:"text"`
	}

	EmbeddingBatchRequest struct {
		Batch []string `json:"batch"`
	}

	EmbeddingResponse struct {
		Embeddings []float32 `json:"embedding"`
		Dimension  int64     `json:"dimension"`
	}

	EmbeddingBatchResponse struct {
		BatchEmbeddings [][]float32 `json:"batch_embedding"`
		Dimension       int64       `json:"dimension"`
	}

	SearchRequest struct {
		Query       string `json:"query"`
		TopK        int64  `json:"top_k"`
		TrackRecall bool   `json:"track_recall"`
	}

	BatchResult struct {
		ID   int64  `json:"id"`
		Text string `json:"text"`
	}

	AddTextRequest struct {
		Text string `json:"text"`
	}

	IVFConfigRequest struct {
		Nlist  int64 `json:"nlist"`
		Nprobe int64 `json:"nprobe"`
	}

	BenchmarkRequest struct {
		NumQueries int      `json:"num_queries"`
		Queries    []string `json:"queries"`
		TopK       int      `json:"top_k"`
	}
)
