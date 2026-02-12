package main

import (
	"lynx/lynx"
	"sync"
)

type API struct {
	bfIndex  *lynx.BruteForceIndex
	ivfIndex *lynx.IVFIndex

	bfMetadata  map[int64]string // id -> original text
	ivfMetadata map[int64]string // id -> original text

	bfNextID  int64
	ivfNextID int64

	vectorStore *lynx.InMemoryVectorStore

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
		Query string `json:"query"`
		TopK  int64  `json:"top_k"`
	}

	BatchResult struct {
		ID   int64  `json:"id"`
		Text string `json:"text"`
	}

	AddTextRequest struct {
		Text string `json:"text"`
	}
)
