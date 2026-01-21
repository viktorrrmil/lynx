package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"os"
	"sync"
	"time"

	"lynx/lynx"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

var embeddingServiceURL = os.Getenv("EMBEDDING_SERVICE_URL")

type API struct {
	bfIndex  *lynx.BruteForceIndex
	ivfIndex *lynx.IVFIndex

	bfMetadata  map[int64]string // id -> original text
	ivfMetadata map[int64]string // id -> original text

	bfNextID  int64
	ivfNextID int64

	lock sync.RWMutex
}

type EmbeddingRequest struct {
	Text string `json:"text"`
}

type EmbeddingBatchRequest struct {
	Batch []string `json:"batch"`
}

type EmbeddingResponse struct {
	Embeddings []float32 `json:"embedding"`
	Dimension  int64     `json:"dimension"`
}

type EmbeddingBatchResponse struct {
	BatchEmbeddings [][]float32 `json:"batch_embedding"`
	Dimension       int64       `json:"dimension"`
}

type BatchResult struct {
	ID   int64  `json:"id"`
	Text string `json:"text"`
}

type AddTextRequest struct {
	Text string `json:"text"`
}

type SearchRequest struct {
	Query string `json:"query"`
	TopK  int64  `json:"top_k"`
}

func NewAPI(dimension int64, metric lynx.DistanceMetric) *API {
	return &API{
		bfIndex:     lynx.NewBruteforceIndex(dimension, metric),
		ivfIndex:    nil, // nil since it's not trained yet
		bfMetadata:  make(map[int64]string),
		ivfMetadata: nil,
		bfNextID:    1,
		ivfNextID:   1,
	}
}

func (api *API) getTest(c *gin.Context) {
	c.IndentedJSON(200, "Works ok")
}

func (api *API) getInfo(c *gin.Context) {
	api.lock.RLock()
	info := map[string]interface{}{
		"size":      api.bfIndex.Size(),
		"dimension": api.bfIndex.Dimension(),
		"metric":    api.bfIndex.Metric(),
	}
	api.lock.RUnlock()
	c.IndentedJSON(200, info)
}

func getEmbeddings(text string) ([]float32, error) {
	request := EmbeddingRequest{Text: text}
	jsonData, _ := json.Marshal(request)

	resp, err := http.Post(
		embeddingServiceURL+"/embed_text",
		"application/json",
		bytes.NewBuffer(jsonData))

	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result EmbeddingResponse
	json.NewDecoder(resp.Body).Decode(&result)

	return result.Embeddings, nil
}

func getBatchEmbeddings(textBatch []string) ([][]float32, error) {
	request := EmbeddingBatchRequest{
		Batch: textBatch,
	}

	jsonData, _ := json.Marshal(request)

	resp, err := http.Post(
		embeddingServiceURL+"/embed_text_batch",
		"application/json",
		bytes.NewBuffer(jsonData))

	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result EmbeddingBatchResponse
	json.NewDecoder(resp.Body).Decode(&result)

	return result.BatchEmbeddings, nil
}

func (api *API) bfAddText(c *gin.Context) {
	var request AddTextRequest
	if err := c.BindJSON(&request); err != nil {
		c.JSON(400, gin.H{
			"message": err.Error(),
		})
		return
	}

	api.lock.Lock()
	defer api.lock.Unlock()

	embeddedText, err := getEmbeddings(request.Text)

	if err != nil {
		c.JSON(500, gin.H{
			"error": err.Error(),
		})
		return
	}

	if err := api.bfIndex.Add(api.bfIndex.Size()+1, embeddedText); err != nil {
		c.IndentedJSON(500, gin.H{"error": err.Error()})
		return
	}

	api.bfMetadata[api.bfIndex.Size()] = request.Text

	c.IndentedJSON(200, gin.H{
		"embeddings": embeddedText,
		"dimension":  api.bfIndex.Dimension(),
		"size":       api.bfIndex.Size(),
	})
}

func (api *API) bfAddBatch(c *gin.Context) {
	var request EmbeddingBatchRequest
	if err := c.BindJSON(&request); err != nil {
		c.JSON(400, gin.H{
			"message": err.Error(),
		})
		return
	}

	texts := make([]string, len(request.Batch))
	for i, text := range request.Batch {
		texts[i] = text
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

	results := make([]BatchResult, len(embeddedTextBatch))

	for i, embedding := range embeddedTextBatch {
		id := api.bfNextID
		api.bfNextID++

		if err := api.bfIndex.Add(id, embedding); err != nil {
			c.JSON(500, gin.H{"error": err.Error()})
			return
		}

		api.bfMetadata[id] = texts[i]

		results[i] = BatchResult{
			ID:   id,
			Text: texts[i],
		}
	}

	c.IndentedJSON(200, gin.H{
		"added":     results,
		"dimension": api.bfIndex.Dimension(),
		"size":      api.bfIndex.Size(),
	})
}

func (api *API) bfSearch(c *gin.Context) {
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

	start := time.Now()

	results, err := api.bfIndex.Search(embeddedQuery, request.TopK)

	searchTime := time.Since(start)

	if err != nil {
		c.JSON(500, gin.H{
			"error": err.Error(),
		})
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
		"index_size":     api.bfIndex.Size(),
	})
}

func (api *API) ivfTrain(c *gin.Context) {
	var request struct {
		NumClusters int64 `json:"num_clusters"`
		NumProbes   int64 `json:"num_probes"`
	}

	if err := c.BindJSON(&request); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	api.lock.Lock()
	defer api.lock.Unlock()

	numVectors := api.bfIndex.Size()
	if numVectors == 0 {
		c.JSON(400, gin.H{"error": "No vectors to train on"})
		return
	}

	trainingData := make([][]float32, numVectors)
	vectorIDs := make([]int64, numVectors)

	for i := int64(0); i < numVectors; i++ {
		id := i + 1
		vector, err := api.bfIndex.GetVector(id)
		if err != nil {
			c.JSON(500, gin.H{"error": "Failed to get vector: " + err.Error()})
			return
		}
		trainingData[i] = vector
		vectorIDs[i] = id
	}

	vectorSize := int64(len(trainingData[0]))

	// Flatten for k-means
	flatData := make([]float32, numVectors*vectorSize)
	for i, vec := range trainingData {
		copy(flatData[i*int(vectorSize):(i+1)*int(vectorSize)], vec)
	}

	api.ivfIndex = lynx.NewIVFIndex(384, lynx.COSINE, request.NumClusters, request.NumProbes)

	err := api.ivfIndex.Train(flatData, numVectors, vectorSize, 100, 1e-4)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	api.ivfMetadata = make(map[int64]string)
	for i, id := range vectorIDs {
		if err := api.ivfIndex.Add(id, trainingData[i]); err != nil {
			c.JSON(500, gin.H{"error": "Failed to add vector to IVF: " + err.Error()})
			return
		}

		api.ivfMetadata[id] = api.bfMetadata[id]
	}

	c.JSON(200, gin.H{
		"message":       "IVF index trained successfully",
		"vectors_added": numVectors,
	})
}

func (api *API) ivfAddText(c *gin.Context) {
	var request AddTextRequest
	if err := c.BindJSON(&request); err != nil {
		c.JSON(400, gin.H{
			"message": err.Error(),
		})
		return
	}

	api.lock.Lock()
	defer api.lock.Unlock()

	embeddedText, err := getEmbeddings(request.Text)

	if err != nil {
		c.JSON(500, gin.H{
			"error": err.Error(),
		})
		return
	}

	if err := api.ivfIndex.Add(api.ivfIndex.Size()+1, embeddedText); err != nil {
		c.IndentedJSON(500, gin.H{"error": err.Error()})
		return
	}

	api.ivfMetadata[api.ivfIndex.Size()] = request.Text

	c.IndentedJSON(200, gin.H{
		"embeddings": embeddedText,
		"dimension":  api.ivfIndex.Dimension(),
		"size":       api.ivfIndex.Size(),
	})
}

func (api *API) ivfAddBatch(c *gin.Context) {
	var request EmbeddingBatchRequest
	if err := c.BindJSON(&request); err != nil {
		c.JSON(400, gin.H{
			"message": err.Error(),
		})
		return
	}

	if api.ivfIndex == nil {
		c.JSON(400, gin.H{"error": "IVF index not trained. Call /ivf_train first"})
		return
	}

	texts := make([]string, len(request.Batch))
	for i, text := range request.Batch {
		texts[i] = text
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

	results := make([]BatchResult, len(embeddedTextBatch))

	for i, embedding := range embeddedTextBatch {
		id := api.ivfNextID
		api.ivfNextID++

		if err := api.ivfIndex.Add(id, embedding); err != nil {
			c.JSON(500, gin.H{"error": err.Error()})
			return
		}

		api.ivfMetadata[id] = texts[i]

		results[i] = BatchResult{
			ID:   id,
			Text: texts[i],
		}
	}

	c.IndentedJSON(200, gin.H{
		"added":     results,
		"dimension": api.ivfIndex.Dimension(),
		"size":      api.ivfIndex.Size(),
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

	var searchTime = time.Since(start)

	if err != nil {
		c.JSON(500, gin.H{
			"error": err.Error(),
		})
	}

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

func main() {
	api := NewAPI(384, lynx.COSINE)
	defer api.bfIndex.Delete()

	router := gin.Default()

	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173"}, // React dev server
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	router.GET("/info", api.getInfo)

	// Bruteforce endpoints
	router.POST("/bf_add_text", api.bfAddText)
	router.POST("/bf_add_text_batch", api.bfAddBatch)
	router.POST("/bf_search", api.bfSearch)

	// IVF endpoints
	router.POST("/ivf_add_text", api.ivfAddText)
	router.POST("/ivf_add_batch", api.ivfAddBatch)
	router.POST("/ivf_search", api.ivfSearch)
	router.POST("/ivf_train", api.ivfTrain)

	router.Run("0.0.0.0:8080")
}
