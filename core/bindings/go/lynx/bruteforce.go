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
	"strconv"
	"unsafe"
)

func NewBruteforceIndex(metric DistanceMetric) *BruteForceIndex {
	ptr := C.BruteForceIndex_new(C.int(metric))

	return &BruteForceIndex{ptr: ptr}
}

func (b *BruteForceIndex) Delete() {
	if b.ptr != nil {
		C.BruteForceIndex_delete(b.ptr)
		b.ptr = nil
	}
}

func (b *BruteForceIndex) Search(query []float32, k int64) ([]SearchResult, error) {
	print("Bruteforce vector store size: " + strconv.FormatInt(b.Size(), 10) + "\n")

	if b.ptr == nil {
		return nil, errors.New("BruteForceIndex pointer is nil")
	}

	if len(query) == 0 {
		return nil, errors.New("query vector cannot be empty")
	}

	if k <= 0 {
		return nil, errors.New("k must be greater than zero")
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

func (b *BruteForceIndex) Size() int64 {
	return int64(C.BruteForceIndex_size(b.ptr))
}

func (b *BruteForceIndex) Dimension() int64 {
	return int64(C.BruteForceIndex_dimension(b.ptr))
}

func (b *BruteForceIndex) SetVectorStore(store *InMemoryVectorStore) bool {
	return C.BruteForceIndex_set_vector_store(b.ptr, store.ptr) == 1
}
