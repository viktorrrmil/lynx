package lynx

/*
#cgo CFLAGS: -I../../include
#cgo LDFLAGS: -L../../lib -llynx_go -lstdc++
#include "../wrapper/ivf_index_wrapper.h"
#include <stdlib.h>
*/
import "C"
import (
	"errors"
	"unsafe"
)

func NewIVFIndex(metric DistanceMetric, nList int64, nProbe int64) *IVFIndex {
	ptr := C.IVFIndex_new(C.int(metric), C.long(nList), C.long(nProbe))

	return &IVFIndex{ptr: ptr}
}

func (i *IVFIndex) Delete() {
	if i.ptr != nil {
		C.IVFIndex_delete(i.ptr)
		i.ptr = nil
	}
}

func (i *IVFIndex) Search(query []float32, k int64) ([]SearchResult, error) {
	if i.ptr == nil {
		return nil, errors.New("IVFIndex pointer is nil")
	}

	if len(query) == 0 {
		return nil, errors.New("query vector cannot be empty")
	}

	if k <= 0 {
		return nil, errors.New("k must be greater than zero")
	}

	cResults := C.IVFIndex_search(
		i.ptr,
		(*C.float)(&query[0]),
		C.long(len(query)),
		C.long(k),
	)

	defer C.IVFIndex_free_search_results(cResults)

	if cResults == nil {
		return nil, errors.New("search failed in IVFIndex")
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

	for i := 0; i < count; i++ {
		searchResults[i] = SearchResult{
			ID:       int64(results[i].id),
			Distance: float64(results[i].distance),
		}
	}

	return searchResults, nil
}

func (i *IVFIndex) Train(trainingData []float32, numVectors int64, vectorSize int64, iterationCount int64, tolerance float32) error {
	if i.ptr == nil {
		return errors.New("IVFIndex pointer is nil")
	}

	res := C.IVFIndex_train(
		i.ptr,
		(*C.float)(&trainingData[0]),
		C.long(numVectors),
		C.long(vectorSize),
		C.long(iterationCount),
		C.float(tolerance),
	)

	if res == 0 {
		return errors.New("failed to train IVFIndex")
	}

	return nil
}

func (i *IVFIndex) SetVectorStore(store *InMemoryVectorStore) bool {
	return C.IVFIndex_set_vector_store(i.ptr, store.ptr) == 1

}

func (i *IVFIndex) UpdateVectors() error {
	if i.ptr == nil {
		return errors.New("IVFIndex pointer is nil")
	}

	C.IVFIndex_update_vectors(i.ptr)
	return nil
}

func (i *IVFIndex) Size() int64 {
	return int64(C.IVFIndex_size(i.ptr))
}

func (i *IVFIndex) Dimension() int64 {
	return int64(C.IVFIndex_dimension(i.ptr))
}

func (i *IVFIndex) Metric() DistanceMetric {
	return DistanceMetric(C.IVFIndex_distance_metric(i.ptr))
}

func (i *IVFIndex) NList() int64 {
	return int64(C.IVFIndex_nlist(i.ptr))
}

func (i *IVFIndex) NProbe() int64 {
	return int64(C.IVFIndex_nprobe(i.ptr))
}

func (i *IVFIndex) SetNProbe(nProbe int64) {
	C.IVFIndex_set_nprobe(i.ptr, C.long(nProbe))
}

func (i *IVFIndex) IsInitialized() bool {
	return C.IVFIndex_is_initialized(i.ptr) == 1
}
