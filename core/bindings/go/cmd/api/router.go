package main

import (
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func setupRouter(api *API) *gin.Engine {
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

	// IVF endpoints
	router.POST("/ivf_search", api.ivfSearch)
	router.POST("/rebuild_ivf", api.configureIVF)

	// Vector Cache endpoints
	router.POST("/vector_cache/save", api.saveVectorCache)
	router.POST("/vector_cache/load", api.loadVectorCache)
	router.GET("/vector_cache/info", api.getVectorCacheInfo)

	// Index status endpoint
	router.GET("/index_status", api.getIndexStatus)

	return router
}
