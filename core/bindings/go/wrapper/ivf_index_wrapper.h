//
// Created by viktor on 1/21/26.
//

#ifndef LYNX_IVF_INDEX_WRAPPER_H
#define LYNX_IVF_INDEX_WRAPPER_H

#include <stdbool.h>

#include "bruteforce_index_wrapper.h"

#ifdef __cplusplus
extern "C" {
#endif
    typedef struct {
        long id;
        float distance;
    } IVFSearchResult;

    typedef struct {
        IVFSearchResult* results;
        long count;
    } IVFSearchResults;

    void* IVFIndex_new(long dimension, int metric, long nlist, long nprobe);
    void IVFIndex_delete(void* index);
    bool IVFIndex_add_vector(void* index, long id, const float* vector_data, long vector_size);
    IVFSearchResults* IVFIndex_search(void* index, const float* query, long query_size, long k);
    void IVFIndex_free_search_results(IVFSearchResults* results);
    long IVFIndex_size(void* index);
    bool IVFIndex_save(void* index, const char* path);
    bool IVFIndex_load(void* index, const char* path);
    long IVFIndex_dimension(void* index);
    int IVFIndex_metric(void* index);
    bool IVFIndex_train(void* index, const float* training_data, long num_vectors, long vector_size, long n_iterations, float tolerance);

#ifdef __cplusplus
}
#endif

#endif //LYNX_IVF_INDEX_WRAPPER_H