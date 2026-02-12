package lynx

import "C"
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

type CSearchResult struct {
	id       C.longlong
	distance C.float
}

type BruteForceIndex struct {
	ptr unsafe.Pointer
}

type IVFIndex struct {
	ptr unsafe.Pointer
}

type InMemoryVectorStore struct {
	ptr unsafe.Pointer
}
