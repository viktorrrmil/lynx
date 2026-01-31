package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"os"
	"strconv"
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

	vectorStore *lynx.InMemoryVectorStore

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
		bfIndex:     lynx.NewBruteforceIndex(metric),
		ivfIndex:    nil, // nil since it's not trained yet
		bfMetadata:  make(map[int64]string),
		ivfMetadata: nil,
		vectorStore: lynx.NewInMemoryVectorStore(),
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

//	func (api *API) ivfSearch(c *gin.Context) {
//		var request SearchRequest
//		if err := c.BindJSON(&request); err != nil {
//			c.JSON(400, gin.H{
//				"message": err.Error(),
//			})
//		}
//
//		api.lock.RLock()
//		defer api.lock.RUnlock()
//
//		embeddedQuery, err := getEmbeddings(request.Query)
//
//		if err != nil {
//			c.JSON(500, gin.H{
//				"error": err.Error(),
//			})
//			return
//		}
//
//		var start = time.Now()
//
//		results, err := api.ivfIndex.Search(embeddedQuery, request.TopK)
//
//		var searchTime = time.Since(start)
//
//		if err != nil {
//			c.JSON(500, gin.H{
//				"error": err.Error(),
//			})
//		}
//
//		enrichedResults := make([]map[string]interface{}, len(results))
//		for i, result := range results {
//			enrichedResults[i] = map[string]interface{}{
//				"id":       result.ID,
//				"distance": result.Distance,
//				"text":     api.ivfMetadata[result.ID],
//			}
//		}
//
//		c.IndentedJSON(200, gin.H{
//			"results":        enrichedResults,
//			"search_time_ms": searchTime.Milliseconds(),
//			"index_type":     "ivf",
//			"index_size":     api.ivfIndex.Size(),
//		})
//	}

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

	for i, text := range request.Batch {
		api.bfMetadata[startID+int64(i)] = text
	}

	println("Vector store size after add:", api.vectorStore.Size())

	c.IndentedJSON(200, gin.H{
		"message":  "Batch vectors added successfully",
		"count":    len(embeddedTextBatch),
		"start_id": startID,
		"added":    embeddedTextBatch,
	})
}

func main() {
	api := NewAPI(384, lynx.COSINE)
	defer api.bfIndex.Delete()

	if api.bfIndex.SetVectorStore(api.vectorStore) {
		println("InMemoryVectorStore is now connected to BruteForceIndex")
	}

	router := gin.Default()

	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173"}, // React dev server
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	router.GET("/info", api.getInfo)

	// Vector Store endpoints
	router.POST("/vector_store/add", api.addToVectorStore)
	router.POST("/vector_store/add_batch", api.addBatchToVectorStore)

	// Bruteforce endpoints
	router.POST("/bf_search", api.bfSearch)

	// IVF endpoints TODO: enable when IVF is implemented
	//router.POST("/ivf_search", api.ivfSearch)
	//router.POST("/ivf_train", api.ivfTrain)

	router.Run("0.0.0.0:8080")
}
