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
	router.GET("/is_ready", api.isReady)

	// Vector Store endpoints
	router.POST("/vector_store/add", api.addToVectorStore)
	router.POST("/vector_store/add_batch", api.addBatchToVectorStore)

	// Bruteforce endpoints
	router.POST("/bf_search", api.bfSearch)

	// IVF endpoints
	router.POST("/ivf_search", api.ivfSearch)
	router.POST("/rebuild_ivf", api.configureIVF)

	// IVF-PQ endpoints
	router.POST("/ivf_pq_search", api.ivfPqSearch)
	router.POST("/rebuild_ivf_pq", api.configureIVFPQ)

	// HNSW endpoints
	router.POST("/hnsw_search", api.hnswSearch)
	router.POST("/rebuild_hnsw", api.configureHNSW)

	// Vector Cache endpoints
	router.POST("/vector_cache/save", api.saveVectorCache)
	router.POST("/vector_cache/load", api.loadVectorCache)
	router.GET("/vector_cache/info", api.getVectorCacheInfo)

	// Index status endpoint
	router.GET("/index_status", api.getIndexStatus)
	router.GET("/db_status", api.getDatabaseStatus)

	// Benchmark
	router.POST("/benchmark", api.runBenchmark)
	router.POST("/benchmark/comprehensive", api.runComprehensiveBenchmark)
	router.POST("/benchmark/ivf_param_sweep", api.runIVFParamSweep)
	router.POST("/benchmark/ivf_pq_param_sweep", api.runIVFPQParamSweep)
	//router.POST("/benchmark/ivf_param_sweep/estimate", api.estimateIVFParamSweepTimeHandler)
	//router.POST("/benchmark/ivf_pq_param_sweep/estimate", api.estimateIVFPQParamSweepTimeHandler)

	// Semantic Geo Search
	router.POST("/api/v1/semantic-geo-search/index", api.semanticGeoSearchIndex)
	router.GET("/api/v1/semantic-geo-search/index", api.semanticGeoSearchIndex)

	return router
}
