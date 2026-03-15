package main

import (
	"database/sql"
	"fmt"
	"lynx/lynx"
	"lynx/metrics"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// Helper functions to reduce code duplication

func (api *API) isReady(c *gin.Context) {
	if api == nil || api.vectorStore == nil || api.pgStore == nil {
		c.JSON(503, gin.H{
			"ready":   false,
			"message": "API or dependencies not initialized",
		})
		return
	}

	api.indexesReadyLock.RLock()
	ready := api.indexesReady
	api.indexesReadyLock.RUnlock()

	if !ready {
		c.JSON(503, gin.H{
			"ready":   false,
			"message": "Indexes are still building in the background",
			"status": gin.H{
				"bf_ready":     api.bfIndex.IsInitialized(),
				"ivf_ready":    api.ivfIndex.IsInitialized(),
				"ivfpq_ready":  api.ivfPqIndex.IsInitialized(),
				"hnsw_ready":   api.hnswIndex.IsBuilt(),
				"vector_count": api.vectorStore.Size(),
			},
		})
		return
	}

	c.JSON(200, gin.H{
		"ready":   true,
		"message": "All indexes are ready",
		"status": gin.H{
			"bf_ready":     api.bfIndex.IsInitialized(),
			"ivf_ready":    api.ivfIndex.IsInitialized(),
			"ivfpq_ready":  api.ivfPqIndex.IsInitialized(),
			"hnsw_ready":   api.hnswIndex.IsBuilt(),
			"vector_count": api.vectorStore.Size(),
		},
	})
}

func (api *API) enrichResultsWithText(results []lynx.SearchResult) []map[string]interface{} {
	enrichedResults := make([]map[string]interface{}, len(results))
	for i, result := range results {
		var text string
		_ = api.pgStore.Db().QueryRow(
			"SELECT text FROM vectors WHERE id = $1",
			result.ID,
		).Scan(&text)

		enrichedResults[i] = map[string]interface{}{
			"id":       result.ID,
			"distance": result.Distance,
			"text":     text,
		}
	}
	return enrichedResults
}

func (api *API) calculateRecallIfRequested(embeddedQuery []float32, results []lynx.SearchResult, topK int64, trackRecall bool) (float64, error) {
	if !trackRecall {
		return -1, nil
	}
	bfResults, err := api.bfIndex.Search(embeddedQuery, topK)
	if err != nil {
		return 0, err
	}
	return metrics.CalculateRecall(bfResults, results, topK), nil
}

func normalizeVectorSource(source string) (string, error) {
	normalized := strings.ToLower(strings.TrimSpace(source))
	switch normalized {
	case vectorSourceDefault, "default":
		return vectorSourceDefault, nil
	case vectorSourceGeo:
		return vectorSourceGeo, nil
	case "":
		return "", fmt.Errorf("target is required")
	default:
		return "", fmt.Errorf("unsupported target: %s", normalized)
	}
}

func (api *API) bfSearch(c *gin.Context) {
	var request SearchRequest
	if err := c.BindJSON(&request); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	api.lock.RLock()
	defer api.lock.RUnlock()

	embeddedQuery, err := getEmbeddings(request.Query)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	start := time.Now()
	results, err := api.bfIndex.Search(embeddedQuery, request.TopK)
	searchTime := time.Since(start)

	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	if results == nil {
		c.JSON(500, gin.H{"error": "Search returned no results"})
		return
	}

	print("Number of results: " + strconv.Itoa(len(results)) + "\n")

	c.IndentedJSON(200, gin.H{
		"results":        api.enrichResultsWithText(results),
		"search_time_ns": searchTime.Nanoseconds(),
		"index_type":     "bruteforce",
		"index_size":     api.vectorStore.Size(),
	})
}

func (api *API) ivfSearch(c *gin.Context) {
	var request SearchRequest
	if err := c.BindJSON(&request); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	api.lock.RLock()
	defer api.lock.RUnlock()

	embeddedQuery, err := getEmbeddings(request.Query)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	start := time.Now()
	results, err := api.ivfIndex.Search(embeddedQuery, request.TopK)
	searchTime := time.Since(start)

	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	recall, err := api.calculateRecallIfRequested(embeddedQuery, results, request.TopK, request.TrackRecall)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	c.IndentedJSON(200, gin.H{
		"results":        api.enrichResultsWithText(results),
		"search_time_ns": searchTime.Nanoseconds(),
		"index_type":     "ivf",
		"index_size":     api.ivfIndex.Size(),
		"recall":         recall,
	})
}

func (api *API) ivfPqSearch(c *gin.Context) {
	var request SearchRequest
	if err := c.BindJSON(&request); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	api.lock.RLock()
	defer api.lock.RUnlock()

	embeddedQuery, err := getEmbeddings(request.Query)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	start := time.Now()
	results, err := api.ivfPqIndex.Search(embeddedQuery, request.TopK)
	searchTime := time.Since(start)

	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	recall, err := api.calculateRecallIfRequested(embeddedQuery, results, request.TopK, request.TrackRecall)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	c.IndentedJSON(200, gin.H{
		"results":        api.enrichResultsWithText(results),
		"search_time_ns": searchTime.Nanoseconds(),
		"index_type":     "ivfpq",
		"index_size":     api.ivfPqIndex.Size(),
		"recall":         recall,
	})
}

func (api *API) hnswSearch(c *gin.Context) {
	var request SearchRequest
	if err := c.BindJSON(&request); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	api.lock.RLock()
	defer api.lock.RUnlock()

	embeddedQuery, err := getEmbeddings(request.Query)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	start := time.Now()
	results, err := api.hnswIndex.Search(embeddedQuery, request.TopK)
	searchTime := time.Since(start)

	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	recall, err := api.calculateRecallIfRequested(embeddedQuery, results, request.TopK, request.TrackRecall)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	c.IndentedJSON(200, gin.H{
		"results":        api.enrichResultsWithText(results),
		"search_time_ns": searchTime.Nanoseconds(),
		"index_type":     "hnsw",
		"index_size":     api.hnswIndex.Size(),
		"recall":         recall,
	})
}

func (api *API) semanticGeoSearch(c *gin.Context) {
	var request SemanticGeoSearchRequest
	if err := c.BindJSON(&request); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	query := strings.TrimSpace(request.Query)
	if query == "" {
		c.JSON(400, gin.H{"error": "query is required"})
		return
	}
	if request.Count <= 0 {
		c.JSON(400, gin.H{"error": "count must be greater than 0"})
		return
	}
	if api == nil || api.pgGeoStore == nil {
		c.JSON(503, gin.H{"error": "geo store is not initialized"})
		return
	}

	embeddedQuery, err := getEmbeddings(query)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to get embeddings for query: " + err.Error()})
		return
	}

	results, err := api.pgGeoStore.SearchPlaces(embeddedQuery, request.Count)
	if err != nil {
		c.JSON(500, gin.H{"error": "Geo search failed: " + err.Error()})
		return
	}

	c.IndentedJSON(200, results)
}

func (api *API) getVectorStoreSource(c *gin.Context) {
	api.lock.RLock()
	source := api.activeVectorSource
	vectorCount := int64(0)
	if api.vectorStore != nil {
		vectorCount = api.vectorStore.Size()
	}
	api.lock.RUnlock()

	c.IndentedJSON(200, VectorStoreSourceResponse{
		Source:      source,
		VectorCount: vectorCount,
	})
}

func (api *API) addToVectorStore(c *gin.Context) {
	var request AddTextRequest
	if err := c.BindJSON(&request); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	embeddedVector, err := getEmbeddings(request.Text)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	api.lock.Lock()
	defer api.lock.Unlock()

	id, err := api.pgStore.AddVector(request.Text, embeddedVector)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to add vector to Postgres store: " + err.Error()})
		return
	}

	if err := api.vectorStore.AddVector(embeddedVector); err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	c.IndentedJSON(200, gin.H{
		"message": "Vector added successfully",
		"count":   1,
		"id":      id,
	})
}

func (api *API) hotSwapVectorStore(c *gin.Context) {
	var request VectorStoreSwapRequest
	if err := c.BindJSON(&request); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	target, err := normalizeVectorSource(request.Target)
	if err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	var vectors [][]float32
	switch target {
	case vectorSourceDefault:
		if api.pgStore == nil {
			c.JSON(500, gin.H{"error": "vector store database is not initialized"})
			return
		}
		vectors, err = api.pgStore.GetAllVectors()
	case vectorSourceGeo:
		if api.pgGeoStore == nil {
			c.JSON(500, gin.H{"error": "geo store database is not initialized"})
			return
		}
		vectors, err = api.pgGeoStore.GetAllEmbeddings()
	}
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to fetch vectors: " + err.Error()})
		return
	}

	newStore := lynx.NewInMemoryVectorStore()
	if len(vectors) > 0 {
		if err := newStore.AddBatch(vectors); err != nil {
			newStore.Delete()
			c.JSON(500, gin.H{"error": "failed to load vectors into new store: " + err.Error()})
			return
		}
	}

	api.lock.Lock()
	defer api.lock.Unlock()

	api.indexesReadyLock.Lock()
	api.indexesReady = false
	api.indexesReadyLock.Unlock()

	oldStore := api.vectorStore
	previousSource := api.activeVectorSource
	api.vectorStore = newStore

	restore := func(reason string, cause error) {
		api.vectorStore = oldStore
		if oldStore != nil {
			api.bfIndex.SetVectorStore(oldStore)
			api.ivfIndex.SetVectorStore(oldStore)
			_ = api.ivfIndex.UpdateVectors()
			api.ivfPqIndex.SetVectorStore(oldStore)
			_ = api.ivfPqIndex.UpdateVectors()
			_ = api.hnswIndex.SetVectorStore(oldStore)
		}
		api.indexesReadyLock.Lock()
		api.indexesReady = true
		api.indexesReadyLock.Unlock()
		newStore.Delete()
		c.JSON(500, gin.H{"error": reason + ": " + cause.Error()})
	}

	if ok := api.bfIndex.SetVectorStore(newStore); !ok {
		restore("failed to set BruteForce index vector store", fmt.Errorf("operation returned false"))
		return
	}
	if ok := api.ivfIndex.SetVectorStore(newStore); !ok {
		restore("failed to set IVF index vector store", fmt.Errorf("operation returned false"))
		return
	}
	if err := api.ivfIndex.UpdateVectors(); err != nil {
		restore("failed to update IVF index vectors", err)
		return
	}
	if ok := api.ivfPqIndex.SetVectorStore(newStore); !ok {
		restore("failed to set IVF-PQ index vector store", fmt.Errorf("operation returned false"))
		return
	}
	if err := api.ivfPqIndex.UpdateVectors(); err != nil {
		restore("failed to update IVF-PQ index vectors", err)
		return
	}
	if err := api.hnswIndex.SetVectorStore(newStore); err != nil {
		restore("failed to rebuild HNSW index", err)
		return
	}

	if oldStore != nil {
		oldStore.Delete()
	}

	api.activeVectorSource = target
	api.indexesReadyLock.Lock()
	api.indexesReady = true
	api.indexesReadyLock.Unlock()

	c.IndentedJSON(200, VectorStoreSwapResponse{
		Source:         target,
		VectorCount:    newStore.Size(),
		PreviousSource: previousSource,
	})
}

func (api *API) addBatchToVectorStore(c *gin.Context) {
	var request EmbeddingBatchRequest
	if err := c.BindJSON(&request); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	embeddedTextBatch, err := getBatchEmbeddings(request.Batch)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	api.lock.Lock()
	defer api.lock.Unlock()

	ids, err := api.pgStore.AddBatch(request.Batch, embeddedTextBatch)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to add batch to Postgres store: " + err.Error()})
		return
	}

	for _, emb := range embeddedTextBatch {
		if err := api.vectorStore.AddVector(emb); err != nil {
			c.JSON(500, gin.H{"error": "Could not add vector to store: " + err.Error()})
			return
		}
	}

	if err := api.ivfIndex.UpdateVectors(); err != nil {
		c.JSON(500, gin.H{"error": "Could not update IVF index vectors: " + err.Error()})
		return
	}

	c.IndentedJSON(200, gin.H{
		"message": "Batch vectors added successfully",
		"count":   len(embeddedTextBatch),
		"ids":     ids,
	})
}

func (api *API) getInfo(c *gin.Context) {
	api.lock.RLock()
	info := map[string]interface{}{
		"size":      api.vectorStore.Size(),
		"dimension": api.vectorStore.Dimension(),
	}
	api.lock.RUnlock()
	c.IndentedJSON(200, info)
}

func fetchDatabaseStats(db *sql.DB, tables []string, includePostgis bool) (*DatabaseStats, []string, error) {
	stats := &DatabaseStats{TableRows: map[string]int64{}}
	if err := db.QueryRow("SELECT current_database()").Scan(&stats.Database); err != nil {
		return nil, nil, fmt.Errorf("failed to query database name: %w", err)
	}

	warnings := []string{}

	if err := db.QueryRow("SHOW server_version").Scan(&stats.ServerVersion); err != nil {
		warnings = append(warnings, fmt.Sprintf("server_version: %v", err))
	}

	if err := db.QueryRow("SELECT pg_database_size(current_database())").Scan(&stats.SizeBytes); err != nil {
		warnings = append(warnings, fmt.Sprintf("size_bytes: %v", err))
	}

	if err := db.QueryRow("SELECT pg_size_pretty(pg_database_size(current_database()))").Scan(&stats.SizePretty); err != nil {
		warnings = append(warnings, fmt.Sprintf("size_pretty: %v", err))
	}

	for _, table := range tables {
		var count int64
		if err := db.QueryRow(fmt.Sprintf("SELECT COUNT(*) FROM %s", table)).Scan(&count); err != nil {
			warnings = append(warnings, fmt.Sprintf("table %s: %v", table, err))
			continue
		}
		stats.TableRows[table] = count
	}

	if includePostgis {
		if err := db.QueryRow("SELECT PostGIS_Version()").Scan(&stats.PostgisVersion); err != nil {
			warnings = append(warnings, fmt.Sprintf("postgis_version: %v", err))
		}
	}

	return stats, warnings, nil
}

func buildDatabaseStatus(name string, role string, db *sql.DB, tables []string, includePostgis bool) DatabaseStatus {
	status := DatabaseStatus{
		Name:      name,
		Role:      role,
		Connected: false,
	}

	if db == nil {
		status.Error = "database connection not initialized"
		return status
	}

	stats, warnings, err := fetchDatabaseStats(db, tables, includePostgis)
	if err != nil {
		status.Error = err.Error()
		return status
	}

	status.Connected = true
	status.Stats = stats
	if len(warnings) > 0 {
		status.Error = strings.Join(warnings, "; ")
	}

	return status
}

// Vector Cache handlers

// saveVectorCache saves all vectors from the vector store to the cache file
func (api *API) saveVectorCache(c *gin.Context) {
	api.lock.RLock()
	vectors, passed := api.vectorStore.GetAllVectors()
	if !passed {
		api.lock.RUnlock()
		c.JSON(500, gin.H{"error": "Failed to retrieve vectors from store for caching"})
		return
	}

	err := api.vectorCache.Save(vectors)
	api.lock.RUnlock()

	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to save vector cache: " + err.Error()})
		return
	}

	c.IndentedJSON(200, gin.H{"message": "Vector cache saved successfully"})
}

// loadVectorCache loads vectors from the cache file and adds them to the vector store and updates the IVF index.
func (api *API) loadVectorCache(c *gin.Context) {
	api.lock.Lock()
	defer api.lock.Unlock()

	vectors, err := api.vectorCache.Load()
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to load vector cache: " + err.Error()})
		return
	}

	if err := api.vectorStore.AddBatch(vectors); err != nil {
		c.JSON(500, gin.H{"error": "Failed to add loaded vectors to store: " + err.Error()})
		return
	}

	if err := api.ivfIndex.UpdateVectors(); err != nil {
		c.JSON(500, gin.H{"error": "Failed to update IVF index with loaded vectors: " + err.Error()})
		return
	}

	c.IndentedJSON(200, gin.H{
		"message": "Vector cache loaded successfully",
		"count":   len(vectors),
	})
}

// getVectorCacheInfo returns the number of vectors and their dimensions in the cache file
func (api *API) getVectorCacheInfo(c *gin.Context) {
	count, dims, err := api.vectorCache.GetInfo()
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to get vector cache info: " + err.Error()})
		return
	}

	c.IndentedJSON(200, gin.H{
		"count":     count,
		"dimension": dims,
	})
}

func (api *API) configureIVF(c *gin.Context) {
	var request IVFConfigRequest
	if err := c.BindJSON(&request); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	needsRetraining := request.Nlist != api.ivfIndex.NList()

	if needsRetraining {
		newIndex := lynx.NewIVFIndex(lynx.COSINE, request.Nlist, request.Nprobe)
		newIndex.SetVectorStore(api.vectorStore)

		api.ivfIndex.Delete()
		api.ivfIndex = newIndex
	} else {
		api.ivfIndex.SetNProbe(request.Nprobe)
	}

	c.IndentedJSON(200, gin.H{"success": true, "retrained": needsRetraining})
}

func (api *API) configureIVFPQ(c *gin.Context) {
	var request IVFPQConfigRequest
	if err := c.BindJSON(&request); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	needsRetraining := request.Nlist != api.ivfPqIndex.NList() ||
		request.M != api.ivfPqIndex.M() ||
		request.CodebookSize != api.ivfPqIndex.CodebookSize()

	if needsRetraining {
		newIndex := lynx.NewIVFPQIndex(lynx.COSINE, request.Nlist, request.Nprobe, request.M, request.CodebookSize)
		newIndex.SetVectorStore(api.vectorStore)
		newIndex.SetM(request.M)
		newIndex.SetCodebookSize(request.CodebookSize)

		api.ivfPqIndex.Delete()
		api.ivfPqIndex = newIndex
	} else {
		api.ivfPqIndex.SetNProbe(request.Nprobe)
	}

	c.IndentedJSON(200, gin.H{"success": true, "retrained": needsRetraining})
}

func (api *API) configureHNSW(c *gin.Context) {
	var request HNSWConfigRequest
	if err := c.BindJSON(&request); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
	}

	needsRetraining := request.M != api.hnswIndex.M() ||
		request.EfConstruction != api.hnswIndex.EfConstruction() ||
		request.EfSearch != api.hnswIndex.EfSearch()

	if needsRetraining {
		newIndex := lynx.NewHNSWIndex(lynx.COSINE, request.M, request.EfConstruction, request.EfSearch)
		newIndex.SetVectorStore(api.vectorStore)

		api.hnswIndex.Delete()
		api.hnswIndex = newIndex
	}

	c.IndentedJSON(200, gin.H{
		"success":   true,
		"retrained": needsRetraining,
	})
}

func (api *API) getIndexStatus(c *gin.Context) {
	c.IndentedJSON(200, gin.H{
		"bf": gin.H{
			"initialized": api.bfIndex.IsInitialized(),
			"vectorCount": api.bfIndex.Size(),
		},
		"ivf": gin.H{
			"initialized": api.ivfIndex.IsInitialized(),
			"vectorCount": api.ivfIndex.Size(),
			"nlist":       api.ivfIndex.NList(),
			"nprobe":      api.ivfIndex.NProbe(),
		},
		"ivfpq": gin.H{
			"initialized":  api.ivfPqIndex.IsInitialized(),
			"vectorCount":  api.ivfPqIndex.Size(),
			"nlist":        api.ivfPqIndex.NList(),
			"nprobe":       api.ivfPqIndex.NProbe(),
			"m":            api.ivfPqIndex.M(),
			"codebookSize": api.ivfPqIndex.CodebookSize(),
		},
		"hnsw": gin.H{
			"initialized":    api.hnswIndex.IsInitialized(),
			"vectorCount":    api.hnswIndex.Size(),
			"m":              api.hnswIndex.M(),
			"efConstruction": api.hnswIndex.EfConstruction(),
			"efSearch":       api.hnswIndex.EfSearch(),
		},
	})
}

func (api *API) getDatabaseStatus(c *gin.Context) {
	var vectorDb *sql.DB
	if api != nil && api.pgStore != nil {
		vectorDb = api.pgStore.Db()
	}

	var geoDb *sql.DB
	if api != nil && api.pgGeoStore != nil {
		geoDb = api.pgGeoStore.Db()
	}

	vectorStatus := buildDatabaseStatus("Vector Store", "pgvector", vectorDb, []string{"vectors"}, false)
	geoStatus := buildDatabaseStatus("Geo Store", "postgis", geoDb, []string{"places", "indexed_areas"}, true)

	c.IndentedJSON(200, DatabaseStatusResponse{
		Databases: []DatabaseStatus{vectorStatus, geoStatus},
	})
}

func (api *API) runBenchmark(c *gin.Context) {
	var request BenchmarkRequest
	if err := c.BindJSON(&request); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	var results []metrics.BenchmarkResult

	for _, query := range request.Queries {
		embeddedQuery, err := getEmbeddings(query)
		if err != nil {
			c.JSON(500, gin.H{"error": "Failed to get embeddings for query: " + err.Error()})
			return
		}

		startIVF := time.Now()
		ivfResults, err := api.ivfIndex.Search(embeddedQuery, int64(request.TopK))
		if err != nil {
			c.JSON(500, gin.H{"error": "IVF search failed: " + err.Error()})
			return
		}
		ivfTime := time.Since(startIVF)

		startBF := time.Now()
		bfResults, err := api.bfIndex.Search(embeddedQuery, int64(request.TopK))
		if err != nil {
			c.JSON(500, gin.H{"error": "Brute-force search failed: " + err.Error()})
			return
		}
		bfTime := time.Since(startBF)

		results = append(results, metrics.BenchmarkResult{
			Query:     query,
			RecallAtK: metrics.CalculateRecall(bfResults, ivfResults, int64(request.TopK)),
			SpeedupX:  float64(bfTime) / float64(ivfTime),
			IVFTimeMs: float64(ivfTime.Microseconds() / 1000),
			BFTimeMs:  float64(bfTime.Microseconds() / 1000),
		})
	}

	c.IndentedJSON(200, gin.H{"summary": metrics.CalculateSummary(results)})
}

func (api *API) runComprehensiveBenchmark(c *gin.Context) {
	var request BenchmarkRequest
	if err := c.BindJSON(&request); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	if len(request.Queries) == 0 {
		c.JSON(400, gin.H{"error": "queries cannot be empty"})
		return
	}

	api.lock.RLock()
	defer api.lock.RUnlock()

	var results []metrics.MultiIndexBenchmarkResult

	for _, query := range request.Queries {
		embeddedQuery, err := getEmbeddings(query)
		if err != nil {
			c.JSON(500, gin.H{"error": "Failed to get embeddings for query: " + err.Error()})
			return
		}

		// Run BruteForce search (ground truth)
		startBF := time.Now()
		bfResults, err := api.bfIndex.Search(embeddedQuery, int64(request.TopK))
		if err != nil {
			c.JSON(500, gin.H{"error": "Brute-force search failed: " + err.Error()})
			return
		}
		bfTime := time.Since(startBF)

		// Run IVF search
		startIVF := time.Now()
		ivfResults, err := api.ivfIndex.Search(embeddedQuery, int64(request.TopK))
		if err != nil {
			c.JSON(500, gin.H{"error": "IVF search failed: " + err.Error()})
			return
		}
		ivfTime := time.Since(startIVF)
		ivfRecall := metrics.CalculateRecall(bfResults, ivfResults, int64(request.TopK))
		ivfSpeedup := float64(bfTime.Nanoseconds()) / float64(ivfTime.Nanoseconds())

		// Run IVF-PQ search
		startIVFPQ := time.Now()
		ivfpqResults, err := api.ivfPqIndex.Search(embeddedQuery, int64(request.TopK))
		if err != nil {
			c.JSON(500, gin.H{"error": "IVF-PQ search failed: " + err.Error()})
			return
		}
		ivfpqTime := time.Since(startIVFPQ)
		ivfpqRecall := metrics.CalculateRecall(bfResults, ivfpqResults, int64(request.TopK))
		ivfpqSpeedup := float64(bfTime.Nanoseconds()) / float64(ivfpqTime.Nanoseconds())

		// Run HNSW search
		startHNSW := time.Now()
		hnswResults, err := api.hnswIndex.Search(embeddedQuery, int64(request.TopK))
		if err != nil {
			c.JSON(500, gin.H{"error": "HNSW search failed: " + err.Error()})
			return
		}
		hnswTime := time.Since(startHNSW)
		hnswRecall := metrics.CalculateRecall(bfResults, hnswResults, int64(request.TopK))
		hnswSpeedup := float64(bfTime.Nanoseconds()) / float64(hnswTime.Nanoseconds())

		results = append(results, metrics.MultiIndexBenchmarkResult{
			Query:        query,
			BFTimeNs:     bfTime.Nanoseconds(),
			IVFTimeNs:    ivfTime.Nanoseconds(),
			IVFPQTimeNs:  ivfpqTime.Nanoseconds(),
			HNSWTimeNs:   hnswTime.Nanoseconds(),
			IVFRecall:    ivfRecall,
			IVFPQRecall:  ivfpqRecall,
			HNSWRecall:   hnswRecall,
			IVFSpeedup:   ivfSpeedup,
			IVFPQSpeedup: ivfpqSpeedup,
			HNSWSpeedup:  hnswSpeedup,
		})
	}

	summary := metrics.CalculateMultiIndexSummary(results)
	c.IndentedJSON(200, summary)
}

//func (api *API) estimateIVFParamSweepTimeHandler(c *gin.Context) {
//	var request IVFParamSweepRequest
//	if err := c.BindJSON(&request); err != nil {
//		c.JSON(400, gin.H{"error": err.Error()})
//		return
//	}
//
//	api.lock.RLock()
//	vectorCount := api.vectorStore.Size()
//	api.lock.RUnlock()
//
//	estimate := estimateIVFParamSweepTime(
//		int64(len(request.Queries)),
//		int64(len(request.NlistValues)),
//		int64(len(request.NprobeValues)),
//		vectorCount,
//	)
//
//	c.IndentedJSON(200, estimate)
//}

func (api *API) runIVFParamSweep(c *gin.Context) {
	var request IVFParamSweepRequest
	if err := c.BindJSON(&request); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	if len(request.Queries) == 0 {
		c.JSON(400, gin.H{"error": "queries cannot be empty"})
		return
	}

	if len(request.NlistValues) == 0 || len(request.NprobeValues) == 0 {
		c.JSON(400, gin.H{"error": "nlist_values and nprobe_values cannot be empty"})
		return
	}

	embeddedQueries := make([][]float32, len(request.Queries))
	for i, query := range request.Queries {
		emb, err := getEmbeddings(query)
		if err != nil {
			c.JSON(500, gin.H{"error": "Failed to get embeddings for query: " + err.Error()})
			return
		}
		embeddedQueries[i] = emb
	}

	api.lock.RLock()
	defer api.lock.RUnlock()

	bfResults := make([][]lynx.SearchResult, len(embeddedQueries))
	var totalBfTime time.Duration
	for i, emb := range embeddedQueries {
		startBF := time.Now()
		results, err := api.bfIndex.Search(emb, int64(request.TopK))
		if err != nil {
			c.JSON(500, gin.H{"error": "Brute-force search failed: " + err.Error()})
			return
		}
		totalBfTime += time.Since(startBF)
		bfResults[i] = results
	}
	meanBfLatency := float64(totalBfTime.Microseconds()) / float64(len(embeddedQueries)) / 1000.0

	var results []IVFParamResult

	for _, nlist := range request.NlistValues {
		tempIVF := lynx.NewIVFIndex(api.ivfIndex.Metric(), nlist, 1)
		tempIVF.SetVectorStore(api.vectorStore)
		if err := tempIVF.UpdateVectors(); err != nil {
			c.JSON(500, gin.H{"error": "Failed to update vectors for temp IVF index: " + err.Error()})
			tempIVF.Delete()
			return
		}

		for _, nprobe := range request.NprobeValues {
			if nprobe > nlist {
				continue
			}

			tempIVF.SetNProbe(nprobe)

			var totalLatency time.Duration
			var totalRecall float64

			for i, emb := range embeddedQueries {
				startIVF := time.Now()
				ivfRes, err := tempIVF.Search(emb, int64(request.TopK))
				if err != nil {
					c.JSON(500, gin.H{"error": "IVF search failed: " + err.Error()})
					tempIVF.Delete()
					return
				}
				totalLatency += time.Since(startIVF)
				totalRecall += metrics.CalculateRecall(bfResults[i], ivfRes, int64(request.TopK))
			}

			meanLatencyMs := float64(totalLatency.Microseconds()) / float64(len(embeddedQueries)) / 1000.0
			meanRecall := totalRecall / float64(len(embeddedQueries))
			speedup := meanBfLatency / meanLatencyMs

			results = append(results, IVFParamResult{
				Nlist:         nlist,
				Nprobe:        nprobe,
				MeanRecall:    meanRecall,
				MeanLatencyMs: meanLatencyMs,
				Speedup:       speedup,
			})
		}

		tempIVF.Delete()
	}

	bestSpeedup := results[0]
	bestScore := 0.0
	for _, r := range results {
		score := r.MeanRecall * r.Speedup
		if score > bestScore {
			bestScore = score
			bestSpeedup = r
		}
	}

	bestRecall := results[0]
	for _, r := range results {
		if r.MeanRecall > bestRecall.MeanRecall {
			bestRecall = r
		}
	}

	bestLatency := results[0]
	for _, r := range results {
		if r.MeanLatencyMs < bestLatency.MeanLatencyMs {
			bestLatency = r
		}
	}

	// For balanced: finding the "elbow" of the recall vs latency curve
	// This is the point where recall stops improving rapidly relative to latency cost

	minLatency := results[0].MeanLatencyMs
	maxLatency := results[0].MeanLatencyMs
	minRecall := results[0].MeanRecall
	maxRecall := results[0].MeanRecall

	for _, r := range results {
		if r.MeanLatencyMs < minLatency {
			minLatency = r.MeanLatencyMs
		}
		if r.MeanLatencyMs > maxLatency {
			maxLatency = r.MeanLatencyMs
		}
		if r.MeanRecall < minRecall {
			minRecall = r.MeanRecall
		}
		if r.MeanRecall > maxRecall {
			maxRecall = r.MeanRecall
		}
	}

	latencyRange := maxLatency - minLatency
	recallRange := maxRecall - minRecall

	if latencyRange == 0 {
		latencyRange = 1
	}
	if recallRange == 0 {
		recallRange = 1
	}

	bestBalanced := results[0]
	bestKneeScore := -1000.0

	for _, r := range results {
		normLatency := (r.MeanLatencyMs - minLatency) / latencyRange
		normRecall := (r.MeanRecall - minRecall) / recallRange

		// Knee score: how far above the diagonal line
		kneeScore := normRecall - normLatency

		if kneeScore > bestKneeScore {
			bestKneeScore = kneeScore
			bestBalanced = r
		}
	}

	c.IndentedJSON(200, IVFParamSweepResponse{
		Results:      results,
		BestSpeedup:  bestSpeedup,
		BestRecall:   bestRecall,
		BestLatency:  bestLatency,
		BestBalanced: bestBalanced,
	})
}

//func (api *API) estimateIVFPQParamSweepTimeHandler(c *gin.Context) {
//	var request IVFPQParamSweepRequest
//	if err := c.BindJSON(&request); err != nil {
//		c.JSON(400, gin.H{"error": err.Error()})
//		return
//	}
//
//	api.lock.RLock()
//	vectorCount := api.vectorStore.Size()
//	api.lock.RUnlock()
//
//	estimate := estimateIVFPQParamSweepTime(
//		int64(len(request.Queries)),
//		int64(len(request.NlistValues)),
//		int64(len(request.NprobeValues)),
//		int64(len(request.MValues)),
//		int64(len(request.CodebookSizeValues)),
//		vectorCount,
//	)
//
//	c.IndentedJSON(200, estimate)
//}

func (api *API) runIVFPQParamSweep(c *gin.Context) {
	var request IVFPQParamSweepRequest
	if err := c.BindJSON(&request); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	if len(request.Queries) == 0 {
		c.JSON(400, gin.H{"error": "queries cannot be empty"})
		return
	}

	if len(request.NlistValues) == 0 || len(request.NprobeValues) == 0 {
		c.JSON(400, gin.H{"error": "nlist_values and nprobe_values cannot be empty"})
		return
	}

	if len(request.MValues) == 0 || len(request.CodebookSizeValues) == 0 {
		c.JSON(400, gin.H{"error": "mvalues and codebook_size_values cannot be empty"})
		return
	}

	embeddedQueries := make([][]float32, len(request.Queries))
	for i, query := range request.Queries {
		emb, err := getEmbeddings(query)
		if err != nil {
			c.JSON(500, gin.H{"error": "Failed to get embeddings for query: " + err.Error()})
			return
		}
		embeddedQueries[i] = emb
	}

	api.lock.RLock()
	defer api.lock.RUnlock()

	bfResults := make([][]lynx.SearchResult, len(embeddedQueries))
	var totalBfTime time.Duration
	for i, emb := range embeddedQueries {
		startBF := time.Now()
		results, err := api.bfIndex.Search(emb, int64(request.TopK))
		if err != nil {
			c.JSON(500, gin.H{"error": "Brute-force search failed: " + err.Error()})
			return
		}
		totalBfTime += time.Since(startBF)
		bfResults[i] = results
	}
	meanBfLatency := float64(totalBfTime.Microseconds()) / float64(len(embeddedQueries)) / 1000.0

	var results []IVFPQParamResult

	for _, nlist := range request.NlistValues {
		for _, m := range request.MValues {
			for _, codebookSize := range request.CodebookSizeValues {
				tempIVFPQ := lynx.NewIVFPQIndex(api.ivfPqIndex.Metric(), nlist, 1, m, codebookSize)
				tempIVFPQ.SetVectorStore(api.vectorStore)
				if err := tempIVFPQ.UpdateVectors(); err != nil {
					c.JSON(500, gin.H{"error": "Failed to update vectors for temp IVFPQ index: " + err.Error()})
					tempIVFPQ.Delete()
					return
				}

				for _, nprobe := range request.NprobeValues {
					if nprobe > nlist {
						continue
					}

					tempIVFPQ.SetNProbe(nprobe)

					var totalLatency time.Duration
					var totalRecall float64

					for i, emb := range embeddedQueries {
						startIVFPQ := time.Now()
						ivfpqRes, err := tempIVFPQ.Search(emb, int64(request.TopK))
						if err != nil {
							c.JSON(500, gin.H{"error": "IVFPQ search failed: " + err.Error()})
							tempIVFPQ.Delete()
							return
						}
						totalLatency += time.Since(startIVFPQ)
						totalRecall += metrics.CalculateRecall(bfResults[i], ivfpqRes, int64(request.TopK))
					}

					meanLatencyMs := float64(totalLatency.Microseconds()) / float64(len(embeddedQueries)) / 1000.0
					meanRecall := totalRecall / float64(len(embeddedQueries))
					speedup := meanBfLatency / meanLatencyMs

					results = append(results, IVFPQParamResult{
						Nlist:         nlist,
						Nprobe:        nprobe,
						M:             m,
						CodebookSize:  codebookSize,
						MeanRecall:    meanRecall,
						MeanLatencyMs: meanLatencyMs,
						Speedup:       speedup,
					})
				}

				tempIVFPQ.Delete()
			}
		}
	}

	bestSpeedup := results[0]
	bestScore := 0.0
	for _, r := range results {
		score := r.MeanRecall * r.Speedup
		if score > bestScore {
			bestScore = score
			bestSpeedup = r
		}
	}

	bestRecall := results[0]
	for _, r := range results {
		if r.MeanRecall > bestRecall.MeanRecall {
			bestRecall = r
		}
	}

	bestLatency := results[0]
	for _, r := range results {
		if r.MeanLatencyMs < bestLatency.MeanLatencyMs {
			bestLatency = r
		}
	}

	// For balanced: finding the "elbow" of the recall vs latency curve
	// This is the point where recall stops improving rapidly relative to latency cost

	minLatency := results[0].MeanLatencyMs
	maxLatency := results[0].MeanLatencyMs
	minRecall := results[0].MeanRecall
	maxRecall := results[0].MeanRecall

	for _, r := range results {
		if r.MeanLatencyMs < minLatency {
			minLatency = r.MeanLatencyMs
		}
		if r.MeanLatencyMs > maxLatency {
			maxLatency = r.MeanLatencyMs
		}
		if r.MeanRecall < minRecall {
			minRecall = r.MeanRecall
		}
		if r.MeanRecall > maxRecall {
			maxRecall = r.MeanRecall
		}
	}

	latencyRange := maxLatency - minLatency
	recallRange := maxRecall - minRecall

	if latencyRange == 0 {
		latencyRange = 1
	}
	if recallRange == 0 {
		recallRange = 1
	}

	bestBalanced := results[0]
	bestKneeScore := -1000.0

	for _, r := range results {
		normLatency := (r.MeanLatencyMs - minLatency) / latencyRange
		normRecall := (r.MeanRecall - minRecall) / recallRange

		// Knee score: how far above the diagonal line
		kneeScore := normRecall - normLatency

		if kneeScore > bestKneeScore {
			bestKneeScore = kneeScore
			bestBalanced = r
		}
	}

	c.IndentedJSON(200, IVFPQParamSweepResponse{
		Results:      results,
		BestSpeedup:  bestSpeedup,
		BestRecall:   bestRecall,
		BestLatency:  bestLatency,
		BestBalanced: bestBalanced,
	})
}
