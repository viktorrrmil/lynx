package lynx

/*
#cgo CFLAGS: -I../../include
#cgo LDFLAGS: -L../../lib -llynx_go -lstdc++
#include "../wrapper/hnsw_index_wrapper.h"
#include <stdlib.h>
*/
import "C"
import (
	"errors"
	"unsafe"
)

func NewHNSWIndex(metric DistanceMetric, M int64, efConstruction int64, efSearch int64) *HNSWIndex {
	ptr := C.HNSWIndex_new(C.int(metric), C.long(M), C.long(efConstruction), C.long(efSearch))
	return &HNSWIndex{ptr: ptr}
}

func (h *HNSWIndex) Delete() {
	if h.ptr != nil {
		C.HNSWIndex_delete(h.ptr)
		h.ptr = nil
	}
}

func (h *HNSWIndex) Search(query []float32, k int64) ([]SearchResult, error) {
	if h.ptr == nil {
		return nil, errors.New("HNSWIndex is not initialized")
	}

	if len(query) == 0 {
		return nil, errors.New("query vector cannot be empty")
	}

	if k <= 0 {
		return nil, errors.New("k must be greater than zero")
	}

	cResults := C.HNSWIndex_search(
		h.ptr,
		(*C.float)(&query[0]),
		C.long(len(query)),
		C.long(k),
	)

	defer C.HNSWIndex_free_search_results(cResults)

	if cResults == nil {
		return nil, errors.New("HNSWIndex search failed")
	}

	count := int(cResults.count)
	if count == 0 {
		return []SearchResult{}, nil
	}

	results := unsafe.Slice(
		(*CSearchResult)(unsafe.Pointer(cResults.results)),
		count,
	)

	searchResults := make([]SearchResult, count)

	for idx := 0; idx < count; idx++ {
		searchResults[idx] = SearchResult{
			ID:       int64(results[idx].id),
			Distance: float64(results[idx].distance),
		}
	}

	return searchResults, nil
}

func (h *HNSWIndex) SetVectorStore(store *InMemoryVectorStore) error {
	if h.ptr == nil {
		return errors.New("HNSWIndex is not initialized")
	}

	if store.ptr == nil {
		return errors.New("InMemoryVectorStore is not initialized")
	}

	result := C.HNSWIndex_set_vector_store(h.ptr, store.ptr)
	if result == 0 {
		return errors.New("failed to set vector store and build HNSW index")
	}
	return nil
}

func (h *HNSWIndex) UpdateVectors() error {
	if h.ptr == nil {
		return errors.New("HNSWIndex is not initialized")
	}

	result := C.HNSWIndex_update_vectors(h.ptr)
	if result == 0 {
		return errors.New("failed to update vectors and rebuild HNSW index")
	}
	return nil
}

func (h *HNSWIndex) Size() int64 {
	if h.ptr == nil {
		return 0
	}

	return int64(C.HNSWIndex_size(h.ptr))
}

func (h *HNSWIndex) Dimension() int64 {
	if h.ptr == nil {
		return 0
	}

	return int64(C.HNSWIndex_dimension(h.ptr))
}

func (h *HNSWIndex) DistanceMetric() DistanceMetric {
	if h.ptr == nil {
		return 0
	}

	return DistanceMetric(C.HNSWIndex_distance_metric(h.ptr))
}

func (h *HNSWIndex) M() int64 {
	if h.ptr == nil {
		return 0
	}

	return int64(C.HNSWIndex_M(h.ptr))
}

func (h *HNSWIndex) EfConstruction() int64 {
	if h.ptr == nil {
		return 0
	}

	return int64(C.HNSWIndex_ef_construction(h.ptr))
}

func (h *HNSWIndex) EfSearch() int64 {
	if h.ptr == nil {
		return 0
	}

	return int64(C.HNSWIndex_ef_search(h.ptr))
}

func (h *HNSWIndex) IsInitialized() bool {
	return h.ptr != nil
}

func (h *HNSWIndex) IsBuilt() bool {
	if h.ptr == nil {
		return false
	}

	return C.HNSWIndex_is_built(h.ptr) == 1
}
