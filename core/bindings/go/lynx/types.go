package lynx

import "unsafe"

type DistanceMetric int

const (
	L2     DistanceMetric = 0
	COSINE DistanceMetric = 1
)

type SearchResult struct {
	ID       int64   `json:"id"`
	Distance float64 `json:"distance"`
}

type BruteForceIndex struct {
	ptr unsafe.Pointer
}
