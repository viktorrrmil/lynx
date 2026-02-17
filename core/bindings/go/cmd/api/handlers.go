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

/**

interface IndexStatus {
    bf: {
        initialized: boolean;
        vectorCount: number;
    };
    ivf: {
        initialized: boolean;
        vectorCount: number;
        nlist: number;
        nprobe: number;
    };
}

*/

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
