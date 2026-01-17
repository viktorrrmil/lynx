package main

import (
	"sync"

	"lynx/lynx"

	"github.com/gin-gonic/gin"
)

type API struct {
	index *lynx.BruteForceIndex
	lock  sync.RWMutex
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
	api := NewAPI(3, lynx.COSINE)
	defer api.index.Delete()

	router := gin.Default()
	router.GET("/test", api.getTest)
	router.GET("/info", api.getInfo)
	router.POST("/add", api.addTest)

	router.Run("localhost:8080")
}
