package main

import (
	"encoding/json"
	"lynx/data_store"
	"lynx/lynx"
	"lynx/storage"
	"sync"
)

type DatabaseStatusResponse struct {
	Databases []DatabaseStatus `json:"databases"`
}

type DatabaseStatus struct {
	Name      string         `json:"name"`
	Role      string         `json:"role"`
	Connected bool           `json:"connected"`
	Error     string         `json:"error,omitempty"`
	Stats     *DatabaseStats `json:"stats,omitempty"`
}

type DatabaseStats struct {
	Database       string           `json:"database"`
	ServerVersion  string           `json:"server_version"`
	SizeBytes      int64            `json:"size_bytes"`
	SizePretty     string           `json:"size_pretty"`
	TableRows      map[string]int64 `json:"table_rows"`
	PostgisVersion string           `json:"postgis_version,omitempty"`
}

type API struct {
	bfIndex    *lynx.BruteForceIndex
	ivfIndex   *lynx.IVFIndex
	ivfPqIndex *lynx.IVFPQIndex
	hnswIndex  *lynx.HNSWIndex

	// C++ vector store wrapper
	vectorStore        *lynx.InMemoryVectorStore
	activeVectorSource string

	// Binary file for persisting embeddings
	// NOTE: It says "vector cache" but it's really just a file on disk that we can load/save to persist the in-memory vector store across restarts
	vectorCache *data_store.VectorCache

	// Postgres vector store
	pgStore *storage.PostgresVectorStore

	// Postgres geo store
	pgGeoStore *storage.PostgresGeoStore

	lock sync.RWMutex

	// Track if indexes are ready
	indexesReady     bool
	indexesReadyLock sync.RWMutex

	jobHub *indexingJobHub
}

const (
	vectorSourceDefault = "vector"
	vectorSourceGeo     = "geo"
)

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

	VectorStoreSwapRequest struct {
		Target string `json:"target"`
	}

	VectorStoreSourceResponse struct {
		Source      string `json:"source"`
		VectorCount int64  `json:"vector_count"`
	}

	VectorStoreSwapResponse struct {
		Source         string `json:"source"`
		VectorCount    int64  `json:"vector_count"`
		PreviousSource string `json:"previous_source,omitempty"`
	}

	IVFConfigRequest struct {
		Nlist  int64 `json:"nlist"`
		Nprobe int64 `json:"nprobe"`
	}

	IVFPQConfigRequest struct {
		Nlist        int64 `json:"nlist"`
		Nprobe       int64 `json:"nprobe"`
		M            int64 `json:"m"`
		CodebookSize int64 `json:"codebook_size"`
	}

	HNSWConfigRequest struct {
		M              int64 `json:"m"`
		EfConstruction int64 `json:"ef_construction"`
		EfSearch       int64 `json:"ef_search"`
	}

	SemanticGeoIndexRequest struct {
		S3Path   string  `json:"s3_path"`
		Region   string  `json:"region"`
		BBoxMinX float64 `json:"bbox_min_x"`
		BBoxMaxX float64 `json:"bbox_max_x"`
		BBoxMinY float64 `json:"bbox_min_y"`
		BBoxMaxY float64 `json:"bbox_max_y"`
		All      bool    `json:"all"`
		Count    *int64  `json:"count,omitempty"`
	}

	SemanticGeoIndexItem struct {
		ID                string   `json:"id"`
		Text              string   `json:"text"`
		Name              string   `json:"name,omitempty"`
		CategoryPrimary   string   `json:"category_primary,omitempty"`
		CategoryAlternate []string `json:"category_alternate,omitempty"`
		TaxonomyHierarchy []string `json:"taxonomy_hierarchy,omitempty"`
		Locality          string   `json:"locality,omitempty"`
		Country           string   `json:"country,omitempty"`
	}

	SemanticGeoSearchRequest struct {
		Query string `json:"query"`
		Count int64  `json:"count"`
	}

	SemanticGeoSearchResult struct {
		ID         string          `json:"id"`
		EmbedText  string          `json:"embed_text"`
		Embedding  []float32       `json:"embedding"`
		Geom       json.RawMessage `json:"geom"`
		Category   *string         `json:"category,omitempty"`
		Country    *string         `json:"country,omitempty"`
		Confidence *float64        `json:"confidence,omitempty"`
		Raw        json.RawMessage `json:"raw"`
	}

	IndexedAreaBBox struct {
		MinX float64 `json:"min_x"`
		MaxX float64 `json:"max_x"`
		MinY float64 `json:"min_y"`
		MaxY float64 `json:"max_y"`
	}

	IndexedArea struct {
		Source         string          `json:"source"`
		BBox           IndexedAreaBBox `json:"bbox"`
		TotalPoints    int64           `json:"total_points"`
		IndexedPoints  int64           `json:"indexed_points"`
		IndexedPercent float64         `json:"indexed_percent"`
		IndexedAt      string          `json:"indexed_at"`
	}

	IndexedAreasResponse struct {
		Areas []IndexedArea `json:"areas"`
	}

	BenchmarkRequest struct {
		NumQueries int      `json:"num_queries"`
		Queries    []string `json:"queries"`
		TopK       int      `json:"top_k"`
	}

	IVFParamSweepRequest struct {
		NlistValues  []int64  `json:"nlist_values"`
		NprobeValues []int64  `json:"nprobe_values"`
		Queries      []string `json:"queries"`
		TopK         int      `json:"top_k"`
	}

	IVFParamResult struct {
		Nlist         int64   `json:"nlist"`
		Nprobe        int64   `json:"nprobe"`
		MeanRecall    float64 `json:"mean_recall"`
		MeanLatencyMs float64 `json:"mean_latency_ms"`
		Speedup       float64 `json:"speedup"`
	}

	IVFPQParamSweepRequest struct {
		NlistValues        []int64  `json:"nlist_values"`
		NprobeValues       []int64  `json:"nprobe_values"`
		MValues            []int64  `json:"m_values"`
		CodebookSizeValues []int64  `json:"codebook_size_values"`
		Queries            []string `json:"queries"`
		TopK               int      `json:"top_k"`
	}

	IVFParamSweepResponse struct {
		Results      []IVFParamResult `json:"results"`
		BestSpeedup  IVFParamResult   `json:"best_speedup"`
		BestRecall   IVFParamResult   `json:"best_recall"`
		BestLatency  IVFParamResult   `json:"best_latency"`
		BestBalanced IVFParamResult   `json:"best_balanced"`
	}

	IVFPQParamResult struct {
		Nlist         int64   `json:"nlist"`
		Nprobe        int64   `json:"nprobe"`
		M             int64   `json:"m"`
		CodebookSize  int64   `json:"codebook_size"`
		MeanRecall    float64 `json:"mean_recall"`
		MeanLatencyMs float64 `json:"mean_latency_ms"`
		Speedup       float64 `json:"speedup"`
	}

	IVFPQParamSweepResponse struct {
		Results      []IVFPQParamResult `json:"results"`
		BestSpeedup  IVFPQParamResult   `json:"best_speedup"`
		BestRecall   IVFPQParamResult   `json:"best_recall"`
		BestLatency  IVFPQParamResult   `json:"best_latency"`
		BestBalanced IVFPQParamResult   `json:"best_balanced"`
	}
)
