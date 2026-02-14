package main

import (
	"fmt"
	"lynx/data_store"
	"lynx/lynx"
)

func NewAPI(dimension int64, metric lynx.DistanceMetric) *API {
	cache := data_store.NewVectorCache("/app/data/vector_cache.bin")
	fmt.Printf("Cache file path: %s\n", cache.FilePath())

	return &API{
		bfIndex:     lynx.NewBruteforceIndex(metric),
		ivfIndex:    lynx.NewIVFIndex(metric, 100, 10),
		bfMetadata:  make(map[int64]string),
		ivfMetadata: make(map[int64]string),
		vectorStore: lynx.NewInMemoryVectorStore(),
		vectorCache: cache,
		bfNextID:    1,
		ivfNextID:   1,
	}
}
