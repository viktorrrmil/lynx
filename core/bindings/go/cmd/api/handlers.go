package main

import (
	"fmt"
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
		enrichedResults[i] = map[string]interface{}{
			"id":       result.ID,
			"distance": result.Distance,
			"text":     api.bfMetadata[result.ID],
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

	fmt.Println("=== QUERY EMBEDDING DEBUG ===")
	fmt.Printf("Query text: %s\n", request.Query)
	fmt.Printf("Embedding length: %d\n", len(embeddedQuery))
	fmt.Printf("First 5 values: %v\n", embeddedQuery[:5])

	sum := float32(0)
	for _, v := range embeddedQuery {
		sum += v * v
	}
	fmt.Printf("L2 norm squared: %f\n", sum)
	fmt.Println("============================")

	var start = time.Now()

	results, err := api.ivfIndex.Search(embeddedQuery, request.TopK)
	if err != nil {
		c.JSON(500, gin.H{
			"error": err.Error(),
		})
	}

	for i, result := range results {
		fmt.Printf("Result %d: ID=%d, Distance=%f\n", i, result.ID, result.Distance)
	}

	var searchTime = time.Since(start)

	enrichedResults := make([]map[string]interface{}, len(results))
	for i, result := range results {
		enrichedResults[i] = map[string]interface{}{
			"id":       result.ID,
			"distance": result.Distance,
			"text":     api.ivfMetadata[result.ID],
		}
	}

	c.IndentedJSON(200, gin.H{
		"results":        enrichedResults,
		"search_time_ms": searchTime.Milliseconds(),
		"index_type":     "ivf",
		"index_size":     api.ivfIndex.Size(),
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

	api.lock.Lock() // Need write lock!
	defer api.lock.Unlock()

	err = api.vectorStore.AddVector(embeddedVector)
	if err != nil {
		c.JSON(500, gin.H{
			"error": err.Error(),
		})
		return
	}

	currentID := api.vectorStore.Size() - 1
	api.bfMetadata[currentID] = request.Text

	println("Vector store size after add:", api.vectorStore.Size())

	c.IndentedJSON(200, gin.H{
		"message": "Vector added successfully",
		"id":      currentID,
		"added":   embeddedVector,
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

	api.lock.Lock() // Need write lock!
	defer api.lock.Unlock()

	startID := api.vectorStore.Size()

	err = api.vectorStore.AddBatch(embeddedTextBatch)
	if err != nil {
		c.JSON(500, gin.H{
			"error": err.Error(),
		})
		return
	}

	err = api.ivfIndex.UpdateVectors()

	if err != nil {
		c.JSON(500, gin.H{
			"error": "Could not update IVF index vectors: " + err.Error(),
		})

		return
	}

	for i, text := range request.Batch {
		api.bfMetadata[startID+int64(i)] = text
		api.ivfMetadata[startID+int64(i)] = text
	}

	println("Vector store size after add:", api.vectorStore.Size())

	c.IndentedJSON(200, gin.H{
		"message":  "Batch vectors added successfully",
		"count":    len(embeddedTextBatch),
		"start_id": startID,
		"added":    embeddedTextBatch,
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
