package lynx

/*
#cgo CFLAGS: -I../../include
#cgo LDFLAGS: -L../../lib -llynx_go -lstdc++
#include "../wrapper/bruteforce_index_wrapper.h"
#include <stdlib.h>
*/
import "C"
import (
	"errors"
	"unsafe"
)

func NewBruteforceIndex(dimension int64, metric DistanceMetric) *BruteForceIndex {
	ptr := C.BruteForceIndex_new(C.long(dimension), C.int(metric))

	return &BruteForceIndex{ptr: ptr}
}

func (b *BruteForceIndex) Delete() {
	if b.ptr != nil {
		C.BruteForceIndex_delete(b.ptr)
		b.ptr = nil
	}
}

func (b *BruteForceIndex) Add(id int64, vector []float32) error {
	if b.ptr == nil {
		return errors.New("BruteForceIndex pointer is nil")
	}

	if len(vector) == 0 {
		return errors.New("vector cannot be empty")
	}

	res := C.BruteForceIndex_add_vector(
		b.ptr,
		C.long(id),
		(*C.float)(&vector[0]),
		C.long(len(vector)),
	)

	if !res {
		return errors.New("failed to add vector to BruteForceIndex")
	}
	return nil
}

func (b *BruteForceIndex) Search(query []float32, k int64) ([]SearchResult, error) {
	if b.ptr == nil {
		return nil, errors.New("BruteForceIndex pointer is nil")
	}

	if len(query) == 0 {
		return nil, errors.New("query vector cannot be empty")
	}

	if k <= 0 {
		return nil, errors.New("k must be greater than 0")
	}

	cResults := C.BruteForceIndex_search(
		b.ptr,
		(*C.float)(&query[0]),
		C.long(len(query)),
		C.long(k),
	)

	defer C.BruteForceIndex_free_search_results(cResults)

	if cResults == nil {
		return nil, errors.New("search failed in BruteForceIndex")
	}

	count := int(cResults.count)
	if count == 0 {
		return []SearchResult{}, nil
	}

	results := unsafe.Slice(cResults.results, count)

	searchResults := make([]SearchResult, count)

	for i := 0; i < count; i++ {
		searchResults[i] = SearchResult{
			ID:       int64(results[i].id),
			Distance: float64(results[i].distance),
		}
	}

	return searchResults, nil
}

func (b *BruteForceIndex) Size() int64 {
	return int64(C.BruteForceIndex_size(b.ptr))
}

func (b *BruteForceIndex) Dimension() int64 {
	return int64(C.BruteForceIndex_dimension(b.ptr))
}

func (b *BruteForceIndex) Metric() DistanceMetric {
	return DistanceMetric(C.BruteForceIndex_metric(b.ptr))
}

func (b *BruteForceIndex) Save(path string) error {
	cPath := C.CString(path)
	defer C.free(unsafe.Pointer(cPath))

	res := C.BruteForceIndex_save(b.ptr, cPath)

	if !res {
		return errors.New("failed to save BruteForceIndex")
	}

	return nil
}

func (b *BruteForceIndex) Load(path string) error {
	cPath := C.CString(path)
	defer C.free(unsafe.Pointer(cPath))

	res := C.BruteForceIndex_load(b.ptr, cPath)

	if !res {
		return errors.New("failed to load BruteForceIndex")
	}

	return nil
}
