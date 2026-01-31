package lynx

//
///*
//#cgo CFLAGS: -I../../include
//#cgo LDFLAGS: -L../../lib -llynx_go -lstdc++
//#include "../wrapper/ivf_index_wrapper.h"
//#include <stdlib.h>
//*/
//import "C"
//import (
//	"errors"
//	"unsafe"
//)
//
//func NewIVFIndex(dimension int64, metric DistanceMetric, nList int64, nProbe int64) *IVFIndex {
//	ptr := C.IVFIndex_new(C.long(dimension), C.int(metric), C.long(nList), C.long(nProbe))
//
//	return &IVFIndex{ptr: ptr}
//}
//
//func (i *IVFIndex) Delete() {
//	if i.ptr != nil {
//		C.IVFIndex_delete(i.ptr)
//		i.ptr = nil
//	}
//}
//
//func (i *IVFIndex) Train(trainingData []float32, numVectors int64, vectorSize int64, iterationCount int64, tolerance float32) error {
//	if i.ptr == nil {
//		return errors.New("IVFIndex pointer is nil")
//	}
//
//	res := C.IVFIndex_train(
//		i.ptr,
//		(*C.float)(&trainingData[0]),
//		C.long(numVectors),
//		C.long(vectorSize),
//		C.long(iterationCount),
//		C.float(tolerance),
//	)
//
//	if !res {
//		return errors.New("failed to train IVFIndex")
//	}
//
//	return nil
//}
//
//func (i *IVFIndex) Add(id int64, vector []float32) error {
//	if i.ptr == nil {
//		return errors.New("IVFIndex pointer is nil")
//	}
//
//	if len(vector) == 0 {
//		return errors.New("vector cannot be empty")
//	}
//
//	res := C.IVFIndex_add_vector(
//		i.ptr,
//		C.long(id),
//		(*C.float)(&vector[0]),
//		C.long(len(vector)))
//
//	if !res {
//		return errors.New("failed to add vector to IVFIndex")
//	}
//
//	return nil
//}
//
//func (i *IVFIndex) Search(query []float32, k int64) ([]SearchResult, error) {
//	if i.ptr == nil {
//		return nil, errors.New("IVFIndex pointer is nil")
//	}
//
//	if len(query) == 0 {
//		return nil, errors.New("query vector cannot be empty")
//	}
//
//	if k <= 0 {
//		return nil, errors.New("k must be greater than zero")
//	}
//
//	cResults := C.IVFIndex_search(
//		i.ptr,
//		(*C.float)(&query[0]),
//		C.long(len(query)),
//		C.long(k))
//
//	defer C.IVFIndex_free_search_results(cResults)
//
//	if cResults == nil {
//		return nil, errors.New("search failed in IVFIndex")
//	}
//
//	count := int(cResults.count)
//	if count == 0 {
//		return []SearchResult{}, nil
//	}
//
//	results := unsafe.Slice(cResults.results, count)
//
//	searchResults := make([]SearchResult, count)
//
//	for i := 0; i < count; i++ {
//		searchResults[i] = SearchResult{
//			ID:       int64(results[i].id),
//			Distance: float64(results[i].distance),
//		}
//	}
//
//	return searchResults, nil
//}
//
//func (i *IVFIndex) Size() int64 {
//	return int64(C.IVFIndex_size(i.ptr))
//}
//
//func (i *IVFIndex) Dimension() int64 {
//	return int64(C.IVFIndex_dimension(i.ptr))
//}
//
//func (i *IVFIndex) Metric() DistanceMetric {
//	return DistanceMetric(C.IVFIndex_metric(i.ptr))
//}
//
//func (i *IVFIndex) Save(path string) error {
//	// TODO: Implement save functionality
//	return errors.New("Save method not implemented yet for IVFIndex")
//}
//
//func (i *IVFIndex) Load(path string) error {
//	// TODO: Implement load functionality
//	return errors.New("Load method not implemented yet for IVFIndex")
//}
