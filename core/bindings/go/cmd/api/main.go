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
	index *lynx.BruteForceIndex
	lock  sync.RWMutex
}

type EmbeddingRequest struct {
	Text string `json:"text"`
}

type EmbeddingResponse struct {
	Embeddings []float32 `json:"embedding"`
	Dimension  int64     `json:"dimension"`
}

type AddTextRequest struct {
	Text string `json:"text"`
}

func NewAPI(dimension int64, metric lynx.DistanceMetric) *API {
	return &API{
		index: lynx.NewBruteforceIndex(dimension, metric),
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

	embedded_text, err := getEmbeddings(request.Text)

	if err != nil {
		c.JSON(500, gin.H{
			"error": err.Error(),
		})
		return
	}

	if err := api.index.Add(api.index.Size()+1, embedded_text); err != nil {
		c.IndentedJSON(500, gin.H{"error": err.Error()})
		return
	}

	c.IndentedJSON(200, gin.H{
		"embeddings": embedded_text,
		"dimension":  api.index.Dimension(),
		"size":       api.index.Size(),
	})
}

func (api *API) addTest(c *gin.Context) {
	api.lock.RLock()
	vec1 := []float32{1.0, 0.0, 0.0}

	if err := api.index.Add(api.index.Size()+1, vec1); err != nil {
		api.lock.RUnlock()
		c.IndentedJSON(400, err.Error())
		return
	}

	api.lock.RUnlock()

	c.IndentedJSON(200, vec1)
}

func main() {
	api := NewAPI(384, lynx.COSINE)
	defer api.index.Delete()

	router := gin.Default()
	router.GET("/test", api.getTest)
	router.GET("/info", api.getInfo)
	router.POST("/add", api.addTest)
	router.POST("/add_text", api.addText)

	router.Run("localhost:8080")
}
