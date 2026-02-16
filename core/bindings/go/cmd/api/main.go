package main

import (
	"lynx/lynx"

	"github.com/gin-gonic/gin"
)

func (api *API) getTest(c *gin.Context) {
	c.IndentedJSON(200, "Works ok")
}

func main() {
	api := NewAPI(384, lynx.COSINE)
	defer api.bfIndex.Delete()

	router := setupRouter(api)

	err := router.Run("0.0.0.0:8080")
	if err != nil {
		return
	}
}
