//
// Created by viktor on 1/30/26.
//

#ifndef LYNX_IN_MEMORY_VECTOR_STORE_WRAPPER_H
#define LYNX_IN_MEMORY_VECTOR_STORE_WRAPPER_H

#include <stdbool.h>

#ifdef  __cplusplus
extern "C" {
#endif
    void* InMemoryVectorStore_new();
    void InMemoryVectorStore_delete(void* store);

    int InMemoryVectorStore_size(void* store);
    int InMemoryVectorStore_dimension(void* store);

    float* InMemoryVectorStore_get_vector(void* store, long id, long* out_size);
    float* InMemoryVectorStore_get_all_vectors(void* store, long* out_num_vectors, long* out_vector_size);

    void InMemoryVectorStore_free_vector(float* vector);

    bool InMemoryVectorStore_add_vector(void* store, const float* vector_data, long vector_size);
    bool InMemoryVectorStore_add_batch(void* store, const float* vectors_data, long num_vectors, long vector_size);

#ifdef  __cplusplus
}
#endif

#endif //LYNX_IN_MEMORY_VECTOR_STORE_WRAPPER_H