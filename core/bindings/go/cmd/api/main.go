package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"sync"

	"lynx/lynx"

	"github.com/gin-gonic/gin"
)

type API struct {
	index    *lynx.BruteForceIndex
	metadata map[int64]string // id -> original text
	nextID   int64
	lock     sync.RWMutex
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
		index:    lynx.NewBruteforceIndex(dimension, metric),
		metadata: make(map[int64]string),
		nextID:   1,
	}
}

func (api *API) getTest(c *gin.Context) {
	c.IndentedJSON(200, "Works ok")
}

func (api *API) getInfo(c *gin.Context) {
	api.lock.RLock()
	info := map[string]interface{}{
		"size":      api.index.Size(),
		"dimension": api.index.Dimension(),
		"metric":    api.index.Metric(),
	}
	api.lock.RUnlock()
	c.IndentedJSON(200, info)
}

func getEmbeddings(text string) ([]float32, error) {
	request := EmbeddingRequest{Text: text}
	jsonData, _ := json.Marshal(request)

	resp, err := http.Post("http://localhost:5000/embed_text",
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

	resp, err := http.Post("http://localhost:5000/embed_text_batch",
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

func (api *API) addText(c *gin.Context) {
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

	if err := api.index.Add(api.index.Size()+1, embeddedText); err != nil {
		c.IndentedJSON(500, gin.H{"error": err.Error()})
		return
	}

	api.metadata[api.index.Size()] = request.Text

	c.IndentedJSON(200, gin.H{
		"embeddings": embeddedText,
		"dimension":  api.index.Dimension(),
		"size":       api.index.Size(),
	})
}

func (api *API) addBatch(c *gin.Context) {
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
		id := api.nextID
		api.nextID++

		if err := api.index.Add(id, embedding); err != nil {
			c.JSON(500, gin.H{"error": err.Error()})
			return
		}

		api.metadata[id] = texts[i]

		results[i] = BatchResult{
			ID:   id,
			Text: texts[i],
		}
	}

	c.IndentedJSON(200, gin.H{
		"added":     results,
		"dimension": api.index.Dimension(),
		"size":      api.index.Size(),
	})
}

func (api *API) search(c *gin.Context) {
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

	results, err := api.index.Search(embeddedQuery, request.TopK)
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
			"text":     api.metadata[result.ID],
		}
	}

	c.IndentedJSON(200, gin.H{
		"results": enrichedResults,
	})
}

func main() {
	api := NewAPI(384, lynx.COSINE)
	defer api.index.Delete()

	router := gin.Default()

	router.GET("/info", api.getInfo)
	router.POST("/add_text", api.addText)
	router.POST("/add_text_batch", api.addBatch)
	router.GET("/search", api.search)

	router.Run("localhost:8080")
}
