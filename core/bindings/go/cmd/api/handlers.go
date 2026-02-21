package main

import (
	"lynx/lynx"
	"lynx/metrics"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

func (api *API) bfSearch(c *gin.Context) {
	var request SearchRequest
	if err := c.BindJSON(&request); err != nil {
		c.JSON(400, gin.H{
			"message": err.Error(),
		})
		return
	}

	api.lock.RLock()
	defer api.lock.RUnlock()

	embeddedQuery, err := getEmbeddings(request.Query)

	if err != nil {
		c.JSON(500, gin.H{
			"error": err.Error(),
		})
		return
	}

	start := time.Now()

	results, err := api.bfIndex.Search(embeddedQuery, request.TopK)

	searchTime := time.Since(start)

	if results == nil {
		c.JSON(500, gin.H{
			"error": "Search returned no results",
		})
		return
	}

	print("Number of results: " + strconv.Itoa(len(results)) + "\n")

	if err != nil {
		c.JSON(500, gin.H{
			"error": err.Error(),
		})
		return
	}

	enrichedResults := make([]map[string]interface{}, len(results))
	for i, result := range results {
		var text string
		api.pgStore.Db().QueryRow(
			"SELECT text FROM vectors WHERE id = $1",
			result.ID,
		).Scan(&text)

		enrichedResults[i] = map[string]interface{}{
			"id":       result.ID,
			"distance": result.Distance,
			"text":     text,
		}
	}

	c.IndentedJSON(200, gin.H{
		"results":        enrichedResults,
		"search_time_ms": searchTime.Milliseconds(),
		"index_type":     "bruteforce",
		"index_size":     api.vectorStore.Size(),
	})
}

func (api *API) ivfSearch(c *gin.Context) {
	var request SearchRequest
	if err := c.BindJSON(&request); err != nil {
		c.JSON(400, gin.H{
			"message": err.Error(),
		})
	}

	api.lock.RLock()
	defer api.lock.RUnlock()

	embeddedQuery, err := getEmbeddings(request.Query)
	if err != nil {
		c.JSON(500, gin.H{
			"error": err.Error(),
		})
		return
	}

	var start = time.Now()

	results, err := api.ivfIndex.Search(embeddedQuery, request.TopK)
	if err != nil {
		c.JSON(500, gin.H{
			"error": err.Error(),
		})
	}

	var searchTime = time.Since(start)

	shouldTrackRecall := request.TrackRecall
	var recall float64

	if shouldTrackRecall {
		bfResults, err := api.bfIndex.Search(embeddedQuery, request.TopK)
		if err != nil {
			c.JSON(500, gin.H{
				"error": err.Error(),
			})
			return
		}

		recall = metrics.CalculateRecall(bfResults, results, request.TopK)
	} else {
		recall = -1
	}

	enrichedResults := make([]map[string]interface{}, len(results))
	for i, result := range results {
		var text string
		api.pgStore.Db().QueryRow(
			"SELECT text FROM vectors WHERE id = $1",
			result.ID,
		).Scan(&text)

		enrichedResults[i] = map[string]interface{}{
			"id":       result.ID,
			"distance": result.Distance,
			"text":     text,
		}
	}

	c.IndentedJSON(200, gin.H{
		"results":        enrichedResults,
		"search_time_ms": searchTime.Milliseconds(),
		"index_type":     "ivf",
		"index_size":     api.ivfIndex.Size(),
		"recall":         recall,
	})
}

func (api *API) addToVectorStore(c *gin.Context) {
	var request AddTextRequest
	if err := c.BindJSON(&request); err != nil {
		c.JSON(400, gin.H{
			"error": err.Error(),
		})
		return
	}

	embeddedVector, err := getEmbeddings(request.Text)
	if err != nil {
		c.JSON(500, gin.H{
			"error": err.Error(),
		})
		return
	}

	api.lock.Lock()
	defer api.lock.Unlock()

	id, err := api.pgStore.AddVector(request.Text, embeddedVector)
	if err != nil {
		c.JSON(500, gin.H{
			"error": "Failed to add vector to Postgres store: " + err.Error(),
		})
		return
	}

	err = api.vectorStore.AddVector(embeddedVector)
	if err != nil {
		c.JSON(500, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.IndentedJSON(200, gin.H{
		"message": "Vector added successfully",
		"count":   1,
		"id":      id,
	})
}

func (api *API) addBatchToVectorStore(c *gin.Context) {
	var request EmbeddingBatchRequest
	if err := c.BindJSON(&request); err != nil {
		c.JSON(400, gin.H{
			"error": err.Error(),
		})
		return
	}

	embeddedTextBatch, err := getBatchEmbeddings(request.Batch)
	if err != nil {
		c.JSON(500, gin.H{
			"error": err.Error(),
		})
		return
	}

	api.lock.Lock()
	defer api.lock.Unlock()

	ids, err := api.pgStore.AddBatch(request.Batch, embeddedTextBatch)
	if err != nil {
		c.JSON(500, gin.H{
			"error": "Failed to add batch to Postgres store: " + err.Error(),
		})
		return
	}

	for _, emb := range embeddedTextBatch {
		err := api.vectorStore.AddVector(emb)
		if err != nil {
			c.JSON(500, gin.H{
				"error": "Could not add vector to store: " + err.Error(),
			})
			return
		}
	}

	err = api.ivfIndex.UpdateVectors()

	if err != nil {
		c.JSON(500, gin.H{
			"error": "Could not update IVF index vectors: " + err.Error(),
		})

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

// Vector Cache handlers

// saveVectorCache saves all vectors from the vector store to the cache file
func (api *API) saveVectorCache(c *gin.Context) {
	api.lock.RLock()

	vectors, passed := api.vectorStore.GetAllVectors()
	if !passed {
		c.JSON(500, gin.H{
			"error": "Failed to retrieve vectors from store for caching",
		})
		api.lock.RUnlock()
		return
	}

	err := api.vectorCache.Save(vectors)
	api.lock.RUnlock()

	if err != nil {
		c.JSON(500, gin.H{
			"error": "Failed to save vector cache: " + err.Error(),
		})
		return
	}

	c.IndentedJSON(200, gin.H{
		"message": "Vector cache saved successfully",
	})
}

// loadVectorCache loads vectors from the cache file and adds them to the vector store and updates the IVF index.
func (api *API) loadVectorCache(c *gin.Context) {
	api.lock.Lock()
	defer api.lock.Unlock()

	vectors, err := api.vectorCache.Load()
	if err != nil {
		c.JSON(500, gin.H{
			"error": "Failed to load vector cache: " + err.Error(),
		})
		return
	}

	err = api.vectorStore.AddBatch(vectors)
	if err != nil {
		c.JSON(500, gin.H{
			"error": "Failed to add loaded vectors to store: " + err.Error(),
		})
		return
	}

	err = api.ivfIndex.UpdateVectors()
	if err != nil {
		c.JSON(500, gin.H{
			"error": "Failed to update IVF index with loaded vectors: " + err.Error(),
		})
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
		c.JSON(500, gin.H{
			"error": "Failed to get vector cache info: " + err.Error(),
		})
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
		c.JSON(400, gin.H{
			"error": err.Error(),
		})
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

	c.IndentedJSON(200, gin.H{
		"success":   true,
		"retrained": needsRetraining,
	})
}

func (api *API) getIndexStatus(c *gin.Context) {
	bfInitialized := api.bfIndex.IsInitialized()
	bfVectorCount := api.bfIndex.Size()

	ivfInitialized := api.ivfIndex.IsInitialized()
	ivfVectorCount := api.ivfIndex.Size()
	ivfNList := api.ivfIndex.NList()
	ivfNProbe := api.ivfIndex.NProbe()

	c.IndentedJSON(200, gin.H{
		"bf": gin.H{
			"initialized": bfInitialized,
			"vectorCount": bfVectorCount,
		},
		"ivf": gin.H{
			"initialized": ivfInitialized,
			"vectorCount": ivfVectorCount,
			"nlist":       ivfNList,
			"nprobe":      ivfNProbe,
		},
	})
}

func (api *API) runBenchmark(c *gin.Context) {
	var request BenchmarkRequest
	if err := c.BindJSON(&request); err != nil {
		c.JSON(400, gin.H{
			"error": err.Error(),
		})
		return
	}

	var results []metrics.BenchmarkResult

	for _, query := range request.Queries {
		embeddedQuery, err := getEmbeddings(query)
		if err != nil {
			c.JSON(500, gin.H{
				"error": "Failed to get embeddings for query: " + err.Error(),
			})
			return
		}

		startIVF := time.Now()
		ivfResults, err := api.ivfIndex.Search(embeddedQuery, int64(request.TopK))
		if err != nil {
			c.JSON(500, gin.H{
				"error": "IVF search failed: " + err.Error(),
			})
			return
		}
		ivfTime := time.Since(startIVF)

		startBF := time.Now()
		bfResults, err := api.bfIndex.Search(embeddedQuery, int64(request.TopK))
		if err != nil {
			c.JSON(500, gin.H{
				"error": "Brute-force search failed: " + err.Error(),
			})
			return
		}
		bfTime := time.Since(startBF)

		recall := metrics.CalculateRecall(bfResults, ivfResults, int64(request.TopK))

		results = append(results, metrics.BenchmarkResult{
			Query:     query,
			RecallAtK: recall,
			SpeedupX:  float64(bfTime) / float64(ivfTime),
			IVFTimeMs: float64(ivfTime.Microseconds() / 1000),
			BFTimeMs:  float64(bfTime.Microseconds() / 1000),
		})
	}

	summary := metrics.CalculateSummary(results)

	c.IndentedJSON(200, gin.H{
		"summary": summary,
	})
}

func (api *API) runIVFParamSweep(c *gin.Context) {
	var request IVFParamSweepRequest
	if err := c.BindJSON(&request); err != nil {
		c.JSON(400, gin.H{
			"error": err.Error(),
		})
		return
	}

	if len(request.Queries) == 0 {
		c.JSON(400, gin.H{
			"error": "queries cannot be empty",
		})
		return
	}

	if len(request.NlistValues) == 0 || len(request.NprobeValues) == 0 {
		c.JSON(400, gin.H{
			"error": "nlist_values and nprobe_values cannot be empty",
		})
		return
	}

	embeddedQueries := make([][]float32, len(request.Queries))
	for i, query := range request.Queries {
		emb, err := getEmbeddings(query)
		if err != nil {
			c.JSON(500, gin.H{
				"error": "Failed to get embeddings for query: " + err.Error(),
			})
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
			c.JSON(500, gin.H{
				"error": "Brute-force search failed: " + err.Error(),
			})
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
		err := tempIVF.UpdateVectors()
		if err != nil {
			c.JSON(500, gin.H{
				"error": "Failed to update vectors for temp IVF index: " + err.Error(),
			})
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
					c.JSON(500, gin.H{
						"error": "IVF search failed: " + err.Error(),
					})
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
