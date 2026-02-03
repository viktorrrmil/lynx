package main

import "lynx/lynx"

func NewAPI(dimension int64, metric lynx.DistanceMetric) *API {
	return &API{
		bfIndex:     lynx.NewBruteforceIndex(metric),
		ivfIndex:    lynx.NewIVFIndex(metric, 100, 10),
		bfMetadata:  make(map[int64]string),
		ivfMetadata: make(map[int64]string),
		vectorStore: lynx.NewInMemoryVectorStore(),
		bfNextID:    1,
		ivfNextID:   1,
	}
}
