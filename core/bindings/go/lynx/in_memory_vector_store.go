package lynx

/*
#cgo CFLAGS: -I../../include
#cgo LDFLAGS: -L../../lib -llynx_go -lstdc++
#include "../wrapper/in_memory_vector_store_wrapper.h"
#include <stdlib.h>
*/
import "C"
import (
	"fmt"
	"runtime"
	"unsafe"
)

func NewInMemoryVectorStore() *InMemoryVectorStore {
	ptr := C.InMemoryVectorStore_new()

	return &InMemoryVectorStore{ptr: ptr}
}

func (v *InMemoryVectorStore) Delete() {
	if v.ptr != nil {
		C.InMemoryVectorStore_delete(v.ptr)
		v.ptr = nil
	}
}

func (v *InMemoryVectorStore) Size() int64 {
	if v.ptr == nil {
		return 0
	}

	return int64(C.InMemoryVectorStore_size(v.ptr))
}

func (v *InMemoryVectorStore) Dimension() int64 {
	if v.ptr == nil {
		return 0
	}

	return int64(C.InMemoryVectorStore_dimension(v.ptr))
}

func (v *InMemoryVectorStore) GetVector(id int64) ([]float32, bool) {
	if v.ptr == nil {
		return nil, false
	}

	var length C.long
	vecPtr := C.InMemoryVectorStore_get_vector(v.ptr, C.long(id), &length)

	if vecPtr == nil || length == 0 {
		return nil, false
	}

	defer C.free(unsafe.Pointer(vecPtr))
	vector := make([]float32, length)

	copy(vector, (*[1 << 30]float32)(unsafe.Pointer(vecPtr))[:length:length])

	return vector, true
}

func (v *InMemoryVectorStore) AddVector(vector []float32) error {
	if v.ptr == nil {
		return fmt.Errorf("vector store is nil")
	}

	if len(vector) == 0 {
		return fmt.Errorf("empty vector")
	}

	cArray := (*C.float)(unsafe.Pointer(&vector[0]))
	res := C.InMemoryVectorStore_add_vector(v.ptr, cArray, C.long(len(vector)))

	runtime.KeepAlive(vector)

	if !res {
		return fmt.Errorf("failed to add vector to store")
	}

	return nil
}

func (v *InMemoryVectorStore) AddBatch(vectors [][]float32) error {
	if v.ptr == nil {
		return fmt.Errorf("vector store is nil")
	}

	batchSize := len(vectors)
	if batchSize == 0 {
		return nil
	}

	dim := len(vectors[0])

	for i, vec := range vectors {
		if len(vec) != dim {
			return fmt.Errorf("vector at index %d has dimension %d, expected %d", i, len(vec), dim)
		}
	}

	flatVectors := make([]float32, batchSize*dim)
	for i, vec := range vectors {
		copy(flatVectors[i*dim:(i+1)*dim], vec)
	}

	// DEBUG LOG
// 	fmt.Println("=== GO ADD_BATCH DEBUG ===")
// 	fmt.Printf("batchSize: %d, dim: %d\n", batchSize, dim)
// 	fmt.Printf("flatVectors length: %d\n", len(flatVectors))
// 	fmt.Printf("First 5 values: %v\n", flatVectors[:5])
//
// 	sum := float32(0)
// 	for i := 0; i < dim; i++ {
// 		sum += flatVectors[i]
// 	}
// 	fmt.Printf("First vector sum: %f\n", sum)
// 	fmt.Println("==========================")

	// Using "runtime.KeepAlive(flatVectors)" also works

    // Added pinning to make sure Go's GC do something weird with the memory while the engine is accessing it
	var pinner runtime.Pinner
	pinner.Pin(&flatVectors[0])
	defer pinner.Unpin()

	cArray := (*C.float)(unsafe.Pointer(&flatVectors[0]))
	res := C.InMemoryVectorStore_add_batch(v.ptr, cArray, C.long(batchSize), C.long(dim))

	if !res {
		return fmt.Errorf("failed to add batch to vector store")
	}

	return nil
}
