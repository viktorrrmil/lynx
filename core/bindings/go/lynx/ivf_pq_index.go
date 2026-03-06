package lynx

/*
#cgo CFLAGS: -I../../include
#cgo LDFLAGS: -L../../lib -llynx_go -lstdc++
#include "../wrapper/ivf_pq_index_wrapper.h"
#include <stdlib.h>
*/
import "C"
import (
	"errors"
	"unsafe"
)

func NewIVFPQIndex(metric DistanceMetric, nList int64, nProbe int64, m int64, codebookSize int64) *IVFPQIndex {
	ptr := C.IVFPQIndex_new(C.int(metric), C.long(nList), C.long(nProbe), C.long(m), C.long(codebookSize))

	return &IVFPQIndex{ptr: ptr}
}

func (i *IVFPQIndex) Delete() {
	if i.ptr != nil {
		C.IVFPQIndex_delete(i.ptr)
		i.ptr = nil
	}
}

func (i *IVFPQIndex) Search(query []float32, k int64) ([]SearchResult, error) {
	if i.ptr == nil {
		return nil, errors.New("IVFPQIndex is not initialized")
	}

	if len(query) == 0 {
		return nil, errors.New("query vector cannot be empty")
	}

	if k <= 0 {
		return nil, errors.New("k must be greater than zero")
	}

	cResults := C.IVFPQIndex_search(
		i.ptr,
		(*C.float)(&query[0]),
		C.long(len(query)),
		C.long(k),
	)

	defer C.IVFPQIndex_free_search_results(cResults)

	if cResults == nil {
		return nil, errors.New("IVFPQIndex search failed")
	}

	count := int(cResults.count)
	if count == 0 {
		return []SearchResult{}, nil
	}

	results := unsafe.Slice(
		(*C.IVFPQSearchResult)(unsafe.Pointer(cResults.results)),
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

func (i *IVFPQIndex) Train(trainingData []float32, numVectors int64, vectorSize int64, iterationCount int64, tolerance float32, populateInvertedLists bool) error {
	if i.ptr == nil {
		return errors.New("IVFPQIndex pointer is nil")
	}

	populateFlag := C.int(0)
	if populateInvertedLists {
		populateFlag = C.int(1)
	}

	res := C.IVFPQIndex_train(
		i.ptr,
		(*C.float)(&trainingData[0]),
		C.long(numVectors),
		C.long(vectorSize),
		C.long(iterationCount),
		C.float(tolerance),
		populateFlag,
	)

	if res == 0 {
		return errors.New("failed to train IVFPQIndex")
	}

	return nil
}

func (i *IVFPQIndex) SetVectorStore(store *InMemoryVectorStore) bool {
	return C.IVFPQIndex_set_vector_store(i.ptr, store.ptr) == 1
}

func (i *IVFPQIndex) UpdateVectors() error {
	if i.ptr == nil {
		return errors.New("IVFPQIndex pointer is nil")
	}

	res := C.IVFPQIndex_update_vectors(i.ptr)

	if res == 0 {
		return errors.New("failed to update vectors in IVFPQIndex")
	}

	return nil
}

func (i *IVFPQIndex) Size() int64 {
	return int64(C.IVFPQIndex_size(i.ptr))
}

func (i *IVFPQIndex) Dimension() int64 {
	return int64(C.IVFPQIndex_dimension(i.ptr))
}

func (i *IVFPQIndex) Metric() DistanceMetric {
	return DistanceMetric(C.IVFPQIndex_distance_metric(i.ptr))
}

func (i *IVFPQIndex) NList() int64 {
	return int64(C.IVFPQIndex_nlist(i.ptr))
}

func (i *IVFPQIndex) NProbe() int64 {
	return int64(C.IVFPQIndex_nprobe(i.ptr))
}

func (i *IVFPQIndex) SetNProbe(nProbe int64) {
	C.IVFPQIndex_set_nprobe(i.ptr, C.long(nProbe))
}

func (i *IVFPQIndex) IsInitialized() bool {
	return C.IVFPQIndex_is_initialized(i.ptr) == 1
}

// PQ-specific methods

func (i *IVFPQIndex) M() int64 {
	return int64(C.IVFPQIndex_m(i.ptr))
}

func (i *IVFPQIndex) SetM(m int64) {
	C.IVFPQIndex_set_m(i.ptr, C.long(m))
}

func (i *IVFPQIndex) CodebookSize() int64 {
	return int64(C.IVFPQIndex_codebook_size(i.ptr))
}

func (i *IVFPQIndex) SetCodebookSize(codebookSize int64) {
	C.IVFPQIndex_set_codebook_size(i.ptr, C.long(codebookSize))
}

func (i *IVFPQIndex) CompressedDim() int64 {
	return int64(C.IVFPQIndex_compressed_dim(i.ptr))
}

func (i *IVFPQIndex) SetCompressedDim(compressedDim int64) {
	C.IVFPQIndex_set_compressed_dim(i.ptr, C.long(compressedDim))
}
